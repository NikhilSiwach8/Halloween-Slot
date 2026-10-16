import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONFIG, createDevConfig } from '../config/gameConfig';
import type { ForceOption } from '../engine/GameEngine';
import { LocalDemoAdapter } from '../platform/PlatformAdapter';
import { Background } from '../rendering/Background';
import { GameBoard } from '../components/GameBoard/GameBoard';
import { HUD } from '../components/HUD/HUD';
import { ParadoxMeter } from '../components/ParadoxMeter/ParadoxMeter';
import { EchoLedgerButton, EchoLedgerPanel } from '../components/EchoLedger/EchoLedger';
import { ClockmakerChoice } from '../components/ClockmakerChoice/ClockmakerChoice';
import { LastSecondPanel } from '../components/LastSecond/LastSecond';
import { RulesModal, SettingsModal } from '../components/Modals/Modals';
import { loadSettings, useGame, type Speed } from './useGame';

const params = new URLSearchParams(window.location.search);
const DEV = params.get('dev') === '1';
const SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0);
const URL_SPEED = params.get('speed') as Speed | null;
const BG_3D = params.get('bg') !== '0';
const prefersReduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FORCES: { force: ForceOption; label: string }[] = [
  { force: 'BONUS', label: 'Last Second' },
  { force: 'CLOCKMAKER', label: 'Clockmaker' },
  { force: 'SPLIT', label: 'Paradox Split' },
  { force: 'ECHO', label: 'Hourglass win' },
  { force: 'DISCHARGE', label: 'Full debt' },
];

export function App() {
  const adapter = useMemo(() => new LocalDemoAdapter(DEV ? createDevConfig(DEFAULT_CONFIG) : DEFAULT_CONFIG, SEED), []);
  useEffect(() => {
    // Read-only debugging hook (session export) for development and browser tests.
    (window as unknown as { __hollowHour?: unknown }).__hollowHour = { exportSession: () => adapter.exportSession(), getState: () => adapter.getState() };
  }, [adapter]);
  const initial = useMemo(() => {
    const s = loadSettings({ volume: 0.6, muted: false, reducedMotion: prefersReduced, speed: 'normal' });
    return URL_SPEED ? { ...s, speed: URL_SPEED } : s;
  }, []);
  const game = useGame(adapter, initial);
  const { cfg, display, settings } = game;
  const [panel, setPanel] = useState<'none' | 'rules' | 'settings' | 'ledger'>('none');

  const awaitingChoice = display.awaiting === 'CLOCKMAKER_CHOICE' && !display.busy;
  const awaitingStage = display.awaiting === 'BONUS_STAGE';
  const inBonus = awaitingStage || display.mode === 'BONUS';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || panel !== 'none') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      e.preventDefault();
      if (display.busy) game.skip();
      else if (awaitingStage) void game.playBonusStage();
      else if (game.canSpin) void game.spin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, display.busy, awaitingStage, game]);

  const exportSession = () => {
    const blob = new Blob([JSON.stringify(adapter.exportSession(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hollow-hour-session-${SEED}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div
      className={`app${settings.reducedMotion ? ' reduced-motion' : ''}${inBonus ? ' in-bonus' : ''} debt-${display.debtState.toLowerCase()}`}
      data-testid="app"
      data-phase={display.uiPhase}
      data-awaiting={display.awaiting}
      data-busy={display.busy ? 'true' : 'false'}
      data-reduced-motion={settings.reducedMotion ? 'true' : 'false'}
      data-muted={settings.muted ? 'true' : 'false'}
    >
      <Background mode={inBonus ? 'BONUS' : 'BASE'} debtState={display.debtState} splitting={!!display.split} reducedMotion={settings.reducedMotion} enabled={BG_3D} />
      <header className="topbar">
        <div className="brand">
          <h1>The Hollow Hour</h1>
          <p>Time Is a Prize. Eternity Is the Price.</p>
        </div>
        <div className="phase-chip" data-testid="phase-chip" aria-live="polite">{display.uiPhase.replace(/_/g, ' ').toLowerCase()}</div>
      </header>

      <main className="stage">
        <aside className="side">
          <ParadoxMeter value={display.debt} state={display.debtState} cfg={cfg} />
          <EchoLedgerButton count={display.echoes.length} onOpen={() => setPanel('ledger')} />
          <div className="feature-state" data-testid="feature-state">
            {adapter.getState().splitPrimedCells > 0 && <span className="chip violet">Next split primed +{adapter.getState().splitPrimedCells}</span>}
            {display.debtState !== 'STABLE' && <span className="chip crimson">{display.debtState === 'UNSTABLE' ? `Corruption +${Math.round(cfg.corruption.debtStateBonus.UNSTABLE * 100)}%` : `Corruption +${Math.round(cfg.corruption.debtStateBonus.CRITICAL * 100)}% · Split +${cfg.split.criticalBonusCells}`}</span>}
            {inBonus && <span className="chip gold">The Last Second · Stage {Math.max(1, display.bonusStage)}</span>}
          </div>
          <ul className="feed" aria-live="polite" data-testid="feed">
            {display.feed.map((f) => <li key={f.key} className={`tone-${f.tone}`}>{f.text}</li>)}
          </ul>
        </aside>

        <section className="center">
          <div className="banner-slot" aria-live="assertive">
            {display.banner && (
              <div key={display.banner.key} className={`banner tone-${display.banner.tone}`} data-testid="banner">
                <strong>{display.banner.title}</strong>
                {display.banner.text && <span>{display.banner.text}</span>}
              </div>
            )}
          </div>
          <GameBoard display={display} cfg={cfg} />
          {inBonus && (
            <LastSecondPanel cfg={cfg} stage={display.bonusStage} awaitingStage={awaitingStage && !display.busy} busy={display.busy} bonusWin={display.bonusWin} onPlay={() => void game.playBonusStage()} />
          )}
          {game.error && <div className="error" role="alert">{game.error} <button className="text-button" onClick={() => game.setError(null)}>dismiss</button></div>}
        </section>
      </main>

      <HUD
        cfg={cfg}
        display={display}
        bet={game.bet}
        setBet={game.setBet}
        canSpin={game.canSpin}
        onSpin={() => void game.spin()}
        onSkip={game.skip}
        muted={settings.muted}
        onToggleMute={() => game.setSettings({ muted: !settings.muted })}
        onOpenRules={() => setPanel('rules')}
        onOpenSettings={() => setPanel('settings')}
      />

      {awaitingChoice && <ClockmakerChoice cfg={cfg} echoesAvailable={adapter.getState().echoes.length} onChoose={(p) => void game.choose(p)} />}
      {panel === 'ledger' && <EchoLedgerPanel active={display.echoes} recent={display.recentEchoes} cfg={cfg} onClose={() => setPanel('none')} />}
      {panel === 'rules' && <RulesModal cfg={cfg} onClose={() => setPanel('none')} />}
      {panel === 'settings' && <SettingsModal settings={settings} setSettings={game.setSettings} onClose={() => setPanel('none')} onExport={exportSession} />}

      {DEV && (
        <div className="dev-panel" data-testid="dev-panel">
          <strong>DEV ONLY · seed {SEED}</strong>
          <span>Forced triggers (disabled in the ordinary configuration):</span>
          <div className="dev-buttons">
            {FORCES.map((f) => (
              <button key={f.force} disabled={!game.canSpin} onClick={() => void game.spin(f.force)} data-testid={`dev-force-${f.force}`}>{f.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
