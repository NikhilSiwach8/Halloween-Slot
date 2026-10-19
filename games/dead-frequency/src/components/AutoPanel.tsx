import { useState } from 'react';

export interface AutoSettings {
  rounds: number;
  /** Stop as soon as a bonus starts (the bonus still plays; then autoplay ends). */
  stopOnBonus: boolean;
  /** Stop after a single round wins at least this many times the stake (0 = off). */
  stopOnWinX: number;
  /** Stop once the balance has fallen by at least this many times the stake (0 = off). */
  lossLimitX: number;
}

const ROUNDS = [10, 25, 50, 100, 250];
const WIN_STOPS = [0, 10, 50, 100];
const LOSS_LIMITS = [0, 10, 50, 100];

/**
 * Auto bets. Step 1: choose the number of rounds and the stop conditions. Step 2: confirm, with
 * the stake per round and the most it can cost in total, before anything starts.
 */
export function AutoPanel({ costText, totalText, onStart, onClose }: {
  /** Cost of one round, formatted. */
  costText: string;
  /** Formatted total for `n` rounds. */
  totalText: (n: number) => string;
  onStart: (s: AutoSettings) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<AutoSettings>({ rounds: 25, stopOnBonus: true, stopOnWinX: 0, lossLimitX: 0 });
  const [confirming, setConfirming] = useState(false);
  const chip = <T,>(value: T, current: T, label: string, set: (v: T) => void) => (
    <button key={String(value)} className={`auto-chip ${value === current ? 'on' : ''}`} aria-pressed={value === current} onClick={() => set(value)}>{label}</button>
  );
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Auto bets">
      <div className="overlay-card auto-panel">
        <h2>Auto bets</h2>
        {confirming ? (
          <div className="confirm">
            <p>
              Start <strong>{s.rounds} auto bets</strong> at <strong>{costText}</strong> each (up to <strong>{totalText(s.rounds)}</strong> in total)?
            </p>
            <p className="small">
              Stops {s.stopOnBonus ? 'when a bonus starts, ' : ''}{s.stopOnWinX ? `on a win of ${s.stopOnWinX}x or more, ` : ''}
              {s.lossLimitX ? `if the balance falls by ${s.lossLimitX}x the stake, ` : ''}when the balance runs out, or when you press Stop.
            </p>
            <div className="row">
              <button onClick={() => setConfirming(false)}>Back</button>
              <button className="primary" onClick={() => onStart(s)}>Confirm</button>
            </div>
          </div>
        ) : (
          <>
            <h3>Number of rounds</h3>
            <div className="auto-row">{ROUNDS.map((n) => chip(n, s.rounds, String(n), (v) => setS({ ...s, rounds: v })))}</div>
            <h3>Stop on a single win of</h3>
            <div className="auto-row">{WIN_STOPS.map((n) => chip(n, s.stopOnWinX, n ? `${n}x+` : 'Off', (v) => setS({ ...s, stopOnWinX: v })))}</div>
            <h3>Stop if the balance falls by</h3>
            <div className="auto-row">{LOSS_LIMITS.map((n) => chip(n, s.lossLimitX, n ? `${n}x` : 'Off', (v) => setS({ ...s, lossLimitX: v })))}</div>
            <label className="auto-check">
              <input type="checkbox" checked={s.stopOnBonus} onChange={(e) => setS({ ...s, stopOnBonus: e.target.checked })} /> Stop when a bonus starts
            </label>
            <div className="row">
              <button onClick={onClose}>Cancel</button>
              <button className="primary" onClick={() => setConfirming(true)}>Start</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
