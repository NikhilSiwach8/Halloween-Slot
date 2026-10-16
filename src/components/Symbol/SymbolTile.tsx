import { memo, useState } from 'react';
import { SYMBOLS } from '../../config/symbols';
import type { Age, SymbolId } from '../../config/types';
import { SYMBOL_IMAGES, assetUrl } from '../../rendering/assetManifest';
import { SymbolArt } from './symbolArt';

const AGE_LABEL: Record<Age, string> = { 0: 'I', 1: 'II', 2: 'III' };
const AGE_NAME: Record<Age, string> = { 0: 'Original', 1: 'Fractured', 2: 'Hollow' };

export interface SymbolTileProps {
  sym: SymbolId;
  age: Age;
  frozen?: boolean;
  uid: number;
  small?: boolean;
}

/**
 * One symbol with its Three Ages treatment. Age is shown redundantly — never by colour alone:
 *   I   Original  : clean square brass frame, no badge.
 *   II  Fractured : notched (chamfered) frame, crack overlay, "II" badge, leaking particles.
 *   III Hollow    : double dashed frame that flickers, dark central void, ghost offset copy, "III" badge.
 */
export const SymbolTile = memo(function SymbolTile({ sym, age, frozen, uid, small }: SymbolTileProps) {
  const def = SYMBOLS[sym];
  const img = SYMBOL_IMAGES[sym];
  const [imgFailed, setImgFailed] = useState(false);
  const label = `${def.name}${def.ageable ? `, ${AGE_NAME[age]}` : ''}${frozen ? ', frozen' : ''}`;
  const art = img && !imgFailed
    ? <img className="symbol-art" src={assetUrl(img)} alt="" onError={() => setImgFailed(true)} draggable={false} />
    : <SymbolArt sym={sym} idSuffix={String(uid)} />;
  return (
    <div className={`tile kind-${def.kind} age-${age}${frozen ? ' frozen' : ''}${small ? ' small' : ''}`} role="img" aria-label={label} data-sym={sym} data-age={age}>
      <div className="tile-frame" />
      {age === 2 && <div className="tile-ghost">{art}</div>}
      <div className="tile-art">{art}</div>
      {age >= 1 && (
        <svg className="tile-cracks" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M8 22 L28 34 L24 46 L40 58" />
          <path d="M92 70 L74 62 L78 50 L64 44" />
          {age === 2 && <path d="M50 4 L46 18 L56 26 L50 40 M50 96 L54 82 L44 74 L50 60" />}
        </svg>
      )}
      {age === 2 && <div className="tile-void" />}
      {age >= 1 && !small && <div className="tile-particles"><i /><i /><i /></div>}
      {def.ageable && age > 0 && <span className="tile-badge">{AGE_LABEL[age]}</span>}
      {frozen && <span className="tile-frozen" title="Frozen">&#x23F8;</span>}
    </div>
  );
});
