/**
 * Generate Stake Engine publication files for mode "base" (cost 1.0):
 *   math/publish/index.json
 *   math/publish/books_base.jsonl.zst
 *   math/publish/lookUpTable_base_0.csv
 * plus math/publish/summary.json and src/config/publishedMath.json (shown in the rules screen).
 *
 *   npm run books -- [--natural 100000] [--bonus 10000] [--wincap 10] [--attempts 200000] [--seed 20261016] [--rtp 0.96]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { zstdCompressSync } from 'node:zlib';
import { DEFAULT_CONFIG } from '../src/config/gameConfig';
import { ALL_CRITERIA, assignWeights, booksJsonl, generateBooks, lookupCsv, playBookRound } from '../src/math/books';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const cfg = DEFAULT_CONFIG;
const out = arg('out', 'math/publish');
const naturalBooks = Number(arg('natural', '100000'));
const extraBonusBooks = Number(arg('bonus', '10000'));
const wincapBooks = Number(arg('wincap', '10'));
const wincapMaxAttempts = Number(arg('attempts', '200000'));
const baseSeed = Number(arg('seed', '20261016'));
const targetRtp = Number(arg('rtp', '0.96'));
const wincapOneIn = Number(arg('wincapOneIn', '5000000'));
const bigwinBooks = Number(arg('bigwin', '400'));
const bigwinMinX = Number(arg('bigwinMinX', '2000'));
const bigwinOneIn = Number(arg('bigwinOneIn', '1000000'));

const t0 = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const gen = generateBooks({ cfg, baseSeed, naturalBooks, extraBonusBooks, wincapBooks, wincapMaxAttempts, bigwinBooks, bigwinMinX, log });
if (gen.books.filter((b) => b.events[0].criteria === 'wincap').length === 0) {
  console.error(`No max-win book found in ${gen.wincapAttempts} attempts — raise --attempts.`);
  process.exit(1);
}

// Criteria probabilities: natural rates measured during generation (bonus from the exact opening-board scan).
const bonusProbability = gen.bonusTriggerRate.triggered / gen.bonusTriggerRate.boards;
const nonBonus = gen.natural.zero + gen.natural.basegame;
const zeroProbability = (gen.natural.zero / nonBonus) * (1 - bonusProbability);
const plan = { targetRtp, wincapProbability: 1 / wincapOneIn, bigwinProbability: 1 / bigwinOneIn, bonusProbability, zeroProbability };
const w = assignWeights(gen.books, plan);
log(`weights: lambda=${w.lambda.toFixed(4)} RTP=${(w.rtp * 100).toFixed(4)}% hit=${(w.hitRate * 100).toFixed(2)}% maxWin 1 in ${(1 / w.maxWinProbability).toFixed(0)}`);

// Replay verification: every max-win book and a sample of others must reproduce their payout exactly.
let verified = 0;
for (const b of gen.books) {
  const ev = b.events[0];
  if (ev.criteria !== 'wincap' && b.id % 97 !== 0) continue;
  const r = playBookRound(cfg, ev.seed, ev.weightSet, true);
  if (r.totalWin !== b.payoutMultiplier) throw new Error(`book ${b.id} replay mismatch: ${r.totalWin} != ${b.payoutMultiplier}`);
  verified++;
}
log(`replay-verified ${verified} books`);

mkdirSync(out, { recursive: true });
const books = 'books_base.jsonl.zst';
const lut = 'lookUpTable_base_0.csv';
writeFileSync(`${out}/${books}`, zstdCompressSync(Buffer.from(booksJsonl(gen.books))));
writeFileSync(`${out}/${lut}`, lookupCsv(w.rows));
writeFileSync(`${out}/index.json`, JSON.stringify({ modes: [{ name: 'base', cost: 1.0, events: books, weights: lut }] }, null, 2) + '\n');

const pm = gen.books.map((b) => b.payoutMultiplier);
const summary = {
  game: cfg.id,
  configVersion: cfg.version,
  generatedAt: new Date().toISOString(),
  baseSeed,
  mode: 'base',
  cost: 1.0,
  books: gen.books.length,
  booksByCriteria: Object.fromEntries(ALL_CRITERIA.map((c) => [c, gen.books.filter((b) => b.events[0].criteria === c).length])),
  distinctPayouts: new Set(pm).size,
  rtp: w.rtp,
  targetRtp,
  hitRate: w.hitRate,
  criteriaProbability: w.criteriaProbability,
  maxWinX: cfg.maxWinX,
  maxWinProbability: w.maxWinProbability,
  maxWinOneIn: Math.round(1 / w.maxWinProbability),
  bonusOneIn: Math.round(1 / bonusProbability),
  tiltLambda: w.lambda,
  wincapAttempts: gen.wincapAttempts,
  replayVerified: verified,
  runtimeSeconds: Math.round((Date.now() - t0) / 1000),
};
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
writeFileSync('src/config/publishedMath.json', JSON.stringify({
  rtp: Number((w.rtp * 100).toFixed(2)), maxWinX: cfg.maxWinX, maxWinOneIn: summary.maxWinOneIn, hitRate: Number((w.hitRate * 100).toFixed(2)),
  bonusOneIn: summary.bonusOneIn, books: gen.books.length, configVersion: cfg.version, generatedAt: summary.generatedAt,
}, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
