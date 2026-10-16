import type { ClockmakerPath, GameConfig } from '../../config/types';
import type { SpinContext } from '../../engine/context';
import { sampleDistinct } from '../../engine/rng/rng';
import { projectEchoes } from '../echoLedger/echoLedger';
import { applyAgeSteps, isTemporalTarget, makeWild } from '../threeAges/ages';

export interface ClockmakerOption {
  path: ClockmakerPath;
  title: string;
  summary: string;
}

/** Player-facing descriptions, generated from config so the text always matches the rules. */
export function clockmakerOptions(cfg: GameConfig): ClockmakerOption[] {
  const a = cfg.clockmaker.preservePast;
  const b = cfg.clockmaker.breakFuture;
  return [
    {
      path: 'PRESERVE_PAST',
      title: 'Preserve the Past',
      summary: `Return up to ${a.echoProjections} Echo${a.echoProjections === 1 ? '' : 'es'} from the ledger onto this board. Each Echo missing from the ledger instead Fractures 1 random Original symbol.`,
    },
    {
      path: 'BREAK_FUTURE',
      title: 'Break the Future',
      summary: `Advance ${b.advanceCells} random symbols one Age now (Hollow symbols collapse into Chrono Wilds), and the next Paradox Split takes ${b.primeSplitCells} extra cells from the Hollow timeline.`,
    },
  ];
}

/**
 * CLOCKMAKER'S CHOICE — resolved once per feature instance (the engine rejects a
 * second selection). Both paths change gameplay; neither is claimed to be better.
 * After the path resolves, every Clockmaker on the board becomes a Chrono Wild.
 */
export function applyClockmakerChoice(ctx: SpinContext, path: ClockmakerPath, clockmakerPositions: number[], selectedBy: 'PLAYER' | 'CLOCKMAKER' = 'PLAYER'): void {
  ctx.emit('CLOCKMAKER_CHOICE_SELECTED', { path, selectedBy, board: ctx.snap() });
  ctx.stats.clockmaker = path;
  ctx.temporalEffectThisSpin = true;
  if (path === 'PRESERVE_PAST') {
    const want = ctx.cfg.clockmaker.preservePast.echoProjections;
    const got = projectEchoes(ctx, want);
    const missing = Math.min(want - got, ctx.cfg.clockmaker.preservePast.fallbackFractureCells);
    if (missing > 0) {
      const originals: number[] = [];
      ctx.board.cells.forEach((c, i) => isTemporalTarget(c) && c.age === 0 && originals.push(i));
      applyAgeSteps(ctx, sampleDistinct(ctx.rng, originals, missing).sort((x, y) => x - y), 'CLOCKMAKER_FALLBACK');
    }
  } else {
    const eligible: number[] = [];
    ctx.board.cells.forEach((c, i) => isTemporalTarget(c) && eligible.push(i));
    const chosen = sampleDistinct(ctx.rng, eligible, ctx.cfg.clockmaker.breakFuture.advanceCells).sort((x, y) => x - y);
    applyAgeSteps(ctx, chosen, 'CLOCKMAKER_BREAK_FUTURE');
    ctx.session.splitPrimedCells = Math.max(ctx.session.splitPrimedCells, ctx.cfg.clockmaker.breakFuture.primeSplitCells);
  }
  makeWild(ctx, clockmakerPositions, 'CLOCKMAKER_STEPS_ASIDE');
  ctx.debt.add(ctx, 'CLOCKMAKER', ctx.cfg.debt.gains.CLOCKMAKER);
}
