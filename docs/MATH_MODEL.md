# Math Model — v0.2.0 (Stake Engine profile)

> **Published figures come from the integer lookup table** in `math/publish/`, verified by
> `npm run books:verify`. Simulation figures are labelled as estimates.
>
> Nothing here has been reviewed or approved by Stake Engine or any lab. The local demo's
> development PRNG is not a certified RNG.

## 1. Published math (mode `base`, cost 1.0)

| Metric | Value | Source |
|---|---|---|
| **RTP** | **96.0000%** | Exact, Σ weight·payout / Σ weight over the lookup table |
| **Max win** | **50,000× stake** | Declared cap; 20 books pay exactly 50,000× |
| Max-win probability | 1 in 5,000,025 | Lookup table |
| Hit rate (any win) | 29.82% (1 in 3.35) | Lookup table |
| The Last Second (bonus) | 1 in 339 | Exact opening-board scan of 46,753,196 boards (137,732 triggers) |
| Books | 270,420 | 175,428 zero · 73,845 base win · 20,727 bonus · 400 big win · 20 max win |
| Distinct payouts | 2,505 | |
| Win-range coverage | 16/16 ranges populated, 0× through 50,000× | `books:verify` |
| Replay check | 2,807 books at export + 2,022 at verify (every max-win book included) | Each reproduced its `payoutMultiplier` exactly |

### Criteria probabilities used for the lookup table

| Criteria | Probability | How it is set |
|---|---|---|
| zero | 0.701685 | Natural share of non-bonus rounds |
| basegame (win, no bonus) | 0.295369 | Remainder |
| freegame (normal bonus) | 0.002945 | Natural trigger rate − big win − max win |
| bigwin (bonus 2,000×–50,000×) | 1.0e-6 | Plan: 1 in 1,000,000 |
| wincap (exactly 50,000×) | 2.0e-7 | Plan: 1 in 5,000,000 |

Inside `basegame` and `freegame`, book weights are ∝ (1 + payout)^λ, with λ solved so the
table RTP is exactly 96.00%. The solved λ = −0.0015, which is almost flat: the published
distribution is essentially the natural one.

### Why big-win and max-win books use their own weight set

With normal bonus weights, a 50,000× round is far too rare to find by search. Normal bonuses
reached at most ~2,700× in 20,000 samples.

As in the Math SDK, where win-cap criteria use dedicated reel weights, max-win candidates are
generated with `weights.wincapBonus`: more Skulls, Ravens and Wilds in bonus boards.

- **Max win:** 20 books in 110k–150k search rounds hit the cap.
- **Big win:** 400 more books between 2,000× and 50,000× fill the high win ranges.

Each book records its weight set and replays exactly. **Its probability comes only from the
lookup table**, never from how it was found.

## 2. Game parameters (`src/config/gameConfig.ts`)

| Item | Value |
|---|---|
| Grid / clusters | 5×5, orthogonal, min 5; wilds substitute and bridge; wild-only never pays |
| Initial weights | lows 260 each; Watch 70, Orb 55, Portal 50, Hourglass 50, Raven 35, Skull 30; Wild 35, **Ticket 16**, Clockmaker 1 |
| Refill / bonus weights | as initial without Ticket / Clockmaker |
| Paytable | 1×–15× (lows) up to 5×–250× (Skull) by cluster size; see GAME_RULES §3 |
| Age multiplier | 1 + 1·Fractured + 2·Hollow per cluster, max ×10 |
| Bonus stage multipliers | ×1, ×1, ×2, ×3 |
| Hour Multiplier | start ×1; +1 per collapse to wild (not the Stage IV collapse); ×3 per Paradox Discharge in the bonus; max ×1,000 |
| Round-start debt | 0 / 25 / 50 / 80 (weights 45/25/18/12) |
| Remnants of the Hour | 0–3 entries (30/35/25/10); ages 55/35/10 |
| Clockmaker path | Drawn in-round, equal weights |
| Persistence | ROUND: nothing carries between rounds |
| Max win | 50,000× (round cap, base + bonus) |

Money is integer units. A book's `payoutMultiplier` equals the round's total win at a stake
of 100 units. Every award is `floor(stake·pay·multipliers/100)`, and pays are integers, so
any stake divisible by 100 units reproduces `bet × payoutMultiplier / 100` exactly.
Stake's 6-decimal amounts always satisfy this.

## 3. Natural-play estimate (simulation, v0.2.0)

`npm run simulate -- --rounds 1000000 --seeds 101`, at the natural distribution with no
lookup-table tilt. This is what the local demo plays. Full output is in
`docs/simulation/v0.2.0-natural-101.txt`.

| Metric | Value |
|---|---|
| RTP (estimate) | 94.13% ± 1.85% (95% CI 92.28–95.98%) |
| Hit frequency | 29.93% |
| The Last Second | 1 in 346, average 100.0× |
| Clockmaker's Choice | 1.80% of rounds (paths 9,081 / 8,897) |
| Paradox Split | 1.50% of rounds |
| Echo activation | 1.74% of rounds; 1.58 entries recorded per round, including Remnants |
| Debt Discharge | 0.175% of rounds |
| Max observed win | 1,880.75× (the natural tail rarely gets near the cap; see §1) |
| Contribution | base 69.3% · bonus 30.7% · age-multiplier uplift 28.9% |
| Win distribution | 0×: 70.07% · 1–2×: 18.00% · 2–5×: 9.43% · 5–10×: 1.93% · 10–25×: 0.37% · 25–100×: 0.11% · 100–1000×: 0.09% · ≥1000×: 0.001% |

The table's 96.00% differs from the natural estimate because the table carries its
explicitly planned big-win and max-win probabilities. Those add about 1.5 points of RTP that natural
play almost never reaches: 1.0 from the max win (50,000 × 2e-7) and roughly 0.5 from big
wins. The tilt λ is negligible.

## 4. History

| Version | Notes |
|---|---|
| v0.1.0 | Session-persistent Debt and Echo Ledger, player-picked Clockmaker, 5,000× cap. Measured ≈95.5% in natural play; reports in `docs/simulation/v0.1.0/`. That model was **stateful**, so it is incompatible with Stake. Making it naively stateless dropped RTP to ≈90% and left echoes almost inert. |
| v0.2.0 | Stateless redesign (round-start debt, Remnants of the Hour, in-round echo eligibility, in-round Clockmaker), Hour Multiplier, 50,000× cap, published book and lookup-table math. |

## 5. Reproduce

```bash
npm run books          # generate (deterministic: --seed 20261016 by default)
npm run books:verify   # independent checks + replay
npm run simulate -- --rounds 1000000 --seeds 101
```

## 6. Open items

- Have the files checked by the Stake Engine upload validation, and confirm seed-based book
  content is acceptable. See STAKE_ENGINE_INTEGRATION.md.
- No volatility class has been assigned. The natural per-round standard deviation is
  ≈ 9.4× stake, from the simulation's standard error.
- Clockmaker paths are drawn 50/50 and are not separately priced. Either path can be shown
  as the Clockmaker's choice.
