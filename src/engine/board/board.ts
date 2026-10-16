import type { Age, SymbolId, WeightTable } from '../../config/types';
import { weightedPick, type Rng } from '../rng/rng';

/** One occupied grid position. `uid` is stable while the physical symbol stays on the board. */
export interface Cell {
  uid: number;
  sym: SymbolId;
  age: Age;
  /** Locked in place by The Last Second (Stage 1: Frozen). */
  frozen: boolean;
}

/** Row-major board: index = row * cols + col, row 0 is the top row. `null` = empty (removed) position. */
export interface Board {
  cols: number;
  rows: number;
  cells: (Cell | null)[];
}

export type BoardSnapshot = (Cell | null)[];

export function idx(board: Pick<Board, 'cols'>, col: number, row: number): number {
  return row * board.cols + col;
}

export function colOf(board: Pick<Board, 'cols'>, i: number): number {
  return i % board.cols;
}

export function rowOf(board: Pick<Board, 'cols'>, i: number): number {
  return Math.floor(i / board.cols);
}

/** Orthogonal neighbours in fixed order: up, right, down, left. */
export function neighbors(board: Pick<Board, 'cols' | 'rows'>, i: number): number[] {
  const c = i % board.cols;
  const r = Math.floor(i / board.cols);
  const out: number[] = [];
  if (r > 0) out.push(i - board.cols);
  if (c < board.cols - 1) out.push(i + 1);
  if (r < board.rows - 1) out.push(i + board.cols);
  if (c > 0) out.push(i - 1);
  return out;
}

export function snapshot(board: Board): BoardSnapshot {
  return board.cells.map((c) => (c ? { ...c } : null));
}

export function cloneBoard(board: Board): Board {
  return { cols: board.cols, rows: board.rows, cells: snapshot(board) };
}

export interface UidSource {
  nextUid(): number;
}

export function makeCell(uids: UidSource, sym: SymbolId, age: Age = 0): Cell {
  return { uid: uids.nextUid(), sym, age, frozen: false };
}

/** Create a full board, drawing cells in index order from the weight table. Pre-filled cells (e.g. frozen) are kept. */
export function fillBoard(
  rng: Rng,
  uids: UidSource,
  cols: number,
  rows: number,
  weights: WeightTable,
  keep: (Cell | null)[] = [],
): Board {
  const cells: (Cell | null)[] = [];
  for (let i = 0; i < cols * rows; i++) {
    cells.push(keep[i] ?? makeCell(uids, weightedPick(rng, weights)));
  }
  return { cols, rows, cells };
}

/** Build a board from symbol ids (tests / forced dev boards). */
export function boardFromSymbols(uids: UidSource, cols: number, rows: number, syms: SymbolId[], ages?: Age[]): Board {
  if (syms.length !== cols * rows) throw new Error(`boardFromSymbols expects ${cols * rows} symbols`);
  return { cols, rows, cells: syms.map((s, i) => makeCell(uids, s, ages?.[i] ?? 0)) };
}

/**
 * Gravity + refill, column by column.
 *
 * Frozen cells never move. In each column the non-frozen survivors keep their
 * relative order and settle into the lowest non-frozen slots; the empty slots
 * left at the top are refilled from the weight table, drawn top-to-bottom,
 * column 0 first. Returns the indices that received new symbols.
 */
export function applyGravityAndRefill(board: Board, rng: Rng, uids: UidSource, weights: WeightTable): number[] {
  const filled: number[] = [];
  const pending: { col: number; slots: number[] }[] = [];
  for (let c = 0; c < board.cols; c++) {
    const slots: number[] = [];
    const survivors: Cell[] = [];
    for (let r = 0; r < board.rows; r++) {
      const i = idx(board, c, r);
      const cell = board.cells[i];
      if (cell?.frozen) continue;
      slots.push(i);
      if (cell) survivors.push(cell);
    }
    // settle survivors at the bottom of the free slots
    const empty = slots.length - survivors.length;
    slots.forEach((slot, k) => {
      board.cells[slot] = k < empty ? null : survivors[k - empty];
    });
    pending.push({ col: c, slots: slots.slice(0, empty) });
  }
  for (const { slots } of pending) {
    for (const slot of slots) {
      board.cells[slot] = makeCell(uids, weightedPick(rng, weights));
      filled.push(slot);
    }
  }
  return filled;
}

export function countSymbol(board: Board, sym: SymbolId): number {
  return board.cells.reduce((n, c) => n + (c?.sym === sym ? 1 : 0), 0);
}
