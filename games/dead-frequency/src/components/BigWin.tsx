import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { WIN_TIERS, type Overlay, type WinTier } from '../app/useGame';
import { audio } from '../app/audio';
import { formatX } from '../app/format';
import { SYMBOL_IMAGES } from './assets';
import { noiseDataUrl } from './Background';
import type { SymbolId } from '../config/types';

const TITLE: Record<WinTier, [string, string]> = {
  GOOD: ['GOOD', 'WIN'],
  MEGA: ['MEGA', 'WIN'],
  INSANE: ['INSANE', 'WIN'],
  EPIC: ['EPIC', 'WIN'],
  MAX: ['MAX', 'WIN'],
};
/**
 * Who jumps out at each tier, and what the station says about it. Each tier belongs to one of
 * the station's ghosts; EPIC brings all three, and MAX is the Night Host himself, in red.
 */
const SCARE: Record<WinTier, { faces: SymbolId[]; line: string }> = {
  GOOD: { faces: ['PRIEST'], line: 'The Priest heard you. He is still blessing the transmitter.' },
  MEGA: { faces: ['WIDOW'], line: 'The Widow finally got her song. 3:33 AM, right on time.' },
  INSANE: { faces: ['HOST'], line: 'The Night Host grabs the mic: “Stay tuned. Don\'t touch that dial.”' },
  EPIC: { faces: ['PRIEST', 'WIDOW', 'HOST'], line: 'Every ghost in the building is on air tonight.' },
  MAX: { faces: ['HOST'], line: 'The station goes dark. You own the night.' },
};

/** Seconds the counter spends climbing through each tier. */
const STAGE_S = 1.9;

/**
 * Win celebration. The amount counts up from zero and the title climbs through the tiers as it
 * passes each threshold (GOOD → MEGA → INSANE → EPIC, MAX on a capped round), with a slam, a
 * shake and a bigger burst of embers each time. The button (or Space) first skips to the end of
 * the count, then collects.
 */
const REDUCED_MOTION = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function BigWin({ overlay, money, onContinue, reducedMotion = REDUCED_MOTION }: {
  overlay: Extract<Overlay, { kind: 'bigWin' }>;
  money: (x100: number) => string;
  onContinue: () => void;
  reducedMotion?: boolean;
}) {
  const final = overlay.winX100;
  // The tiers the counter passes through, each with the amount where its stage ends.
  const stages = useRef<{ tier: WinTier; end: number }[]>([]);
  if (!stages.current.length) {
    const reached = WIN_TIERS.filter((t) => final >= t.atX * 100 || overlay.tier === 'MAX');
    const list: { tier: WinTier; end: number }[] = reached.map((t, i) => ({ tier: t.tier, end: reached[i + 1] ? reached[i + 1].atX * 100 : final }));
    // MAX gets its own final stage: the slam lands once the counter has reached the max win.
    if (overlay.tier === 'MAX') list.push({ tier: 'MAX', end: final });
    stages.current = list;
  }
  const [shown, setShown] = useState(reducedMotion ? final : 0);
  const [stage, setStage] = useState(reducedMotion ? stages.current.length - 1 : 0);
  const [done, setDone] = useState(reducedMotion);
  const skipRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) return;
    const st = stages.current;
    const start = performance.now();
    let raf = 0;
    let lastStage = -1;
    let lastTick = 0;
    const tick = (now: number) => {
      // rAF timestamps can be slightly earlier than performance.now(): never let time run negative.
      const t = skipRef.current ? Infinity : Math.max(0, now - start) / 1000 / STAGE_S;
      const i = Math.min(st.length - 1, Math.floor(t));
      const from = i === 0 ? 0 : st[i - 1].end;
      const p = Math.min(1, t - i);
      const e = 1 - Math.pow(1 - p, 2);
      const v = t >= st.length ? final : Math.round(from + (st[i].end - from) * e);
      if (i !== lastStage) {
        lastStage = i;
        setStage(i);
        audio.scare(i);
        audio.tierUp(i, 0.42);
      }
      if (now - lastTick > 70 && v < final) {
        lastTick = now;
        audio.tick(p);
      }
      setShown(v);
      if (v >= final && t >= st.length - 1 + 1) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [final, reducedMotion]);

  const press = () => {
    if (done) onContinue();
    else skipRef.current = true;
  };
  // Space while counting skips the count instead of collecting (runs before the game's own handler).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement)?.tagName === 'BUTTON') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      press();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const tier = stages.current[stage].tier;
  const [w1, w2] = TITLE[tier];
  const host = SYMBOL_IMAGES.HOST;
  const scare = SCARE[tier];
  return (
    <div
      className={`bigwin bw-${tier.toLowerCase()} ${done ? 'done' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${w1} ${w2}`}
      onClick={press}
      style={{ '--noise': `url(${noiseDataUrl()})` } as CSSProperties}
    >
      {reducedMotion ? null : (
        // Jump scare on every tier-up: static burst, the tier's ghost lunging at the screen, a flash.
        <div className="bw-scare" key={`scare${stage}`} aria-hidden="true">
          <div className="bw-scare-static" />
          {scare.faces.map((f, i) => {
            const src = SYMBOL_IMAGES[f];
            return src ? <img key={f} className="bw-scare-face" src={src} alt="" style={{ '--i': i, '--n': scare.faces.length } as CSSProperties} /> : null;
          })}
          <div className="bw-scare-flash" />
        </div>
      )}
      <div className="bw-rays" aria-hidden="true" />
      <Embers key={stage} level={stage + (tier === 'MAX' ? 2 : 0)} reducedMotion={reducedMotion} />
      {host ? <img className="bw-host" src={host} alt="" aria-hidden="true" /> : null}
      <div className="bw-content" key={`s${stage}`}>
        <h2 className="bw-title" data-text={`${w1} ${w2}`}>
          <span className="bw-w1">{w1}</span>
          <span className="bw-w2">{w2}</span>
        </h2>
      </div>
      <p className="bw-amount" data-testid="bigwin-amount">{money(shown)}</p>
      <p className="bw-x">{formatX(shown)}</p>
      <p className="bw-line" key={`line${stage}`}>{scare.line}</p>
      <ol className="bw-ladder" aria-hidden="true">
        {WIN_TIERS.map((t) => (
          <li key={t.tier} className={stages.current.slice(0, stage + 1).some((s) => s.tier === t.tier) ? 'on' : ''}>{t.tier}</li>
        ))}
      </ol>
      <button className="primary bw-btn" autoFocus onClick={(e) => { e.stopPropagation(); press(); }}>
        {done ? 'Collect' : 'Skip'}
      </button>
    </div>
  );
}

/** Embers and sparks bursting up from below the title; more and faster for higher tiers. */
function Embers({ level, reducedMotion }: { level: number; reducedMotion: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (reducedMotion) return;
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const W = (c.width = Math.floor(c.clientWidth / 2));
    const H = (c.height = Math.floor(c.clientHeight / 2));
    const n = 70 + level * 55;
    const ps = Array.from({ length: n }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = (0.35 + Math.random() * 0.65) * H * (0.9 + level * 0.12);
      return { x: W / 2 + (Math.random() - 0.5) * W * 0.25, y: H * 0.62, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0.6 + Math.random() * 2.2, life: 1.4 + Math.random() * 1.6, t: 0, hue: Math.random() };
    });
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      let alive = 0;
      for (const p of ps) {
        p.t += dt;
        if (p.t > p.life) continue;
        alive++;
        p.vy += H * 0.55 * dt;
        p.vx *= 1 - dt * 0.8;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = 1 - p.t / p.life;
        ctx.fillStyle = p.hue < 0.7 ? `rgba(255, ${140 + p.hue * 120}, 60, ${a})` : `rgba(255, 70, 90, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.6 + a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      if (alive) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [level, reducedMotion]);
  return <canvas ref={ref} className="bw-embers" aria-hidden="true" style={{ '--lvl': level } as CSSProperties} />;
}
