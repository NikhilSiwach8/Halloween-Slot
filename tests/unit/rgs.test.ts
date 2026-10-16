import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/gameConfig';
import { BOOK_STAKE, makeBook, playBookRound } from '../../src/math/books';
import { StakeRgsAdapter } from '../../src/platform/StakeRgsAdapter';

const BET = 1_000_000; // 1.00 in RGS units

function mockRgs(seed: number, tamper = 0) {
  const book = makeBook(DEFAULT_CONFIG, 1, seed, 'bonus', playBookRound(DEFAULT_CONFIG, seed, 'bonus'));
  const calls: string[] = [];
  let balance = 100 * BET;
  const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
    const path = new URL(url).pathname;
    calls.push(path);
    const body = JSON.parse(init.body);
    expect(body.sessionID).toBe('abc');
    const json = (d: unknown) => ({ ok: true, status: 200, json: async () => d });
    if (path === '/wallet/authenticate')
      return json({ balance: { amount: balance, currency: 'USD' }, config: { minBet: 100_000, maxBet: 100 * BET, stepBet: 10_000, defaultBetLevel: BET, betLevels: [200_000, BET, 2 * BET] }, round: null });
    if (path === '/wallet/play') {
      expect(body).toMatchObject({ amount: BET, mode: 'BASE' });
      balance -= BET;
      return json({ balance: { amount: balance, currency: 'USD' }, round: { betID: 1, active: book.payoutMultiplier > 0, mode: 'BASE', payoutMultiplier: book.payoutMultiplier + tamper, state: book.events } });
    }
    if (path === '/wallet/end-round') {
      balance += (BET * (book.payoutMultiplier + tamper)) / 100;
      return json({ balance: { amount: balance, currency: 'USD' } });
    }
    if (path === '/bet/event') return json({ event: body.event });
    throw new Error(`unexpected ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { book, calls, balance: () => balance };
}

afterEach(() => vi.unstubAllGlobals());

describe('StakeRgsAdapter (mocked RGS)', () => {
  it('reads bet levels and currency from authenticate', async () => {
    mockRgs(5);
    const a = StakeRgsAdapter.fromUrl(DEFAULT_CONFIG, '?sessionID=abc&rgs_url=rgs.example.test')!;
    await a.init();
    expect(a.config.bets).toEqual([200_000, BET, 2 * BET]);
    expect(a.config.currency).toMatchObject({ unitsPerCredit: 1_000_000, code: 'USD', symbol: '$', decimals: 2 });
  });

  it('replays the RGS-selected book, verifies the payout and ends the round', async () => {
    // find a seed with a non-zero payout so end-round is exercised
    let seed = 1;
    while (playBookRound(DEFAULT_CONFIG, seed, 'bonus').totalWin === 0) seed++;
    const m = mockRgs(seed);
    const a = StakeRgsAdapter.fromUrl(DEFAULT_CONFIG, '?sessionID=abc&rgs_url=rgs.example.test')!;
    await a.init();
    let r = await a.spin(BET);
    while (!r.settled) r = await a.playBonusStage();
    expect(r.settled!.totalWin).toBe((BET * m.book.payoutMultiplier) / BOOK_STAKE);
    expect(m.calls).toContain('/wallet/end-round');
    expect(a.getState().balance).toBe(m.balance());
  });

  it('refuses to display a round whose replay does not match the RGS payout', async () => {
    let seed = 1;
    while (playBookRound(DEFAULT_CONFIG, seed, 'bonus').stats.bonus) seed++;
    mockRgs(seed, 5);
    const a = StakeRgsAdapter.fromUrl(DEFAULT_CONFIG, '?sessionID=abc&rgs_url=rgs.example.test')!;
    await a.init();
    await expect(a.spin(BET)).rejects.toThrow(/verification failed/);
  });

  it('is only selected when sessionID and rgs_url are present', () => {
    expect(StakeRgsAdapter.fromUrl(DEFAULT_CONFIG, '?seed=1')).toBeNull();
  });
});
