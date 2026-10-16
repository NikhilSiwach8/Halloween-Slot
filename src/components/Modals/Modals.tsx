import type { ReactNode } from 'react';
import { PAYING_SYMBOLS, SYMBOLS } from '../../config/symbols';
import type { GameConfig } from '../../config/types';
import { clockmakerOptions } from '../../mechanics/clockmakerChoice/clockmakerChoice';
import { BONUS_STAGES } from '../../mechanics/lastSecond/lastSecond';
import { formatCredits } from '../../utils/format';
import PUBLISHED from '../../config/publishedMath.json';
import type { Settings, Speed } from '../../app/useGame';
import { SymbolTile } from '../Symbol/SymbolTile';

function Modal({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId: string }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose} data-testid={testId}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={`Close ${title}`}>&times;</button>
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}

export function SettingsModal({ settings, setSettings, onClose, onExport }: { settings: Settings; setSettings: (p: Partial<Settings>) => void; onClose: () => void; onExport: () => void }) {
  return (
    <Modal title="Settings" onClose={onClose} testId="settings-modal">
      <label className="setting">
        <span>Master volume</span>
        <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => setSettings({ volume: Number(e.target.value) })} aria-label="Master volume" />
      </label>
      <label className="setting">
        <span>Mute all sound</span>
        <input type="checkbox" checked={settings.muted} onChange={(e) => setSettings({ muted: e.target.checked })} data-testid="settings-mute" />
      </label>
      <label className="setting">
        <span>Reduced motion <small>(no movement, flashes or camera shifts; all information kept)</small></span>
        <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => setSettings({ reducedMotion: e.target.checked })} data-testid="reduced-motion-toggle" />
      </label>
      <label className="setting">
        <span>Animation speed</span>
        <select value={settings.speed} onChange={(e) => setSettings({ speed: e.target.value as Speed })} data-testid="speed-select">
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
          <option value="instant">Instant</option>
        </select>
      </label>
      <p className="muted">Only these preferences are stored on this device. Balance and outcomes are never stored by the browser.</p>
      <button className="text-button" onClick={onExport}>Export session log (seed + actions) for replay</button>
    </Modal>
  );
}

export function RulesModal({ cfg, onClose, showRtp = true }: { cfg: GameConfig; onClose: () => void; showRtp?: boolean }) {
  const sizes = cfg.paytable.SKULL.map((_, i) => cfg.clusters.minSize + i);
  const d = cfg.debt;
  const [a, b] = clockmakerOptions(cfg);
  const roundScope = cfg.persistence.paradoxDebt === 'ROUND';
  const hm = cfg.bonus.hourMultiplier;
  return (
    <Modal title="How The Hollow Hour Works" onClose={onClose} testId="rules-modal">
      <section>
        <h3>Clusters</h3>
        <ul>
          <li>{cfg.grid.cols}×{cfg.grid.rows} grid. {cfg.clusters.minSize}+ matching symbols connected horizontally or vertically (not diagonally) win.</li>
          <li>Chrono Wilds substitute for every paying symbol and can join two groups. Wild-only groups do not pay. One wild can be part of clusters of different symbols.</li>
          <li>Winning symbols are removed, symbols fall, new ones drop in, and the board is evaluated again (up to {cfg.cascade.maxCascades} winning cascades).</li>
          <li>Void Tickets and the Clockmaker never form clusters. Displayed wins: <em>Spin win</em> = this spin (or bonus stage), <em>Total round win</em> = everything in the round.</li>
        </ul>
      </section>
      <section>
        <h3>The Three Ages</h3>
        <p>Paying symbols age <strong>Original (I) → Fractured (II) → Hollow (III)</strong>, one step at a time, only through game events — never by time. Ages never reverse. Ageing a Hollow symbol again collapses it into a Chrono Wild.</p>
        <p>Cluster multiplier = 1 + {cfg.ages.multiplierPerAge[1]} per Fractured symbol + {cfg.ages.multiplierPerAge[2]} per Hollow symbol (max ×{cfg.ages.maxClusterMultiplier}). Ages last for the spin; in The Last Second, frozen symbols keep their Age between stages.</p>
      </section>
      <section>
        <h3>Time Corruption</h3>
        <p>After each winning cascade, every surviving symbol next to a removed winner has a {Math.round(cfg.corruption.adjacentChance * 100)}% chance (+{Math.round(cfg.corruption.debtStateBonus.UNSTABLE * 100)}% Unstable, +{Math.round(cfg.corruption.debtStateBonus.CRITICAL * 100)}% Critical) to age one step, at most {cfg.corruption.maxTransformationsPerStep} per cascade. A winning Chrono Orb cluster also ages {cfg.corruption.orbBurstCells} random symbols.</p>
      </section>
      <section>
        <h3>The Echo Ledger</h3>
        <p>Every winning cluster records its oldest symbol, and every symbol that turns Hollow is recorded (max {cfg.echo.maxNewEntriesPerSpin} per spin, {cfg.echo.maxEntries} kept, each expires after {cfg.echo.ttlSpins} spins). Echoes return the remembered symbol <strong>one Age older</strong> onto its old position (or a neighbour), newest first, and are then consumed. Echoes are projected by a winning Hourglass cluster ({cfg.echo.hourglassProjections}), by {cfg.echo.scatterTrigger.count}+ Hourglasses on the opening board ({cfg.echo.scatterTrigger.projections}), by a Discharge, by Preserve the Past and by Stage III. The ledger stores board states, never prizes: a past win is never paid again.</p>
      </section>
      <section>
        <h3>Paradox Split</h3>
        <p>Opened by a winning Time Portal cluster or {cfg.split.portalCount}+ Portals on the opening board (once per spin). Timeline B is the same board with every symbol one Age older. {cfg.split.cells} random cells (+{cfg.split.criticalBonusCells} if the spin began Critical, + any primed cells) cross over from Timeline B; the merged board is evaluated normally. Only one board ever pays.</p>
      </section>
      <section>
        <h3>Paradox Debt</h3>
        <p>Stable &lt; {d.thresholds.UNSTABLE} ≤ Unstable &lt; {d.thresholds.CRITICAL} ≤ Critical &lt; {d.thresholds.DISCHARGE} = Discharge. Gains: Hollow +{d.gains.HOLLOW_FORMED}, wild collapse +{d.gains.WILD_COLLAPSE}, Echo +{d.gains.ECHO_PROJECTED}, Split +{d.gains.PARADOX_SPLIT}, Clockmaker +{d.gains.CLOCKMAKER}, Stage IV +{d.gains.COLLAPSE_STAGE}. The state at the start of a spin raises corruption chance and split size. At {d.thresholds.DISCHARGE} the meter discharges after the cascades: it resets to 0, a {d.discharge.regionSize}×{d.discharge.regionSize} region ages one step and {d.discharge.echoProjections} Echo returns, then cascades resume. {roundScope ? ' Each round starts with its own Paradox Debt (part of the round outcome) and nothing carries over between rounds.' : ' The meter persists between rounds.'} It never depends on your balance or results.</p>
      </section>
      <section>
        <h3>Clockmaker&rsquo;s Choice</h3>
        <p>When the Clockmaker lands on the opening board {cfg.clockmaker.selection === 'ENGINE' ? 'he chooses one of two paths for you (the path is part of the round outcome)' : 'you choose'}, before the board is evaluated: <strong>{a.title}</strong> — {a.summary} <strong>{b.title}</strong> — {b.summary} Afterwards the Clockmaker becomes a Chrono Wild.</p>
      </section>
      <section>
        <h3>The Last Second</h3>
        <p>{cfg.bonus.triggerTickets}+ Void Tickets on the opening board start a free four-stage bonus after the spin. Each stage is one spin you start yourself:</p>
        <ol>
          {BONUS_STAGES.map((s, i) => <li key={s.stage}><strong>{s.title}</strong> (wins ×{cfg.bonus.stageMultipliers[i]}): {s.text}</li>)}
        </ol>
        <p><strong>Hour Multiplier:</strong> starts at ×{hm.start} and applies to every bonus win together with the stage multiplier. It grows by +{hm.perCollapse} for each symbol that collapses into a Chrono Wild (except the Stage IV collapse){hm.perHollow ? ` and +${hm.perHollow} for each symbol that turns Hollow` : ''}, and a Paradox Discharge during the bonus multiplies it by {hm.dischargeFactor} (maximum ×{hm.max}). It lasts for the whole bonus.</p>
        <p>Frozen symbols ({cfg.bonus.frozenCells}) never move, cannot be corrupted, and age instead of being removed when they win. No Tickets or Clockmaker appear in the bonus, so it cannot retrigger.</p>
      </section>
      <section>
        <h3>Paytable <small>(× stake, before multipliers)</small></h3>
        <div className="paytable-scroll">
          <table className="paytable">
            <thead><tr><th>Symbol</th>{sizes.map((s, i) => <th key={s}>{i === sizes.length - 1 ? `${s}+` : s}</th>)}</tr></thead>
            <tbody>
              {PAYING_SYMBOLS.map((sym) => (
                <tr key={sym}>
                  <th><span className="pt-sym"><SymbolTile sym={sym} age={0} uid={-5000 - SYMBOLS[sym].rank} small />{SYMBOLS[sym].name}</span></th>
                  {cfg.paytable[sym].map((p, i) => <td key={i}>{(p / 100).toFixed(p % 100 ? 2 : 0)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Maximum win per round: <strong>{cfg.maxWinX.toLocaleString()}× stake</strong> ({formatCredits(cfg.bets[cfg.bets.length - 1] * cfg.maxWinX, cfg)} at the highest stake). When it is reached the round ends.</p>
        {showRtp && <p data-testid="rules-rtp">Theoretical return to player (RTP): <strong>{PUBLISHED.rtp.toFixed(2)}%</strong>, computed from the published outcome table ({PUBLISHED.books.toLocaleString()} rounds). The {cfg.maxWinX.toLocaleString()}× maximum win occurs about once every {PUBLISHED.maxWinOneIn.toLocaleString()} rounds.</p>}
      </section>
      <section>
        <h3>About this prototype</h3>
        <p className="muted">Every round is independent of previous rounds. In the local demo, outcomes come from a seeded development PRNG (not a certified gaming RNG) and demo credits only. On a platform build, the platform selects each round from the published outcome table and the game only displays it. Malfunction voids all pays and plays.</p>
      </section>
    </Modal>
  );
}
