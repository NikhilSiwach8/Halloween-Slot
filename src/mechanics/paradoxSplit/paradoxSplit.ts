import { SYMBOLS } from '../../config/symbols';
import type { Age } from '../../config/types';
import { snapshot, type BoardSnapshot } from '../../engine/board/board';
import type { SpinContext } from '../../engine/context';
import { sampleDistinct } from '../../engine/rng/rng';
import { applyAgeSteps, isTemporalTarget } from '../threeAges/ages';

/**
 * PARADOX SPLIT — resolution model: "Present positions, Hollow states".
 *
 *  Timeline A (The Present) = the current authoritative board.
 *  Timeline B (The Hollow)  = the same board with every non-frozen ageable
 *                             symbol one Age further (Hollow stays Hollow; no collapse).
 *  Merge rule: N cells are drawn uniformly (distinct) from the cells where the two
 *  timelines differ. Those cells take their Timeline B state; every other cell keeps
 *  Timeline A. The merged board is then evaluated by the normal cascade evaluator.
 *  There is exactly one award stream — Timeline B is never paid on its own.
 */
export function deriveHollowTimeline(present: BoardSnapshot): BoardSnapshot {
  return present.map((c) => (c && SYMBOLS[c.sym].ageable && !c.frozen ? { ...c, age: Math.min(2, c.age + 1) as Age } : c ? { ...c } : null));
}

export function splitCellCount(ctx: SpinContext, base: number): number {
  const critical = ctx.debtStateAtStart === 'CRITICAL' || ctx.debtStateAtStart === 'DISCHARGE';
  return base + (critical ? ctx.cfg.split.criticalBonusCells : 0) + ctx.session.splitPrimedCells;
}

export function resolveParadoxSplit(ctx: SpinContext, reason: 'PORTAL_CLUSTER' | 'PORTAL_SCATTER' | 'BONUS_DIVERGENCE' | 'FORCED', baseCells: number): number[] {
  const cellsRequested = splitCellCount(ctx, baseCells);
  ctx.session.splitPrimedCells = 0; // primed bonus is consumed by this split
  const present = snapshot(ctx.board); // always real: drives eligibility even when event recording is off
  const hollow = deriveHollowTimeline(present);
  const eligible: number[] = [];
  present.forEach((c, i) => {
    if (isTemporalTarget(c) && c.age < 2) eligible.push(i);
  });
  const selected = sampleDistinct(ctx.rng, eligible, cellsRequested).sort((a, b) => a - b);
  ctx.splitsThisSpin++;
  ctx.stats.splits++;
  ctx.temporalEffectThisSpin = true;
  ctx.emit('PARADOX_SPLIT_STARTED', { reason, present, hollow, selected, cellsRequested });
  applyAgeSteps(ctx, selected, 'PARADOX_SPLIT', { allowCollapse: false });
  ctx.emit('PARADOX_SPLIT_RESOLVED', { selected, board: ctx.snap() });
  ctx.debt.add(ctx, 'PARADOX_SPLIT', ctx.cfg.debt.gains.PARADOX_SPLIT);
  return selected;
}
