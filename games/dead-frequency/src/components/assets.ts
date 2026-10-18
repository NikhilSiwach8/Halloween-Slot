import type { SymbolId } from '../config/types';

/**
 * Symbol artwork: 512×512 transparent WebP, cut from the symbol sheet with
 * scripts/art/slice_symbol_sheet.py. A symbol without an entry, or whose image fails to load,
 * falls back to the built-in SVG in SymbolArt.tsx.
 */
const file = (name: string) => `${import.meta.env.BASE_URL}assets/symbols/${name}.webp`;

export const SYMBOL_IMAGES: Partial<Record<SymbolId, string>> = {
  VALVE: file('valve'),
  CASSETTE: file('cassette'),
  MIC: file('mic'),
  HEADPHONES: file('headphones'),
  RADIO: file('radio'),
  // WIDOW: file('widow'),  <- add once the Widow artwork is in public/assets/symbols/widow.webp.
  //                          Until then the built-in SVG is used.
  PRIEST: file('priest'),
  HOST: file('host'),
  WILD: file('wild'),
  STATIC: file('static'),
  ANTENNA: file('antenna'),
  TAPE: file('tape'),
};

/** Starts downloading every symbol image so the first spin doesn't pop in. */
export function preloadSymbolImages() {
  for (const src of Object.values(SYMBOL_IMAGES)) {
    const img = new Image();
    img.src = src;
  }
}
