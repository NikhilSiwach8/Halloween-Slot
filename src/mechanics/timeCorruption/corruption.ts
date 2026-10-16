import { neighbors } from '../../engine/board/board';
import type { SpinContext } from '../../engine/context';
import { sampleDistinct } from '../../engine/rng/rng';
import { applyAgeSteps, isTemporalTarget } from '../threeAges/ages';

/**
 * TIME CORRUPTION — rule set (see docs/GAME_RULES.md §Time Corruption).
 *
 * Effect 1 "Fracture Spread" (every winning cascade step):
 *   Trigger:       winning symbols were removed this step.
 *   Eligible:      surviving, non-frozen, ageable cells orthogonally adjacent to a removed cell.
 *   Probability:   corruption.adjacentChance + debtStateBonus[debt state at spin start], one draw per eligible cell in index order.
 *   Effect:        one age step (Hollow -> Chrono Wild collapse allowed).
 *   Limit:         corruption.maxTransformationsPerStep per step; draws stop once reached.
 *   Persistence:   for the spin (cells keep ages while they stay on the board).
 *   Chaining:      corruption never triggers corruption. Changed cells are evaluated
 *                  on the next cascade evaluation after gravity, like any other cell.
 *
 * Effect 2 "Orb Burst" (winning Chrono Orb cluster):
 *   Eligible:      every surviving, non-frozen, ageable cell.
 *   Effect:        corruption.orbBurstCells distinct cells chosen uniformly, one age step each.
 */
export function resolveFractureSpread(ctx: SpinContext, removed: readonly number[]): number[] {
  const removedSet = new Set(removed);
  const eligibleSet = new Set<number>();
  for (const r of removed) for (const nb of neighbors(ctx.board, r)) if (!removedSet.has(nb) && isTemporalTarget(ctx.board.cells[nb])) eligibleSet.add(nb);
  const eligible = [...eligibleSet].sort((a, b) => a - b);
  if (!eligible.length) return [];
  const state = ctx.debtStateAtStart === 'DISCHARGE' ? 'CRITICAL' : ctx.debtStateAtStart;
  const chance = Math.min(1, ctx.cfg.corruption.adjacentChance + ctx.cfg.corruption.debtStateBonus[state]);
  const affected: number[] = [];
  for (const i of eligible) {
    if (affected.length >= ctx.cfg.corruption.maxTransformationsPerStep) break;
    if (ctx.rng.next() < chance) affected.push(i);
  }
  ctx.emit('TIME_CORRUPTION_APPLIED', { cascadeIndex: ctx.cascadeIndex, source: 'ADJACENT', eligible, affected, chance });
  if (affected.length) applyAgeSteps(ctx, affected, 'CORRUPTION');
  return affected;
}

export function resolveOrbBurst(ctx: SpinContext): number[] {
  const eligible: number[] = [];
  ctx.board.cells.forEach((c, i) => isTemporalTarget(c) && eligible.push(i));
  const affected = sampleDistinct(ctx.rng, eligible, ctx.cfg.corruption.orbBurstCells).sort((a, b) => a - b);
  ctx.emit('TIME_CORRUPTION_APPLIED', { cascadeIndex: ctx.cascadeIndex, source: 'ORB_BURST', eligible, affected, chance: null });
  if (affected.length) applyAgeSteps(ctx, affected, 'ORB_BURST');
  return affected;
}
