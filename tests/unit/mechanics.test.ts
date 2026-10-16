import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/gameConfig';
import type { Age } from '../../src/config/types';
import { applyClockmakerChoice } from '../../src/mechanics/clockmakerChoice/clockmakerChoice';
import { EchoLedger, projectEchoes } from '../../src/mechanics/echoLedger/echoLedger';
import { ParadoxDebt, debtStateOf, resolveDischargeIfDue } from '../../src/mechanics/paradoxDebt/paradoxDebt';
import { deriveHollowTimeline, resolveParadoxSplit } from '../../src/mechanics/paradoxSplit/paradoxSplit';
import { applyAgeSteps, nextAgeTransition } from '../../src/mechanics/threeAges/ages';
import { resolveFractureSpread, resolveOrbBurst } from '../../src/mechanics/timeCorruption/corruption';
import { snapshot } from '../../src/engine/board/board';
import { FixedRng, devConfig, grid, makeCtx } from './helpers';

const BOARD = grid(`
  c k m n w
  k m n w c
  m n w c k
  n w c k m
  w c k m n`);

describe('Three Ages', () => {
  const cfg = DEFAULT_CONFIG;
  it('progresses one step at a time and never reverses or skips', () => {
    expect(nextAgeTransition(cfg, { sym: 'RAVEN', age: 0 })).toEqual({ kind: 'ADVANCE', from: 0, to: 1 });
    expect(nextAgeTransition(cfg, { sym: 'RAVEN', age: 1 })).toEqual({ kind: 'ADVANCE', from: 1, to: 2 });
  });
  it('a Hollow symbol collapses to a Chrono Wild when aged again (default rules)', () => {
    expect(nextAgeTransition(cfg, { sym: 'RAVEN', age: 2 })).toEqual({ kind: 'COLLAPSE_TO_WILD', from: 2 });
    expect(nextAgeTransition(cfg, { sym: 'RAVEN', age: 2 }, false)).toEqual({ kind: 'NONE', reason: 'COLLAPSE_NOT_ALLOWED' });
  });
  it('PERMANENT_HOLLOW configuration keeps Hollow symbols Hollow', () => {
    const c = devConfig((x) => (x.ages.hollowOverflow = 'PERMANENT_HOLLOW'));
    expect(nextAgeTransition(c, { sym: 'RAVEN', age: 2 }).kind).toBe('NONE');
  });
  it('wilds, tickets and the clockmaker are not ageable', () => {
    for (const sym of ['WILD', 'TICKET', 'CLOCKMAKER'] as const) expect(nextAgeTransition(cfg, { sym, age: 0 }).kind).toBe('NONE');
  });
  it('forming a Hollow symbol adds Paradox Debt and an Echo Ledger entry', () => {
    const ctx = makeCtx(BOARD, { ages: [1, ...Array(24).fill(0)] as Age[] });
    applyAgeSteps(ctx, [0], 'CORRUPTION');
    expect(ctx.board.cells[0]!.age).toBe(2);
    expect(ctx.debt.value).toBe(cfg.debt.gains.HOLLOW_FORMED);
    expect(ctx.echo.entries()).toHaveLength(1);
    expect(ctx.echo.entries()[0]).toMatchObject({ symbol: 'L_COG', age: 2, position: 0, reason: 'HOLLOW_FORMED' });
  });
  it('frozen cells are skipped unless explicitly included', () => {
    const ctx = makeCtx(BOARD);
    ctx.board.cells[0]!.frozen = true;
    expect(applyAgeSteps(ctx, [0], 'CORRUPTION')).toEqual([]);
    expect(applyAgeSteps(ctx, [0], 'FROZEN_WIN', { includeFrozen: true })).toHaveLength(1);
  });
});

describe('Time Corruption', () => {
  it('only changes surviving ageable cells adjacent to removed winners', () => {
    const syms = grid(`
      c c c t *
      k m n w c
      m n w c k
      n w c k m
      w c k m n`);
    const ctx = makeCtx(syms, { rng: new FixedRng([0]) }); // every draw succeeds
    // positions 0,1,2 "won" and were removed
    for (const p of [0, 1, 2]) ctx.board.cells[p] = null;
    const affected = resolveFractureSpread(ctx, [0, 1, 2]);
    // neighbours: 3 (ticket: ineligible), 5, 6, 7 → only ageable ones
    expect(affected).toEqual([5, 6, 7]);
    for (const i of affected) expect(ctx.board.cells[i]!.age).toBe(1);
    expect(ctx.board.cells[3]!.sym).toBe('TICKET');
    expect(ctx.board.cells[4]!.sym).toBe('WILD');
    expect(ctx.board.cells[8]!.age).toBe(0);
  });
  it('failed probability draws change nothing', () => {
    const ctx = makeCtx(BOARD, { rng: new FixedRng([0.999]) });
    ctx.board.cells[12] = null;
    expect(resolveFractureSpread(ctx, [12])).toEqual([]);
    expect(ctx.board.cells.every((c) => !c || c.age === 0)).toBe(true);
  });
  it('respects maxTransformationsPerStep', () => {
    const cfg = devConfig((c) => (c.corruption.maxTransformationsPerStep = 2));
    const ctx = makeCtx(BOARD, { cfg, rng: new FixedRng([0]) });
    for (const p of [6, 7, 8]) ctx.board.cells[p] = null;
    expect(resolveFractureSpread(ctx, [6, 7, 8])).toHaveLength(2);
  });
  it('the debt state at spin start raises the corruption chance', () => {
    const ctx = makeCtx(BOARD, { debtState: 'CRITICAL' });
    ctx.board.cells[12] = null;
    resolveFractureSpread(ctx, [12]);
    const ev = ctx.eventsOf('TIME_CORRUPTION_APPLIED')[0];
    expect(ev.chance).toBeCloseTo(DEFAULT_CONFIG.corruption.adjacentChance + DEFAULT_CONFIG.corruption.debtStateBonus.CRITICAL);
  });
  it('Orb Burst ages exactly orbBurstCells distinct eligible cells', () => {
    const ctx = makeCtx(BOARD);
    const affected = resolveOrbBurst(ctx);
    expect(new Set(affected).size).toBe(DEFAULT_CONFIG.corruption.orbBurstCells);
    expect(ctx.board.cells.filter((c) => c!.age === 1)).toHaveLength(DEFAULT_CONFIG.corruption.orbBurstCells);
  });
});

describe('Echo Ledger', () => {
  const ledgerWithEntry = (spinSeq = 1) => {
    const echo = new EchoLedger(DEFAULT_CONFIG.echo.maxEntries, DEFAULT_CONFIG.echo.ttlSpins);
    const rec = makeCtx(BOARD, { echo, spinSeq });
    echo.record(rec, 12, 'RAVEN', 1, 'AGED_CLUSTER_WON');
    return echo;
  };

  it('entries are eligible only in later spins', () => {
    const echo = ledgerWithEntry(5);
    expect(echo.eligible(5)).toHaveLength(0);
    expect(echo.eligible(6)).toHaveLength(1);
  });

  it('expired entries cannot activate', () => {
    const echo = ledgerWithEntry(1);
    const ttl = DEFAULT_CONFIG.echo.ttlSpins;
    expect(echo.eligible(1 + ttl)).toHaveLength(1);
    expect(echo.expire(2 + ttl)).toHaveLength(1);
    const ctx = makeCtx(BOARD, { echo, spinSeq: 2 + ttl });
    expect(projectEchoes(ctx, 1)).toBe(0);
    expect(echo.recent()[0].status).toBe('EXPIRED');
  });

  it('projection restores the remembered symbol one Age older and consumes the entry', () => {
    const echo = ledgerWithEntry(1);
    const ctx = makeCtx(BOARD, { echo, spinSeq: 2 });
    expect(projectEchoes(ctx, 1)).toBe(1);
    expect(ctx.board.cells[12]).toMatchObject({ sym: 'RAVEN', age: 2 });
    expect(echo.entries()).toHaveLength(0);
    expect(echo.recent()[0].status).toBe('CONSUMED');
    // a consumed entry can never project again
    expect(projectEchoes(makeCtx(BOARD, { echo, spinSeq: 3 }), 1)).toBe(0);
  });

  it('projection never creates an award on its own (no replayed payouts)', () => {
    const echo = ledgerWithEntry(1);
    const ctx = makeCtx(BOARD, { echo, spinSeq: 2 });
    projectEchoes(ctx, 1);
    expect(ctx.payouts.list()).toHaveLength(0);
    expect(ctx.eventsOf('WIN_RECORDED')).toHaveLength(0);
  });

  it('falls back to a neighbour when the recorded position is not a legal target', () => {
    const echo = ledgerWithEntry(1);
    const syms = BOARD.slice();
    syms[12] = 'WILD';
    const ctx = makeCtx(syms, { echo, spinSeq: 2 });
    projectEchoes(ctx, 1);
    expect(ctx.board.cells[12]!.sym).toBe('WILD');
    expect(ctx.board.cells[7]!.sym).toBe('RAVEN'); // "up" is tried first
  });

  it('is bounded: the oldest entries are evicted', () => {
    const echo = new EchoLedger(3, 10);
    for (let s = 1; s <= 5; s++) echo.record(makeCtx(BOARD, { echo, spinSeq: s }), s, 'WATCH', 0, 'CLUSTER_WON');
    expect(echo.entries()).toHaveLength(3);
    expect(echo.entries().map((e) => e.spinSeq)).toEqual([3, 4, 5]);
    expect(echo.recent().filter((e) => e.status === 'EVICTED')).toHaveLength(2);
  });

  it('newest eligible entries are selected first', () => {
    const echo = new EchoLedger(12, 10);
    echo.record(makeCtx(BOARD, { echo, spinSeq: 1 }), 0, 'WATCH', 0, 'CLUSTER_WON');
    echo.record(makeCtx(BOARD, { echo, spinSeq: 2 }), 24, 'SKULL', 0, 'CLUSTER_WON');
    expect(echo.eligible(3)[0].symbol).toBe('SKULL');
  });
});

describe('Paradox Split', () => {
  it('Timeline B is Timeline A with every ageable symbol one Age older (Hollow stays Hollow)', () => {
    const ctx = makeCtx(BOARD, { ages: [2, 1, ...Array(23).fill(0)] as Age[] });
    const hollow = deriveHollowTimeline(snapshot(ctx.board));
    expect(hollow[0]!.age).toBe(2);
    expect(hollow[1]!.age).toBe(2);
    expect(hollow[2]!.age).toBe(1);
  });

  it('the merged board = Present everywhere except the selected cells, which take the Hollow state', () => {
    const ctx = makeCtx(BOARD);
    const selected = resolveParadoxSplit(ctx, 'FORCED', DEFAULT_CONFIG.split.cells);
    const started = ctx.eventsOf('PARADOX_SPLIT_STARTED')[0];
    const resolved = ctx.eventsOf('PARADOX_SPLIT_RESOLVED')[0];
    expect(selected).toHaveLength(DEFAULT_CONFIG.split.cells);
    resolved.board.forEach((cell, i) => {
      const expected = selected.includes(i) ? started.hollow[i] : started.present[i];
      expect(cell).toEqual(expected);
    });
    expect(ctx.payouts.list()).toHaveLength(0); // no separate payout stream
  });

  it('CRITICAL debt and a primed split add cells; the prime is consumed', () => {
    const ctx = makeCtx(BOARD, { debtState: 'CRITICAL' });
    ctx.session.splitPrimedCells = 3;
    const sel = resolveParadoxSplit(ctx, 'FORCED', 6);
    expect(sel).toHaveLength(6 + DEFAULT_CONFIG.split.criticalBonusCells + 3);
    expect(ctx.session.splitPrimedCells).toBe(0);
  });
});

describe('Paradox Debt', () => {
  const cfg = DEFAULT_CONFIG;
  it('maps values to states exactly at the configured thresholds', () => {
    const t = cfg.debt.thresholds;
    expect(debtStateOf(cfg, t.UNSTABLE - 1)).toBe('STABLE');
    expect(debtStateOf(cfg, t.UNSTABLE)).toBe('UNSTABLE');
    expect(debtStateOf(cfg, t.CRITICAL - 1)).toBe('UNSTABLE');
    expect(debtStateOf(cfg, t.CRITICAL)).toBe('CRITICAL');
    expect(debtStateOf(cfg, t.DISCHARGE - 1)).toBe('CRITICAL');
    expect(debtStateOf(cfg, t.DISCHARGE)).toBe('DISCHARGE');
  });

  it('is clamped to [0, max]', () => {
    const ctx = makeCtx(BOARD);
    ctx.debt.add(ctx, 'TEST', 500);
    expect(ctx.debt.value).toBe(cfg.debt.max);
  });

  it('does not discharge below the threshold', () => {
    const debt = new ParadoxDebt(cfg, cfg.debt.thresholds.DISCHARGE - 1);
    const ctx = makeCtx(BOARD, { debt });
    expect(resolveDischargeIfDue(ctx)).toBe(false);
    expect(ctx.events).toHaveLength(0);
  });

  it('discharges at the threshold: resets, ages a 3x3 region, at most once per spin', () => {
    const debt = new ParadoxDebt(cfg, cfg.debt.thresholds.DISCHARGE);
    const ctx = makeCtx(BOARD, { debt });
    expect(resolveDischargeIfDue(ctx)).toBe(true);
    const ev = ctx.eventsOf('DEBT_DISCHARGED')[0];
    expect(ev.region).toHaveLength(9);
    for (const i of ev.region) expect(ctx.board.cells[i]!.age).toBe(1);
    expect(ctx.board.cells.filter((c) => c!.age > 0)).toHaveLength(9);
    debt.forceValue(cfg.debt.max);
    expect(resolveDischargeIfDue(ctx)).toBe(false);
  });
});

describe("Clockmaker's Choice paths", () => {
  const withClockmaker = () => {
    const syms = BOARD.slice();
    syms[12] = 'CLOCKMAKER';
    return syms;
  };
  it('Break the Future advances exactly advanceCells cells, primes the next split and leaves a wild', () => {
    const ctx = makeCtx(withClockmaker());
    applyClockmakerChoice(ctx, 'BREAK_FUTURE', [12]);
    expect(ctx.board.cells.filter((c) => c!.age === 1)).toHaveLength(DEFAULT_CONFIG.clockmaker.breakFuture.advanceCells);
    expect(ctx.session.splitPrimedCells).toBe(DEFAULT_CONFIG.clockmaker.breakFuture.primeSplitCells);
    expect(ctx.board.cells[12]!.sym).toBe('WILD');
    expect(ctx.eventsOf('CLOCKMAKER_CHOICE_SELECTED')).toEqual([expect.objectContaining({ path: 'BREAK_FUTURE' })]);
  });
  it('Preserve the Past with an empty ledger fractures fallback cells instead', () => {
    const ctx = makeCtx(withClockmaker());
    applyClockmakerChoice(ctx, 'PRESERVE_PAST', [12]);
    expect(ctx.board.cells.filter((c) => c!.age === 1)).toHaveLength(DEFAULT_CONFIG.clockmaker.preservePast.fallbackFractureCells);
    expect(ctx.session.splitPrimedCells).toBe(0);
  });
  it('Preserve the Past projects echoes when the ledger has them', () => {
    const echo = new EchoLedger(12, 10);
    echo.record(makeCtx(BOARD, { echo, spinSeq: 1 }), 0, 'SKULL', 0, 'CLUSTER_WON');
    echo.record(makeCtx(BOARD, { echo, spinSeq: 1 }), 24, 'RAVEN', 1, 'AGED_CLUSTER_WON');
    const ctx = makeCtx(withClockmaker(), { echo, spinSeq: 2 });
    applyClockmakerChoice(ctx, 'PRESERVE_PAST', [12]);
    expect(ctx.eventsOf('ECHO_PROJECTED')).toHaveLength(2);
    expect(ctx.board.cells[0]).toMatchObject({ sym: 'SKULL', age: 1 });
    expect(ctx.board.cells[24]).toMatchObject({ sym: 'RAVEN', age: 2 });
  });
});
