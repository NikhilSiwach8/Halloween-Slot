import { useCallback, useEffect, useRef, useState } from 'react';
import { roundCost } from '../config/gameConfig';
import type { BonusType, GameConfig, ModeId, MysteryPrize } from '../config/types';
import type { Board } from '../engine/board';
import type { RoundResult, SpinResult } from '../engine/round';
import { PlatformError, type Platform, type PlatformSession } from '../platform/platform';
import { audio } from './audio';

export type Speed = 'normal' | 'turbo';

export type Overlay =
  | { kind: 'mystery'; prize: MysteryPrize | null }
  | { kind: 'bonusIntro'; bonus: BonusType; source: 'ANTENNAS' | 'TAPE' | 'BUY'; spins: number }
  | { kind: 'bonusEnd'; bonus: BonusType; winX100: number }
  | { kind: 'bigWin'; winX100: number; tier: WinTier };

/** Win celebration tiers, in order. MAX is only shown when the round reached the max win. */
export type WinTier = 'GOOD' | 'MEGA' | 'INSANE' | 'EPIC' | 'MAX';
/** Lowest round win (x stake) for each tier below MAX. */
export const WIN_TIERS: { tier: Exclude<WinTier, 'MAX'>; atX: number }[] = [
  { tier: 'GOOD', atX: 10 },
  { tier: 'MEGA', atX: 50 },
  { tier: 'INSANE', atX: 200 },
  { tier: 'EPIC', atX: 1000 },
];
export function winTier(winX100: number, capped: boolean): WinTier | null {
  if (capped) return 'MAX';
  let found: WinTier | null = null;
  for (const t of WIN_TIERS) if (winX100 >= t.atX * 100) found = t.tier;
  return found;
}

export interface BonusView {
  type: BonusType;
  spin: number;
  totalSpins: number;
  winX100: number;
  meter?: number;
  sticky?: boolean[][];
}

export interface View {
  board: Board | null;
  /** Statics still showing noise. */
  unrevealed: boolean;
  /** "r,row" keys of cells in a win. */
  winCells: Set<string>;
  spinning: boolean;
  ticker: string;
  /** Win of the round so far, hundredths of stake. */
  roundWinX100: number;
  /** Base bet the shown round was played at (wins are paid on it, whatever the bet is now). */
  roundBet: number;
  bonus: BonusView | null;
  overlay: Overlay | null;
  busy: boolean;
  /** Increments each time a bonus's spins begin (drives the static wipe). */
  bonusFx: number;
  /** Increments on every spin (restarts the reel spin / landing animations). */
  spinId: number;
  /** Antennas on the board that just landed (lights the Signal Panel lamps). */
  antennas: number;
  /** Win of the spin being shown, for the win pop-up over the reels (0 = hidden). */
  spinWinX100: number;
  /** The player skipped: reels jump straight to rest instead of animating. */
  instant: boolean;
}

/** Reel animation timing (ms). The reels land one by one, `REEL_STAGGER` apart. */
export const SPIN_MS = 520;
export const REEL_STAGGER = 90;
export const TURBO_FACTOR = 0.35;
/**
 * Reel motion (see components/Reels.tsx). A reel scrolls at `speed` cells per second, then
 * decelerates over `stopMs` with an ease-out-back curve whose starting speed equals the cruise
 * speed (so the stop has no jolt) and that overshoots once before settling. `baseMs` is the
 * time from the result arriving to the first reel starting its stop; it is just long enough
 * for the new symbols to scroll in from above the window rather than appear in it.
 */
export const REEL_BACK = 1.6;
export function reelMotion(turbo: boolean) {
  const speed = turbo ? 30 : 18;
  const stopMs = turbo ? 230 : 380;
  /** Distance (cells) covered while stopping. */
  const stopCells = (speed * stopMs) / 1000 / (REEL_BACK + 3);
  const baseMs = Math.ceil(((4.2 - stopCells) / speed) * 1000);
  /** When, within the stop, the reel first reaches its resting place (the "thunk"). */
  const hitMs = stopMs / (REEL_BACK + 1);
  return { speed, stopMs, stopCells, baseMs, hitMs };
}
/** Extra spin time for each reel that could still complete a bonus (2+ Antennas already landed). */
export const TEASE_MS = 750;

/**
 * When each reel stops (ms after the results arrive). Reels stop left to right; once two
 * Antennas are showing, every later reel spins on longer (the "tease") before it stops.
 */
export function reelStops(board: Board, turbo: boolean): { delays: number[]; tease: boolean[] } {
  const k = turbo ? TURBO_FACTOR : 1;
  const delays: number[] = [];
  const tease: boolean[] = [];
  let antennas = 0;
  let extra = 0;
  for (let r = 0; r < board.length; r++) {
    const t = antennas >= 2;
    if (t) extra += TEASE_MS;
    tease.push(t);
    delays.push((r * REEL_STAGGER + extra) * k);
    antennas += board[r].filter((c) => c.s === 'ANTENNA').length;
  }
  return { delays, tease };
}

const EMPTY: View = { board: null, unrevealed: false, winCells: new Set(), spinning: false, ticker: 'Tune in… press SPIN.', roundWinX100: 0, roundBet: 0, bonus: null, overlay: null, busy: false, bonusFx: 0, spinId: 0, antennas: 0, spinWinX100: 0, instant: false };

export function useGame(cfg: GameConfig, platform: Platform, session: PlatformSession) {
  const [balance, setBalance] = useState(session.balance);
  const [bet, setBet] = useState(session.replay?.bet ?? session.defaultBet);
  const [error, setError] = useState<string | null>(null);
  /** Replay mode: true once the replayed round has been shown (offers Play Again). */
  const [replayed, setReplayed] = useState(false);
  const [doubleChance, setDoubleChance] = useState(false);
  const [featureMode, setFeatureMode] = useState<ModeId | null>(null);
  const [speed, setSpeed] = useState<Speed>('normal');
  /**
   * Lowest round cost the server refused as an invalid bet (ERR_VAL) for a mode costing more
   * than 1x: the RGS may cap the total stake of buys. Modes costing that much or more are
   * disabled from then on, so the player isn't sent into the same error again.
   */
  const [costLimit, setCostLimit] = useState<number | null>(null);
  const [view, setView] = useState<View>(EMPTY);
  const skip = useRef(false);
  const waiter = useRef<(() => void) | null>(null);
  const speedRef = useRef(speed);
  /** Autoplay is running: overlays continue by themselves (set by the app). */
  const autoRef = useRef(false);
  /** Called as soon as a round's result is known (autoplay's stop conditions use it). */
  const onRoundRef = useRef<((round: RoundResult) => void) | null>(null);
  useEffect(() => void (speedRef.current = speed), [speed]);

  const patch = (p: Partial<View>) => setView((v) => ({ ...v, ...p }));
  const sleep = (ms: number) =>
    new Promise<void>((res) => {
      if (skip.current) return res();
      setTimeout(res, speedRef.current === 'turbo' ? ms * TURBO_FACTOR : ms);
    });
  /** Waits for the player to press the overlay button. */
  /**
   * Waits for the player to press the overlay button. During autoplay (`autoRef`), it moves on
   * by itself after `autoMs`, so an unattended autoplay never stalls on a pop-up.
   */
  const waitForPlayer = (autoMs?: number) =>
    new Promise<void>((res) => {
      waiter.current = res;
      if (autoRef.current && autoMs !== undefined) {
        setTimeout(() => {
          if (waiter.current === res) {
            waiter.current = null;
            res();
          }
        }, speedRef.current === 'turbo' ? autoMs * 0.5 : autoMs);
      }
    });
  const advance = useCallback(() => {
    if (waiter.current) {
      const w = waiter.current;
      waiter.current = null;
      w();
    } else skip.current = true;
  }, []);

  const showSpin = async (s: SpinResult, roundSoFar: number, extra: Partial<View> = {}) => {
    setView((v) => ({ ...v, spinning: true, instant: skip.current, spinId: v.spinId + 1, winCells: new Set(), antennas: 0, spinWinX100: 0, ...extra }));
    audio.spin();
    await sleep(SPIN_MS);
    const turbo = speedRef.current === 'turbo';
    const stops = reelStops(s.landed, turbo);
    patch({ board: s.landed, spinning: false, unrevealed: !!s.reveal, instant: skip.current });
    const motion = reelMotion(turbo);
    const hits = stops.delays.map((d) => (motion.baseMs + d + motion.hitMs) / 1000);
    if (!skip.current) {
      audio.land(hits);
      stops.tease.forEach((t, r) => t && audio.tease(hits[r - 1] ?? 0, hits[r] - (hits[r - 1] ?? 0)));
    }
    // Reels stop one by one (Reels.tsx, same timing); continue once the last one has settled.
    // The delays already include turbo, so wait for them directly rather than through sleep().
    await new Promise<void>((res) => (skip.current ? res() : setTimeout(res, motion.baseMs + stops.delays[cfg.reels - 1] + motion.stopMs + 40)));
    patch({ antennas: s.antennas });
    if (s.antennas >= 2) audio.antenna(s.antennas);
    if (s.reveal) {
      await sleep(650);
      const firstBoard = s.landed.map((reel) => reel.map((c) => (c.s === 'STATIC' ? { s: s.reveal!.first, m: 1 } : c)));
      audio.reveal();
      patch({ board: firstBoard, unrevealed: false, ticker: `Static resolves… ${cfg.symbols[s.reveal.first].name}` });
      if (s.reveal.retunedTo) {
        await sleep(700);
        patch({ board: s.landed, unrevealed: true, ticker: 'Nothing on this frequency… RETUNING' });
        audio.retune();
        await sleep(600);
        patch({ board: s.board, unrevealed: false, ticker: `Retuned to ${cfg.symbols[s.reveal.retunedTo].name}` });
        audio.reveal();
      }
    }
    if (s.wins.length) {
      await sleep(250);
      const cells = new Set<string>();
      for (const w of s.wins) for (const [r, row] of w.positions) cells.add(`${r},${row}`);
      audio.win(s.winX100);
      const best = [...s.wins].sort((a, b) => b.winX100 - a.winX100)[0];
      patch({
        winCells: cells,
        spinWinX100: s.winX100,
        roundWinX100: roundSoFar + s.winX100,
        ticker: `${best.ways > 1 ? `${best.ways} ways of ` : ''}${cfg.symbols[best.symbol].name} x${best.length}${best.multipliedWays !== best.ways ? ` · wild multipliers x${(best.multipliedWays / best.ways).toFixed(1).replace('.0', '')}` : ''}${best.globalMultiplier > 1 ? ` · Signal x${best.globalMultiplier}` : ''}`,
      });
      await sleep(s.winX100 >= 1000 ? 1100 : 700);
    } else if (!s.reveal) {
      patch({ ticker: 'Only static…' });
    }
  };

  const play = useCallback(async (mode: ModeId) => {
    const cost = roundCost(cfg, mode, bet);
    if (view.busy || (!session.replay && cost > balance)) return;
    skip.current = false;
    setError(null);
    audio.resume();
    patch({ busy: true, roundWinX100: 0, roundBet: bet, bonus: null, overlay: null, ticker: session.replay ? 'Replaying a past broadcast…' : 'Tuning in…' });
    let round: RoundResult;
    try {
      const r = await platform.play(mode, bet);
      round = r.round;
      if (!session.replay) setBalance(r.balance);
      onRoundRef.current?.(round);
    } catch (e) {
      if (e instanceof PlatformError && e.code === 'ERR_VAL' && cfg.modes[mode].cost > 1) {
        setCostLimit((l) => (l === null ? cost : Math.min(l, cost)));
        setError(`${cfg.modes[mode].name} isn't available at this bet: the total of this purchase is above the server's limit. Lower the bet and try again.`);
      } else setError(e instanceof Error ? e.message : String(e));
      patch({ busy: false, ticker: 'The signal was lost.' });
      return;
    }
    let soFar = 0;
    patch({ ticker: session.replay ? 'Replaying a past broadcast…' : cfg.modes[mode].kind === 'buy' ? 'Bonus bought.' : 'Broadcasting…' });

    if (round.spin) {
      await showSpin(round.spin, 0);
      soFar += round.spin.winX100;
    }
    if (round.mystery) {
      skip.current = false;
      patch({ overlay: { kind: 'mystery', prize: null }, ticker: 'An unmarked tape is in the deck…' });
      audio.tape();
      await waitForPlayer(1500);
      patch({ overlay: { kind: 'mystery', prize: round.mystery.prize } });
      audio.reveal();
      soFar += round.mystery.winX100;
      patch({ roundWinX100: soFar });
      await waitForPlayer(2200);
      patch({ overlay: null });
    }
    for (const b of round.bonuses) {
      skip.current = false;
      const def = cfg.bonuses[b.type];
      patch({ overlay: { kind: 'bonusIntro', bonus: b.type, source: b.source, spins: def.spins } });
      audio.intercept();
      await waitForPlayer(3200);
      skip.current = false;
      const sticky = def.stickyStatic ? Array.from({ length: cfg.reels }, () => Array<boolean>(cfg.rows).fill(false)) : undefined;
      let bonusWin = 0;
      let totalSpins = def.spins;
      setView((v) => ({ ...v, overlay: null, bonusFx: v.bonusFx + 1, bonus: { type: b.type, spin: 0, totalSpins, winX100: 0, meter: def.signalMeter?.start, sticky } }));
      await sleep(500);
      for (let i = 0; i < b.spins.length; i++) {
        const s = b.spins[i];
        setView((v) => ({ ...v, bonus: v.bonus && { ...v.bonus, spin: i + 1 } }));
        await showSpin(s, soFar, { ticker: `${def.name} · spin ${i + 1}` });
        if (sticky) for (let r = 0; r < cfg.reels; r++) for (let row = 0; row < cfg.rows; row++) if (s.landed[r][row].s === 'STATIC') sticky[r][row] = true;
        soFar += s.winX100;
        bonusWin += s.winX100;
        if (s.retrigger) {
          totalSpins += s.retrigger;
          audio.antenna(3);
          patch({ ticker: `+${s.retrigger} SPINS — the signal grows stronger` });
          await sleep(900);
        }
        patch({ roundWinX100: soFar, bonus: { type: b.type, spin: i + 1, totalSpins, winX100: bonusWin, meter: s.signalMeter, sticky: sticky?.map((r) => r.slice()) } });
        await sleep(350);
      }
      skip.current = false;
      patch({ overlay: { kind: 'bonusEnd', bonus: b.type, winX100: bonusWin } });
      await waitForPlayer(2400);
      patch({ overlay: null, bonus: null });
    }
    const tier = winTier(round.winX100, round.capped);
    if (tier) {
      skip.current = false;
      patch({ overlay: { kind: 'bigWin', winX100: round.winX100, tier } });
      audio.bigWin();
      await waitForPlayer();
    }
    try {
      const after = await platform.endRound(round, bet);
      if (!session.replay) setBalance(after);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    if (session.replay) setReplayed(true);
    patch({ busy: false, overlay: null, roundWinX100: round.winX100, ticker: round.winX100 > 0 ? (round.capped ? 'MAXIMUM WIN — the broadcast ends.' : 'Signal lost… for now.') : 'Dead air. Spin again.' });
  }, [bet, balance, view.busy, cfg, platform, session]);

  return { balance, bet, setBet, costLimit, doubleChance, setDoubleChance, featureMode, setFeatureMode, speed, setSpeed, view, play, advance, error, setError, replayed, autoRef, onRoundRef };
}
