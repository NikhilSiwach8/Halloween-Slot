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
export type ScopeState = 'idle' | 'spin' | 'win';

/**
 * A small oscilloscope: a phosphor trace with persistence. A slow sine with stray glitches while
 * idle, dense noise while the reels spin, a tall pulsing wave on a win. Redraws at ~30 fps and
 * only while the tab is visible; the canvas is tiny, so it costs next to nothing.
 */
export function Scope({ state }: { state: ScopeState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = 0;
    let t = 0;
    let amp = 0.25;
    // The trace colour follows the bonus (CSS --phos). Reading computed style forces a style
    // recalculation, so it is read twice a second, never per frame.
    let color = '#6dffbf';
    let colorAt = -1e9;
    // Size from a ResizeObserver (reading clientWidth per frame would force layout); 0 = hidden.
    let boxW = 0;
    let boxH = 0;
    const ro = new ResizeObserver(([e]) => {
      boxW = Math.round(e.contentRect.width);
      boxH = Math.round(e.contentRect.height);
    });
    ro.observe(c);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 33 || document.hidden || !boxW) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      // Resize the backing store only when the box changes (assigning width reallocates it).
      const W = boxW * 2;
      const H = Math.max(1, boxH * 2);
      if (c.width !== W) c.width = W;
      if (c.height !== H) c.height = H;
      const st = stateRef.current;
      const target = st === 'win' ? 0.85 : st === 'spin' ? 0.55 : 0.22;
      amp += (target - amp) * Math.min(1, dt * 6);
      if (now - colorAt > 500) {
        color = getComputedStyle(c).color || color;
        colorAt = now;
      }
      ctx.clearRect(0, 0, W, H);
      // graticule
      ctx.strokeStyle = 'rgba(120, 255, 200, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += W / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      // trace: two passes, a wide soft glow and a thin bright core
      const glitch = st === 'idle' && Math.sin(t * 0.7) > 0.97;
      const y = (x: number) => {
        const u = x / W;
        let v = Math.sin(u * Math.PI * 4 + t * 5) * amp;
        if (st === 'spin') v += (Math.random() - 0.5) * amp * 1.2;
        if (st === 'win') v *= 0.75 + 0.25 * Math.sin(t * 9) + 0.3 * Math.sin(u * Math.PI * 13 - t * 11);
        if (glitch) v += (Math.random() - 0.5) * 0.6;
        return H / 2 - v * (H / 2) * 0.9;
      };
      for (const [w, a] of [[5, 0.25], [1.6, 1]] as const) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = a;
        ctx.lineWidth = w;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 3) (x ? ctx.lineTo(x, y(x)) : ctx.moveTo(x, y(x)));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (reduce) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);
  return <canvas ref={ref} className="scope" aria-hidden="true" />;
}

/** Brass art-deco corner ornament (drawn once, mirrored for the other corners). */
function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <svg className={`corner ${pos}`} viewBox="0 0 60 60" aria-hidden="true">
      <path d="M2 58V14Q2 2 14 2h44" fill="none" stroke="url(#brass-grad)" strokeWidth="4" />
      <path d="M10 58V20q0-10 10-10h38" fill="none" stroke="url(#brass-grad)" strokeWidth="1.5" opacity="0.8" />
      <path d="M2 30h8M30 2v8" stroke="url(#brass-grad)" strokeWidth="2" />
      <circle cx="17" cy="17" r="4" fill="url(#brass-grad)" />
      <circle cx="17" cy="17" r="1.6" fill="#ff3b4f" className="corner-gem" />
    </svg>
  );
}

/**
 * The reel cabinet: a 1970s broadcast monitor in walnut and brass. Header: nixie-tube multiplier,
 * a live oscilloscope with the ON AIR lamp, and a VFD ticker. Body: a VU meter, the reels behind
 * curved CRT glass (scanlines, rolling refresh band, glare, phosphor tint per bonus), and a speaker
 * grille with a glowing valve. `footer` sits on the bezel under the screen (the channel strip).
 */
export function ReelFrame({ multiplier, ticker, onAir, scope, footer, children }: {
  multiplier: number;
  ticker: string;
  onAir: boolean;
  scope: ScopeState;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const digits = String(multiplier).split('');
  return (
    <div className={`frame vu-${scope}`}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="brass-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbe3a0" />
            <stop offset="0.45" stopColor="#b8893f" />
            <stop offset="1" stopColor="#5a3e14" />
          </linearGradient>
        </defs>
      </svg>
      <div className="frame-top">
        <div className={`nixie ${multiplier > 1 ? 'hot' : ''}`} aria-label={`Multiplier x${multiplier}`} role="img">
          <span className="nixie-tube x"><b>x</b></span>
          {digits.map((d, i) => <span className="nixie-tube" key={`${i}-${d}`}><b>{d}</b></span>)}
        </div>
        <div className="crown" aria-hidden="true">
          <span className={`on-air-lamp ${onAir ? 'lit' : ''}`}>ON AIR</span>
          <div className="scope-wrap"><Scope state={scope} /></div>
        </div>
        <div className="plaque-led" aria-live="polite">
          <span key={ticker}>{ticker}</span>
        </div>
      </div>
      <div className="frame-body">
        <div className="pillar left" aria-hidden="true">
          <div className="vu">
            {Array.from({ length: 14 }, (_, i) => <i key={i} />)}
            <div className="vu-cover" />
          </div>
          <span className="pillar-label">VU</span>
        </div>
        <div className="frame-window">
          {children}
          <div className="crt" aria-hidden="true">
            <i className="crt-lines" />
            <div className="crt-band-clip"><i className="crt-roll" /></div>
          </div>
        </div>
        <div className="pillar right" aria-hidden="true">
          <div className="grille" />
          <div className="tube"><i /></div>
        </div>
      </div>
      {footer ? <div className="frame-foot">{footer}</div> : null}
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
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
