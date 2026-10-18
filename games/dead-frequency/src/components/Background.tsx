import { useEffect, useRef } from 'react';
import type { BonusType } from '../config/types';
import { SYMBOL_IMAGES } from './assets';

export type BackgroundMood = 'base' | BonusType;

/** Per-mood palette and how often the scares happen (events per second, roughly). */
const MOODS: Record<BackgroundMood, { sky: [string, string]; glow: string; beacon: string; rate: number; pulse: number }> = {
  base: { sky: ['#0b0507', '#050608'], glow: '255, 59, 79', beacon: '#ff3b4f', rate: 1, pulse: 0.5 },
  NIGHT_SHIFT: { sky: ['#03100b', '#030806'], glow: '54, 217, 160', beacon: '#36d9a0', rate: 1.6, pulse: 0.8 },
  POSSESSION: { sky: ['#0d0514', '#050308'], glow: '170, 90, 255', beacon: '#b46bff', rate: 1.8, pulse: 0.9 },
  DEAD_AIR: { sky: ['#1a0306', '#070203'], glow: '255, 40, 60', beacon: '#ff2038', rate: 2.6, pulse: 1.3 },
};

/** Which face haunts the fog in each mood. */
const GHOSTS: Record<BackgroundMood, (keyof typeof SYMBOL_IMAGES)[]> = {
  base: ['HOST', 'WIDOW', 'PRIEST', 'STATIC'],
  NIGHT_SHIFT: ['PRIEST', 'HOST'],
  POSSESSION: ['WIDOW', 'STATIC'],
  DEAD_AIR: ['HOST'],
};

interface Mote { x: number; y: number; vx: number; vy: number; r: number; a: number; tw: number }
interface Fog { x: number; y: number; r: number; v: number; a: number }
interface Cloud { img: HTMLCanvasElement; x: number; y: number; v: number; a: number }
interface Bat { x: number; y: number; vx: number; s: number; ph: number; bob: number }

/** A soft cloud sprite: a cluster of dark blurred puffs with a faint lit rim on top. */
function makeCloud(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    const x = w * (0.15 + Math.random() * 0.7);
    const y = h * (0.45 + Math.random() * 0.25);
    const r = h * (0.22 + Math.random() * 0.25);
    const g = ctx.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(92, 84, 102, 0.6)');
    g.addColorStop(0.6, 'rgba(26, 22, 30, 0.5)');
    g.addColorStop(1, 'rgba(10, 8, 12, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

/** A jagged forked lightning bolt from the top of the sky. */
function makeBolt(W: number, H: number): [number, number][][] {
  const main: [number, number][] = [];
  let x = W * (0.2 + Math.random() * 0.6);
  let y = 0;
  const end = H * (0.35 + Math.random() * 0.25);
  while (y < end) {
    main.push([x, y]);
    x += (Math.random() - 0.5) * W * 0.04;
    y += H * (0.02 + Math.random() * 0.03);
  }
  const forks = [main];
  for (let k = 0; k < 2; k++) {
    const from = main[Math.floor(main.length * (0.3 + Math.random() * 0.4))];
    if (!from) continue;
    const f: [number, number][] = [from];
    let [fx, fy] = from;
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      fx += dir * W * (0.01 + Math.random() * 0.025);
      fy += H * (0.015 + Math.random() * 0.025);
      f.push([fx, fy]);
    }
    forks.push(f);
  }
  return forks;
}

/** A small grey noise tile; also used as a CSS background by the bonus intro. */
let noiseTiles: HTMLCanvasElement[] | null = null;
function getNoiseTiles(): HTMLCanvasElement[] {
  if (noiseTiles) return noiseTiles;
  noiseTiles = Array.from({ length: 4 }, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
  return noiseTiles;
}

export function noiseDataUrl(): string {
  return getNoiseTiles()[0].toDataURL();
}

function drawTower(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, w: number) {
  const top = base - h;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.lineTo(x, top);
  ctx.lineTo(x + w / 2, base);
  const steps = 9;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const y = base - h * t;
    const half = (w / 2) * (1 - t);
    const yNext = base - h * ((i + 1) / steps);
    const halfNext = (w / 2) * (1 - (i + 1) / steps);
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half, y);
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + halfNext, yNext);
    ctx.moveTo(x + half, y);
    ctx.lineTo(x - halfNext, yNext);
  }
  ctx.stroke();
  return top;
}

/**
 * Full-screen animated scene behind the game: a dead broadcast town at night. Two radio towers
 * with blinking beacons send out pulses, fog drifts, ash rises, and film grain and a rolling CRT
 * band sit over everything. At random it flashes lightning, tears the picture with a glitch, or
 * lets a face surface in the fog. Every bonus has its own colour and gets more frequent scares.
 * With reduced motion it draws a single still frame.
 */
export function Background({ mood, reducedMotion, surge = 0 }: { mood: BackgroundMood; reducedMotion: boolean; surge?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;
  // A win surges the whole scene: lightning, a shock ring from the centre, faster signal pulses.
  const surgeRef = useRef({ id: surge, seen: surge });
  surgeRef.current.id = surge;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const SCALE = 0.5; // render at half resolution; fog and grain hide the softness
    let W = 0;
    let H = 0;
    let motes: Mote[] = [];
    let fogs: Fog[] = [];
    let clouds: Cloud[] = [];
    const resize = () => {
      W = Math.max(1, Math.floor(window.innerWidth * SCALE));
      H = Math.max(1, Math.floor(window.innerHeight * SCALE));
      canvas.width = W;
      canvas.height = H;
      motes = Array.from({ length: Math.round((W * H) / 2600) }, () => ({
        x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 4, vy: -(2 + Math.random() * 7),
        r: 0.4 + Math.random() * 1.2, a: 0.2 + Math.random() * 0.5, tw: Math.random() * 6.28,
      }));
      fogs = Array.from({ length: 7 }, (_, i) => ({
        x: Math.random() * W, y: H * (0.45 + Math.random() * 0.55), r: W * (0.25 + Math.random() * 0.3),
        v: (i % 2 ? 1 : -1) * (2 + Math.random() * 5), a: 0.05 + Math.random() * 0.07,
      }));
      clouds = Array.from({ length: 6 }, (_, i) => {
        const w = W * (0.35 + Math.random() * 0.3);
        return { img: makeCloud(w, w * 0.32), x: Math.random() * W - w / 2, y: H * (0.02 + (i % 3) * 0.1 + Math.random() * 0.06), v: 3 + Math.random() * 6, a: 0.65 + Math.random() * 0.35 };
      });
    };
    resize();
    const onResize = () => {
      resize();
      if (reducedMotion) requestAnimationFrame(frame);
    };
    window.addEventListener('resize', onResize);

    const tiles = getNoiseTiles();
    const ghosts: Partial<Record<string, HTMLImageElement>> = {};
    for (const id of ['HOST', 'WIDOW', 'PRIEST', 'STATIC'] as const) {
      const img = new Image();
      img.src = SYMBOL_IMAGES[id]!;
      ghosts[id] = img;
    }

    let lightning = 0;
    let glitch = 0;
    let ghost: { img: HTMLImageElement; x: number; y: number; s: number; t: number; dur: number } | null = null;
    let nextLightning = 4 + Math.random() * 8;
    let nextGlitch = 2 + Math.random() * 5;
    let nextGhost = 6 + Math.random() * 8;
    let nextBats = 3 + Math.random() * 6;
    let bats: Bat[] = [];
    let bolt: [number, number][][] | null = null;
    let shock = -1;
    let surgeT = 0;
    let last = performance.now();
    let elapsed = 0;
    let raf = 0;

    const frame = (now: number) => {
      // rAF timestamps can be slightly earlier than performance.now() at start: never run time backwards.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      elapsed += dt;
      const m = MOODS[moodRef.current];

      // --- scheduled scares
      nextLightning -= dt * m.rate;
      nextGlitch -= dt * m.rate;
      nextGhost -= dt * m.rate;
      if (surgeRef.current.id !== surgeRef.current.seen) {
        surgeRef.current.seen = surgeRef.current.id;
        if (surgeRef.current.id) { nextLightning = 0; shock = 0; surgeT = 2.5; }
      }
      surgeT = Math.max(0, surgeT - dt);
      if (nextLightning <= 0) { lightning = 1; bolt = makeBolt(W, H); nextLightning = 7 + Math.random() * 14; }
      nextBats -= dt * m.rate;
      if (nextBats <= 0 && !bats.length) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y0 = H * (0.08 + Math.random() * 0.4);
        bats = Array.from({ length: 4 + Math.floor(Math.random() * 6) }, () => ({
          x: dir > 0 ? -20 - Math.random() * W * 0.25 : W + 20 + Math.random() * W * 0.25,
          y: y0 + (Math.random() - 0.5) * H * 0.12, vx: dir * W * (0.14 + Math.random() * 0.08),
          s: Math.min(W, H) * (0.018 + Math.random() * 0.016), ph: Math.random() * 6.28, bob: Math.random() * 6.28,
        }));
        nextBats = 14 + Math.random() * 18;
      }
      if (nextGlitch <= 0) { glitch = 0.25; nextGlitch = 3 + Math.random() * 8; }
      if (nextGhost <= 0 && !ghost) {
        const pool = GHOSTS[moodRef.current];
        const img = ghosts[pool[Math.floor(Math.random() * pool.length)]];
        if (img?.complete && img.naturalWidth) {
          const side = Math.random() < 0.5 ? 0.15 : 0.85;
          ghost = { img, x: W * side, y: H * (0.3 + Math.random() * 0.25), s: Math.min(W, H) * (0.45 + Math.random() * 0.25), t: 0, dur: 2.6 };
        }
        nextGhost = 10 + Math.random() * 14;
      }

      // --- sky
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, m.sky[0]);
      sky.addColorStop(1, m.sky[1]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // --- moon with a halo, tinted by the mood, behind drifting storm clouds
      // Placed in the gap right of the reels (landscape) or above them (portrait).
      const mx = W > H ? W * 0.86 : W * 0.78;
      const my = W > H ? H * 0.32 : H * 0.1;
      const mr = Math.min(W, H) * 0.075;
      const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
      halo.addColorStop(0, `rgba(${m.glow}, 0.22)`);
      halo.addColorStop(1, `rgba(${m.glow}, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
      const disc = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      disc.addColorStop(0, moodRef.current === 'base' ? '#e9dcc8' : `rgb(${m.glow})`);
      disc.addColorStop(1, moodRef.current === 'base' ? '#8a7766' : '#3a0d14');
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      for (const c of clouds) {
        c.x += c.v * dt * (1 + surgeT * 0.6);
        if (c.x > W) c.x = -c.img.width;
        ctx.globalAlpha = c.a;
        ctx.drawImage(c.img, c.x, c.y);
      }
      ctx.globalAlpha = 1;
      // forked bolt behind the clouds' glow
      if (bolt && lightning > 0.35) {
        ctx.save();
        ctx.strokeStyle = `rgba(225, 230, 255, ${lightning})`;
        ctx.shadowColor = 'rgba(170, 190, 255, 0.9)';
        ctx.shadowBlur = 12;
        for (const [i, f] of bolt.entries()) {
          ctx.lineWidth = i ? 0.8 : 1.8;
          ctx.beginPath();
          f.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
        ctx.restore();
      }

      // heartbeat glow on the horizon (a double pulse)
      const beat = (t: number) => Math.max(0, Math.sin(t * Math.PI * 2)) ** 8;
      const hb = (beat(elapsed * 0.9 * m.pulse) + 0.6 * beat(elapsed * 0.9 * m.pulse - 0.12)) * 0.5;
      const glow = ctx.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, H * 0.9);
      glow.addColorStop(0, `rgba(${m.glow}, ${0.18 + hb * 0.25})`);
      glow.addColorStop(1, `rgba(${m.glow}, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // --- ghost face surfacing in the fog (behind the towers)
      if (ghost) {
        ghost.t += dt;
        const p = ghost.t / ghost.dur;
        const flick = Math.random() < 0.15 ? 0.3 : 1;
        const alpha = Math.sin(Math.min(1, p) * Math.PI) * 0.22 * flick;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = 'grayscale(1) blur(1px) contrast(1.4)';
        const s = ghost.s * (1 + p * 0.15);
        ctx.drawImage(ghost.img, ghost.x - s / 2 + (Math.random() - 0.5) * 3, ghost.y - s / 2, s, s);
        ctx.restore();
        if (p >= 1) ghost = null;
      }

      // --- signal pulses from the beacons
      const towers = [
        { x: W * 0.1, h: H * 0.62, w: H * 0.12, rate: 1.3 },
        { x: W * 0.9, h: H * 0.5, w: H * 0.1, rate: 0.9 },
      ];
      ctx.lineWidth = 1;
      for (const [i, t] of towers.entries()) {
        const top = H - t.h;
        for (let k = 0; k < 3; k++) {
          const phase = ((elapsed * 0.35 * m.pulse * (1 + surgeT) + k / 3 + i * 0.5) % 1);
          ctx.strokeStyle = `rgba(${m.glow}, ${(1 - phase) * 0.35})`;
          ctx.beginPath();
          ctx.arc(t.x, top, 6 + phase * H * 0.6, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
        }
      }

      // --- fog
      for (const f of fogs) {
        f.x += f.v * dt;
        if (f.x - f.r > W) f.x = -f.r;
        if (f.x + f.r < 0) f.x = W + f.r;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(150, 150, 165, ${f.a})`);
        g.addColorStop(1, 'rgba(150, 150, 165, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      }

      // --- skyline: hills and towers in silhouette (lit up by lightning)
      const lit = lightning > 0.4 ? 0.5 : 0;
      ctx.fillStyle = lit ? '#2a2a33' : '#020203';
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 24) ctx.lineTo(x, H * 0.9 - Math.sin(x * 0.011) * H * 0.03 - Math.sin(x * 0.037) * H * 0.012);
      ctx.lineTo(W, H);
      ctx.fill();
      ctx.strokeStyle = lit ? '#3a3a46' : '#050507';
      ctx.lineWidth = 1.5;
      for (const [i, t] of towers.entries()) {
        const top = drawTower(ctx, t.x, H, t.h, t.w);
        const on = Math.sin(elapsed * Math.PI * t.rate + i) > 0.2;
        if (on) {
          const b = ctx.createRadialGradient(t.x, top, 0, t.x, top, 18);
          b.addColorStop(0, m.beacon);
          b.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = b;
          ctx.fillRect(t.x - 18, top - 18, 36, 36);
        }
      }

      // --- power line sagging between the towers, with sparks of signal running along it
      const [ta, tb] = towers;
      const ay = H - ta.h * 0.72;
      const by = H - tb.h * 0.72;
      const sag = H * 0.16;
      const wireAt = (t: number): [number, number] => {
        const x = ta.x + (tb.x - ta.x) * t;
        return [x, ay + (by - ay) * t + sag * 4 * t * (1 - t)];
      };
      ctx.strokeStyle = lit ? '#3a3a46' : '#09090c';
      ctx.lineWidth = 1;
      for (const off of [0, H * 0.02]) {
        ctx.beginPath();
        for (let k = 0; k <= 30; k++) {
          const [x, y] = wireAt(k / 30);
          if (k) ctx.lineTo(x, y + off); else ctx.moveTo(x, y + off);
        }
        ctx.stroke();
      }
      const sparks = 2 + Math.round(surgeT * 2);
      for (let k = 0; k < sparks; k++) {
        const t = (elapsed * (0.08 + surgeT * 0.1) + k / sparks) % 1;
        const [x, y] = wireAt(t);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, `rgba(${m.glow}, 0.9)`);
        g.addColorStop(1, `rgba(${m.glow}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - 7, y - 7, 14, 14);
      }

      // --- bats crossing the sky
      if (bats.length) {
        ctx.fillStyle = '#050406';
        for (const b of bats) {
          b.x += b.vx * dt;
          b.ph += dt * 16;
          b.bob += dt * 3;
          const y = b.y + Math.sin(b.bob) * b.s * 2;
          const f = Math.sin(b.ph);
          ctx.beginPath();
          ctx.moveTo(b.x, y);
          ctx.quadraticCurveTo(b.x - b.s, y - b.s * 1.6 * f, b.x - b.s * 2.2, y - b.s * 0.4 * f);
          ctx.quadraticCurveTo(b.x - b.s * 1.2, y + b.s * 0.3, b.x, y + b.s * 0.35);
          ctx.quadraticCurveTo(b.x + b.s * 1.2, y + b.s * 0.3, b.x + b.s * 2.2, y - b.s * 0.4 * f);
          ctx.quadraticCurveTo(b.x + b.s, y - b.s * 1.6 * f, b.x, y);
          ctx.fill();
        }
        bats = bats.filter((b) => b.x > -W * 0.4 && b.x < W * 1.4);
      }

      // --- shock ring from the centre on a win surge
      if (shock >= 0) {
        shock += dt * 0.9;
        ctx.strokeStyle = `rgba(${m.glow}, ${Math.max(0, 0.5 * (1 - shock))})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.5, shock * Math.max(W, H) * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        if (shock >= 1) shock = -1;
      }

      // --- rising ash
      for (const p of motes) {
        p.x += p.vx * dt * (0.6 + m.pulse * 0.4);
        p.y += p.vy * dt * (0.6 + m.pulse * 0.4) * (1 + surgeT * 1.2);
        p.tw += dt * 3;
        if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
        ctx.fillStyle = `rgba(${m.glow}, ${p.a * (0.5 + 0.5 * Math.sin(p.tw))})`;
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }

      // --- film grain
      ctx.globalAlpha = 0.07;
      const tile = tiles[Math.abs(Math.floor(elapsed * 24)) % tiles.length];
      const ox = Math.floor(Math.random() * 128);
      const oy = Math.floor(Math.random() * 128);
      for (let y = -oy; y < H; y += 128) for (let x = -ox; x < W; x += 128) ctx.drawImage(tile, x, y);
      ctx.globalAlpha = 1;

      // --- rolling CRT band
      const bandY = ((elapsed * 0.12) % 1.3) * H - H * 0.15;
      const band = ctx.createLinearGradient(0, bandY - 30, 0, bandY + 30);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.5, 'rgba(255,255,255,0.035)');
      band.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, bandY - 30, W, 60);

      // --- glitch: tear horizontal slices of the frame sideways, with a colour split
      if (glitch > 0) {
        glitch -= dt;
        for (let i = 0; i < 6; i++) {
          const y = Math.random() * H;
          const h = 2 + Math.random() * H * 0.06;
          const dx = (Math.random() - 0.5) * W * 0.08;
          ctx.drawImage(canvas, 0, y, W, h, dx, y, W, h);
        }
        ctx.fillStyle = `rgba(${m.glow}, 0.08)`;
        ctx.fillRect(0, Math.random() * H, W, 3 + Math.random() * 8);
      }

      // --- lightning
      if (lightning > 0) {
        const flicker = lightning > 0.6 || Math.random() < 0.5 ? lightning : lightning * 0.3;
        ctx.fillStyle = `rgba(210, 220, 255, ${flicker * 0.35})`;
        ctx.fillRect(0, 0, W, H);
        lightning = Math.max(0, lightning - dt * 2.2);
      }

      // --- vignette
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${0.75 - hb * 0.15})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);

      if (!reducedMotion) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : !reducedMotion && start());
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} className="bg-canvas" aria-hidden="true" />;
}
