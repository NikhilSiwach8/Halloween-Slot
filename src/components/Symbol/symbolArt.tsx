import type { ReactElement } from 'react';
import type { SymbolId } from '../../config/types';

/**
 * Original placeholder artwork for every symbol (inline SVG, viewBox 0 0 100 100).
 * Each symbol has a distinct silhouette so it reads at small sizes and without color.
 * Final raster art can replace any entry via src/rendering/assetManifest.ts without
 * touching the engine.
 */
const G = {
  gold: '#C9A45E', brass: '#E8CB8C', emerald: '#36D9A0', violet: '#8C48E8', blue: '#5C9EFF',
  silver: '#BBC7D6', ivory: '#F2E8D7', crimson: '#A94458', obsidian: '#0B0D14', navy: '#151A2B',
};

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-brass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={G.brass} />
        <stop offset="55%" stopColor={G.gold} />
        <stop offset="100%" stopColor="#7a5f2c" />
      </linearGradient>
      <radialGradient id={`${id}-orb`} cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#bff7e4" />
        <stop offset="40%" stopColor={G.emerald} />
        <stop offset="100%" stopColor="#123d63" />
      </radialGradient>
      <radialGradient id={`${id}-void`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#020205" />
        <stop offset="70%" stopColor="#2a1450" />
        <stop offset="100%" stopColor={G.violet} />
      </radialGradient>
    </defs>
  );
}

const gearPath = (cx: number, cy: number, r: number, teeth: number, depth: number) => {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (Math.PI * i) / teeth;
    const rr = i % 2 === 0 ? r : r - depth;
    const a1 = a - Math.PI / teeth / 2.2;
    const a2 = a + Math.PI / teeth / 2.2;
    pts.push(`${cx + rr * Math.cos(a1)},${cy + rr * Math.sin(a1)}`, `${cx + rr * Math.cos(a2)},${cy + rr * Math.sin(a2)}`);
  }
  return `M${pts.join('L')}Z`;
};

const ART: Record<SymbolId, (id: string) => ReactElement> = {
  L_COG: (id) => (
    <g>
      <path d={gearPath(50, 50, 36, 10, 8)} fill={`url(#${id}-brass)`} stroke="#5b4520" strokeWidth="2" />
      <circle cx="50" cy="50" r="17" fill={G.navy} stroke={G.brass} strokeWidth="3" />
      <path d="M50 37 L54 50 L50 63 L46 50Z" fill={G.brass} />
    </g>
  ),
  L_KEY: (id) => (
    <g transform="rotate(-35 50 50)">
      <path d="M50 12 C66 12 72 30 50 38 C28 30 34 12 50 12Z M50 20 C56 20 58 28 50 31 C42 28 44 20 50 20Z" fill={`url(#${id}-brass)`} fillRule="evenodd" stroke="#5b4520" strokeWidth="1.5" />
      <rect x="46" y="36" width="8" height="44" rx="3" fill={G.brass} stroke="#5b4520" strokeWidth="1.5" />
      <path d="M54 66 h14 v6 h-6 v6 h-8Z M54 54 h10 v6 h-10Z" fill={G.gold} stroke="#5b4520" strokeWidth="1.5" />
    </g>
  ),
  L_MOON: () => (
    <g>
      <circle cx="50" cy="50" r="36" fill={G.navy} stroke={G.silver} strokeWidth="4" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="49" y="16" width="2" height="6" fill={G.silver} transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <path d="M58 26 A25 25 0 1 0 58 74 A19 19 0 1 1 58 26Z" fill={G.silver} />
      <circle cx="64" cy="40" r="2.5" fill={G.ivory} />
    </g>
  ),
  L_CANDLE: () => (
    <g>
      <path d="M50 10 C60 24 58 32 50 36 C42 32 40 24 50 10Z" fill="#ffcf7a" stroke={G.crimson} strokeWidth="1.5" />
      <path d="M50 18 C54 26 53 30 50 32 C47 30 46 26 50 18Z" fill={G.ivory} />
      <rect x="36" y="38" width="28" height="46" rx="4" fill={G.ivory} stroke={G.crimson} strokeWidth="2.5" />
      <path d="M38 44 Q44 52 40 60 M62 46 Q56 54 60 66" stroke={G.crimson} strokeWidth="2" fill="none" />
      <rect x="28" y="82" width="44" height="8" rx="3" fill={G.crimson} />
    </g>
  ),
  WATCH: (id) => (
    <g>
      <circle cx="50" cy="15" r="7" fill="none" stroke={G.gold} strokeWidth="4" />
      <rect x="45" y="20" width="10" height="8" rx="2" fill={G.gold} />
      <circle cx="50" cy="58" r="34" fill={`url(#${id}-brass)`} stroke="#5b4520" strokeWidth="2" />
      <circle cx="50" cy="58" r="27" fill="#1d2133" stroke="#3a3f57" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={50 + 22 * Math.sin((i * Math.PI) / 6)} cy={58 - 22 * Math.cos((i * Math.PI) / 6)} r="1.6" fill={G.brass} />
      ))}
      <path d="M50 58 L50 40 M50 58 L63 64" stroke={G.ivory} strokeWidth="3" strokeLinecap="round" />
      <path d="M30 40 L42 52 L38 60 L52 74 L48 86" stroke={G.ivory} strokeWidth="1.8" fill="none" opacity="0.9" />
    </g>
  ),
  ORB: (id) => (
    <g>
      <ellipse cx="50" cy="86" rx="22" ry="5" fill="#000" opacity="0.4" />
      <circle cx="50" cy="48" r="34" fill={`url(#${id}-orb)`} stroke={G.blue} strokeWidth="2.5" />
      <circle cx="50" cy="48" r="18" fill="none" stroke={G.ivory} strokeWidth="1.5" opacity="0.8" />
      <path d="M50 48 L50 35 M50 48 L59 52" stroke={G.ivory} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="50" cy="48" rx="44" ry="10" fill="none" stroke={G.emerald} strokeWidth="1.5" opacity="0.7" transform="rotate(-18 50 48)" />
      <circle cx="38" cy="34" r="6" fill="#fff" opacity="0.35" />
    </g>
  ),
  PORTAL: (id) => (
    <g>
      <circle cx="50" cy="50" r="38" fill={`url(#${id}-void)`} />
      <path d="M50 12 A38 38 0 0 1 86 40 L78 42 A30 30 0 0 0 50 20Z M88 56 A38 38 0 0 1 56 88 L54 80 A30 30 0 0 0 80 54Z M44 88 A38 38 0 0 1 12 56 L20 54 A30 30 0 0 0 46 80Z M12 42 A38 38 0 0 1 40 12 L42 20 A30 30 0 0 0 20 44Z" fill={`url(#${id}-brass)`} />
      <path d="M50 50 m-16 0 a16 16 0 1 0 32 0 a10 10 0 1 0 -20 0 a5 5 0 1 0 10 0" fill="none" stroke="#d6b8ff" strokeWidth="2.5" />
    </g>
  ),
  HOURGLASS: (id) => (
    <g>
      <rect x="22" y="10" width="56" height="8" rx="3" fill={`url(#${id}-brass)`} />
      <rect x="22" y="82" width="56" height="8" rx="3" fill={`url(#${id}-brass)`} />
      <rect x="25" y="18" width="5" height="64" fill={G.gold} />
      <rect x="70" y="18" width="5" height="64" fill={G.gold} />
      <path d="M33 20 H67 C67 38 54 44 52 50 C54 56 67 62 67 80 H33 C33 62 46 56 48 50 C46 44 33 38 33 20Z" fill="#cfe9ff" fillOpacity="0.18" stroke={G.silver} strokeWidth="2" />
      <path d="M38 26 H62 C60 36 52 42 50 47 C48 42 40 36 38 26Z" fill={G.emerald} />
      <path d="M50 50 L50 72" stroke={G.emerald} strokeWidth="2" />
      <path d="M36 78 C42 68 58 68 64 78Z" fill={G.emerald} />
    </g>
  ),
  RAVEN: () => (
    <g>
      <path d="M18 70 C26 46 46 34 62 34 C66 24 74 20 82 24 L92 26 L82 30 C80 40 74 46 70 50 C76 58 78 68 74 80 C66 70 58 70 50 74 L44 88 L40 76 L30 86 L32 74 C26 74 22 72 18 70Z" fill="#454c5e" stroke={G.silver} strokeWidth="2" />
      <path d="M30 64 C40 52 52 48 64 50 C56 56 46 62 30 64Z" fill={G.violet} opacity="0.8" />
      <path d="M36 70 C46 62 56 60 66 62" stroke={G.silver} strokeWidth="1.5" fill="none" />
      <circle cx="76" cy="28" r="2.6" fill={G.emerald} />
    </g>
  ),
  SKULL: () => (
    <g>
      <path d="M50 10 C74 10 86 28 84 48 C83 58 78 62 74 66 L74 80 C74 86 68 90 60 90 H40 C32 90 26 86 26 80 L26 66 C22 62 17 58 16 48 C14 28 26 10 50 10Z" fill={G.ivory} stroke={G.silver} strokeWidth="2" />
      <path d="M30 46 C30 38 40 36 44 44 C46 52 38 58 32 54 C30 52 30 50 30 46Z M70 46 C70 38 60 36 56 44 C54 52 62 58 68 54 C70 52 70 50 70 46Z" fill={G.obsidian} />
      <circle cx="37" cy="47" r="3" fill={G.emerald} />
      <circle cx="63" cy="47" r="3" fill={G.emerald} />
      <path d="M50 56 L45 66 H55Z" fill={G.obsidian} />
      <path d="M38 74 V88 M46 74 V90 M54 74 V90 M62 74 V88" stroke="#8d8577" strokeWidth="2" />
      <path d="M40 16 C46 22 44 28 50 32" stroke={G.silver} strokeWidth="1.5" fill="none" />
    </g>
  ),
  WILD: (id) => (
    <g>
      <circle cx="50" cy="44" r="34" fill={`url(#${id}-brass)`} stroke={G.emerald} strokeWidth="3" />
      <circle cx="50" cy="44" r="26" fill="#0f2a24" />
      <path d="M50 44 L50 24 M50 44 L64 50" stroke={G.emerald} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M22 26 L38 40 L32 48 L46 60 M74 22 L62 36 L70 42" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.9" />
      <rect x="18" y="72" width="64" height="20" rx="4" fill={G.obsidian} stroke={G.gold} strokeWidth="2" />
      <text x="50" y="87" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight="700" fontSize="15" fill={G.emerald} letterSpacing="2">WILD</text>
    </g>
  ),
  TICKET: () => (
    <g>
      <path d="M12 26 H88 V40 A10 10 0 0 0 88 60 V74 H12 V60 A10 10 0 0 0 12 40Z" fill={G.crimson} stroke={G.gold} strokeWidth="2.5" />
      <path d="M18 31 H82 V70 H18Z" fill="none" stroke={G.gold} strokeWidth="1" strokeDasharray="3 2" />
      {/* fictional insignia: an eye set inside a broken hourglass */}
      <path d="M38 36 H62 L52 50 L62 64 H38 L48 50Z" fill={G.obsidian} stroke={G.gold} strokeWidth="2" />
      <ellipse cx="50" cy="50" rx="9" ry="5" fill={G.ivory} />
      <circle cx="50" cy="50" r="3" fill={G.obsidian} />
      <path d="M58 38 L54 46" stroke={G.ivory} strokeWidth="1.5" />
      <text x="50" y="84" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontSize="9" fill={G.brass} letterSpacing="2">VOID</text>
    </g>
  ),
  CLOCKMAKER: (id) => (
    <g>
      {/* gear mantle */}
      <path d={gearPath(50, 46, 30, 12, 5)} fill="#3a2f1a" stroke={G.gold} strokeWidth="1.5" />
      {/* coat */}
      <path d="M30 92 L38 50 C42 44 58 44 62 50 L70 92Z" fill="#141826" stroke={G.gold} strokeWidth="2" />
      <path d="M50 52 V92" stroke={G.gold} strokeWidth="1.5" />
      {/* tall hat */}
      <rect x="38" y="6" width="24" height="18" rx="2" fill="#141826" stroke={G.gold} strokeWidth="1.5" />
      <rect x="32" y="22" width="36" height="4" rx="2" fill="#141826" stroke={G.gold} strokeWidth="1.5" />
      {/* faceless brass mask */}
      <ellipse cx="50" cy="37" rx="11" ry="12" fill={`url(#${id}-brass)`} stroke="#5b4520" strokeWidth="1.5" />
      <circle cx="50" cy="37" r="5" fill="none" stroke="#5b4520" strokeWidth="1.2" />
      <path d="M50 37 L50 33 M50 37 L53 38" stroke="#5b4520" strokeWidth="1.2" />
    </g>
  ),
};

export function SymbolArt({ sym, idSuffix }: { sym: SymbolId; idSuffix: string }) {
  const id = `s-${sym}-${idSuffix}`;
  return (
    <svg viewBox="0 0 100 100" className="symbol-art" aria-hidden="true">
      <Defs id={id} />
      {ART[sym](id)}
      <circle cx="50" cy="45" r="44" fill={`url(#${id}-glow)`} pointerEvents="none" />
    </svg>
  );
}
