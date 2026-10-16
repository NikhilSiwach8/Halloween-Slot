# The Hollow Hour — Game Rules

*"Time Is a Prize. Eternity Is the Price."*

All numbers below are read from `src/config/gameConfig.ts` (`DEFAULT_CONFIG`). The in-game
rules screen is generated from the same config, so the two cannot drift apart.

**Math version 0.2.0 — Stake Engine profile.** Every round is independent of every other round.
The published outcome table (books + lookup table, `math/publish/`) defines the probabilities:
**RTP 96.00%** (exact, from the table) and a **maximum win of 50,000× stake**.

Local demo: 1 credit = 100 integer units; stakes 0.20–10.00. On Stake Engine, amounts and
bet levels come from the RGS (6 implied decimals).

## 1. Board and clusters

- 5 columns × 5 rows. Row 0 is the top row.
- A **cluster** is 5 or more matching paying symbols connected **orthogonally** (not diagonally).
- Detection is a deterministic breadth-first flood fill, evaluated symbol by symbol from the
  highest-ranked symbol (Skull) to the lowest (Brass Cog).
- **Chrono Wilds** substitute for every paying symbol.
  - A wild may bridge two otherwise separate groups of the same symbol into one cluster.
  - A wild may belong to clusters of different symbols at the same time; each cluster pays.
  - A group made only of wilds never pays.
- **Overlaps:** clusters of the same symbol are disjoint by construction. Clusters of
  different symbols overlap only through shared wilds.
- Void Tickets and the Clockmaker never take part in clusters.

## 2. Spin sequence and cascades

The engine resolves each spin in this exact order. Animations only replay the result.

1. Validate the request (phase, permitted stake, sufficient balance) and deduct the stake.
2. Draw the opening board (initial weights; Tickets and the Clockmaker can only appear here).
   These are always the round's first 25 random draws.
3. Round-start draws: the starting Paradox Debt (§8), then the Remnants of the Hour (§6).
4. Start the spin: snapshot the Paradox Debt state.
5. Pre-evaluation features, in order:
   1. Clockmaker's Choice: the Clockmaker picks a path inside the round (§9).
   2. 4+ Hourglasses on the board project 2 echoes.
   3. 4+ Time Portals on the board open a Paradox Split.
6. Cascade loop:
   1. Evaluate clusters. Stop if there are none, if 25 winning cascades have already paid
      (the cascade limit), or if the round cap has been reached.
   2. Record every cluster's award once in the payout ledger. Each winning cluster also
      writes one Echo Ledger entry.
   3. Remove the winning symbols. Frozen symbols in the bonus age instead of being removed.
   4. Time Corruption: Fracture Spread, then Orb Burst if a Chrono Orb cluster won.
   5. Gravity and refill (refill weights; no Tickets or Clockmaker).
   6. If an Hourglass cluster won, project 1 echo. If a Portal cluster won, open a Paradox
      Split (max 1 split per spin).
7. Discharge checkpoint: if Paradox Debt is full, discharge (§8), then return to step 6.
8. If 3+ Void Tickets were on the opening board, enter The Last Second (§10). Otherwise settle.
9. Settle the round exactly once and credit the total.

**Cascade limit:** when 25 winning cascades have paid in one spin, the board is not evaluated
again. The limit is reported (`CASCADE_LIMIT_REACHED`).

**Displayed wins** are never mixed:

| Label | Meaning |
|---|---|
| Spin win | This base spin, or this bonus stage |
| Total round win | Everything awarded in the round, including the bonus |
| Last round | The settled total of the previous round |

## 3. Payouts

Award (integer units) = `floor(stake × pay × ageMultiplier × stageMultiplier × hourMultiplier / 100)`,
where `pay` is the paytable value in hundredths of the stake. Stage and Hour multipliers are
1 outside The Last Second.

| Symbol | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Revenant Skull | 5 | 7 | 10 | 14 | 20 | 30 | 40 | 60 | 80 | 125 | 250 |
| Raven | 4 | 5 | 7 | 10 | 14 | 20 | 30 | 40 | 60 | 80 | 125 |
| Hourglass | 3 | 4 | 5 | 7 | 10 | 14 | 20 | 30 | 40 | 50 | 75 |
| Time Portal | 2.5 | 3 | 4 | 5 | 7 | 10 | 14 | 20 | 30 | 40 | 50 |
| Chrono Orb | 2.5 | 3 | 4 | 5 | 7 | 10 | 14 | 20 | 30 | 40 | 50 |
| Broken Watch | 2 | 2.5 | 3 | 4 | 5 | 7 | 10 | 14 | 20 | 30 | 40 |
| Vigil Candle / Moon Dial | 1.25 | 1.5 | 2 | 2.5 | 3 | 4 | 5 | 7 | 10 | 13 | 20 |
| Winding Key / Brass Cog | 1 | 1.25 | 1.5 | 2 | 2.5 | 3.5 | 4.5 | 6 | 8 | 11 | 15 |

Values are × stake, before multipliers. Wilds, Tickets and the Clockmaker do not pay on
their own. **Maximum win per round: 50,000× stake.** When it is reached, the award that
crosses the cap is truncated (`capApplied`) and the round ends.

## 4. The Three Ages

Every paying symbol is in one of three ages:

| Age | Name | Shown by |
|---|---|---|
| I | Original | Clean frame, no badge |
| II | Fractured | Chamfered (notched) frame, crack lines, **II** badge, leaking particles |
| III | Hollow | Double dashed flickering frame, central void, ghost offset, **III** badge |

Ages are always shown by shape, badge and motion as well as color, never by color alone.

- Ages advance **only** through game events (corruption, echoes, splits, discharge,
  Clockmaker, bonus rules), never through time or animation.
- One step at a time: Original → Fractured → Hollow. Ages never skip and never reverse.
- Advancing a Hollow symbol again **collapses it into a Chrono Wild**. The split is the
  exception: it never collapses symbols.
- **Mechanical effect:** cluster multiplier = 1 + 1 per Fractured symbol + 2 per Hollow symbol
  in the cluster, capped at ×10. Only real symbols count; wilds have no age.
- **Other consequences:** turning Hollow adds +3 Paradox Debt and writes an Echo Ledger
  entry. Collapsing into a wild adds +4 Debt.
- **Persistence:** ages last while the symbol stays on the board during the spin. New
  symbols arrive Original. In The Last Second, frozen symbols keep their age across stages.

## 5. Time Corruption

**Fracture Spread** runs after every winning cascade:

| Property | Rule |
|---|---|
| Eligible cells | Surviving, non-frozen paying symbols orthogonally adjacent to a removed winner |
| Chance | 25% per eligible cell; +5% if the spin started Unstable, +10% if it started Critical |
| Draw order | Ascending cell index |
| Effect | One age step (a Hollow symbol collapses into a wild) |
| Limit | 8 transformations per cascade |
| Chaining | Corruption never triggers more corruption. Changed cells are evaluated on the next cascade, after gravity. |

**Orb Burst:** a winning Chrono Orb cluster also ages 3 random eligible symbols.

## 6. The Echo Ledger

The ledger remembers **board states, never prizes**.

**Recording.** Each winning cluster records its oldest real symbol (symbol, age, position,
round, board, cascade, spin). Every symbol that turns Hollow is also recorded.

- At most 4 new entries per spin.
- At most 12 entries are kept; the oldest is evicted first.
- An entry expires once 10 more spins have started.
- **Scope: one round.** The ledger is empty when a round begins; nothing carries over from
  earlier rounds.
- **Remnants of the Hour:** right after the opening board, 0–3 entries are drawn as part of
  the round's outcome (count weights 30/35/25/10). Each has a symbol drawn by refill weights,
  an age drawn Original 55 / Fractured 35 / Hollow 10, and a random position. They count as
  created before the first spin.

**Eligibility.** An entry is eligible if it is active, unexpired, and was created
**earlier**: in an earlier spin, or in an earlier cascade of the same spin. Newest entries
are selected first.

**Projection** (RESTORE):

1. The entry's recorded position becomes the remembered symbol, **one age older** (Hollow
   stays Hollow).
2. If that cell is a wild, Ticket, Clockmaker, frozen or empty, the neighbours up, right,
   down and left are tried, in that order.
3. If no target exists, the entry stays active and the next eligible entry is tried.
4. A projected entry is consumed and adds +6 Paradox Debt. An echo-restored Hollow symbol
   does not create a new entry.

**What projects echoes:**

| Source | Echoes |
|---|---|
| Winning Hourglass cluster | 1 |
| 4+ Hourglasses on the opening board | 2 |
| Discharge | 1 |
| Preserve the Past | 2 |
| Last Second Stage III | 3 |

**No duplicate payouts.** Projection only changes a cell; it never creates an award. Any
win that follows comes from evaluating the current board, gets a new unique award id, and
is recorded once. Unit tests confirm that every `WIN_RECORDED` is immediately preceded by
the `CLUSTER_DETECTED` it pays.

## 7. Paradox Split

**Trigger:** a winning Time Portal cluster, 4+ Portals on the opening board, or Last Second
Stage II. In the base game, at most once per spin.

**Resolution model — "Present positions, Hollow states":**

- **Timeline A (The Present)** is the current board.
- **Timeline B (The Hollow)** is the same board with every non-frozen paying symbol one age
  older. Hollow stays Hollow.
- **Merge:** 6 cells are drawn uniformly from the cells where the timelines differ. Add +2
  cells if the spin started Critical, + any cells primed by Break the Future, or use 10
  cells in Stage II.
- Those cells take their Timeline B state; every other cell keeps Timeline A.
- The merged board is evaluated by the normal evaluator. **There is one award stream.**
  Timeline B never pays on its own.
- Adds +10 Paradox Debt.

## 8. Paradox Debt

A deterministic meter from 0 to 100.

| State | Range | Effect |
|---|---|---|
| Stable | 0–39 | — |
| Unstable | 40–69 | Corruption chance +5% |
| Critical | 70–99 | Corruption chance +10%, Paradox Split +2 cells |
| Discharge | 100 | Discharges at the next checkpoint |

- **Gains:**

  | Event | Debt |
  |---|---|
  | Symbol turns Hollow | +3 |
  | Collapse into a wild | +4 |
  | Echo projected | +6 |
  | Paradox Split | +10 |
  | Clockmaker's Choice | +8 |
  | Last Second Stage IV | +25 |

- Only the state **at spin start** changes probabilities. It is fixed before the board is
  drawn and is included in the simulation.
- **Discharge** happens at most once per spin, after the cascades (and in Stage IV, before
  evaluation):
  1. The meter resets to 0.
  2. A uniformly chosen 3×3 region ages every eligible symbol one step.
  3. 1 echo is projected.
  4. Cascades resume.
- **Fairness:** the meter never reads the balance, the stake or the win/loss history, and
  never changes a result that has already been generated.
- **Scope: one round.** Each round starts from a drawn value, which is part of the round's
  outcome: 0 (weight 45), 25 (25), 50 (18) or 80 (12). The meter carries from the base game
  into the round's bonus, then ends with the round.

## 9. Clockmaker's Choice

**Trigger:** the Clockmaker on the opening base board (initial weight 1 of 1,383).

**Selection: the Clockmaker chooses.** The path is drawn inside the round (equal weights), so
the whole round is determined when it starts, as book-based platforms require. The UI shows
both paths, then reveals the one he picked. An interactive player choice still exists as
`clockmaker.selection = 'PLAYER'` (used only by the non-Stake `SESSION_CONFIG`). In that mode
exactly one selection is accepted per feature instance.

| Path | Effect |
|---|---|
| **Preserve the Past** | Project up to 2 eligible echoes. Each echo missing from the ledger instead fractures 1 random Original symbol. |
| **Break the Future** | 5 random eligible symbols advance one age (Hollow collapses into a wild). The next Paradox Split takes +3 cells. That prime persists until used. |

Afterwards every Clockmaker on the board becomes a Chrono Wild, and Debt rises by +8.

Both paths change gameplay. The game makes no claim that either path is better.

## 10. The Last Second (bonus)

**Trigger:** 3+ Void Tickets on the opening base board.

- **Entry:** free; it is part of the triggering round.
- **Structure:** four stages. Each stage is one bonus spin, started by the player.
- **Boards:** each stage draws a fresh board from the bonus weights. Frozen cells keep
  their position, symbol and age.
- **Hour Multiplier:** starts at ×1 and lasts the whole bonus.
  - +1 for every symbol that collapses into a Chrono Wild. The Stage IV collapse does not
    count.
  - **A Paradox Discharge multiplies it by 3.**
  - Maximum ×1,000.
  - Every bonus award is multiplied by stage multiplier × Hour Multiplier.

| Stage | Win × | Pre-evaluation effect |
|---|---|---|
| I Frozen | 1 | Up to 4 symbols of the most common paying kind lock in place as Fractured |
| II Divergence | 1 | Paradox Split with 10 cells |
| III Echo | 2 | Project up to 3 echoes; each echo missing from the ledger instead fractures 1 random Original symbol |
| IV Collapse | 3 | Every frozen symbol becomes a Chrono Wild; Debt +25; Discharge if full |

**Frozen cells** never move under gravity. They are immune to corruption, echoes and
splits. When a frozen symbol wins, it ages instead of being removed; a frozen Hollow that
wins collapses into a wild and unfreezes. Only 4 cells can freeze (< 5), so frozen cells
alone can never form a cluster, and cascades always end.

| Property | Rule |
|---|---|
| Chaining | No Tickets or Clockmaker appear in the bonus, so it cannot retrigger |
| End | After Stage IV, or as soon as the round cap is reached |
| Payout cap | Shared with the round: 50,000× stake total |
| Reset at end | Frozen cells and the Hour Multiplier clear. The round ends, and with it its Debt and Echo Ledger. |

## 11. Not included

There is no autoplay, no bonus buy and no gamble or jackpot. The local demo uses demo credits
and a seeded sfc32 development PRNG, which is **not** a certified gaming RNG. On Stake Engine,
the RGS selects each round from the published table, and the client only replays and
displays it.
