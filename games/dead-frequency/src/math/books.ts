/**
 * Stake Engine publication files for Dead Frequency: one book file and one lookup table per mode.
 *
 * How a mode's books are made (the same idea as the Stake Math SDK's distributions):
 *  - Every book is one complete round played by the real engine (playRound) and stored in full
 *    (see bookFormat.ts).
 *  - Books are grouped into criteria. A criterion's probability is set up front; books inside it
 *    are equally likely, so each criterion is an unbiased sample of its part of the game.
 *    · Spin modes with Antennas (base, Double Chance) split by the Antenna count, which the engine
 *      draws from an exact weight table: "normal" (0–2), Night Shift (3), Possession (4) and
 *      Dead Air (5–6). Forcing the count samples exactly that slice of the game, so the criteria
 *      probabilities are exact, and bonus rounds get far more books than natural sampling.
 *    · "wincap" holds max-win rounds. They are found with boosted symbol weights (the SDK's
 *      win-cap reel set). Every such round is still a legal round of the game; its probability
 *      comes from the lookup table, not from how it was found.
 *  - A gentle power tilt inside the non-wincap criteria, weight ∝ (1 + x)^λ, is solved by
 *    bisection so the integer lookup table returns exactly the target RTP.
 */
import { DEFAULT_CONFIG } from '../config/gameConfig';
import type { BoardProfile, GameConfig, ModeId, ProfileId } from '../config/types';
import { SeededRng } from '../engine/rng';
import { playRound, type RoundResult } from '../engine/round';
import { encodeRound, type BookEvents } from './bookFormat';

export interface Book {
  id: number;
  events: BookEvents;
  payoutMultiplier: number;
  criteria: string;
}

export interface CriterionPlan {
  name: string;
  /**
   * Probability of this criterion in the lookup table. For "bigwin" it is derived instead:
   * `rtpShare` of the RTP, taken out of the criterion named by `takeFrom`.
   */
  probability: number;
  rtpShare?: number;
  takeFrom?: string;
  /** Fill payout buckets [edges[i], edges[i+1]) with `perBucket` books each instead of taking `books` rounds. */
  buckets?: { edges: number[]; perBucket: number };
  /** Number of books to generate for it. */
  books: number;
  /** Config the rounds are played with (forced Antenna count or boosted weights). */
  cfg: GameConfig;
  /** Keep only rounds whose payout reaches the mode's max win. */
  maxWinOnly?: boolean;
  /** Give up after this many rounds (max-win search). */
  maxAttempts?: number;
}

export interface ModePlan {
  mode: ModeId;
  /** Name used in index.json and file names. */
  name: string;
  cost: number;
  /** The highest payout this mode can produce, x stake. */
  maxWinX: number;
  criteria: CriterionPlan[];
}

/** Stake mode names (index.json / RGS `mode`). */
export const STAKE_MODE_NAME: Record<ModeId, string> = {
  BASE: 'base',
  DOUBLE_CHANCE: 'double_chance',
  STATIC_STORM: 'static_storm',
  HAUNTED_WILDS: 'haunted_wilds',
  BUY_NIGHT_SHIFT: 'night_shift',
  BUY_POSSESSION: 'possession',
  BUY_DEAD_AIR: 'dead_air',
};

/**
 * Highest payout per mode. Static Storm has no multipliers, so its ceiling is the Night Host on
 * all 4,096 ways: 4^6 × 2.5x = 10,240x. Every other mode can reach the 50,000x cap.
 */
export function modeMaxWinX(cfg: GameConfig, mode: ModeId): number {
  if (mode === 'STATIC_STORM') return Math.max(...Object.values(cfg.paytable).map((p) => p[p.length - 1])) / 100 * cfg.rows ** cfg.reels;
  return cfg.maxWinX;
}

const withProfile = (cfg: GameConfig, id: ProfileId, p: Partial<BoardProfile>): GameConfig => ({ ...cfg, profiles: { ...cfg.profiles, [id]: { ...cfg.profiles[id], ...p } } });
const forceAntennas = (cfg: GameConfig, id: ProfileId, counts: { value: number; weight: number }[]) => withProfile(cfg, id, { antennaCount: counts });

/** Boosted weights used only to find max-win rounds: Night Host heavy, strong wilds and Static. */
function winCapSet(cfg: GameConfig, id: ProfileId, staticChance: number, extra: Partial<BoardProfile> = {}): GameConfig {
  const p = cfg.profiles[id];
  const c = withProfile(cfg, id, {
    symbolWeights: { ...p.symbolWeights, HOST: 400, PRIEST: 120, WILD: Math.max(p.symbolWeights.WILD, 60) },
    staticChance: [staticChance, staticChance, staticChance, staticChance, staticChance, staticChance],
    staticHeight: [{ value: 3, weight: 1 }, { value: 4, weight: 3 }],
    ...extra,
  });
  return { ...c, staticReveal: { ...cfg.staticReveal, HOST: 200, PRIEST: 30 } };
}
const BIG_WILDS = [{ value: 5, weight: 2 }, { value: 10, weight: 3 }, { value: 25, weight: 2 }];

/** Big-win buckets (x stake) from 1,000x up to the mode's max win, 12 books each (no bucket narrower than 10% of the max). */
const bigBuckets = (maxX: number) => ({ edges: [...[1000, 2500, 5000, 10000, 25000].filter((e) => e < maxX * 0.9), maxX], perBucket: 12 });
const BIG_SHARE = 0.003;

/** The publication plan for every mode. `scale` multiplies book counts (use < 1 for quick tests). */
export function stakePlans(cfg: GameConfig = DEFAULT_CONFIG, scale = 1): ModePlan[] {
  const n = (x: number) => Math.max(1, Math.round(x * scale));
  const plans: ModePlan[] = [];

  for (const [mode, profile, capOneIn] of [['BASE', 'base', 8_000_000], ['DOUBLE_CHANCE', 'doubleChance', 6_000_000]] as const) {
    const table = cfg.profiles[profile].antennaCount;
    const total = table.reduce((a, e) => a + e.weight, 0);
    const slice = (lo: number, hi: number) => table.filter((e) => e.value >= lo && e.value <= hi);
    const p = (lo: number, hi: number) => slice(lo, hi).reduce((a, e) => a + e.weight, 0) / total;
    const pCap = 1 / capOneIn;
    // The max-win criterion takes its probability out of the Dead Air slice it belongs to.
    const daForWincap = forceAntennas(winCapSet(cfg, 'deadAir', 0.4, { wildMultipliers: BIG_WILDS }), profile, [{ value: 5, weight: 1 }]);
    const daForBigwin = forceAntennas(winCapSet(cfg, 'deadAir', 0.3), profile, [{ value: 5, weight: 1 }]);
    plans.push({
      mode, name: STAKE_MODE_NAME[mode], cost: cfg.modes[mode].cost, maxWinX: cfg.maxWinX,
      criteria: [
        { name: 'normal', probability: p(0, 2), books: n(200_000), cfg: forceAntennas(cfg, profile, slice(0, 2)) },
        { name: 'night_shift', probability: p(3, 3), books: n(20_000), cfg: forceAntennas(cfg, profile, slice(3, 3)) },
        { name: 'possession', probability: p(4, 4), books: n(20_000), cfg: forceAntennas(cfg, profile, slice(4, 4)) },
        { name: 'dead_air', probability: p(5, 6) - pCap, books: n(20_000), cfg: forceAntennas(cfg, profile, slice(5, 6)) },
        { name: 'bigwin', probability: 0, rtpShare: BIG_SHARE, takeFrom: 'dead_air', books: 0, buckets: bigBuckets(cfg.maxWinX), cfg: daForBigwin, maxAttempts: 300_000 },
        { name: 'wincap', probability: pCap, books: n(40), cfg: daForWincap, maxWinOnly: true, maxAttempts: 2_000_000 },
      ],
    });
  }

  const stormCap = withProfile(cfg, 'staticStorm', { guaranteedStaticReels: [{ value: 6, weight: 1 }] });
  const stormBig = withProfile(cfg, 'staticStorm', { guaranteedStaticReels: [{ value: 4, weight: 2 }, { value: 5, weight: 2 }, { value: 6, weight: 1 }] });
  const stormMax = modeMaxWinX(cfg, 'STATIC_STORM');
  plans.push({
    mode: 'STATIC_STORM', name: STAKE_MODE_NAME.STATIC_STORM, cost: cfg.modes.STATIC_STORM.cost, maxWinX: stormMax,
    criteria: [
      { name: 'normal', probability: 1 - 1 / 5_000_000, books: n(200_000), cfg },
      { name: 'bigwin', probability: 0, rtpShare: BIG_SHARE, takeFrom: 'normal', books: 0, buckets: bigBuckets(stormMax), cfg: stormBig, maxAttempts: 300_000 },
      { name: 'wincap', probability: 1 / 5_000_000, books: n(10), cfg: { ...stormCap, staticReveal: { ...cfg.staticReveal, HOST: 2000 } }, maxWinOnly: true, maxAttempts: 1_000_000 },
    ],
  });

  const hauntedCap = winCapSet(cfg, 'hauntedWilds', 0.3, {
    guaranteedWilds: { count: [{ value: 3, weight: 1 }], multipliers: [{ value: 10, weight: 1 }] },
  });
  const hauntedBig = winCapSet(cfg, 'hauntedWilds', 0.12, {
    guaranteedWilds: { count: [{ value: 2, weight: 1 }, { value: 3, weight: 1 }], multipliers: [{ value: 3, weight: 1 }, { value: 5, weight: 2 }, { value: 10, weight: 2 }] },
  });
  plans.push({
    mode: 'HAUNTED_WILDS', name: STAKE_MODE_NAME.HAUNTED_WILDS, cost: cfg.modes.HAUNTED_WILDS.cost, maxWinX: cfg.maxWinX,
    criteria: [
      { name: 'normal', probability: 1 - 1 / 8_000_000, books: n(200_000), cfg },
      { name: 'bigwin', probability: 0, rtpShare: BIG_SHARE, takeFrom: 'normal', books: 0, buckets: bigBuckets(cfg.maxWinX), cfg: hauntedBig, maxAttempts: 300_000 },
      { name: 'wincap', probability: 1 / 8_000_000, books: n(20), cfg: hauntedCap, maxWinOnly: true, maxAttempts: 2_000_000 },
    ],
  });

  for (const [mode, capOneIn, cap, big] of [
    ['BUY_NIGHT_SHIFT', 2_000_000, winCapSet(cfg, 'nightShift', 0.35), winCapSet(cfg, 'nightShift', 0.24)],
    ['BUY_POSSESSION', 2_000_000, winCapSet(cfg, 'possession', 0.25), winCapSet(cfg, 'possession', 0.15)],
    ['BUY_DEAD_AIR', 20_000, winCapSet(cfg, 'deadAir', 0.4, { wildMultipliers: BIG_WILDS }), winCapSet(cfg, 'deadAir', 0.3)],
  ] as const) {
    plans.push({
      mode, name: STAKE_MODE_NAME[mode], cost: cfg.modes[mode].cost, maxWinX: cfg.maxWinX,
      criteria: [
        { name: 'normal', probability: 1 - 1 / capOneIn, books: n(100_000), cfg },
        { name: 'bigwin', probability: 0, rtpShare: BIG_SHARE, takeFrom: 'normal', books: 0, buckets: bigBuckets(cfg.maxWinX), cfg: big, maxAttempts: 300_000 },
        { name: 'wincap', probability: 1 / capOneIn, books: n(mode === 'BUY_DEAD_AIR' ? 100 : 30), cfg: cap, maxWinOnly: true, maxAttempts: 2_000_000 },
      ],
    });
  }
  return plans;
}

/** 32-bit mix of (base, i) so seeds are spread and reproducible. */
export function seedFor(base: number, i: number): number {
  let z = (base ^ Math.imul(i + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x7feb352d) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x846ca68b) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

export interface GeneratedMode {
  plan: ModePlan;
  books: Book[];
  /** Max-win search effort per criterion. */
  attempts: Record<string, number>;
}

/**
 * Plays every book of a mode. Max-win rounds that turn up naturally in other criteria are moved to
 * "wincap" (so the max-win probability is exactly the planned one).
 */
export function generateMode(plan: ModePlan, baseSeed: number, log: (m: string) => void = () => {}): GeneratedMode {
  const books: Book[] = [];
  const attempts: Record<string, number> = {};
  const capX100 = plan.maxWinX * 100;
  // Salt seeds with the mode name so modes that share a criterion slice (base and Double Chance)
  // still get different rounds.
  const salt = [...plan.name].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);
  let id = 1;
  plan.criteria.forEach((c, ci) => {
    let made = 0;
    let tries = 0;
    const fill = c.buckets ? c.buckets.edges.slice(0, -1).map(() => 0) : null;
    const bucketOf = (x: number) => (c.buckets ? c.buckets.edges.findIndex((lo, i) => i < c.buckets!.edges.length - 1 && x >= lo && x < c.buckets!.edges[i + 1]) : -1);
    const done = () => (fill ? fill.every((f) => f >= c.buckets!.perBucket) : made >= c.books);
    while (!done()) {
      if (c.maxAttempts && tries >= c.maxAttempts) break;
      const round: RoundResult = playRound(c.cfg, plan.mode, new SeededRng(seedFor((baseSeed ^ salt) + ci * 7919, tries++)));
      const isMax = round.winX100 >= capX100;
      if (c.maxWinOnly && !isMax) continue;
      if (fill) {
        const k = bucketOf(round.winX100 / 100);
        if (isMax || k < 0 || fill[k] >= c.buckets!.perBucket) continue;
        fill[k]++;
      }
      books.push({ id: id++, events: encodeRound(DEFAULT_CONFIG, round), payoutMultiplier: round.winX100, criteria: isMax ? 'wincap' : c.name });
      made++;
      if (made % 50_000 === 0) log(`${plan.name}/${c.name} ${made}/${c.books}`);
    }
    attempts[c.name] = tries;
    log(`${plan.name}/${c.name}: ${made} books from ${tries} rounds${fill ? ` (buckets ${fill.join('/')})` : ''}`);
  });
  return { plan, books, attempts };
}

export interface LookupRow {
  id: number;
  weight: bigint;
  payoutMultiplier: number;
}

export interface ModeStats {
  rtp: number;
  hitRate: number;
  maxWinX: number;
  maxWinProbability: number;
  criteriaProbability: Record<string, number>;
  books: number;
  nonZeroWeightPayouts: number;
}

/** Exact statistics from an integer lookup table. */
export function lookupStats(rows: LookupRow[], cost: number, criteriaOf?: Map<number, string>): ModeStats {
  let total = 0n;
  let paid = 0n;
  let hits = 0n;
  let maxW = 0n;
  const maxPm = rows.reduce((m, r) => Math.max(m, r.payoutMultiplier), 0);
  const acc: Record<string, bigint> = {};
  for (const r of rows) {
    total += r.weight;
    paid += r.weight * BigInt(r.payoutMultiplier);
    if (r.payoutMultiplier > 0) hits += r.weight;
    if (r.payoutMultiplier === maxPm) maxW += r.weight;
    const c = criteriaOf?.get(r.id);
    if (c) acc[c] = (acc[c] ?? 0n) + r.weight;
  }
  const div = (a: bigint, b: bigint) => Number((a * 10n ** 15n) / b) / 1e15;
  return {
    rtp: div(paid, total) / 100 / cost,
    hitRate: div(hits, total),
    maxWinX: maxPm / 100,
    maxWinProbability: div(maxW, total),
    criteriaProbability: Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, div(v, total)])),
    books: rows.length,
    nonZeroWeightPayouts: new Set(rows.filter((r) => r.weight > 0n).map((r) => r.payoutMultiplier)).size,
  };
}

/**
 * Integer weights: criteria totals as planned, a (1 + x)^λ tilt inside every criterion except
 * wincap, λ solved so the table's RTP is exactly `targetRtp`. Weights sum to about 2^62.
 */
export function assignWeights(gen: GeneratedMode, targetRtp: number): { rows: LookupRow[]; lambda: number; stats: ModeStats } {
  const { plan, books } = gen;
  const groups = new Map<string, Book[]>();
  for (const b of books) {
    const g = groups.get(b.criteria);
    if (g) g.push(b);
    else groups.set(b.criteria, [b]);
  }
  const x = (b: Book) => b.payoutMultiplier / 100;
  const P = new Map(plan.criteria.map((c) => [c.name, c.probability]));
  // A share-based criterion (bigwin) gets `rtpShare` of the RTP at its books' mean payout.
  for (const c of plan.criteria) {
    if (!c.rtpShare || !c.takeFrom) continue;
    const g = groups.get(c.name) ?? [];
    if (!g.length) throw new Error(`${plan.name}: no books in criterion ${c.name}`);
    const meanX = g.reduce((a, b) => a + x(b), 0) / g.length;
    const p = (c.rtpShare * targetRtp * plan.cost) / meanX;
    P.set(c.name, p);
    P.set(c.takeFrom, P.get(c.takeFrom)! - p);
  }
  for (const [name] of P) if (!groups.get(name)?.length) throw new Error(`${plan.name}: no books in criterion ${name}`);
  const tilted = (c: string) => c !== 'wincap';
  const mean = (c: string, lambda: number) => {
    let sw = 0;
    let swx = 0;
    for (const b of groups.get(c)!) {
      const w = tilted(c) ? Math.pow(1 + x(b), lambda) : 1;
      sw += w;
      swx += w * x(b);
    }
    return swx / sw;
  };
  const rtpAt = (lambda: number) => [...P].reduce((s, [c, p]) => s + p * mean(c, lambda), 0) / plan.cost;
  let lo = -2;
  let hi = 2;
  if ((rtpAt(lo) - targetRtp) * (rtpAt(hi) - targetRtp) > 0) throw new Error(`${plan.name}: RTP ${targetRtp} not reachable (${rtpAt(lo)}–${rtpAt(hi)})`);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (rtpAt(mid) < targetRtp) lo = mid;
    else hi = mid;
  }
  const lambda = (lo + hi) / 2;
  const SCALE = 2 ** 62;
  const rows: LookupRow[] = [];
  for (const [c, p] of P) {
    const g = groups.get(c)!;
    const raw = g.map((b) => (tilted(c) ? Math.pow(1 + x(b), lambda) : 1));
    const sum = raw.reduce((a, v) => a + v, 0);
    g.forEach((b, i) => rows.push({ id: b.id, weight: BigInt(Math.max(1, Math.round((p * raw[i] * SCALE) / sum))), payoutMultiplier: b.payoutMultiplier }));
  }
  rows.sort((a, b) => a.id - b.id);
  return { rows, lambda, stats: lookupStats(rows, plan.cost, new Map(books.map((b) => [b.id, b.criteria]))) };
}

export function lookupCsv(rows: LookupRow[]): string {
  return rows.map((r) => `${r.id},${r.weight},${r.payoutMultiplier}`).join('\n') + '\n';
}

/** Book lines as Stake expects them: id, events, payoutMultiplier (criteria kept for analysis). */
export function booksJsonl(books: Book[]): string {
  return books.map((b) => JSON.stringify({ id: b.id, events: b.events, payoutMultiplier: b.payoutMultiplier, criteria: b.criteria })).join('\n') + '\n';
}
