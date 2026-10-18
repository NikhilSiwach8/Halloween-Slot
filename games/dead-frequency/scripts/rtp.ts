/**
 * Low-variance RTP estimate for every mode of DEAD FREQUENCY.
 *
 *   npm run df:rtp -- --rounds 2000000 --bonusRounds 400000
 *
 * A paid spin's RTP is split into three independent parts:
 *   1. the spin win and Mystery cash, measured over many spins with bonuses not played;
 *   2. the probability of each bonus (Antenna counts are exact from the config; Mystery prizes
 *      are exact from the prize table);
 *   3. each bonus's mean win, measured by simulating the bonus on its own.
 * Their sum has far lower variance than simulating whole rounds, because the bonus tail is
 * sampled hundreds of thousands of times instead of a few thousand.
 */
import { DEFAULT_CONFIG, MODE_ORDER } from '../src/config/gameConfig';
import type { BonusType, GameConfig, ModeId } from '../src/config/types';
import { SeededRng } from '../src/engine/rng';
import { Cap, bonusForAntennas, playBonus, playSpinOnly } from '../src/engine/round';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const rounds = Number(arg('rounds', '1000000'));
const bonusRounds = Number(arg('bonusRounds', '200000'));
const seed = Number(arg('seed', '7'));
const cfg: GameConfig = DEFAULT_CONFIG;
const pct = (v: number, d = 3) => `${(v * 100).toFixed(d)}%`;

function bonusStats(type: BonusType) {
  const rng = new SeededRng(seed ^ type.length * 7919);
  let sum = 0;
  let sumSq = 0;
  let caps = 0;
  for (let i = 0; i < bonusRounds; i++) {
    const cap = new Cap(cfg.maxWinX * 100);
    const x = playBonus(cfg, type, 'BUY', rng, cap).winX100 / 100;
    sum += x;
    sumSq += x * x;
    if (cap.capped) caps++;
  }
  const mean = sum / bonusRounds;
  return { mean, se: Math.sqrt((sumSq / bonusRounds - mean * mean) / bonusRounds), capOneIn: caps ? bonusRounds / caps : null };
}

const bonus = {} as Record<BonusType, ReturnType<typeof bonusStats>>;
for (const t of Object.keys(cfg.bonuses) as BonusType[]) {
  bonus[t] = bonusStats(t);
  const b = bonus[t];
  console.log(`${t.padEnd(12)} mean ${b.mean.toFixed(2)}x ±${(1.96 * b.se).toFixed(2)}  max win 1 in ${b.capOneIn?.toFixed(0) ?? '—'} bonuses`);
}

const mysteryTotal = cfg.mystery.prizes.reduce((a, p) => a + p.weight, 0);
const mysteryBonusP = (t: BonusType) => cfg.mystery.prizes.reduce((a, p) => a + (p.value.kind === 'BONUS' && p.value.bonus === t ? p.weight : 0), 0) / mysteryTotal;

for (const mode of MODE_ORDER as ModeId[]) {
  const def = cfg.modes[mode];
  if (def.kind === 'buy') {
    const b = bonus[def.bonus!];
    console.log(`${mode.padEnd(16)} RTP ${pct(b.mean / def.cost)} ±${pct((1.96 * b.se) / def.cost)}`);
    continue;
  }
  const p = cfg.profiles[def.profile!];
  const rng = new SeededRng(seed);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < rounds; i++) {
    const x = playSpinOnly(cfg, def.profile!, rng).winX100 / 100;
    sum += x;
    sumSq += x * x;
  }
  const spinMean = sum / rounds;
  const spinSe = Math.sqrt((sumSq / rounds - spinMean * spinMean) / rounds);
  const total = p.antennaCount.reduce((a, e) => a + e.weight, 0);
  let bonusEv = 0;
  let bonusSe2 = 0;
  for (const e of p.antennaCount) {
    const t = bonusForAntennas(cfg, e.value);
    if (!t) continue;
    bonusEv += (e.weight / total) * bonus[t].mean;
    bonusSe2 += ((e.weight / total) * bonus[t].se) ** 2;
  }
  let mysteryEv = 0;
  for (const t of Object.keys(cfg.bonuses) as BonusType[]) {
    mysteryEv += p.tapeChance * mysteryBonusP(t) * bonus[t].mean;
    bonusSe2 += (p.tapeChance * mysteryBonusP(t) * bonus[t].se) ** 2;
  }
  const rtp = (spinMean + bonusEv + mysteryEv) / def.cost;
  const se = Math.sqrt(spinSe ** 2 + bonusSe2) / def.cost;
  console.log(
    `${mode.padEnd(16)} RTP ${pct(rtp)} ±${pct(1.96 * se)}  (spin+mystery cash ${pct(spinMean / def.cost, 2)}, antenna bonuses ${pct(bonusEv / def.cost, 2)}, mystery bonuses ${pct(mysteryEv / def.cost, 2)})`,
  );
}
