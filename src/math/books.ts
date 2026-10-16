/**
 * Book generation for book-based platforms (Stake Engine publication format).
 *
 * A "book" is one complete, independent round. Every Hollow Hour round is fully determined by
 * (engine version, config, seed, bonus weight set), so a book stores those plus the integer
 * payoutMultiplier; the client reproduces the full event stream with the same engine and must
 * obtain exactly the same payout (it refuses to display a mismatching round).
 *
 * Probabilities are NOT taken from how books were found. They are assigned per criteria and then
 * tilted inside each criteria to hit the target RTP exactly (computed from the integer lookup
 * table) — the same idea as the Stake Math SDK's distributions + optimizer.
 */
import type { GameConfig } from '../config/types';
import { GameEngine, peekOpeningBoard, type RoundRecord } from '../engine/GameEngine';

export const BOOK_STAKE = 100; // engine units: totalWin at this stake == payoutMultiplier (x100 of bet)
export const ENGINE_ID = 'the-hollow-hour';

export type Criteria = 'zero' | 'basegame' | 'freegame' | 'bigwin' | 'wincap';
export type WeightSet = 'bonus' | 'wincapBonus';
export const ALL_CRITERIA: Criteria[] = ['zero', 'basegame', 'freegame', 'bigwin', 'wincap'];

export interface BookEvent {
  index: 0;
  type: 'hollowHourRound';
  engine: string;
  configVersion: string;
  seed: number;
  weightSet: WeightSet;
  criteria: Criteria;
  summary: { baseWin: number; bonusWin: number; bonus: boolean; clockmaker: string | null; maxHourMultiplier: number };
}

export interface Book {
  id: number;
  events: [BookEvent];
  payoutMultiplier: number;
}

/** 32-bit mix of (base, i) so seeds are spread and reproducible. */
export function seedFor(base: number, i: number): number {
  let z = (base ^ Math.imul(i + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x7feb352d) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x846ca68b) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

/** Play one independent round exactly as the client will replay it. */
export function playBookRound(cfg: GameConfig, seed: number, weightSet: WeightSet, recordEvents = false): RoundRecord {
  const engine = new GameEngine(cfg, { seed, recordEvents, bonusWeightSet: weightSet, startingBalance: Number.MAX_SAFE_INTEGER / 4 });
  return engine.playRound(BOOK_STAKE);
}

export function classify(cfg: GameConfig, r: RoundRecord, weightSet: WeightSet = 'bonus'): Criteria {
  if (r.totalWin >= BOOK_STAKE * cfg.maxWinX) return 'wincap';
  if (weightSet === 'wincapBonus') return 'bigwin';
  if (r.stats.bonus) return 'freegame';
  return r.totalWin > 0 ? 'basegame' : 'zero';
}

export function makeBook(cfg: GameConfig, id: number, seed: number, weightSet: WeightSet, r: RoundRecord): Book {
  return {
    id,
    payoutMultiplier: r.totalWin,
    events: [{
      index: 0, type: 'hollowHourRound', engine: ENGINE_ID, configVersion: cfg.version, seed, weightSet, criteria: classify(cfg, r, weightSet),
      summary: { baseWin: r.baseWin, bonusWin: r.bonusWin, bonus: r.stats.bonus, clockmaker: r.stats.clockmaker, maxHourMultiplier: r.stats.maxHourMultiplier },
    }],
  };
}

export interface GenerateOptions {
  cfg: GameConfig;
  baseSeed: number;
  /** Naturally drawn rounds (all criteria, natural proportions). */
  naturalBooks: number;
  /** Additional bonus rounds found by opening-board seed search. */
  extraBonusBooks: number;
  /** Max-win books to find with the wincap weight set. */
  wincapBooks: number;
  /** Give up the wincap search after this many wincap-set bonus rounds. */
  wincapMaxAttempts: number;
  /** Keep up to this many non-capped wincap-set rounds paying >= bigwinMinX as 'bigwin' books (fills the 5k–50k range). */
  bigwinBooks: number;
  bigwinMinX: number;
  log?: (msg: string) => void;
}

export interface GenerateResult {
  books: Book[];
  /** Natural frequency estimates from the generation itself (used to set criteria probabilities). */
  natural: { rounds: number; zero: number; basegame: number; freegame: number; bigwin: number; wincap: number };
  bonusTriggerRate: { boards: number; triggered: number };
  wincapAttempts: number;
}

export function generateBooks(o: GenerateOptions): GenerateResult {
  const { cfg } = o;
  const log = o.log ?? (() => {});
  const books: Book[] = [];
  const natural = { rounds: 0, zero: 0, basegame: 0, freegame: 0, bigwin: 0, wincap: 0 };
  let id = 1;

  for (let i = 0; i < o.naturalBooks; i++) {
    const seed = seedFor(o.baseSeed, i);
    const r = playBookRound(cfg, seed, 'bonus');
    const b = makeBook(cfg, id++, seed, 'bonus', r);
    natural.rounds++;
    natural[b.events[0].criteria]++;
    books.push(b);
    if ((i + 1) % 50_000 === 0) log(`natural ${i + 1}/${o.naturalBooks}`);
  }

  // Bonus seeds: scan opening boards only (cheap) — also measures the trigger rate precisely.
  const trig = cfg.bonus.triggerTickets;
  let scanned = 0;
  let triggered = 0;
  let k = 0;
  const nextBonusSeed = () => {
    for (;;) {
      const seed = seedFor(o.baseSeed ^ 0xb0b0b0b0, k++);
      scanned++;
      if (peekOpeningBoard(cfg, seed).filter((s) => s === 'TICKET').length >= trig) {
        triggered++;
        return seed;
      }
    }
  };

  for (let i = 0; i < o.extraBonusBooks; i++) {
    const seed = nextBonusSeed();
    books.push(makeBook(cfg, id++, seed, 'bonus', playBookRound(cfg, seed, 'bonus')));
  }
  log(`extra bonus books ${o.extraBonusBooks}`);

  let found = 0;
  let attempts = 0;
  let bigwins = 0;
  while ((found < o.wincapBooks || bigwins < o.bigwinBooks) && attempts < o.wincapMaxAttempts) {
    const seed = nextBonusSeed();
    attempts++;
    const r = playBookRound(cfg, seed, 'wincapBonus');
    if (r.totalWin >= BOOK_STAKE * cfg.maxWinX) {
      if (found >= o.wincapBooks) continue;
      books.push(makeBook(cfg, id++, seed, 'wincapBonus', r));
      found++;
      log(`wincap book ${found} after ${attempts} attempts`);
    } else if (bigwins < o.bigwinBooks && r.totalWin >= BOOK_STAKE * o.bigwinMinX) {
      books.push(makeBook(cfg, id++, seed, 'wincapBonus', r));
      bigwins++;
    }
  }
  log(`scanned ${scanned} opening boards, ${triggered} bonus triggers (1 in ${(scanned / triggered).toFixed(1)})`);
  return { books, natural, bonusTriggerRate: { boards: scanned, triggered }, wincapAttempts: attempts };
}

export interface WeightPlan {
  targetRtp: number;
  /** Probability of the max-win criteria (e.g. 1 / 5_000_000). */
  wincapProbability: number;
  /** Probability of the big-win criteria (non-capped high bonus books, uniform weights). */
  bigwinProbability: number;
  /** Probability of a bonus (freegame + bigwin + wincap). */
  bonusProbability: number;
  /** Probability of a zero-win round among non-bonus rounds' complement. */
  zeroProbability: number;
}

export interface LookupRow {
  id: number;
  weight: bigint;
  payoutMultiplier: number;
}

export interface WeightResult {
  rows: LookupRow[];
  lambda: number;
  /** Exact RTP from the integer lookup table. */
  rtp: number;
  hitRate: number;
  criteriaProbability: Record<Criteria, number>;
  maxWinProbability: number;
}

/**
 * Assign integer weights:
 *  - criteria totals fixed by the plan (zero / basegame / freegame / wincap);
 *  - inside basegame and freegame, weights ∝ (1 + x)^λ where x = payout (x bet) — a gentle tilt;
 *  - λ found by bisection so that the lookup-table RTP equals the target.
 */
export function assignWeights(books: Book[], plan: WeightPlan): WeightResult {
  const groups: Record<Criteria, Book[]> = { zero: [], basegame: [], freegame: [], bigwin: [], wincap: [] };
  for (const b of books) groups[b.events[0].criteria].push(b);
  for (const c of ALL_CRITERIA) if (!groups[c].length) throw new Error(`no books in criteria ${c}`);
  const pW = plan.wincapProbability;
  const pG = plan.bigwinProbability;
  const pF = plan.bonusProbability - pW - pG;
  const pZ = plan.zeroProbability;
  const pB = 1 - pW - pG - pF - pZ;
  if (pB <= 0 || pF <= 0) throw new Error('weight plan probabilities are inconsistent');
  const P: Record<Criteria, number> = { zero: pZ, basegame: pB, freegame: pF, bigwin: pG, wincap: pW };
  const x = (b: Book) => b.payoutMultiplier / 100;

  const groupMean = (c: Criteria, lambda: number) => {
    let sw = 0;
    let swx = 0;
    for (const b of groups[c]) {
      const w = c === 'basegame' || c === 'freegame' ? Math.pow(1 + x(b), lambda) : 1;
      sw += w;
      swx += w * x(b);
    }
    return swx / sw;
  };
  const rtpAt = (lambda: number) => ALL_CRITERIA.reduce((s, c) => s + P[c] * groupMean(c, lambda), 0);
  let lo = -3;
  let hi = 3;
  if ((rtpAt(lo) - plan.targetRtp) * (rtpAt(hi) - plan.targetRtp) > 0) throw new Error(`target RTP ${plan.targetRtp} not reachable (range ${rtpAt(lo)}–${rtpAt(hi)})`);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (rtpAt(mid) < plan.targetRtp) lo = mid;
    else hi = mid;
  }
  const lambda = (lo + hi) / 2;

  // Integer weights: scale so the total is ~2^62 (uint64-safe), every book weight >= 1.
  const SCALE = 2 ** 62;
  const rows: LookupRow[] = [];
  for (const c of ALL_CRITERIA) {
    const raw = groups[c].map((b) => (c === 'basegame' || c === 'freegame' ? Math.pow(1 + x(b), lambda) : 1));
    const sum = raw.reduce((a, v) => a + v, 0);
    groups[c].forEach((b, i) => {
      const w = BigInt(Math.max(1, Math.round((P[c] * raw[i] * SCALE) / sum)));
      rows.push({ id: b.id, weight: w, payoutMultiplier: b.payoutMultiplier });
    });
  }
  rows.sort((a, b) => a.id - b.id);
  const stats = lookupStats(rows, books);
  return { rows, lambda, ...stats };
}

/** Exact statistics from an integer lookup table. */
export function lookupStats(rows: LookupRow[], books?: Book[]) {
  let total = 0n;
  let paid = 0n;
  let hits = 0n;
  let maxW = 0n;
  const maxPm = rows.reduce((m, r) => Math.max(m, r.payoutMultiplier), 0);
  for (const r of rows) {
    total += r.weight;
    paid += r.weight * BigInt(r.payoutMultiplier);
    if (r.payoutMultiplier > 0) hits += r.weight;
    if (r.payoutMultiplier === maxPm) maxW += r.weight;
  }
  const div = (a: bigint, b: bigint) => Number((a * 10n ** 12n) / b) / 1e12;
  const criteriaProbability: Record<Criteria, number> = { zero: 0, basegame: 0, freegame: 0, bigwin: 0, wincap: 0 };
  if (books) {
    const byId = new Map(books.map((b) => [b.id, b.events[0].criteria]));
    const acc: Record<Criteria, bigint> = { zero: 0n, basegame: 0n, freegame: 0n, bigwin: 0n, wincap: 0n };
    for (const r of rows) acc[byId.get(r.id)!] += r.weight;
    for (const c of Object.keys(acc) as Criteria[]) criteriaProbability[c] = div(acc[c], total);
  }
  return { rtp: div(paid, total) / 100, hitRate: div(hits, total), criteriaProbability, maxWinProbability: div(maxW, total) };
}

export function lookupCsv(rows: LookupRow[]): string {
  return rows.map((r) => `${r.id},${r.weight},${r.payoutMultiplier}`).join('\n') + '\n';
}

export function booksJsonl(books: Book[]): string {
  return books.map((b) => JSON.stringify(b)).join('\n') + '\n';
}
