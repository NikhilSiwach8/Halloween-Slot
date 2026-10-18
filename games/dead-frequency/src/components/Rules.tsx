import { PAYING_SYMBOLS } from '../config/symbols';
import { MODE_ORDER } from '../config/gameConfig';
import type { GameConfig } from '../config/types';
import { formatX } from '../app/format';
import measured from '../config/measuredRtp.json';
import { SymbolArt } from './SymbolArt';

export function RulesModal({ cfg, onClose }: { cfg: GameConfig; bet: number; onClose: () => void }) {
  const rtp = measured.modes as Record<string, number>;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Rules">
      <div className="overlay-card rules">
        <h2>How the station works</h2>
        <section>
          <h3>Ways</h3>
          <p>{cfg.reels} reels × {cfg.rows} rows, {(cfg.rows ** cfg.reels).toLocaleString()} ways. Wins pay left to right from reel 1 for {cfg.minWayLength}+ adjacent reels. Each winning symbol pays its value × the number of ways.</p>
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
          <p>An <strong>Unmarked Tape</strong> on reel 6 plays the Mystery Bonus. The tape holds either a cash prize from 2x to 500x or one of the three bonuses. The prize is decided when the spin lands.</p>
          <h3>Double Chance</h3>
          <p>Raises the stake to 1.5×. Every bonus-triggering Antenna count becomes twice as likely to land. Feature Spins and Bonus Buys are not affected.</p>
          <h3>Feature Spins & Bonus Buy</h3>
          <p>Static Storm ({cfg.modes.STATIC_STORM.cost}x): every spin has 2 or 3 full reels of Static. Haunted Wilds ({cfg.modes.HAUNTED_WILDS.cost}x): every spin has 2 or 3 extra multiplier wilds. Neither can trigger a bonus. Bonuses can also be bought: Night Shift {cfg.modes.BUY_NIGHT_SHIFT.cost}x, Possession {cfg.modes.BUY_POSSESSION.cost}x, Dead Air {cfg.modes.BUY_DEAD_AIR.cost}x.</p>
        </section>
        <section>
          <h3>Return to player</h3>
          <table className="rtp">
            <tbody>
              {MODE_ORDER.map((m) => (
                <tr key={m}><td>{cfg.modes[m].name}</td><td>{cfg.modes[m].cost}x</td><td>{rtp[m] ? `${rtp[m].toFixed(2)}%` : '—'}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="small">RTP is a simulated estimate ({measured.method}), not a certified figure. Maximum win: {cfg.maxWinX.toLocaleString()}x the base stake per round. Reaching it ends the round. Malfunction voids all pays and plays.</p>
        </section>
        <button className="primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
