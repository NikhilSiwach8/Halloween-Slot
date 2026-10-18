/**
 * Generate the Stake Engine math upload for Dead Frequency, one set per mode:
 *
 *   stake-upload/math/index.json
 *   stake-upload/math/books_<mode>.jsonl.zst
 *   stake-upload/math/lookUpTable_<mode>_0.csv
 *
 * plus stake-upload/math-summary.json (not uploaded; for review) and src/config/publishedMath.json
 * (RTP, max win and max-win odds per mode, shown in the rules screen).
 *
 *   npm run df:books -- [--out games/dead-frequency/stake-upload] [--seed 20261018] [--rtp 0.96] [--scale 1]
 *
 * Every book is decoded again with the client's decoder before it is written, so a book the
 * client would reject can never be published.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zstdCompressSync } from 'node:zlib';
import { DEFAULT_CONFIG } from '../src/config/gameConfig';
import { decodeRound } from '../src/math/bookFormat';
import { assignWeights, booksJsonl, generateMode, lookupCsv, stakePlans } from '../src/math/books';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const cfg = DEFAULT_CONFIG;
// Paths resolve from this script's location, so the command works from any directory.
const gameDir = fileURLToPath(new URL('..', import.meta.url));
const root = arg('out', `${gameDir}stake-upload`);
const out = `${root}/math`;
const baseSeed = Number(arg('seed', '20261018'));
const targetRtp = Number(arg('rtp', '0.96'));
const scale = Number(arg('scale', '1'));
const only = arg('modes', '');

const t0 = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
mkdirSync(out, { recursive: true });

const index: { modes: { name: string; cost: number; events: string; weights: string }[] } = { modes: [] };
const summary: Record<string, unknown> = {};
const published: Record<string, { rtp: number; maxWinX: number; maxWinOneIn: number; hitRate: number; books: number }> = {};

for (const plan of stakePlans(cfg, scale)) {
  if (only && !only.split(',').includes(plan.name)) continue;
  const gen = generateMode(plan, baseSeed, log);
  for (const b of gen.books) {
    const round = decodeRound(cfg, b.events);
    if (round.winX100 !== b.payoutMultiplier) throw new Error(`${plan.name} book ${b.id}: decoded win ${round.winX100} != ${b.payoutMultiplier}`);
  }
  log(`${plan.name}: all ${gen.books.length} books decode and add up`);
  const { rows, lambda, stats } = assignWeights(gen, targetRtp);
  if (stats.maxWinX !== plan.maxWinX) throw new Error(`${plan.name}: max payout ${stats.maxWinX}x, expected ${plan.maxWinX}x`);

  const events = `books_${plan.name}.jsonl.zst`;
  const weights = `lookUpTable_${plan.name}_0.csv`;
  writeFileSync(`${out}/${events}`, zstdCompressSync(Buffer.from(booksJsonl(gen.books))));
  writeFileSync(`${out}/${weights}`, lookupCsv(rows));
  index.modes.push({ name: plan.name, cost: plan.cost, events, weights });
  summary[plan.name] = { mode: plan.mode, cost: plan.cost, tiltLambda: lambda, maxWinSearchRounds: gen.attempts, ...stats };
  published[plan.mode] = {
    rtp: Number((stats.rtp * 100).toFixed(2)),
    maxWinX: stats.maxWinX,
    maxWinOneIn: Math.round(1 / stats.maxWinProbability),
    hitRate: Number((stats.hitRate * 100).toFixed(2)),
    books: stats.books,
  };
  log(`${plan.name}: RTP ${(stats.rtp * 100).toFixed(4)}%  hit ${(stats.hitRate * 100).toFixed(2)}%  max ${stats.maxWinX}x 1 in ${Math.round(1 / stats.maxWinProbability).toLocaleString()}  λ=${lambda.toFixed(4)}`);
}

writeFileSync(`${out}/index.json`, JSON.stringify(index, null, 2) + '\n');
writeFileSync(`${root}/math-summary.json`, JSON.stringify({ game: cfg.id, version: cfg.version, generatedAt: new Date().toISOString(), baseSeed, targetRtp, modes: summary }, null, 2) + '\n');
if (!only && scale === 1) {
  writeFileSync(`${gameDir}src/config/publishedMath.json`, JSON.stringify({ version: cfg.version, generatedAt: new Date().toISOString(), modes: published }, null, 2) + '\n');
}
log('done');
