import { PAYING_SYMBOLS } from '../config/symbols';
import { MODE_ORDER } from '../config/gameConfig';
import type { GameConfig } from '../config/types';
import { formatX } from '../app/format';
import published from '../config/publishedMath.json';
import { SymbolArt } from './SymbolArt';

export function RulesModal({ cfg, showRtp, onClose }: { cfg: GameConfig; showRtp: boolean; onClose: () => void }) {
  const math = published.modes as Record<string, { rtp: number; maxWinX: number; maxWinOneIn: number }>;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Rules">
      <div className="overlay-card rules">
        <h2>How the station works</h2>
        <section>
          <h3>Ways</h3>
          <p>{cfg.reels} reels × {cfg.rows} rows, {(cfg.rows ** cfg.reels).toLocaleString()} ways. Wins pay left to right from reel 1 for {cfg.minWayLength}+ adjacent reels. Each winning symbol pays its value × the number of ways.</p>
          <p className="small">
            <strong>Example of a winning combination:</strong> Microphones on reels 1, 2 and 3 pay the 3-of-a-kind value ({formatX(cfg.paytable.MIC[0])}).
            With two Microphones on reel 2 that is 2 ways, so it pays {formatX(cfg.paytable.MIC[0] * 2)}. An On Air wild on reels 2–6 counts as any paying
            symbol. Each symbol pays once, for its longest run from reel 1; wins on different symbols are added together.
          </p>
          <table className="paytable">
            <thead><tr><th /><th>3</th><th>4</th><th>5</th><th>6</th></tr></thead>
            <tbody>
              {[...PAYING_SYMBOLS].reverse().map((s) => (
                <tr key={s}>
                  <td><SymbolArt s={s} /><span>{cfg.symbols[s].name}</span></td>
                  {cfg.paytable[s].map((p, i) => <td key={i}>{formatX(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="sym-rules">
          {(['WILD', 'STATIC', 'ANTENNA', 'TAPE'] as const).map((s) => (
            <div key={s}><SymbolArt s={s} /><p><strong>{cfg.symbols[s].name}.</strong> {cfg.symbols[s].description}</p></div>
          ))}
        </section>
        <section>
          <h3>Static & Retune</h3>
          <p>Static lands in stacks and every Static on the screen reveals as the same symbol. If none of the revealed Statics is part of a win, the signal <strong>retunes</strong> once: they reveal again as a different symbol.</p>
        </section>
        <section>
          <h3>Bonuses</h3>
          <ul>
            <li><strong>Night Shift</strong> (3 Antennas): {cfg.bonuses.NIGHT_SHIFT.spins} spins. The Signal Meter starts at x{cfg.bonuses.NIGHT_SHIFT.signalMeter!.start} and climbs by 1 for every reel with Static. It never resets, and every win is multiplied by it.</li>
            <li><strong>Possession</strong> (4 Antennas): {cfg.bonuses.POSSESSION.spins} spins. Static is sticky for the rest of the bonus and reveals each spin.</li>
            <li><strong>Dead Air</strong> (5–6 Antennas): {cfg.bonuses.DEAD_AIR.spins} spins. Static expands to fill its reel. On Air wilds carry x2 to x25, and the multipliers on a way multiply together.</li>
            <li>3+ Antennas during any bonus: +{cfg.retrigger.extraSpins} spins (at most {cfg.retrigger.maxTotalSpins} in total).</li>
          </ul>
          <h3>Mystery Bonus</h3>
          <p>An <strong>Unmarked Tape</strong> on reel 6 plays the Mystery Bonus. The tape holds one prize: a cash prize of {cfg.mystery.prizes.flatMap((p) => (p.value.kind === 'CASH' ? [formatX(p.value.x100)] : [])).join(', ')}, or one of the three bonuses (Night Shift, Possession or Dead Air). The prize is decided when the spin lands.</p>
          <h3>Double Chance</h3>
          <p>Raises the stake to 1.5×. Every bonus-triggering Antenna count becomes twice as likely to land. Feature Spins and Bonus Buys are not affected.</p>
          <h3>Feature Spins & Bonus Buy</h3>
          <p>Static Storm ({cfg.modes.STATIC_STORM.cost}x): every spin has 2 or 3 full reels of Static. Haunted Wilds ({cfg.modes.HAUNTED_WILDS.cost}x): every spin has 2 or 3 extra multiplier wilds. Neither can trigger a bonus. Bonuses can also be bought: Night Shift {cfg.modes.BUY_NIGHT_SHIFT.cost}x, Possession {cfg.modes.BUY_POSSESSION.cost}x, Dead Air {cfg.modes.BUY_DEAD_AIR.cost}x.</p>
        </section>
        <section>
          <h3>Modes, return to player and maximum win</h3>
          <table className="rtp">
            <thead><tr><th>Mode</th><th>Cost</th>{showRtp ? <th>RTP</th> : null}<th>Max win</th></tr></thead>
            <tbody>
              {MODE_ORDER.map((m) => (
                <tr key={m}>
                  <td>{cfg.modes[m].name}</td>
                  <td>{cfg.modes[m].cost}x stake</td>
                  {showRtp ? <td>{math[m] ? `${math[m].rtp.toFixed(2)}%` : '—'}</td> : null}
                  <td>{math[m] ? `${math[m].maxWinX.toLocaleString('en')}x` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small">
            Wins and the maximum win are multiples of the base stake. A round ends as soon as it reaches its maximum win.
            Static Storm has no multipliers, so its highest possible win is {math.STATIC_STORM ? math.STATIC_STORM.maxWinX.toLocaleString('en') : '10,240'}x
            (the Night Host on all 4,096 ways); every other mode can reach {cfg.maxWinX.toLocaleString('en')}x.
          </p>
        </section>
        <section>
          <h3>Controls</h3>
          <ul className="small controls-guide">
            <li><strong>Auto (circular arrows)</strong>: auto bets. Choose 10, 25, 50, 100 or 250 rounds and, optionally, to stop when a bonus starts, on a single win of 10x/50x/100x or more, or if the balance falls by 10x/50x/100x the stake; then confirm. Auto bets also stop when the balance runs out. While they run, the spin button shows the rounds left and stops them, as does Space or the Auto button.</li>
            <li><strong>Round spin button</strong> (or Space): plays a round. While a round plays it shows a stop square and skips the animations.</li>
            <li><strong>Bet ˄ / ˅</strong>: raise or lower the stake. The cost of a round is shown under the bet when it differs from the stake.</li>
            <li><strong>⚡ Turbo</strong>: faster animations.</li>
            <li><strong>2× Chance</strong>: switches Double Chance (stake x1.5, twice the chance to start a bonus) on or off.</li>
            <li><strong>Tower button (Buy)</strong>: opens the Feature Spins and Bonus Buy menu. A bonus purchase asks for confirmation.</li>
            <li><strong>☰ and ⓘ</strong>: open these rules. <strong>Speaker</strong>: mutes all sound.</li>
            <li><strong>Balance</strong> shows your current balance; <strong>Win</strong> counts up to the round's total win.</li>
            <li><strong>Signal Panel</strong> (left): lights one lamp per Antenna that lands; during a bonus it shows the spins left.</li>
            <li><strong>Win screens</strong>: round wins of 10x, 50x, 200x and 1,000x show GOOD, MEGA, INSANE and EPIC WIN (MAX WIN at the maximum). Each new tier opens with a short jump scare: a sudden face, a loud sound and a flash. Turn on your device's reduced-motion setting to switch the scares off. The button or Space skips the count, then collects.</li>
          </ul>
        </section>
        <section>
          <h3>Disclaimer</h3>
          <p className="small">
            Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game
            to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any
            physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game
            Server and not from events within the web browser. TM and © 2026 Stake Engine.
          </p>
        </section>
        <button className="primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
