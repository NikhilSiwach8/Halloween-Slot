import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { audio } from '../app/audio';
import { SYMBOL_IMAGES } from './assets';
import { noiseDataUrl } from './Background';

export type ScareKind = 'face' | 'blackout' | 'hand' | 'widow' | 'glitch' | 'lunge';
const KINDS: ScareKind[] = ['face', 'blackout', 'hand', 'widow', 'glitch', 'lunge'];
/** How long each scare stays on screen (ms). All are short and never take input. */
const DURATION: Record<ScareKind, number> = { face: 750, blackout: 1500, hand: 2300, widow: 1150, glitch: 650, lunge: 950 };
/** At least this long between two scares (ms). */
const COOLDOWN_MS = 22_000;
/** Chance of a scare shortly after a spin lands. */
const AFTER_SPIN_CHANCE = 0.11;
/** While idle, a scare comes after a random 35–75 s. */
const IDLE_MS: [number, number] = [35_000, 75_000];

const SETTING_KEY = 'dead-frequency:jump-scares';
const REDUCED_MOTION = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The player's "Random jump scares" setting: on by default, off by default with reduced motion. */
export function useScareSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      const v = localStorage.getItem(SETTING_KEY);
      if (v !== null) return v === '1';
    } catch {
      /* storage unavailable */
    }
    return !REDUCED_MOTION;
  });
  const set = (v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(SETTING_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };
  return [on, set];
}

interface Active { kind: ScareKind; id: number; x: number; y: number; flip: boolean; face: string | undefined }

/**
 * Random jump scares, purely cosmetic: a face flashing in the reels, the lights going out with
 * eyes in the dark, a bloody hand slamming onto the glass, the Widow rushing past, the picture
 * tearing with a scream, and the Night Host lunging at the screen. They come at random: now and
 * then right after a spin lands, and every so often while the game sits idle. Never while
 * something else needs the player (`blocked`: bonus intro, win screens, menus, title screen),
 * never two within 22 s, one flash at most each, never blocking input, and only if the player
 * has them switched on.
 */
export function JumpScares({ enabled, blocked, busy, spinning, spinId }: { enabled: boolean; blocked: boolean; busy: boolean; spinning: boolean; spinId: number }) {
  const [active, setActive] = useState<Active | null>(null);
  const last = useRef({ at: -COOLDOWN_MS, kind: '' as ScareKind | '' });
  const id = useRef(0);
  const state = useRef({ enabled, blocked });
  state.current = { enabled, blocked };

  const fire = (kind?: ScareKind) => {
    const now = performance.now();
    if (!state.current.enabled || state.current.blocked || now - last.current.at < COOLDOWN_MS) return;
    const pool = KINDS.filter((k) => k !== last.current.kind);
    const k = kind ?? pool[Math.floor(Math.random() * pool.length)];
    const faces = [SYMBOL_IMAGES.HOST, SYMBOL_IMAGES.WIDOW, SYMBOL_IMAGES.PRIEST];
    last.current = { at: now, kind: k };
    id.current++;
    setActive({ kind: k, id: id.current, x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.5, flip: Math.random() < 0.5, face: faces[Math.floor(Math.random() * faces.length)] });
    audio.randomScare(k);
  };

  // QA hook (?scareTest=1): window.__dfScare('hand') fires one immediately, ignoring the cooldown.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('scareTest')) return;
    (window as unknown as { __dfScare: (k: ScareKind) => void }).__dfScare = (k) => {
      last.current.at = -COOLDOWN_MS;
      fire(k);
    };
  }, []);

  // Clear each scare after its duration.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(null), DURATION[active.kind]);
    return () => clearTimeout(t);
  }, [active]);

  // Now and then, shortly after a spin lands.
  useEffect(() => {
    if (spinning || spinId === 0 || Math.random() > AFTER_SPIN_CHANCE) return;
    const t = setTimeout(() => fire(), 500 + Math.random() * 1200);
    return () => clearTimeout(t);
  }, [spinning, spinId]);

  // While idle: a random 35–75 s after the last activity.
  useEffect(() => {
    if (busy || !enabled) return;
    const t = setTimeout(() => fire(), IDLE_MS[0] + Math.random() * (IDLE_MS[1] - IDLE_MS[0]));
    return () => clearTimeout(t);
  }, [busy, enabled, spinId, active]);

  if (!active) return null;
  const pos = { '--x': `${active.x * 100}%`, '--y': `${active.y * 100}%` } as CSSProperties;
  const flip = active.flip ? 'flip' : '';
  switch (active.kind) {
    case 'face':
      return (
        <div className="js js-face" key={active.id} aria-hidden="true" style={{ '--noise': `url(${noiseDataUrl()})` } as CSSProperties}>
          <div className="js-static" />
          {active.face ? <img src={active.face} alt="" /> : null}
        </div>
      );
    case 'blackout':
      return (
        <div className="js js-blackout" key={active.id} aria-hidden="true">
          <i className="js-eyes" style={pos} />
        </div>
      );
    case 'hand':
      return (
        <div className={`js js-hand ${flip}`} key={active.id} aria-hidden="true" style={pos}>
          <svg viewBox="0 0 160 220">
            <defs>
              {/* Ragged, smeared edges and a mottled, blotchy fill: a real print, not a silhouette. */}
              <filter id="js-blood" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="7" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d" />
                <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" result="g" />
                <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.25" result="holes" />
                <feComposite in="d" in2="holes" operator="in" />
              </filter>
            </defs>
            <g filter="url(#js-blood)">
              {/* palm */}
              <path d="M44 120c-6-20 2-38 22-42 18-4 40 0 52 12 10 10 10 30 2 46-8 18-26 34-46 32-20-2-26-26-30-48z" />
              {/* fingers, each pressed separately, with gaps */}
              <path d="M50 82c-6-18-8-40-4-56 3-10 13-9 15 1 3 16 2 36 0 54z" />
              <path d="M70 76c-2-22-1-46 4-62 3-10 14-8 15 2 2 18-1 40-4 60z" />
              <path d="M94 80c2-20 6-40 12-52 4-9 15-5 13 5-3 16-8 34-12 50z" />
              <path d="M112 92c6-14 14-26 22-32 7-5 14 2 9 9-6 10-14 22-22 32z" />
              {/* thumb */}
              <path d="M40 126c-10-6-20-16-26-28-4-8 4-14 10-8 8 8 16 18 22 26z" />
              {/* runs of blood from the bottom of the print */}
              <path d="M62 168c-2 12 0 26-2 40M84 170c1 10 0 18 2 30M100 162c2 8 1 14 3 20" strokeWidth="6" strokeLinecap="round" fill="none" />
            </g>
          </svg>
        </div>
      );
    case 'widow':
      return SYMBOL_IMAGES.WIDOW ? <img className={`js js-widow ${flip}`} key={active.id} src={SYMBOL_IMAGES.WIDOW} alt="" aria-hidden="true" /> : null;
    case 'glitch':
      return (
        <div className="js js-glitch" key={active.id} aria-hidden="true" style={{ '--noise': `url(${noiseDataUrl()})` } as CSSProperties}>
          <i /><i /><i /><i />
          <p>HE IS STILL ON AIR</p>
        </div>
      );
    case 'lunge':
      return SYMBOL_IMAGES.HOST ? <img className="js js-lunge" key={active.id} src={SYMBOL_IMAGES.HOST} alt="" aria-hidden="true" /> : null;
  }
}
