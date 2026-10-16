import type { ClockmakerPath, GameConfig } from '../config/types';
import { GameEngine, type EngineSnapshot, type StepResult } from '../engine/GameEngine';
import type { BookEvent } from '../math/books';
import { idleSnapshot, type PlatformAdapter } from './PlatformAdapter';

/**
 * Stake Engine RGS adapter.
 *
 * Endpoints and payloads follow the official StakeEngine/math-sdk docs (docs/rgs_docs/RGS.md)
 * and the request shapes used by engineio/ts-client:
 *   POST {https://rgs_url}/wallet/authenticate { sessionID, language }
 *   POST /wallet/play       { sessionID, amount, mode }    -> { balance, round: { payoutMultiplier, active, state } }
 *   POST /wallet/end-round  { sessionID }                  -> { balance }
 *   POST /bet/event         { sessionID, event }
 * Amounts are integers with 6 implied decimals. `round.state` is the book's `events` array; for
 * this game it holds one `hollowHourRound` event (seed + weight set). The client replays the
 * round with the same engine and MUST reproduce `payoutMultiplier`, otherwise it shows an error
 * and never displays an outcome the RGS did not select.
 *
 * NOTE: written against the documentation only — it has not been run against a live RGS.
 */

interface RgsBalance {
  amount: number;
  currency: string;
}
interface RgsRound {
  betID?: number;
  amount?: number;
  payoutMultiplier?: number;
  active: boolean;
  mode: string;
  event?: string;
  state: unknown;
}

const CURRENCY_META: Record<string, { symbol: string; decimals: number; symbolAfter?: boolean }> = {
  USD: { symbol: '$', decimals: 2 }, CAD: { symbol: 'CA$', decimals: 2 }, JPY: { symbol: '¥', decimals: 0 }, EUR: { symbol: '€', decimals: 2 },
  RUB: { symbol: '₽', decimals: 2 }, CNY: { symbol: 'CN¥', decimals: 2 }, PHP: { symbol: '₱', decimals: 2 }, INR: { symbol: '₹', decimals: 2 },
  IDR: { symbol: 'Rp', decimals: 0 }, KRW: { symbol: '₩', decimals: 0 }, BRL: { symbol: 'R$', decimals: 2 }, MXN: { symbol: 'MX$', decimals: 2 },
  DKK: { symbol: 'KR', decimals: 2, symbolAfter: true }, PLN: { symbol: 'zł', decimals: 2, symbolAfter: true }, VND: { symbol: '₫', decimals: 0, symbolAfter: true },
  TRY: { symbol: '₺', decimals: 2 }, CLP: { symbol: 'CLP', decimals: 0, symbolAfter: true }, ARS: { symbol: 'ARS', decimals: 2, symbolAfter: true },
  PEN: { symbol: 'S/', decimals: 2, symbolAfter: true }, XGC: { symbol: 'GC', decimals: 2 }, XSC: { symbol: 'SC', decimals: 2 },
};

export const RGS_UNITS = 1_000_000;

export class RgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RgsError';
  }
}

export class StakeRgsAdapter implements PlatformAdapter {
  readonly name = 'stake-rgs';
  readonly demoCreditsOnly = false;
  flags: PlatformAdapter['flags'] = {};
  config: GameConfig;
  private readonly baseConfig: GameConfig;
  private readonly sessionID: string;
  private readonly rgsUrl: string;
  private readonly lang: string;
  private engine: GameEngine | null = null;
  private balance = 0;
  private roundActive = false;
  private pending: { payoutMultiplier: number; bet: number } | null = null;
  private readonly log: unknown[] = [];

  static fromUrl(baseConfig: GameConfig, search: string): StakeRgsAdapter | null {
    const p = new URLSearchParams(search);
    const sessionID = p.get('sessionID');
    const rgs = p.get('rgs_url');
    if (!sessionID || !rgs) return null;
    return new StakeRgsAdapter(baseConfig, sessionID, rgs, p.get('lang') ?? 'en');
  }

  constructor(baseConfig: GameConfig, sessionID: string, rgsUrl: string, lang: string) {
    this.baseConfig = baseConfig;
    this.config = baseConfig;
    this.sessionID = sessionID;
    this.rgsUrl = /^https?:\/\//.test(rgsUrl) ? rgsUrl : `https://${rgsUrl}`;
    this.lang = lang;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.rgsUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionID: this.sessionID, ...body }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new RgsError(typeof data?.error === 'string' ? data.error : data?.code ?? `RGS ${path} failed (${res.status})`);
    return data as T;
  }

  async init() {
    const r = await this.post<{ balance: RgsBalance; config: { betLevels: number[]; defaultBetLevel: number; minBet: number; maxBet: number; stepBet: number }; jurisdictionFlags?: Record<string, unknown>; round: RgsRound | null }>(
      '/wallet/authenticate',
      { language: this.lang },
    );
    const meta = CURRENCY_META[r.balance.currency] ?? { symbol: r.balance.currency, decimals: 2, symbolAfter: true };
    // Engine awards are floor(bet * pay * mult / 100); bets in micro-units divisible by 100 keep them exact.
    const levels = r.config.betLevels.filter((b) => b >= r.config.minBet && b <= r.config.maxBet && b % 100 === 0 && b % r.config.stepBet === 0);
    if (!levels.length) throw new RgsError('no usable bet levels from authenticate');
    this.config = {
      ...this.baseConfig,
      bets: levels,
      defaultBet: levels.includes(r.config.defaultBetLevel) ? r.config.defaultBetLevel : levels[0],
      currency: { unitsPerCredit: RGS_UNITS, startingBalance: r.balance.amount, code: r.balance.currency, symbol: meta.symbol, decimals: meta.decimals, symbolAfter: meta.symbolAfter },
    };
    this.balance = r.balance.amount;
    const f = r.jurisdictionFlags ?? {};
    this.flags = { disabledSpacebar: !!f.disabledSpacebar, socialCasino: !!f.socialCasino, displayRTP: f.displayRTP !== false };
    // An unfinished round is completed on load (its outcome is already fixed by the RGS).
    if (r.round?.active) await this.post('/wallet/end-round', {}).then((e) => (this.balance = (e as { balance: RgsBalance }).balance.amount));
  }

  getState(): EngineSnapshot {
    const s = this.engine ? this.engine.getSnapshot() : idleSnapshot(this.config, this.balance);
    return { ...s, balance: this.engine && s.phase !== 'IDLE' ? s.balance : this.balance };
  }

  async spin(bet: number): Promise<StepResult> {
    if (this.engine && this.engine.phase !== 'IDLE') throw new RgsError('round in progress');
    const r = await this.post<{ balance: RgsBalance; round: RgsRound }>('/wallet/play', { amount: bet, mode: 'BASE' });
    const ev = (Array.isArray(r.round.state) ? r.round.state[0] : null) as BookEvent | null;
    if (!ev || ev.type !== 'hollowHourRound' || typeof ev.seed !== 'number') throw new RgsError('unrecognised round state from RGS');
    if (ev.configVersion !== this.config.version) throw new RgsError(`math version mismatch (${ev.configVersion} vs ${this.config.version})`);
    this.roundActive = r.round.active;
    this.pending = { payoutMultiplier: r.round.payoutMultiplier ?? 0, bet };
    this.log.push({ betID: r.round.betID, seed: ev.seed, weightSet: ev.weightSet, payoutMultiplier: this.pending.payoutMultiplier });
    // Replay: the engine starts from the pre-debit balance and deducts the same stake itself.
    this.engine = new GameEngine(this.config, { seed: ev.seed, bonusWeightSet: ev.weightSet, startingBalance: r.balance.amount + bet });
    return this.after(this.engine.spin({ bet }));
  }

  async chooseClockmakerPath(path: ClockmakerPath): Promise<StepResult> {
    if (!this.engine) throw new RgsError('no round in progress');
    return this.after(this.engine.chooseClockmakerPath(path));
  }

  async playBonusStage(): Promise<StepResult> {
    if (!this.engine) throw new RgsError('no round in progress');
    const step = this.engine.playBonusStage();
    // Record reveal progress so the platform can resume mid-bonus (/bet/event).
    await this.post('/bet/event', { event: `stage:${this.engine.getSnapshot().round?.bonusStage ?? 4}` }).catch(() => {});
    return this.after(step);
  }

  private async after(step: StepResult): Promise<StepResult> {
    if (!step.settled || !this.pending) return step;
    const expected = (this.pending.bet * this.pending.payoutMultiplier) / 100;
    if (step.settled.totalWin !== expected) {
      this.engine = null;
      throw new RgsError(`round verification failed (replay ${step.settled.totalWin} vs RGS ${expected}); please reload`);
    }
    this.pending = null;
    if (this.roundActive) {
      const e = await this.post<{ balance: RgsBalance }>('/wallet/end-round', {});
      this.balance = e.balance.amount;
      this.roundActive = false;
    } else {
      this.balance = step.settled ? this.engine!.balance : this.balance;
    }
    return step;
  }

  exportSession() {
    return { mode: 'stake-rgs', configId: this.config.id, configVersion: this.config.version, rounds: this.log };
  }
}
