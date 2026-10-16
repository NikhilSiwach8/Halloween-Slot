import { DEFAULT_CONFIG, createDevConfig } from '../../src/config/gameConfig';
import type { Age, DebtState, GameConfig, SymbolId } from '../../src/config/types';
import { boardFromSymbols, snapshot } from '../../src/engine/board/board';
import { emptyStats, type SpinContext } from '../../src/engine/context';
import type { EventPayloads, EventType } from '../../src/engine/events/events';
import { PayoutLedger } from '../../src/engine/payouts/payouts';
import { SeededRng, type Rng } from '../../src/engine/rng/rng';
import { EchoLedger } from '../../src/mechanics/echoLedger/echoLedger';
import { ParadoxDebt } from '../../src/mechanics/paradoxDebt/paradoxDebt';

const TOKENS: Record<string, SymbolId> = {
  c: 'L_COG', k: 'L_KEY', m: 'L_MOON', n: 'L_CANDLE', w: 'WATCH', o: 'ORB', p: 'PORTAL', h: 'HOURGLASS',
  r: 'RAVEN', s: 'SKULL', '*': 'WILD', t: 'TICKET', x: 'CLOCKMAKER',
};

/** Parse a 5x5 grid written as rows of single-letter tokens, e.g. "c c c k m". */
export function grid(rows: string): SymbolId[] {
  const toks = rows.trim().split(/\s+/);
  if (toks.length !== 25) throw new Error(`grid needs 25 tokens, got ${toks.length}`);
  return toks.map((t) => {
    const s = TOKENS[t];
    if (!s) throw new Error(`unknown token ${t}`);
    return s;
  });
}

/** Rng returning a fixed cycle of values (for forcing probability outcomes). */
export class FixedRng implements Rng {
  private i = 0;
  draws = 0;
  constructor(private readonly values: number[]) {}
  next() {
    this.draws++;
    return this.values[this.i++ % this.values.length];
  }
  int(n: number) {
    return Math.floor(this.next() * n);
  }
}

export interface TestCtx extends SpinContext {
  events: { type: EventType; payload: unknown }[];
  eventsOf<K extends EventType>(t: K): EventPayloads[K][];
}

export function makeCtx(
  syms: SymbolId[],
  opts: { ages?: Age[]; cfg?: GameConfig; rng?: Rng; spinSeq?: number; debtState?: DebtState; echo?: EchoLedger; debt?: ParadoxDebt; mode?: 'BASE' | 'BONUS' } = {},
): TestCtx {
  const cfg = opts.cfg ?? DEFAULT_CONFIG;
  let uid = 0;
  const uids = { nextUid: () => ++uid };
  const board = boardFromSymbols(uids, cfg.grid.cols, cfg.grid.rows, syms, opts.ages);
  const events: { type: EventType; payload: unknown }[] = [];
  const ctx: TestCtx = {
    cfg, rng: opts.rng ?? new SeededRng(1), uids, board, roundId: 'R1', spinIndex: 0, spinSeq: opts.spinSeq ?? 1, cascadeIndex: 0,
    mode: opts.mode ?? 'BASE', stageMultiplier: 1, refillWeights: cfg.weights.refill, debtStateAtStart: opts.debtState ?? 'STABLE',
    payouts: new PayoutLedger('R1', 100, cfg.maxWinX), echo: opts.echo ?? new EchoLedger(cfg.echo.maxEntries, cfg.echo.ttlSpins),
    debt: opts.debt ?? new ParadoxDebt(cfg), session: { splitPrimedCells: 0 }, bonus: null, stats: emptyStats(), spinWin: 0,
    splitsThisSpin: 0, dischargesThisSpin: 0, echoEntriesThisSpin: 0, temporalEffectThisSpin: false,
    emit: (type, payload) => events.push({ type, payload }),
    snap: () => snapshot(board),
    events,
    eventsOf: <K extends EventType>(t: K) => events.filter((e) => e.type === t).map((e) => e.payload as EventPayloads[K]),
  };
  return ctx;
}

export const devConfig = (patch: (c: GameConfig) => void = () => {}): GameConfig => {
  const c = structuredClone(createDevConfig(DEFAULT_CONFIG));
  patch(c);
  return c;
};
