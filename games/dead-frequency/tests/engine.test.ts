import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, MODE_ORDER, doubleTriggers, roundCost, validateConfig } from '../src/config/gameConfig';
import type { GameConfig, ModeId } from '../src/config/types';
import { boardFromRows, generateBoard, positionsOf } from '../src/engine/board';
import { SeededRng } from '../src/engine/rng';
import { Cap, bonusForAntennas, playBonus, playRound } from '../src/engine/round';
import { evaluateWays } from '../src/engine/ways';

const cfg = DEFAULT_CONFIG;
const rows = (s: string) => s.trim().split('\n').map((l) => l.trim().split(/\s+/));

describe('config', () => {
  it('is valid', () => {
    expect(validateConfig(cfg)).toEqual([]);
  });

  it('every mode costs a whole number of units at every stake', () => {
    for (const b of cfg.bets) for (const m of MODE_ORDER) expect(Number.isInteger(roundCost(cfg, m, b))).toBe(true);
  });

  it('Double Chance doubles the weight of every bonus-triggering Antenna count and nothing else', () => {
    const base = cfg.profiles.base.antennaCount;
    const dc = cfg.profiles.doubleChance.antennaCount;
    expect(dc).toEqual(doubleTriggers(base));
    base.forEach((e, i) => expect(dc[i].weight).toBe(e.value >= 3 ? e.weight * 2 : e.weight));
  });

  it('maps Antenna counts to bonuses', () => {
    expect(bonusForAntennas(cfg, 2)).toBeNull();
    expect(bonusForAntennas(cfg, 3)).toBe('NIGHT_SHIFT');
    expect(bonusForAntennas(cfg, 4)).toBe('POSSESSION');
    expect(bonusForAntennas(cfg, 5)).toBe('DEAD_AIR');
    expect(bonusForAntennas(cfg, 6)).toBe('DEAD_AIR');
  });
});

describe('ways evaluation', () => {
  it('pays symbol value x ways for 3+ adjacent reels from reel 1', () => {
    const b = boardFromRows(rows(`
      HOST  HOST  HOST  VALVE MIC   MIC
      HOST  MIC   HOST  VALVE MIC   MIC
      VALVE MIC   CASSETTE VALVE MIC MIC
      VALVE MIC   CASSETTE VALVE MIC MIC`));
    const { wins, totalX100 } = evaluateWays(cfg, b);
    const host = wins.find((w) => w.symbol === 'HOST')!;
    expect(host.length).toBe(3);
    expect(host.ways).toBe(2 * 1 * 2);
    expect(host.winX100).toBe(cfg.paytable.HOST[0] * 4);
    // VALVE on reel 1 but not reel 2: no win; MIC is not on reel 1: no win.
    expect(wins.map((w) => w.symbol)).toEqual(['HOST']);
    expect(totalX100).toBe(host.winX100);
  });

  it('wild multipliers multiply along a way', () => {
    const b = boardFromRows(rows(`
      HOST W2   W3   VALVE MIC MIC
      MIC  HOST MIC  VALVE MIC MIC
      MIC  MIC  MIC  VALVE MIC MIC
      MIC  MIC  MIC  VALVE MIC MIC`));
    const host = evaluateWays(cfg, b).wins.find((w) => w.symbol === 'HOST')!;
    expect(host.ways).toBe(1 * 2 * 1);
    // reel 2: HOST (1) + wild x2 (2) = 3; reel 3: wild x3 = 3
    expect(host.multipliedWays).toBe(1 * 3 * 3);
    expect(host.winX100).toBe(cfg.paytable.HOST[0] * 9);
  });

  it('applies the global multiplier and clamps to the 6-reel pay', () => {
    const b = boardFromRows(rows(`
      WIDOW WIDOW WIDOW WIDOW WIDOW WIDOW
      VALVE MIC VALVE MIC VALVE MIC
      VALVE MIC VALVE MIC VALVE MIC
      VALVE MIC VALVE MIC VALVE MIC`));
    const widow = evaluateWays(cfg, b, 7).wins.find((w) => w.symbol === 'WIDOW')!;
    expect(widow.length).toBe(6);
    expect(widow.winX100).toBe(cfg.paytable.WIDOW[3] * 7);
  });
});

describe('board generation', () => {
  const spins = (profile: keyof GameConfig['profiles'], n: number, seed = 1) => {
    const rng = new SeededRng(seed);
    return Array.from({ length: n }, () => generateBoard(cfg, cfg.profiles[profile], rng));
  };

  it('never puts a wild on reel 1, an Antenna twice on one reel, or a Tape off reel 6', () => {
    for (const b of spins('base', 20_000)) {
      expect(b[0].some((c) => c.s === 'WILD')).toBe(false);
      for (const reel of b) expect(reel.filter((c) => c.s === 'ANTENNA').length).toBeLessThanOrEqual(1);
      for (let r = 0; r < cfg.reels - 1; r++) expect(b[r].some((c) => c.s === 'TAPE')).toBe(false);
    }
  });

  it('Static Storm guarantees at least 2 full Static reels and no Antennas or Tapes', () => {
    for (const b of spins('staticStorm', 5_000)) {
      expect(b.filter((reel) => reel.every((c) => c.s === 'STATIC')).length).toBeGreaterThanOrEqual(2);
      expect(positionsOf(b, 'ANTENNA').length + positionsOf(b, 'TAPE').length).toBe(0);
    }
  });

  it('Haunted Wilds guarantees at least 2 multiplier wilds', () => {
    for (const b of spins('hauntedWilds', 5_000)) {
      expect(b.flat().filter((c) => c.s === 'WILD' && c.m >= 2).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('Dead Air expands any Static to its whole reel', () => {
    const rng = new SeededRng(4);
    for (let i = 0; i < 5_000; i++) {
      const b = generateBoard(cfg, cfg.profiles.deadAir, rng, { expandStatic: true });
      for (const reel of b) {
        const n = reel.filter((c) => c.s === 'STATIC').length;
        expect(n === 0 || n === cfg.rows).toBe(true);
      }
    }
  });
});

describe('rounds', () => {
  it('is deterministic for a seed', () => {
    for (const mode of MODE_ORDER) {
      expect(playRound(cfg, mode, new SeededRng(99))).toEqual(playRound(cfg, mode, new SeededRng(99)));
    }
  });

  it('every Static reveals as one symbol, and Retune only happens when the first reveal won nothing', () => {
    const rng = new SeededRng(3);
    let retunes = 0;
    for (let i = 0; i < 20_000; i++) {
      const r = playRound(cfg, 'STATIC_STORM', rng);
      const s = r.spin!;
      const reveal = s.reveal!;
      const final = reveal.retunedTo ?? reveal.first;
      for (const [reel, row] of reveal.positions) expect(s.board[reel][row].s).toBe(final);
      if (reveal.retunedTo) {
        retunes++;
        expect(reveal.retunedTo).not.toBe(reveal.first);
      } else {
        const hit = new Set(s.wins.flatMap((w) => w.positions.map(([a, b]) => `${a},${b}`)));
        expect(reveal.positions.some(([a, b]) => hit.has(`${a},${b}`))).toBe(true);
      }
    }
    expect(retunes).toBeGreaterThan(0);
  });

  it('Possession keeps every Static that lands', () => {
    const rng = new SeededRng(8);
    for (let i = 0; i < 300; i++) {
      const b = playBonus(cfg, 'POSSESSION', 'BUY', rng, new Cap(cfg.maxWinX * 100));
      const seen = new Set<string>();
      for (const s of b.spins) {
        const now = new Set(positionsOf(s.landed, 'STATIC').map(([r, row]) => `${r},${row}`));
        for (const k of seen) expect(now.has(k)).toBe(true);
        for (const k of now) seen.add(k);
      }
    }
  });

  it('Night Shift Signal Meter climbs by 1 per Static reel and never resets', () => {
    const rng = new SeededRng(12);
    for (let i = 0; i < 300; i++) {
      const b = playBonus(cfg, 'NIGHT_SHIFT', 'BUY', rng, new Cap(cfg.maxWinX * 100));
      let meter = cfg.bonuses.NIGHT_SHIFT.signalMeter!.start;
      for (const s of b.spins) {
        meter = Math.min(cfg.bonuses.NIGHT_SHIFT.signalMeter!.max, meter + s.landed.filter((reel) => reel.some((c) => c.s === 'STATIC')).length);
        expect(s.signalMeter).toBe(meter);
        for (const w of s.wins) expect(w.globalMultiplier).toBe(meter);
      }
    }
  });

  it('retriggers add spins up to the limit', () => {
    const rng = new SeededRng(21);
    let retriggered = 0;
    for (let i = 0; i < 2_000; i++) {
      const b = playBonus(cfg, 'NIGHT_SHIFT', 'BUY', rng, new Cap(cfg.maxWinX * 100));
      const added = b.spins.reduce((a, s) => a + (s.retrigger ?? 0), 0);
      expect(b.totalSpins).toBe(cfg.bonuses.NIGHT_SHIFT.spins + added);
      expect(b.totalSpins).toBeLessThanOrEqual(cfg.retrigger.maxTotalSpins);
      expect(b.spins.length).toBe(b.totalSpins);
      if (added) retriggered++;
    }
    expect(retriggered).toBeGreaterThan(0);
  });

  it('a Tape plays the Mystery Bonus, and a bonus prize plays that bonus', () => {
    const forced: GameConfig = {
      ...cfg,
      profiles: { ...cfg.profiles, base: { ...cfg.profiles.base, tapeChance: 1, antennaCount: [{ value: 0, weight: 1 }] } },
      mystery: { prizes: [{ value: { kind: 'BONUS', bonus: 'POSSESSION' }, weight: 1 }] },
    };
    const r = playRound(forced, 'BASE', new SeededRng(5));
    expect(r.spin!.tape).toBe(true);
    expect(r.mystery?.prize).toEqual({ kind: 'BONUS', bonus: 'POSSESSION' });
    expect(r.bonuses.map((b) => [b.type, b.source])).toEqual([['POSSESSION', 'TAPE']]);
  });

  it('a round never pays more than the max win, and stops when it is reached', () => {
    const rich: GameConfig = { ...cfg, paytable: { ...cfg.paytable, VALVE: [500_000, 500_000, 500_000, 500_000] } };
    const rng = new SeededRng(1);
    let capped = 0;
    for (let i = 0; i < 300; i++) {
      const r = playRound(rich, 'BUY_NIGHT_SHIFT', rng);
      expect(r.winX100).toBeLessThanOrEqual(cfg.maxWinX * 100);
      const paid = r.bonuses.reduce((a, b) => a + b.winX100, 0);
      expect(paid).toBe(r.winX100);
      if (r.capped) {
        capped++;
        expect(r.winX100).toBe(cfg.maxWinX * 100);
        const spins = r.bonuses[0].spins;
        expect(spins.length).toBeLessThanOrEqual(r.bonuses[0].totalSpins);
        expect(spins[spins.length - 1].winX100).toBeGreaterThan(0);
      }
    }
    expect(capped).toBeGreaterThan(0);
  });

  it('Feature Spins and Bonus Buys never start an Antenna bonus or a Mystery Bonus', () => {
    const rng = new SeededRng(2);
    for (const mode of ['STATIC_STORM', 'HAUNTED_WILDS'] as ModeId[]) {
      for (let i = 0; i < 5_000; i++) {
        const r = playRound(cfg, mode, rng);
        expect(r.bonuses).toEqual([]);
        expect(r.mystery).toBeNull();
      }
    }
  });

  it('a Cap pays only up to its limit', () => {
    const cap = new Cap(1000);
    expect(cap.add(600)).toBe(600);
    expect(cap.add(600)).toBe(400);
    expect(cap.capped).toBe(true);
    expect(cap.add(5)).toBe(0);
    expect(cap.total).toBe(1000);
  });
});
