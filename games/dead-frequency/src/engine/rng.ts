/**
 * Seedable PRNG for development, testing and simulation.
 *
 * sfc32 seeded through splitmix32. This is NOT a certified gaming RNG; a
 * platform build must source outcomes from the platform's approved mechanism
 * before real-money use.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Number of values drawn so far (useful for replay diagnostics). */
  readonly draws: number;
}

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export class SeededRng implements Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private count = 0;

  constructor(seed: number) {
    const sm = splitmix32(seed);
    this.a = sm();
    this.b = sm();
    this.c = sm();
    this.d = sm();
    for (let i = 0; i < 12; i++) this.raw();
    this.count = 0;
  }

  private raw(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) >>> 0;
    return t >>> 0;
  }

  next(): number {
    this.count++;
    return this.raw() / 4294967296;
  }

  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0) throw new RangeError(`rng.int(n) requires a positive integer, got ${n}`);
    return Math.floor(this.next() * n);
  }

  get draws(): number {
    return this.count;
  }
}

/** Weighted pick from a weight table. Deterministic iteration order = key order of the table. */
export function weightedPick<K extends string>(rng: Rng, table: Record<K, number>): K {
  let total = 0;
  for (const k in table) total += table[k];
  let r = rng.next() * total;
  let last: K | undefined;
  for (const k in table) {
    const w = table[k];
    if (w <= 0) continue;
    last = k;
    if (r < w) return k;
    r -= w;
  }
  if (last === undefined) throw new Error('weightedPick: empty table');
  return last;
}

/** Sample up to k distinct items (partial Fisher-Yates); result keeps draw order. */
export function sampleDistinct<T>(rng: Rng, items: readonly T[], k: number): T[] {
  const pool = items.slice();
  const out: T[] = [];
  const n = Math.min(k, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + rng.int(pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }
  return out;
}

/** Weighted pick from a `{ value, weight }` list. */
export function pickWeighted<T>(rng: Rng, list: readonly { value: T; weight: number }[]): T {
  let total = 0;
  for (const e of list) total += e.weight;
  let r = rng.next() * total;
  let last: T | undefined;
  for (const e of list) {
    if (e.weight <= 0) continue;
    last = e.value;
    if (r < e.weight) return e.value;
    r -= e.weight;
  }
  if (last === undefined) throw new Error('pickWeighted: empty list');
  return last;
}
