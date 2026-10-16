import type { Age, GameConfig, PayingSymbolId } from '../../config/types';
import type { Board } from '../board/board';
import type { Cluster } from '../clusters/clusters';

export function payFor(cfg: GameConfig, symbol: PayingSymbolId, size: number): number {
  const pays = cfg.paytable[symbol];
  if (size < cfg.clusters.minSize) return 0;
  return pays[Math.min(size - cfg.clusters.minSize, pays.length - 1)];
}

/**
 * Three Ages multiplier for a cluster:
 *   1 + Σ multiplierPerAge[age] over the real (non-wild) symbols, capped.
 * Wilds have no age and add nothing.
 */
export function ageMultiplier(cfg: GameConfig, board: Board, cluster: Cluster): { multiplier: number; ages: Record<Age, number> } {
  const ages: Record<Age, number> = { 0: 0, 1: 0, 2: 0 };
  let m = 1;
  for (const p of cluster.symbolPositions) {
    const a = board.cells[p]!.age;
    ages[a]++;
    m += cfg.ages.multiplierPerAge[a];
  }
  return { multiplier: Math.min(m, cfg.ages.maxClusterMultiplier), ages };
}

/** Integer award: floor(stake * pay / 100 * multiplier * stageMultiplier). */
export function clusterAward(stake: number, payX100: number, multiplier: number, stageMultiplier = 1): number {
  return Math.floor((stake * payX100 * multiplier * stageMultiplier) / 100);
}

export interface Award {
  awardId: string;
  roundId: string;
  /** Spin within the round: 0 = base spin, 1..4 = The Last Second stages. */
  spinIndex: number;
  cascadeIndex: number;
  source: 'CLUSTER';
  symbol: PayingSymbolId;
  positions: number[];
  clusterSize: number;
  stake: number;
  payX100: number;
  ageMultiplier: number;
  stageMultiplier: number;
  /** The Last Second Hour Multiplier (1 outside the bonus). */
  hourMultiplier: number;
  /** Uncapped amount. */
  rawAmount: number;
  /** Amount actually credited after cap validation. */
  amount: number;
  capApplied: boolean;
}

export class SettlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettlementError';
  }
}

/**
 * The single authoritative payout ledger for one round.
 * Rejects duplicate award ids, enforces the round cap, and settles exactly once.
 */
export class PayoutLedger {
  readonly roundId: string;
  readonly stake: number;
  readonly cap: number;
  private readonly awards: Award[] = [];
  private readonly ids = new Set<string>();
  private settled = false;
  private seq = 0;

  constructor(roundId: string, stake: number, maxWinX: number) {
    this.roundId = roundId;
    this.stake = stake;
    this.cap = stake * maxWinX;
  }

  nextAwardId(): string {
    return `${this.roundId}:A${++this.seq}`;
  }

  get total(): number {
    return this.awards.reduce((s, a) => s + a.amount, 0);
  }

  get capReached(): boolean {
    return this.total >= this.cap;
  }

  get isSettled(): boolean {
    return this.settled;
  }

  list(): readonly Award[] {
    return this.awards;
  }

  /** Records an award, truncating it to the remaining cap. Returns the stored award. */
  record(input: Omit<Award, 'amount' | 'capApplied' | 'roundId' | 'stake'>): Award {
    if (this.settled) throw new SettlementError(`round ${this.roundId} already settled; award ${input.awardId} rejected`);
    if (this.ids.has(input.awardId)) throw new SettlementError(`duplicate award id ${input.awardId}`);
    if (!input.awardId.startsWith(`${this.roundId}:`)) throw new SettlementError(`award ${input.awardId} does not belong to round ${this.roundId}`);
    const remaining = Math.max(0, this.cap - this.total);
    const amount = Math.min(input.rawAmount, remaining);
    const award: Award = { ...input, roundId: this.roundId, stake: this.stake, amount, capApplied: amount < input.rawAmount };
    this.ids.add(award.awardId);
    this.awards.push(award);
    return award;
  }

  settle(): number {
    if (this.settled) throw new SettlementError(`round ${this.roundId} already settled`);
    this.settled = true;
    return this.total;
  }
}
