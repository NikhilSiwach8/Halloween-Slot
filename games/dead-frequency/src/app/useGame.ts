import { useCallback, useEffect, useRef, useState } from 'react';
import { roundCost } from '../config/gameConfig';
import type { BonusType, GameConfig, ModeId, MysteryPrize } from '../config/types';
import type { Board } from '../engine/board';
import type { RoundResult, SpinResult } from '../engine/round';
import type { Platform, PlatformSession } from '../platform/platform';
import { audio } from './audio';

export type Speed = 'normal' | 'turbo';

export type Overlay =
  | { kind: 'mystery'; prize: MysteryPrize | null }
  | { kind: 'bonusIntro'; bonus: BonusType; source: 'ANTENNAS' | 'TAPE' | 'BUY'; spins: number }
  | { kind: 'bonusEnd'; bonus: BonusType; winX100: number }
  | { kind: 'bigWin'; winX100: number; tier: 'BIG' | 'MEGA' | 'MAX' };

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
}

/** Reel animation timing (ms). The reels land one by one, `REEL_STAGGER` apart. */
export const SPIN_MS = 520;
export const REEL_STAGGER = 90;
export const TURBO_FACTOR = 0.35;

const EMPTY: View = { board: null, unrevealed: false, winCells: new Set(), spinning: false, ticker: 'Tune in… press SPIN.', roundWinX100: 0, bonus: null, overlay: null, busy: false, bonusFx: 0, spinId: 0, antennas: 0, spinWinX100: 0 };

export function useGame(cfg: GameConfig, platform: Platform, session: PlatformSession) {
  const [balance, setBalance] = useState(session.balance);
  const [bet, setBet] = useState(session.replay?.bet ?? session.defaultBet);
  const [error, setError] = useState<string | null>(null);
  /** Replay mode: true once the replayed round has been shown (offers Play Again). */
  const [replayed, setReplayed] = useState(false);
  const [doubleChance, setDoubleChance] = useState(false);
  const [featureMode, setFeatureMode] = useState<ModeId | null>(null);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [view, setView] = useState<View>(EMPTY);
  const skip = useRef(false);
  const waiter = useRef<(() => void) | null>(null);
  const speedRef = useRef(speed);
  useEffect(() => void (speedRef.current = speed), [speed]);

  const patch = (p: Partial<View>) => setView((v) => ({ ...v, ...p }));
  const sleep = (ms: number) =>
    new Promise<void>((res) => {
      if (skip.current) return res();
      setTimeout(res, speedRef.current === 'turbo' ? ms * TURBO_FACTOR : ms);
    });
  /** Waits for the player to press the overlay button. */
  const waitForPlayer = () => new Promise<void>((res) => (waiter.current = res));
  const advance = useCallback(() => {
    if (waiter.current) {
      const w = waiter.current;
      waiter.current = null;
      w();
    } else skip.current = true;
  }, []);

  const showSpin = async (s: SpinResult, roundSoFar: number, extra: Partial<View> = {}) => {
    setView((v) => ({ ...v, spinning: true, spinId: v.spinId + 1, winCells: new Set(), antennas: 0, spinWinX100: 0, ...extra }));
    audio.spin();
    await sleep(SPIN_MS);
    const turbo = speedRef.current === 'turbo';
    patch({ board: s.landed, spinning: false, unrevealed: !!s.reveal });
    audio.land(((turbo ? TURBO_FACTOR : 1) * REEL_STAGGER) / 1000);
    // Reels land one by one (CSS, REEL_STAGGER apart); continue once the last one has settled.
    await sleep(REEL_STAGGER * (cfg.reels - 1) + 200);
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
    patch({ busy: true, roundWinX100: 0, bonus: null, overlay: null, ticker: session.replay ? 'Replaying a past broadcast…' : 'Tuning in…' });
    let round: RoundResult;
    try {
      const r = await platform.play(mode, bet);
      round = r.round;
      if (!session.replay) setBalance(r.balance);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      await waitForPlayer();
      patch({ overlay: { kind: 'mystery', prize: round.mystery.prize } });
      audio.reveal();
      soFar += round.mystery.winX100;
      patch({ roundWinX100: soFar });
      await waitForPlayer();
      patch({ overlay: null });
    }
    for (const b of round.bonuses) {
      skip.current = false;
      const def = cfg.bonuses[b.type];
      patch({ overlay: { kind: 'bonusIntro', bonus: b.type, source: b.source, spins: def.spins } });
      audio.intercept();
      await waitForPlayer();
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
      await waitForPlayer();
      patch({ overlay: null, bonus: null });
    }
    const winX = round.winX100 / 100;
    if (round.capped || winX >= 20) {
      skip.current = false;
      patch({ overlay: { kind: 'bigWin', winX100: round.winX100, tier: round.capped ? 'MAX' : winX >= 100 ? 'MEGA' : 'BIG' } });
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

  return { balance, bet, setBet, doubleChance, setDoubleChance, featureMode, setFeatureMode, speed, setSpeed, view, play, advance, error, setError, replayed };
}
