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
  /**
   * Money is integer units. `unitsPerCredit` units = 1 displayed unit (100 in the demo;
   * 1,000,000 when amounts come from Stake Engine, which uses 6 implied decimals).
   */
  currency: { unitsPerCredit: number; startingBalance: number; code?: string; symbol?: string; symbolAfter?: boolean; decimals?: number };
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
    /**
     * Alternative bonus weight set used only to generate max-win candidate books (the analogue of
     * a dedicated win-cap reel set in the Stake Math SDK). A book records which set produced it;
     * its probability comes from the published lookup table, not from how it was found.
     */
    wincapBonus: WeightTable;
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
    /**
     * Who picks the path. ENGINE = drawn from `engineWeights` inside the round (required for
     * book-based platforms where the whole round is precomputed); PLAYER = interactive pause.
     */
    selection: 'PLAYER' | 'ENGINE';
    engineWeights: Record<ClockmakerPath, number>;
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
    /**
     * The Hour Multiplier: a bonus-wide multiplier that starts at `start` and grows each time a
     * symbol turns Hollow (+perHollow) or collapses into a Chrono Wild (+perCollapse) during
     * The Last Second, up to `max`. A Paradox Discharge during the bonus multiplies it by
     * `dischargeFactor` (also capped at `max`). Bonus awards = cluster award x stage multiplier x Hour Multiplier.
     */
    hourMultiplier: { start: number; perHollow: number; perCollapse: number; max: number; dischargeFactor: number };
  };
  /**
   * Scope of the cross-spin systems. SESSION = persists across rounds (the standalone
   * prototype default). ROUND = reset at the start of every round, making every round
   * independent of previous ones (required by stateless platforms such as Stake Engine).
   */
  persistence: { paradoxDebt: 'SESSION' | 'ROUND'; echoLedger: 'SESSION' | 'ROUND' };
  /**
   * Round-start draws (used with ROUND persistence so the systems are live inside one round).
   * Drawn from the round's own RNG stream immediately after the opening board.
   */
  roundStart: {
    /** Starting Paradox Debt: weighted table of values. */
    debt: { value: number; weight: number }[];
    /** "Remnants of the Hour": number of echo entries seeded into the ledger, weighted. */
    remnantCount: { value: number; weight: number }[];
    /** Age weights [Original, Fractured, Hollow] of a remnant. */
    remnantAgeWeights: [number, number, number];
  };
  /** Total round award cap, as a multiple of stake. */
  maxWinX: number;
  dev: { allowForcing: boolean };
}
