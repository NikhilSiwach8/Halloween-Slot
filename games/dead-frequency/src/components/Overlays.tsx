import type { GameConfig } from '../config/types';
import type { Overlay } from '../app/useGame';
import { formatMoney, formatX } from '../app/format';
import { SymbolArt } from './SymbolArt';

const BONUS_BLURB = {
  NIGHT_SHIFT: 'The Signal Meter climbs by 1 for every reel that shows Static. It never resets, and every win is multiplied by it.',
  POSSESSION: 'Every Static that lands stays for the rest of the bonus. All Statics reveal together, every spin.',
  DEAD_AIR: 'Static expands to fill its reel. On Air wilds carry x2 to x25, and multipliers on a way multiply together.',
} as const;

const SOURCE = { ANTENNAS: 'The Antennas caught a signal', TAPE: 'The tape played a broadcast', BUY: 'Bonus bought' } as const;

export function OverlayView({ cfg, overlay, bet, onContinue }: { cfg: GameConfig; overlay: Overlay; bet: number; onContinue: () => void }) {
  const money = (x100: number) => formatMoney(cfg, Math.floor((bet * x100) / 100));
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
    case 'bonusIntro': {
      const def = cfg.bonuses[overlay.bonus];
      button = 'Go on air';
      body = (
        <>
          <p className="eyebrow">{SOURCE[overlay.source]}</p>
          <h2>{def.name}</h2>
          <p className="spins">{overlay.spins} free spins</p>
          <p>{BONUS_BLURB[overlay.bonus]}</p>
          <p className="small">3+ Antennas during the bonus: +{cfg.retrigger.extraSpins} spins.</p>
        </>
      );
      break;
    }
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
