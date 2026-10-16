import type { Age, ClockmakerPath, DebtState, PayingSymbolId, SymbolId } from '../../config/types';
import type { BoardSnapshot } from '../board/board';
import type { Award } from '../payouts/payouts';
import type { EchoEntry } from '../../mechanics/echoLedger/echoLedger';

/** Why a cell's symbol/age changed. */
export type ChangeCause =
  | 'CORRUPTION'
  | 'ORB_BURST'
  | 'PARADOX_SPLIT'
  | 'DISCHARGE'
  | 'CLOCKMAKER_BREAK_FUTURE'
  | 'CLOCKMAKER_FALLBACK'
  | 'CLOCKMAKER_STEPS_ASIDE'
  | 'ECHO_FALLBACK'
  | 'BONUS_FREEZE'
  | 'FROZEN_WIN'
  | 'COLLAPSE_STAGE';

export interface CellChange {
  index: number;
  uid: number;
  from: { sym: SymbolId; age: Age };
  to: { sym: SymbolId; age: Age };
  kind: 'ADVANCE' | 'COLLAPSE_TO_WILD' | 'BECOME_WILD';
  cause: ChangeCause;
}

export type BonusStageName = 'FROZEN' | 'DIVERGENCE' | 'ECHO' | 'COLLAPSE';

export interface EventPayloads {
  SPIN_STARTED: { roundId: string; spinIndex: number; spinSeq: number; mode: 'BASE' | 'BONUS'; stake: number; balance: number; debt: number; debtState: DebtState };
  BOARD_CREATED: { board: BoardSnapshot; tickets: number; clockmakers: number; forced: string | null };
  CLOCKMAKER_CHOICE_OFFERED: { positions: number[]; echoesAvailable: number };
  CLOCKMAKER_CHOICE_SELECTED: { path: ClockmakerPath; board: BoardSnapshot };
  CLUSTER_DETECTED: { cascadeIndex: number; symbol: PayingSymbolId; positions: number[]; ages: Record<Age, number>; multiplier: number };
  WIN_RECORDED: { award: Award; spinWin: number; roundWin: number };
  SYMBOL_REMOVED: { cascadeIndex: number; positions: number[]; frozenRetained: number[]; board: BoardSnapshot };
  TIME_CORRUPTION_APPLIED: { cascadeIndex: number; source: 'ADJACENT' | 'ORB_BURST' | 'DISCHARGE_REGION'; eligible: number[]; affected: number[]; chance: number | null };
  SYMBOL_AGE_CHANGED: { changes: CellChange[]; board: BoardSnapshot };
  GRAVITY_APPLIED: { cascadeIndex: number; filled: number[]; board: BoardSnapshot };
  ECHO_RECORDED: { entry: EchoEntry };
  ECHO_PROJECTED: { entry: EchoEntry; position: number; from: { sym: SymbolId; age: Age }; to: { sym: SymbolId; age: Age }; consumed: boolean; board: BoardSnapshot };
  ECHO_EXPIRED: { entryIds: string[] };
  PARADOX_SPLIT_STARTED: { reason: 'PORTAL_CLUSTER' | 'PORTAL_SCATTER' | 'BONUS_DIVERGENCE' | 'FORCED'; present: BoardSnapshot; hollow: BoardSnapshot; selected: number[]; cellsRequested: number };
  PARADOX_SPLIT_RESOLVED: { selected: number[]; board: BoardSnapshot };
  PARADOX_DEBT_UPDATED: { reason: string; delta: number; value: number; state: DebtState; prevState: DebtState };
  DEBT_DISCHARGED: { valueBefore: number; region: number[] };
  CASCADE_LIMIT_REACHED: { limit: number };
  WIN_CAP_REACHED: { cap: number };
  BONUS_TRIGGERED: { tickets: number };
  BONUS_STAGE_CHANGED: { stage: 1 | 2 | 3 | 4; name: BonusStageName; multiplier: number; frozen: number[] };
  BONUS_COMPLETED: { bonusWin: number };
  ROUND_SETTLED: { roundId: string; stake: number; totalWin: number; baseWin: number; bonusWin: number; balance: number; capped: boolean; awards: number };
}

export type EventType = keyof EventPayloads;

export type GameEvent = {
  [K in EventType]: { seq: number; type: K; roundId: string; spinIndex: number } & EventPayloads[K];
}[EventType];

export type EventOf<K extends EventType> = Extract<GameEvent, { type: K }>;
