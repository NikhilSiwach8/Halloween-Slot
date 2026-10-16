import { SYMBOLS } from '../../config/symbols';
import type { Age, GameConfig } from '../../config/types';
import type { Cell } from '../../engine/board/board';
import type { SpinContext } from '../../engine/context';
import type { CellChange, ChangeCause } from '../../engine/events/events';

export const AGE_NAMES: Record<Age, string> = { 0: 'Original', 1: 'Fractured', 2: 'Hollow' };

export type AgeTransition =
  | { kind: 'ADVANCE'; from: Age; to: Age }
  | { kind: 'COLLAPSE_TO_WILD'; from: 2 }
  | { kind: 'NONE'; reason: 'NOT_AGEABLE' | 'PERMANENT_HOLLOW' | 'COLLAPSE_NOT_ALLOWED' };

/**
 * THE central age-transition rule.
 *  - Ages progress strictly one step at a time: Original -> Fractured -> Hollow.
 *  - Ages never skip and never reverse.
 *  - Advancing a Hollow symbol collapses it into a Chrono Wild when the config
 *    says COLLAPSE_TO_WILD and the caller allows collapse; otherwise it stays Hollow.
 *  - Wilds, Tickets and the Clockmaker have no age.
 */
export function nextAgeTransition(cfg: GameConfig, cell: Pick<Cell, 'sym' | 'age'>, allowCollapse = true): AgeTransition {
  if (!SYMBOLS[cell.sym].ageable) return { kind: 'NONE', reason: 'NOT_AGEABLE' };
  if (cell.age < 2) return { kind: 'ADVANCE', from: cell.age, to: (cell.age + 1) as Age };
  if (cfg.ages.hollowOverflow === 'PERMANENT_HOLLOW') return { kind: 'NONE', reason: 'PERMANENT_HOLLOW' };
  if (!allowCollapse) return { kind: 'NONE', reason: 'COLLAPSE_NOT_ALLOWED' };
  return { kind: 'COLLAPSE_TO_WILD', from: 2 };
}

/** Is a cell a legal target for temporal effects (corruption, echoes, splits)? Frozen cells are immune. */
export function isTemporalTarget(cell: Cell | null): cell is Cell {
  return !!cell && SYMBOLS[cell.sym].ageable && !cell.frozen;
}

/**
 * Applies one age step to each index (in the given order), through the engine
 * context so every consequence is centralised:
 *   - SYMBOL_AGE_CHANGED event with a board snapshot
 *   - Echo Ledger entry when a symbol becomes Hollow (bounded per spin)
 *   - Paradox Debt gain for Hollow formation and wild collapse
 * `includeFrozen` is used only by bonus rules that age frozen cells on purpose.
 */
export function applyAgeSteps(
  ctx: SpinContext,
  indices: readonly number[],
  cause: ChangeCause,
  opts: { allowCollapse?: boolean; includeFrozen?: boolean } = {},
): CellChange[] {
  const allowCollapse = opts.allowCollapse ?? true;
  const changes: CellChange[] = [];
  for (const i of indices) {
    const cell = ctx.board.cells[i];
    if (!cell) continue;
    if (cell.frozen && !opts.includeFrozen) continue;
    const t = nextAgeTransition(ctx.cfg, cell, allowCollapse);
    if (t.kind === 'NONE') continue;
    const from = { sym: cell.sym, age: cell.age };
    if (t.kind === 'ADVANCE') {
      cell.age = t.to;
    } else {
      cell.sym = 'WILD';
      cell.age = 0;
      cell.frozen = false;
    }
    changes.push({ index: i, uid: cell.uid, from, to: { sym: cell.sym, age: cell.age }, kind: t.kind, cause });
  }
  if (!changes.length) return changes;
  ctx.emit('SYMBOL_AGE_CHANGED', { changes, board: ctx.snap() });

  let debtGain = 0;
  for (const ch of changes) {
    if (ch.kind === 'ADVANCE' && ch.to.age === 1) ctx.stats.toFractured++;
    if (ch.kind === 'ADVANCE' && ch.to.age === 2) {
      ctx.stats.toHollow++;
      debtGain += ctx.cfg.debt.gains.HOLLOW_FORMED;
      ctx.echo.record(ctx, ch.index, ch.to.sym, 2, 'HOLLOW_FORMED');
    }
    if (ch.kind === 'COLLAPSE_TO_WILD') {
      ctx.stats.collapsesToWild++;
      debtGain += ctx.cfg.debt.gains.WILD_COLLAPSE;
    }
  }
  if (debtGain) ctx.debt.add(ctx, `AGE_CHANGES:${cause}`, debtGain);
  const hm = ctx.cfg.bonus.hourMultiplier;
  growHourMultiplier(
    ctx,
    changes.filter((c) => c.kind === 'ADVANCE' && c.to.age === 2).length * hm.perHollow + changes.filter((c) => c.kind === 'COLLAPSE_TO_WILD').length * hm.perCollapse,
    cause,
  );
  return changes;
}

/** Converts cells into Chrono Wilds (Clockmaker stepping aside). Not an age step. */
export function makeWild(ctx: SpinContext, indices: readonly number[], cause: ChangeCause): CellChange[] {
  const changes: CellChange[] = [];
  for (const i of indices) {
    const cell = ctx.board.cells[i];
    if (!cell || cell.sym === 'WILD') continue;
    const from = { sym: cell.sym, age: cell.age };
    cell.sym = 'WILD';
    cell.age = 0;
    changes.push({ index: i, uid: cell.uid, from, to: { sym: 'WILD', age: 0 }, kind: 'BECOME_WILD', cause });
  }
  if (changes.length) ctx.emit('SYMBOL_AGE_CHANGED', { changes, board: ctx.snap() });
  return changes;
}

/** Explicit collapse into a Chrono Wild regardless of current Age (The Last Second, Stage IV). Unfreezes the cell. */
export function collapseToWild(ctx: SpinContext, indices: readonly number[], cause: ChangeCause): CellChange[] {
  const changes: CellChange[] = [];
  for (const i of indices) {
    const cell = ctx.board.cells[i];
    if (!cell || !SYMBOLS[cell.sym].ageable) continue;
    const from = { sym: cell.sym, age: cell.age };
    cell.sym = 'WILD';
    cell.age = 0;
    cell.frozen = false;
    changes.push({ index: i, uid: cell.uid, from, to: { sym: 'WILD', age: 0 }, kind: 'COLLAPSE_TO_WILD', cause });
  }
  if (!changes.length) return changes;
  ctx.emit('SYMBOL_AGE_CHANGED', { changes, board: ctx.snap() });
  ctx.stats.collapsesToWild += changes.length;
  ctx.debt.add(ctx, `AGE_CHANGES:${cause}`, changes.length * ctx.cfg.debt.gains.WILD_COLLAPSE);
  // The Stage IV collapse is a fixed stage rule and does not feed the Hour Multiplier.
  if (cause !== 'COLLAPSE_STAGE') growHourMultiplier(ctx, changes.length * ctx.cfg.bonus.hourMultiplier.perCollapse, cause);
  return changes;
}

/** The Hour Multiplier only exists inside The Last Second (ctx.bonus is null in the base game). */
export function growHourMultiplier(ctx: SpinContext, delta: number, cause: string): void {
  if (!ctx.bonus || delta <= 0) return;
  const before = ctx.bonus.hourMultiplier;
  ctx.bonus.hourMultiplier = Math.min(ctx.cfg.bonus.hourMultiplier.max, before + delta);
  if (ctx.bonus.hourMultiplier !== before) {
    ctx.emit('HOUR_MULTIPLIER_CHANGED', { value: ctx.bonus.hourMultiplier, delta: ctx.bonus.hourMultiplier - before, reason: cause });
  }
}
