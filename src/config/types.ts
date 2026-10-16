/**
 * Strongly typed math / rules configuration for THE HOLLOW HOUR.
 *
 * Every gameplay number lives here. The engine never hard-codes a weight,
 * pay value, threshold or feature size — it reads them from a GameConfig.
 *
 * Credit precision: all money values are integer "units". 1 credit = 100 units.
 * Pay values are expressed in hundredths of the stake ("x100"), so an award is
 *   floor(stakeUnits * payX100 * multiplier / 100)
 * which is always an integer.
 */

export type LowSymbolId = 'L_COG' | 'L_KEY' | 'L_MOON' | 'L_CANDLE';
export type StandardSymbolId = 'WATCH' | 'ORB' | 'PORTAL' | 'HOURGLASS' | 'RAVEN' | 'SKULL';
export type PayingSymbolId = LowSymbolId | StandardSymbolId;
export type SpecialSymbolId = 'WILD' | 'TICKET' | 'CLOCKMAKER';
export type SymbolId = PayingSymbolId | SpecialSymbolId;

export type SymbolKind = 'low' | 'standard' | 'premium' | 'wild' | 'scatter' | 'special';

/** Age I = 0 (Original), Age II = 1 (Fractured), Age III = 2 (Hollow). */
export type Age = 0 | 1 | 2;

export type DebtState = 'STABLE' | 'UNSTABLE' | 'CRITICAL' | 'DISCHARGE';

export type ClockmakerPath = 'PRESERVE_PAST' | 'BREAK_FUTURE';

export interface SymbolDef {
  id: SymbolId;
  name: string;
  kind: SymbolKind;
  /** Can this symbol progress through the Three Ages? */
  ageable: boolean;
  /** Evaluation / display order, higher = more valuable. */
  rank: number;
  /** Short rules text shown in the help screen. */
  description: string;
}

export type WeightTable = Record<SymbolId, number>;

export interface GameConfig {
  id: string;
  version: string;
  grid: { cols: number; rows: number };
  currency: { unitsPerCredit: number; startingBalance: number };
  /** Permitted stakes in integer units. */
  bets: number[];
  defaultBet: number;
  symbols: Record<SymbolId, SymbolDef>;
  weights: {
    /** Initial drop of a base-game spin (only place Tickets / Clockmaker can appear). */
    initial: WeightTable;
    /** Cascade refill symbols. */
    refill: WeightTable;
    /** Boards and refills inside The Last Second. */
    bonus: WeightTable;
  };
  clusters: {
    minSize: number;
    adjacency: 'orthogonal';
    /** Wilds substitute for any paying symbol. */
    wildsSubstitute: boolean;
    /** A wild may join two otherwise separate groups of the same symbol into one cluster. */
    wildsConnect: boolean;
    /** A cluster made only of wilds pays. (false in this game) */
    wildOnlyPays: boolean;
  };
  /**
   * Pay values (hundredths of stake) by cluster size. Index 0 = minSize,
   * the last entry applies to every size at or above minSize + length - 1.
   */
  paytable: Record<PayingSymbolId, number[]>;
  ages: {
    /** Multiplier contribution per real (non-wild) cell of each age in a winning cluster. */
    multiplierPerAge: [number, number, number];
    maxClusterMultiplier: number;
    /** What happens when a Hollow symbol is aged again. */
    hollowOverflow: 'COLLAPSE_TO_WILD' | 'PERMANENT_HOLLOW';
  };
  cascade: { maxCascades: number };
  corruption: {
    /** Chance that each surviving ageable cell orthogonally adjacent to a removed winning cell advances one age. */
    adjacentChance: number;
    /** Added to adjacentChance by the Paradox Debt state snapshotted at spin start. */
    debtStateBonus: Record<Exclude<DebtState, 'DISCHARGE'>, number>;
    maxTransformationsPerStep: number;
    /** A winning Chrono Orb cluster advances this many additional random eligible cells. */
    orbBurstCells: number;
  };
  echo: {
    maxEntries: number;
    /** An entry expires once this many spins have started after its creation spin. */
    ttlSpins: number;
    /** Echoes projected by a winning Hourglass cluster. */
    hourglassProjections: number;
    /** Maximum entries recorded per spin (prevents a single spin flooding the ledger). */
    maxNewEntriesPerSpin: number;
    /** Ages added to a remembered symbol when it returns (0 = exact restore). Hollow never exceeds Hollow. */
    ageOnReturn: number;
    /** >= count Hourglasses on the initial base board project `projections` echoes before evaluation. */
    scatterTrigger: { count: number; projections: number };
  };
  split: {
    /** Cells taken from the Hollow timeline by a base-game split. */
    cells: number;
    /** Extra cells when the round started in CRITICAL debt. */
    criticalBonusCells: number;
    maxPerSpin: number;
    /** >= portalCount Time Portals on the initial base board open a Paradox Split before evaluation. */
    portalCount: number;
  };
  debt: {
    max: number;
    thresholds: { UNSTABLE: number; CRITICAL: number; DISCHARGE: number };
    gains: {
      HOLLOW_FORMED: number;
      WILD_COLLAPSE: number;
      ECHO_PROJECTED: number;
      PARADOX_SPLIT: number;
      CLOCKMAKER: number;
      COLLAPSE_STAGE: number;
    };
    discharge: { regionSize: number; echoProjections: number; maxPerSpin: number };
  };
  clockmaker: {
    preservePast: { echoProjections: number; fallbackFractureCells: number };
    breakFuture: { advanceCells: number; primeSplitCells: number };
  };
  bonus: {
    triggerTickets: number;
    frozenCells: number;
    splitCells: number;
    echoProjections: number;
    echoFallbackFractureCells: number;
    /** Win multiplier per stage, index 0 = stage 1. */
    stageMultipliers: [number, number, number, number];
    /** Total award cap for the whole round including the bonus, as a multiple of stake (cannot exceed maxWinX). */
    maxBonusWinX: number;
  };
  /** Total round award cap, as a multiple of stake. */
  maxWinX: number;
  dev: { allowForcing: boolean };
}
