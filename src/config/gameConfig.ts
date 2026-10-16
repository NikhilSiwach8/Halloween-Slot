import { SYMBOLS } from './symbols';
import type { GameConfig } from './types';

/**
 * Default ("ordinary gameplay") configuration.
 *
 * Weights and pay values were tuned with `npm run simulate`; see docs/MATH_MODEL.md
 * for the measured results. They are design parameters, not certified math.
 */
export const DEFAULT_CONFIG: GameConfig = {
  id: 'the-hollow-hour',
  version: '0.1.0',
  grid: { cols: 5, rows: 5 },
  currency: { unitsPerCredit: 100, startingBalance: 100_000 },
  bets: [20, 50, 100, 200, 500, 1000],
  defaultBet: 100,
  symbols: SYMBOLS,
  weights: {
    initial: {
      L_COG: 260, L_KEY: 260, L_MOON: 260, L_CANDLE: 260,
      WATCH: 70, ORB: 55, PORTAL: 50, HOURGLASS: 50, RAVEN: 35, SKULL: 30,
      WILD: 35, TICKET: 17, CLOCKMAKER: 1,
    },
    refill: {
      L_COG: 260, L_KEY: 260, L_MOON: 260, L_CANDLE: 260,
      WATCH: 70, ORB: 55, PORTAL: 50, HOURGLASS: 50, RAVEN: 35, SKULL: 30,
      WILD: 35, TICKET: 0, CLOCKMAKER: 0,
    },
    bonus: {
      L_COG: 260, L_KEY: 260, L_MOON: 260, L_CANDLE: 260,
      WATCH: 70, ORB: 55, PORTAL: 50, HOURGLASS: 50, RAVEN: 35, SKULL: 30,
      WILD: 60, TICKET: 0, CLOCKMAKER: 0,
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
    preservePast: { echoProjections: 2, fallbackFractureCells: 2 },
    breakFuture: { advanceCells: 5, primeSplitCells: 3 },
  },
  bonus: {
    triggerTickets: 3,
    frozenCells: 4,
    splitCells: 10,
    echoProjections: 3,
    echoFallbackFractureCells: 3,
    stageMultipliers: [1, 2, 3, 5],
    maxBonusWinX: 5000,
  },
  maxWinX: 5000,
  dev: { allowForcing: false },
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
  if (cfg.weights.bonus.TICKET || cfg.weights.bonus.CLOCKMAKER) errors.push('bonus may not contain TICKET/CLOCKMAKER (no retrigger)');
  for (const [sym, pays] of Object.entries(cfg.paytable)) {
    if (!pays.length || pays.some((p) => !Number.isInteger(p) || p < 0)) errors.push(`paytable.${sym} invalid`);
  }
  const t = cfg.debt.thresholds;
  if (!(t.UNSTABLE < t.CRITICAL && t.CRITICAL < t.DISCHARGE && t.DISCHARGE <= cfg.debt.max)) errors.push('debt thresholds must ascend');
  if (cfg.bonus.maxBonusWinX > cfg.maxWinX) errors.push('bonus.maxBonusWinX cannot exceed maxWinX');
  if (cfg.bonus.frozenCells >= cfg.clusters.minSize) errors.push('bonus.frozenCells must be < clusters.minSize (prevents frozen-only clusters)');
  return errors;
}
