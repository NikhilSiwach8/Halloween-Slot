/**
 * Strongly typed math / rules configuration for DEAD FREQUENCY.
 *
 * Every gameplay number lives in a GameConfig; the engine never hard-codes a weight,
 * pay value or feature size.
 *
 * Win precision: all wins are integers in hundredths of the base stake ("x100").
 * A pay of 25 means 0.25x stake. Money is converted only at the edge:
 *   floor(stakeUnits * winX100 / 100).
 */

export type LowSymbolId = 'VALVE' | 'CASSETTE' | 'MIC' | 'HEADPHONES';
export type HighSymbolId = 'RADIO' | 'DOLL' | 'PRIEST' | 'HOST';
export type PayingSymbolId = LowSymbolId | HighSymbolId;
/** WILD = "On Air", STATIC = mystery, ANTENNA = scatter, TAPE = Mystery Bonus. */
export type SpecialSymbolId = 'WILD' | 'STATIC' | 'ANTENNA' | 'TAPE';
export type SymbolId = PayingSymbolId | SpecialSymbolId;

export type BonusType = 'NIGHT_SHIFT' | 'POSSESSION' | 'DEAD_AIR';

export type ModeId =
  | 'BASE'
  | 'DOUBLE_CHANCE'
  | 'STATIC_STORM'
  | 'HAUNTED_WILDS'
  | 'BUY_NIGHT_SHIFT'
  | 'BUY_POSSESSION'
  | 'BUY_DEAD_AIR';

export type ProfileId = 'base' | 'doubleChance' | 'staticStorm' | 'hauntedWilds' | 'nightShift' | 'possession' | 'deadAir';

export interface SymbolDef {
  id: SymbolId;
  name: string;
  kind: 'low' | 'high' | 'wild' | 'mystery' | 'scatter' | 'bonus';
  /** Higher = more valuable; used for display order. */
  rank: number;
  description: string;
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/**
 * How one kind of board is drawn. Cells are independent weighted draws, with Static stacks,
 * Antennas and Tapes placed by per-reel chances so that their frequencies are easy to reason about.
 */
export interface BoardProfile {
  /** Weights of the ordinary symbols drawn into each non-special cell. WILD is never drawn on reel 1. */
  symbolWeights: Record<PayingSymbolId | 'WILD', number>;
  /** Chance that an ordinary cell repeats the paying symbol directly above it (reel-strip style stacking). */
  stackChance: number;
  /** Multipliers carried by naturally drawn wilds. `[{value:1,weight:1}]` = plain wilds. */
  wildMultipliers: Weighted<number>[];
  /** Chance per reel that a Static stack lands on it. */
  staticChance: [number, number, number, number, number, number];
  /** Weights of the Static stack height (1..rows). */
  staticHeight: Weighted<number>[];
  /** Weights of the number of Antennas on the board (each on a different reel). */
  antennaCount: Weighted<number>[];
  /** Chance of a Tape on reel 6 (max one). */
  tapeChance: number;
  /** Feature Spins: number of reels guaranteed to be fully Static. */
  guaranteedStaticReels?: Weighted<number>[];
  /** Feature Spins: number of guaranteed multiplier wilds (reels 2-6) and their multipliers. */
  guaranteedWilds?: { count: Weighted<number>[]; multipliers: Weighted<number>[] };
}

export interface BonusDef {
  type: BonusType;
  name: string;
  spins: number;
  profile: ProfileId;
  /** Night Shift: the Signal Meter. Starts at `start`; +`perStaticReel` for every reel where Static lands. Never resets. */
  signalMeter?: { start: number; perStaticReel: number; max: number };
  /** Possession: every Static that lands stays for the rest of the bonus. */
  stickyStatic?: boolean;
  /** Dead Air: a reel with any Static becomes fully Static. */
  expandStatic?: boolean;
}

export type MysteryPrize = { kind: 'CASH'; x100: number } | { kind: 'BONUS'; bonus: BonusType };

export interface ModeDef {
  id: ModeId;
  name: string;
  /** Price per round as a multiple of the base stake. */
  cost: number;
  kind: 'spin' | 'buy';
  /** Board profile of the paid spin ('spin' modes). */
  profile?: ProfileId;
  /** Bonus awarded directly ('buy' modes). */
  bonus?: BonusType;
  description: string;
}

export interface GameConfig {
  id: string;
  version: string;
  reels: number;
  rows: number;
  currency: { unitsPerCredit: number; startingBalance: number };
  /** Base stakes in integer units. */
  bets: number[];
  defaultBet: number;
  symbols: Record<SymbolId, SymbolDef>;
  /** Pay per way in hundredths of stake, index 0 = 3 of a kind ... index 3 = 6 of a kind. */
  paytable: Record<PayingSymbolId, [number, number, number, number]>;
  minWayLength: number;
  /** Symbols a Static stack can reveal as (never WILD, because reel 1 has no wilds). */
  staticReveal: Record<PayingSymbolId, number>;
  /** Retune: Statics that are part of no win reveal once more, as a different symbol. */
  retune: { enabled: boolean };
  profiles: Record<ProfileId, BoardProfile>;
  bonuses: Record<BonusType, BonusDef>;
  /** Antennas on one board -> bonus. Counts above the highest key use the highest key. */
  antennaTriggers: { count: number; bonus: BonusType }[];
  retrigger: { minAntennas: number; extraSpins: number; maxTotalSpins: number };
  mystery: { prizes: Weighted<MysteryPrize>[] };
  modes: Record<ModeId, ModeDef>;
  /** Total round win cap, as a multiple of the base stake. */
  maxWinX: number;
}
