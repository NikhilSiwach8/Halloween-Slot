import type { BonusType, GameConfig, ModeId } from '../config/types';
import { playRound } from '../engine/round';
import { SeededRng } from '../engine/rng';

export interface ModeReport {
  mode: ModeId;
  seed: number;
  rounds: number;
  cost: number;
  rtp: number;
  rtpStdError: number;
  hitFrequency: number;
  /** Rounds that started any bonus. */
  bonusFrequency: number;
  bonusCounts: Record<BonusType, number>;
  avgBonusWinX: Record<BonusType, number | null>;
  mysteryFrequency: number;
  retuneFrequency: number;
  capHits: number;
  maxObservedWinX: number;
  /** Share of RTP paid by the paid spin, Mystery cash and bonuses. */
  contribution: { spin: number; mysteryCash: number; bonus: number };
  winDistribution: Record<string, number>;
  runtimeMs: number;
}

export const WIN_BUCKETS: { label: string; min: number }[] = [
  { label: '0x', min: 0 },
  { label: '(0,1x)', min: 1e-9 },
  { label: '[1,5x)', min: 1 },
  { label: '[5,20x)', min: 5 },
  { label: '[20,100x)', min: 20 },
  { label: '[100,500x)', min: 100 },
  { label: '[500,2000x)', min: 500 },
  { label: '[2000,10000x)', min: 2000 },
  { label: '[10000x,cap)', min: 10000 },
  { label: 'cap', min: Number.POSITIVE_INFINITY },
];

/** Headless simulation of independent rounds of one mode. */
export function simulateMode(cfg: GameConfig, mode: ModeId, rounds: number, seed: number): ModeReport {
  const t0 = performance.now();
  const rng = new SeededRng(seed);
  const cost = cfg.modes[mode].cost;
  let sum = 0;
  let sumSq = 0;
  let hits = 0;
  let bonusRounds = 0;
  let mysteries = 0;
  let retunes = 0;
  let spins = 0;
  let capHits = 0;
  let maxX = 0;
  const contribution = { spin: 0, mysteryCash: 0, bonus: 0 };
  const bonusCounts: Record<BonusType, number> = { NIGHT_SHIFT: 0, POSSESSION: 0, DEAD_AIR: 0 };
  const bonusWins: Record<BonusType, number> = { NIGHT_SHIFT: 0, POSSESSION: 0, DEAD_AIR: 0 };
  const dist: Record<string, number> = Object.fromEntries(WIN_BUCKETS.map((b) => [b.label, 0]));
  for (let i = 0; i < rounds; i++) {
    const r = playRound(cfg, mode, rng);
    const x = r.winX100 / 100;
    sum += x;
    sumSq += x * x;
    if (x > 0) hits++;
    if (x > maxX) maxX = x;
    if (r.capped) capHits++;
    if (r.bonuses.length) bonusRounds++;
    if (r.mystery) mysteries++;
    contribution.spin += (r.spin?.winX100 ?? 0) / 100;
    contribution.mysteryCash += (r.mystery?.winX100 ?? 0) / 100;
    for (const b of r.bonuses) {
      bonusCounts[b.type]++;
      bonusWins[b.type] += b.winX100 / 100;
      contribution.bonus += b.winX100 / 100;
    }
    const all = [...(r.spin ? [r.spin] : []), ...r.bonuses.flatMap((b) => b.spins)];
    spins += all.length;
    for (const s of all) if (s.reveal?.retunedTo) retunes++;
    let label = r.capped ? 'cap' : '0x';
    if (!r.capped) for (const b of WIN_BUCKETS) if (x >= b.min && (b.min > 0 || x === 0)) label = b.label;
    dist[label]++;
  }
  const mean = sum / rounds;
  const variance = sumSq / rounds - mean * mean;
  const avgBonusWinX = Object.fromEntries(
    (Object.keys(bonusCounts) as BonusType[]).map((k) => [k, bonusCounts[k] ? bonusWins[k] / bonusCounts[k] : null]),
  ) as Record<BonusType, number | null>;
  return {
    mode,
    seed,
    rounds,
    cost,
    rtp: mean / cost,
    rtpStdError: Math.sqrt(Math.max(variance, 0) / rounds) / cost,
    hitFrequency: hits / rounds,
    bonusFrequency: bonusRounds / rounds,
    bonusCounts,
    avgBonusWinX,
    mysteryFrequency: mysteries / rounds,
    retuneFrequency: spins ? retunes / spins : 0,
    capHits,
    maxObservedWinX: maxX,
    contribution: { spin: contribution.spin / sum, mysteryCash: contribution.mysteryCash / sum, bonus: contribution.bonus / sum },
    winDistribution: dist,
    runtimeMs: performance.now() - t0,
  };
}
