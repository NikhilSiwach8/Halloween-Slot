import type { DebtState, GameConfig, WeightTable } from '../config/types';
import type { Board, BoardSnapshot, UidSource } from './board/board';
import type { EventPayloads, EventType } from './events/events';
import type { PayoutLedger } from './payouts/payouts';
import type { Rng } from './rng/rng';
import type { EchoLedger } from '../mechanics/echoLedger/echoLedger';
import type { ParadoxDebt } from '../mechanics/paradoxDebt/paradoxDebt';

/** Per-round counters used by the simulator (and shown in debug views). */
export interface RoundStats {
  winningCascades: number;
  clusters: number;
  echoesProjected: number;
  echoesRecorded: number;
  splits: number;
  discharges: number;
  clockmaker: 'PRESERVE_PAST' | 'BREAK_FUTURE' | null;
  bonus: boolean;
  toFractured: number;
  toHollow: number;
  collapsesToWild: number;
  /** Real symbols in winning clusters by age [Original, Fractured, Hollow]. */
  agesInWins: [number, number, number];
  /** Award units attributable to the Three Ages multiplier (amount - amount/multiplier). */
  ageUplift: number;
  /** Award units won in a spin after a temporal feature (echo / split / discharge / clockmaker) fired in it. */
  postTemporalWins: number;
  cascadeLimitHit: boolean;
  capped: boolean;
}

export function emptyStats(): RoundStats {
  return {
    winningCascades: 0, clusters: 0, echoesProjected: 0, echoesRecorded: 0, splits: 0, discharges: 0,
    clockmaker: null, bonus: false, toFractured: 0, toHollow: 0, collapsesToWild: 0,
    agesInWins: [0, 0, 0], ageUplift: 0, postTemporalWins: 0, cascadeLimitHit: false, capped: false,
  };
}

/** Session-scope state shared across rounds. */
export interface SessionScope {
  /** Extra cells granted to the next Paradox Split by Clockmaker's "Break the Future". */
  splitPrimedCells: number;
}

/** Everything a mechanic needs while resolving one spin (base spin or one bonus stage). */
export interface SpinContext {
  cfg: GameConfig;
  rng: Rng;
  uids: UidSource;
  board: Board;
  roundId: string;
  spinIndex: number;
  spinSeq: number;
  cascadeIndex: number;
  mode: 'BASE' | 'BONUS';
  stageMultiplier: number;
  refillWeights: WeightTable;
  /** Paradox Debt state at the start of this spin — the only debt state that modifies probabilities. */
  debtStateAtStart: DebtState;
  payouts: PayoutLedger;
  echo: EchoLedger;
  debt: ParadoxDebt;
  session: SessionScope;
  stats: RoundStats;
  spinWin: number;
  splitsThisSpin: number;
  dischargesThisSpin: number;
  echoEntriesThisSpin: number;
  temporalEffectThisSpin: boolean;
  emit<K extends EventType>(type: K, payload: EventPayloads[K]): void;
  /** Board snapshot for an event payload (empty array when event recording is disabled, e.g. bulk simulation). */
  snap(): BoardSnapshot;
}
