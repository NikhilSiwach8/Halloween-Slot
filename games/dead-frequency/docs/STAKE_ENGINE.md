# Dead Frequency on Stake Engine

**Status:** the math upload and the frontend build are generated, and both pass every check below.
**Nothing has been uploaded to or run on Stake Engine yet.** The game is not approved.

Requirements come from the installed `stake-math-sdk`, `stake-web-sdk` and `stake-game-developer`
skills. They say they are distilled from Stake's official docs and approval guidelines. The live
docs could not be opened from this environment, so confirm anything marked **(skill)** on the
dashboard.

## What gets uploaded

`games/dead-frequency/stake-upload/` (step-by-step instructions are in its README):

| Path | What it is |
|---|---|
| `math/index.json` | The 7 modes with name, cost, book file and lookup table |
| `math/books_<mode>.jsonl.zst` | zstd JSON lines: `id`, `events`, `payoutMultiplier` (+ `criteria`, for analysis) |
| `math/lookUpTable_<mode>_0.csv` | `id,weight,payoutMultiplier`, uint64, no header |
| `frontend/` | Static build (`index.html`, JS, CSS, fonts, symbol images); relative paths only |
| `replay-examples.json` | Book ids per mode for the review: loss, normal win, big win, max win, bonus trigger |
| `math-summary.json` | Per-mode statistics; for review, not for upload |

## Modes

| Mode (`index.json` / RGS `mode`) | Cost | Books | RTP | Max win | Max win odds |
|---|---|---|---|---|---|
| `base` / `BASE` | 1.0 | 260,100 | 96.00% | 50,000x | 1 in 8,000,000 |
| `double_chance` / `DOUBLE_CHANCE` | 1.5 | 260,100 | 96.00% | 50,000x | 1 in 6,000,000 |
| `static_storm` / `STATIC_STORM` | 8.0 | 200,046 | 96.00% | 10,240x | 1 in 5,000,000 |
| `haunted_wilds` / `HAUNTED_WILDS` | 12.0 | 200,080 | 96.00% | 50,000x | 1 in 8,000,000 |
| `night_shift` / `NIGHT_SHIFT` | 80.0 | 100,090 | 96.00% | 50,000x | 1 in 2,000,000 |
| `possession` / `POSSESSION` | 160.0 | 100,090 | 96.00% | 50,000x | 1 in 2,000,000 |
| `dead_air` / `DEAD_AIR` | 275.0 | 100,160 | 96.00% | 50,000x | 1 in 20,000 |

`payoutMultiplier` is in hundredths of the **base** bet for every mode (1150 = 11.5× the base
bet), so a mode's RTP is E[payoutMultiplier] / 100 / cost.

## How the books are made (`src/math/books.ts`)

- **One book is one complete round,** played by the real engine and stored in full (`src/math/bookFormat.ts`):
  - every board as it landed (24 symbol codes plus wild multipliers);
  - the Static reveal and Retune;
  - every spin's paid win, the Signal Meter and retriggers;
  - the Mystery prize and every bonus spin.

  Way wins are not stored. The client recomputes them from the revealed board with the same
  evaluator. It refuses any round whose recomputed wins do not equal the stored wins, the stored
  total and the RGS `payoutMultiplier`.
- **Criteria.** A criterion's probability is fixed up front, and books inside it are equally
  likely.
  - **Base / Double Chance** are split by the Antenna count, which the engine draws from an exact
    table: normal (0–2), Night Shift (3), Possession (4) and Dead Air (5–6). Forcing the count
    samples exactly that slice of the game. So the criteria probabilities are exact, and every
    bonus gets 20,000 books instead of the ~1,000 natural sampling would give.
  - **wincap:** max-win rounds, found with boosted symbol weights. This is the Math SDK's win-cap
    reel set. Each is a legal round of the game; its probability comes from the lookup table.
  - **bigwin:** 12 rounds in each of the ranges 1,000–2,500x, 2,500–5,000x, 5,000–10,000x,
    10,000–25,000x and 25,000x up to the max. This guarantees there are no gaps in obtainable wins.
    It is weighted to 0.3% of the RTP.
- **Exact RTP.** Inside every criterion except wincap, the weights get a gentle tilt,
  ∝ (1 + payout)^λ. λ is solved by bisection so the integer table returns exactly 96%. The tilts
  are tiny (|λ| ≤ 0.011), so the tables stay very close to the game's natural odds.
- **Natural vs published odds.** The published max-win odds are design choices set in the tables.
  - Base and Double Chance: natural max-win odds are roughly 1 in 80–100M and 1 in 45M. They were
    set to 1 in 8M and 1 in 6M to meet the "more often than 1 in 10,000,000" guidance **(skill)**.
  - Dead Air buy: 1 in 20,000 is close to its natural rate (measured at 1 in 21,000–23,000).

## Checks (`npm run df:books:verify`, run on the generated files)

| Check | Result |
|---|---|
| `index.json` format; every book has `id` / `events` / `payoutMultiplier`; rows are 3 uint64 values | Pass |
| Book ids and payouts identical between books and lookup table (what the RGS hashes on upload) | Pass, all 7 modes |
| RTP per mode within 90–98% | 96.000000% each |
| RTP spread between modes ≤ 0.5% | 0.000000% |
| 100,000+ books per mode **(skill)** | 100,090 – 260,100 |
| Hit rate more often than 1 in 20 **(skill)** | 35.1% (base) – 99.8% (buys) |
| Max payout equals the declared max win, per mode | Pass (Static Storm 10,240x, others 50,000x) |
| Max win more often than 1 in 10,000,000 **(skill)** | 1 in 20,000 – 1 in 8,000,000 |
| No gaps in obtainable win ranges **(skill)** | Pass, all modes |
| Every book decodes with the client decoder and adds up to its payout | 1,220,756 / 1,220,756 |

## Frontend (`src/platform/platform.ts`)

| Item | Status |
|---|---|
| `?sessionID&rgs_url` → `/wallet/authenticate`, `/wallet/play` `{amount, mode}`, `/wallet/end-round` | Done; tested against a mock RGS serving real books (balances match to the cent) |
| Bet levels, min/max and `stepBet` from authenticate; currency symbols and decimals | Done |
| Unfinished round settled on load | Done |
| **Bet replay** `?replay=true&game&version&mode&event&rgs_url[&currency&amount]`, no wallet calls, controls and balance hidden, Play / Play Again | Done; tested with a 50,000x replay |
| RTP and max win per mode, cost per mode, every prize value, controls guide, disclaimer in the rules | Done |
| Space = bet, mute, no autoplay | Done |
| Jurisdiction flags: `disabledSpacebar`, `disabledBuyFeature` (hides Feature Spins and Bonus Buy), `disabledTurbo`, `displayRTP` | Done |
| Static build, no requests to other origins, clean console | Verified in Chromium |
| Error messages for `ERR_IPB`, `ERR_IS`, `ERR_VAL` and others | Done |

## Open items before submission

1. **Content risk: the Doll symbol.** Stake's rules **(skill)** forbid "artistic depictions of
   children or child-like characters in any gambling context". The Doll art is a porcelain doll of
   a young girl, and Possession uses her face in its intro. Replace it with a non-child-like design
   (for example an empty antique doll's dress, a ventriloquist dummy of an adult, or a cracked
   mannequin head) before submitting.
2. **`mode` string case.** `/wallet/play` sends the `index.json` name in upper case (`BASE`,
   `DEAD_AIR`, …), following the RGS doc example (`"mode": "BASE"` with `index.json` name `base`).
   Replay maps either case back. Confirm on the dashboard's test session.
3. **Social casino (Stake.us) wording.** The game's text is not yet swapped for social mode
   ("bet" → "play", "buy" → "play", "Bonus Buy" → "get bonus"…). This is only needed for Stake.us.
4. **Final audio.** Sounds are synthesized placeholders. Assets must be unique to the game.
5. **Mini-player / popout and the full device list** **(skill)**: only 1280×800 and 390×844 were
   tested.
6. **Run on Stake:** upload, then play every mode in a dashboard test session and replay the ids in
   `replay-examples.json`.
7. **Math is frozen after approval.** Bump `version` in `src/config/gameConfig.ts` whenever the
   math changes, then regenerate. Books carry the version, and the client rejects a mismatch.

## Regenerate

```bash
npm run df:books              # ~17 min: all 7 modes + src/config/publishedMath.json
npm run df:books:verify       # independent check of the files on disk
npm run df:replay-examples    # replay ids for the review
npm run df:stake:frontend     # static build into stake-upload/frontend (run after df:books)
```
