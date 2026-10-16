import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/gameConfig';
import { boardFromSymbols } from '../../src/engine/board/board';
import { findClusters } from '../../src/engine/clusters/clusters';
import { grid } from './helpers';

const uids = () => {
  let u = 0;
  return { nextUid: () => ++u };
};
const board = (rows: string) => boardFromSymbols(uids(), 5, 5, grid(rows));

describe('cluster detection', () => {
  it('finds a known 5-cell orthogonal cluster', () => {
    const b = board(`
      c c c k m
      k m c n w
      n w c o p
      h r s k m
      n w o p h`);
    const cl = findClusters(b, DEFAULT_CONFIG);
    expect(cl).toHaveLength(1);
    expect(cl[0].symbol).toBe('L_COG');
    expect(cl[0].positions).toEqual([0, 1, 2, 7, 12]);
  });

  it('a non-winning board produces no clusters', () => {
    const b = board(`
      c k m n w
      k m n w c
      m n w c k
      n w c k m
      w c k m n`);
    expect(findClusters(b, DEFAULT_CONFIG)).toEqual([]);
  });

  it('does not connect diagonally', () => {
    const b = board(`
      c k c k c
      k c k c k
      c k c k c
      m n m n m
      n m n m n`);
    expect(findClusters(b, DEFAULT_CONFIG)).toEqual([]);
  });

  it('4 connected symbols are below the minimum size', () => {
    const b = board(`
      c c c c k
      k m n w m
      m n w k n
      n w k m w
      w k m n k`);
    expect(findClusters(b, DEFAULT_CONFIG)).toEqual([]);
  });

  it('wilds substitute and complete a cluster', () => {
    const b = board(`
      c c * c k
      c m n w m
      m n w k n
      n w k m w
      w k m n k`);
    const cl = findClusters(b, DEFAULT_CONFIG);
    expect(cl).toHaveLength(1);
    expect(cl[0].wildPositions).toEqual([2]);
    expect(cl[0].symbolPositions).toEqual([0, 1, 3, 5]);
  });

  it('a wild connects two otherwise separate groups of the same symbol', () => {
    const b = board(`
      c c * c c
      k m n w m
      m n w k n
      n w k m w
      w k m n k`);
    const cl = findClusters(b, DEFAULT_CONFIG);
    expect(cl).toHaveLength(1);
    expect(cl[0].positions).toEqual([0, 1, 2, 3, 4]);
  });

  it('wild-only clusters do not pay', () => {
    // five connected wilds fenced in by tickets: no paying symbol touches them
    const b = board(`
      * * * t c
      * * t k m
      t t w n o
      m n o w k
      c k m n w`);
    expect(findClusters(b, DEFAULT_CONFIG)).toEqual([]);
  });

  it('a wild may belong to clusters of two different symbols', () => {
    const b = board(`
      c c * k k
      c n * w k
      s m * o k
      r p h r s
      w s c p n`);
    const cl = findClusters(b, DEFAULT_CONFIG);
    const syms = cl.map((c) => c.symbol).sort();
    expect(syms).toEqual(['L_COG', 'L_KEY']);
    for (const c of cl) expect(c.wildPositions).toEqual([2, 7, 12]);
  });

  it('tickets and the clockmaker never participate', () => {
    const b = board(`
      c c t c c
      k x n w m
      m n w k n
      n w k m w
      w k m n k`);
    expect(findClusters(b, DEFAULT_CONFIG)).toEqual([]);
  });

  it('evaluation is deterministic and ordered highest symbol first', () => {
    const b = board(`
      s s s s s
      c c c c c
      m n w k n
      n w k m w
      w k m n k`);
    const a = findClusters(b, DEFAULT_CONFIG);
    expect(a.map((c) => c.symbol)).toEqual(['SKULL', 'L_COG']);
    expect(findClusters(b, DEFAULT_CONFIG)).toEqual(a);
  });
});
