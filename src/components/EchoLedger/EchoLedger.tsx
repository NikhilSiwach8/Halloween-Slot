import { SYMBOLS } from '../../config/symbols';
import type { GameConfig } from '../../config/types';
import type { EchoEntry } from '../../mechanics/echoLedger/echoLedger';
import { AGE_NAMES } from '../../mechanics/threeAges/ages';
import { cellName } from '../../app/presentation';
import { SymbolTile } from '../Symbol/SymbolTile';

const REASON: Record<EchoEntry['reason'], string> = {
  HOLLOW_FORMED: 'turned Hollow',
  CLUSTER_WON: 'won in a cluster',
  AGED_CLUSTER_WON: 'won while aged',
  HOUR_REMNANT: 'remnant of the last hour, aimed',
};

export function EchoLedgerButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button className="echo-button" onClick={onOpen} data-testid="echo-ledger-toggle" aria-label={`Echo Ledger, ${count} active echoes`}>
      <span className="echo-icon" aria-hidden="true">&#x29D6;</span>
      <span>Echo Ledger</span>
      <span className="echo-count" data-testid="echo-count">{count}</span>
    </button>
  );
}

function Row({ e, cfg }: { e: EchoEntry; cfg: GameConfig }) {
  return (
    <li className={`echo-row status-${e.status.toLowerCase()}`}>
      <div className="echo-row-tile"><SymbolTile sym={e.symbol} age={e.age} uid={-1000 - Number(e.id.slice(1))} small /></div>
      <div className="echo-row-text">
        <strong>{e.id} · {SYMBOLS[e.symbol].name}</strong> <em>{AGE_NAMES[e.age]}</em>
        <span>
          {REASON[e.reason]} at {cellName(e.position, cfg)} in {e.roundId}
          {e.spinIndex > 0 ? ` (bonus stage ${e.spinIndex})` : ''}
        </span>
        <span className="echo-status">
          {e.status === 'ACTIVE' ? `active · expires after spin #${e.expiresAfterSpinSeq}` : e.status === 'CONSUMED' ? `consumed${e.consumedBy ? ` in ${e.consumedBy.roundId} at ${cellName(e.consumedBy.position, cfg)}` : ''}` : e.status.toLowerCase()}
        </span>
      </div>
    </li>
  );
}

export function EchoLedgerPanel({ active, recent, cfg, onClose }: { active: EchoEntry[]; recent: EchoEntry[]; cfg: GameConfig; onClose: () => void }) {
  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label="Echo Ledger" data-testid="echo-ledger-panel" onClick={onClose}>
      <div className="drawer-body" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <h2>Echo Ledger</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close Echo Ledger">&times;</button>
        </header>
        <p className="drawer-note">
          The ledger remembers past board states — never unpaid prizes. Up to {cfg.echo.maxEntries} entries; each expires after {cfg.echo.ttlSpins} spins.
          An Echo can only be projected in a later spin, returns one Age older, and is consumed when used.
        </p>
        <h3>Active ({active.length})</h3>
        {active.length ? <ul className="echo-list">{[...active].reverse().map((e) => <Row key={e.id} e={e} cfg={cfg} />)}</ul> : <p className="muted">No echoes yet. Winning clusters and Hollow symbols leave echoes.</p>}
        <h3>Recently consumed / expired</h3>
        {recent.length ? <ul className="echo-list">{recent.map((e) => <Row key={`${e.id}-${e.status}`} e={e} cfg={cfg} />)}</ul> : <p className="muted">Nothing yet.</p>}
      </div>
    </div>
  );
}
