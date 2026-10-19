import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config/gameConfig';
import { encodeRound } from '../src/math/bookFormat';
import { SeededRng } from '../src/engine/rng';
import { playRound } from '../src/engine/round';
import { StakePlatform } from '../src/platform/platform';
import { formatMoney } from '../src/app/format';

/** Checks that map directly to items on Stake Engine's approval checklist. */
const cfg = DEFAULT_CONFIG;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const auth = (over: Record<string, unknown> = {}, round: unknown = null, currency = 'USD') => ({
  balance: { amount: 100_000_000, currency },
  round,
  config: { betLevels: [100_000, 1_000_000, 2_000_000], defaultBetLevel: 1_000_000, minBet: 100_000, maxBet: 2_000_000, stepBet: 100_000, ...over },
});

describe('Stake approval: currency display', () => {
  const usd = { unitsPerCredit: 1_000_000, code: 'USD', symbol: '$', decimals: 2 };
  it('shows sub-cent payouts instead of rounding them to 0.00', () => {
    expect(formatMoney(usd, 3_000)).toBe('$0.003'); // a 0.03x win on a 0.10 bet
    expect(formatMoney(usd, 12_500)).toBe('$0.0125');
    expect(formatMoney(usd, 1_500_000)).toBe('$1.50');
    expect(formatMoney(usd, 1)).toBe('$0.000001');
  });
  it('shows social currencies without a "$" prefix', async () => {
    for (const code of ['SC', 'GC', 'XSC', 'XGC']) {
      vi.stubGlobal('fetch', () => json(auth({}, null, code)));
      const s = await StakePlatform.fromUrl(cfg, '?sessionID=a&rgs_url=r.example')!.init();
      const shown = formatMoney(s.currency, 12_500_000);
      expect(shown).not.toMatch(/\$/);
      expect(shown).toBe(`12.50 ${code.replace('X', '')}`);
    }
  });
});

describe('Stake approval: authenticate and requests', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fails authentication with a clear message when rgs_url is invalid', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const p = StakePlatform.fromUrl(cfg, '?sessionID=a&rgs_url=not-a-real-host.invalid')!;
    await expect(p.init()).rejects.toThrow(/Could not connect to the game server/);
  });

  it('uses every betting parameter from authenticate, building levels from min/max/step if none are listed', async () => {
    vi.stubGlobal('fetch', () => json(auth({ betLevels: [], defaultBetLevel: 300_000, minBet: 200_000, maxBet: 600_000, stepBet: 200_000 })));
    const s = await StakePlatform.fromUrl(cfg, '?sessionID=a&rgs_url=r.example')!.init();
    expect(s.bets).toEqual([200_000, 400_000, 600_000]);
    expect(s.defaultBet).toBe(200_000);
  });

  it('restores the bet amount of an active round from authenticate', async () => {
    vi.stubGlobal('fetch', (url: string) =>
      url.endsWith('/wallet/authenticate')
        ? json(auth({}, { active: true, amount: 2_000_000, payoutMultiplier: 0, mode: 'BASE' }))
        : json({ balance: { amount: 100_000_000, currency: 'USD' } }),
    );
    const s = await StakePlatform.fromUrl(cfg, '?sessionID=a&rgs_url=r.example')!.init();
    expect(s.defaultBet).toBe(2_000_000);
  });

  it('does not send end-round after a zero-win bet', async () => {
    let lose = playRound(cfg, 'BASE', new SeededRng(1));
    for (let s = 2; lose.winX100 !== 0; s++) lose = playRound(cfg, 'BASE', new SeededRng(s));
    const calls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      calls.push(url.split('/').slice(-2).join('/'));
      if (url.endsWith('/wallet/authenticate')) return json(auth());
      if (url.endsWith('/wallet/play')) return json({ balance: { amount: 99_000_000, currency: 'USD' }, round: { payoutMultiplier: 0, active: false, state: encodeRound(cfg, lose) } });
      return json({ balance: { amount: 99_000_000, currency: 'USD' } });
    });
    const p = StakePlatform.fromUrl(cfg, '?sessionID=a&rgs_url=r.example')!;
    await p.init();
    const r = await p.play('BASE', 1_000_000);
    await p.endRound(r.round, 1_000_000);
    expect(calls).not.toContain('wallet/end-round');
  });
});
