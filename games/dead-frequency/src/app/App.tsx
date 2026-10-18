import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { DEFAULT_CONFIG, roundCost } from '../config/gameConfig';
import type { ModeId } from '../config/types';
import { Background, noiseDataUrl } from '../components/Background';
import { Reels } from '../components/Reels';
import { SymbolDefs } from '../components/SymbolArt';
import { OverlayView } from '../components/Overlays';
import { RulesModal } from '../components/Rules';
import { StationMenu } from '../components/StationMenu';
import { audio } from './audio';
import { formatMoney } from './format';
import { useGame } from './useGame';
import { DemoPlatform, ReplayPlatform, StakePlatform, type Platform, type PlatformSession } from '../platform/platform';

const cfg = DEFAULT_CONFIG;
const params = new URLSearchParams(window.location.search);
const REDUCED_MOTION = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;

/** Replay link -> bet replay; sessionID + rgs_url -> Stake RGS; otherwise the local demo. */
export function App() {
  const platform = useMemo<Platform>(
    () => ReplayPlatform.fromUrl(cfg, window.location.search) ?? StakePlatform.fromUrl(cfg, window.location.search) ?? new DemoPlatform(cfg, SEED),
    [],
  );
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  useEffect(() => {
    platform.init().then(setSession, (e) => setBootError(e instanceof Error ? e.message : String(e)));
  }, [platform]);
  if (bootError) return <div className="boot boot-error" role="alert">{bootError}</div>;
  if (!session) return <div className="boot" aria-live="polite">Tuning in…</div>;
  return <Game platform={platform} session={session} />;
}

function Game({ platform, session }: { platform: Platform; session: PlatformSession }) {
  const g = useGame(cfg, platform, session);
  const { view } = g;
  const [panel, setPanel] = useState<'none' | 'rules' | 'menu'>('none');
  const [muted, setMuted] = useState(false);
  const replay = session.replay;
  const money = (units: number) => formatMoney(session.currency, units);
  const spinMode: ModeId = replay?.mode ?? g.featureMode ?? (g.doubleChance ? 'DOUBLE_CHANCE' : 'BASE');
  const cost = roundCost(cfg, spinMode, g.bet);
  const canSpin = !view.busy && (replay ? true : cost <= g.balance);
  const bets = session.bets;
  const showMenu = !session.flags.disabledBuyFeature;

  const onSpin = () => {
    if (view.busy) g.advance();
    else if (canSpin) void g.play(spinMode);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || panel !== 'none' || session.flags.disabledSpacebar) return;
      if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
      e.preventDefault();
      onSpin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const betIndex = bets.indexOf(g.bet);
  const winMoney = Math.floor((g.bet * view.roundWinX100) / 100);
  const bonusDef = view.bonus ? cfg.bonuses[view.bonus.type] : null;

  return (
    <div className={`app ${view.bonus ? `in-bonus bonus-${view.bonus.type.toLowerCase()}` : ''}`}>
      <Background mood={view.bonus?.type ?? 'base'} reducedMotion={REDUCED_MOTION} />
      <SymbolDefs />
      <div className="scanlines" aria-hidden="true" />
      {view.bonusFx > 0 ? <div className="static-wipe" key={view.bonusFx} aria-hidden="true" style={{ '--noise': `url(${noiseDataUrl()})` } as CSSProperties} /> : null}
      <header className="topbar">
        <div className="brand">
          <h1>Dead Frequency</h1>
          <p>Some signals should never be found.</p>
        </div>
        <div className="top-actions">
          <button className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { audio.muted = !muted; setMuted(!muted); }}>{muted ? '🔇' : '🔊'}</button>
          <button className="icon-btn" aria-label="Rules and paytable" onClick={() => setPanel('rules')}>?</button>
        </div>
      </header>

      <main className="stage">
        {view.bonus && bonusDef ? (
          <div className="bonus-bar" role="status">
            <span className="bonus-name">{bonusDef.name}</span>
            <span>Spin {view.bonus.spin} / {view.bonus.totalSpins}</span>
            {view.bonus.meter !== undefined ? <span className="meter">Signal x{view.bonus.meter}</span> : null}
            {bonusDef.stickyStatic ? <span>Sticky Static</span> : null}
            {bonusDef.expandStatic ? <span>Expanding Static · Multiplier Wilds</span> : null}
          </div>
        ) : (
          <div className="bonus-bar quiet">
            {replay ? <span className="feature-on">Bet replay · {cfg.modes[replay.mode].name} · stake {money(replay.bet)}</span> : g.featureMode ? <span className="feature-on">{cfg.modes[g.featureMode].name} active</span> : g.doubleChance ? <span className="feature-on">Double Chance ON</span> : <span>3 Antennas = Night Shift · 4 = Possession · 5+ = Dead Air</span>}
          </div>
        )}
        <Reels cfg={cfg} view={view} />
        <div className="ticker" aria-live="polite">{view.ticker}</div>
      </main>

      {g.error ? (
        <div className="error-bar" role="alert">
          <span>{g.error}</span>
          <button onClick={() => g.setError(null)} aria-label="Dismiss">×</button>
        </div>
      ) : null}
      {replay ? (
        <footer className="controls replay-controls">
          <div className="readout">
            <label>Win</label>
            <output data-testid="win">{money(winMoney)}</output>
          </div>
          <button className="spin" data-testid="spin" onClick={onSpin} aria-label={view.busy ? 'Skip' : g.replayed ? 'Play again' : 'Play replay'}>
            {view.busy ? 'SKIP' : g.replayed ? 'PLAY AGAIN' : 'PLAY'}
            <small>{view.busy ? '' : 'replay'}</small>
          </button>
        </footer>
      ) : (
        <footer className={`controls ${showMenu ? '' : 'no-menu'}`}>
          <div className="readout">
            <label>Balance</label>
            <output data-testid="balance">{money(g.balance)}</output>
          </div>
          <div className="readout">
            <label>Win</label>
            <output data-testid="win">{money(winMoney)}</output>
          </div>
          <div className="bet">
            <label>Stake</label>
            <div className="bet-row">
              <button aria-label="Lower stake" disabled={view.busy || betIndex <= 0} onClick={() => g.setBet(bets[betIndex - 1])}>−</button>
              <output>{money(g.bet)}</output>
              <button aria-label="Raise stake" disabled={view.busy || betIndex >= bets.length - 1} onClick={() => g.setBet(bets[betIndex + 1])}>+</button>
            </div>
          </div>
          <button
            className={`toggle ${g.doubleChance ? 'on' : ''}`}
            aria-pressed={g.doubleChance}
            disabled={view.busy || g.featureMode !== null}
            onClick={() => g.setDoubleChance(!g.doubleChance)}
            title="Stake x1.5: twice the chance to trigger a bonus. Bonus buys are unaffected."
          >
            Double Chance<small>{g.doubleChance ? 'ON' : 'OFF'} · x1.5</small>
          </button>
          {showMenu ? (
            <button className="menu-btn" disabled={view.busy} onClick={() => setPanel('menu')}>
              Feature Spins<small>& Bonus Buy</small>
            </button>
          ) : null}
          {!session.flags.disabledTurbo ? (
            <button className={`toggle ${g.speed === 'turbo' ? 'on' : ''}`} aria-pressed={g.speed === 'turbo'} onClick={() => g.setSpeed(g.speed === 'turbo' ? 'normal' : 'turbo')}>
              Turbo<small>{g.speed === 'turbo' ? 'ON' : 'OFF'}</small>
            </button>
          ) : null}
          <button className="spin" data-testid="spin" onClick={onSpin} disabled={!view.busy && !canSpin} aria-label={view.busy ? 'Skip' : `Spin for ${money(cost)}`}>
            {view.busy ? 'SKIP' : 'SPIN'}
            <small>{view.busy ? '' : money(cost)}</small>
          </button>
        </footer>
      )}
      <p className="disclaimer">{session.demo ? 'Demo · demo credits only · not real money' : replay ? 'Bet replay · no bets are placed' : 'Winnings are settled by the game server.'}</p>

      {view.overlay ? <OverlayView cfg={cfg} currency={session.currency} overlay={view.overlay} bet={g.bet} onContinue={g.advance} /> : null}
      {panel === 'rules' ? <RulesModal cfg={cfg} showRtp={session.flags.displayRTP !== false} onClose={() => setPanel('none')} /> : null}
      {panel === 'menu' ? (
        <StationMenu
          cfg={cfg}
          currency={session.currency}
          bet={g.bet}
          balance={g.balance}
          featureMode={g.featureMode}
          onFeature={(m) => { g.setFeatureMode(m); setPanel('none'); }}
          onBuy={(m) => { setPanel('none'); void g.play(m); }}
          onClose={() => setPanel('none')}
        />
      ) : null}
    </div>
  );
}
