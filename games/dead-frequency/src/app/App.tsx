import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DEFAULT_CONFIG, roundCost } from '../config/gameConfig';
import type { ModeId } from '../config/types';
import { Background, noiseDataUrl } from '../components/Background';
import { ChannelStrip, Reels } from '../components/Reels';
import { Character, Icon, Logo, ReelFrame, RollingAmount, SignalPanel, Svg } from '../components/Cabinet';
import { SymbolDefs } from '../components/SymbolArt';
import { OverlayView } from '../components/Overlays';
import { Splash, splashSkipped } from '../components/Splash';
import { RulesModal } from '../components/Rules';
import { StationMenu } from '../components/StationMenu';
import { audio } from './audio';
import { formatMoney } from './format';
import { useGame } from './useGame';
import { useSocialText } from './socialText';
import { DemoPlatform, ReplayPlatform, StakePlatform, type Platform, type PlatformSession } from '../platform/platform';

const cfg = DEFAULT_CONFIG;
const params = new URLSearchParams(window.location.search);
const REDUCED_MOTION = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Stake.us: `social=true` (or the RGS socialCasino flag) switches to social-casino wording. */
const SOCIAL_PARAM = params.get('social') === 'true';
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
  const rootRef = useRef<HTMLDivElement>(null);
  useSocialText(rootRef, SOCIAL_PARAM || !!session.flags.socialCasino);
  // Ambience starts on the first gesture (browser autoplay rules) and follows the bonus mood.
  useEffect(() => {
    const start = () => audio.resume();
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, []);
  useEffect(() => audio.setMood(view.bonus?.type ?? 'base'), [view.bonus?.type]);
  const [panel, setPanel] = useState<'none' | 'rules' | 'menu'>('none');
  // Title screen, except in bet replay (reviewers and shared links go straight to the round).
  const [splash, setSplash] = useState(() => !session.replay && !splashSkipped());
  const [muted, setMuted] = useState(audio.muted);
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
      if (e.code !== 'Space' || panel !== 'none' || splash || session.flags.disabledSpacebar) return;
      if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
      e.preventDefault();
      onSpin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const betIndex = bets.indexOf(g.bet);
  const winMoney = Math.floor((g.bet * view.roundWinX100) / 100);

  const turboOn = g.speed === 'turbo';
  const modeChip = replay
    ? // Replay: the mode, the base bet, the mode's cost multiplier and what the round cost.
      `Bet replay · ${cfg.modes[replay.mode].name} · bet ${money(replay.bet)} × ${cfg.modes[replay.mode].cost} = ${money(roundCost(cfg, replay.mode, replay.bet))}`
    : g.featureMode
      ? `${cfg.modes[g.featureMode].name} active`
      : g.doubleChance
        ? 'Double Chance ON · stake x1.5'
        : null;
  const spinLabel = view.busy ? 'SKIP' : replay ? (g.replayed ? 'PLAY AGAIN' : 'PLAY') : 'SPIN';

  return (
    <div ref={rootRef} className={`app ${splash ? 'splash-on' : ''} ${view.bonus ? `in-bonus bonus-${view.bonus.type.toLowerCase()}` : ''} ${view.spinning ? 'is-spinning' : ''}`}>
      <Background mood={view.bonus?.type ?? 'base'} reducedMotion={REDUCED_MOTION} surge={view.overlay?.kind === 'bigWin' ? -view.spinId : view.spinWinX100 >= 500 ? view.spinId : 0} />
      <SymbolDefs />
      <div className="scanlines" aria-hidden="true" />
      {view.bonusFx > 0 ? <div className="static-wipe" key={view.bonusFx} aria-hidden="true" style={{ '--noise': `url(${noiseDataUrl()})` } as CSSProperties} /> : null}

      <div className="corner-actions">
        <button className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { audio.muted = !muted; setMuted(!muted); }}>
          <Svg size={20}>{muted ? Icon.muted : Icon.sound}</Svg>
        </button>
        <button className="icon-btn" aria-label="Rules and paytable" onClick={() => setPanel('rules')}>
          <Svg size={20}>{Icon.info}</Svg>
        </button>
      </div>
      <Logo />

      <main className="stage">
        <SignalPanel cfg={cfg} antennas={view.antennas} spinning={view.spinning} bonus={view.bonus} />
        <ReelFrame
          multiplier={view.bonus?.meter ?? 1}
          ticker={view.ticker}
          onAir={view.busy}
          scope={view.spinning ? 'spin' : view.spinWinX100 > 0 ? 'win' : view.busy ? 'spin' : 'idle'}
          footer={<ChannelStrip cfg={cfg} view={view} turbo={turboOn} />}
        >
          <Reels cfg={cfg} view={view} turbo={turboOn} />
        </ReelFrame>
        <Character excited={view.spinWinX100 >= 500 || view.overlay?.kind === 'bigWin'} watching={view.spinning || (view.busy && !view.overlay)} />
      </main>

      {g.error ? (
        <div className="error-bar" role="alert">
          <span>{g.error}</span>
          <button onClick={() => g.setError(null)} aria-label="Dismiss">×</button>
        </div>
      ) : null}
      {modeChip ? <div className={`mode-chip ${replay ? 'replay' : ''}`} data-testid="mode-chip">{modeChip}</div> : null}

      <footer className={`bar ${replay ? 'replay' : ''}`}>
        {!replay && !session.flags.disabledTurbo ? (
          <button className={`round-btn turbo ${turboOn ? 'on' : ''}`} aria-pressed={turboOn} aria-label="Turbo" title="Turbo: faster animations" onClick={() => g.setSpeed(turboOn ? 'normal' : 'turbo')}>
            <Svg size={26}>{Icon.bolt}</Svg>
          </button>
        ) : null}
        <div className="bar-main">
          <button className="bar-menu" aria-label="Menu and rules" onClick={() => setPanel('rules')}>
            <Svg size={26}>{Icon.menu}</Svg>
          </button>
          {replay ? null : (
            <div className="bar-field">
              <label>Balance</label>
              <output data-testid="balance">{money(g.balance)}</output>
            </div>
          )}
          <div className="bar-field right">
            <label>Win</label>
            <RollingAmount testId="win" value={winMoney} format={money} />
          </div>
        </div>
        {replay ? null : (
          <>
            <div className="bet-pill">
              <div className="bar-field">
                <label>Bet</label>
                <output>{money(g.bet)}</output>
                {cost !== g.bet ? <small>Cost {money(cost)}</small> : null}
              </div>
              <div className="bet-arrows">
                <button aria-label="Raise stake" disabled={view.busy || betIndex >= bets.length - 1} onClick={() => g.setBet(bets[betIndex + 1])}>
                  <Svg size={22}>{Icon.up}</Svg>
                </button>
                <button aria-label="Lower stake" disabled={view.busy || betIndex <= 0} onClick={() => g.setBet(bets[betIndex - 1])}>
                  <Svg size={22}>{Icon.down}</Svg>
                </button>
              </div>
            </div>
            <button
              className={`round-btn dc ${g.doubleChance ? 'on' : ''}`}
              aria-pressed={g.doubleChance}
              aria-label="Double Chance"
              disabled={view.busy || g.featureMode !== null}
              onClick={() => g.setDoubleChance(!g.doubleChance)}
              title="Double Chance: stake x1.5, twice the chance to trigger a bonus. Bonus buys are unaffected."
            >
              <span className="dc-x">2×</span>
              <small>Chance</small>
            </button>
          </>
        )}
        <button
          className={`spin-btn ${view.busy ? 'busy' : ''}`}
          data-testid="spin"
          onClick={onSpin}
          disabled={!view.busy && !canSpin}
          aria-label={view.busy ? 'Skip' : replay ? (g.replayed ? 'Play again' : 'Play replay') : `Spin for ${money(cost)}`}
        >
          <Svg size={58}>{view.busy ? Icon.stop : replay ? Icon.play : Icon.spin}</Svg>
          <span className="sr">{spinLabel}</span>
        </button>
        {!replay && showMenu ? (
          <button className="round-btn buy" aria-label="Feature Spins and Bonus Buy" disabled={view.busy} onClick={() => setPanel('menu')}>
            <Svg size={26}>{Icon.tower}</Svg>
            <small>Buy</small>
          </button>
        ) : null}
      </footer>
      <p className="disclaimer">{session.demo ? 'Demo · demo credits only · not real money' : replay ? 'Bet replay · no bets are placed' : 'Winnings are settled by the game server.'}</p>

      {splash ? <Splash cfg={cfg} onContinue={() => setSplash(false)} /> : null}
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
