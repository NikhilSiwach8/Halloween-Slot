import { SYMBOLS } from './symbols';
import type { BoardProfile, GameConfig, ModeId } from './types';

/**
 * DEAD FREQUENCY math v0.1.0.
 *
 * Every round is independent (no state carries between rounds). Weights, pay values and
 * mode prices were tuned with `npm run df:simulate` and `npm run df:rtp`; measured results are in
 * docs/MATH_MODEL.md.
 */

const BASE_SYMBOLS: BoardProfile['symbolWeights'] = {
  VALVE: 140, CASSETTE: 140, MIC: 120, HEADPHONES: 120,
  RADIO: 60, WIDOW: 50, PRIEST: 40, HOST: 30,
  WILD: 12,
};

const BONUS_SYMBOLS: BoardProfile['symbolWeights'] = { ...BASE_SYMBOLS, WILD: 24 };

const PLAIN_WILDS = [{ value: 1, weight: 1 }];
const DEAD_AIR_WILDS = [
  { value: 2, weight: 50 }, { value: 3, weight: 25 }, { value: 5, weight: 15 }, { value: 10, weight: 8 }, { value: 25, weight: 2 },
];

const STACK = [
  { value: 1, weight: 30 }, { value: 2, weight: 30 }, { value: 3, weight: 25 }, { value: 4, weight: 15 },
];

/** Antenna count weights, per million boards. */
const BASE_ANTENNAS = [
  { value: 0, weight: 689_897 }, { value: 1, weight: 260_000 }, { value: 2, weight: 45_000 },
  { value: 3, weight: 4_153 }, { value: 4, weight: 760 }, { value: 5, weight: 160 }, { value: 6, weight: 30 },
];
/** Bonus boards: Antennas only retrigger. */
const BONUS_ANTENNAS = [
  { value: 0, weight: 720_000 }, { value: 1, weight: 230_000 }, { value: 2, weight: 38_000 }, { value: 3, weight: 12_000 },
];
const NO_ANTENNAS = [{ value: 0, weight: 1 }];

/** Double Chance: the same table with every bonus-triggering count (3+) twice as likely. */
export function doubleTriggers(list: { value: number; weight: number }[], minCount = 3) {
  return list.map((e) => (e.value >= minCount ? { ...e, weight: e.weight * 2 } : e));
}

const base: BoardProfile = {
  symbolWeights: BASE_SYMBOLS,
  stackChance: 0.4,
  wildMultipliers: PLAIN_WILDS,
  staticChance: [0.06, 0.06, 0.06, 0.06, 0.06, 0.06],
  staticHeight: STACK,
  antennaCount: BASE_ANTENNAS,
  tapeChance: 0.0019,
};

export const DEFAULT_CONFIG: GameConfig = {
  id: 'dead-frequency',
  version: '0.1.0',
  reels: 6,
  rows: 4,
  currency: { unitsPerCredit: 100, startingBalance: 100_000 },
  bets: [100, 200, 500, 1000, 2000, 5000],
  defaultBet: 100,
  symbols: SYMBOLS,
  paytable: {
    //           3x   4x   5x   6x   (hundredths of stake, per way)
    VALVE:      [ 3,   5,  10,  20],
    CASSETTE:   [ 3,   5,  10,  20],
    MIC:        [ 4,   8,  15,  30],
    HEADPHONES: [ 4,   8,  15,  30],
    RADIO:      [ 5,  12,  25,  50],
    WIDOW:       [ 8,  15,  40,  80],
    PRIEST:     [10,  25,  50, 125],
    HOST:       [15,  50, 125, 250],
  },
  minWayLength: 3,
  staticReveal: { VALVE: 20, CASSETTE: 20, MIC: 18, HEADPHONES: 18, RADIO: 12, WIDOW: 10, PRIEST: 8, HOST: 6 },
  retune: { enabled: true },
  profiles: {
    base,
    doubleChance: { ...base, antennaCount: doubleTriggers(BASE_ANTENNAS) },
    staticStorm: {
      ...base,
      antennaCount: NO_ANTENNAS,
      tapeChance: 0,
      guaranteedStaticReels: [{ value: 2, weight: 75.82 }, { value: 3, weight: 24.18 }],
    },
    hauntedWilds: {
      ...base,
      antennaCount: NO_ANTENNAS,
      tapeChance: 0,
      guaranteedWilds: {
        count: [{ value: 2, weight: 60 }, { value: 3, weight: 40 }],
        multipliers: [{ value: 2, weight: 61 }, { value: 3, weight: 27.4 }, { value: 5, weight: 9.8 }, { value: 10, weight: 1.85 }],
      },
    },
    nightShift: { ...base, symbolWeights: BONUS_SYMBOLS, staticChance: [0.1636, 0.1636, 0.1636, 0.1636, 0.1636, 0.1636], antennaCount: BONUS_ANTENNAS, tapeChance: 0 },
    possession: { ...base, symbolWeights: BONUS_SYMBOLS, staticChance: [0.0895, 0.0895, 0.0895, 0.0895, 0.0895, 0.0895], antennaCount: BONUS_ANTENNAS, tapeChance: 0 },
    deadAir: {
      ...base,
      symbolWeights: { ...BONUS_SYMBOLS, WILD: 40 },
      wildMultipliers: DEAD_AIR_WILDS,
      staticChance: [0.26, 0.26, 0.26, 0.26, 0.26, 0.26],
      antennaCount: BONUS_ANTENNAS,
      tapeChance: 0,
    },
  },
  bonuses: {
    NIGHT_SHIFT: {
      type: 'NIGHT_SHIFT', name: 'Night Shift', spins: 10, profile: 'nightShift',
      signalMeter: { start: 1, perStaticReel: 1, max: 100 },
    },
    POSSESSION: { type: 'POSSESSION', name: 'Possession', spins: 10, profile: 'possession', stickyStatic: true },
    DEAD_AIR: { type: 'DEAD_AIR', name: 'Dead Air', spins: 12, profile: 'deadAir', expandStatic: true },
  },
  antennaTriggers: [
    { count: 3, bonus: 'NIGHT_SHIFT' },
    { count: 4, bonus: 'POSSESSION' },
    { count: 5, bonus: 'DEAD_AIR' },
  ],
  retrigger: { minAntennas: 3, extraSpins: 5, maxTotalSpins: 50 },
  mystery: {
    prizes: [
      { value: { kind: 'CASH', x100: 200 }, weight: 300 },
      { value: { kind: 'CASH', x100: 500 }, weight: 250 },
      { value: { kind: 'CASH', x100: 1000 }, weight: 150 },
      { value: { kind: 'CASH', x100: 2500 }, weight: 70 },
      { value: { kind: 'CASH', x100: 10000 }, weight: 12 },
      { value: { kind: 'CASH', x100: 50000 }, weight: 1 },
      { value: { kind: 'BONUS', bonus: 'NIGHT_SHIFT' }, weight: 70 },
      { value: { kind: 'BONUS', bonus: 'POSSESSION' }, weight: 25 },
      { value: { kind: 'BONUS', bonus: 'DEAD_AIR' }, weight: 8 },
    ],
  },
  modes: {
    BASE: { id: 'BASE', name: 'Base Game', cost: 1, kind: 'spin', profile: 'base', description: 'Standard spin.' },
    DOUBLE_CHANCE: {
      id: 'DOUBLE_CHANCE', name: 'Double Chance', cost: 1.5, kind: 'spin', profile: 'doubleChance',
      description: 'Costs 1.5x stake. Antennas land more often: about twice the chance to start a bonus.',
    },
    STATIC_STORM: {
      id: 'STATIC_STORM', name: 'Feature Spins: Static Storm', cost: 8, kind: 'spin', profile: 'staticStorm',
      description: 'Every spin has 2 or 3 full reels of Static. No bonus triggers.',
    },
    HAUNTED_WILDS: {
      id: 'HAUNTED_WILDS', name: 'Feature Spins: Haunted Wilds', cost: 12, kind: 'spin', profile: 'hauntedWilds',
      description: 'Every spin has 2 or 3 extra On Air wilds carrying x2 to x10. No bonus triggers.',
    },
    BUY_NIGHT_SHIFT: { id: 'BUY_NIGHT_SHIFT', name: 'Buy Night Shift', cost: 80, kind: 'buy', bonus: 'NIGHT_SHIFT', description: '10 spins with the Signal Meter.' },
    BUY_POSSESSION: { id: 'BUY_POSSESSION', name: 'Buy Possession', cost: 160, kind: 'buy', bonus: 'POSSESSION', description: '10 spins with Sticky Static.' },
    BUY_DEAD_AIR: { id: 'BUY_DEAD_AIR', name: 'Buy Dead Air', cost: 275, kind: 'buy', bonus: 'DEAD_AIR', description: '12 spins with Expanding Static and multiplier wilds.' },
  },
  maxWinX: 50_000,
};

export const MODE_ORDER: ModeId[] = ['BASE', 'DOUBLE_CHANCE', 'STATIC_STORM', 'HAUNTED_WILDS', 'BUY_NIGHT_SHIFT', 'BUY_POSSESSION', 'BUY_DEAD_AIR'];

/** Price of a round in stake units. Mode costs are chosen so this is always an integer for the listed bets. */
export function roundCost(cfg: GameConfig, mode: ModeId, bet: number): number {
  return Math.round(bet * cfg.modes[mode].cost);
}

export function validateConfig(cfg: GameConfig): string[] {
  const errors: string[] = [];
  if (!cfg.bets.includes(cfg.defaultBet)) errors.push('defaultBet must be one of bets');
  for (const b of cfg.bets) {
    for (const m of MODE_ORDER) if (!Number.isInteger(b * cfg.modes[m].cost)) errors.push(`bet ${b} x ${m} cost is not an integer`);
  }
  for (const [sym, pays] of Object.entries(cfg.paytable)) {
    if (pays.some((p) => !Number.isInteger(p) || p < 0)) errors.push(`paytable.${sym} invalid`);
  }
  const positive = (ws: { weight: number }[]) => ws.length > 0 && ws.every((w) => w.weight >= 0) && ws.some((w) => w.weight > 0);
  for (const [id, p] of Object.entries(cfg.profiles)) {
    if (p.staticChance.length !== cfg.reels || p.staticChance.some((c) => c < 0 || c > 1)) errors.push(`profiles.${id}.staticChance invalid`);
    if (!positive(p.staticHeight) || p.staticHeight.some((h) => h.value < 1 || h.value > cfg.rows)) errors.push(`profiles.${id}.staticHeight invalid`);
    if (!positive(p.wildMultipliers) || p.wildMultipliers.some((m) => !Number.isInteger(m.value) || m.value < 1)) errors.push(`profiles.${id}.wildMultipliers invalid`);
    if (!positive(p.antennaCount) || p.antennaCount.some((a) => a.value < 0 || a.value > cfg.reels)) errors.push(`profiles.${id}.antennaCount invalid`);
    if (p.tapeChance < 0 || p.tapeChance > 1) errors.push(`profiles.${id}.tapeChance invalid`);
  }
  for (const b of Object.values(cfg.bonuses)) {
    if (cfg.profiles[b.profile].tapeChance !== 0) errors.push(`bonus ${b.type} profile may not contain Tapes`);
  }
  if (!positive(cfg.mystery.prizes)) errors.push('mystery.prizes invalid');
  if (cfg.antennaTriggers.some((t, i, a) => i > 0 && t.count <= a[i - 1].count)) errors.push('antennaTriggers must ascend');
  return errors;
}
