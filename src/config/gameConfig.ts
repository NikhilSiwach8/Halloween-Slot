import { SYMBOLS } from './symbols';
import type { GameConfig } from './types';

/**
 * Default ("ordinary gameplay") configuration — the Stake Engine-oriented profile:
 * every round is independent (ROUND persistence, round-start draws), the Clockmaker's path
 * is resolved inside the round, and the maximum win is 50,000x stake.
 *
 * Weights and pay values were tuned with `npm run simulate`; final probabilities come
 * from the published lookup table (`npm run books`). See docs/MATH_MODEL.md.
 */
export const DEFAULT_CONFIG: GameConfig = {
  id: 'the-hollow-hour',
  version: '0.2.0',
  grid: { cols: 5, rows: 5 },
  currency: { unitsPerCredit: 100, startingBalance: 100_000 },
  bets: [20, 50, 100, 200, 500, 1000],
  defaultBet: 100,
  symbols: SYMBOLS,
  weights: {
    initial: {
      L_COG: 260, L_KEY: 260, L_MOON: 260, L_CANDLE: 260,
      WATCH: 70, ORB: 55, PORTAL: 50, HOURGLASS: 50, RAVEN: 35, SKULL: 30,
      WILD: 35, TICKET: 16, CLOCKMAKER: 1,
    },
    refill: {
      L_COG: 260, L_KEY: 260, L_MOON: 260, L_CANDLE: 260,
      WATCH: 70, ORB: 55, PORTAL: 50, HOURGLASS: 50, RAVEN: 35, SKULL: 30,
      WILD: 35, TICKET: 0, CLOCKMAKER: 0,
    },
    bonus: {
      L_COG: 260, L_KEY: 260, L_MOON: 260, L_CANDLE: 260,
      WATCH: 70, ORB: 55, PORTAL: 50, HOURGLASS: 50, RAVEN: 35, SKULL: 30,
      WILD: 35, TICKET: 0, CLOCKMAKER: 0,
    },
    wincapBonus: {
      L_COG: 90, L_KEY: 90, L_MOON: 90, L_CANDLE: 90,
      WATCH: 60, ORB: 60, PORTAL: 60, HOURGLASS: 60, RAVEN: 150, SKULL: 180,
      WILD: 140, TICKET: 0, CLOCKMAKER: 0,
    },
  },
  clusters: { minSize: 5, adjacency: 'orthogonal', wildsSubstitute: true, wildsConnect: true, wildOnlyPays: false },
  paytable: {
    // cluster size:  5     6     7     8     9    10    11    12    13    14   15+
    L_COG:    [ 100,  125,  150,  200,  250,  350,  450,  600,  800, 1100, 1500],
    L_KEY:    [ 100,  125,  150,  200,  250,  350,  450,  600,  800, 1100, 1500],
    L_MOON:   [ 125,  150,  200,  250,  300,  400,  500,  700, 1000, 1300, 2000],
    L_CANDLE: [ 125,  150,  200,  250,  300,  400,  500,  700, 1000, 1300, 2000],
    WATCH:    [ 200,  250,  300,  400,  500,  700, 1000, 1400, 2000, 3000, 4000],
    ORB:      [ 250,  300,  400,  500,  700, 1000, 1400, 2000, 3000, 4000, 5000],
    PORTAL:   [ 250,  300,  400,  500,  700, 1000, 1400, 2000, 3000, 4000, 5000],
    HOURGLASS:[ 300,  400,  500,  700, 1000, 1400, 2000, 3000, 4000, 5000, 7500],
    RAVEN:    [ 400,  500,  700, 1000, 1400, 2000, 3000, 4000, 6000, 8000, 12500],
    SKULL:    [ 500,  700, 1000, 1400, 2000, 3000, 4000, 6000, 8000, 12500, 25000],
  },
  ages: { multiplierPerAge: [0, 1, 2], maxClusterMultiplier: 10, hollowOverflow: 'COLLAPSE_TO_WILD' },
  cascade: { maxCascades: 25 },
  corruption: {
    adjacentChance: 0.25,
    debtStateBonus: { STABLE: 0, UNSTABLE: 0.05, CRITICAL: 0.1 },
    maxTransformationsPerStep: 8,
    orbBurstCells: 3,
  },
  echo: { maxEntries: 12, ttlSpins: 10, hourglassProjections: 1, maxNewEntriesPerSpin: 4, ageOnReturn: 1, scatterTrigger: { count: 4, projections: 2 } },
  split: { cells: 6, criticalBonusCells: 2, maxPerSpin: 1, portalCount: 4 },
  debt: {
    max: 100,
    thresholds: { UNSTABLE: 40, CRITICAL: 70, DISCHARGE: 100 },
    gains: { HOLLOW_FORMED: 3, WILD_COLLAPSE: 4, ECHO_PROJECTED: 6, PARADOX_SPLIT: 10, CLOCKMAKER: 8, COLLAPSE_STAGE: 25 },
    discharge: { regionSize: 3, echoProjections: 1, maxPerSpin: 1 },
  },
  clockmaker: {
    selection: 'ENGINE',
    engineWeights: { PRESERVE_PAST: 1, BREAK_FUTURE: 1 },
    preservePast: { echoProjections: 2, fallbackFractureCells: 2 },
    breakFuture: { advanceCells: 5, primeSplitCells: 3 },
  },
  bonus: {
    triggerTickets: 3,
    frozenCells: 4,
    splitCells: 10,
    echoProjections: 3,
    echoFallbackFractureCells: 3,
    stageMultipliers: [1, 1, 2, 3],
    maxBonusWinX: 50_000,
    hourMultiplier: { start: 1, perHollow: 0, perCollapse: 1, max: 1000, dischargeFactor: 3 },
  },
  persistence: { paradoxDebt: 'ROUND', echoLedger: 'ROUND' },
  roundStart: {
    debt: [
      { value: 0, weight: 45 },
      { value: 25, weight: 25 },
      { value: 50, weight: 18 },
      { value: 80, weight: 12 },
    ],
    remnantCount: [
      { value: 0, weight: 30 },
      { value: 1, weight: 35 },
      { value: 2, weight: 25 },
      { value: 3, weight: 10 },
    ],
    remnantAgeWeights: [55, 35, 10],
  },
  maxWinX: 50_000,
  dev: { allowForcing: false },
};

/**
 * Standalone "session" profile: the original prototype behaviour, where Paradox Debt and the
 * Echo Ledger persist across rounds and the player picks the Clockmaker's path. NOT
 * compatible with stateless book-based platforms such as Stake Engine; kept for comparison.
 */
export const SESSION_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  id: 'the-hollow-hour-session',
  persistence: { paradoxDebt: 'SESSION', echoLedger: 'SESSION' },
  roundStart: { ...DEFAULT_CONFIG.roundStart, debt: [{ value: 0, weight: 1 }], remnantCount: [{ value: 0, weight: 1 }] },
  clockmaker: { ...DEFAULT_CONFIG.clockmaker, selection: 'PLAYER' },
};

/** Development configuration: identical math, but dev-only forced triggers are permitted. */
export function createDevConfig(base: GameConfig = DEFAULT_CONFIG): GameConfig {
  return { ...base, dev: { allowForcing: true } };
}

export function validateConfig(cfg: GameConfig): string[] {
  const errors: string[] = [];
  const cells = cfg.grid.cols * cfg.grid.rows;
  if (cfg.clusters.minSize < 2 || cfg.clusters.minSize > cells) errors.push('clusters.minSize out of range');
  if (!cfg.bets.includes(cfg.defaultBet)) errors.push('defaultBet must be one of bets');
  if (cfg.bets.some((b) => !Number.isInteger(b) || b <= 0)) errors.push('bets must be positive integers');
  for (const [k, table] of Object.entries(cfg.weights)) {
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    if (total <= 0) errors.push(`weights.${k} has no positive weight`);
    if (Object.values(table).some((w) => w < 0 || !Number.isFinite(w))) errors.push(`weights.${k} has invalid weight`);
  }
  if (cfg.weights.refill.TICKET || cfg.weights.refill.CLOCKMAKER) errors.push('refill may not contain TICKET/CLOCKMAKER');
  if (cfg.weights.wincapBonus.TICKET || cfg.weights.wincapBonus.CLOCKMAKER) errors.push('wincapBonus may not contain TICKET/CLOCKMAKER');
  if (cfg.weights.bonus.TICKET || cfg.weights.bonus.CLOCKMAKER) errors.push('bonus may not contain TICKET/CLOCKMAKER (no retrigger)');
  for (const [sym, pays] of Object.entries(cfg.paytable)) {
    if (!pays.length || pays.some((p) => !Number.isInteger(p) || p < 0)) errors.push(`paytable.${sym} invalid`);
  }
  const t = cfg.debt.thresholds;
  if (!(t.UNSTABLE < t.CRITICAL && t.CRITICAL < t.DISCHARGE && t.DISCHARGE <= cfg.debt.max)) errors.push('debt thresholds must ascend');
  if (cfg.bonus.maxBonusWinX > cfg.maxWinX) errors.push('bonus.maxBonusWinX cannot exceed maxWinX');
  for (const k of ['debt', 'remnantCount'] as const) {
    const t = cfg.roundStart[k];
    if (!t.length || t.some((e) => !Number.isInteger(e.value) || e.value < 0 || e.weight < 0) || t.reduce((a, e) => a + e.weight, 0) <= 0) errors.push(`roundStart.${k} invalid`);
  }
  if (cfg.roundStart.debt.some((e) => e.value >= cfg.debt.thresholds.DISCHARGE)) errors.push('roundStart.debt values must be below the discharge threshold');
  if (cfg.clockmaker.engineWeights.PRESERVE_PAST + cfg.clockmaker.engineWeights.BREAK_FUTURE <= 0) errors.push('clockmaker.engineWeights must be positive');
  if (cfg.bonus.hourMultiplier.start < 1 || cfg.bonus.hourMultiplier.max < cfg.bonus.hourMultiplier.start) errors.push('bonus.hourMultiplier invalid');
  if (cfg.bonus.frozenCells >= cfg.clusters.minSize) errors.push('bonus.frozenCells must be < clusters.minSize (prevents frozen-only clusters)');
  return errors;
}
