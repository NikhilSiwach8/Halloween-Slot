import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { GameConfig } from '../config/types';
import { Logo } from './Cabinet';
import { SYMBOL_IMAGES } from './assets';

const STORE_KEY = 'df-skip-splash';

/** Whether the player asked not to see the splash again (per browser; storage may be unavailable). */
export function splashSkipped(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === '1';
  } catch {
    return false;
  }
}

/** One vintage tube-radio cabinet: arched wooden case, tuning dial with a sweeping needle, valves, cloth panel, knobs. */
function RadioCard({ i, children, caption }: { i: number; children: ReactNode; caption: ReactNode }) {
  return (
    <section className="sp-card" style={{ '--i': i } as CSSProperties}>
      <div className="sp-cabinet">
        <div className="sp-valves" aria-hidden="true"><i /><i /><i /></div>
        <div className="sp-lamp" aria-hidden="true">ON AIR</div>
        <div className="sp-dial" aria-hidden="true">
          <span>88</span><span>94</span><span>100</span><span>106</span>
          <i className="sp-needle" />
        </div>
        <div className="sp-cloth">
          <div className="sp-art">{children}</div>
          <p className="sp-caption">{caption}</p>
        </div>
        <div className="sp-knobs" aria-hidden="true"><i /><i /></div>
      </div>
    </section>
  );
}

const img = (id: keyof typeof SYMBOL_IMAGES, cls: string) => {
  const src = SYMBOL_IMAGES[id];
  return src ? <img className={cls} src={src} alt="" draggable={false} /> : null;
};

/**
 * Title screen shown once the game has loaded: the logo, three radio cabinets advertising the
 * features (with numbers taken from the game config), and "click to continue". Any click or key
 * continues; the first gesture also starts the sound. The player can choose not to see it again.
 */
export function Splash({ cfg, onContinue }: { cfg: GameConfig; onContinue: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [skipNext, setSkipNext] = useState(false);
  const maxWild = Math.max(...Object.values(cfg.profiles).flatMap((p) => p.wildMultipliers.map((m) => m.value)));
  const triggers = [...cfg.antennaTriggers].sort((a, b) => a.count - b.count);

  const go = () => {
    if (leaving) return;
    try {
      if (skipNext) localStorage.setItem(STORE_KEY, '1');
    } catch {
      /* storage unavailable: show it again next time */
    }
    setLeaving(true);
    setTimeout(onContinue, 450);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      go();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`} role="dialog" aria-modal="true" aria-label="Dead Frequency" onClick={go}>
      <div className="sp-logo"><Logo className="sp-logo-mark" /></div>
      <div className="sp-cards">
        <RadioCard
          i={0}
          caption={<>Static reveals as <b>one symbol</b><br />On Air wilds up to <b>x{maxWild}</b></>}
        >
          {img('STATIC', 'sp-sym sp-sym-back')}
          <span className="sp-mult">x{maxWild}</span>
          {img('WILD', 'sp-sym sp-sym-front')}
        </RadioCard>
        <RadioCard
          i={1}
          caption={<><b>{triggers.map((t) => t.count).join(', ')}+</b> Antennas start <b>3 bonuses</b><br />The Unmarked Tape plays the <b>Mystery Bonus</b></>}
        >
          {img('ANTENNA', 'sp-sym sp-fan sp-fan-l')}
          {img('TAPE', 'sp-sym sp-fan sp-fan-c')}
          {img('ANTENNA', 'sp-sym sp-fan sp-fan-r')}
        </RadioCard>
        <RadioCard i={2} caption={<>Tune in to a colossal<br /><b className="sp-big">{cfg.maxWinX.toLocaleString('en-US')}x</b> max win</>}>
          <p className="sp-maxwin" data-text="MAX WIN"><span>MAX</span><span>WIN</span></p>
        </RadioCard>
      </div>
      <p className="sp-continue">Click to continue</p>
      <label className="sp-skip" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={skipNext} onChange={(e) => setSkipNext(e.target.checked)} /> Don’t show again
      </label>
    </div>
  );
}
