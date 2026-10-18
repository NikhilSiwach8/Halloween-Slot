/**
 * The book event format: how a whole Dead Frequency round is stored in a Stake Engine book and
 * returned to the client as `round.state`.
 *
 * Each book holds the complete round in compact form: every board as it landed (24 symbol codes,
 * reel by reel, plus wild multipliers), the Static reveal and Retune, the paid win of every spin,
 * the Signal Meter, retriggers, the Mystery prize and every bonus spin. Way wins are not stored:
 * they follow from the revealed board, so the client recomputes them with the same evaluator and
 * checks that they add up to the stored wins and to the RGS payout before showing anything.
 */
import { PAYING_SYMBOLS } from '../config/symbols';
import type { BonusType, GameConfig, ModeId, MysteryPrize, PayingSymbolId, SymbolId } from '../config/types';
import { countSymbol, positionsOf, type Board } from '../engine/board';
import type { BonusResult, RoundResult, SpinResult } from '../engine/round';
import { evaluateWays } from '../engine/ways';

const CODE: Record<SymbolId, string> = {
  VALVE: 'v', CASSETTE: 'c', MIC: 'm', HEADPHONES: 'h', RADIO: 'R', WIDOW: 'D', PRIEST: 'P', HOST: 'N',
  WILD: 'W', STATIC: 'S', ANTENNA: 'A', TAPE: 'T',
};
const SYMBOL = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k])) as Record<string, SymbolId>;

/** One spin: `b` board codes (reel by reel), `m` wild multipliers [cell, x], `r` [first, retuned?], `w` paid win (x100). */
export interface SpinData {
  b: string;
  m?: [number, number][];
  r?: [string] | [string, string];
  w: number;
  /** Night Shift Signal Meter. */
  g?: number;
  /** Spins added by a retrigger. */
  x?: number;
}

export interface RoundEvent {
  index: 0;
  type: 'deadFrequencyRound';
  /** Math version the book was generated with. */
  v: string;
  mode: ModeId;
  spin?: SpinData;
  mystery?: { prize: MysteryPrize; w: number };
  bonuses: { t: BonusType; s: BonusResult['source']; n: number; spins: SpinData[] }[];
  win: number;
  capped: boolean;
}

export interface FinalWinEvent {
  index: 1;
  type: 'finalWin';
  /** Total round win in hundredths of the base bet (equals the book's payoutMultiplier). */
  amount: number;
}

export type BookEvents = [RoundEvent, FinalWinEvent];

function encodeSpin(cfg: GameConfig, s: SpinResult): SpinData {
  let b = '';
  const m: [number, number][] = [];
  s.landed.forEach((reel, r) =>
    reel.forEach((c, row) => {
      b += CODE[c.s];
      if (c.s === 'WILD' && c.m > 1) m.push([r * cfg.rows + row, c.m]);
    }),
  );
  const out: SpinData = { b, w: s.winX100 };
  if (m.length) out.m = m;
  if (s.reveal) out.r = s.reveal.retunedTo ? [CODE[s.reveal.first], CODE[s.reveal.retunedTo]] : [CODE[s.reveal.first]];
  if (s.signalMeter !== undefined) out.g = s.signalMeter;
  if (s.retrigger) out.x = s.retrigger;
  return out;
}

export function encodeRound(cfg: GameConfig, round: RoundResult): BookEvents {
  return [
    {
      index: 0,
      type: 'deadFrequencyRound',
      v: cfg.version,
      mode: round.mode,
      ...(round.spin ? { spin: encodeSpin(cfg, round.spin) } : {}),
      ...(round.mystery ? { mystery: { prize: round.mystery.prize, w: round.mystery.winX100 } } : {}),
      bonuses: round.bonuses.map((b) => ({ t: b.type, s: b.source, n: b.totalSpins, spins: b.spins.map((s) => encodeSpin(cfg, s)) })),
      win: round.winX100,
      capped: round.capped,
    },
    { index: 1, type: 'finalWin', amount: round.winX100 },
  ];
}

export class BookFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookFormatError';
  }
}

function decodeSpin(cfg: GameConfig, d: SpinData): SpinResult & { rawX100: number } {
  if (typeof d.b !== 'string' || d.b.length !== cfg.reels * cfg.rows) throw new BookFormatError('bad board');
  const landed: Board = [];
  for (let r = 0; r < cfg.reels; r++) {
    landed.push([]);
    for (let row = 0; row < cfg.rows; row++) {
      const s = SYMBOL[d.b[r * cfg.rows + row]];
      if (!s) throw new BookFormatError(`bad symbol code ${d.b[r * cfg.rows + row]}`);
      landed[r].push({ s, m: 1 });
    }
  }
  for (const [i, x] of d.m ?? []) {
    const c = landed[Math.floor(i / cfg.rows)]?.[i % cfg.rows];
    if (!c || c.s !== 'WILD') throw new BookFormatError('multiplier on a non-wild cell');
    c.m = x;
  }
  const positions = positionsOf(landed, 'STATIC');
  let reveal: SpinResult['reveal'] = null;
  let board = landed;
  if (positions.length) {
    if (!d.r) throw new BookFormatError('Static without a reveal');
    const first = SYMBOL[d.r[0]] as PayingSymbolId;
    const retunedTo = d.r[1] ? (SYMBOL[d.r[1]] as PayingSymbolId) : undefined;
    for (const s of [first, retunedTo]) if (s && !(PAYING_SYMBOLS as readonly string[]).includes(s)) throw new BookFormatError('reveal is not a paying symbol');
    reveal = { positions, first, ...(retunedTo ? { retunedTo } : {}) };
    const final = retunedTo ?? first;
    board = landed.map((reel) => reel.map((c) => (c.s === 'STATIC' ? { s: final, m: 1 } : { ...c })));
  }
  const { wins, totalX100 } = evaluateWays(cfg, board, d.g ?? 1);
  return {
    landed,
    board,
    reveal,
    wins,
    winX100: d.w,
    rawX100: totalX100,
    antennas: countSymbol(landed, 'ANTENNA'),
    tape: countSymbol(landed, 'TAPE') > 0,
    ...(d.g !== undefined ? { signalMeter: d.g } : {}),
    ...(d.x ? { retrigger: d.x } : {}),
  };
}

/**
 * Rebuilds the round from `round.state` and checks it: every spin's recomputed way wins must equal
 * its stored win (only the spin that reaches the max win may be cut down), and everything must
 * add up to the stored total. Throws BookFormatError on any inconsistency.
 */
export function decodeRound(cfg: GameConfig, state: unknown): RoundResult {
  const ev = (Array.isArray(state) ? state[0] : null) as RoundEvent | null;
  if (!ev || ev.type !== 'deadFrequencyRound') throw new BookFormatError('unrecognised round state');
  if (ev.v !== cfg.version) throw new BookFormatError(`math version mismatch (book ${ev.v}, client ${cfg.version})`);
  if (!cfg.modes[ev.mode]) throw new BookFormatError(`unknown mode ${ev.mode}`);
  const spins: (SpinResult & { rawX100: number })[] = [];
  const take = (d: SpinData) => {
    const s = decodeSpin(cfg, d);
    spins.push(s);
    return s;
  };
  const spin = ev.spin ? take(ev.spin) : null;
  const bonuses: BonusResult[] = (ev.bonuses ?? []).map((b) => {
    if (!cfg.bonuses[b.t]) throw new BookFormatError(`unknown bonus ${b.t}`);
    const bs = b.spins.map(take);
    return { type: b.t, source: b.s, totalSpins: b.n, spins: bs, winX100: bs.reduce((a, s) => a + s.winX100, 0) };
  });
  const mystery = ev.mystery ? { prize: ev.mystery.prize, winX100: ev.mystery.w } : null;
  if (mystery && mystery.prize.kind === 'CASH' && mystery.winX100 > mystery.prize.x100) throw new BookFormatError('mystery cash above its prize');

  let total = mystery?.winX100 ?? 0;
  spins.forEach((s, i) => {
    total += s.winX100;
    const isCappingSpin = ev.capped && i === spins.length - 1;
    if (isCappingSpin ? s.winX100 > s.rawX100 : s.winX100 !== s.rawX100) throw new BookFormatError(`spin ${i} win ${s.winX100} does not match its board (${s.rawX100})`);
  });
  if (total !== ev.win) throw new BookFormatError(`round wins add up to ${total}, book says ${ev.win}`);
  if (ev.win > cfg.maxWinX * 100 || (ev.capped && ev.win !== cfg.maxWinX * 100)) throw new BookFormatError('max win inconsistent');
  return { mode: ev.mode, cost: cfg.modes[ev.mode].cost, spin, mystery, bonuses, winX100: ev.win, capped: ev.capped };
}
