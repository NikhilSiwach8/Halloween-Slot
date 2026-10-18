/**
 * DEAD FREQUENCY headless simulator.
 *
 *   npm run df:simulate -- --modes BASE,DOUBLE_CHANCE --rounds 1000000 --seeds 1,2 [--json out.json]
 *
 * Prints only values measured by this run. RTP is an estimate with a stated standard error.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_CONFIG, MODE_ORDER } from '../src/config/gameConfig';
import type { ModeId } from '../src/config/types';
import { simulateMode, type ModeReport } from '../src/simulation/simulator';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const modes = (arg('modes', MODE_ORDER.join(',')).split(',') as ModeId[]);
const rounds = Number(arg('rounds', '200000'));
const seeds = arg('seeds', '1').split(',').map(Number);
const jsonOut = arg('json', '');
const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
const oneIn = (f: number) => (f > 0 ? `1 in ${(1 / f).toFixed(0)}` : '—');
const reports: ModeReport[] = [];

for (const mode of modes) {
  for (const seed of seeds) {
    const r = simulateMode(DEFAULT_CONFIG, mode, rounds, seed);
    reports.push(r);
    console.log(`\n=== ${mode} | cost ${r.cost}x | seed ${seed} | ${rounds.toLocaleString()} rounds | ${(r.runtimeMs / 1000).toFixed(1)}s ===`);
    console.log(`RTP            ${pct(r.rtp, 3)} ±${pct(1.96 * r.rtpStdError, 3)} (95%)`);
    console.log(`Hit frequency  ${pct(r.hitFrequency)}   max observed ${r.maxObservedWinX.toFixed(2)}x   cap hits ${r.capHits}`);
    console.log(`Bonus rounds   ${pct(r.bonusFrequency, 3)} (${oneIn(r.bonusFrequency)})   Mystery ${pct(r.mysteryFrequency, 3)} (${oneIn(r.mysteryFrequency)})`);
    for (const k of Object.keys(r.bonusCounts) as (keyof typeof r.bonusCounts)[]) {
      const avg = r.avgBonusWinX[k];
      console.log(`  ${k.padEnd(12)} ${String(r.bonusCounts[k]).padStart(8)}  avg ${avg === null ? '—' : avg.toFixed(2) + 'x'}`);
    }
    console.log(`Retune         ${pct(r.retuneFrequency)} of spins`);
    console.log(`Contribution   spin ${pct(r.contribution.spin, 1)}  mystery cash ${pct(r.contribution.mysteryCash, 1)}  bonus ${pct(r.contribution.bonus, 1)}`);
    console.log(`Distribution   ${Object.entries(r.winDistribution).map(([k, v]) => `${k}:${pct(v / rounds, 3)}`).join('  ')}`);
  }
}

if (jsonOut) {
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify({ config: DEFAULT_CONFIG.id, version: DEFAULT_CONFIG.version, reports }, null, 2));
  console.log(`\nwrote ${jsonOut}`);
}
