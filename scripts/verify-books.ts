/**
 * Independent check of the publication files against the format in the official
 * StakeEngine/math-sdk docs (docs/rgs_docs/data_format.md):
 *  - index.json has modes[] with name/cost/events/weights
 *  - every book has id, events, payoutMultiplier
 *  - lookup table rows are "id,weight,payoutMultiplier" uint64 and payouts match the books exactly
 * Then recomputes RTP / hit rate / max-win frequency from the table and replays a sample of books.
 *
 *   npm run books:verify [-- --dir math/publish --replay 2000]
 */
import { readFileSync } from 'node:fs';
import { zstdDecompressSync } from 'node:zlib';
import { DEFAULT_CONFIG } from '../src/config/gameConfig';
import { lookupStats, playBookRound, type Book } from '../src/math/books';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const dir = arg('dir', 'math/publish');
const replayN = Number(arg('replay', '2000'));
const fail = (m: string) => {
  console.error(`FAIL: ${m}`);
  process.exit(1);
};

const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8'));
if (!Array.isArray(index.modes) || !index.modes.length) fail('index.json: modes missing');
for (const m of index.modes) {
  if (typeof m.name !== 'string' || typeof m.cost !== 'number' || !String(m.events).endsWith('.jsonl.zst') || !String(m.weights).endsWith('.csv')) fail(`index.json: bad mode ${JSON.stringify(m)}`);
  const books: Book[] = zstdDecompressSync(readFileSync(`${dir}/${m.events}`)).toString('utf8').trim().split('\n').map((l: string) => JSON.parse(l));
  const byId = new Map<number, Book>();
  for (const b of books) {
    if (!Number.isInteger(b.id) || !Array.isArray(b.events) || !Number.isInteger(b.payoutMultiplier) || b.payoutMultiplier < 0) fail(`book ${b.id} missing required fields`);
    if (byId.has(b.id)) fail(`duplicate book id ${b.id}`);
    byId.set(b.id, b);
  }
  const rows = readFileSync(`${dir}/${m.weights}`, 'utf8').trim().split('\n').map((l) => {
    const p = l.split(',');
    if (p.length !== 3 || !p.every((v) => /^\d+$/.test(v))) fail(`bad lookup row "${l}"`);
    return { id: Number(p[0]), weight: BigInt(p[1]), payoutMultiplier: Number(p[2]) };
  });
  if (rows.length !== books.length) fail(`lookup rows ${rows.length} != books ${books.length}`);
  for (const r of rows) {
    const b = byId.get(r.id);
    if (!b) fail(`lookup id ${r.id} has no book`);
    if (b!.payoutMultiplier !== r.payoutMultiplier) fail(`payout mismatch for id ${r.id}`);
    if (r.weight > 18446744073709551615n) fail(`weight overflow uint64 for id ${r.id}`);
  }
  const s = lookupStats(rows, books);
  const max = rows.reduce((m, r) => Math.max(m, r.payoutMultiplier), 0) / 100;
  console.log(`mode ${m.name} (cost ${m.cost}): ${books.length} books`);
  console.log(`  RTP (exact from lookup table) ${(s.rtp * 100).toFixed(4)}%`);
  console.log(`  hit rate ${(s.hitRate * 100).toFixed(2)}%  (1 in ${(1 / s.hitRate).toFixed(2)})`);
  console.log(`  max payout ${max}x  probability 1 in ${Math.round(1 / s.maxWinProbability).toLocaleString()}`);
  console.log(`  criteria ${JSON.stringify(s.criteriaProbability)}`);
  if (s.rtp < 0.9 || s.rtp > 0.98) fail('RTP outside 90–98%');
  if (s.hitRate < 1 / 20) fail('hit rate rarer than 1 in 20');
  if (max !== DEFAULT_CONFIG.maxWinX) fail(`max payout ${max}x != declared max win ${DEFAULT_CONFIG.maxWinX}x`);
  if (s.maxWinProbability < 1e-7) fail('max win rarer than 1 in 10,000,000');
  const ranges = [[0, 1], [1, 2], [2, 5], [5, 10], [10, 25], [25, 50], [50, 100], [100, 250], [250, 500], [500, 1000], [1000, 2500], [2500, 5000], [5000, 10000], [10000, 25000], [25000, 50000], [50000, 50000.01]];
  const xs = rows.filter((r) => r.weight > 0n).map((r) => r.payoutMultiplier / 100);
  const empty = ranges.filter(([lo, hi]) => !xs.some((x) => x >= lo && x < hi) && !(lo === 0 && xs.includes(0)));
  console.log(`  win-range coverage: ${ranges.length - empty.length}/${ranges.length} ranges populated${empty.length ? `; empty: ${empty.map(([a, b]) => `[${a},${b})`).join(' ')}` : ''}`);
  if (empty.length) fail('gap in obtainable win ranges');

  // replay: all max-win books + a spread sample
  let n = 0;
  const step = Math.max(1, Math.floor(books.length / replayN));
  for (const b of books) {
    const ev = b.events[0] as { seed: number; weightSet: 'bonus' | 'wincapBonus'; criteria: string };
    if (ev.criteria !== 'wincap' && b.id % step !== 0) continue;
    const r = playBookRound(DEFAULT_CONFIG, ev.seed, ev.weightSet, false);
    if (r.totalWin !== b.payoutMultiplier) fail(`book ${b.id} replays to ${r.totalWin}, expected ${b.payoutMultiplier}`);
    n++;
  }
  console.log(`  replayed ${n} books: all payouts reproduced exactly`);
}
console.log('OK');
