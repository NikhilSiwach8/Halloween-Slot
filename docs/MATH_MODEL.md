# Math Model and Simulation

> **Status: prototype math.** Every figure on this page was measured by
> `npm run simulate` on this codebase. They are estimates with stated sampling error.
>
> - The RTP is **not** validated or certified.
> - The RNG is a development PRNG, **not** a certified gaming RNG.
> - No volatility rating has been approved.
>
> Treat the target RTP (~96%) as a design parameter under test, not a result.

## 1. Model summary

| Item | Value (DEFAULT_CONFIG) |
|---|---|
| Grid | 5×5, orthogonal cluster pays, min cluster 5 |
| Symbol draw | Independent weighted draw per cell (no reel strips) |
| Initial weights | lows 260 each; Watch 70, Orb 55, Portal 50, Hourglass 50, Raven 35, Skull 30; Wild 35, Ticket 17, Clockmaker 1 (total 1,383) |
| Refill weights | as initial, Ticket 0, Clockmaker 0 |
| Bonus weights | as refill, Wild 60 |
| Cascade limit | 25 winning cascades per spin |
| Age multiplier | 1 + 1·Fractured + 2·Hollow per cluster, max ×10 |
| Bonus stage multipliers | ×1, ×2, ×3, ×5 |
| Round cap | 5,000× stake (base + bonus) |
| Credits | integer units (100 per credit), floor rounding per award |

All parameters live in `src/config/gameConfig.ts` and are checked by `validateConfig()`.

### State that carries across rounds (standalone profile)

Paradox Debt, the Echo Ledger and the split prime persist across rounds. The simulator
plays rounds back-to-back through the same engine, so this state is simulated exactly as a
player would see it. The *stateless profile* (`STATELESS_CONFIG`) resets debt and ledger at
every round start.

### Choice modelling

Clockmaker's Choice needs a player decision. The simulator takes a policy:

| Policy | Behaviour |
|---|---|
| `ALTERNATE` | Default; switches path each time |
| `PRESERVE_PAST` | Always chooses Preserve the Past |
| `BREAK_FUTURE` | Always chooses Break the Future |
| `RANDOM` | Picks a path at random |

Choice policy randomness uses its own RNG stream, so it never shifts outcome draws.

## 2. Tuning history (all measured)

| Step | Change | Measured RTP | Hit freq. |
|---|---|---|---|
| 1 | First config (pays ×1, low weight 150) | 7.6% (50k rounds) | 15.2% |
| 2 | Concentrated low symbols (260), more wilds; 4+ Portal / 4+ Hourglass opening-board triggers; every winning cluster recorded in the ledger; echoes return one age older | 54.0% (60k rounds) | 29.9% |
| 3 | Paytable ×5, Ticket weight 17, stage multipliers [1,2,3,5] | ~94–96% (see below) | 29.9% |

## 3. Results — standalone profile (DEFAULT_CONFIG)

Runs used stake 100 units. Full reports are in `docs/simulation/`.

**Reproduce:**

```
npm run simulate -- --rounds 1000000 --seeds 101 --policy ALTERNATE
```

### Main runs (Clockmaker policy ALTERNATE)

| | seed 101 | seed 202 | seed 303 |
|---|---|---|---|
| Rounds | 1,000,000 | 1,000,000 | 1,000,000 |
| **RTP (observed)** | **96.14%** | **95.47%** | **94.95%** |
| 95% CI (±1.96·SE) | 94.82–97.46% | 94.15–96.79% | 93.68–96.22% |
| Hit frequency | 29.88% | 29.86% | 29.85% |
| Zero-win frequency | 70.12% | 70.14% | 70.15% |
| Avg payout per round | 0.9614× | 0.9547× | 0.9495× |
| Avg win on winning rounds | 3.218× | 3.198× | 3.181× |
| The Last Second frequency | 0.355% (1 in 282) | 0.351% (1 in 285) | 0.347% (1 in 288) |
| Avg Last Second payout | 84.59× | 83.45× | 83.48× |
| Clockmaker's Choice frequency | 1.803% | 1.803% | 1.799% |
| Paradox Split (rounds with ≥1) | 1.54% | 1.56% | 1.53% |
| Echo activation (rounds with ≥1) | 2.62% | 2.62% | 2.60% |
| Echoes projected / recorded per round | 0.0557 / 0.450 | 0.0553 / 0.449 | 0.0551 / 0.448 |
| Paradox Debt Discharge (rounds) | 0.864% | 0.862% | 0.854% |
| Max **observed** win | 659.25× | 740.75× | 707.75× |
| Max **configured** win (cap) | 5,000× | 5,000× | 5,000× |
| Cap hits / cascade-limit hits | 0 / 0 | 0 / 0 | 0 / 0 |
| Runtime | 36.6 s | 36.8 s | 37.6 s |

**Pooled (3,000,000 rounds): RTP ≈ 95.52%.** The per-run spread is 94.95–96.14%. The
standard error per 1M-round run is about 0.65 percentage points, because the bonus and the
tail drive the variance. Pinning RTP to ±0.1% would take roughly 50M+ rounds, or an
analytic or book-based model.

### Contribution to total awards (seed 101)

| Source | Share | How it is measured |
|---|---|---|
| Base game | 68.8% | |
| The Last Second | 31.2% | |
| Three Ages multiplier uplift | 32.2% | Σ amount − amount/multiplier |
| Wins after a temporal feature in the same spin | 32.9% | |
| Rounds containing Clockmaker's Choice | 4.1% | |

The uplift and post-feature rows overlap with the base and bonus rows. They are attribution
views, not additive shares.

### Win-size distribution (seed 101, × stake)

| 0 | [1,2) | [2,5) | [5,10) | [10,25) | [25,50) | [50,100) | [100,500) | [500,1000) | ≥1000 |
|---|---|---|---|---|---|---|---|---|---|
| 70.121% | 17.872% | 9.285% | 2.014% | 0.400% | 0.074% | 0.124% | 0.109% | 0.001% | 0 |

The smallest possible cluster pays 1× stake, so the (0,1×) bucket is empty by design.

### Cascade distribution (seed 101, winning cascades per round)

| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7+ |
|---|---|---|---|---|---|---|---|
| 70.12% | 23.76% | 4.77% | 0.96% | 0.24% | 0.09% | 0.03% | ~0.01% |

### Symbol ages (seed 101, 1M rounds)

| Count | Original | Fractured | Hollow | → Wild |
|---|---|---|---|---|
| Age transitions | — | 1,069,379 | 49,853 | 17,747 |
| Real symbols in winning clusters | 2,030,046 | 82,652 | 12,424 | — |

### Clockmaker policy comparison (seed 404, 500,000 rounds each)

| Policy | RTP | 95% CI | Echo activation | Discharge |
|---|---|---|---|---|
| Always Preserve the Past | 94.43% | 92.58–96.28% | 3.31% | 0.928% |
| Always Break the Future | 96.87% | 94.97–98.78% | 1.84% | 0.772% |

The intervals overlap. Clockmaker rounds account for only ~4% of awards. **These runs do not
show that either path pays more**, and the game must not claim it. Measuring a real
difference needs paired runs per Clockmaker event (same board, both paths), which is a
listed next step.

## 4. Results — stateless profile (STATELESS_CONFIG, seed 505, 1,000,000 rounds)

| Metric | Value |
|---|---|
| RTP (observed) | **90.06%** (95% CI 88.84–91.27%) |
| Hit frequency | 29.80% |
| The Last Second | 1 in 285, avg 74.63× |
| Echo activation | **0.26%** of rounds (vs 2.6% standalone) |
| Discharge | **0.003%** of rounds |
| Max observed win | 668.00× |

When debt and the ledger reset every round, echoes almost never have an earlier spin to draw
from. Debt also never fills. Both systems become near-inert, and RTP drops by ~5 points.
A stateless (platform) build therefore needs a **redesign** of how memory and instability
live inside a single round, not just a re-tune. See STAKE_ENGINE_INTEGRATION.md.

## 5. Observations and open issues

1. **Max win realism.** The highest observed win in 3M rounds is ~741×, against a 5,000× cap.
   Most platforms expect the declared max win to be realistically reachable. Either lower
   the cap or add a high-end path (e.g. bonus multiplier growth), then measure its frequency.
2. **Volatility.** The measured standard error (≈0.65 pt per 1M rounds) implies a per-round standard deviation of ≈ 6.5–6.7× stake. No volatility
   class has been assigned or reviewed.
3. **Feature contribution.** Paradox Split (~1.5% of rounds) and echoes (~2.6%) fire often
   enough to be seen. They are still minor RTP contributors; the age multiplier is the
   major one.
4. **Integer rounding.** Every award is floored to whole units. At the lowest stake (20
   units) a 1× win is exactly 20 units, so no fractional loss occurs on the paytable's
   granularity.
5. **Feature-trigger influence.** Debt state is captured before the board is drawn. It
   changes only corruption chance and split size, through a fixed table. Nothing adapts to
   the player's results.
