import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { BonusType, GameConfig } from '../config/types';
import { SYMBOL_IMAGES } from './assets';
import { DeckHand, GlassFace, TrackEyes, useDeckTilt, useHaunt } from './Haunt';

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
  auto: (
    <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3M19.5 12a7.5 7.5 0 0 1-12.8 5.3" />
      <path d="M17.6 2.8v4.1h-4.1M6.4 21.2v-4.1h4.1" />
      <path d="M10 9.2v5.6l4.6-2.8Z" fill="currentColor" strokeWidth="1.4" />
    </g>
  ),
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
        {/* Extrusion: offset copies stepping down-right, darkening with depth, so the letters
            read as solid cast metal lit from the upper left. */}
        <g aria-hidden="true">
          {[6, 5, 4, 3, 2, 1].map((d) => (
            <g key={d} transform={`translate(${d * 0.6} ${d})`} fill={d > 4 ? '#0d0204' : d > 2 ? '#2a080d' : '#4a1018'}>
              <text x="210" y="66" textAnchor="middle" className="logo-word1">DEAD</text>
              <text x="210" y="122" textAnchor="middle" className="logo-word2">FREQUENCY</text>
            </g>
          ))}
        </g>
        <g filter={`url(#${id}-glow)`}>
          <text x="210" y="66" textAnchor="middle" className="logo-word1" fill={`url(#${id}-fill)`} stroke="#2b0a10" strokeWidth="3" paintOrder="stroke">DEAD</text>
          <text x="210" y="122" textAnchor="middle" className="logo-word2" fill={`url(#${id}-red)`} stroke="#1a0508" strokeWidth="3" paintOrder="stroke">FREQUENCY</text>
          {/* Specular edge: a thin light line along the top of the letters. */}
          <text x="210" y="66" textAnchor="middle" className="logo-word1 logo-spec" fill="none" stroke="rgba(255,248,230,0.55)" strokeWidth="0.8" transform="translate(-0.6 -0.8)">DEAD</text>
          <text x="210" y="122" textAnchor="middle" className="logo-word2 logo-spec" fill="none" stroke="rgba(255,200,200,0.45)" strokeWidth="0.8" transform="translate(-0.6 -0.8)">FREQUENCY</text>
        </g>
        {/* Blood dripping slowly from the lettering. */}
        <g className="logo-drips" fill="#7a0a14">
          {[[132, 0], [178, 1.3], [236, 0.6], [281, 2.1]].map(([x, d]) => (
            <g key={x} transform={`translate(${x} 124)`}>
              <rect className="drip" x="-1.6" y="0" width="3.2" height="16" rx="1.6" style={{ animationDelay: `${d}s` }} />
              <circle className="drip-drop" cx="0" cy="18" r="2.6" style={{ animationDelay: `${d}s` }} />
            </g>
          ))}
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

/**
 * A tape spool: an aluminium flange with three cut-outs over a pack of brown tape. It turns
 * (CSS, transform only) slowly at idle, fast while the reels spin and at a steady pace on a win.
 */
function Spool({ side }: { side: 'l' | 'r' }) {
  return (
    <svg className={`spool ${side}`} viewBox="0 0 100 100" aria-hidden="true">
      {/* The supply spool (left) is full of tape; the take-up spool (right) has only a little. */}
      <circle cx="50" cy="50" r={side === 'l' ? 47 : 30} fill="url(#tape-pack)" />
      <g className="spool-turn">
        <circle cx="50" cy="50" r="44" fill="url(#spool-metal)" fillOpacity="0.92" stroke="#0b0b0c" strokeWidth="1.5" />
        {[0, 120, 240].map((a) => (
          <path key={a} transform={`rotate(${a} 50 50)`} d="M50 14a36 36 0 0 1 31 18L60 44a12 12 0 0 0-10-6Z" fill={`url(#tape-seen-${side})`} stroke="rgba(0,0,0,0.6)" strokeWidth="1" />
        ))}
        <circle cx="50" cy="50" r="11" fill="url(#spool-metal)" stroke="#0b0b0c" strokeWidth="1.2" />
        <path d="M50 42v-4M57 54l3.5 2M43 54l-3.5 2" stroke="#0b0b0c" strokeWidth="2.4" strokeLinecap="round" />
        {/* a smear of something dark on one flange */}
        <path d="M70 70q6-2 10-10q-3 9-12 14z" fill="rgba(110, 6, 14, 0.75)" />
      </g>
    </svg>
  );
}

/**
 * The reel cabinet: a six-track reel-to-reel recorder found in the dead station's basement.
 * Header: a supply spool and a take-up spool with the tape running between them, a mechanical
 * tape counter (the multiplier), the REC lamp with a playback monitor, and a strip of masking
 * tape with the station's typed message. Body: a level meter, the reels as six tracks of tape
 * under a smoked acrylic dust cover (cracked, with a bloody handprint), and the transport keys.
 * `footer` sits under the tracks (the track lamps).
 */
export function ReelFrame({ multiplier, ticker, onAir, scope, footer, children }: {
  multiplier: number;
  ticker: string;
  onAir: boolean;
  scope: ScopeState;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const digits = String(multiplier).padStart(2, '0').split('');
  const deck = useRef<HTMLDivElement>(null);
  useDeckTilt(deck);
  const haunt = useHaunt(!onAir);
  return (
    <div ref={deck} className={`frame deck vu-${scope}`}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <radialGradient id="spool-metal" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#eef1f4" />
            <stop offset="0.45" stopColor="#9aa1a9" />
            <stop offset="1" stopColor="#3c4046" />
          </radialGradient>
          {/* The tape seen through a spool's windows: wound tape out to the pack's edge, then the
              dark deck behind. */}
          {([['l', 47], ['r', 30]] as const).map(([k, r]) => (
            <radialGradient key={k} id={`tape-seen-${k}`} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="47">
              <stop offset="0.2" stopColor="#1a0f0a" />
              <stop offset={(r - 3) / 47} stopColor="#5a3420" />
              <stop offset={r / 47} stopColor="#6b4027" />
              <stop offset={Math.min(1, (r + 0.5) / 47)} stopColor="#0c0a09" />
            </radialGradient>
          ))}
          <radialGradient id="tape-pack" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.25" stopColor="#1a0f0a" />
            <stop offset="0.8" stopColor="#4a2c1a" />
            <stop offset="0.97" stopColor="#6b4027" />
            <stop offset="1" stopColor="#1a0f0a" />
          </radialGradient>
        </defs>
      </svg>
      <div className="frame-top">
        <Spool side="l" />
        <div className={`counter ${multiplier > 1 ? 'hot' : ''}`} aria-label={`Multiplier x${multiplier}`} role="img">
          <span className="counter-x">×</span>
          {digits.map((d, i) => <span className="counter-digit" key={`${i}-${d}`}><b>{d}</b></span>)}
        </div>
        <div className="crown" aria-hidden="true">
          <span className={`rec-lamp ${onAir ? 'lit' : ''}`}><i />REC</span>
          <div className="scope-wrap"><Scope state={scope} /></div>
        </div>
        <div className="label-tape" aria-live="polite">
          <span key={ticker}>{ticker}</span>
        </div>
        <Spool side="r" />
      </div>
      <div className="frame-body">
        <div className="pillar left" aria-hidden="true">
          <div className="vu">
            {Array.from({ length: 14 }, (_, i) => <i key={i} />)}
            <div className="vu-cover" />
          </div>
          <span className="pillar-label">LVL</span>
        </div>
        <div className="frame-window">
          {children}
          {haunt?.kind === 'eyes' ? <TrackEyes key={haunt.id} col={haunt.col} row={haunt.row} /> : null}
          {haunt?.kind === 'face' ? <GlassFace key={haunt.id} from={haunt.from} /> : null}
          <div className="crt" aria-hidden="true">
            <i className="crt-lines" />
            {/* Damage on the dust cover: a fracture in the top-right corner and a bloody
                handprint dragged down the lower left. Static. */}
            <svg className="crt-damage" viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true">
              <g stroke="rgba(230, 240, 255, 0.42)" strokeWidth="1.1" fill="none" strokeLinecap="round">
                <path d="M560 34l-38 22-30 6-26 24M560 34l-12 44-22 30M560 34l-46-8-40 10M560 34l8 50 -6 40M560 34l-24-26M522 56l-10 28M492 62l-30-18M548 78l26 20" />
                <circle cx="560" cy="34" r="5" stroke="rgba(230,240,255,0.6)" />
              </g>
              <g fill="rgba(110, 6, 14, 0.42)">
                <path d="M58 300c-6-14-2-32 8-36 6-18 18-22 24-10 6-14 18-12 22 2 10-6 18 4 14 18 6 4 4 16-6 22l-8 34c-4 14-34 16-44 4-8-10-8-22-10-34z" />
                <path d="M70 336c2 16 0 36 4 52M86 340c2 12 0 30 2 44M100 334c0 10 2 22 0 30" stroke="rgba(110, 6, 14, 0.35)" strokeWidth="5" strokeLinecap="round" fill="none" />
              </g>
            </svg>
            <div className="crt-band-clip"><i className="crt-roll" /></div>
          </div>
        </div>
        <div className="pillar right" aria-hidden="true">
          <div className="keys">
            <i className="key rew" /><i className="key play" /><i className="key stop" /><i className="key rec" />
          </div>
          <span className="pillar-label">TR6</span>
        </div>
      </div>
      {footer ? <div className="frame-foot">{footer}</div> : null}
      {haunt?.kind === 'hand' ? <DeckHand key={haunt.id} side={haunt.side} at={haunt.at} /> : null}
      <i className="screw tl" aria-hidden="true" /><i className="screw tr" aria-hidden="true" />
      <i className="screw bl" aria-hidden="true" /><i className="screw br" aria-hidden="true" />
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
              <stop offset="0" stopColor="#2b2a26" />
              <stop offset="1" stopColor="#0b0b0c" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="60" r="56" fill="#141518" stroke="#a7adb4" strokeWidth="4" />
          <circle cx="60" cy="60" r="46" fill="url(#dial-face)" stroke="#3c4046" strokeWidth="2" />
          {Array.from({ length: 21 }, (_, i) => {
            const a = (-120 + i * 12) * (Math.PI / 180);
            const long = i % 5 === 0;
            return <line key={i} x1={60 + Math.sin(a) * 40} y1={60 - Math.cos(a) * 40} x2={60 + Math.sin(a) * (long ? 31 : 35)} y2={60 - Math.cos(a) * (long ? 31 : 35)} stroke={long ? '#ffb347' : '#d8d4c8'} strokeWidth={long ? 2 : 1} />;
          })}
          <g className="dial-needle"><line x1="60" y1="60" x2="60" y2="22" stroke="#ff3b4f" strokeWidth="2.5" strokeLinecap="round" /></g>
          <circle cx="60" cy="60" r="6" fill="#a7adb4" />
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
/**
 * The Night Host, standing beside the reels, acting like someone in the room: he breathes,
 * shifts his weight and now and then turns to glance at the reels; he leans in to watch them
 * spin; on a win he nods along with his eyes flaring. A contact shadow grounds him, and a rim
 * light from the screen catches his edge.
 */
export function Character({ excited, watching }: { excited: boolean; watching: boolean }) {
  const src = SYMBOL_IMAGES.HOST;
  if (!src) return null;
  const mood = excited ? 'excited' : watching ? 'watching' : '';
  return (
    <div className={`character ${mood}`} aria-hidden="true">
      <div className="character-shadow" />
      <div className="character-glow" />
      {/* Posture (body) and breathing (breath) animate on wrappers: the image and its shadows are
          drawn once and only moved, never re-filtered per frame. */}
      <div className="character-body">
        <div className="character-breath">
          <img src={src} alt="" draggable={false} />
          <div className="character-eyes" />
        </div>
      </div>
    </div>
  );
}
