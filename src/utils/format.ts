import type { GameConfig } from '../config/types';

/** Integer units -> "1,234.50" demo credits (display only; all math stays in integer units). */
export function formatCredits(units: number, cfg: GameConfig): string {
  const per = cfg.currency.unitsPerCredit;
  const whole = Math.trunc(units / per);
  const frac = Math.abs(units % per);
  const decimals = String(per).length - 1;
  return `${whole.toLocaleString('en-US')}${decimals ? '.' + String(frac).padStart(decimals, '0') : ''}`;
}
