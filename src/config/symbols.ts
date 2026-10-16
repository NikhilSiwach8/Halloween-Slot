import type { PayingSymbolId, SymbolDef, SymbolId } from './types';

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  L_COG: { id: 'L_COG', name: 'Brass Cog', kind: 'low', ageable: true, rank: 1, description: 'A tarnished escapement cog token.' },
  L_KEY: { id: 'L_KEY', name: 'Winding Key', kind: 'low', ageable: true, rank: 2, description: 'A carved winding-key sigil.' },
  L_MOON: { id: 'L_MOON', name: 'Moon Dial', kind: 'low', ageable: true, rank: 3, description: 'A crescent moon-phase dial.' },
  L_CANDLE: { id: 'L_CANDLE', name: 'Vigil Candle', kind: 'low', ageable: true, rank: 4, description: 'A candle sigil that burns backwards.' },
  WATCH: { id: 'WATCH', name: 'Broken Watch', kind: 'standard', ageable: true, rank: 5, description: 'A cracked antique pocket watch.' },
  ORB: { id: 'ORB', name: 'Chrono Orb', kind: 'standard', ageable: true, rank: 6, description: 'Winning Orb clusters burst, advancing extra cells one Age.' },
  PORTAL: { id: 'PORTAL', name: 'Time Portal', kind: 'standard', ageable: true, rank: 7, description: 'Winning Portal clusters open a Paradox Split.' },
  HOURGLASS: { id: 'HOURGLASS', name: 'Hourglass', kind: 'standard', ageable: true, rank: 8, description: 'Winning Hourglass clusters project an Echo from the ledger.' },
  RAVEN: { id: 'RAVEN', name: 'Raven', kind: 'premium', ageable: true, rank: 9, description: 'A spectral raven with metallic feathers.' },
  SKULL: { id: 'SKULL', name: 'Revenant Skull', kind: 'premium', ageable: true, rank: 10, description: 'A gothic skull lit from within.' },
  WILD: { id: 'WILD', name: 'Chrono Wild', kind: 'wild', ageable: false, rank: 11, description: 'Substitutes for every paying symbol. Wild-only clusters do not pay.' },
  TICKET: { id: 'TICKET', name: 'Void Ticket', kind: 'scatter', ageable: false, rank: 12, description: '3 or more on the initial board start The Last Second. Never pays, never clusters.' },
  CLOCKMAKER: { id: 'CLOCKMAKER', name: 'The Clockmaker', kind: 'special', ageable: false, rank: 13, description: 'On the initial board: Clockmaker’s Choice, then becomes a Chrono Wild.' },
};

/** Paying symbols in evaluation order (highest rank first). */
export const PAYING_SYMBOLS: PayingSymbolId[] = [
  'SKULL', 'RAVEN', 'HOURGLASS', 'PORTAL', 'ORB', 'WATCH', 'L_CANDLE', 'L_MOON', 'L_KEY', 'L_COG',
];

export const ALL_SYMBOLS = Object.keys(SYMBOLS) as SymbolId[];

export function isPaying(sym: SymbolId): sym is PayingSymbolId {
  return SYMBOLS[sym].ageable;
}
