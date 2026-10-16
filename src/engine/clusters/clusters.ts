import { PAYING_SYMBOLS } from '../../config/symbols';
import type { GameConfig, PayingSymbolId } from '../../config/types';
import { neighbors, type Board } from '../board/board';

export interface Cluster {
  symbol: PayingSymbolId;
  /** All positions in the cluster (real symbols + wilds), ascending. */
  positions: number[];
  /** Positions holding the real paying symbol (not wilds), ascending. */
  symbolPositions: number[];
  wildPositions: number[];
}

/**
 * Deterministic cluster detection (breadth-first flood fill).
 *
 * Rules (see docs/GAME_RULES.md §Clusters):
 *  - Orthogonal adjacency only.
 *  - For each paying symbol S, in PAYING_SYMBOLS order (highest first), flood
 *    fill across cells that are S or WILD, seeding only from unvisited S cells.
 *  - A component pays if it has >= minSize cells and at least one real S.
 *    Wild-only groups never pay (config.clusters.wildOnlyPays is false; if it is
 *    set true the engine rejects the config at evaluation time — not supported).
 *  - Wilds may belong to clusters of several different symbols at once; each
 *    such cluster pays independently. Within one symbol, components are disjoint.
 *  - Tickets and the Clockmaker never participate.
 */
export function findClusters(board: Board, cfg: GameConfig): Cluster[] {
  if (cfg.clusters.wildOnlyPays) throw new Error('wildOnlyPays=true is not supported by this evaluator');
  const out: Cluster[] = [];
  const n = board.cells.length;
  for (const sym of PAYING_SYMBOLS) {
    const visited = new Uint8Array(n);
    for (let start = 0; start < n; start++) {
      if (visited[start] || board.cells[start]?.sym !== sym) continue;
      const comp: number[] = [];
      const queue = [start];
      visited[start] = 1;
      while (queue.length) {
        const cur = queue.shift()!;
        comp.push(cur);
        for (const nb of neighbors(board, cur)) {
          if (visited[nb]) continue;
          const cell = board.cells[nb];
          if (!cell) continue;
          const matches = cell.sym === sym || (cfg.clusters.wildsSubstitute && cell.sym === 'WILD');
          if (!matches) continue;
          // A wild only bridges further when wildsConnect; otherwise it is a leaf.
          visited[nb] = 1;
          if (cell.sym === 'WILD' && !cfg.clusters.wildsConnect) {
            comp.push(nb);
            continue;
          }
          queue.push(nb);
        }
      }
      // wilds are re-usable by other components of the same symbol only if not connected; reset wild visits
      // so a wild touching two separate S-groups (when wildsConnect=false) can join both.
      if (!cfg.clusters.wildsConnect) for (const p of comp) if (board.cells[p]!.sym === 'WILD') visited[p] = 0;
      if (comp.length < cfg.clusters.minSize) continue;
      comp.sort((a, b) => a - b);
      const symbolPositions = comp.filter((p) => board.cells[p]!.sym === sym);
      if (!symbolPositions.length) continue;
      out.push({ symbol: sym, positions: comp, symbolPositions, wildPositions: comp.filter((p) => board.cells[p]!.sym === 'WILD') });
    }
  }
  return out;
}
