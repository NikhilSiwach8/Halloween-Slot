import type { CSSProperties } from 'react';
import type { GameConfig } from '../../config/types';
import type { BoardSnapshot } from '../../engine/board/board';
import type { DisplayState } from '../../app/presentation';
import { formatCredits } from '../../utils/format';
import { SymbolTile } from '../Symbol/SymbolTile';
import { SYMBOLS } from '../../config/symbols';

function MiniBoard({ board, selected, cols, title, variant }: { board: BoardSnapshot; selected: number[]; cols: number; title: string; variant: 'present' | 'hollow' }) {
  return (
    <div className={`timeline timeline-${variant}`}>
      <div className="timeline-title">{title}</div>
      <div className="mini-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {board.map((c, i) => (
          <div key={i} className={`mini-cell${selected.includes(i) ? ' selected' : ''}`}>
            {c && <SymbolTile sym={c.sym} age={c.age} frozen={c.frozen} uid={c.uid * 10 + (variant === 'hollow' ? 1 : 2)} small />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameBoard({ display, cfg }: { display: DisplayState; cfg: GameConfig }) {
  const { cols, rows } = cfg.grid;
  const { board, marks } = display;
  const style = { '--cols': cols, '--rows': rows } as CSSProperties;
  return (
    <div className={`board-wrap mode-${display.mode.toLowerCase()}${display.split ? ' splitting' : ''}${display.attract ? ' attract' : ''}`} data-testid="board" data-phase={display.uiPhase}>
      <div className="board" style={style} role="grid" aria-label="5 by 5 symbol grid" aria-rowcount={rows} aria-colcount={cols}>
        {/* static slots (removal bursts + mark rings) */}
        {Array.from({ length: cols * rows }, (_, i) => (
          <div
            key={`slot-${i}`}
            className={`slot${marks[i] ? ` mark-${marks[i]}` : ''}${board[i] === null ? ' empty' : ''}`}
            style={{ left: `${(i % cols) * (100 / cols)}%`, top: `${Math.floor(i / cols) * (100 / rows)}%` }}
            data-testid={`cell-${i}`}
            data-sym={display.attract ? '' : board[i]?.sym ?? ''}
            data-age={display.attract ? '' : board[i]?.age ?? ''}
          />
        ))}
        {/* moving symbols keyed by uid so gravity animates position changes */}
        {board.map((c, i) =>
          c ? (
            <div
              key={c.uid}
              className={`cell${marks[i] ? ` mark-${marks[i]}` : ''}`}
              style={{ left: `${(i % cols) * (100 / cols)}%`, top: `${Math.floor(i / cols) * (100 / rows)}%` }}
            >
              <SymbolTile sym={c.sym} age={c.age} frozen={c.frozen} uid={c.uid} />
            </div>
          ) : null,
        )}
        {display.attract && <div className="attract-label">Press Spin to enter the Hollow Hour</div>}
        {display.echoFlash && (
          <div
            key={display.echoFlash.key}
            className="echo-ghost"
            style={{ left: `${(display.echoFlash.position % cols) * (100 / cols)}%`, top: `${Math.floor(display.echoFlash.position / cols) * (100 / rows)}%` }}
            aria-hidden="true"
          >
            <SymbolTile sym={display.echoFlash.entry.symbol} age={display.echoFlash.entry.age} uid={-display.echoFlash.key} />
          </div>
        )}
        {display.floatWin && display.floatWin.amount > 0 && (
          <div
            key={display.floatWin.key}
            className="float-win"
            style={{ left: `${(display.floatWin.at % cols) * (100 / cols) + 50 / cols}%`, top: `${Math.floor(display.floatWin.at / cols) * (100 / rows) + 50 / rows}%` }}
          >
            +{formatCredits(display.floatWin.amount, cfg)}
          </div>
        )}
      </div>
      {display.split && (
        <div className={`split-overlay${display.split.merged ? ' merged' : ''}`} data-testid="paradox-split" aria-live="polite">
          <MiniBoard board={display.split.present} selected={display.split.selected} cols={cols} title="Timeline A — The Present" variant="present" />
          <div className="split-seam" aria-hidden="true" />
          <MiniBoard board={display.split.hollow} selected={display.split.selected} cols={cols} title="Timeline B — The Hollow" variant="hollow" />
          <div className="split-caption">
            {display.split.merged
              ? `Merged: ${display.split.selected.length} highlighted cells took their Hollow state`
              : 'Highlighted cells will cross over from the Hollow'}
          </div>
        </div>
      )}
      {display.echoFlash && (
        <div key={`ecap-${display.echoFlash.key}`} className="echo-caption" aria-live="polite">
          Echo {display.echoFlash.entry.id} · {SYMBOLS[display.echoFlash.entry.symbol].name} from {display.echoFlash.entry.roundId} · consumed
        </div>
      )}
    </div>
  );
}
