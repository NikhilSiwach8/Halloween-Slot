import type { GameConfig } from '../config/types';

/** Integer units -> display string (display only; all math stays in integer units). */
export function formatCredits(units: number, cfg: GameConfig): string {
  const c = cfg.currency;
  const decimals = c.decimals ?? String(c.unitsPerCredit).length - 1;
  const value = (units / c.unitsPerCredit).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (!c.symbol) return value;
  return c.symbolAfter ? `${value} ${c.symbol}` : `${c.symbol}${value}`;
}
