import { validateConfig } from '../config/gameConfig';
import type { ClockmakerPath, DebtState, GameConfig, SymbolId } from '../config/types';
import { EchoLedger, projectEchoes, type EchoEntry } from '../mechanics/echoLedger/echoLedger';
import { applyClockmakerChoice } from '../mechanics/clockmakerChoice/clockmakerChoice';
import { BONUS_STAGES, applyStageEffect, stageMultiplier } from '../mechanics/lastSecond/lastSecond';
import { ParadoxDebt, resolveDischargeIfDue } from '../mechanics/paradoxDebt/paradoxDebt';
import { resolveParadoxSplit } from '../mechanics/paradoxSplit/paradoxSplit';
import { resolveFractureSpread, resolveOrbBurst } from '../mechanics/timeCorruption/corruption';
import { applyAgeSteps } from '../mechanics/threeAges/ages';
import { applyGravityAndRefill, countSymbol, fillBoard, idx, snapshot, type Board, type BoardSnapshot, type Cell } from './board/board';
import { findClusters } from './clusters/clusters';
import { emptyStats, type RoundStats, type SessionScope, type SpinContext } from './context';
import type { EventPayloads, EventType, GameEvent } from './events/events';
import { PayoutLedger, SettlementError, ageMultiplier, clusterAward, payFor, type Award } from './payouts/payouts';
import { SeededRng, type Rng } from './rng/rng';
import { PhaseMachine, type GamePhase } from './state/stateMachine';

/** Development-only forced triggers. Rejected unless config.dev.allowForcing is true. */
export type ForceOption = 'BONUS' | 'CLOCKMAKER' | 'SPLIT' | 'ECHO' | 'DISCHARGE';

export interface SpinRequest {
  bet: number;
  force?: ForceOption;
}

export type Awaiting = 'SPIN' | 'CLOCKMAKER_CHOICE' | 'BONUS_STAGE';

export interface RoundRecord {
  roundId: string;
  stake: number;
  totalWin: number;
  baseWin: number;
  bonusWin: number;
  awards: readonly Award[];
  stats: RoundStats;
  settled: boolean;
}

export interface StepResult {
  events: GameEvent[];
  phase: GamePhase;
  awaiting: Awaiting;
  /** Present once the round has settled in this step. */
  settled: RoundRecord | null;
}

export interface EngineSnapshot {
  phase: GamePhase;
  awaiting: Awaiting;
  balance: number;
  debt: number;
  debtState: DebtState;
  echoes: EchoEntry[];
  recentEchoes: EchoEntry[];
  splitPrimedCells: number;
  board: BoardSnapshot | null;
  round: { roundId: string; stake: number; win: number; bonusStage: number; bonusTriggered: boolean } | null;
  lastRound: RoundRecord | null;
}

export type EngineAction =
  | { type: 'SPIN'; bet: number; force?: ForceOption }
  | { type: 'CHOOSE'; path: ClockmakerPath }
  | { type: 'BONUS_STAGE' };

export class EngineError extends Error {
  readonly code: 'INVALID_PHASE' | 'INVALID_BET' | 'INSUFFICIENT_BALANCE' | 'FORCING_DISABLED' | 'INVALID_CONFIG' | 'NO_PENDING_CHOICE';
  constructor(code: EngineError['code'], message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

interface ActiveRound {
  roundId: string;
  stake: number;
  payouts: PayoutLedger;
  stats: RoundStats;
  bonusTriggered: boolean;
  bonusStage: number;
  baseWin: number;
  pendingClockmaker: { positions: number[]; ctx: SpinContext } | null;
  /** Frozen cells carried between bonus stages (by index). */
  frozen: (Cell | null)[];
}

export interface EngineOptions {
  seed: number;
  /** Record events (default true). The bulk simulator disables this for speed; outcomes are identical. */
  recordEvents?: boolean;
  startingBalance?: number;
  /** Inject an alternative RNG (e.g. a platform-provided source). */
  rng?: Rng;
}

const EVENT_LOG_LIMIT = 4000;

/**
 * Authoritative game engine. Resolves every outcome synchronously and emits
 * typed events; the UI only animates those events.
 *
 * Resolution order of one spin (base spin or bonus stage) — enforced here:
 *   1  validate request / phase              (spin() / chooseClockmakerPath() / playBonusStage())
 *   2  start spin: expire echoes, snapshot debt state
 *   3  create board (initial / bonus weights; frozen cells kept)
 *   4  pre-evaluation feature: Clockmaker's Choice (base) or stage effect (bonus)
 *   5  cascade loop  -> runCascades()
 *        a evaluate clusters; stop if none / cascade limit / cap
 *        b record each cluster award exactly once (+ Echo Ledger entry for aged wins)
 *        c remove winning symbols (frozen winners age instead)
 *        d Time Corruption: Fracture Spread, then Orb Burst
 *        e gravity + refill
 *        f Hourglass echo projection, then Portal Paradox Split
 *   6  Paradox Debt Discharge checkpoint (if due: discharge, then back to 5)
 *   7  bonus trigger check (base) / stage completion (bonus)
 *   8  settle round through the payout ledger (once)
 * Paradox Debt is updated immediately at every gain; only the state captured in
 * step 2 changes probabilities.
 */
export class GameEngine {
  readonly cfg: GameConfig;
  private readonly rng: Rng;
  private readonly machine = new PhaseMachine();
  private balanceUnits: number;
  readonly debt: ParadoxDebt;
  readonly echo: EchoLedger;
  private readonly session: SessionScope = { splitPrimedCells: 0 };
  private uid = 0;
  private roundCounter = 0;
  private spinSeq = 0;
  private eventSeq = 0;
  private readonly recordEvents: boolean;
  private round: ActiveRound | null = null;
  private lastRoundRecord: RoundRecord | null = null;
  private readonly settledRoundIds = new Set<string>();
  private stepEvents: GameEvent[] = [];
  private board: Board | null = null;
  readonly eventLog: GameEvent[] = [];
  readonly actions: EngineAction[] = [];
  readonly seed: number;

  constructor(cfg: GameConfig, opts: EngineOptions) {
    const errors = validateConfig(cfg);
    if (errors.length) throw new EngineError('INVALID_CONFIG', errors.join('; '));
    this.cfg = cfg;
    this.seed = opts.seed;
    this.rng = opts.rng ?? new SeededRng(opts.seed);
    this.recordEvents = opts.recordEvents ?? true;
    this.balanceUnits = opts.startingBalance ?? cfg.currency.startingBalance;
    this.debt = new ParadoxDebt(cfg);
    this.echo = new EchoLedger(cfg.echo.maxEntries, cfg.echo.ttlSpins);
  }

  // ------------------------------------------------------------------ public API

  get phase(): GamePhase {
    return this.machine.phase;
  }

  get balance(): number {
    return this.balanceUnits;
  }

  get awaiting(): Awaiting {
    const p = this.machine.phase;
    if (p === 'CLOCKMAKER_CHOICE') return 'CLOCKMAKER_CHOICE';
    if (p === 'BONUS_INTRO' || p === 'BONUS_PLAYING') return 'BONUS_STAGE';
    return 'SPIN';
  }

  getSnapshot(): EngineSnapshot {
    return {
      phase: this.phase,
      awaiting: this.awaiting,
      balance: this.balanceUnits,
      debt: this.debt.value,
      debtState: this.debt.state,
      echoes: this.echo.entries().map((e) => ({ ...e })),
      recentEchoes: this.echo.recent().map((e) => ({ ...e })),
      splitPrimedCells: this.session.splitPrimedCells,
      board: this.board ? snapshot(this.board) : null,
      round: this.round
        ? { roundId: this.round.roundId, stake: this.round.stake, win: this.round.payouts.total, bonusStage: this.round.bonusStage, bonusTriggered: this.round.bonusTriggered }
        : null,
      lastRound: this.lastRoundRecord,
    };
  }

  spin(req: SpinRequest): StepResult {
    if (this.phase !== 'IDLE') throw new EngineError('INVALID_PHASE', `cannot spin while ${this.phase}; finish the current round first`);
    if (!this.cfg.bets.includes(req.bet)) throw new EngineError('INVALID_BET', `stake ${req.bet} is not permitted`);
    if (req.bet > this.balanceUnits) throw new EngineError('INSUFFICIENT_BALANCE', 'insufficient demo balance');
    if (req.force && !this.cfg.dev.allowForcing) throw new EngineError('FORCING_DISABLED', 'forced triggers are disabled in this configuration');
    this.actions.push({ type: 'SPIN', bet: req.bet, ...(req.force ? { force: req.force } : {}) });
    return this.step(() => {
      this.machine.go('SPINNING');
      this.balanceUnits -= req.bet;
      const roundId = `R${++this.roundCounter}`;
      this.round = {
        roundId, stake: req.bet, payouts: new PayoutLedger(roundId, req.bet, Math.min(this.cfg.maxWinX, this.cfg.bonus.maxBonusWinX)), stats: emptyStats(),
        bonusTriggered: false, bonusStage: 0, baseWin: 0, pendingClockmaker: null, frozen: [],
      };
      if (req.force === 'DISCHARGE') this.debt.forceValue(this.cfg.debt.thresholds.DISCHARGE);
      const ctx = this.startSpin('BASE', 0, this.cfg.weights.refill);
      ctx.board = fillBoard(this.rng, this, this.cfg.grid.cols, this.cfg.grid.rows, this.cfg.weights.initial);
      if (req.force) this.applyForcedBoard(ctx.board, req.force);
      this.board = ctx.board;
      const tickets = countSymbol(ctx.board, 'TICKET');
      const clockmakers: number[] = [];
      ctx.board.cells.forEach((c, i) => c?.sym === 'CLOCKMAKER' && clockmakers.push(i));
      ctx.emit('BOARD_CREATED', { board: ctx.snap(), tickets, clockmakers: clockmakers.length, forced: req.force ?? null });
      this.round.bonusTriggered = tickets >= this.cfg.bonus.triggerTickets;
      if (clockmakers.length) {
        this.machine.go('CLOCKMAKER_CHOICE');
        this.round.pendingClockmaker = { positions: clockmakers, ctx };
        ctx.emit('CLOCKMAKER_CHOICE_OFFERED', { positions: clockmakers, echoesAvailable: this.echo.eligible(ctx.spinSeq).length });
        return;
      }
      this.machine.go('EVALUATING');
      this.finishBaseSpin(ctx);
    });
  }

  chooseClockmakerPath(path: ClockmakerPath): StepResult {
    if (this.phase !== 'CLOCKMAKER_CHOICE' || !this.round?.pendingClockmaker) {
      throw new EngineError('NO_PENDING_CHOICE', 'no Clockmaker’s Choice is awaiting a selection');
    }
    if (path !== 'PRESERVE_PAST' && path !== 'BREAK_FUTURE') throw new EngineError('NO_PENDING_CHOICE', `unknown path ${String(path)}`);
    this.actions.push({ type: 'CHOOSE', path });
    return this.step(() => {
      const pending = this.round!.pendingClockmaker!;
      this.round!.pendingClockmaker = null; // one selection per feature instance
      this.machine.go('TEMPORAL_EFFECT');
      applyClockmakerChoice(pending.ctx, path, pending.positions);
      this.machine.go('EVALUATING');
      this.finishBaseSpin(pending.ctx);
    });
  }

  playBonusStage(): StepResult {
    if ((this.phase !== 'BONUS_INTRO' && this.phase !== 'BONUS_PLAYING') || !this.round) {
      throw new EngineError('INVALID_PHASE', `no bonus stage to play while ${this.phase}`);
    }
    this.actions.push({ type: 'BONUS_STAGE' });
    return this.step(() => {
      const round = this.round!;
      this.machine.go('BONUS_PLAYING');
      const stage = (round.bonusStage + 1) as 1 | 2 | 3 | 4;
      round.bonusStage = stage;
      const def = BONUS_STAGES[stage - 1];
      const ctx = this.startSpin('BONUS', stage, this.cfg.weights.bonus);
      ctx.stageMultiplier = stageMultiplier(this.cfg, stage);
      ctx.board = fillBoard(this.rng, this, this.cfg.grid.cols, this.cfg.grid.rows, this.cfg.weights.bonus, round.frozen);
      this.board = ctx.board;
      ctx.emit('BOARD_CREATED', { board: ctx.snap(), tickets: 0, clockmakers: 0, forced: null });
      ctx.emit('BONUS_STAGE_CHANGED', { stage, name: def.name, multiplier: ctx.stageMultiplier, frozen: this.frozenIndices(ctx.board) });
      this.machine.go('TEMPORAL_EFFECT');
      applyStageEffect(ctx, stage);
      this.machine.go('EVALUATING');
      this.runCascades(ctx);
      this.dischargeCheckpoint(ctx);
      round.frozen = ctx.board.cells.map((c) => (c?.frozen ? { ...c } : null));
      if (stage === 4 || round.payouts.capReached) {
        const bonusWin = round.payouts.total - round.baseWin;
        ctx.emit('BONUS_COMPLETED', { bonusWin });
        round.frozen = [];
        this.machine.go('BONUS_RESOLVING');
        this.settle(ctx);
      } else {
        this.machine.go('BONUS_PLAYING');
      }
    });
  }

  /** Bulk helper for simulation / tests: plays a whole round with a fixed choice policy. */
  playRound(bet: number, choose: (ctx: { echoesAvailable: number }) => ClockmakerPath = () => 'PRESERVE_PAST', force?: ForceOption): RoundRecord {
    let r = this.spin({ bet, force });
    while (!r.settled) {
      if (r.awaiting === 'CLOCKMAKER_CHOICE') r = this.chooseClockmakerPath(choose({ echoesAvailable: this.echo.eligible(this.spinSeq).length }));
      else if (r.awaiting === 'BONUS_STAGE') r = this.playBonusStage();
      else throw new Error(`playRound: unexpected awaiting state ${r.awaiting}`);
    }
    return r.settled;
  }

  nextUid(): number {
    return ++this.uid;
  }

  // ------------------------------------------------------------------ pipeline

  private step(fn: () => void): StepResult {
    this.stepEvents = [];
    try {
      fn();
    } catch (err) {
      // An internal failure must never leave a half-resolved round accepting input silently.
      this.machine.reset('IDLE');
      if (this.round && !this.round.payouts.isSettled) {
        // refund the stake of a round that could not be resolved
        this.balanceUnits += this.round.stake;
        this.round = null;
      }
      throw err;
    }
    const settled = this.phase === 'IDLE' ? this.lastRoundRecord : null;
    return { events: this.stepEvents, phase: this.phase, awaiting: this.awaiting, settled };
  }

  private emitFor(roundId: string, spinIndex: number) {
    return <K extends EventType>(type: K, payload: EventPayloads[K]) => {
      if (!this.recordEvents) return;
      const ev = { seq: ++this.eventSeq, type, roundId, spinIndex, ...payload } as unknown as GameEvent;
      this.stepEvents.push(ev);
      this.eventLog.push(ev);
      if (this.eventLog.length > EVENT_LOG_LIMIT) this.eventLog.splice(0, this.eventLog.length - EVENT_LOG_LIMIT);
    };
  }

  private startSpin(mode: 'BASE' | 'BONUS', spinIndex: number, refill: GameConfig['weights']['refill']): SpinContext {
    const round = this.round!;
    this.spinSeq++;
    const emit = this.emitFor(round.roundId, spinIndex);
    const ctx: SpinContext = {
      cfg: this.cfg, rng: this.rng, uids: this, board: { cols: this.cfg.grid.cols, rows: this.cfg.grid.rows, cells: [] },
      roundId: round.roundId, spinIndex, spinSeq: this.spinSeq, cascadeIndex: 0, mode, stageMultiplier: 1, refillWeights: refill,
      debtStateAtStart: this.debt.state, payouts: round.payouts, echo: this.echo, debt: this.debt, session: this.session,
      stats: round.stats, spinWin: 0, splitsThisSpin: 0, dischargesThisSpin: 0, echoEntriesThisSpin: 0, temporalEffectThisSpin: false,
      emit,
      snap: () => (this.recordEvents ? snapshot(ctx.board) : []),
    };
    const expired = this.echo.expire(this.spinSeq);
    emit('SPIN_STARTED', { roundId: round.roundId, spinIndex, spinSeq: this.spinSeq, mode, stake: round.stake, balance: this.balanceUnits, debt: this.debt.value, debtState: ctx.debtStateAtStart });
    if (expired.length) emit('ECHO_EXPIRED', { entryIds: expired });
    return ctx;
  }

  /** Step 4b: initial-board temporal triggers (after Clockmaker's Choice, before evaluation). */
  private preEvaluationTriggers(ctx: SpinContext) {
    const cfg = this.cfg;
    if (countSymbol(ctx.board, 'HOURGLASS') >= cfg.echo.scatterTrigger.count) {
      this.machine.go('TEMPORAL_EFFECT');
      projectEchoes(ctx, cfg.echo.scatterTrigger.projections);
    }
    if (countSymbol(ctx.board, 'PORTAL') >= cfg.split.portalCount && ctx.splitsThisSpin < cfg.split.maxPerSpin) {
      this.machine.go('PARADOX_SPLIT');
      resolveParadoxSplit(ctx, 'PORTAL_SCATTER', cfg.split.cells);
    }
  }

  private finishBaseSpin(ctx: SpinContext) {
    const round = this.round!;
    this.preEvaluationTriggers(ctx);
    this.runCascades(ctx);
    this.dischargeCheckpoint(ctx);
    round.baseWin = round.payouts.total;
    if (round.bonusTriggered && !round.payouts.capReached) {
      round.stats.bonus = true;
      ctx.emit('BONUS_TRIGGERED', { tickets: countSymbol(ctx.board, 'TICKET') });
      this.machine.go('BONUS_INTRO');
      return;
    }
    this.settle(ctx);
  }

  private dischargeCheckpoint(ctx: SpinContext) {
    if (ctx.payouts.capReached) return;
    this.machine.go('TEMPORAL_EFFECT');
    if (resolveDischargeIfDue(ctx)) {
      this.machine.go('EVALUATING');
      this.runCascades(ctx);
    }
    this.machine.go('EVALUATING');
  }

  /** Step 5 of the resolution order. */
  private runCascades(ctx: SpinContext) {
    const cfg = this.cfg;
    for (;;) {
      this.machine.go('EVALUATING');
      if (ctx.payouts.capReached) return;
      const clusters = findClusters(ctx.board, cfg);
      if (!clusters.length) return;
      if (ctx.cascadeIndex >= cfg.cascade.maxCascades) {
        ctx.stats.cascadeLimitHit = true;
        ctx.emit('CASCADE_LIMIT_REACHED', { limit: cfg.cascade.maxCascades });
        return;
      }
      ctx.stats.winningCascades++;
      let hourglass = false;
      let portal = false;
      let orb = false;
      const winning = new Set<number>();
      for (const cl of clusters) {
        const { multiplier, ages } = ageMultiplier(cfg, ctx.board, cl);
        const pay = payFor(cfg, cl.symbol, cl.positions.length);
        const raw = clusterAward(ctx.payouts.stake, pay, multiplier, ctx.stageMultiplier);
        ctx.emit('CLUSTER_DETECTED', { cascadeIndex: ctx.cascadeIndex, symbol: cl.symbol, positions: cl.positions, ages, multiplier });
        const award = ctx.payouts.record({
          awardId: ctx.payouts.nextAwardId(), spinIndex: ctx.spinIndex, cascadeIndex: ctx.cascadeIndex, source: 'CLUSTER',
          symbol: cl.symbol, positions: cl.positions, clusterSize: cl.positions.length, payX100: pay,
          ageMultiplier: multiplier, stageMultiplier: ctx.stageMultiplier, rawAmount: raw,
        });
        ctx.spinWin += award.amount;
        ctx.stats.clusters++;
        ctx.stats.agesInWins[0] += ages[0];
        ctx.stats.agesInWins[1] += ages[1];
        ctx.stats.agesInWins[2] += ages[2];
        ctx.stats.ageUplift += award.amount - Math.floor(award.amount / multiplier);
        if (ctx.temporalEffectThisSpin) ctx.stats.postTemporalWins += award.amount;
        ctx.emit('WIN_RECORDED', { award: { ...award }, spinWin: ctx.spinWin, roundWin: ctx.payouts.total });
        // Echo Ledger: every winning cluster remembers its oldest real symbol (ties: lowest position).
        let best = cl.symbolPositions[0];
        for (const p of cl.symbolPositions) if (ctx.board.cells[p]!.age > ctx.board.cells[best]!.age) best = p;
        const bestAge = ctx.board.cells[best]!.age;
        ctx.echo.record(ctx, best, cl.symbol, bestAge, bestAge > 0 ? 'AGED_CLUSTER_WON' : 'CLUSTER_WON');
        if (cl.symbol === 'HOURGLASS') hourglass = true;
        if (cl.symbol === 'PORTAL') portal = true;
        if (cl.symbol === 'ORB') orb = true;
        cl.positions.forEach((p) => winning.add(p));
        if (award.capApplied || ctx.payouts.capReached) break;
      }
      if (ctx.payouts.capReached) {
        ctx.stats.capped = true;
        ctx.emit('WIN_CAP_REACHED', { cap: ctx.payouts.cap });
        return;
      }

      // c) removal — frozen winners stay and age instead
      this.machine.go('CASCADING');
      const removed: number[] = [];
      const frozenRetained: number[] = [];
      for (const p of [...winning].sort((a, b) => a - b)) {
        if (ctx.board.cells[p]?.frozen) frozenRetained.push(p);
        else {
          removed.push(p);
          ctx.board.cells[p] = null;
        }
      }
      ctx.emit('SYMBOL_REMOVED', { cascadeIndex: ctx.cascadeIndex, positions: removed, frozenRetained, board: ctx.snap() });
      if (frozenRetained.length) applyAgeSteps(ctx, frozenRetained, 'FROZEN_WIN', { includeFrozen: true });

      // d) Time Corruption
      this.machine.go('TEMPORAL_EFFECT');
      resolveFractureSpread(ctx, removed);
      if (orb) resolveOrbBurst(ctx);

      // e) gravity + refill
      this.machine.go('CASCADING');
      const filled = applyGravityAndRefill(ctx.board, this.rng, this, ctx.refillWeights);
      ctx.emit('GRAVITY_APPLIED', { cascadeIndex: ctx.cascadeIndex, filled, board: ctx.snap() });

      // f) Hourglass echoes, then Portal split
      if (hourglass) {
        this.machine.go('TEMPORAL_EFFECT');
        projectEchoes(ctx, cfg.echo.hourglassProjections);
      }
      if (portal && ctx.splitsThisSpin < cfg.split.maxPerSpin) {
        this.machine.go('PARADOX_SPLIT');
        resolveParadoxSplit(ctx, 'PORTAL_CLUSTER', cfg.split.cells);
      }
      ctx.cascadeIndex++;
    }
  }

  private settle(ctx: SpinContext) {
    const round = this.round!;
    this.machine.go('ROUND_SETTLING');
    if (this.settledRoundIds.has(round.roundId)) throw new SettlementError(`round ${round.roundId} already settled`);
    const total = round.payouts.settle();
    this.settledRoundIds.add(round.roundId);
    if (this.settledRoundIds.size > 10_000) this.settledRoundIds.delete(this.settledRoundIds.values().next().value as string);
    this.balanceUnits += total;
    const record: RoundRecord = {
      roundId: round.roundId, stake: round.stake, totalWin: total, baseWin: round.baseWin,
      bonusWin: round.bonusTriggered ? total - round.baseWin : 0, awards: round.payouts.list(), stats: round.stats, settled: true,
    };
    if (!round.bonusTriggered) record.baseWin = total;
    ctx.emit('ROUND_SETTLED', {
      roundId: round.roundId, stake: round.stake, totalWin: total, baseWin: record.baseWin, bonusWin: record.bonusWin,
      balance: this.balanceUnits, capped: round.stats.capped, awards: record.awards.length,
    });
    this.lastRoundRecord = record;
    this.round = null;
    this.machine.go('IDLE');
  }

  /** Test hook: attempting to settle an already-settled round must fail. */
  assertCanSettle(roundId: string) {
    if (this.settledRoundIds.has(roundId)) throw new SettlementError(`round ${roundId} already settled`);
  }

  private frozenIndices(board: Board): number[] {
    const out: number[] = [];
    board.cells.forEach((c, i) => c?.frozen && out.push(i));
    return out;
  }

  /** Dev-only board injection; applied before BOARD_CREATED so the event shows the real board. */
  private applyForcedBoard(board: Board, force: ForceOption) {
    const set = (i: number, sym: SymbolId) => {
      board.cells[i] = { uid: this.nextUid(), sym, age: 0, frozen: false };
    };
    // remove naturally drawn specials so the forced scenario is unambiguous
    board.cells.forEach((c, i) => {
      if (c && (c.sym === 'TICKET' || c.sym === 'CLOCKMAKER')) set(i, 'L_COG');
    });
    const bottom = this.cfg.grid.rows - 1;
    if (force === 'BONUS') [idx(board, 0, 0), idx(board, 2, 2), idx(board, 4, 0)].forEach((i) => set(i, 'TICKET'));
    if (force === 'CLOCKMAKER') set(idx(board, 2, 2), 'CLOCKMAKER');
    if (force === 'SPLIT') for (let c = 0; c < 5; c++) set(idx(board, c, bottom), 'PORTAL');
    if (force === 'ECHO') for (let c = 0; c < 5; c++) set(idx(board, c, bottom), 'HOURGLASS');
  }
}

/** Deterministic replay: same config + seed + action list => identical events and balances. */
export function replay(cfg: GameConfig, seed: number, actions: EngineAction[], startingBalance?: number): GameEngine {
  const engine = new GameEngine(cfg, { seed, startingBalance });
  for (const a of actions) {
    if (a.type === 'SPIN') engine.spin({ bet: a.bet, force: a.force });
    else if (a.type === 'CHOOSE') engine.chooseClockmakerPath(a.path);
    else engine.playBonusStage();
  }
  return engine;
}
