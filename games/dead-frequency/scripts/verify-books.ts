/**
 * Independent check of the Stake Engine math upload, reading only the files on disk:
 *  - index.json lists every mode with name / cost / events / weights;
 *  - every book line has id, events, payoutMultiplier; lookup rows are three uint64 values;
 *    ids and payouts match exactly between books and table (what the RGS hashes on upload);
 *  - exact RTP per mode from the integer table, all within 90–98% and within 0.5% of each other;
 *  - hit rate more often than 1 in 20 (spin modes), max payout equal to the declared max win,
 *    max win more often than 1 in 10,000,000, no gaps in the win ranges up to the max;
 *  - 100k+ books per mode;
 *  - every book decodes with the client decoder and adds up to its payout.
 *
 *   npm run df:books:verify [-- --dir games/dead-frequency/stake-upload/math]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zstdDecompressSync } from 'node:zlib';
import { DEFAULT_CONFIG } from '../src/config/gameConfig';
import type { ModeId } from '../src/config/types';
import { decodeRound } from '../src/math/bookFormat';
import { STAKE_MODE_NAME, lookupStats, modeMaxWinX } from '../src/math/books';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const dir = arg('dir', fileURLToPath(new URL('../stake-upload/math', import.meta.url)));
const minBooks = Number(arg('minBooks', '100000'));
const cfg = DEFAULT_CONFIG;
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const modeByName = Object.fromEntries(Object.entries(STAKE_MODE_NAME).map(([k, v]) => [v, k])) as Record<string, ModeId>;

const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8'));
if (!Array.isArray(index.modes) || !index.modes.length) throw new Error('index.json: modes missing');
const rtps: Record<string, number> = {};

for (const m of index.modes) {
  if (typeof m.name !== 'string' || typeof m.cost !== 'number' || !String(m.events).endsWith('.jsonl.zst') || !String(m.weights).endsWith('.csv')) {
    fail(`index.json: bad mode entry ${JSON.stringify(m)}`);
    continue;
  }
  const mode = modeByName[m.name];
  if (!mode) fail(`${m.name}: not a mode of this game`);
  else if (cfg.modes[mode].cost !== m.cost) fail(`${m.name}: cost ${m.cost} != game cost ${cfg.modes[mode].cost}`);

  const lines = zstdDecompressSync(readFileSync(`${dir}/${m.events}`)).toString('utf8').trim().split('\n');
  const byId = new Map<number, number>();
  let decodeErrors = 0;
  for (const line of lines) {
    const b = JSON.parse(line);
    if (!Number.isInteger(b.id) || !Array.isArray(b.events) || !Number.isInteger(b.payoutMultiplier) || b.payoutMultiplier < 0) {
      fail(`${m.name}: book ${b.id} is missing id / events / payoutMultiplier`);
      continue;
    }
    if (byId.has(b.id)) fail(`${m.name}: duplicate book id ${b.id}`);
    byId.set(b.id, b.payoutMultiplier);
    try {
      const r = decodeRound(cfg, b.events);
      if (r.winX100 !== b.payoutMultiplier) throw new Error(`decoded ${r.winX100}`);
      if (mode && r.mode !== mode) throw new Error(`book mode ${r.mode}`);
    } catch (e) {
      if (decodeErrors++ < 5) fail(`${m.name}: book ${b.id} does not decode: ${(e as Error).message}`);
    }
  }
  const rows = readFileSync(`${dir}/${m.weights}`, 'utf8').trim().split('\n').map((l) => {
    const p = l.split(',');
    if (p.length !== 3 || !p.every((v) => /^\d+$/.test(v))) fail(`${m.name}: bad lookup row "${l}"`);
    return { id: Number(p[0]), weight: BigInt(p[1]), payoutMultiplier: Number(p[2]) };
  });
  if (rows.length !== byId.size) fail(`${m.name}: ${rows.length} lookup rows but ${byId.size} books`);
  for (const r of rows) {
    if (!byId.has(r.id)) fail(`${m.name}: lookup id ${r.id} has no book`);
    else if (byId.get(r.id) !== r.payoutMultiplier) fail(`${m.name}: payout mismatch for id ${r.id}`);
    if (r.weight > 18446744073709551615n) fail(`${m.name}: weight overflows uint64 (id ${r.id})`);
  }
  const s = lookupStats(rows, m.cost);
  rtps[m.name] = s.rtp;
  const declaredMax = mode ? modeMaxWinX(cfg, mode) : cfg.maxWinX;
  console.log(`\n${m.name} (cost ${m.cost}x): ${rows.length.toLocaleString()} books, ${s.nonZeroWeightPayouts.toLocaleString()} distinct payouts`);
  console.log(`  RTP ${(s.rtp * 100).toFixed(6)}%   hit rate ${(s.hitRate * 100).toFixed(2)}% (1 in ${(1 / s.hitRate).toFixed(2)})`);
  console.log(`  max payout ${s.maxWinX}x (declared ${declaredMax}x), 1 in ${Math.round(1 / s.maxWinProbability).toLocaleString()}`);
  if (rows.length < minBooks) fail(`${m.name}: only ${rows.length} books (need ${minBooks}+)`);
  if (s.rtp < 0.9 || s.rtp > 0.98) fail(`${m.name}: RTP outside 90–98%`);
  if (s.hitRate < 1 / 20) fail(`${m.name}: hit rate rarer than 1 in 20`);
  if (s.maxWinX !== declaredMax) fail(`${m.name}: max payout ${s.maxWinX}x != declared ${declaredMax}x`);
  if (s.maxWinProbability < 1e-7) fail(`${m.name}: max win rarer than 1 in 10,000,000`);
  // Win ranges in multiples of the base stake. A gap is an empty range between the smallest
  // populated range and the max win (buy modes naturally never pay tiny amounts).
  const edges = [0, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000].filter((e) => e < declaredMax * 0.9);
  const xs = rows.filter((r) => r.weight > 0n && r.payoutMultiplier > 0).map((r) => r.payoutMultiplier / 100);
  const ranges = edges.map((lo, i) => [lo, edges[i + 1] ?? declaredMax] as const);
  const filled = ranges.map(([lo, hi]) => xs.some((x) => x > lo && x < hi) || (lo === 0 && xs.some((x) => x < 1)));
  const first = filled.indexOf(true);
  const gaps = ranges.filter((_, i) => i > first && !filled[i]);
  console.log(`  win ranges (x stake) populated: ${filled.filter(Boolean).length}/${ranges.length}${gaps.length ? `; gaps: ${gaps.map(([a, b]) => `(${a},${b})`).join(' ')}` : ', no gaps'}`);
  if (gaps.length) fail(`${m.name}: gaps in obtainable wins ${gaps.map(([a, b]) => `(${a}x,${b}x)`).join(' ')}`);
  if (decodeErrors) fail(`${m.name}: ${decodeErrors} books failed to decode`);
  else console.log(`  all ${lines.length.toLocaleString()} books decode with the client decoder and add up to their payout`);
}

const vals = Object.values(rtps);
const spread = Math.max(...vals) - Math.min(...vals);
console.log(`\nRTP spread across modes: ${(spread * 100).toFixed(6)}%`);
if (spread > 0.005) fail('RTP spread across modes is above 0.5%');
const missing = Object.values(STAKE_MODE_NAME).filter((n) => !rtps[n]);
if (missing.length) fail(`modes missing from index.json: ${missing.join(', ')}`);

if (problems.length) {
  console.error(`\nFAILED (${problems.length}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nOK: the math upload passes every check.');
