import type { SymbolDef, SymbolId } from './types';

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  VALVE: { id: 'VALVE', name: 'Valve', kind: 'low', rank: 1, description: 'A cracked vacuum tube, still faintly glowing.' },
  CASSETTE: { id: 'CASSETTE', name: 'Cassette', kind: 'low', rank: 2, description: 'A recording nobody remembers making.' },
  MIC: { id: 'MIC', name: 'Microphone', kind: 'low', rank: 3, description: 'It picks up voices when the studio is empty.' },
  HEADPHONES: { id: 'HEADPHONES', name: 'Headphones', kind: 'low', rank: 4, description: 'Whispering, even unplugged.' },
  RADIO: { id: 'RADIO', name: 'Old Radio', kind: 'high', rank: 5, description: 'Tuned to a station that went off air in 1979.' },
  WIDOW: { id: 'WIDOW', name: 'The Widow', kind: 'high', rank: 6, description: 'She calls in every night at 3:33, asking for a song her husband requested in 1979.' },
  PRIEST: { id: 'PRIEST', name: 'The Priest', kind: 'high', rank: 7, description: 'He came to bless the transmitter. He never left.' },
  HOST: { id: 'HOST', name: 'The Night Host', kind: 'high', rank: 8, description: 'Your host until dawn. Highest paying symbol.' },
  WILD: { id: 'WILD', name: 'On Air', kind: 'wild', rank: 9, description: 'Substitutes for every paying symbol on reels 2–6. Can carry a multiplier.' },
  STATIC: { id: 'STATIC', name: 'Static', kind: 'mystery', rank: 10, description: 'Lands in stacks. Every Static reveals as the same symbol.' },
  ANTENNA: { id: 'ANTENNA', name: 'Antenna', kind: 'scatter', rank: 11, description: '3, 4 or 5+ Antennas start Night Shift, Possession or Dead Air.' },
  TAPE: { id: 'TAPE', name: 'Unmarked Tape', kind: 'bonus', rank: 12, description: 'Reel 6 only. Plays the Mystery Bonus.' },
};

export const PAYING_SYMBOLS = ['VALVE', 'CASSETTE', 'MIC', 'HEADPHONES', 'RADIO', 'WIDOW', 'PRIEST', 'HOST'] as const;
