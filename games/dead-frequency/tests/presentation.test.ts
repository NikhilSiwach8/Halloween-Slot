import { describe, expect, it } from 'vitest';
import type { SymbolId } from '../src/config/types';
import { REEL_STAGGER, TEASE_MS, TURBO_FACTOR, reelStops, winTier } from '../src/app/useGame';

const board = (cols: SymbolId[][]) => cols.map((c) => c.map((s) => ({ s, m: 1 })));
const plain: SymbolId[] = ['HOST', 'MIC', 'RADIO', 'VALVE'];

describe('win celebration tiers', () => {
  it('picks the highest tier reached, and MAX only when the round was capped', () => {
    expect(winTier(999, false)).toBeNull();
    expect(winTier(1000, false)).toBe('GOOD');
    expect(winTier(4999, false)).toBe('GOOD');
    expect(winTier(5000, false)).toBe('MEGA');
    expect(winTier(20000, false)).toBe('INSANE');
    expect(winTier(100000, false)).toBe('EPIC');
    expect(winTier(4_999_900, false)).toBe('EPIC');
    expect(winTier(5_000_000, true)).toBe('MAX');
  });
});

describe('reel stops', () => {
  it('stops reels left to right, REEL_STAGGER apart, without Antennas', () => {
    const { delays, tease } = reelStops(board(Array(6).fill(plain)), false);
    expect(delays).toEqual([0, 1, 2, 3, 4, 5].map((r) => r * REEL_STAGGER));
    expect(tease.some(Boolean)).toBe(false);
  });

  it('teases every reel after the second Antenna has landed', () => {
    const cols = Array(6).fill(plain);
    cols[0] = ['ANTENNA', 'MIC', 'RADIO', 'VALVE'];
    cols[2] = ['HOST', 'ANTENNA', 'RADIO', 'VALVE'];
    const { delays, tease } = reelStops(board(cols), false);
    expect(tease).toEqual([false, false, false, true, true, true]);
    expect(delays[2]).toBe(2 * REEL_STAGGER);
    expect(delays[3]).toBe(3 * REEL_STAGGER + TEASE_MS);
    expect(delays[5]).toBe(5 * REEL_STAGGER + 3 * TEASE_MS);
    const turbo = reelStops(board(cols), true);
    expect(turbo.delays[5]).toBeCloseTo(delays[5] * TURBO_FACTOR);
  });
});
