import type { ClockmakerPath, GameConfig } from '../config/types';
import { GameEngine } from '../engine/GameEngine';
import { SeededRng } from '../engine/rng/rng';

export type ChoicePolicy = 'PRESERVE_PAST' | 'BREAK_FUTURE' | 'ALTERNATE' | 'RANDOM';

export interface SimulationOptions {
  cfg: GameConfig;
  seed: number;
  rounds: number;
  bet?: number;
  policy?: ChoicePolicy;
}

export const WIN_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0x', min: 0, max: 0 },
  { label: '(0,1x)', min: 1e-9, max: 1 - 1e-9 },
  { label: '[1,2x)', min: 1, max: 2 - 1e-9 },
  { label: '[2,5x)', min: 2, max: 5 - 1e-9 },
  { label: '[5,10x)', min: 5, max: 10 - 1e-9 },
  { label: '[10,25x)', min: 10, max: 25 - 1e-9 },
  { label: '[25,50x)', min: 25, max: 50 - 1e-9 },
  { label: '[50,100x)', min: 50, max: 100 - 1e-9 },
  { label: '[100,500x)', min: 100, max: 500 - 1e-9 },
  { label: '[500,1000x)', min: 500, max: 1000 - 1e-9 },
  { label: '[1000x,cap)', min: 1000, max: Number.POSITIVE_INFINITY },
];

export interface SimulationReport {
  seed: number;
  policy: ChoicePolicy;
  rounds: number;
  bet: number;
  totalStake: number;
  totalWin: number;
  rtp: number;
  rtpStdError: number;
  rtp95: [number, number];
  hitFrequency: number;
  zeroWinFrequency: number;
  avgWinOnHitX: number;
  avgPayoutPerRoundX: number;
  winDistribution: Record<string, number>;
  cascadeDistribution: Record<string, number>;
  clockmakerFrequency: number;
  clockmakerPathCounts: Record<ClockmakerPath, number>;
  bonusFrequency: number;
  bonusOneIn: number | null;
  avgBonusPayoutX: number | null;
  splitFrequency: number;
  splitsPerRound: number;
  echoActivationFrequency: number;
  echoesPerRound: number;
  echoesRecordedPerRound: number;
  dischargeFrequency: number;
  capHits: number;
  cascadeLimitHits: number;
  maxObservedWinX: number;
  maxConfiguredWinX: number;
  contribution: { base: number; bonus: number; ageMultiplierUplift: number; postTemporalEffect: number; clockmakerRounds: number };
  ageTransitions: { toFractured: number; toHollow: number; collapsesToWild: number };
  agesInWinningClusters: { original: number; fractured: number; hollow: number };
  runtimeMs: number;
  roundsPerSecond: number;
}

/** Headless, renderer-free simulation. Debt and the Echo Ledger persist across rounds exactly as in play. */
export function runSimulation(opts: SimulationOptions): SimulationReport {
  const { cfg, seed, rounds } = opts;
  const bet = opts.bet ?? cfg.defaultBet;
  const policy = opts.policy ?? 'ALTERNATE';
  // Effectively unlimited demo balance so simulation never stops for funds.
  const engine = new GameEngine(cfg, { seed, recordEvents: false, startingBalance: Number.MAX_SAFE_INTEGER / 4 });
  const policyRng = new SeededRng(seed ^ 0x5eed);
  let alt = false;
  const choose = (): ClockmakerPath => {
    if (policy === 'PRESERVE_PAST' || policy === 'BREAK_FUTURE') return policy;
    if (policy === 'RANDOM') return policyRng.next() < 0.5 ? 'PRESERVE_PAST' : 'BREAK_FUTURE';
    alt = !alt;
    return alt ? 'PRESERVE_PAST' : 'BREAK_FUTURE';
  };

  const winDist: Record<string, number> = Object.fromEntries(WIN_BUCKETS.map((b) => [b.label, 0]));
  const cascadeDist: Record<string, number> = {};
  let totalWin = 0, sumSq = 0, hits = 0, maxX = 0;
  let bonusCount = 0, bonusWinTotal = 0, clockmakerCount = 0, splitRounds = 0, splits = 0;
  let echoRounds = 0, echoes = 0, echoesRecorded = 0, dischargeRounds = 0, capHits = 0, cascadeLimitHits = 0;
  let baseWin = 0, ageUplift = 0, postTemporal = 0, clockmakerWins = 0;
  const pathCounts: Record<ClockmakerPath, number> = { PRESERVE_PAST: 0, BREAK_FUTURE: 0 };
  let toF = 0, toH = 0, coll = 0, aO = 0, aF = 0, aH = 0;

  const t0 = performance.now();
  for (let i = 0; i < rounds; i++) {
    const r = engine.playRound(bet, choose);
    const x = r.totalWin / bet;
    totalWin += r.totalWin;
    sumSq += x * x;
    if (r.totalWin > 0) hits++;
    if (x > maxX) maxX = x;
    const bucket = WIN_BUCKETS.find((b) => x >= b.min && x <= b.max) ?? WIN_BUCKETS[WIN_BUCKETS.length - 1];
    winDist[bucket.label]++;
    const ck = r.stats.winningCascades >= 10 ? '10+' : String(r.stats.winningCascades);
    cascadeDist[ck] = (cascadeDist[ck] ?? 0) + 1;
    baseWin += r.baseWin;
    if (r.stats.bonus) {
      bonusCount++;
      bonusWinTotal += r.bonusWin;
    }
    if (r.stats.clockmaker) {
      clockmakerCount++;
      pathCounts[r.stats.clockmaker]++;
      clockmakerWins += r.totalWin;
    }
    if (r.stats.splits) splitRounds++;
    splits += r.stats.splits;
    if (r.stats.echoesProjected) echoRounds++;
    echoes += r.stats.echoesProjected;
    echoesRecorded += r.stats.echoesRecorded;
    if (r.stats.discharges) dischargeRounds++;
    if (r.stats.capped) capHits++;
    if (r.stats.cascadeLimitHit) cascadeLimitHits++;
    ageUplift += r.stats.ageUplift;
    postTemporal += r.stats.postTemporalWins;
    toF += r.stats.toFractured;
    toH += r.stats.toHollow;
    coll += r.stats.collapsesToWild;
    aO += r.stats.agesInWins[0];
    aF += r.stats.agesInWins[1];
    aH += r.stats.agesInWins[2];
  }
  const runtimeMs = performance.now() - t0;
  const totalStake = bet * rounds;
  const rtp = totalWin / totalStake;
  const meanX = rtp;
  const variance = Math.max(0, sumSq / rounds - meanX * meanX);
  const se = Math.sqrt(variance / rounds);
  const share = (v: number) => (totalWin ? v / totalWin : 0);
  return {
    seed, policy, rounds, bet, totalStake, totalWin, rtp, rtpStdError: se, rtp95: [rtp - 1.96 * se, rtp + 1.96 * se],
    hitFrequency: hits / rounds, zeroWinFrequency: 1 - hits / rounds,
    avgWinOnHitX: hits ? totalWin / bet / hits : 0, avgPayoutPerRoundX: totalWin / bet / rounds,
    winDistribution: winDist, cascadeDistribution: cascadeDist,
    clockmakerFrequency: clockmakerCount / rounds, clockmakerPathCounts: pathCounts,
    bonusFrequency: bonusCount / rounds, bonusOneIn: bonusCount ? rounds / bonusCount : null,
    avgBonusPayoutX: bonusCount ? bonusWinTotal / bet / bonusCount : null,
    splitFrequency: splitRounds / rounds, splitsPerRound: splits / rounds,
    echoActivationFrequency: echoRounds / rounds, echoesPerRound: echoes / rounds, echoesRecordedPerRound: echoesRecorded / rounds,
    dischargeFrequency: dischargeRounds / rounds, capHits, cascadeLimitHits,
    maxObservedWinX: maxX, maxConfiguredWinX: cfg.maxWinX,
    contribution: {
      base: share(baseWin), bonus: share(bonusWinTotal), ageMultiplierUplift: share(ageUplift),
      postTemporalEffect: share(postTemporal), clockmakerRounds: share(clockmakerWins),
    },
    ageTransitions: { toFractured: toF, toHollow: toH, collapsesToWild: coll },
    agesInWinningClusters: { original: aO, fractured: aF, hollow: aH },
    runtimeMs, roundsPerSecond: rounds / (runtimeMs / 1000),
  };
}
