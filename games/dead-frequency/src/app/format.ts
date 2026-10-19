import type { Currency } from '../platform/platform';

/**
 * Integer units -> display money, e.g. "$1.50", "12.00 SC", "1,000.00". Amounts finer than the
 * currency's usual decimals (sub-cent payouts, e.g. a 0.03x win on a 0.10 bet = 0.003) show as
 * many extra digits as they need, up to 6, so they are never rounded away to "0.00".
 */
export const formatMoney = (c: Currency, units: number) => {
  let digits = c.decimals;
  while (digits < 6 && Math.round(units) % Math.max(1, Math.round(c.unitsPerCredit / 10 ** digits)) !== 0) digits++;
  const n = (units / c.unitsPerCredit).toLocaleString('en', { minimumFractionDigits: c.decimals, maximumFractionDigits: digits });
  if (!c.symbol) return n;
  return c.symbolAfter ? `${n} ${c.symbol}` : `${c.symbol}${n}`;
};

/** Hundredths of stake -> "12.5x". */
export const formatX = (x100: number) => `${(x100 / 100).toLocaleString('en', { maximumFractionDigits: 2 })}x`;
