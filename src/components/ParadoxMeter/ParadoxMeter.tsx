import type { DebtState, GameConfig } from '../../config/types';

const STATE_TEXT: Record<DebtState, string> = {
  STABLE: 'Stable',
  UNSTABLE: 'Unstable',
  CRITICAL: 'Critical',
  DISCHARGE: 'Discharge',
};

export function ParadoxMeter({ value, state, cfg }: { value: number; state: DebtState; cfg: GameConfig }) {
  const t = cfg.debt.thresholds;
  const pct = (v: number) => `${(v / cfg.debt.max) * 100}%`;
  return (
    <div className={`paradox-meter state-${state.toLowerCase()}`} data-testid="debt-meter" data-value={value} data-state={state}>
      <div className="meter-head">
        <span className="meter-label">Paradox Debt</span>
        <span className="meter-state">{STATE_TEXT[state]} · {value}/{cfg.debt.max}</span>
      </div>
      <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={cfg.debt.max} aria-valuenow={value} aria-label={`Paradox Debt ${value} of ${cfg.debt.max}, ${STATE_TEXT[state]}`}>
        <div className="meter-fill" style={{ width: pct(value) }} />
        {[t.UNSTABLE, t.CRITICAL].map((v) => (
          <span key={v} className="meter-tick" style={{ left: pct(v) }} />
        ))}
      </div>
    </div>
  );
}
