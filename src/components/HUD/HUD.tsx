import type { GameConfig } from '../../config/types';
import type { DisplayState } from '../../app/presentation';
import { formatCredits } from '../../utils/format';

export interface HUDProps {
  cfg: GameConfig;
  display: DisplayState;
  bet: number;
  setBet: (b: number) => void;
  canSpin: boolean;
  onSpin: () => void;
  onSkip: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
  balanceNote: string;
}

export function HUD({ cfg, display, bet, setBet, canSpin, onSpin, onSkip, muted, onToggleMute, onOpenRules, onOpenSettings, balanceNote }: HUDProps) {
  const i = cfg.bets.indexOf(bet);
  const locked = display.busy || display.awaiting !== 'SPIN';
  return (
    <div className="hud">
      <div className="hud-stats">
        <div className="stat" data-testid="balance">
          <span className="stat-label">Balance {balanceNote && <small>({balanceNote})</small>}</span>
          <span className="stat-value">{formatCredits(display.balance, cfg)}</span>
        </div>
        <div className="stat" data-testid="spin-win">
          <span className="stat-label">{display.mode === 'BONUS' ? `Stage ${display.bonusStage} win` : 'Spin win'}</span>
          <span className="stat-value win">{formatCredits(display.spinWin, cfg)}</span>
        </div>
        <div className="stat" data-testid="round-win">
          <span className="stat-label">Total round win</span>
          <span className="stat-value win">{formatCredits(display.roundWin, cfg)}</span>
        </div>
        <div className="stat" data-testid="last-win">
          <span className="stat-label">Last round</span>
          <span className="stat-value">{display.lastRoundWin === null ? '—' : formatCredits(display.lastRoundWin, cfg)}</span>
        </div>
      </div>
      <div className="hud-controls">
        <button className="icon-button" onClick={onOpenRules} aria-label="Game rules" data-testid="rules-button">?</button>
        <button className="icon-button" onClick={onOpenSettings} aria-label="Settings" data-testid="settings-button">&#9881;</button>
        <button className="icon-button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} data-testid="mute-toggle">
          {muted ? '\u{1F507}' : '\u{1F50A}'}
        </button>
        <div className="bet" role="group" aria-label="Stake">
          <button className="bet-step" onClick={() => setBet(cfg.bets[Math.max(0, i - 1)])} disabled={locked || i <= 0} aria-label="Decrease stake">−</button>
          <div className="bet-value" data-testid="bet">
            <span className="stat-label">Stake</span>
            <span>{formatCredits(bet, cfg)}</span>
          </div>
          <button className="bet-step" onClick={() => setBet(cfg.bets[Math.min(cfg.bets.length - 1, i + 1)])} disabled={locked || i >= cfg.bets.length - 1} aria-label="Increase stake">+</button>
        </div>
        {display.busy ? (
          <button className="spin-button skipping" onClick={onSkip} data-testid="skip-button" aria-label="Skip animations">
            <span>Skip</span>
          </button>
        ) : (
          <button className="spin-button" onClick={onSpin} disabled={!canSpin} data-testid="spin-button" aria-label="Spin">
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="5" /><path d="M50 50 L50 22 M50 50 L68 58" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>
            <span>Spin</span>
          </button>
        )}
      </div>
    </div>
  );
}
