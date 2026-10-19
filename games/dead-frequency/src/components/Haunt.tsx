import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { SYMBOL_IMAGES } from './assets';

/*
 * The deck is haunted. While the reels are still, now and then one of these happens:
 *   - eyes:  a pair of bloodshot eyes opens on one of the tracks, looks around, blinks, closes;
 *   - hand:  a pale hand creeps round the edge of the deck from behind, grips it, taps, withdraws;
 *   - face:  the Widow's face drifts faintly across the dust cover, like a reflection.
 * They are quiet (no sound, never over a win or a pop-up) and only animate transform and opacity.
 * Off with reduced motion.
 */

const REDUCED_MOTION = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Haunting =
  | { kind: 'eyes'; id: number; col: number; row: number }
  | { kind: 'hand'; id: number; side: 'l' | 'r'; at: number }
  | { kind: 'face'; id: number; from: 'l' | 'r' };

const DURATION = { eyes: 3600, hand: 6200, face: 6500 } as const;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Schedules one haunting at a time, every 9–22 s, only while `active` (the reels are idle). */
export function useHaunt(active: boolean): Haunting | null {
  const [h, setH] = useState<Haunting | null>(null);
  const id = useRef(0);
  useEffect(() => {
    if (!active || REDUCED_MOTION) {
      setH(null);
      return;
    }
    let t = 0;
    const next = (delay: number) => {
      t = window.setTimeout(() => {
        if (document.hidden) return next(5000);
        const r = Math.random();
        const n = ++id.current;
        const pick: Haunting =
          r < 0.45 ? { kind: 'eyes', id: n, col: Math.floor(Math.random() * 6), row: Math.floor(Math.random() * 4) }
          : r < 0.8 ? { kind: 'hand', id: n, side: Math.random() < 0.5 ? 'l' : 'r', at: rand(24, 62) }
          : { kind: 'face', id: n, from: Math.random() < 0.5 ? 'l' : 'r' };
        setH(pick);
        t = window.setTimeout(() => {
          setH(null);
          next(rand(9000, 22000));
        }, DURATION[pick.kind]);
      }, delay);
    };
    next(rand(5000, 12000));
    // QA hook (?scareTest=1): window.__dfHaunt('eyes' | 'hand' | 'face') shows one now.
    if (new URLSearchParams(window.location.search).has('scareTest')) {
      (window as unknown as { __dfHaunt?: (k: Haunting['kind']) => void }).__dfHaunt = (k) => {
        const n = ++id.current;
        setH(k === 'eyes' ? { kind: k, id: n, col: 2, row: 1 } : k === 'hand' ? { kind: k, id: n, side: 'l', at: 40 } : { kind: k, id: n, from: 'l' });
      };
    }
    return () => window.clearTimeout(t);
  }, [active]);
  return h;
}

/** Bloodshot eyes opening on a track (placed over cell col,row of the 6×4 board). */
export function TrackEyes({ col, row }: { col: number; row: number }) {
  return (
    <div className="track-eyes" style={{ '--c': col, '--r': row } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id="eye-white" cx="0.5" cy="0.45" r="0.6">
            <stop offset="0" stopColor="#f1e6c9" />
            <stop offset="0.55" stopColor="#cfa98a" />
            <stop offset="1" stopColor="#7a2a22" />
          </radialGradient>
          <radialGradient id="eye-socket" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.3" stopColor="rgba(0,0,0,0.95)" />
            <stop offset="0.75" stopColor="rgba(10,4,4,0.7)" />
            <stop offset="1" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="eye-iris" cx="0.4" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#a8b06a" />
            <stop offset="0.6" stopColor="#4a4a1a" />
            <stop offset="1" stopColor="#120f04" />
          </radialGradient>
        </defs>
        {/* the dark the eyes look out of */}
        <rect x="0" y="0" width="100" height="100" rx="4" fill="url(#eye-socket)" />
        {[30, 70].map((cx, k) => (
          <g key={cx}>
            <path d={`M${cx - 19} 46Q${cx} 30 ${cx + 19} 46`} fill="none" stroke="rgba(120, 100, 80, 0.5)" strokeWidth="1.4" />
            <g className="eye" style={{ transformOrigin: `${cx}px 50px` }}>
              <path d={`M${cx - 17} 50Q${cx} 36 ${cx + 17} 50Q${cx} 63 ${cx - 17} 50Z`} fill="url(#eye-white)" />
              <g stroke="rgba(180, 16, 16, 0.75)" strokeWidth="0.7" fill="none">
                <path d={`M${cx - 16} 50q5-2 8 0q3 3 5 1`} />
                <path d={`M${cx + 16} 49q-5 2-8-1q-2-2-4 0`} />
                <path d={`M${cx - 12} 55q4 0 5-2`} />
                <path d={`M${cx + 11} 55q-3-1-4-3`} />
              </g>
              <g className="iris">
                <circle cx={cx} cy="50" r="6.5" fill="url(#eye-iris)" />
                <circle cx={cx} cy="50" r="1.8" fill="#000" />
                <circle cx={cx - 2.2} cy="47.8" r="1.2" fill="rgba(255,255,255,0.85)" />
              </g>
              <path d={`M${cx - 18} 50Q${cx} 34 ${cx + 18} 50`} fill="none" stroke="#120806" strokeWidth="2.2" />
            </g>
            {/* one eye weeps blood */}
            {k === 1 ? <path className="eye-tear" d={`M${cx + 6} 57q1 10-1 22q-1 4 1 6`} stroke="rgba(130, 6, 14, 0.9)" strokeWidth="2.2" strokeLinecap="round" fill="none" /> : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

/*
 * The hand is generated: each finger is a tapered outline around a three-joint centreline
 * (straight, slightly bent, then hooked down over the edge), so the fingers look bony and long
 * rather than drawn with a round brush.
 */
type Pt = [number, number];
const FINGERS = [
  { base: [96, 30] as Pt, a: -6, len: [40, 30, 22], w: [15, 12, 10, 6] },
  { base: [100, 50] as Pt, a: -1, len: [46, 33, 24], w: [16, 13, 11, 6.5] },
  { base: [100, 70] as Pt, a: 4, len: [43, 31, 23], w: [15.5, 12.5, 10.5, 6.2] },
  { base: [94, 88] as Pt, a: 11, len: [34, 25, 19], w: [13.5, 11, 9, 5.4] },
];
const BENDS = [0, 14, 62]; // extra degrees at each joint: the last segment hooks over the edge
function fingerGeometry(f: (typeof FINGERS)[number]) {
  const pts: Pt[] = [f.base];
  let ang = f.a;
  f.len.forEach((l, i) => {
    ang += BENDS[i];
    const [x, y] = pts[pts.length - 1];
    const r = (ang * Math.PI) / 180;
    pts.push([x + Math.cos(r) * l, y + Math.sin(r) * l]);
  });
  // Normal at each point (average of neighbouring segment directions).
  const dir = (i: number) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d] as Pt;
  };
  const top: Pt[] = [], bot: Pt[] = [];
  pts.forEach((p, i) => {
    const [dx, dy] = dir(i);
    const h = f.w[i] / 2;
    top.push([p[0] + dy * h, p[1] - dx * h]);
    bot.push([p[0] - dy * h, p[1] + dx * h]);
  });
  const tip = pts[3], [tdx, tdy] = dir(3), th = f.w[3] / 2;
  const f2 = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  // Smooth outline: quadratic curves through the midpoints, a rounded tip.
  const side = (ps: Pt[]) => ps.slice(1).map((p, i) => `Q${f2(ps[i])} ${f2([(ps[i][0] + p[0]) / 2, (ps[i][1] + p[1]) / 2])}`).join('') + `L${f2(ps[ps.length - 1])}`;
  const outline = `M${f2(top[0])}${side(top)}Q${f2([tip[0] + tdx * th * 2.2, tip[1] + tdy * th * 2.2])} ${f2(bot[3])}${side([...bot].reverse())}Z`;
  const nailAng = (Math.atan2(tdy, tdx) * 180) / Math.PI;
  return { pts, outline, nail: { x: tip[0] + tdx * th * 0.6, y: tip[1] + tdy * th * 0.6, ang: nailAng, w: f.w[3] } };
}
const HAND = FINGERS.map(fingerGeometry);

/** A pale, long-fingered hand gripping the edge of the deck from behind it. */
export function DeckHand({ side, at }: { side: 'l' | 'r'; at: number }) {
  return (
    <div className={`deck-hand ${side}`} style={{ '--at': `${at}%` } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 230 140">
        <defs>
          <linearGradient id="hand-skin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cfcabb" />
            <stop offset="0.45" stopColor="#9c9784" />
            <stop offset="1" stopColor="#4a463a" />
          </linearGradient>
          <linearGradient id="hand-back" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#141310" stopOpacity="0" />
            <stop offset="0.45" stopColor="#4a473c" />
            <stop offset="1" stopColor="#8f8a77" />
          </linearGradient>
          <radialGradient id="hand-bruise" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="rgba(70, 40, 80, 0.55)" />
            <stop offset="1" stopColor="rgba(70, 40, 80, 0)" />
          </radialGradient>
          <filter id="hand-tex" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="11" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.14  0 0 0 0 0.11  0 0 0 0.45 0" result="spots" />
            <feComposite in="spots" in2="SourceGraphic" operator="in" result="tex" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="tex" /></feMerge>
          </filter>
        </defs>
        <g filter="url(#hand-tex)">
          {/* back of the hand and wrist, reaching from behind the deck */}
          <path d="M0 34Q48 20 100 26Q120 32 118 60Q118 94 98 102Q48 112 0 98Z" fill="url(#hand-back)" />
          <ellipse cx="70" cy="62" rx="22" ry="14" fill="url(#hand-bruise)" />
          {/* tendons and veins */}
          <path d="M30 46Q66 40 98 32M34 62Q70 58 100 52M36 78Q72 76 100 72M40 92Q70 92 96 88" stroke="rgba(30, 28, 22, 0.35)" strokeWidth="2" fill="none" />
          <path d="M18 56Q46 52 64 60Q80 66 98 60" stroke="rgba(60, 80, 110, 0.5)" strokeWidth="1.6" fill="none" />
          {/* thumb, tucked under the edge */}
          <path d="M66 100Q92 116 122 110Q130 108 128 102" stroke="url(#hand-skin)" strokeWidth="13" strokeLinecap="round" fill="none" />
          {HAND.map((g, i) => (
            <g key={i} className={`finger f${i}`} style={{ transformOrigin: `${g.pts[0][0]}px ${g.pts[0][1]}px` }}>
              <path d={g.outline} fill="url(#hand-skin)" stroke="rgba(25, 22, 18, 0.55)" strokeWidth="0.8" />
              {/* bony knuckles: a highlight and wrinkles at each joint */}
              {[1, 2].map((j) => (
                <g key={j}>
                  <circle cx={g.pts[j][0]} cy={g.pts[j][1] - FINGERS[i].w[j] * 0.18} r={FINGERS[i].w[j] * 0.32} fill="rgba(235, 230, 215, 0.35)" />
                  <path d={`M${g.pts[j][0] - 2} ${g.pts[j][1] - FINGERS[i].w[j] * 0.4}q1.5 ${FINGERS[i].w[j] * 0.4} 0 ${FINGERS[i].w[j] * 0.8}M${g.pts[j][0] + 1.5} ${g.pts[j][1] - FINGERS[i].w[j] * 0.35}q1.5 ${FINGERS[i].w[j] * 0.35} 0 ${FINGERS[i].w[j] * 0.7}`} stroke="rgba(40, 34, 26, 0.6)" strokeWidth="0.9" fill="none" />
                </g>
              ))}
              {/* a long, cracked, filthy nail with blood under it */}
              <g transform={`translate(${g.nail.x} ${g.nail.y}) rotate(${g.nail.ang})`}>
                <path d={`M${-g.nail.w * 0.9} ${-g.nail.w * 0.42}Q${g.nail.w * 1.4} ${-g.nail.w * 0.5} ${g.nail.w * 1.5} 0Q${g.nail.w * 1.4} ${g.nail.w * 0.5} ${-g.nail.w * 0.9} ${g.nail.w * 0.42}Z`} fill="#2e2a22" stroke="#120f0b" strokeWidth="0.7" />
                <path d={`M${g.nail.w * 0.2} ${-g.nail.w * 0.3}L${g.nail.w * 0.6} ${g.nail.w * 0.1}`} stroke="rgba(200, 190, 170, 0.35)" strokeWidth="0.6" />
                <path d={`M${-g.nail.w * 0.9} ${-g.nail.w * 0.42}Q${-g.nail.w * 0.4} 0 ${-g.nail.w * 0.9} ${g.nail.w * 0.42}`} fill="none" stroke="rgba(120, 8, 16, 0.9)" strokeWidth="1.6" />
              </g>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

/** The Widow's face drifting faintly across the dust cover, as if reflected in it. */
export function GlassFace({ from }: { from: 'l' | 'r' }) {
  const src = SYMBOL_IMAGES.WIDOW;
  if (!src) return null;
  return <img className={`glass-face ${from}`} src={src} alt="" aria-hidden="true" draggable={false} />;
}

/**
 * Tilts the deck towards the pointer (fine pointers only): a gentle 3D parallax so the board
 * reads as a physical machine. Eased each animation frame and written as CSS variables.
 */
export function useDeckTilt(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || REDUCED_MOTION || typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: fine)').matches) return;
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const step = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.setProperty('--ry', `${(x * 2.2).toFixed(3)}deg`);
      el.style.setProperty('--rx', `${(-y * 1.6).toFixed(3)}deg`);
      // Unitless copies for offsets (the dust-cover reflection slides against the tilt).
      el.style.setProperty('--px', x.toFixed(3));
      el.style.setProperty('--py', y.toFixed(3));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
}
