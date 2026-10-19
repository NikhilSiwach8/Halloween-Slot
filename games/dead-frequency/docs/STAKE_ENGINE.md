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
  evaluator. It refuses any round whose recomputed wins do not equal the stored wins and the stored
  total. If the RGS `payoutMultiplier` differs from the book (for example a server-side payout
  cap), the bet has already been taken, so the round still plays and the win shown is the
  server's figure, which is what gets paid.
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
| `?sessionID&rgs_url` → `/wallet/authenticate`, `/wallet/play` `{amount, currency, mode}` (`amount` is the base bet; the RGS charges amount × the mode's cost), `/wallet/end-round` | Done; tested against a mock RGS serving real books (balances match to the cent) |
| Bet levels, min/max and `stepBet` from authenticate; currency symbols and decimals | Done |
| Unfinished round settled on load | Done |
| **Bet replay** `?replay=true&game&version&mode&event&rgs_url[&currency&amount]`, no wallet calls, controls and balance hidden, Play / Play Again | Done; tested with a 50,000x replay |
| RTP and max win per mode, cost per mode, every prize value, controls guide, disclaimer in the rules | Done |
| Space = bet, mute, autoplay with confirmation and stop conditions | Done |
| Jurisdiction flags: `disabledSpacebar`, `disabledBuyFeature` (hides Feature Spins and Bonus Buy), `disabledTurbo`, `displayRTP` | Done |
| Static build, no requests to other origins, clean console | Verified in Chromium |
| Error messages for `ERR_IPB`, `ERR_IS`, `ERR_VAL`, `ERR_GEN`, `ERR_MAINTENANCE` and others, read from `error`, `code` or `status.statusCode` | Done |
| A buy or Feature Spins mode the RGS refuses as an invalid bet (`ERR_VAL`, e.g. a cap on the total of a buy) | Clear message; that mode, and any costing as much or more, is disabled with "Above the bet limit: lower the bet" until the bet is lowered |
| Wins shown at the bet the round was played at | Changing the bet after a round no longer changes the win shown |
| `mode` sent to `/wallet/play`: the spelling the RGS lists in authenticate `config.betModes` (matched case-insensitively); upper-case `index.json` name if it lists none | Done; unit-tested with object and array forms |
| **Social mode** (`social=true` or the RGS `socialCasino` flag): Stake's restricted-phrase list applied to all visible text, `aria-label` and `title` | Done; browser scan of 8 screens incl. full rules found 0 restricted phrases |
| **Viewports** desktop 1200×675, laptop 1024×576, popout L 800×450, popout S 400×225, mobile 425×812 / 375×667 / 320×568 | All fit without scrolling, board never distorted (square cells); popouts use a landscape layout with controls on the right |
| Audio: looping music track (ducks under scares and win screens), synthesized effects and ambience with moods per bonus, mute remembered | Done |

## Open items before submission

1. **Done: Doll replaced by the Widow.** The Doll (a young girl) was removed because of Stake's
   rule against child-like characters **(skill)**. **The Widow**, a clearly adult caller, now has
   the same slot and pays, with painted art (`public/assets/symbols/widow.webp`, cut out with
   `scripts/art/cutout_single.py`). The doll image is no longer in the build.
2. **Confirm `mode` on a test session.** If the RGS lists its modes in `config.betModes`, the
   client uses that exact spelling. If it lists none, the client sends `BASE`, `DEAD_AIR`, …. Play
   one round of every mode on the dashboard to confirm.
3. **Music licence.** The background music is a third-party track (see
   [AUDIO.md](AUDIO.md)). Confirm its licence covers use in a commercial game and keep the record;
   Stake requires rights to every asset. The effects are synthesized in code, so they are original
   to the game.
4. **Run on Stake:** upload, then play every mode in a dashboard test session, at least once with
   `social=true` and once in the mini-player, and replay the ids in `replay-examples.json`.
5. **Math is frozen after approval.** Bump `version` in `src/config/gameConfig.ts` whenever the
   math changes, then regenerate. Books carry the version, and the client rejects a mismatch.

## Regenerate

```bash
npm run df:books              # ~17 min: all 7 modes + src/config/publishedMath.json
npm run df:books:verify       # independent check of the files on disk
npm run df:replay-examples    # replay ids for the review
npm run df:stake:frontend     # static build into stake-upload/frontend (run after df:books)
```
