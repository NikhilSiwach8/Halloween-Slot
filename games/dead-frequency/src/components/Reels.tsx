import type { GameConfig } from '../config/types';
import type { View } from '../app/useGame';
import { SymbolArt } from './SymbolArt';

export function Reels({ cfg, view }: { cfg: GameConfig; view: View }) {
  const { board, spinning, unrevealed, winCells, bonus } = view;
  const hasWin = winCells.size > 0;
  return (
    <div className={`reels ${spinning ? 'spinning' : ''}`} data-testid="reels" role="grid" aria-label="Reels">
      {Array.from({ length: cfg.reels }, (_, r) => (
        <div className="reel" key={r} role="row">
          {Array.from({ length: cfg.rows }, (_, row) => {
            const c = board?.[r][row];
            const key = `${r},${row}`;
            const sticky = bonus?.sticky?.[r][row];
            const cls = [
              'cell',
              c && winCells.has(key) ? 'win' : '',
              hasWin && !winCells.has(key) ? 'dim' : '',
              sticky ? 'sticky' : '',
              c?.s === 'STATIC' && unrevealed ? 'static' : '',
            ].join(' ');
            return (
              <div className={cls} key={row} role="gridcell" style={{ animationDelay: `${r * 45}ms` }}>
                {c ? <SymbolArt s={c.s} m={c.m} /> : <div className="cell-empty" />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
