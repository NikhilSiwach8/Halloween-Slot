import type { CSSProperties } from 'react';
import type { BonusType, GameConfig, SymbolId } from '../config/types';
import type { Overlay } from '../app/useGame';
import type { Currency } from '../platform/platform';
import { formatMoney, formatX } from '../app/format';
import { SYMBOL_IMAGES } from './assets';
import { noiseDataUrl } from './Background';
import { SymbolArt } from './SymbolArt';

const BONUS_BLURB = {
  NIGHT_SHIFT: 'The Signal Meter climbs by 1 for every reel that shows Static. It never resets, and every win is multiplied by it.',
  POSSESSION: 'Every Static that lands stays for the rest of the bonus. All Statics reveal together, every spin.',
  DEAD_AIR: 'Static expands to fill its reel. On Air wilds carry x2 to x25, and multipliers on a way multiply together.',
} as const;

const SOURCE = {
  ANTENNAS: 'The antennas caught something out there…',
  TAPE: 'The tape is playing by itself…',
  BUY: 'You paid for this broadcast. There are no refunds.',
} as const;

/** The face that lunges out of the static when each bonus starts. */
const FACE: Record<BonusType, SymbolId> = { NIGHT_SHIFT: 'PRIEST', POSSESSION: 'WIDOW', DEAD_AIR: 'HOST' };

/**
 * Bonus start: a ~2.6s "signal intercepted" sequence (static burst, flickering alert, a face
 * lunging at the screen, flash and shake), then the bonus card. Pressing the button or Space
 * at any point skips straight into the bonus.
 */
function BonusIntro({ cfg, overlay, onContinue }: { cfg: GameConfig; overlay: Extract<Overlay, { kind: 'bonusIntro' }>; onContinue: () => void }) {
  const def = cfg.bonuses[overlay.bonus];
  const face = SYMBOL_IMAGES[FACE[overlay.bonus]];
  return (
    <div
      className={`intercept intercept-${overlay.bonus.toLowerCase()}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${def.name} bonus`}
      style={{ '--noise': `url(${noiseDataUrl()})` } as CSSProperties}
    >
      <div className="intercept-static" />
      {face ? <img className="intercept-face" src={face} alt="" /> : null}
      <div className="intercept-flash" />
      <p className="intercept-alert" aria-hidden="true">SIGNAL INTERCEPTED</p>
      <div className="intercept-card">
        <p className="eyebrow">{SOURCE[overlay.source]}</p>
        <h2 className="glitch" data-text={def.name}>{def.name}</h2>
        <p className="spins">{overlay.spins} free spins</p>
        <p>{BONUS_BLURB[overlay.bonus]}</p>
        <p className="small">3+ Antennas during the bonus: +{cfg.retrigger.extraSpins} spins.</p>
        <button className="primary" autoFocus onClick={onContinue}>Go on air</button>
      </div>
    </div>
  );
}

export function OverlayView({ cfg, currency, overlay, bet, onContinue }: { cfg: GameConfig; currency: Currency; overlay: Overlay; bet: number; onContinue: () => void }) {
  const money = (x100: number) => formatMoney(currency, Math.floor((bet * x100) / 100));
  let body;
  let button = 'Continue';
  switch (overlay.kind) {
    case 'mystery': {
      const p = overlay.prize;
      button = p ? 'Collect' : 'Play the tape';
      body = (
        <>
          <div className="overlay-art tape"><SymbolArt s="TAPE" /></div>
          <h2>Mystery Bonus</h2>
          {!p ? (
            <p>An unmarked tape slides into the deck. Nobody knows what was recorded on it.</p>
          ) : p.kind === 'CASH' ? (
            <p className="prize">Cash prize: <strong>{formatX(p.x100)}</strong> ({money(p.x100)})</p>
          ) : (
            <p className="prize">The tape plays a broadcast: <strong>{cfg.bonuses[p.bonus].name}</strong></p>
          )}
        </>
      );
      break;
    }
    case 'bonusIntro':
      return <BonusIntro cfg={cfg} overlay={overlay} onContinue={onContinue} />;
    case 'bonusEnd':
      button = 'Collect';
      body = (
        <>
          <p className="eyebrow">Broadcast over</p>
          <h2>{cfg.bonuses[overlay.bonus].name}</h2>
          <p className="prize"><strong>{formatX(overlay.winX100)}</strong> · {money(overlay.winX100)}</p>
        </>
      );
      break;
    case 'bigWin':
      button = 'Collect';
      body = (
        <>
          <h2 className={`tier tier-${overlay.tier.toLowerCase()}`}>{overlay.tier === 'MAX' ? 'MAX WIN' : overlay.tier === 'MEGA' ? 'MEGA WIN' : 'BIG WIN'}</h2>
          <p className="prize"><strong>{money(overlay.winX100)}</strong> · {formatX(overlay.winX100)}</p>
          {overlay.tier === 'MAX' ? <p>{cfg.maxWinX.toLocaleString()}x reached. The round ends here.</p> : null}
        </>
      );
      break;
  }
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="overlay-card">
        {body}
        <button className="primary" autoFocus onClick={onContinue}>{button}</button>
      </div>
    </div>
  );
}
