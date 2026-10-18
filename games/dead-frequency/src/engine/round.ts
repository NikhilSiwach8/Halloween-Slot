import type { BonusType, GameConfig, ModeId, MysteryPrize, PayingSymbolId, ProfileId } from '../config/types';
import { cloneBoard, countSymbol, generateBoard, positionsOf, type Board } from './board';
import { pickWeighted, weightedPick, type Rng } from './rng';
import { evaluateWays, type WayWin } from './ways';

export interface StaticReveal {
  positions: [number, number][];
  /** First reveal. */
  first: PayingSymbolId;
  /** Set when the first reveal was part of no win and the Statics retuned. */
  retunedTo?: PayingSymbolId;
}

export interface SpinResult {
  /** The board as it lands, Statics unrevealed. */
  landed: Board;
  /** The evaluated board, Statics revealed. */
  board: Board;
  reveal: StaticReveal | null;
  wins: WayWin[];
  /** Win of this spin (after the round cap was applied). */
  winX100: number;
  antennas: number;
  tape: boolean;
  /** Night Shift Signal Meter used for this spin. */
  signalMeter?: number;
  /** Free spins added by this spin. */
  retrigger?: number;
}

export interface BonusResult {
  type: BonusType;
  /** How the bonus started. */
  source: 'ANTENNAS' | 'TAPE' | 'BUY';
  spins: SpinResult[];
  totalSpins: number;
  winX100: number;
}

export interface MysteryResult {
  prize: MysteryPrize;
  /** Cash part of the prize after the cap (a BONUS prize is paid through `bonuses`). */
  winX100: number;
}

export interface RoundResult {
  mode: ModeId;
  /** Price in multiples of the base stake. */
  cost: number;
  /** The paid spin ('spin' modes only). */
  spin: SpinResult | null;
  mystery: MysteryResult | null;
  bonuses: BonusResult[];
  /** Total round win, hundredths of the base stake. */
  winX100: number;
  /** The round reached the max win and ended early. */
  capped: boolean;
}

/** Tracks the round total against the max-win cap. */
export class Cap {
  total = 0;
  capped = false;
  constructor(readonly limit: number) {}
  /** Adds a win and returns the part that was paid. */
  add(x100: number): number {
    if (this.capped) return 0;
    const paid = Math.min(x100, this.limit - this.total);
    this.total += paid;
    if (this.total >= this.limit) this.capped = true;
    return paid;
  }
}

function revealStatics(cfg: GameConfig, landed: Board, rng: Rng, globalMultiplier: number): Omit<SpinResult, 'landed' | 'antennas' | 'tape' | 'winX100'> & { rawX100: number } {
  const positions = positionsOf(landed, 'STATIC');
  if (!positions.length) {
    const { wins, totalX100 } = evaluateWays(cfg, landed, globalMultiplier);
    return { board: landed, reveal: null, wins, rawX100: totalX100 };
  }
  const reveal = (s: PayingSymbolId) => {
    const b = cloneBoard(landed);
    for (const [r, row] of positions) b[r][row] = { s, m: 1 };
    return { b, ...evaluateWays(cfg, b, globalMultiplier) };
  };
  const first = weightedPick(rng, cfg.staticReveal);
  let out = reveal(first);
  let retunedTo: PayingSymbolId | undefined;
  const isStatic = new Set(positions.map(([r, row]) => r * 100 + row));
  const staticWon = out.wins.some((w) => w.positions.some(([r, row]) => isStatic.has(r * 100 + row)));
  if (cfg.retune.enabled && !staticWon) {
    retunedTo = weightedPick(rng, { ...cfg.staticReveal, [first]: 0 });
    out = reveal(retunedTo);
  }
  return { board: out.b, reveal: { positions, first, retunedTo }, wins: out.wins, rawX100: out.totalX100 };
}

function playSpin(cfg: GameConfig, profile: ProfileId, rng: Rng, cap: Cap, opts: { sticky?: boolean[][]; expandStatic?: boolean; meter?: { value: number; perStaticReel: number; max: number } } = {}): SpinResult {
  const landed = generateBoard(cfg, cfg.profiles[profile], rng, { sticky: opts.sticky, expandStatic: opts.expandStatic });
  let signalMeter: number | undefined;
  if (opts.meter) {
    const staticReels = landed.filter((reel) => reel.some((c) => c.s === 'STATIC')).length;
    opts.meter.value = Math.min(opts.meter.max, opts.meter.value + staticReels * opts.meter.perStaticReel);
    signalMeter = opts.meter.value;
  }
  const { rawX100, ...rest } = revealStatics(cfg, landed, rng, signalMeter ?? 1);
  return { landed, ...rest, winX100: cap.add(rawX100), antennas: countSymbol(landed, 'ANTENNA'), tape: countSymbol(landed, 'TAPE') > 0, signalMeter };
}

export function bonusForAntennas(cfg: GameConfig, antennas: number): BonusType | null {
  let found: BonusType | null = null;
  for (const t of cfg.antennaTriggers) if (antennas >= t.count) found = t.bonus;
  return found;
}

export function playBonus(cfg: GameConfig, type: BonusType, source: BonusResult['source'], rng: Rng, cap: Cap): BonusResult {
  const def = cfg.bonuses[type];
  const sticky = def.stickyStatic ? Array.from({ length: cfg.reels }, () => Array<boolean>(cfg.rows).fill(false)) : undefined;
  const meter = def.signalMeter ? { value: def.signalMeter.start, perStaticReel: def.signalMeter.perStaticReel, max: def.signalMeter.max } : undefined;
  let totalSpins = def.spins;
  const spins: SpinResult[] = [];
  let winX100 = 0;
  for (let i = 0; i < totalSpins && !cap.capped; i++) {
    const spin = playSpin(cfg, def.profile, rng, cap, { sticky, expandStatic: def.expandStatic, meter });
    if (sticky) for (const [r, row] of positionsOf(spin.landed, 'STATIC')) sticky[r][row] = true;
    if (spin.antennas >= cfg.retrigger.minAntennas && totalSpins < cfg.retrigger.maxTotalSpins) {
      const add = Math.min(cfg.retrigger.extraSpins, cfg.retrigger.maxTotalSpins - totalSpins);
      totalSpins += add;
      spin.retrigger = add;
    }
    winX100 += spin.winX100;
    spins.push(spin);
  }
  return { type, source, spins, totalSpins, winX100 };
}

/**
 * A paid spin with Mystery cash but without playing any bonus it triggers (for the low-variance
 * RTP estimate in scripts/rtp.ts). Returns spin win + Mystery cash.
 */
export function playSpinOnly(cfg: GameConfig, profile: ProfileId, rng: Rng): { winX100: number } {
  const cap = new Cap(cfg.maxWinX * 100);
  const spin = playSpin(cfg, profile, rng, cap);
  if (spin.tape) {
    const prize = pickWeighted(rng, cfg.mystery.prizes);
    if (prize.kind === 'CASH') cap.add(prize.x100);
  }
  return { winX100: cap.total };
}

/** Plays one complete, independent round. */
export function playRound(cfg: GameConfig, mode: ModeId, rng: Rng): RoundResult {
  const def = cfg.modes[mode];
  const cap = new Cap(cfg.maxWinX * 100);
  const bonuses: BonusResult[] = [];
  let spin: SpinResult | null = null;
  let mystery: MysteryResult | null = null;
  if (def.kind === 'buy') {
    bonuses.push(playBonus(cfg, def.bonus!, 'BUY', rng, cap));
  } else {
    spin = playSpin(cfg, def.profile!, rng, cap);
    const triggered = bonusForAntennas(cfg, spin.antennas);
    if (spin.tape) {
      const prize = pickWeighted(rng, cfg.mystery.prizes);
      mystery = { prize, winX100: prize.kind === 'CASH' ? cap.add(prize.x100) : 0 };
    }
    if (triggered && !cap.capped) bonuses.push(playBonus(cfg, triggered, 'ANTENNAS', rng, cap));
    if (mystery?.prize.kind === 'BONUS' && !cap.capped) bonuses.push(playBonus(cfg, mystery.prize.bonus, 'TAPE', rng, cap));
  }
  return { mode, cost: def.cost, spin, mystery, bonuses, winX100: cap.total, capped: cap.capped };
}
