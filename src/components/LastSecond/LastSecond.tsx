import type { GameConfig } from '../../config/types';
import { BONUS_STAGES } from '../../mechanics/lastSecond/lastSecond';
import { formatCredits } from '../../utils/format';

const ROMAN = ['I', 'II', 'III', 'IV'];

/** Stage tracker + the player's control to begin each stage of The Last Second. */
export function LastSecondPanel({ cfg, stage, hourMultiplier, awaitingStage, busy, bonusWin, onPlay }: { cfg: GameConfig; stage: number; hourMultiplier: number; awaitingStage: boolean; busy: boolean; bonusWin: number; onPlay: () => void }) {
  const next = BONUS_STAGES[stage] ?? null;
  return (
    <div className="last-second" data-testid="bonus-panel" data-stage={stage}>
      <div className="ls-title">The Last Second <span className="ls-clock">11:59</span></div>
      <ol className="ls-stages">
        {BONUS_STAGES.map((s, i) => (
          <li key={s.stage} className={i + 1 < stage ? 'done' : i + 1 === stage ? 'current' : ''} title={s.text}>
            <span className="ls-roman">{ROMAN[i]}</span>
            <span className="ls-name">{s.name.charAt(0) + s.name.slice(1).toLowerCase()}</span>
            <span className="ls-mult">×{cfg.bonus.stageMultipliers[i]}</span>
          </li>
        ))}
      </ol>
      <div className="ls-win">
        <span className="ls-hour" data-testid="hour-multiplier" title="Grows when symbols collapse into Chrono Wilds; a Paradox Discharge multiplies it">Hour Multiplier <strong>×{hourMultiplier}</strong></span>
        <span>Bonus win <strong data-testid="bonus-win">{formatCredits(bonusWin, cfg)}</strong></span>
      </div>
      {awaitingStage && next && (
        <button className="ls-play" onClick={onPlay} disabled={busy} data-testid="bonus-stage-button">
          Begin {next.title}
          <small>{next.text}</small>
        </button>
      )}
    </div>
  );
}
