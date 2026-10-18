import type { BoardProfile, GameConfig, PayingSymbolId, SymbolId } from '../config/types';
import { pickWeighted, sampleDistinct, weightedPick, type Rng } from './rng';

/** One cell. `m` is the multiplier of an On Air wild (1 for every other symbol). */
export interface Cell {
  s: SymbolId;
  m: number;
}

/** board[reel][row], reel 0 = leftmost. */
export type Board = Cell[][];

export interface GenerateOptions {
  /** Possession: positions that hold a Sticky Static from an earlier spin. */
  sticky?: boolean[][];
  /** Dead Air: a reel with any Static becomes fully Static. */
  expandStatic?: boolean;
}

const cell = (s: SymbolId, m = 1): Cell => ({ s, m });

export function cloneBoard(b: Board): Board {
  return b.map((reel) => reel.map((c) => ({ ...c })));
}

export function positionsOf(b: Board, s: SymbolId): [number, number][] {
  const out: [number, number][] = [];
  b.forEach((reel, r) => reel.forEach((c, row) => c.s === s && out.push([r, row])));
  return out;
}

export function countSymbol(b: Board, s: SymbolId): number {
  let n = 0;
  for (const reel of b) for (const c of reel) if (c.s === s) n++;
  return n;
}

/**
 * Draws a board for one spin. Order per reel: Sticky Static, natural Static stack,
 * guaranteed Static reels, Static expansion, ordinary symbols. Then the
 * Antennas (a weighted count, each on a different reel) and the reel-6 Tape go on cells that are
 * not Static. Guaranteed wilds are placed last.
 */
export function generateBoard(cfg: GameConfig, p: BoardProfile, rng: Rng, opts: GenerateOptions = {}): Board {
  const { reels, rows } = cfg;
  const fullStatic = new Set<number>();
  if (p.guaranteedStaticReels) {
    const n = pickWeighted(rng, p.guaranteedStaticReels);
    for (const r of sampleDistinct(rng, [...Array(reels).keys()], n)) fullStatic.add(r);
  }
  const reel0Weights = { ...p.symbolWeights, WILD: 0 };
  const board: Board = [];
  for (let r = 0; r < reels; r++) {
    const col: (Cell | null)[] = Array(rows).fill(null);
    if (opts.sticky) for (let row = 0; row < rows; row++) if (opts.sticky[r]?.[row]) col[row] = cell('STATIC');
    if (rng.next() < p.staticChance[r]) {
      const h = pickWeighted(rng, p.staticHeight);
      const start = rng.int(rows - h + 1);
      for (let row = start; row < start + h; row++) col[row] = cell('STATIC');
    }
    const hasStatic = col.some((c) => c?.s === 'STATIC');
    if (fullStatic.has(r) || (opts.expandStatic && hasStatic)) for (let row = 0; row < rows; row++) col[row] = cell('STATIC');
    const weights = r === 0 ? reel0Weights : p.symbolWeights;
    for (let row = 0; row < rows; row++) {
      if (col[row]) continue;
      const above = row > 0 ? col[row - 1]!.s : null;
      if (above && above !== 'STATIC' && above !== 'WILD' && rng.next() < p.stackChance) {
        col[row] = cell(above);
        continue;
      }
      const s = weightedPick(rng, weights) as PayingSymbolId | 'WILD';
      col[row] = s === 'WILD' ? cell('WILD', pickWeighted(rng, p.wildMultipliers)) : cell(s);
    }
    board.push(col as Cell[]);
  }
  const free = (r: number) => board[r].flatMap((c, row) => (c.s === 'STATIC' || c.s === 'ANTENNA' ? [] : [row]));
  const antennas = pickWeighted(rng, p.antennaCount);
  if (antennas > 0) {
    const candidates = [...Array(reels).keys()].filter((r) => free(r).length > 0);
    for (const r of sampleDistinct(rng, candidates, antennas)) {
      const f = free(r);
      board[r][f[rng.int(f.length)]] = cell('ANTENNA');
    }
  }
  if (p.tapeChance > 0 && rng.next() < p.tapeChance) {
    const f = free(reels - 1);
    if (f.length) board[reels - 1][f[rng.int(f.length)]] = cell('TAPE');
  }
  if (p.guaranteedWilds) {
    const n = pickWeighted(rng, p.guaranteedWilds.count);
    const spots: [number, number][] = [];
    for (let r = 1; r < reels; r++) for (let row = 0; row < rows; row++) if (board[r][row].s !== 'STATIC') spots.push([r, row]);
    for (const [r, row] of sampleDistinct(rng, spots, n)) board[r][row] = cell('WILD', pickWeighted(rng, p.guaranteedWilds.multipliers));
  }
  return board;
}

/** Test / dev helper: builds a board from rows of symbol ids (rows top to bottom). `W5` = wild x5. */
export function boardFromRows(rows: string[][]): Board {
  const reels = rows[0].length;
  const b: Board = [];
  for (let r = 0; r < reels; r++) {
    b.push(rows.map((line) => {
      const t = line[r];
      const m = /^W(\d+)$/.exec(t);
      if (m) return cell('WILD', Number(m[1]));
      return cell(t as SymbolId);
    }));
  }
  return b;
}
