import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { BonusType, GameConfig } from '../config/types';
import { SYMBOL_IMAGES } from './assets';

/* ------------------------------------------------------------------ icons */
export const Icon = {
  bolt: <path d="M13 2 4 14h7l-2 8 9-12h-7l2-8Z" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" strokeWidth="2.4" strokeLinecap="round" fill="none" stroke="currentColor" />,
  up: <path d="m6 15 6-6 6 6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />,
  down: <path d="m6 9 6 6 6-6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" />,
  spin: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.8 3.8v4.6h-4.6" strokeLinejoin="round" />
    </g>
  ),
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
  play: <path d="M8 5v14l11-7L8 5Z" />,
  sound: <path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4 4 0 0 0-2.2-3.6v7.2A4 4 0 0 0 16.5 12Zm-2.2-8v2.1a7 7 0 0 1 0 11.8V20a9 9 0 0 0 0-16Z" />,
  muted: <path d="M4 9v6h4l5 4V5L8 9H4Zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7Z" />,
  info: (
    <g>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 10.5v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="7.4" r="1.4" />
    </g>
  ),
  tower: (
    <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 5 7 21M12 5l5 16M9 14h6M8.2 17.5h7.6M10.2 10h3.6" />
      <circle cx="12" cy="4" r="1.6" fill="currentColor" />
      <path d="M7.5 2.5a6 6 0 0 0 0 4M16.5 2.5a6 6 0 0 1 0 4M5 1a9 9 0 0 0 0 7M19 1a9 9 0 0 1 0 7" strokeLinecap="round" />
    </g>
  ),
};

export function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  );
}

/* --------------------------------------------------- rolling money amount */
/** Counts up (or down) to `value` over ~0.7s, as slot win meters do. */
export function RollingAmount({ value, format, testId }: { value: number; format: (v: number) => string; testId?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(a + (value - a) * e);
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  // The final value is always exact (screen readers and tests read the settled amount).
  return <output data-testid={testId} data-value={value}>{format(shown)}</output>;
}

/* ----------------------------------------------------------------- logo */
export function Logo({ className = 'logo' }: { className?: string }) {
  // Unique gradient ids per instance: two logos may be on the page (the game's and the title
  // screen's), and a url(#id) that resolves into a display:none copy would paint nothing.
  const id = useId().replace(/:/g, '');
  return (
    <div className={className} aria-label="Dead Frequency" role="img">
      <svg viewBox="0 0 360 150" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff4e2" />
            <stop offset="0.55" stopColor="#e6c8a0" />
            <stop offset="1" stopColor="#8a2a33" />
          </linearGradient>
          <linearGradient id={`${id}-red`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff6b7a" />
            <stop offset="1" stopColor="#7a0d1c" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* radio tower mark with pulsing waves */}
        <g className="logo-tower" transform="translate(28 18)">
          <path d="M22 18 8 112M22 18l14 94M13 80h18M11 96h22M16 52h12" stroke="#c9a45e" strokeWidth="3.5" fill="none" />
          <circle cx="22" cy="14" r="6" fill="#ff3b4f" className="logo-beacon" />
          <path className="logo-wave w1" d="M10 4a18 18 0 0 0 0 20M34 4a18 18 0 0 1 0 20" stroke="#ff3b4f" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path className="logo-wave w2" d="M2 -4a30 30 0 0 0 0 36M42 -4a30 30 0 0 1 0 36" stroke="#ff3b4f" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
        <g filter={`url(#${id}-glow)`}>
          <text x="210" y="66" textAnchor="middle" className="logo-word1" fill={`url(#${id}-fill)`} stroke="#2b0a10" strokeWidth="3" paintOrder="stroke">DEAD</text>
          <text x="210" y="122" textAnchor="middle" className="logo-word2" fill={`url(#${id}-red)`} stroke="#1a0508" strokeWidth="3" paintOrder="stroke">FREQUENCY</text>
        </g>
        <path d="M96 80h228" stroke="#c9a45e" strokeWidth="2" opacity="0.7" />
        <circle cx="96" cy="80" r="3" fill="#c9a45e" />
        <circle cx="324" cy="80" r="3" fill="#c9a45e" />
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------- reel frame */
/**
 * The broadcast-console frame around the reels: iron and brass with rivets, an LED plaque on top
 * (multiplier on the left, scrolling station ticker on the right), frequency-scale pillars, and a
 * glowing vacuum tube at each lower corner.
 */
export function ReelFrame({ multiplier, ticker, onAir, children }: { multiplier: number; ticker: string; onAir: boolean; children: ReactNode }) {
  return (
    <div className="frame">
      <div className="frame-top">
        <div className={`plaque-mult ${multiplier > 1 ? 'hot' : ''}`} aria-label={`Multiplier x${multiplier}`}>
          <span>x</span>{multiplier}
        </div>
        <div className="crown" aria-hidden="true">
          <Svg size={34}>{Icon.tower}</Svg>
          <span className={`on-air-lamp ${onAir ? 'lit' : ''}`}>ON AIR</span>
        </div>
        <div className="plaque-led" aria-live="polite">
          <span key={ticker}>{ticker}</span>
        </div>
      </div>
      <div className="frame-body">
        <div className="pillar left" aria-hidden="true">
          {['108', '104', '100', '96', '92', '88'].map((f) => <span key={f}>{f}</span>)}
          <div className="tube"><i /></div>
        </div>
        <div className="frame-window">{children}</div>
        <div className="pillar right" aria-hidden="true">
          {['MHz', '·', '·', '·', '·', 'FM'].map((f, i) => <span key={i}>{f}</span>)}
          <div className="tube"><i /></div>
        </div>
      </div>
      <i className="rivet tl" /><i className="rivet tr" /><i className="rivet bl" /><i className="rivet br" />
    </div>
  );
}

/* ----------------------------------------------------------- signal panel */
const TIERS: { at: number; name: string }[] = [
  { at: 3, name: 'Night Shift' },
  { at: 4, name: 'Possession' },
  { at: 5, name: 'Dead Air' },
];

/**
 * Left panel: an animated tuning dial, six Antenna lamps that light as Antennas land, and the
 * bonus each count starts. During a bonus it shows the spins left and its own state instead.
 */
export function SignalPanel({ cfg, antennas, bonus, spinning }: {
  cfg: GameConfig;
  antennas: number;
  spinning: boolean;
  bonus: { type: BonusType; spin: number; totalSpins: number; meter?: number } | null;
}) {
  return (
    <aside className={`signal-panel ${spinning ? 'tuning' : ''}`} aria-label="Signal panel">
      <div className="dial" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <defs>
            <radialGradient id="dial-face" cx="0.5" cy="0.45" r="0.6">
              <stop offset="0" stopColor="#3a2410" />
              <stop offset="1" stopColor="#0d0805" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="56" fill="#1a1410" stroke="#c9a45e" strokeWidth="4" />
          <circle cx="60" cy="60" r="46" fill="url(#dial-face)" stroke="#5a4520" strokeWidth="2" />
          {Array.from({ length: 21 }, (_, i) => {
            const a = (-120 + i * 12) * (Math.PI / 180);
            const long = i % 5 === 0;
            return <line key={i} x1={60 + Math.sin(a) * 40} y1={60 - Math.cos(a) * 40} x2={60 + Math.sin(a) * (long ? 31 : 35)} y2={60 - Math.cos(a) * (long ? 31 : 35)} stroke="#e8cb8c" strokeWidth={long ? 2 : 1} />;
          })}
          <g className="dial-needle"><line x1="60" y1="60" x2="60" y2="22" stroke="#ff3b4f" strokeWidth="2.5" strokeLinecap="round" /></g>
          <circle cx="60" cy="60" r="6" fill="#c9a45e" />
          <circle cx="60" cy="86" r="5" className="dial-lamp" />
        </svg>
      </div>
      {bonus ? (
        <div className="panel-bonus">
          <span className="panel-label">{cfg.bonuses[bonus.type].name}</span>
          <span className="panel-big">{Math.max(0, bonus.totalSpins - bonus.spin)}</span>
          <span className="panel-label">spins left</span>
          {bonus.meter !== undefined ? <span className="panel-meter">Signal x{bonus.meter}</span> : null}
        </div>
      ) : (
        <>
          <div className="lamps" role="img" aria-label={`${antennas} antennas`}>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={`lamp ${i < antennas ? 'lit' : ''} ${i < antennas && antennas >= 3 ? 'hot' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
                <Svg size={18}>{Icon.tower}</Svg>
              </span>
            ))}
          </div>
          <ul className="tiers">
            {TIERS.map((t) => (
              <li key={t.at} className={(t.at === 5 ? antennas >= 5 : antennas === t.at) ? 'reached' : ''}>
                <b>{t.at === 5 ? '5+' : t.at}</b> {t.name}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="knob" aria-hidden="true" />
    </aside>
  );
}

/* --------------------------------------------------------- character */
/** The Night Host, standing beside the reels: idle breathing and sway, eyes flaring on wins. */
export function Character({ excited }: { excited: boolean }) {
  const src = SYMBOL_IMAGES.HOST;
  if (!src) return null;
  return (
    <div className={`character ${excited ? 'excited' : ''}`} aria-hidden="true">
      <div className="character-glow" />
      <img src={src} alt="" draggable={false} />
      <div className="character-eyes" />
    </div>
  );
}
