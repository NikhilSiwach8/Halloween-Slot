import type { ClockmakerPath, GameConfig } from '../config/types';
import { GameEngine, type EngineSnapshot, type ForceOption, type StepResult } from '../engine/GameEngine';
import { SeededRng } from '../engine/rng/rng';

/**
 * The boundary between the game client and whatever decides outcomes.
 *
 * The UI talks ONLY to this interface. Two implementations:
 *  - LocalDemoAdapter: in-browser demo; each round is an independent engine run with a fresh seed.
 *  - StakeRgsAdapter (./StakeRgsAdapter.ts): the RGS selects a book; the client replays it with
 *    the same engine and verifies the payout before showing it.
 */
export interface PlatformAdapter {
  readonly name: string;
  readonly config: GameConfig;
  /** True for the local demo (no real balance anywhere). */
  readonly demoCreditsOnly: boolean;
  /** Platform flags (e.g. Stake jurisdiction flags). */
  readonly flags: { disabledSpacebar?: boolean; socialCasino?: boolean; displayRTP?: boolean };
  init(): Promise<void>;
  getState(): EngineSnapshot;
  spin(bet: number, force?: ForceOption): Promise<StepResult>;
  chooseClockmakerPath(path: ClockmakerPath): Promise<StepResult>;
  playBonusStage(): Promise<StepResult>;
  /** Debug export for deterministic reproduction of a development session. */
  exportSession(): { mode: string; configId: string; configVersion: string; rounds: unknown[] };
}

/** Snapshot shown before the first round of a session. */
export function idleSnapshot(_cfg: GameConfig, balance: number): EngineSnapshot {
  return {
    phase: 'IDLE', awaiting: 'SPIN', balance, debt: 0, debtState: 'STABLE', echoes: [], recentEchoes: [],
    splitPrimedCells: 0, board: null, round: null, lastRound: null,
  };
}

/**
 * Local demo. With ROUND persistence (the default, Stake-oriented config) every round runs in a
 * fresh engine seeded from the session RNG — rounds are independent, exactly like books. With
 * SESSION persistence (SESSION_CONFIG) a single engine is kept so state carries across rounds.
 */
export class LocalDemoAdapter implements PlatformAdapter {
  readonly name = 'local-demo';
  readonly demoCreditsOnly = true;
  readonly flags = {};
  readonly config: GameConfig;
  private readonly seedRng: SeededRng;
  private readonly sessionSeed: number;
  private engine: GameEngine | null = null;
  private balance: number;
  private roundNumber = 0;
  private readonly rounds: { round: number; seed: number; actions: unknown[] }[] = [];
  private readonly perRound: boolean;

  constructor(config: GameConfig, seed: number) {
    this.config = config;
    this.sessionSeed = seed;
    this.seedRng = new SeededRng(seed);
    this.balance = config.currency.startingBalance;
    this.perRound = config.persistence.paradoxDebt === 'ROUND' && config.persistence.echoLedger === 'ROUND';
    if (!this.perRound) this.engine = new GameEngine(config, { seed, startingBalance: this.balance });
  }

  async init() {}

  getState(): EngineSnapshot {
    if (!this.engine) return idleSnapshot(this.config, this.balance);
    return this.engine.getSnapshot();
  }

  async spin(bet: number, force?: ForceOption) {
    if (this.perRound) {
      if (this.engine && this.engine.phase !== 'IDLE') return this.engine.spin({ bet, force }); // engine rejects
      if (this.engine) this.balance = this.engine.balance;
      const seed = Math.floor(this.seedRng.next() * 2 ** 32) >>> 0;
      this.roundNumber++;
      this.engine = new GameEngine(this.config, { seed, startingBalance: this.balance, firstRoundNumber: this.roundNumber });
      this.rounds.push({ round: this.roundNumber, seed, actions: this.engine.actions });
    }
    return this.engine!.spin({ bet, force });
  }

  async chooseClockmakerPath(path: ClockmakerPath) {
    if (!this.engine) throw new Error('no round in progress');
    return this.engine.chooseClockmakerPath(path);
  }

  async playBonusStage() {
    if (!this.engine) throw new Error('no round in progress');
    return this.engine.playBonusStage();
  }

  exportSession() {
    return {
      mode: this.perRound ? 'per-round-seeds' : `session-seed:${this.sessionSeed}`,
      configId: this.config.id,
      configVersion: this.config.version,
      rounds: this.perRound ? this.rounds : [{ seed: this.sessionSeed, actions: this.engine?.actions ?? [] }],
    };
  }
}
