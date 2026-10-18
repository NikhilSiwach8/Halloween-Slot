import { useState } from 'react';
import { roundCost } from '../config/gameConfig';
import type { GameConfig, ModeId } from '../config/types';
import { formatMoney } from '../app/format';
import type { Currency } from '../platform/platform';

const FEATURES: ModeId[] = ['STATIC_STORM', 'HAUNTED_WILDS'];
const BUYS: ModeId[] = ['BUY_NIGHT_SHIFT', 'BUY_POSSESSION', 'BUY_DEAD_AIR'];

interface Props {
  cfg: GameConfig;
  currency: Currency;
  bet: number;
  balance: number;
  featureMode: ModeId | null;
  onFeature: (m: ModeId | null) => void;
  onBuy: (m: ModeId) => void;
  onClose: () => void;
}

/** Feature Spins (a paid spin mode that stays on) and Bonus Buys (one-off, confirmed). */
export function StationMenu({ cfg, currency, bet, balance, featureMode, onFeature, onBuy, onClose }: Props) {
  const [confirm, setConfirm] = useState<ModeId | null>(null);
  const money = (m: ModeId) => formatMoney(currency, roundCost(cfg, m, bet));
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Feature Spins and Bonus Buy">
      <div className="overlay-card menu">
        <h2>Station Menu</h2>
        {confirm ? (
          <div className="confirm">
            <p>Buy <strong>{cfg.modes[confirm].name.replace('Buy ', '')}</strong> for <strong>{money(confirm)}</strong>?</p>
            <div className="row">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button className="primary" onClick={() => onBuy(confirm)}>Confirm</button>
            </div>
          </div>
        ) : (
          <>
            <h3>Feature Spins</h3>
            <p className="small">Every spin is guaranteed a feature. The mode stays on until you switch it off.</p>
            <div className="menu-grid">
              {FEATURES.map((m) => (
                <button key={m} className={`menu-item ${featureMode === m ? 'on' : ''}`} aria-pressed={featureMode === m} onClick={() => onFeature(featureMode === m ? null : m)}>
                  <strong>{cfg.modes[m].name.replace('Feature Spins: ', '')}</strong>
                  <span>{cfg.modes[m].description}</span>
                  <em>{cfg.modes[m].cost}x · {money(m)} per spin{featureMode === m ? ' · ON' : ''}</em>
                </button>
              ))}
            </div>
            <h3>Bonus Buy</h3>
            <div className="menu-grid">
              {BUYS.map((m) => (
                <button key={m} className="menu-item" disabled={roundCost(cfg, m, bet) > balance} onClick={() => setConfirm(m)}>
                  <strong>{cfg.modes[m].name.replace('Buy ', '')}</strong>
                  <span>{cfg.modes[m].description}</span>
                  <em>{cfg.modes[m].cost}x · {money(m)}</em>
                </button>
              ))}
            </div>
            <div className="row">
              {featureMode ? <button onClick={() => onFeature(null)}>Back to normal spins</button> : null}
              <button className="primary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
