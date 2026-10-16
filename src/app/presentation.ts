import { SYMBOLS } from '../config/symbols';
import type { Age, ClockmakerPath, DebtState, GameConfig, SymbolId } from '../config/types';
import type { BoardSnapshot } from '../engine/board/board';
import type { Awaiting, EngineSnapshot } from '../engine/GameEngine';
import type { GameEvent } from '../engine/events/events';
import type { GamePhase } from '../engine/state/stateMachine';
import type { EchoEntry } from '../mechanics/echoLedger/echoLedger';
import { BONUS_STAGES } from '../mechanics/lastSecond/lastSecond';
import { AGE_NAMES } from '../mechanics/threeAges/ages';
import type { SoundCategory } from '../audio/AudioManager';
import { formatCredits } from '../utils/format';

export type Mark = 'win' | 'corrupt-eligible' | 'corrupt' | 'aged' | 'echo' | 'split' | 'frozen-win' | 'discharge' | 'clockmaker' | 'new';

export interface Banner {
  key: number;
  title: string;
  text?: string;
  tone: 'gold' | 'emerald' | 'violet' | 'crimson' | 'blue';
}

export interface DisplayState {
  /** Presentation phase label — mirrors the engine phase of the event being shown. */
  uiPhase: GamePhase;
  board: BoardSnapshot;
  /** True while the decorative pre-game arrangement is shown (no outcome yet). */
  attract: boolean;
  marks: Record<number, Mark>;
  banner: Banner | null;
  floatWin: { key: number; amount: number; at: number } | null;
  spinWin: number;
  roundWin: number;
  lastRoundWin: number | null;
  lastRoundId: string | null;
  balance: number;
  stake: number;
  debt: number;
  debtState: DebtState;
  mode: 'BASE' | 'BONUS';
  bonusStage: number;
  stageMultiplier: number;
  hourMultiplier: number;
  bonusWin: number;
  split: { present: BoardSnapshot; hollow: BoardSnapshot; selected: number[]; merged: boolean } | null;
  echoes: EchoEntry[];
  recentEchoes: EchoEntry[];
  echoFlash: { key: number; entry: EchoEntry; position: number } | null;
  awaiting: Awaiting;
  clockmakerPositions: number[];
  /** Engine-selected Clockmaker's Choice being revealed (path null until the pick is shown). */
  clockmakerReveal: { path: ClockmakerPath | null } | null;
  feed: { key: number; text: string; tone: Banner['tone'] }[];
  busy: boolean;
}

let keySeq = 0;
const nextKey = () => ++keySeq;

/**
 * Decorative title arrangement shown before the first spin. It is NOT an outcome:
 * the board is rendered dimmed with a label, and nothing is evaluated or paid.
 */
const ATTRACT: SymbolId[] = [
  'L_COG', 'RAVEN', 'L_MOON', 'SKULL', 'L_KEY',
  'HOURGLASS', 'L_CANDLE', 'PORTAL', 'L_COG', 'ORB',
  'L_KEY', 'WATCH', 'CLOCKMAKER', 'WILD', 'L_MOON',
  'ORB', 'L_COG', 'TICKET', 'L_CANDLE', 'HOURGLASS',
  'L_MOON', 'SKULL', 'L_KEY', 'RAVEN', 'PORTAL',
];
export function attractBoard(cfg: GameConfig): BoardSnapshot {
  return Array.from({ length: cfg.grid.cols * cfg.grid.rows }, (_, i) => ({ uid: -(i + 1), sym: ATTRACT[i % ATTRACT.length], age: ((i * 7) % 11 === 0 ? 2 : (i * 5) % 9 === 0 ? 1 : 0) as Age, frozen: false }));
}

export function initialDisplay(snap: EngineSnapshot, cfg: GameConfig): DisplayState {
  return {
    uiPhase: snap.phase, board: snap.board ?? attractBoard(cfg), attract: !snap.board, marks: {}, banner: null, floatWin: null, spinWin: 0, roundWin: 0,
    lastRoundWin: snap.lastRound?.totalWin ?? null, lastRoundId: snap.lastRound?.roundId ?? null, balance: snap.balance,
    stake: cfg.defaultBet, debt: snap.debt, debtState: snap.debtState, mode: 'BASE', bonusStage: 0, stageMultiplier: 1, hourMultiplier: 1, bonusWin: 0,
    split: null, echoes: snap.echoes, recentEchoes: snap.recentEchoes, echoFlash: null, awaiting: snap.awaiting,
    clockmakerPositions: [], clockmakerReveal: null, feed: [], busy: false,
  };
}

const marksFor = (positions: readonly number[], mark: Mark, base: Record<number, Mark> = {}) => {
  const m = { ...base };
  for (const p of positions) m[p] = mark;
  return m;
};

const feed = (d: DisplayState, text: string, tone: Banner['tone'] = 'gold') => [{ key: nextKey(), text, tone }, ...d.feed].slice(0, 6);

const KEEPS_SPLIT = new Set<GameEvent['type']>(['PARADOX_SPLIT_STARTED', 'PARADOX_SPLIT_RESOLVED', 'SYMBOL_AGE_CHANGED', 'PARADOX_DEBT_UPDATED', 'ECHO_RECORDED']);
const CLEARS_ECHO = new Set<GameEvent['type']>(['CLUSTER_DETECTED', 'GRAVITY_APPLIED', 'PARADOX_SPLIT_STARTED', 'ROUND_SETTLED', 'BONUS_STAGE_CHANGED']);
const KEEPS_REVEAL = new Set<GameEvent['type']>(['CLOCKMAKER_CHOICE_OFFERED', 'CLOCKMAKER_CHOICE_SELECTED', 'PARADOX_DEBT_UPDATED', 'ECHO_RECORDED']);

/** Pure reducer: engine event -> display state. The UI never computes outcomes itself. */
export function reduceEvent(prev: DisplayState, ev: GameEvent, cfg: GameConfig): DisplayState {
  let d = prev;
  if (d.split?.merged && !KEEPS_SPLIT.has(ev.type)) d = { ...d, split: null };
  if (d.echoFlash && CLEARS_ECHO.has(ev.type)) d = { ...d, echoFlash: null };
  if (d.clockmakerReveal && !KEEPS_REVEAL.has(ev.type)) d = { ...d, clockmakerReveal: null };
  switch (ev.type) {
    case 'SPIN_STARTED':
      return {
        ...d, uiPhase: ev.mode === 'BASE' ? 'SPINNING' : 'BONUS_PLAYING', balance: ev.balance, stake: ev.stake, debt: ev.debt, debtState: ev.debtState,
        spinWin: 0, roundWin: ev.mode === 'BASE' ? 0 : d.roundWin, marks: {}, banner: null, split: null, echoFlash: null, floatWin: null,
        mode: ev.mode, bonusStage: ev.mode === 'BASE' ? 0 : ev.spinIndex, clockmakerPositions: [],
        ...(ev.mode === 'BASE' ? { bonusWin: 0, stageMultiplier: 1, hourMultiplier: 1 } : {}),
      };
    case 'BOARD_CREATED':
      return { ...d, uiPhase: d.mode === 'BASE' ? 'SPINNING' : 'BONUS_PLAYING', board: ev.board, attract: false, marks: marksFor(ev.board.map((_, i) => i), 'new') };
    case 'CLOCKMAKER_CHOICE_OFFERED':
      return {
        ...d, uiPhase: 'CLOCKMAKER_CHOICE', clockmakerPositions: ev.positions, marks: marksFor(ev.positions, 'clockmaker'),
        clockmakerReveal: cfg.clockmaker.selection === 'ENGINE' ? { path: null } : null,
        banner: { key: nextKey(), title: 'The Clockmaker Appears', text: cfg.clockmaker.selection === 'ENGINE' ? 'He weighs two paths\u2026' : 'Two paths. Choose one.', tone: 'gold' },
        feed: feed(d, 'The Clockmaker offers a choice', 'gold'),
      };
    case 'CLOCKMAKER_CHOICE_SELECTED':
      return {
        ...d, uiPhase: 'TEMPORAL_EFFECT', clockmakerPositions: [], clockmakerReveal: ev.selectedBy === 'CLOCKMAKER' ? { path: ev.path } : null,
        banner: { key: nextKey(), title: ev.path === 'PRESERVE_PAST' ? 'Preserve the Past' : 'Break the Future', tone: ev.path === 'PRESERVE_PAST' ? 'blue' : 'violet' },
        feed: feed(d, `Clockmaker's Choice: ${ev.path === 'PRESERVE_PAST' ? 'Preserve the Past' : 'Break the Future'}`, 'gold'),
      };
    case 'CLUSTER_DETECTED':
      return { ...d, uiPhase: 'EVALUATING', marks: marksFor(ev.positions, 'win', ev.cascadeIndex === 0 ? {} : d.marks) };
    case 'WIN_RECORDED': {
      const a = ev.award;
      const mult = a.ageMultiplier > 1 || a.stageMultiplier > 1 ? ` ×${a.ageMultiplier * a.stageMultiplier}` : '';
      return {
        ...d, spinWin: ev.spinWin, roundWin: ev.roundWin, bonusWin: d.mode === 'BONUS' ? d.bonusWin + a.amount : d.bonusWin,
        floatWin: { key: nextKey(), amount: a.amount, at: a.positions[Math.floor(a.positions.length / 2)] },
        feed: feed(d, `${a.clusterSize}× ${SYMBOLS[a.symbol].name}${mult} — ${formatCredits(a.amount, cfg)}${a.capApplied ? ' (capped)' : ''}`, 'gold'),
      };
    }
    case 'SYMBOL_REMOVED':
      return { ...d, uiPhase: 'CASCADING', board: ev.board, marks: marksFor(ev.frozenRetained, 'frozen-win') };
    case 'TIME_CORRUPTION_APPLIED': {
      if (!ev.affected.length && ev.source === 'ADJACENT') return { ...d, uiPhase: 'TEMPORAL_EFFECT', marks: marksFor(ev.eligible, 'corrupt-eligible') };
      const title = ev.source === 'ORB_BURST' ? 'Orb Burst' : ev.source === 'DISCHARGE_REGION' ? 'Discharge' : 'Time Corruption';
      return {
        ...d, uiPhase: 'TEMPORAL_EFFECT', marks: marksFor(ev.affected, ev.source === 'DISCHARGE_REGION' ? 'discharge' : 'corrupt', marksFor(ev.eligible, 'corrupt-eligible')),
        feed: feed(d, `${title}: ${ev.affected.length} symbol${ev.affected.length === 1 ? '' : 's'} fractured`, 'emerald'),
      };
    }
    case 'SYMBOL_AGE_CHANGED': {
      const hollow = ev.changes.filter((c) => c.kind === 'ADVANCE' && c.to.age === 2).length;
      const wild = ev.changes.filter((c) => c.kind !== 'ADVANCE').length;
      const parts = [hollow && `${hollow} turned Hollow`, wild && `${wild} became Chrono Wild`].filter(Boolean);
      return {
        ...d, board: ev.board, marks: { ...d.marks, ...marksFor(ev.changes.map((c) => c.index), 'aged') },
        feed: parts.length ? feed(d, parts.join(', '), 'violet') : d.feed,
      };
    }
    case 'GRAVITY_APPLIED':
      return { ...d, uiPhase: 'CASCADING', board: ev.board, marks: marksFor(ev.filled, 'new') };
    case 'ECHO_RECORDED':
      return { ...d, echoes: [...d.echoes, ev.entry].slice(-cfg.echo.maxEntries) };
    case 'ECHO_PROJECTED':
      return {
        ...d, uiPhase: 'TEMPORAL_EFFECT', board: ev.board, marks: { ...d.marks, [ev.position]: 'echo' },
        echoes: d.echoes.filter((e) => e.id !== ev.entry.id),
        recentEchoes: [{ ...ev.entry, status: 'CONSUMED' as const }, ...d.recentEchoes].slice(0, 10),
        echoFlash: { key: nextKey(), entry: ev.entry, position: ev.position },
        banner: { key: nextKey(), title: 'An Echo Returns', text: `${SYMBOLS[ev.entry.symbol].name} from ${ev.entry.roundId} → ${AGE_NAMES[ev.to.age]}`, tone: 'blue' },
        feed: feed(d, `Echo ${ev.entry.id}: ${SYMBOLS[ev.entry.symbol].name} returns ${AGE_NAMES[ev.to.age]} at ${cellName(ev.position, cfg)}`, 'blue'),
      };
    case 'ECHO_EXPIRED':
      return { ...d, echoes: d.echoes.filter((e) => !ev.entryIds.includes(e.id)) };
    case 'PARADOX_SPLIT_STARTED':
      return {
        ...d, uiPhase: 'PARADOX_SPLIT', split: { present: ev.present, hollow: ev.hollow, selected: ev.selected, merged: false },
        banner: { key: nextKey(), title: 'Paradox Split', text: `${ev.selected.length} cells cross over from the Hollow`, tone: 'violet' },
        feed: feed(d, `Paradox Split — ${ev.selected.length} cells taken from Timeline B`, 'violet'),
      };
    case 'PARADOX_SPLIT_RESOLVED':
      return { ...d, board: ev.board, split: d.split ? { ...d.split, merged: true } : null, marks: marksFor(ev.selected, 'split') };
    case 'PARADOX_DEBT_UPDATED':
      return {
        ...d, debt: ev.value, debtState: ev.state,
        feed: ev.state !== ev.prevState ? feed(d, `Paradox Debt: ${ev.state}`, ev.state === 'STABLE' ? 'emerald' : 'crimson') : d.feed,
      };
    case 'DEBT_DISCHARGED':
      return {
        ...d, uiPhase: 'TEMPORAL_EFFECT', marks: marksFor(ev.region, 'discharge'),
        banner: { key: nextKey(), title: 'Paradox Discharge', text: 'Reality snaps back — the debt is paid in Age.', tone: 'crimson' },
        feed: feed(d, 'Paradox Debt discharged', 'crimson'),
      };
    case 'CASCADE_LIMIT_REACHED':
      return { ...d, feed: feed(d, `Cascade limit (${ev.limit}) reached`, 'crimson') };
    case 'WIN_CAP_REACHED':
      return { ...d, banner: { key: nextKey(), title: 'Maximum Win', text: formatCredits(ev.cap, cfg), tone: 'gold' }, feed: feed(d, 'Maximum win reached — round ends', 'gold') };
    case 'BONUS_TRIGGERED':
      return {
        ...d, uiPhase: 'BONUS_INTRO',
        banner: { key: nextKey(), title: 'The Last Second', text: `${ev.tickets} Void Tickets — the clock stops at 11:59`, tone: 'crimson' },
        feed: feed(d, 'The Last Second begins', 'crimson'),
      };
    case 'BONUS_STAGE_CHANGED': {
      const s = BONUS_STAGES[ev.stage - 1];
      return {
        ...d, uiPhase: 'BONUS_PLAYING', bonusStage: ev.stage, stageMultiplier: ev.multiplier, hourMultiplier: ev.hourMultiplier,
        banner: { key: nextKey(), title: s.title, text: `${s.text}${ev.multiplier > 1 ? ` Wins ×${ev.multiplier}.` : ''}`, tone: 'crimson' },
        feed: feed(d, s.title, 'crimson'),
      };
    }
    case 'BONUS_COMPLETED':
      return {
        ...d, uiPhase: 'BONUS_RESOLVING', bonusWin: ev.bonusWin,
        banner: { key: nextKey(), title: 'Time Resumes', text: `The Last Second paid ${formatCredits(ev.bonusWin, cfg)}`, tone: 'gold' },
      };
    case 'HOUR_MULTIPLIER_CHANGED':
      return { ...d, hourMultiplier: ev.value, feed: feed(d, `Hour Multiplier ×${ev.value}`, 'gold') };
    case 'ROUND_SETTLED':
      return { ...d, uiPhase: 'ROUND_SETTLING', balance: ev.balance, roundWin: ev.totalWin, lastRoundWin: ev.totalWin, lastRoundId: ev.roundId, mode: 'BASE', split: null };
  }
}

export function cellName(i: number, cfg: GameConfig) {
  return `R${Math.floor(i / cfg.grid.cols) + 1}C${(i % cfg.grid.cols) + 1}`;
}

/** Presentation time per event (ms) at normal speed. */
export function eventDuration(ev: GameEvent): number {
  switch (ev.type) {
    case 'BOARD_CREATED': return 650;
    case 'CLOCKMAKER_CHOICE_OFFERED': return 1400;
    case 'CLOCKMAKER_CHOICE_SELECTED': return ev.selectedBy === 'CLOCKMAKER' ? 1800 : 700;
    case 'CLUSTER_DETECTED': return 650;
    case 'WIN_RECORDED': return 320;
    case 'SYMBOL_REMOVED': return 420;
    case 'TIME_CORRUPTION_APPLIED': return ev.affected.length ? 520 : 160;
    case 'SYMBOL_AGE_CHANGED': return 520;
    case 'GRAVITY_APPLIED': return 520;
    case 'ECHO_PROJECTED': return 1200;
    case 'PARADOX_SPLIT_STARTED': return 2000;
    case 'PARADOX_SPLIT_RESOLVED': return 900;
    case 'DEBT_DISCHARGED': return 1200;
    case 'WIN_CAP_REACHED': return 1200;
    case 'BONUS_TRIGGERED': return 1800;
    case 'BONUS_STAGE_CHANGED': return 1400;
    case 'HOUR_MULTIPLIER_CHANGED': return 450;
    case 'BONUS_COMPLETED': return 1800;
    case 'ROUND_SETTLED': return 300;
    case 'PARADOX_DEBT_UPDATED': return ev.state !== ev.prevState ? 300 : 60;
    default: return 0;
  }
}

export function eventSound(ev: GameEvent): Exclude<SoundCategory, 'ambient'> | null {
  switch (ev.type) {
    case 'SPIN_STARTED': return ev.mode === 'BASE' ? 'spinStart' : null;
    case 'BOARD_CREATED': return 'land';
    case 'CLOCKMAKER_CHOICE_OFFERED': return 'clockmaker';
    case 'CLOCKMAKER_CHOICE_SELECTED': return 'ui';
    case 'CLUSTER_DETECTED': return 'clusterWin';
    case 'GRAVITY_APPLIED': return 'cascade';
    case 'TIME_CORRUPTION_APPLIED': return ev.affected.length ? 'corruption' : null;
    case 'SYMBOL_AGE_CHANGED': return 'ageTransition';
    case 'ECHO_PROJECTED': return 'echo';
    case 'PARADOX_SPLIT_STARTED': return 'paradoxSplit';
    case 'PARADOX_DEBT_UPDATED': return ev.state !== ev.prevState ? 'debtThreshold' : null;
    case 'DEBT_DISCHARGED': return 'debtThreshold';
    case 'BONUS_TRIGGERED': return 'bonusEntry';
    case 'BONUS_STAGE_CHANGED': return 'bonusStage';
    case 'BONUS_COMPLETED': return 'bonusComplete';
    default: return null;
  }
}
