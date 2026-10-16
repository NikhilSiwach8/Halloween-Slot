/**
 * Headless simulator CLI.
 *
 *   npm run simulate -- --rounds 200000 --seeds 1,2,3 --policy ALTERNATE --bet 100 [--json out.json]
 *
 * Prints only values measured by this run. Simulated RTP is an estimate with a
 * stated standard error, not a certified or validated figure.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_CONFIG, SESSION_CONFIG } from '../src/config/gameConfig';
import { runSimulation, type ChoicePolicy, type SimulationReport } from '../src/simulation/simulator';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const rounds = Number(arg('rounds', '100000'));
const seeds = arg('seeds', '1,2,3').split(',').map(Number);
const policies = arg('policy', 'ALTERNATE').split(',') as ChoicePolicy[];
const bet = Number(arg('bet', String(DEFAULT_CONFIG.defaultBet)));
const jsonOut = arg('json', '');
const profile = arg('profile', 'default');
const cfg = profile === 'session' ? SESSION_CONFIG : DEFAULT_CONFIG;

const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
const reports: SimulationReport[] = [];

for (const policy of policies) {
  for (const seed of seeds) {
    const r = runSimulation({ cfg, seed, rounds, bet, policy });
    reports.push(r);
    console.log(`\n=== ${cfg.id} | seed ${seed} | policy ${policy} | ${rounds.toLocaleString()} rounds | bet ${bet} units ===`);
    console.log(`RTP (observed)        ${pct(r.rtp, 3)}  ±${pct(1.96 * r.rtpStdError, 3)} (95% CI ${pct(r.rtp95[0])} – ${pct(r.rtp95[1])})`);
    console.log(`Hit frequency         ${pct(r.hitFrequency)}   zero-win ${pct(r.zeroWinFrequency)}`);
    console.log(`Avg win on hit        ${r.avgWinOnHitX.toFixed(3)}x   avg payout/round ${r.avgPayoutPerRoundX.toFixed(4)}x`);
    console.log(`Last Second           ${pct(r.bonusFrequency, 3)} (1 in ${r.bonusOneIn?.toFixed(0) ?? '—'})  avg bonus ${r.avgBonusPayoutX?.toFixed(2) ?? '—'}x`);
    console.log(`Clockmaker's Choice   ${pct(r.clockmakerFrequency, 3)}  paths ${JSON.stringify(r.clockmakerPathCounts)}`);
    console.log(`Paradox Split         ${pct(r.splitFrequency)} of rounds (${r.splitsPerRound.toFixed(4)}/round)`);
    console.log(`Echo activations      ${pct(r.echoActivationFrequency)} of rounds (${r.echoesPerRound.toFixed(4)} projected, ${r.echoesRecordedPerRound.toFixed(4)} recorded /round)`);
    console.log(`Debt Discharge        ${pct(r.dischargeFrequency, 3)} of rounds`);
    console.log(`Max observed win      ${r.maxObservedWinX.toFixed(2)}x   (configured cap ${r.maxConfiguredWinX}x, cap hits ${r.capHits}, cascade-limit hits ${r.cascadeLimitHits})`);
    console.log(`Contribution          base ${pct(r.contribution.base)} | bonus ${pct(r.contribution.bonus)} | age-multiplier uplift ${pct(r.contribution.ageMultiplierUplift)} | post-temporal-effect wins ${pct(r.contribution.postTemporalEffect)} | clockmaker rounds ${pct(r.contribution.clockmakerRounds)}`);
    console.log(`Age transitions       ->Fractured ${r.ageTransitions.toFractured}  ->Hollow ${r.ageTransitions.toHollow}  ->Wild ${r.ageTransitions.collapsesToWild}`);
    console.log(`Ages in wins          Original ${r.agesInWinningClusters.original}  Fractured ${r.agesInWinningClusters.fractured}  Hollow ${r.agesInWinningClusters.hollow}`);
    console.log(`Win distribution      ${Object.entries(r.winDistribution).map(([k, v]) => `${k}:${pct(v / r.rounds, 3)}`).join('  ')}`);
    console.log(`Cascade distribution  ${Object.entries(r.cascadeDistribution).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([k, v]) => `${k}:${pct(v / r.rounds, 2)}`).join('  ')}`);
    console.log(`Runtime               ${(r.runtimeMs / 1000).toFixed(1)}s (${r.roundsPerSecond.toFixed(0)} rounds/s)`);
  }
}

if (reports.length > 1) {
  const totalStake = reports.reduce((s, r) => s + r.totalStake, 0);
  const totalWin = reports.reduce((s, r) => s + r.totalWin, 0);
  console.log(`\nPooled across ${reports.length} runs (${(reports.length * rounds).toLocaleString()} rounds): RTP ${pct(totalWin / totalStake, 3)}; per-run spread ${pct(Math.min(...reports.map((r) => r.rtp)))} – ${pct(Math.max(...reports.map((r) => r.rtp)))}`);
}
console.log('\nNote: simulated estimates from a development PRNG. Not a certified RTP, volatility rating or RNG.');

if (jsonOut) {
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify({ config: { id: cfg.id, version: cfg.version }, generatedAt: new Date().toISOString(), reports }, null, 2));
  console.log(`Wrote ${jsonOut}`);
}
