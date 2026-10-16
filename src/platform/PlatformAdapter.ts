import type { ClockmakerPath, GameConfig } from '../config/types';
import { GameEngine, type EngineSnapshot, type ForceOption, type StepResult } from '../engine/GameEngine';

/**
 * The boundary between the game client and whatever resolves outcomes.
 *
 * The UI talks ONLY to this interface. Today it is backed by the in-browser demo
 * engine (LocalDemoAdapter). A platform build (e.g. Stake Engine RGS) would provide
 * another implementation that fetches authoritative results from the platform —
 * see docs/STAKE_ENGINE_INTEGRATION.md for what that requires. Methods are async so
 * a network-backed adapter fits without changing callers.
 */
export interface PlatformAdapter {
  readonly name: string;
  readonly config: GameConfig;
  /** Demo-credit prototype: no deposits, cashouts, wallets or payments exist anywhere. */
  readonly demoCreditsOnly: true;
  getState(): EngineSnapshot;
  spin(bet: number, force?: ForceOption): Promise<StepResult>;
  chooseClockmakerPath(path: ClockmakerPath): Promise<StepResult>;
  playBonusStage(): Promise<StepResult>;
  /** Debug export for deterministic reproduction of a development session. */
  exportSession(): { seed: number; configId: string; configVersion: string; actions: unknown[] };
}

export class LocalDemoAdapter implements PlatformAdapter {
  readonly name = 'local-demo';
  readonly demoCreditsOnly = true as const;
  readonly config: GameConfig;
  private readonly engine: GameEngine;

  constructor(config: GameConfig, seed: number) {
    this.config = config;
    this.engine = new GameEngine(config, { seed });
  }

  getState() {
    return this.engine.getSnapshot();
  }

  async spin(bet: number, force?: ForceOption) {
    return this.engine.spin({ bet, force });
  }

  async chooseClockmakerPath(path: ClockmakerPath) {
    return this.engine.chooseClockmakerPath(path);
  }

  async playBonusStage() {
    return this.engine.playBonusStage();
  }

  exportSession() {
    return { seed: this.engine.seed, configId: this.config.id, configVersion: this.config.version, actions: [...this.engine.actions] };
  }
}
