import { describe, expect, it } from 'vitest';
import { socialize } from '../src/app/socialText';

/** Stake's restricted phrases for Stake.us (social casino). */
const RESTRICTED = /\b(bet|bets|betting|bought|buy|buys|cash|credit|credits|currency|deposit|gamble|money|paid|pay|pays|payer|payout|paytable|profit|purchase|purchases|rebet|wager|withdraw)\b|\bstake\b(?!\s*Engine|\.us)/i;

describe('social casino wording', () => {
  it("rewrites this game's own copy naturally", () => {
    expect(socialize('Feature Spins & Bonus Buy')).toBe('Feature Spins & Bonus Features');
    expect(socialize('Buy Dead Air for $275.00?')).toBe('Play Dead Air for $275.00?');
    expect(socialize('Bonus bought.')).toBe('Bonus instantly triggered.');
    expect(socialize('You paid for this broadcast. There are no refunds.')).toBe('You asked for this broadcast. There is no turning back.');
    expect(socialize('Cash prize: 10x')).toBe('Coin prize: 10x');
    expect(socialize('Stake')).toBe('Play amount');
    expect(socialize('Raise stake')).toBe('Raise play amount');
    expect(socialize('TM and © 2026 Stake Engine.')).toBe('TM and © 2026 Stake Engine.');
    expect(socialize('Wins pay left to right')).toBe('Wins count left to right');
    expect(socialize('RULES AND PAYTABLE')).toBe('RULES AND WIN TABLE');
  });

  it('leaves no restricted phrase and is idempotent', () => {
    const samples = [
      'Bet replay · no bets are placed', 'a bonus purchase asks for confirmation', 'Each winning symbol pays its value × the number of ways.',
      'Stake x1.5: twice the chance to trigger a bonus. Bonus buys are unaffected.', 'Raises the stake to 1.5×.', 'Wins are multiples of the base stake.',
      'Winnings are settled by the game server.', 'Demo · demo credits only · not real money', 'Cost of each mode', 'paid out', 'Total bet',
    ];
    for (const s of samples) {
      const once = socialize(s);
      expect(once, s).not.toMatch(RESTRICTED);
      expect(socialize(once)).toBe(once);
    }
  });
});
