import type { CSSProperties } from 'react';
import type { GameConfig, SymbolId } from '../config/types';
import type { Board } from '../engine/board';
import { reelStops, type View } from '../app/useGame';
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
const stripFor = (r: number) => [...STRIP.slice(r % STRIP.length), ...STRIP.slice(0, r % STRIP.length)];

const idle: Board = IDLE_BOARD.map((reel) => reel.map((s) => ({ s, m: 1 })));

/**
 * Each reel is a window onto a moving column. On SPIN the shown symbols kick up and drop out of
 * the bottom while a blurred strip scrolls down behind them. When the result arrives, each reel
 * keeps scrolling until its stop time, then its four new symbols drop in from above and bounce
 * to rest. A reel that could still complete a bonus spins on longer and glows (the tease).
 */
export function Reels({ cfg, view, turbo }: { cfg: GameConfig; view: View; turbo: boolean }) {
  const { spinning, unrevealed, winCells, bonus, spinId } = view;
  const board = view.board ?? idle;
  const hasWin = winCells.size > 0;
  const phase = spinning ? 'is-spinning' : spinId > 0 ? 'is-landing' : 'is-idle';
  const stops = spinning || spinId === 0 ? null : reelStops(board, turbo);
  return (
    <div className={`reels ${phase} ${turbo ? 'turbo' : ''}`} data-testid="reels" role="grid" aria-label="Reels">
      {Array.from({ length: cfg.reels }, (_, r) => (
        // Re-keyed every spin so the spin and landing animations restart.
        <div
          className={`reel ${stops?.tease[r] ? 'tease' : ''}`}
          key={`${spinId}-${r}`}
          role="row"
          style={{ '--r': r, '--stop': `${stops?.delays[r] ?? 0}ms` } as CSSProperties}
        >
          <div className="reel-strip" aria-hidden="true">
            {[...stripFor(r), ...stripFor(r)].map((s, i) => (
              <div className="strip-cell" key={i}><SymbolArt s={s} /></div>
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
                <div className={cls} key={row} role="gridcell" style={{ '--row': row } as CSSProperties}>
                  <SymbolArt s={c.s} m={c.m} />
                </div>
              );
            })}
          </div>
          <i className="reel-flash" aria-hidden="true" />
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
