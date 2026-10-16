import type { SymbolId } from '../config/types';

/**
 * Replaceable art. Map a symbol to a file in public/assets/symbols/ (e.g. 'symbols/raven.webp')
 * to use raster art instead of the built-in SVG placeholder. Paths are relative to public/assets/.
 * Leave an entry null to keep the SVG. The engine never reads this file.
 *
 * Asset spec for final art: 512x512 transparent PNG/WebP, subject centred inside a
 * 420px safe area, readable silhouette at 48px, no baked-in frame (the UI draws the
 * frame and the Age treatment on top).
 */
export const SYMBOL_IMAGES: Record<SymbolId, string | null> = {
  L_COG: null, L_KEY: null, L_MOON: null, L_CANDLE: null,
  WATCH: null, ORB: null, PORTAL: null, HOURGLASS: null, RAVEN: null, SKULL: null,
  WILD: null, TICKET: null, CLOCKMAKER: null,
};

/** Optional background plate (public/assets/backgrounds/...). null = procedural 3D clocktower. */
export const BACKGROUND_IMAGE: string | null = null;

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}
