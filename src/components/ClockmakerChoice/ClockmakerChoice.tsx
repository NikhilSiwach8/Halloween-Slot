import { useState } from 'react';
import type { ClockmakerPath, GameConfig } from '../../config/types';
import { clockmakerOptions } from '../../mechanics/clockmakerChoice/clockmakerChoice';
import { SymbolArt } from '../Symbol/symbolArt';

export function ClockmakerChoice({ cfg, echoesAvailable, onChoose }: { cfg: GameConfig; echoesAvailable: number; onChoose: (p: ClockmakerPath) => void }) {
  const [picked, setPicked] = useState<ClockmakerPath | null>(null);
  const choose = (p: ClockmakerPath) => {
    if (picked) return; // one selection per feature instance (the engine enforces this too)
    setPicked(p);
    onChoose(p);
  };
  return (
    <div className="modal-backdrop choice-backdrop" role="dialog" aria-modal="true" aria-labelledby="cm-title" data-testid="clockmaker-choice">
      <div className="choice-modal">
        <div className="choice-figure" aria-hidden="true"><SymbolArt sym="CLOCKMAKER" idSuffix="modal" /></div>
        <h2 id="cm-title">Clockmaker&rsquo;s Choice</h2>
        <p className="choice-sub">The faceless keeper of the tower offers two paths. Your choice changes this spin&rsquo;s board before it is evaluated. Neither path is guaranteed to pay more.</p>
        <div className="choice-cards">
          {clockmakerOptions(cfg).map((o) => (
            <button
              key={o.path}
              className={`choice-card path-${o.path.toLowerCase()}${picked === o.path ? ' picked' : ''}`}
              onClick={() => choose(o.path)}
              disabled={!!picked}
              data-testid={`choice-${o.path}`}
            >
              <span className="choice-title">{o.title}</span>
              <span className="choice-text">{o.summary}</span>
              {o.path === 'PRESERVE_PAST' && <span className="choice-hint">{echoesAvailable} echo{echoesAvailable === 1 ? '' : 'es'} available now</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
