import { PAYING_SYMBOLS } from '../config/symbols';
import type { GameConfig, PayingSymbolId } from '../config/types';
import type { Board } from './board';

export interface WayWin {
  symbol: PayingSymbolId;
  /** Number of consecutive reels from reel 1. */
  length: number;
  /** Plain way count (product of matching cells per reel). */
  ways: number;
  /** Product of per-reel matching weights, where a wild counts as its multiplier. */
  multipliedWays: number;
  payX100: number;
  /** Global multiplier applied (the Night Shift Signal Meter; 1 elsewhere). */
  globalMultiplier: number;
  winX100: number;
  positions: [number, number][];
}

/**
 * 6-reel ways evaluation, left to right, `minWayLength`+ reels. On Air wilds substitute for every
 * paying symbol and their multipliers multiply along a way: for each reel the matching weight is
 * (symbol cells) + (sum of wild multipliers), and a symbol's total is the product over reels.
 */
export function evaluateWays(cfg: GameConfig, board: Board, globalMultiplier = 1): { wins: WayWin[]; totalX100: number } {
  const wins: WayWin[] = [];
  let totalX100 = 0;
  for (const symbol of PAYING_SYMBOLS) {
    let ways = 1;
    let multipliedWays = 1;
    let length = 0;
    const positions: [number, number][] = [];
    for (let r = 0; r < board.length; r++) {
      let n = 0;
      let w = 0;
      board[r].forEach((c, row) => {
        if (c.s === symbol) { n++; w++; positions.push([r, row]); }
        else if (c.s === 'WILD') { n++; w += c.m; positions.push([r, row]); }
      });
      if (n === 0) break;
      ways *= n;
      multipliedWays *= w;
      length++;
    }
    if (length < cfg.minWayLength) continue;
    const pays = cfg.paytable[symbol];
    const payX100 = pays[Math.min(length - cfg.minWayLength, pays.length - 1)];
    const winX100 = payX100 * multipliedWays * globalMultiplier;
    if (winX100 <= 0) continue;
    totalX100 += winX100;
    wins.push({ symbol, length, ways, multipliedWays, payX100, globalMultiplier, winX100, positions });
  }
  return { wins, totalX100 };
}
