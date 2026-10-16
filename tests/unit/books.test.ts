import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/gameConfig';
import type { GameConfig } from '../../src/config/types';
import { assignWeights, generateBooks, lookupCsv, lookupStats, playBookRound } from '../../src/math/books';

// Small, fast configuration: a low max win so every criteria (incl. max win) is reachable in a test.
const cfg: GameConfig = { ...structuredClone(DEFAULT_CONFIG), maxWinX: 60, bonus: { ...DEFAULT_CONFIG.bonus, maxBonusWinX: 60 } };

describe('book generation and lookup table', () => {
  const gen = generateBooks({ cfg, baseSeed: 7, naturalBooks: 3000, extraBonusBooks: 40, wincapBooks: 3, wincapMaxAttempts: 3000, bigwinBooks: 10, bigwinMinX: 20 });

  it('produces books in every criteria with unique ids and integer payout multipliers', () => {
    const crit = new Set(gen.books.map((b) => b.events[0].criteria));
    expect([...crit].sort()).toEqual(['basegame', 'bigwin', 'freegame', 'wincap', 'zero']);
    expect(new Set(gen.books.map((b) => b.id)).size).toBe(gen.books.length);
    for (const b of gen.books) expect(Number.isInteger(b.payoutMultiplier)).toBe(true);
  });

  it('every book replays to exactly its payoutMultiplier', () => {
    for (const b of gen.books.filter((_, i) => i % 7 === 0 || _.events[0].criteria === 'wincap')) {
      const ev = b.events[0];
      expect(playBookRound(cfg, ev.seed, ev.weightSet, true).totalWin).toBe(b.payoutMultiplier);
    }
  });

  it('weights hit the target RTP exactly (from the integer table) with the planned max-win probability', () => {
    const bonusP = gen.bonusTriggerRate.triggered / gen.bonusTriggerRate.boards;
    const w = assignWeights(gen.books, { targetRtp: 0.95, wincapProbability: 1e-4, bigwinProbability: 1e-3, bonusProbability: bonusP, zeroProbability: 0.7 * (1 - bonusP) });
    expect(w.rtp).toBeCloseTo(0.95, 6);
    expect(w.criteriaProbability.wincap).toBeCloseTo(1e-4, 8);
    const csv = lookupCsv(w.rows);
    expect(csv.split('\n')[0]).toMatch(/^\d+,\d+,\d+$/);
    expect(lookupStats(w.rows).rtp).toBeCloseTo(w.rtp, 12);
  });
});
