import type { ReactElement } from 'react';
import type { SymbolId } from '../config/types';

/** Placeholder symbol art: hand-built SVG, viewBox 0 0 100 100. */
const ART: Record<SymbolId, ReactElement> = {
  VALVE: (
    <g>
      <path d="M34 30 Q34 14 50 14 Q66 14 66 30 L66 66 L34 66 Z" fill="#1d2a2a" stroke="#7fd1c0" strokeWidth="3" />
      <path d="M42 34 L50 54 L58 34" fill="none" stroke="#ffb35c" strokeWidth="3" />
      <circle cx="50" cy="56" r="5" fill="#ff8a3d" opacity="0.8" />
      <rect x="30" y="66" width="40" height="12" rx="3" fill="#3b3f46" stroke="#9aa3ad" strokeWidth="2" />
      <path d="M38 78 v8 M46 78 v8 M54 78 v8 M62 78 v8" stroke="#9aa3ad" strokeWidth="3" />
    </g>
  ),
  CASSETTE: (
    <g>
      <rect x="12" y="26" width="76" height="50" rx="6" fill="#2b2533" stroke="#c6a6ff" strokeWidth="3" />
      <rect x="22" y="34" width="56" height="20" rx="3" fill="#e9dcc4" />
      <circle cx="36" cy="44" r="6" fill="#2b2533" />
      <circle cx="64" cy="44" r="6" fill="#2b2533" />
      <path d="M30 68 L36 60 L64 60 L70 68 Z" fill="#14111a" />
      <path d="M24 38 h10" stroke="#a94458" strokeWidth="2" />
    </g>
  ),
  MIC: (
    <g>
      <rect x="36" y="12" width="28" height="44" rx="14" fill="#30343c" stroke="#d7dde6" strokeWidth="3" />
      <path d="M38 24 h24 M38 32 h24 M38 40 h24" stroke="#8a929c" strokeWidth="2" />
      <path d="M28 46 Q28 68 50 68 Q72 68 72 46" fill="none" stroke="#d7dde6" strokeWidth="3" />
      <path d="M50 68 V84 M36 86 h28" stroke="#d7dde6" strokeWidth="4" />
    </g>
  ),
  HEADPHONES: (
    <g>
      <path d="M20 58 Q20 18 50 18 Q80 18 80 58" fill="none" stroke="#5c9eff" strokeWidth="6" />
      <rect x="14" y="52" width="18" height="30" rx="6" fill="#1f2b44" stroke="#5c9eff" strokeWidth="3" />
      <rect x="68" y="52" width="18" height="30" rx="6" fill="#1f2b44" stroke="#5c9eff" strokeWidth="3" />
      <path d="M42 70 q8 -8 16 0" fill="none" stroke="#a94458" strokeWidth="2" opacity="0.8" />
    </g>
  ),
  RADIO: (
    <g>
      <path d="M14 40 Q14 18 50 18 Q86 18 86 40 L86 82 L14 82 Z" fill="#5a3a22" stroke="#e8cb8c" strokeWidth="3" />
      <rect x="22" y="34" width="34" height="38" rx="4" fill="#2a1c12" />
      <path d="M24 42 h30 M24 50 h30 M24 58 h30 M24 66 h30" stroke="#6d5238" strokeWidth="2" />
      <circle cx="70" cy="44" r="8" fill="#e8cb8c" />
      <circle cx="70" cy="66" r="6" fill="#e8cb8c" />
      <path d="M70 44 l4 -5" stroke="#2a1c12" strokeWidth="2" />
    </g>
  ),
  DOLL: (
    <g>
      <circle cx="50" cy="46" r="30" fill="#efe0cf" stroke="#a94458" strokeWidth="3" />
      <path d="M22 40 Q30 12 50 14 Q72 12 78 40 Q66 26 50 28 Q34 26 22 40 Z" fill="#3a1f1a" />
      <circle cx="39" cy="46" r="7" fill="#0b0d14" />
      <circle cx="61" cy="46" r="7" fill="#0b0d14" />
      <circle cx="41" cy="44" r="2" fill="#fff" />
      <path d="M40 64 Q50 60 60 64" fill="none" stroke="#a94458" strokeWidth="3" />
      <path d="M58 30 L54 42 L60 50" fill="none" stroke="#6b5f57" strokeWidth="1.5" />
      <path d="M39 53 v12" stroke="#5b0f1c" strokeWidth="2" opacity="0.8" />
    </g>
  ),
  PRIEST: (
    <g>
      <path d="M18 92 Q18 60 50 58 Q82 60 82 92 Z" fill="#141418" />
      <rect x="42" y="58" width="16" height="7" fill="#f2f2f2" />
      <ellipse cx="50" cy="38" rx="18" ry="22" fill="#cdbfb2" />
      <path d="M40 34 h6 M54 34 h6" stroke="#0b0d14" strokeWidth="4" />
      <path d="M44 50 h12" stroke="#5b4b45" strokeWidth="2" />
      <path d="M50 70 v16 M43 76 h14" stroke="#c9a45e" strokeWidth="3" />
    </g>
  ),
  HOST: (
    <g>
      <path d="M26 44 Q26 16 50 16 Q74 16 74 44 Q74 60 64 66 L64 78 L36 78 L36 66 Q26 60 26 44 Z" fill="#e6e1d6" stroke="#36d9a0" strokeWidth="2" />
      <ellipse cx="41" cy="44" rx="7" ry="9" fill="#0b0d14" />
      <ellipse cx="59" cy="44" rx="7" ry="9" fill="#0b0d14" />
      <circle cx="41" cy="45" r="2" fill="#36d9a0" />
      <circle cx="59" cy="45" r="2" fill="#36d9a0" />
      <path d="M46 58 L50 52 L54 58 Z" fill="#0b0d14" />
      <path d="M40 70 v8 M46 70 v8 M54 70 v8 M60 70 v8" stroke="#0b0d14" strokeWidth="2" />
      <path d="M18 50 Q18 8 50 8 Q82 8 82 50" fill="none" stroke="#a94458" strokeWidth="5" />
      <rect x="12" y="44" width="12" height="20" rx="4" fill="#a94458" />
      <rect x="76" y="44" width="12" height="20" rx="4" fill="#a94458" />
    </g>
  ),
  WILD: (
    <g>
      <rect x="8" y="28" width="84" height="44" rx="8" fill="#5b0f1c" stroke="#ff3b4f" strokeWidth="4" />
      <text x="50" y="59" textAnchor="middle" fontSize="24" fontWeight="800" fill="#ffe2e5" fontFamily="system-ui, sans-serif" letterSpacing="2">ON AIR</text>
    </g>
  ),
  STATIC: (
    <g>
      <rect x="6" y="6" width="88" height="88" rx="6" fill="url(#df-noise)" />
      <rect x="6" y="6" width="88" height="88" rx="6" fill="none" stroke="#9aa3ad" strokeWidth="2" />
      <text x="50" y="58" textAnchor="middle" fontSize="26" fontWeight="800" fill="#f2e8d7" fontFamily="system-ui, sans-serif" opacity="0.85">?</text>
    </g>
  ),
  ANTENNA: (
    <g>
      <path d="M50 22 L34 90 M50 22 L66 90 M40 64 h20 M37 76 h26 M44 46 h12" stroke="#c9a45e" strokeWidth="4" fill="none" />
      <circle cx="50" cy="20" r="6" fill="#ff3b4f" />
      <path d="M32 12 Q24 20 32 28 M68 12 Q76 20 68 28 M24 6 Q12 20 24 34 M76 6 Q88 20 76 34" stroke="#ff3b4f" strokeWidth="3" fill="none" />
    </g>
  ),
  TAPE: (
    <g>
      <rect x="10" y="26" width="80" height="50" rx="4" fill="#111" stroke="#f2e8d7" strokeWidth="3" />
      <rect x="20" y="34" width="60" height="16" fill="#efe6d2" transform="rotate(-3 50 42)" />
      <text x="50" y="47" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5b0f1c" fontFamily="system-ui, sans-serif" transform="rotate(-3 50 42)">DON'T PLAY</text>
      <circle cx="34" cy="62" r="7" fill="#333" stroke="#777" />
      <circle cx="66" cy="62" r="7" fill="#333" stroke="#777" />
    </g>
  ),
};

export function SymbolArt({ s, m }: { s: SymbolId; m?: number }) {
  return (
    <svg viewBox="0 0 100 100" className={`sym sym-${s.toLowerCase()}`} role="img" aria-label={m && m > 1 ? `${s} x${m}` : s}>
      {ART[s]}
      {s === 'WILD' && m && m > 1 ? (
        <g>
          <circle cx="78" cy="22" r="16" fill="#ffcf4a" stroke="#5b0f1c" strokeWidth="3" />
          <text x="78" y="28" textAnchor="middle" fontSize="16" fontWeight="900" fill="#5b0f1c" fontFamily="system-ui, sans-serif">x{m}</text>
        </g>
      ) : null}
    </svg>
  );
}

/** Shared SVG defs (the animated Static noise pattern). Render once. */
export function SymbolDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="df-noise-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3">
            <animate attributeName="seed" values="1;2;3;4;5;6;7;8" dur="0.4s" repeatCount="indefinite" />
          </feTurbulence>
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <pattern id="df-noise" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" filter="url(#df-noise-filter)" />
        </pattern>
      </defs>
    </svg>
  );
}
