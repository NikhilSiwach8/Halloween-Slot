import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/gameConfig';
import { boardFromSymbols } from '../../src/engine/board/board';
import { findClusters } from '../../src/engine/clusters/clusters';
import { PayoutLedger, SettlementError, ageMultiplier, clusterAward, payFor } from '../../src/engine/payouts/payouts';
import { grid } from './helpers';

const award = (ledger: PayoutLedger, raw: number, id = ledger.nextAwardId()) =>
  ledger.record({ awardId: id, spinIndex: 0, cascadeIndex: 0, source: 'CLUSTER', symbol: 'L_COG', positions: [0], clusterSize: 5, payX100: 100, ageMultiplier: 1, stageMultiplier: 1, rawAmount: raw });

describe('paytable and multipliers', () => {
  it('looks up pay by cluster size and clamps to the last tier', () => {
    const pays = DEFAULT_CONFIG.paytable.SKULL;
    expect(payFor(DEFAULT_CONFIG, 'SKULL', 4)).toBe(0);
    expect(payFor(DEFAULT_CONFIG, 'SKULL', 5)).toBe(pays[0]);
    expect(payFor(DEFAULT_CONFIG, 'SKULL', 7)).toBe(pays[2]);
    expect(payFor(DEFAULT_CONFIG, 'SKULL', 25)).toBe(pays[pays.length - 1]);
  });

  it('awards are integers in stake units', () => {
    expect(clusterAward(20, 125, 1)).toBe(25);
    expect(clusterAward(20, 125, 3, 2)).toBe(150);
    expect(Number.isInteger(clusterAward(50, 333, 7, 1))).toBe(true);
  });

  it('Three Ages multiplier counts real symbols only and is capped', () => {
    let u = 0;
    const b = boardFromSymbols({ nextUid: () => ++u }, 5, 5, grid(`
      c c * c c
      k m n w m
      m n w k n
      n w k m w
      w k m n k`), [2, 1, 0, 2, 2, ...Array(20).fill(0)]);
    const [cl] = findClusters(b, DEFAULT_CONFIG);
    const { multiplier, ages } = ageMultiplier(DEFAULT_CONFIG, b, cl);
    expect(ages).toEqual({ 0: 0, 1: 1, 2: 3 });
    expect(multiplier).toBe(Math.min(1 + 1 + 2 * 3, DEFAULT_CONFIG.ages.maxClusterMultiplier));
  });
});

describe('payout ledger', () => {
  it('rejects duplicate award ids', () => {
    const l = new PayoutLedger('R9', 100, 5000);
    award(l, 50, 'R9:A1');
    expect(() => award(l, 50, 'R9:A1')).toThrow(SettlementError);
    expect(l.total).toBe(50);
  });

  it('rejects awards from another round', () => {
    const l = new PayoutLedger('R9', 100, 5000);
    expect(() => award(l, 50, 'R8:A1')).toThrow(/does not belong/);
  });

  it('enforces the payout cap', () => {
    const l = new PayoutLedger('R1', 100, 10); // cap 1000 units
    const a1 = award(l, 700);
    const a2 = award(l, 700);
    expect(a1.amount).toBe(700);
    expect(a2.amount).toBe(300);
    expect(a2.capApplied).toBe(true);
    expect(l.capReached).toBe(true);
    expect(award(l, 5).amount).toBe(0);
  });

  it('settles exactly once', () => {
    const l = new PayoutLedger('R1', 100, 10);
    award(l, 40);
    expect(l.settle()).toBe(40);
    expect(() => l.settle()).toThrow(SettlementError);
    expect(() => award(l, 1)).toThrow(SettlementError);
  });
});
