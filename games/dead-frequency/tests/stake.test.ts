import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, MODE_ORDER } from '../src/config/gameConfig';
import { BookFormatError, decodeRound, encodeRound } from '../src/math/bookFormat';
import { STAKE_MODE_NAME, assignWeights, generateMode, lookupStats, modeMaxWinX, stakePlans } from '../src/math/books';
import { SeededRng } from '../src/engine/rng';
import { playRound } from '../src/engine/round';
import { ReplayPlatform, StakePlatform, listedModeNames, modeFromRgsName, payoutMatches, rgsErrorCode, rgsModeName } from '../src/platform/platform';

const cfg = DEFAULT_CONFIG;

describe('book format', () => {
  it('round-trips every mode exactly, including bonuses, Mystery and Retune', () => {
    const rng = new SeededRng(77);
    for (const mode of MODE_ORDER) {
      for (let i = 0; i < 400; i++) {
        const round = playRound(cfg, mode, rng);
        const back = decodeRound(cfg, JSON.parse(JSON.stringify(encodeRound(cfg, round))));
        expect(back.winX100).toBe(round.winX100);
        expect(back.capped).toBe(round.capped);
        expect(back.mystery).toEqual(round.mystery);
        const spins = (r: typeof round) => [...(r.spin ? [r.spin] : []), ...r.bonuses.flatMap((b) => b.spins)];
        const a = spins(round);
        const b = spins(back);
        expect(b.length).toBe(a.length);
        a.forEach((s, k) => {
          expect(b[k].landed).toEqual(s.landed);
          expect(b[k].board).toEqual(s.board);
          expect(b[k].reveal).toEqual(s.reveal);
          expect(b[k].wins).toEqual(s.wins);
          expect(b[k].winX100).toBe(s.winX100);
          expect(b[k].signalMeter).toBe(s.signalMeter);
          expect(b[k].retrigger).toBe(s.retrigger);
        });
      }
    }
  });

  it('rejects a tampered win, board or version', () => {
    const round = playRound(cfg, 'BUY_NIGHT_SHIFT', new SeededRng(3));
    const ev = encodeRound(cfg, round);
    const bump = structuredClone(ev);
    bump[0].win += 100;
    expect(() => decodeRound(cfg, bump)).toThrow(BookFormatError);
    const board = structuredClone(ev);
    const s = board[0].bonuses[0].spins.find((x) => x.w > 0)!;
    s.w += 1;
    expect(() => decodeRound(cfg, board)).toThrow(BookFormatError);
    const ver = structuredClone(ev);
    ver[0].v = '9.9.9';
    expect(() => decodeRound(cfg, ver)).toThrow(/version/);
  });
});

describe('publication weights', () => {
  it('hit the target RTP exactly and keep the planned max-win probability', () => {
    const plan = stakePlans(cfg, 0.01).find((p) => p.mode === 'BUY_DEAD_AIR')!;
    const gen = generateMode(plan, 5);
    const { rows, stats } = assignWeights(gen, 0.96);
    expect(stats.rtp).toBeCloseTo(0.96, 9);
    expect(stats.maxWinX).toBe(cfg.maxWinX);
    expect(stats.maxWinProbability).toBeCloseTo(1 / 20_000, 9);
    expect(lookupStats(rows, plan.cost).rtp).toBeCloseTo(0.96, 9);
    for (const b of gen.books) expect(decodeRound(cfg, b.events).winX100).toBe(b.payoutMultiplier);
  }, 60_000);

  it('Static Storm declares its own ceiling (no multipliers)', () => {
    expect(modeMaxWinX(cfg, 'STATIC_STORM')).toBe(10_240);
    expect(modeMaxWinX(cfg, 'BASE')).toBe(cfg.maxWinX);
  });
});

describe('RGS client', () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

  it('authenticates, plays, verifies and ends a winning round', async () => {
    let round = playRound(cfg, 'BASE', new SeededRng(1));
    for (let s = 2; round.winX100 === 0; s++) round = playRound(cfg, 'BASE', new SeededRng(s));
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ url, body });
      if (url.endsWith('/wallet/authenticate')) {
        return json({ balance: { amount: 1_000_000_000, currency: 'USD' }, round: null, config: { betLevels: [100_000, 1_000_000, 2_000_000], defaultBetLevel: 1_000_000, minBet: 100_000, maxBet: 2_000_000, stepBet: 100_000, jurisdiction: { disabledBuyFeature: true } } });
      }
      if (url.endsWith('/wallet/play')) return json({ balance: { amount: 999_000_000, currency: 'USD' }, round: { payoutMultiplier: round.winX100 / 100, costMultiplier: 1, active: true, state: encodeRound(cfg, round) } });
      if (url.endsWith('/wallet/end-round')) return json({ balance: { amount: 999_000_000 + (1_000_000 * round.winX100) / 100, currency: 'USD' } });
      return json({}, 404);
    });
    const p = StakePlatform.fromUrl(cfg, '?sessionID=abc&rgs_url=rgs.example.com&lang=en')!;
    const session = await p.init();
    expect(session.bets).toEqual([100_000, 1_000_000, 2_000_000]);
    expect(session.currency.symbol).toBe('$');
    expect(session.flags.disabledBuyFeature).toBe(true);
    const played = await p.play('BASE', 1_000_000);
    expect(played.round.winX100).toBe(round.winX100);
    expect(calls[1]).toEqual({ url: 'https://rgs.example.com/wallet/play', body: { sessionID: 'abc', amount: 1_000_000, currency: 'USD', mode: 'BASE' } });
    const after = await p.endRound(played.round, 1_000_000);
    expect(after).toBe(999_000_000 + (1_000_000 * round.winX100) / 100);
    expect(calls.map((c) => c.url.split('/').slice(-2).join('/'))).toEqual(['wallet/authenticate', 'wallet/play', 'wallet/end-round']);
  });

  it('pays and shows the server payout when it differs from the book, and sends the currency', async () => {
    const round = playRound(cfg, 'BUY_POSSESSION', new SeededRng(4));
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return url.endsWith('/wallet/play')
        ? json({ balance: { amount: 1, currency: 'EUR' }, round: { payoutMultiplier: round.winX100 / 100 + 5, active: true, state: encodeRound(cfg, round) } })
        : json({ balance: { amount: 1, currency: 'EUR' }, round: null, config: { betLevels: [1_000_000], defaultBetLevel: 1_000_000, minBet: 1, maxBet: 1e9, stepBet: 1 } });
    });
    const p = StakePlatform.fromUrl(cfg, '?sessionID=x&rgs_url=https://r.example')!;
    await p.init();
    const r = await p.play('BUY_POSSESSION', 1_000_000);
    expect(r.round.winX100).toBe(round.winX100 + 500);
    expect(bodies[1]).toMatchObject({ amount: 1_000_000, currency: 'EUR', mode: expect.any(String) });
  });

  it('reads RGS error codes from every response shape and keeps the code', async () => {
    for (const body of [{ error: 'ERR_VAL' }, { error: { code: 'ERR_VAL' } }, { status: { statusCode: 'ERR_VAL' } }]) {
      vi.stubGlobal('fetch', () => json(body, 400));
      const p = StakePlatform.fromUrl(cfg, '?sessionID=x&rgs_url=r.example')!;
      await expect(p.init()).rejects.toMatchObject({ code: 'ERR_VAL', message: expect.stringMatching(/not allowed/) });
    }
    expect(rgsErrorCode({ status: { statusCode: 'SUCCESS' } })).toBeUndefined();
  });

  it('maps RGS errors to player messages', async () => {
    vi.stubGlobal('fetch', () => json({ code: 'ERR_IPB' }, 400));
    const p = StakePlatform.fromUrl(cfg, '?sessionID=x&rgs_url=r.example')!;
    await expect(p.init()).rejects.toThrow('Insufficient balance.');
  });

  it('replay fetches the round without any wallet call', async () => {
    const round = playRound(cfg, 'BUY_DEAD_AIR', new SeededRng(9));
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      urls.push(url);
      return json({ payoutMultiplier: round.winX100 / 100, costMultiplier: 275, state: encodeRound(cfg, round) });
    });
    const search = '?replay=true&game=g-1&version=3&mode=DEAD_AIR&event=42&rgs_url=rgs.example.com&currency=EUR&amount=2000000&sessionID=ignored';
    expect(StakePlatform.fromUrl(cfg, search)).toBeNull();
    const p = ReplayPlatform.fromUrl(cfg, search)!;
    const session = await p.init();
    expect(urls).toEqual(['https://rgs.example.com/bet/replay/g-1/3/DEAD_AIR/42']);
    expect(session.replay).toEqual({ mode: 'BUY_DEAD_AIR', bet: 2_000_000 });
    expect(session.currency.symbol).toBe('€');
    expect((await p.play()).round.winX100).toBe(round.winX100);
  });

  it('sends mode names exactly as the RGS lists them in betModes', async () => {
    expect(listedModeNames({ base: {}, dead_air: {} })).toEqual(['base', 'dead_air']);
    expect(listedModeNames(['BASE', { name: 'Dead_Air' }])).toEqual(['BASE', 'Dead_Air']);
    expect(listedModeNames(undefined)).toEqual([]);
    expect(rgsModeName('BUY_DEAD_AIR', ['base', 'dead_air'])).toBe('dead_air');
    expect(rgsModeName('BUY_DEAD_AIR', [])).toBe('DEAD_AIR');
    const round = playRound(cfg, 'BUY_DEAD_AIR', new SeededRng(2));
    const sent: string[] = [];
    vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
      if (url.endsWith('/wallet/play')) {
        sent.push(JSON.parse(String(init.body)).mode);
        return json({ balance: { amount: 1, currency: 'USD' }, round: { payoutMultiplier: round.winX100, active: true, state: encodeRound(cfg, round) } });
      }
      return json({ balance: { amount: 1e9, currency: 'USD' }, round: null, config: { betLevels: [1_000_000], defaultBetLevel: 1_000_000, minBet: 1, maxBet: 1e9, stepBet: 1, betModes: { base: {}, dead_air: {} } } });
    });
    const p = StakePlatform.fromUrl(cfg, '?sessionID=x&rgs_url=r.example')!;
    await p.init();
    await p.play('BUY_DEAD_AIR', 1_000_000);
    expect(sent).toEqual(['dead_air']);
  });

  it('names modes as index.json does and accepts either payout representation', () => {
    for (const m of MODE_ORDER) expect(modeFromRgsName(rgsModeName(m))).toBe(m);
    expect(modeFromRgsName(STAKE_MODE_NAME.BUY_NIGHT_SHIFT)).toBe('BUY_NIGHT_SHIFT');
    const r = playRound(cfg, 'BASE', new SeededRng(11));
    expect(payoutMatches(r, r.winX100)).toBe(true);
    expect(payoutMatches(r, r.winX100 / 100)).toBe(true);
    expect(payoutMatches({ ...r, winX100: 1234 }, 99)).toBe(false);
  });
});
