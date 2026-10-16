import type { Age, PayingSymbolId, SymbolId } from '../../config/types';
import { neighbors } from '../../engine/board/board';
import type { SpinContext } from '../../engine/context';
import { weightedPick } from '../../engine/rng/rng';
import { isTemporalTarget } from '../threeAges/ages';

export type EchoReason = 'HOLLOW_FORMED' | 'CLUSTER_WON' | 'AGED_CLUSTER_WON' | 'HOUR_REMNANT';
export type EchoStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'EVICTED';

/**
 * A remembered board state. It records *what was there*, never an unclaimed prize:
 * projecting an echo changes a current cell, and only a fresh evaluation of the
 * current board can produce a (new, uniquely identified) award.
 */
export interface EchoEntry {
  id: string;
  roundId: string;
  boardId: string;
  spinIndex: number;
  cascadeIndex: number;
  spinSeq: number;
  symbol: PayingSymbolId;
  age: Age;
  position: number;
  flags: { frozen: boolean };
  reason: EchoReason;
  /** Expires when a spin with spinSeq > expiresAfterSpinSeq starts. */
  expiresAfterSpinSeq: number;
  status: EchoStatus;
  consumedBy?: { roundId: string; spinSeq: number; position: number };
}

/** Bounded, session-scoped ledger of past board states. */
export class EchoLedger {
  private active: EchoEntry[] = [];
  private history: EchoEntry[] = [];
  private counter = 0;
  readonly maxEntries: number;
  readonly ttlSpins: number;
  private readonly historySize = 10;

  constructor(maxEntries: number, ttlSpins: number) {
    this.maxEntries = maxEntries;
    this.ttlSpins = ttlSpins;
  }

  entries(): readonly EchoEntry[] {
    return this.active;
  }

  /** Recently consumed / expired / evicted entries (for the ledger UI). */
  recent(): readonly EchoEntry[] {
    return this.history;
  }

  private retire(e: EchoEntry, status: EchoStatus) {
    e.status = status;
    this.history.unshift(e);
    if (this.history.length > this.historySize) this.history.length = this.historySize;
  }

  /** Called when a spin starts. Returns ids of entries that expired. */
  expire(spinSeq: number): string[] {
    const expired = this.active.filter((e) => spinSeq > e.expiresAfterSpinSeq);
    if (!expired.length) return [];
    this.active = this.active.filter((e) => spinSeq <= e.expiresAfterSpinSeq);
    expired.forEach((e) => this.retire(e, 'EXPIRED'));
    return expired.map((e) => e.id);
  }

  /**
   * Entries that may be projected at (spinSeq, cascadeIndex): active, unexpired, and created
   * strictly EARLIER — in an earlier spin, or in an earlier cascade of the same spin. Newest first.
   */
  eligible(spinSeq: number, cascadeIndex = 0): EchoEntry[] {
    return this.active
      .filter((e) => e.status === 'ACTIVE' && (e.spinSeq < spinSeq || (e.spinSeq === spinSeq && e.cascadeIndex < cascadeIndex)) && spinSeq <= e.expiresAfterSpinSeq)
      .sort((a, b) => b.spinSeq - a.spinSeq || b.age - a.age || (a.id < b.id ? 1 : -1));
  }

  /** Records an entry (respecting the per-spin limit and the bounded size). */
  record(ctx: SpinContext, position: number, symbol: SymbolId, age: Age, reason: EchoReason): EchoEntry | null {
    if (!ctx.cfg.symbols[symbol].ageable) return null;
    if (ctx.echoEntriesThisSpin >= ctx.cfg.echo.maxNewEntriesPerSpin) return null;
    ctx.echoEntriesThisSpin++;
    const cell = ctx.board.cells[position];
    const entry: EchoEntry = {
      id: `E${++this.counter}`,
      roundId: ctx.roundId,
      boardId: `${ctx.roundId}:S${ctx.spinIndex}`,
      spinIndex: ctx.spinIndex,
      cascadeIndex: ctx.cascadeIndex,
      spinSeq: ctx.spinSeq,
      symbol: symbol as PayingSymbolId,
      age,
      position,
      flags: { frozen: !!cell?.frozen },
      reason,
      expiresAfterSpinSeq: ctx.spinSeq + this.ttlSpins,
      status: 'ACTIVE',
    };
    this.active.push(entry);
    while (this.active.length > this.maxEntries) this.retire(this.active.shift()!, 'EVICTED');
    ctx.stats.echoesRecorded++;
    ctx.emit('ECHO_RECORDED', { entry: { ...entry } });
    return entry;
  }

  /**
   * "Remnants of the Hour": entries drawn at round start from the round's own RNG (stateless).
   * They count as created before the round's first spin and do not use the per-spin quota.
   */
  seedRemnants(ctx: SpinContext): EchoEntry[] {
    const cfg = ctx.cfg;
    const count = weightedPick(ctx.rng, Object.fromEntries(cfg.roundStart.remnantCount.map((e) => [String(e.value), e.weight])));
    const symbolWeights = Object.fromEntries(Object.entries(cfg.weights.refill).filter(([s]) => cfg.symbols[s as SymbolId].ageable)) as Record<SymbolId, number>;
    const [a0, a1, a2] = cfg.roundStart.remnantAgeWeights;
    const out: EchoEntry[] = [];
    for (let i = 0; i < Number(count); i++) {
      const symbol = weightedPick(ctx.rng, symbolWeights) as PayingSymbolId;
      const age = Number(weightedPick(ctx.rng, { 0: a0, 1: a1, 2: a2 })) as Age;
      const position = ctx.rng.int(ctx.board.cells.length);
      const entry: EchoEntry = {
        id: `E${++this.counter}`, roundId: ctx.roundId, boardId: `${ctx.roundId}:remnant`, spinIndex: ctx.spinIndex, cascadeIndex: -1,
        spinSeq: ctx.spinSeq - 1, symbol, age, position, flags: { frozen: false }, reason: 'HOUR_REMNANT',
        expiresAfterSpinSeq: ctx.spinSeq - 1 + this.ttlSpins, status: 'ACTIVE',
      };
      this.active.push(entry);
      while (this.active.length > this.maxEntries) this.retire(this.active.shift()!, 'EVICTED');
      ctx.stats.echoesRecorded++;
      ctx.emit('ECHO_RECORDED', { entry: { ...entry } });
      out.push(entry);
    }
    return out;
  }

  /** Round-scope reset (stateless profile). */
  clear() {
    this.active = [];
    this.history = [];
  }

  consume(entry: EchoEntry, by: EchoEntry['consumedBy']) {
    if (entry.status !== 'ACTIVE') throw new Error(`echo ${entry.id} is ${entry.status} and cannot be consumed`);
    entry.consumedBy = by;
    this.active = this.active.filter((e) => e !== entry);
    this.retire(entry, 'CONSUMED');
  }

  /** Serializable copy for UI / persistence of demo state. */
  toJSON() {
    return { active: this.active.map((e) => ({ ...e })), recent: this.history.map((e) => ({ ...e })), counter: this.counter };
  }
}

/**
 * Projects up to `count` eligible echoes onto the current board.
 *
 * Selection: newest eligible entry first (then higher age).
 * Mapping: the entry's recorded position; if that cell is not a legal temporal
 * target (wild, ticket, clockmaker, frozen, empty, or already targeted in this
 * batch) the orthogonal neighbours are tried in the order up, right, down, left.
 * Effect (RESTORE): the target cell becomes the remembered symbol at its
 * remembered age + echo.ageOnReturn (capped at Hollow) — echoes come back older. The entry is consumed. If no target exists the entry is left
 * ACTIVE and the next eligible entry is tried.
 * An echo-restored Hollow does NOT create a new ledger entry (no echo loops).
 */
export function projectEchoes(ctx: SpinContext, count: number): number {
  if (count <= 0) return 0;
  const targeted = new Set<number>();
  let projected = 0;
  for (const entry of ctx.echo.eligible(ctx.spinSeq, ctx.cascadeIndex)) {
    if (projected >= count) break;
    const candidates = [entry.position, ...neighbors(ctx.board, entry.position)];
    const target = candidates.find((p) => !targeted.has(p) && isTemporalTarget(ctx.board.cells[p]));
    if (target === undefined) continue;
    const cell = ctx.board.cells[target]!;
    const from = { sym: cell.sym, age: cell.age };
    cell.sym = entry.symbol;
    cell.age = Math.min(2, entry.age + ctx.cfg.echo.ageOnReturn) as Age;
    targeted.add(target);
    ctx.echo.consume(entry, { roundId: ctx.roundId, spinSeq: ctx.spinSeq, position: target });
    projected++;
    ctx.stats.echoesProjected++;
    ctx.temporalEffectThisSpin = true;
    ctx.emit('ECHO_PROJECTED', { entry: { ...entry }, position: target, from, to: { sym: cell.sym, age: cell.age }, consumed: true, board: ctx.snap() });
    ctx.debt.add(ctx, 'ECHO_PROJECTED', ctx.cfg.debt.gains.ECHO_PROJECTED);
  }
  return projected;
}
