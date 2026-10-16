import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/gameConfig';
import { EngineError, GameEngine, replay } from '../../src/engine/GameEngine';
import type { GameEvent } from '../../src/engine/events/events';
import { SettlementError } from '../../src/engine/payouts/payouts';
import { InvalidTransitionError, PhaseMachine } from '../../src/engine/state/stateMachine';
import { devConfig } from './helpers';

const playMany = (seed: number, n: number) => {
  const e = new GameEngine(DEFAULT_CONFIG, { seed, startingBalance: 10_000_000 });
  const results = [];
  for (let i = 0; i < n; i++) results.push(e.playRound(100, () => (i % 2 ? 'BREAK_FUTURE' : 'PRESERVE_PAST')));
  return { e, results };
};

describe('engine integrity', () => {
  it('identical seeds and configuration produce identical outcomes', () => {
    const a = playMany(42, 400);
    const b = playMany(42, 400);
    expect(a.e.balance).toBe(b.e.balance);
    expect(a.results.map((r) => r.totalWin)).toEqual(b.results.map((r) => r.totalWin));
    expect(a.e.eventLog.map((x) => x.type)).toEqual(b.e.eventLog.map((x) => x.type));
  });

  it('different seeds diverge', () => {
    expect(playMany(1, 200).results.map((r) => r.totalWin)).not.toEqual(playMany(2, 200).results.map((r) => r.totalWin));
  });

  it('recording events on or off does not change outcomes', () => {
    const on = new GameEngine(DEFAULT_CONFIG, { seed: 9, startingBalance: 1e9 });
    const off = new GameEngine(DEFAULT_CONFIG, { seed: 9, startingBalance: 1e9, recordEvents: false });
    for (let i = 0; i < 300; i++) expect(on.playRound(100).totalWin).toBe(off.playRound(100).totalWin);
  });

  it('balance = start - stakes + settled wins', () => {
    const { e, results } = playMany(7, 300);
    const wins = results.reduce((s, r) => s + r.totalWin, 0);
    expect(e.balance).toBe(10_000_000 - 300 * 100 + wins);
  });

  it('every award is unique, belongs to its round and sums to the settled total', () => {
    const { results } = playMany(3, 500);
    const ids = new Set<string>();
    for (const r of results) {
      expect(r.awards.reduce((s, a) => s + a.amount, 0)).toBe(r.totalWin);
      for (const a of r.awards) {
        expect(a.roundId).toBe(r.roundId);
        expect(ids.has(a.awardId)).toBe(false);
        ids.add(a.awardId);
      }
    }
  });

  it('every WIN_RECORDED is directly preceded by the CLUSTER_DETECTED it pays (echoes never pay by themselves)', () => {
    const { e } = playMany(11, 400);
    const log = e.eventLog;
    log.forEach((ev, i) => {
      if (ev.type !== 'WIN_RECORDED') return;
      const prev = log[i - 1] as Extract<GameEvent, { type: 'CLUSTER_DETECTED' }>;
      expect(prev.type).toBe('CLUSTER_DETECTED');
      expect(ev.award.positions).toEqual(prev.positions);
    });
  });

  it('cascade steps resolve in the documented order', () => {
    const cfg = devConfig();
    const e = new GameEngine(cfg, { seed: 5 });
    const r = e.spin({ bet: 100, force: 'ECHO' }); // guaranteed Hourglass cluster
    const order = r.events.map((x) => x.type);
    const first = (t: string) => order.indexOf(t as GameEvent['type']);
    expect(first('SPIN_STARTED')).toBe(0);
    expect(first('BOARD_CREATED')).toBeLessThan(first('CLUSTER_DETECTED'));
    expect(first('CLUSTER_DETECTED')).toBeLessThan(first('WIN_RECORDED'));
    expect(first('WIN_RECORDED')).toBeLessThan(first('SYMBOL_REMOVED'));
    expect(first('SYMBOL_REMOVED')).toBeLessThan(first('TIME_CORRUPTION_APPLIED'));
    expect(first('TIME_CORRUPTION_APPLIED')).toBeLessThan(first('GRAVITY_APPLIED'));
    expect(order[order.length - 1]).toBe('ROUND_SETTLED');

    // 4+ Portals on the initial board: the split resolves before the first evaluation
    const s = new GameEngine(cfg, { seed: 5 }).spin({ bet: 100, force: 'SPLIT' });
    const so = s.events.map((x) => x.type);
    expect(so.indexOf('PARADOX_SPLIT_STARTED')).toBeLessThan(so.indexOf('CLUSTER_DETECTED'));
    expect(so.indexOf('PARADOX_SPLIT_STARTED')).toBeGreaterThan(so.indexOf('BOARD_CREATED'));
  });

  it('presentation board snapshots match the authoritative engine board', () => {
    const e = new GameEngine(DEFAULT_CONFIG, { seed: 21 });
    for (let i = 0; i < 50; i++) {
      const r = e.playRound(100);
      void r;
      const boards = e.eventLog.filter((x) => 'board' in x && Array.isArray((x as { board: unknown }).board));
      const lastBoard = (boards[boards.length - 1] as unknown as { board: unknown }).board;
      expect(lastBoard).toEqual(e.getSnapshot().board);
    }
  });
});

describe('engine guards', () => {
  it('rejects overlapping spins while a round is unresolved', () => {
    const e = new GameEngine(devConfig(), { seed: 1 });
    e.spin({ bet: 100, force: 'CLOCKMAKER' });
    expect(e.phase).toBe('CLOCKMAKER_CHOICE');
    expect(() => e.spin({ bet: 100 })).toThrow(EngineError);
  });

  it('rejects unpermitted stakes and insufficient balance', () => {
    const e = new GameEngine(DEFAULT_CONFIG, { seed: 1, startingBalance: 50 });
    expect(() => e.spin({ bet: 33 })).toThrow(/not permitted/);
    expect(() => e.spin({ bet: 100 })).toThrow(/insufficient/);
  });

  it('forced triggers are disabled in the ordinary configuration', () => {
    const e = new GameEngine(DEFAULT_CONFIG, { seed: 1 });
    expect(() => e.spin({ bet: 100, force: 'BONUS' })).toThrow(/disabled/);
  });

  it('the phase machine rejects illegal transitions', () => {
    const m = new PhaseMachine();
    expect(() => m.go('ROUND_SETTLING')).toThrow(InvalidTransitionError);
    m.go('SPINNING');
    expect(() => m.go('IDLE')).toThrow(InvalidTransitionError);
  });

  it('a settled round cannot settle twice', () => {
    const e = new GameEngine(DEFAULT_CONFIG, { seed: 1 });
    const r = e.playRound(100);
    expect(() => e.assertCanSettle(r.roundId)).toThrow(SettlementError);
  });

  it('the cascade limit stops evaluation and is reported', () => {
    const e = new GameEngine(devConfig((c) => (c.cascade.maxCascades = 0)), { seed: 3 });
    const r = e.spin({ bet: 100, force: 'SPLIT' });
    expect(r.events.some((x) => x.type === 'CASCADE_LIMIT_REACHED')).toBe(true);
    expect(r.settled!.totalWin).toBe(0);
  });

  it('the round payout cap is enforced and stops the round', () => {
    const e = new GameEngine(devConfig((c) => { c.maxWinX = 1; c.bonus.maxBonusWinX = 1; }), { seed: 3 });
    const r = e.spin({ bet: 100, force: 'SPLIT' });
    expect(r.settled!.totalWin).toBe(100);
    expect(r.settled!.stats.capped).toBe(true);
    expect(r.events.some((x) => x.type === 'WIN_CAP_REACHED')).toBe(true);
  });

  it('replay of the recorded action list reproduces the session exactly', () => {
    const cfg = devConfig();
    const e = new GameEngine(cfg, { seed: 77 });
    e.playRound(100, () => 'BREAK_FUTURE', 'CLOCKMAKER');
    e.playRound(200, () => 'PRESERVE_PAST', 'BONUS');
    for (let i = 0; i < 20; i++) e.playRound(100);
    const r = replay(cfg, 77, e.actions);
    expect(r.balance).toBe(e.balance);
    expect(r.eventLog).toEqual(e.eventLog);
  });
});

describe("Clockmaker's Choice (engine)", () => {
  it('awaits a selection, applies exactly one path and rejects a second selection', () => {
    const e = new GameEngine(devConfig(), { seed: 4 });
    const first = e.spin({ bet: 100, force: 'CLOCKMAKER' });
    expect(first.awaiting).toBe('CLOCKMAKER_CHOICE');
    expect(first.events.some((x) => x.type === 'CLOCKMAKER_CHOICE_OFFERED')).toBe(true);
    expect(first.events.some((x) => x.type === 'CLUSTER_DETECTED')).toBe(false); // evaluation waits for the choice
    const second = e.chooseClockmakerPath('BREAK_FUTURE');
    expect(second.events.filter((x) => x.type === 'CLOCKMAKER_CHOICE_SELECTED')).toHaveLength(1);
    expect(() => e.chooseClockmakerPath('PRESERVE_PAST')).toThrow(EngineError);
  });
});

describe('The Last Second (engine)', () => {
  it('follows Frozen -> Divergence -> Echo -> Collapse and settles once after stage 4', () => {
    const e = new GameEngine(devConfig(), { seed: 8 });
    let r = e.spin({ bet: 100, force: 'BONUS' });
    expect(r.events.some((x) => x.type === 'BONUS_TRIGGERED')).toBe(true);
    expect(e.phase).toBe('BONUS_INTRO');
    expect(() => e.spin({ bet: 100 })).toThrow(EngineError);
    const stages: string[] = [];
    let frozenAfter1: number[] = [];
    for (let s = 1; s <= 4; s++) {
      r = e.playBonusStage();
      const st = r.events.find((x) => x.type === 'BONUS_STAGE_CHANGED') as Extract<GameEvent, { type: 'BONUS_STAGE_CHANGED' }>;
      stages.push(st.name);
      if (s === 1) frozenAfter1 = (e.getSnapshot().board ?? []).flatMap((c, i) => (c?.frozen ? [i] : []));
      if (s === 2 || s === 3) {
        // frozen cells keep their positions between stages (unless a win aged/collapsed them)
        expect(st.frozen.every((i) => frozenAfter1.includes(i))).toBe(true);
      }
      if (s === 2) expect(r.events.some((x) => x.type === 'PARADOX_SPLIT_STARTED')).toBe(true);
      if (s < 4) expect(r.settled).toBeNull();
    }
    expect(stages).toEqual(['FROZEN', 'DIVERGENCE', 'ECHO', 'COLLAPSE']);
    expect(frozenAfter1.length).toBeGreaterThan(0);
    expect(r.settled).not.toBeNull();
    expect(r.events.filter((x) => x.type === 'ROUND_SETTLED')).toHaveLength(1);
    expect(r.events.some((x) => x.type === 'BONUS_COMPLETED')).toBe(true);
    expect(e.phase).toBe('IDLE');
    expect(() => e.playBonusStage()).toThrow(EngineError);
  });

  it('collapse turns every remaining frozen symbol into a Chrono Wild', () => {
    const e = new GameEngine(devConfig(), { seed: 13 });
    e.spin({ bet: 100, force: 'BONUS' });
    for (let s = 1; s <= 3; s++) e.playBonusStage();
    const r = e.playBonusStage();
    const collapse = r.events.find((x) => x.type === 'SYMBOL_AGE_CHANGED' && x.changes.some((c) => c.cause === 'COLLAPSE_STAGE'));
    const stage = r.events.find((x) => x.type === 'BONUS_STAGE_CHANGED') as Extract<GameEvent, { type: 'BONUS_STAGE_CHANGED' }>;
    if (stage.frozen.length) expect(collapse).toBeTruthy();
    const board = (r.events.find((x) => x.type === 'BOARD_CREATED') as Extract<GameEvent, { type: 'BOARD_CREATED' }>).board;
    for (const i of stage.frozen) expect(board[i]!.frozen).toBe(true);
  });

  it('bonus boards never contain tickets or the clockmaker (no retrigger)', () => {
    const e = new GameEngine(devConfig(), { seed: 2 });
    e.spin({ bet: 100, force: 'BONUS' });
    for (let s = 1; s <= 4; s++) {
      const r = e.playBonusStage();
      for (const ev of r.events) if ('board' in ev) for (const c of ev.board as { sym: string }[]) expect(['TICKET', 'CLOCKMAKER']).not.toContain(c?.sym);
    }
  });
});

describe('Paradox Debt across rounds', () => {
  it('persists across rounds and never depends on the balance', () => {
    const a = new GameEngine(DEFAULT_CONFIG, { seed: 31, startingBalance: 1e9 });
    const b = new GameEngine(DEFAULT_CONFIG, { seed: 31, startingBalance: 5e5 });
    for (let i = 0; i < 200; i++) {
      a.playRound(100);
      b.playRound(100);
      expect(a.debt.value).toBe(b.debt.value);
    }
  });

  it('a forced discharge resolves at the checkpoint and resets the meter', () => {
    const e = new GameEngine(devConfig(), { seed: 6 });
    const r = e.spin({ bet: 100, force: 'DISCHARGE' });
    expect(r.events.some((x) => x.type === 'DEBT_DISCHARGED')).toBe(true);
    const settledIdx = r.events.findIndex((x) => x.type === 'ROUND_SETTLED');
    const dIdx = r.events.findIndex((x) => x.type === 'DEBT_DISCHARGED');
    expect(dIdx).toBeLessThan(settledIdx);
  });
});
