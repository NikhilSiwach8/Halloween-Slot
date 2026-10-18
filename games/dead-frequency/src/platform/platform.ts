import { roundCost } from '../config/gameConfig';
import type { GameConfig, ModeId } from '../config/types';
import { decodeRound, encodeRound } from '../math/bookFormat';
import { STAKE_MODE_NAME } from '../math/books';
import { SeededRng } from '../engine/rng';
import { playRound, type RoundResult } from '../engine/round';

/**
 * Where rounds come from. The UI only talks to this interface.
 *  - DemoPlatform: in-browser demo credits; rounds are played locally.
 *  - StakePlatform: Stake Engine RGS. The RGS picks a book; the client decodes and checks it.
 *  - ReplayPlatform: Stake bet replay (?replay=true); one fixed round, no wallet calls.
 */
export interface Currency {
  /** Integer units per displayed unit (100 in the demo, 1,000,000 from the RGS). */
  unitsPerCredit: number;
  code?: string;
  symbol?: string;
  decimals: number;
  symbolAfter?: boolean;
}

export interface PlatformSession {
  bets: number[];
  defaultBet: number;
  balance: number;
  currency: Currency;
  flags: { disabledSpacebar?: boolean; disabledBuyFeature?: boolean; disabledTurbo?: boolean; displayRTP?: boolean; socialCasino?: boolean };
  /** Present in replay mode: the round's mode and base bet. */
  replay?: { mode: ModeId; bet: number };
  /** Demo credits only (shows the prototype notice). */
  demo: boolean;
}

export interface Platform {
  init(): Promise<PlatformSession>;
  /** Pays for and returns a round, with the balance after the debit. */
  play(mode: ModeId, bet: number): Promise<{ round: RoundResult; balance: number }>;
  /** Settles the round after it has been shown; returns the balance after the win is credited. */
  endRound(round: RoundResult, bet: number): Promise<number>;
}

export class PlatformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformError';
  }
}

export class DemoPlatform implements Platform {
  private readonly rng: SeededRng;
  private balance: number;
  constructor(private readonly cfg: GameConfig, seed: number) {
    this.rng = new SeededRng(seed);
    this.balance = cfg.currency.startingBalance;
  }
  async init(): Promise<PlatformSession> {
    return { bets: this.cfg.bets, defaultBet: this.cfg.defaultBet, balance: this.balance, currency: { unitsPerCredit: this.cfg.currency.unitsPerCredit, decimals: 2 }, flags: {}, demo: true };
  }
  async play(mode: ModeId, bet: number) {
    const cost = roundCost(this.cfg, mode, bet);
    if (cost > this.balance) throw new PlatformError('Insufficient balance');
    this.balance -= cost;
    // Round-trip through the book format so the demo exercises exactly what the RGS will send.
    const round = decodeRound(this.cfg, encodeRound(this.cfg, playRound(this.cfg, mode, this.rng)));
    return { round, balance: this.balance };
  }
  async endRound(round: RoundResult, bet: number) {
    this.balance += Math.floor((bet * round.winX100) / 100);
    return this.balance;
  }
}

const CURRENCY_META: Record<string, { symbol: string; decimals: number; symbolAfter?: boolean }> = {
  USD: { symbol: '$', decimals: 2 }, CAD: { symbol: 'CA$', decimals: 2 }, JPY: { symbol: '¥', decimals: 0 }, EUR: { symbol: '€', decimals: 2 },
  RUB: { symbol: '₽', decimals: 2 }, CNY: { symbol: 'CN¥', decimals: 2 }, PHP: { symbol: '₱', decimals: 2 }, INR: { symbol: '₹', decimals: 2 },
  IDR: { symbol: 'Rp', decimals: 0 }, KRW: { symbol: '₩', decimals: 0 }, BRL: { symbol: 'R$', decimals: 2 }, MXN: { symbol: 'MX$', decimals: 2 },
  DKK: { symbol: 'KR', decimals: 2, symbolAfter: true }, PLN: { symbol: 'zł', decimals: 2, symbolAfter: true }, VND: { symbol: '₫', decimals: 0, symbolAfter: true },
  TRY: { symbol: '₺', decimals: 2 }, CLP: { symbol: 'CLP', decimals: 0, symbolAfter: true }, ARS: { symbol: 'ARS', decimals: 2, symbolAfter: true },
  PEN: { symbol: 'S/', decimals: 2, symbolAfter: true }, XGC: { symbol: 'GC', decimals: 2 }, XSC: { symbol: 'SC', decimals: 2 },
};
const RGS_UNITS = 1_000_000;

const currencyFor = (code: string): Currency => {
  const meta = CURRENCY_META[code] ?? { symbol: code, decimals: 2, symbolAfter: true };
  return { unitsPerCredit: RGS_UNITS, code, ...meta };
};

const normaliseUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `https://${u}`).replace(/\/$/, '');

/** `mode` as sent to /wallet/play: the index.json name in upper case (the RGS docs use "BASE"). */
export const rgsModeName = (mode: ModeId) => STAKE_MODE_NAME[mode].toUpperCase();
export const modeFromRgsName = (name: string): ModeId | null =>
  (Object.entries(STAKE_MODE_NAME).find(([, v]) => v.toLowerCase() === name.toLowerCase())?.[0] as ModeId | undefined) ?? null;

/**
 * The RGS round's payoutMultiplier may arrive as the book integer (hundredths of the bet, e.g.
 * 1150) or as a float multiple of the bet (11.5). Either must match the decoded round.
 */
export function payoutMatches(round: RoundResult, payoutMultiplier: number | undefined): boolean {
  if (payoutMultiplier === undefined) return true;
  return payoutMultiplier === round.winX100 || Math.abs(payoutMultiplier * 100 - round.winX100) < 1e-6;
}

interface RgsBalance { amount: number; currency: string }

/**
 * Stake Engine RGS client (endpoints and payloads per the RGS docs):
 *   POST {rgs_url}/wallet/authenticate { sessionID, language }
 *   POST /wallet/play       { sessionID, amount, mode }  -> { balance, round: { payoutMultiplier, state } }
 *   POST /wallet/end-round  { sessionID }                -> { balance }
 * Amounts are integers with 6 implied decimals. `round.state` is the book's events array.
 */
export class StakePlatform implements Platform {
  private active = false;
  constructor(private readonly cfg: GameConfig, private readonly sessionID: string, private readonly rgsUrl: string, private readonly lang: string) {}

  static fromUrl(cfg: GameConfig, search: string): StakePlatform | null {
    const p = new URLSearchParams(search);
    const sessionID = p.get('sessionID');
    const rgs = p.get('rgs_url');
    if (!sessionID || !rgs || p.get('replay') === 'true') return null;
    return new StakePlatform(cfg, sessionID, normaliseUrl(rgs), p.get('lang') ?? 'en');
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.rgsUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionID: this.sessionID, ...body }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlatformError(rgsMessage(data?.code ?? data?.error, res.status));
    return data as T;
  }

  async init(): Promise<PlatformSession> {
    const r = await this.post<{
      balance: RgsBalance;
      round: { active?: boolean; payoutMultiplier?: number } | null;
      config: { betLevels: number[]; defaultBetLevel: number; minBet: number; maxBet: number; stepBet: number; jurisdiction?: Record<string, unknown> };
    }>('/wallet/authenticate', { language: this.lang });
    // Wins are bet × payoutMultiplier / 100: bet levels divisible by 100 keep every payout exact.
    const bets = r.config.betLevels.filter((b) => b >= r.config.minBet && b <= r.config.maxBet && b % r.config.stepBet === 0);
    if (!bets.length) throw new PlatformError('No usable bet levels for this session.');
    let balance = r.balance.amount;
    // An unfinished round is settled on load; its outcome is already fixed by the RGS.
    if (r.round && r.round.active !== false && (r.round.payoutMultiplier ?? 0) > 0) balance = (await this.post<{ balance: RgsBalance }>('/wallet/end-round', {})).balance.amount;
    const j = r.config.jurisdiction ?? {};
    return {
      bets,
      defaultBet: bets.includes(r.config.defaultBetLevel) ? r.config.defaultBetLevel : bets[0],
      balance,
      currency: currencyFor(r.balance.currency),
      flags: { disabledSpacebar: !!j.disabledSpacebar, disabledBuyFeature: !!j.disabledBuyFeature, disabledTurbo: !!j.disabledTurbo, displayRTP: j.displayRTP !== false, socialCasino: !!j.socialCasino },
      demo: false,
    };
  }

  async play(mode: ModeId, bet: number) {
    const r = await this.post<{ balance: RgsBalance; round: { payoutMultiplier?: number; active?: boolean; state: unknown } }>('/wallet/play', { amount: bet, mode: rgsModeName(mode) });
    const round = decodeRound(this.cfg, r.round.state);
    if (round.mode !== mode) throw new PlatformError('The server returned a round for a different mode. Please reload.');
    if (!payoutMatches(round, r.round.payoutMultiplier)) throw new PlatformError('Round verification failed. Please reload.');
    this.active = round.winX100 > 0 && r.round.active !== false;
    return { round, balance: r.balance.amount };
  }

  async endRound(round: RoundResult, bet: number) {
    void round;
    void bet;
    if (!this.active) return (await this.post<{ balance: RgsBalance }>('/wallet/balance', {})).balance.amount;
    this.active = false;
    return (await this.post<{ balance: RgsBalance }>('/wallet/end-round', {})).balance.amount;
  }
}

/**
 * Stake bet replay: ?replay=true&game&version&mode&event&rgs_url[&currency&amount&lang].
 * Fetches GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}; makes no wallet calls.
 */
export class ReplayPlatform implements Platform {
  private round: RoundResult | null = null;
  constructor(private readonly cfg: GameConfig, private readonly p: URLSearchParams) {}

  static fromUrl(cfg: GameConfig, search: string): ReplayPlatform | null {
    const p = new URLSearchParams(search);
    return p.get('replay') === 'true' ? new ReplayPlatform(cfg, p) : null;
  }

  async init(): Promise<PlatformSession> {
    const need = ['game', 'version', 'mode', 'event', 'rgs_url'];
    const missing = need.filter((k) => !this.p.get(k));
    if (missing.length) throw new PlatformError(`Replay link is missing ${missing.join(', ')}.`);
    const mode = modeFromRgsName(this.p.get('mode')!);
    if (!mode) throw new PlatformError('Replay link has an unknown mode.');
    const url = `${normaliseUrl(this.p.get('rgs_url')!)}/bet/replay/${encodeURIComponent(this.p.get('game')!)}/${encodeURIComponent(this.p.get('version')!)}/${encodeURIComponent(this.p.get('mode')!)}/${encodeURIComponent(this.p.get('event')!)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new PlatformError(res.status === 404 ? 'This bet could not be found.' : rgsMessage(data?.code, res.status));
    const round = decodeRound(this.cfg, data.state);
    if (!payoutMatches(round, data.payoutMultiplier)) throw new PlatformError('Replay verification failed.');
    this.round = round;
    const currency = currencyFor(this.p.get('currency') ?? 'USD');
    const amount = Number(this.p.get('amount'));
    const bet = Number.isFinite(amount) && amount > 0 ? amount : RGS_UNITS;
    return { bets: [bet], defaultBet: bet, balance: 0, currency, flags: {}, replay: { mode: round.mode, bet }, demo: false };
  }

  async play() {
    if (!this.round) throw new PlatformError('Replay not loaded.');
    return { round: this.round, balance: 0 };
  }

  async endRound() {
    return 0;
  }
}

function rgsMessage(code: unknown, status: number): string {
  switch (code) {
    case 'ERR_IPB': return 'Insufficient balance.';
    case 'ERR_IS': return 'Your session has expired. Please reload the game.';
    case 'ERR_VAL': return 'That bet is not allowed.';
    case 'ERR_ATE': return 'Authentication failed. Please reload the game.';
    case 'ERR_GLE': return 'Gambling limits reached.';
    case 'ERR_LOC': return 'This game is not available in your location.';
    default: return `The game server returned an error (${typeof code === 'string' ? code : status}). Please try again.`;
  }
}
