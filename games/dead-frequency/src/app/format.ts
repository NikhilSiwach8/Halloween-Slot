import type { GameConfig } from '../config/types';

/** Integer units -> display credits. */
export const formatMoney = (cfg: GameConfig, units: number) =>
  (units / cfg.currency.unitsPerCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Hundredths of stake -> "12.5x". */
export const formatX = (x100: number) => `${(x100 / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}x`;
