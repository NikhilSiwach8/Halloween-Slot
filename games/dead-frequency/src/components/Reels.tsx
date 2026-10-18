import type { CSSProperties } from 'react';
import type { GameConfig, SymbolId } from '../config/types';
import type { Board } from '../engine/board';
import { REEL_STAGGER, TURBO_FACTOR, type View } from '../app/useGame';
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

export function Reels({ cfg, view, turbo }: { cfg: GameConfig; view: View; turbo: boolean }) {
  const { spinning, unrevealed, winCells, bonus, spinId } = view;
  const board = view.board ?? idle;
  const hasWin = winCells.size > 0;
  const phase = spinning ? 'is-spinning' : spinId > 0 ? 'is-landing' : 'is-idle';
  const style = { '--stagger': `${REEL_STAGGER * (turbo ? TURBO_FACTOR : 1)}ms` } as CSSProperties;
  return (
    <div className={`reels ${phase}`} data-testid="reels" role="grid" aria-label="Reels" style={style}>
      {Array.from({ length: cfg.reels }, (_, r) => (
        // Re-keyed every spin so the spin and landing animations restart.
        <div className="reel" key={`${spinId}-${r}`} role="row" style={{ '--r': r } as CSSProperties}>
          <div className="reel-strip" aria-hidden="true">
            {[...stripFor(r), ...stripFor(r)].map((s, i) => (
              <div className="strip-cell" key={i}><SymbolArt s={s} /></div>
            ))}
          </div>
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
      ))}
      {view.spinWinX100 > 0 ? (
        <div className={`win-pop ${view.spinWinX100 >= 2000 ? 'big' : ''}`} key={`win-${spinId}`} aria-hidden="true">
          {formatX(view.spinWinX100)}
        </div>
      ) : null}
    </div>
  );
}
