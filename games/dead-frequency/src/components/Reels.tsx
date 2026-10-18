import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { GameConfig, SymbolId } from '../config/types';
import type { Board } from '../engine/board';
import { REEL_BACK, reelMotion, reelStops, type View } from '../app/useGame';
import { formatX } from '../app/format';
import { SymbolArt } from './SymbolArt';

/** What the reels show before the first spin (display only, not an outcome). */
const IDLE_BOARD: SymbolId[][] = [
  ['HOST', 'MIC', 'RADIO', 'VALVE'],
  ['CASSETTE', 'WIDOW', 'HEADPHONES', 'PRIEST'],
  ['RADIO', 'VALVE', 'WILD', 'MIC'],
  ['PRIEST', 'HEADPHONES', 'CASSETTE', 'HOST'],
  ['VALVE', 'RADIO', 'WIDOW', 'MIC'],
  ['HEADPHONES', 'HOST', 'CASSETTE', 'RADIO'],
];

/** Symbols that blur past while a reel spins, in a different order per reel. */
const STRIP: SymbolId[] = ['HOST', 'VALVE', 'WIDOW', 'CASSETTE', 'RADIO', 'MIC', 'PRIEST', 'HEADPHONES', 'WILD', 'STATIC'];
const PERIOD = STRIP.length;
/**
 * Filler cells per reel. The strip is parked at (s mod PERIOD) - PERIOD rows, so it spans rows
 * -PERIOD..+5 at worst: always covering the 4-row window, with the fewest cells to composite.
 */
const FILLER = PERIOD + 5;
const stripFor = (r: number) => Array.from({ length: FILLER }, (_, k) => STRIP[(k + r * 3) % PERIOD]);

const idle: Board = IDLE_BOARD.map((reel) => reel.map((s) => ({ s, m: 1 })));

/** Spin-up: a small kick upwards, then acceleration to cruise speed. Seconds and cells. */
const KICK = { normal: { t: 0.09, h: 0.14 }, turbo: { t: 0.045, h: 0.07 } };
const ACCEL_S = { normal: 0.16, turbo: 0.09 };
const START_STAGGER_MS = { normal: 35, turbo: 18 };

const easeOutBack = (u: number) => 1 + (REEL_BACK + 1) * (u - 1) ** 3 + REEL_BACK * (u - 1) ** 2;

interface ReelPlan {
  /** performance.now() when this reel starts moving. */
  start: number;
  /** performance.now() when its stop begins, and its resting offset (cells); null while spinning. */
  stopAt: number | null;
  rest: number;
  /** Turbo as it was when the spin started (toggling it mid-spin must not make the reels jump). */
  turbo: boolean;
}

/**
 * The reels. Each reel is a window onto an endless column that moves down by `s` cells:
 *   - the old symbols sit at offset 0 and scroll out of the bottom,
 *   - an endless filler strip (blurred symbols) follows them,
 *   - the new symbols are placed on that column above the window, so they scroll in with it.
 * One requestAnimationFrame loop moves all six reels by setting transforms on three layers per
 * reel (old symbols, strip, new symbols); nothing re-renders while they move, and no filter is
 * animated, so each frame is only compositing. Stopping eases out from exactly the cruise speed
 * and overshoots once, timed with useGame (reelStops / reelMotion), which plays the reel thunks.
 * A reel that could still complete a bonus spins on longer and glows (the tease).
 */
export function Reels({ cfg, view, turbo }: { cfg: GameConfig; view: View; turbo: boolean }) {
  const { spinning, unrevealed, winCells, bonus, spinId, instant } = view;
  const board = view.board ?? idle;
  const hasWin = winCells.size > 0;
  const stops = spinning || spinId === 0 ? null : reelStops(board, turbo);
  const motion = reelMotion(turbo);

  // The board shown when the current spin started: it scrolls out while the new one arrives.
  const oldBoard = useRef<{ id: number; board: Board }>({ id: 0, board });
  if (spinning && oldBoard.current.id !== spinId) oldBoard.current = { id: spinId, board };

  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const plans = useRef<ReelPlan[]>([]);
  const raf = useRef(0);

  /** Offset (cells) of reel r at time `now` while cruising (before its stop). */
  const cruise = (p: ReelPlan, now: number) => {
    const k = p.turbo ? 'turbo' : 'normal';
    const { speed } = reelMotion(p.turbo);
    const t = (now - p.start) / 1000;
    const kick = KICK[k];
    const accel = ACCEL_S[k];
    if (t <= 0) return 0;
    if (t < kick.t) return -kick.h * Math.sin((Math.PI * t) / kick.t);
    if (t < kick.t + accel) return (0.5 * speed * (t - kick.t) ** 2) / accel;
    return 0.5 * speed * accel + speed * (t - kick.t - accel);
  };
  const offsetAt = (p: ReelPlan, now: number): { s: number; done: boolean } => {
    if (p.stopAt === null || now < p.stopAt) return { s: cruise(p, now), done: false };
    const m = reelMotion(p.turbo);
    const u = Math.min(1, (now - p.stopAt) / m.stopMs);
    return { s: p.rest - m.stopCells + m.stopCells * easeOutBack(u), done: u >= 1 };
  };

  /** Moves the three layers of every reel to their offsets for this frame. */
  const paint = (now: number) => {
    let moving = false;
    reelRefs.current.forEach((el, r) => {
      const p = plans.current[r];
      if (!el || !p) return;
      const pitch = Number(el.dataset.pitch) || el.clientHeight / 4;
      const { s, done } = offsetAt(p, now);
      if (!done) moving = true;
      const [strip, old, cells] = [el.children[0], el.children[1], el.children[2]] as HTMLElement[];
      // Strip: periodic, so only s mod PERIOD matters.
      const sp = ((s % PERIOD) + PERIOD) % PERIOD;
      strip.style.transform = `translate3d(0, ${(sp - PERIOD) * pitch}px, 0)`;
      strip.style.visibility = done ? 'hidden' : 'visible';
      old.style.transform = `translate3d(0, ${s * pitch}px, 0)`;
      old.style.visibility = s < 4.2 && !done ? 'visible' : 'hidden';
      const inView = p.stopAt !== null && s - p.rest > -4.2;
      cells.style.transform = `translate3d(0, ${done ? 0 : (s - p.rest) * pitch}px, 0)`;
      cells.style.visibility = done || inView ? 'visible' : 'hidden';
    });
    if (moving) raf.current = requestAnimationFrame(paint);
  };
  const run = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(paint);
  };

  // Cell pitch (cell + gap), measured from the layout and kept on each reel.
  useLayoutEffect(() => {
    const measure = () =>
      reelRefs.current.forEach((el) => {
        if (!el) return;
        const cells = el.children[2] as HTMLElement;
        const gap = parseFloat(getComputedStyle(cells).rowGap) || 0;
        el.dataset.pitch = String((cells.clientHeight + gap) / 4);
      });
    measure();
    const ro = new ResizeObserver(measure);
    reelRefs.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, []);

  // Spin starts: every reel kicks and accelerates, a little after the one to its left.
  useLayoutEffect(() => {
    if (!spinning) return;
    const now = performance.now();
    const k = turbo ? 'turbo' : 'normal';
    plans.current = Array.from({ length: cfg.reels }, (_, r) => ({ start: now + r * START_STAGGER_MS[k], stopAt: null, rest: 0, turbo }));
    if (instant) return;
    run();
  }, [spinning, spinId]);

  // Result arrives: plan each reel's stop so the new symbols scroll in from above and settle.
  useLayoutEffect(() => {
    if (spinning || spinId === 0 || !stops) return;
    const now = performance.now();
    if (instant || !plans.current.length) {
      plans.current = Array.from({ length: cfg.reels }, () => ({ start: now, stopAt: now - 1e6, rest: 0, turbo }));
      paint(now);
      return;
    }
    plans.current = plans.current.map((p, r) => {
      // Never start stopping before the reel has reached cruise speed.
      // The stop timing follows the turbo setting the spin started with.
      const k = p.turbo ? 'turbo' : 'normal';
      const m = reelMotion(p.turbo);
      const delay = reelStops(board, p.turbo).delays[r];
      const stopAt = Math.max(now + m.baseMs + delay, p.start + (KICK[k].t + ACCEL_S[k]) * 1000);
      return { ...p, stopAt, rest: cruise(p, stopAt) + m.stopCells };
    });
    run();
  }, [spinning, spinId]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div className={`reels ${spinning ? 'is-spinning' : ''}`} data-testid="reels" role="grid" aria-label="Reels">
      {Array.from({ length: cfg.reels }, (_, r) => (
        <div
          className={`reel ${stops?.tease[r] ? 'tease' : ''}`}
          key={r}
          ref={(el) => (reelRefs.current[r] = el)}
          role="row"
          style={{ '--stop': `${stops ? motion.baseMs + stops.delays[r] + motion.hitMs : 0}ms` } as CSSProperties}
        >
          <div className="reel-strip" aria-hidden="true">
            {stripFor(r).map((s, i) => (
              <div className="strip-cell" key={i}><SymbolArt s={s} /></div>
            ))}
          </div>
          <div className="reel-old" aria-hidden="true">
            {oldBoard.current.board[r].map((c, row) => (
              <div className={`cell kind-${cfg.symbols[c.s].kind} tile-${c.s.toLowerCase()}`} key={row}><SymbolArt s={c.s} m={c.m} /></div>
            ))}
          </div>
          <div className="reel-cells" role="presentation">
            {Array.from({ length: cfg.rows }, (_, row) => {
              const c = board[r][row];
              const key = `${r},${row}`;
              const sticky = bonus?.sticky?.[r][row];
              const cls = [
                'cell',
                `kind-${cfg.symbols[c.s].kind}`,
                `tile-${c.s.toLowerCase()}`,
                winCells.has(key) ? 'win' : '',
                hasWin && !winCells.has(key) ? 'dim' : '',
                sticky ? 'sticky' : '',
                c.s === 'STATIC' && unrevealed ? 'static' : '',
              ].join(' ');
              return (
                <div className={cls} key={row} role="gridcell">
                  <SymbolArt s={c.s} m={c.m} />
                </div>
              );
            })}
          </div>
          {/* Re-keyed per spin so the stop flash and tease glow restart. */}
          {stops ? <i className="reel-flash" key={`f${spinId}`} aria-hidden="true" /> : null}
          {stops?.tease[r] ? <i className="reel-tease" key={`t${spinId}`} aria-hidden="true" /> : null}
        </div>
      ))}
      {view.spinWinX100 > 0 ? (
        <div className={`win-pop ${view.spinWinX100 >= 2000 ? 'big' : ''}`} key={`win-${spinId}`} aria-hidden="true">
          {formatX(view.spinWinX100)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The channel strip on the bezel under the screen: CH1–CH6, one LED per reel. Each LED blinks as
 * its reel stops (same timing as the reel) and stays lit while that reel is part of a win.
 */
export function ChannelStrip({ cfg, view, turbo }: { cfg: GameConfig; view: View; turbo: boolean }) {
  const { spinning, spinId, winCells } = view;
  const board = view.board ?? idle;
  const stops = spinning || spinId === 0 ? null : reelStops(board, turbo);
  const motion = reelMotion(turbo);
  const winReels = new Set([...winCells].map((k) => Number(k.split(',')[0])));
  return (
    <div className="channels" aria-hidden="true">
      {Array.from({ length: cfg.reels }, (_, r) => (
        <div className={`channel ${winReels.has(r) ? 'on' : ''} ${stops?.tease[r] ? 'tease' : ''}`} key={r}>
          <i
            className="led"
            key={`${spinId}`}
            style={{ '--stop': `${stops ? motion.baseMs + stops.delays[r] + motion.hitMs : 0}ms` } as CSSProperties}
          />
          <span>CH{r + 1}</span>
        </div>
      ))}
    </div>
  );
}
