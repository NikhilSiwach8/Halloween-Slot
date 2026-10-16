import { PAYING_SYMBOLS } from '../../config/symbols';
import type { GameConfig } from '../../config/types';
import type { SpinContext } from '../../engine/context';
import type { BonusStageName } from '../../engine/events/events';
import { sampleDistinct } from '../../engine/rng/rng';
import { projectEchoes } from '../echoLedger/echoLedger';
import { resolveParadoxSplit } from '../paradoxSplit/paradoxSplit';
import { resolveDischargeIfDue } from '../paradoxDebt/paradoxDebt';
import { applyAgeSteps, collapseToWild, isTemporalTarget } from '../threeAges/ages';

/**
 * THE LAST SECOND — four-stage bonus. Each stage is one bonus spin, started by
 * the player. Stage order is fixed: FROZEN -> DIVERGENCE -> ECHO -> COLLAPSE.
 *
 * Trigger:      >= bonus.triggerTickets Void Tickets on the initial base board.
 * Entry:        free (part of the triggering round; no extra stake).
 * Board:        each stage draws a fresh board from weights.bonus, except frozen cells,
 *               which keep their position, symbol and Age (bonus-scope persistence).
 * Retrigger:    impossible — Tickets and the Clockmaker have weight 0 in bonus.
 * Cascades:     the normal evaluator, cascade limit and round cap apply.
 * Frozen cells: never move, are immune to corruption / echoes / splits, are not
 *               removed when they win — they advance one Age instead (a frozen Hollow
 *               that wins collapses into a Chrono Wild and unfreezes).
 * End:          after stage 4, or immediately when the round cap is reached.
 * Reset:        frozen cells are cleared at bonus end. Debt and Echo Ledger persist (session scope).
 */
export const BONUS_STAGES: { stage: 1 | 2 | 3 | 4; name: BonusStageName; title: string; text: string }[] = [
  { stage: 1, name: 'FROZEN', title: 'Stage I — Frozen', text: 'The clock stops. Symbols of the most common kind lock in place as Fractured.' },
  { stage: 2, name: 'DIVERGENCE', title: 'Stage II — Divergence', text: 'Paradox Split: cells cross over from the Hollow timeline.' },
  { stage: 3, name: 'ECHO', title: 'Stage III — Echo', text: 'Echoes return from the ledger to the board.' },
  { stage: 4, name: 'COLLAPSE', title: 'Stage IV — Collapse', text: 'Frozen symbols collapse into Chrono Wilds, debt surges and wins are multiplied.' },
];

export function stageMultiplier(cfg: GameConfig, stage: number): number {
  return cfg.bonus.stageMultipliers[stage - 1] ?? 1;
}

/** Stage 1: freeze up to bonus.frozenCells cells of the most common paying symbol (ties: higher rank). */
export function applyFreeze(ctx: SpinContext): number[] {
  const counts = new Map<string, number[]>();
  ctx.board.cells.forEach((c, i) => {
    if (isTemporalTarget(c)) counts.set(c.sym, [...(counts.get(c.sym) ?? []), i]);
  });
  let best: number[] = [];
  for (const sym of PAYING_SYMBOLS) {
    const list = counts.get(sym) ?? [];
    if (list.length > best.length) best = list;
  }
  const chosen = sampleDistinct(ctx.rng, best, ctx.cfg.bonus.frozenCells).sort((a, b) => a - b);
  applyAgeSteps(ctx, chosen, 'BONUS_FREEZE', { allowCollapse: false });
  for (const i of chosen) ctx.board.cells[i]!.frozen = true;
  return chosen;
}

/** Pre-evaluation effect of each stage. */
export function applyStageEffect(ctx: SpinContext, stage: 1 | 2 | 3 | 4): void {
  const cfg = ctx.cfg;
  if (stage === 1) {
    applyFreeze(ctx);
  } else if (stage === 2) {
    resolveParadoxSplit(ctx, 'BONUS_DIVERGENCE', cfg.bonus.splitCells);
  } else if (stage === 3) {
    const got = projectEchoes(ctx, cfg.bonus.echoProjections);
    const missing = Math.min(cfg.bonus.echoProjections - got, cfg.bonus.echoFallbackFractureCells);
    if (missing > 0) {
      const originals: number[] = [];
      ctx.board.cells.forEach((c, i) => isTemporalTarget(c) && c.age === 0 && originals.push(i));
      applyAgeSteps(ctx, sampleDistinct(ctx.rng, originals, missing).sort((a, b) => a - b), 'ECHO_FALLBACK');
    }
  } else {
    const frozen: number[] = [];
    ctx.board.cells.forEach((c, i) => c?.frozen && frozen.push(i));
    // Collapse: frozen symbols become Chrono Wilds directly (explicit stage rule, not an age step).
    collapseToWild(ctx, frozen, 'COLLAPSE_STAGE');
    ctx.debt.add(ctx, 'COLLAPSE_STAGE', cfg.debt.gains.COLLAPSE_STAGE);
    resolveDischargeIfDue(ctx);
  }
}
