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
  /** Round costs at or above this were refused by the server (see useGame). */
  costLimit: number | null;
  featureMode: ModeId | null;
  onFeature: (m: ModeId | null) => void;
  onBuy: (m: ModeId) => void;
  onClose: () => void;
}

/**
 * Feature Spins (a paid spin mode that stays on) and Bonus Buys (one-off). Both are high-cost
 * modes, so both ask for confirmation first: switching a Feature Spins mode on, and every bonus
 * purchase. Switching Feature Spins off needs no confirmation.
 */
export function StationMenu({ cfg, currency, bet, balance, costLimit, featureMode, onFeature, onBuy, onClose }: Props) {
  const [confirm, setConfirm] = useState<ModeId | null>(null);
  const isFeature = confirm !== null && FEATURES.includes(confirm);
  const money = (m: ModeId) => formatMoney(currency, roundCost(cfg, m, bet));
  const overLimit = (m: ModeId) => costLimit !== null && roundCost(cfg, m, bet) >= costLimit;
  /** Why a mode can't be chosen at this bet, if it can't. */
  const blocked = (m: ModeId) => (overLimit(m) ? 'Above the bet limit: lower the bet' : roundCost(cfg, m, bet) > balance ? 'Not enough balance' : null);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Feature Spins and Bonus Buy">
      <div className="overlay-card menu">
        <h2>Station Menu</h2>
        {confirm ? (
          <div className="confirm">
            {isFeature ? (
              <p>
                Switch on <strong>{cfg.modes[confirm].name.replace('Feature Spins: ', '')}</strong>? Every spin will cost{' '}
                <strong>{money(confirm)}</strong> ({cfg.modes[confirm].cost}x) until you switch it off.
              </p>
            ) : (
              <p>Buy <strong>{cfg.modes[confirm].name.replace('Buy ', '')}</strong> for <strong>{money(confirm)}</strong>?</p>
            )}
            <div className="row">
              <button onClick={() => setConfirm(null)}>Cancel</button>
              <button className="primary" onClick={() => (isFeature ? onFeature(confirm) : onBuy(confirm))}>Confirm</button>
            </div>
          </div>
        ) : (
          <>
            <h3>Feature Spins</h3>
            <p className="small">Every spin is guaranteed a feature. The mode stays on until you switch it off.</p>
            <div className="menu-grid">
              {FEATURES.map((m) => (
                <button key={m} className={`menu-item ${featureMode === m ? 'on' : ''}`} aria-pressed={featureMode === m} disabled={featureMode !== m && overLimit(m)} onClick={() => (featureMode === m ? onFeature(null) : setConfirm(m))}>
                  <strong>{cfg.modes[m].name.replace('Feature Spins: ', '')}</strong>
                  <span>{cfg.modes[m].description}</span>
                  <em>{cfg.modes[m].cost}x · {money(m)} per spin{featureMode === m ? ' · ON' : ''}</em>
                  {featureMode !== m && overLimit(m) ? <small className="menu-why">{blocked(m)}</small> : null}
                </button>
              ))}
            </div>
            <h3>Bonus Buy</h3>
            <div className="menu-grid">
              {BUYS.map((m) => (
                <button key={m} className="menu-item" disabled={blocked(m) !== null} onClick={() => setConfirm(m)}>
                  <strong>{cfg.modes[m].name.replace('Buy ', '')}</strong>
                  <span>{cfg.modes[m].description}</span>
                  <em>{cfg.modes[m].cost}x · {money(m)}</em>
                  {blocked(m) ? <small className="menu-why">{blocked(m)}</small> : null}
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
