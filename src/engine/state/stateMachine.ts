/**
 * Engine phases and the legal transitions between them.
 *
 * Phases where the engine waits for the player: IDLE, CLOCKMAKER_CHOICE,
 * BONUS_INTRO, BONUS_PLAYING. All others are transient while a step resolves.
 */
export type GamePhase =
  | 'IDLE'
  | 'SPINNING'
  | 'EVALUATING'
  | 'CASCADING'
  | 'TEMPORAL_EFFECT'
  | 'PARADOX_SPLIT'
  | 'CLOCKMAKER_CHOICE'
  | 'BONUS_INTRO'
  | 'BONUS_PLAYING'
  | 'BONUS_RESOLVING'
  | 'ROUND_SETTLING';

export const TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  IDLE: ['SPINNING'],
  SPINNING: ['CLOCKMAKER_CHOICE', 'EVALUATING'],
  CLOCKMAKER_CHOICE: ['TEMPORAL_EFFECT', 'EVALUATING'],
  EVALUATING: ['CASCADING', 'TEMPORAL_EFFECT', 'PARADOX_SPLIT', 'BONUS_INTRO', 'BONUS_PLAYING', 'BONUS_RESOLVING', 'ROUND_SETTLING'],
  CASCADING: ['TEMPORAL_EFFECT', 'PARADOX_SPLIT', 'EVALUATING'],
  TEMPORAL_EFFECT: ['CASCADING', 'PARADOX_SPLIT', 'EVALUATING'],
  PARADOX_SPLIT: ['TEMPORAL_EFFECT', 'CASCADING', 'EVALUATING'],
  BONUS_INTRO: ['BONUS_PLAYING'],
  BONUS_PLAYING: ['TEMPORAL_EFFECT', 'PARADOX_SPLIT', 'EVALUATING', 'BONUS_RESOLVING'],
  BONUS_RESOLVING: ['ROUND_SETTLING'],
  ROUND_SETTLING: ['IDLE'],
};

export const WAITING_PHASES: readonly GamePhase[] = ['IDLE', 'CLOCKMAKER_CHOICE', 'BONUS_INTRO', 'BONUS_PLAYING'];

export class InvalidTransitionError extends Error {
  constructor(from: GamePhase, to: GamePhase) {
    super(`illegal phase transition ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class PhaseMachine {
  private current: GamePhase = 'IDLE';
  readonly history: GamePhase[] = [];

  get phase(): GamePhase {
    return this.current;
  }

  canGo(to: GamePhase): boolean {
    return to === this.current || TRANSITIONS[this.current].includes(to);
  }

  go(to: GamePhase): void {
    if (to === this.current) return;
    if (!TRANSITIONS[this.current].includes(to)) throw new InvalidTransitionError(this.current, to);
    this.current = to;
    this.history.push(to);
    if (this.history.length > 200) this.history.splice(0, this.history.length - 200);
  }

  /** Recovery hook for the engine when a step throws mid-resolution. */
  reset(to: GamePhase): void {
    this.current = to;
  }
}
