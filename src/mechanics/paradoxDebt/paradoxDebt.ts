import type { DebtState, GameConfig } from '../../config/types';
import { idx } from '../../engine/board/board';
import type { SpinContext } from '../../engine/context';
import { projectEchoes } from '../echoLedger/echoLedger';
import { applyAgeSteps, isTemporalTarget } from '../threeAges/ages';

export function debtStateOf(cfg: GameConfig, value: number): DebtState {
  const t = cfg.debt.thresholds;
  if (value >= t.DISCHARGE) return 'DISCHARGE';
  if (value >= t.CRITICAL) return 'CRITICAL';
  if (value >= t.UNSTABLE) return 'UNSTABLE';
  return 'STABLE';
}

/**
 * PARADOX DEBT — a deterministic, session-scoped meter (persists across rounds,
 * including into and out of The Last Second). It never looks at the player's
 * balance or win/loss history. Its only influences are:
 *   - the state at SPIN START modifies corruption chance and split size (fixed table);
 *   - reaching DISCHARGE triggers a Discharge at the next checkpoint.
 */
export class ParadoxDebt {
  private v = 0;
  private readonly cfg: GameConfig;

  constructor(cfg: GameConfig, initial = 0) {
    this.cfg = cfg;
    this.v = initial;
  }

  get value(): number {
    return this.v;
  }

  get state(): DebtState {
    return debtStateOf(this.cfg, this.v);
  }

  add(ctx: SpinContext, reason: string, delta: number): void {
    if (delta === 0) return;
    const prevState = this.state;
    const before = this.v;
    this.v = Math.max(0, Math.min(this.cfg.debt.max, this.v + delta));
    if (this.v === before) return;
    ctx.emit('PARADOX_DEBT_UPDATED', { reason, delta: this.v - before, value: this.v, state: this.state, prevState });
  }

  /** Dev tooling only (guarded by config.dev.allowForcing in the engine). */
  forceValue(v: number) {
    this.v = Math.max(0, Math.min(this.cfg.debt.max, v));
  }

  reset(ctx: SpinContext, reason: string) {
    this.add(ctx, reason, -this.v);
  }
}

/**
 * Discharge checkpoint. Resolves when debt >= DISCHARGE threshold and fewer than
 * debt.discharge.maxPerSpin discharges happened this spin. Effect, in order:
 *   1. Debt resets to 0.
 *   2. A regionSize x regionSize square (centre drawn uniformly among positions
 *      where the whole square fits) — every eligible cell advances one Age.
 *   3. debt.discharge.echoProjections echoes are projected.
 * The cascade evaluator then resumes on the changed board.
 */
export function resolveDischargeIfDue(ctx: SpinContext): boolean {
  const d = ctx.cfg.debt;
  if (ctx.debt.value < d.thresholds.DISCHARGE || ctx.dischargesThisSpin >= d.discharge.maxPerSpin) return false;
  const size = Math.min(d.discharge.regionSize, ctx.board.cols, ctx.board.rows);
  const c0 = ctx.rng.int(ctx.board.cols - size + 1);
  const r0 = ctx.rng.int(ctx.board.rows - size + 1);
  const region: number[] = [];
  for (let r = r0; r < r0 + size; r++) for (let c = c0; c < c0 + size; c++) region.push(idx(ctx.board, c, r));
  const valueBefore = ctx.debt.value;
  ctx.dischargesThisSpin++;
  ctx.stats.discharges++;
  ctx.temporalEffectThisSpin = true;
  ctx.emit('DEBT_DISCHARGED', { valueBefore, region });
  ctx.debt.reset(ctx, 'DISCHARGE');
  const eligible = region.filter((i) => isTemporalTarget(ctx.board.cells[i]));
  ctx.emit('TIME_CORRUPTION_APPLIED', { cascadeIndex: ctx.cascadeIndex, source: 'DISCHARGE_REGION', eligible, affected: eligible, chance: 1 });
  applyAgeSteps(ctx, eligible, 'DISCHARGE');
  projectEchoes(ctx, d.discharge.echoProjections);
  return true;
}
