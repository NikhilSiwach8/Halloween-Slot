import type { Currency } from '../platform/platform';

/** Integer units -> display money, e.g. "$1.50", "12.00 SC", "1,000.00". */
export const formatMoney = (c: Currency, units: number) => {
  const n = (units / c.unitsPerCredit).toLocaleString('en', { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals });
  if (!c.symbol) return n;
  return c.symbolAfter ? `${n} ${c.symbol}` : `${c.symbol}${n}`;
};

/** Hundredths of stake -> "12.5x". */
export const formatX = (x100: number) => `${(x100 / 100).toLocaleString('en', { maximumFractionDigits: 2 })}x`;
