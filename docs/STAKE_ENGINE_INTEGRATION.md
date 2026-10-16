# Stake Engine Integration

**Status: math and client are built to the documented Stake Engine model, but nothing has run
on Stake Engine.** No RGS, upload or approval process has been executed. The game is **not**
published, certified or approved.

## Sources used

| Source | Access | What it gave |
|---|---|---|
| `stakeengine.github.io`, `stake-engine.com/docs` | **Blocked** | This session's network policy refused both hosts; they could not be read |
| Official `github.com/StakeEngine/math-sdk` @ `a6dccd8` (2026-09-22): `docs/rgs_docs/RGS.md`, `docs/rgs_docs/data_format.md`, `docs/math_docs/*` | Read | Endpoints, money format, bet levels, publication file format, bet modes |
| Official `github.com/StakeEngine/web-sdk` @ `1843d60` | Read | `round.state` is the book's `events` array (`packages/utils-xstate`, `rgs-fetcher/schema.ts`) |
| `engineio/ts-client` (linked by you) | Read | Exact request shapes: `{protocol}://{rgs_url}/wallet/...` with `sessionID`; `API_MULTIPLIER = 1_000_000` |
| Installed skills `stake-math-sdk` / `stake-web-sdk` (approval notes) | Read | They say they are distilled from the official approval guidelines. Not verifiable here, so items sourced only from them are marked **(skill)** |

## What is implemented

### Math (mode `base`, cost 1.0)

- **Stateless rounds.** Paradox Debt and the Echo Ledger are round-scoped (`persistence: ROUND`).
  - Round-start draws (starting debt, Remnants of the Hour) come from the round's own RNG
    stream.
  - The Clockmaker's path is drawn inside the round, so no player decision changes an
    outcome.
  - A unit test checks that a seed reproduces the same round regardless of earlier play.
- **Publication files**, written by `npm run books` to `math/publish/`:
  - `index.json`: `{"modes":[{"name":"base","cost":1.0,"events":"books_base.jsonl.zst","weights":"lookUpTable_base_0.csv"}]}`
  - `books_base.jsonl.zst`: zstd-compressed JSON lines with `id`, `events`, `payoutMultiplier`.
  - `lookUpTable_base_0.csv`: `id,weight,payoutMultiplier`, uint64 integers, payouts identical
    to the books.
- **Book content.** Each round is fully determined by (engine, config version, seed, bonus
  weight set). A book's single event `hollowHourRound` carries exactly that data plus a
  summary.
  - The client replays the round with the same engine.
  - The client **refuses** to show a round whose replay does not equal
    `bet × payoutMultiplier / 100`.
- **Weights.** Criteria probabilities are fixed: zero / basegame / freegame / bigwin / wincap.
  Inside basegame and freegame, a gentle power tilt is solved by bisection so the lookup
  table's RTP is exactly the target. This mirrors the Math SDK's distributions plus optimizer.
  Max-win candidates are generated with a dedicated bonus weight set (`wincapBonus`), the
  analogue of a win-cap reel set; that set is recorded in the book.
- **Verification.** `npm run books:verify` independently re-reads the files and checks:
  - required fields and uint64 rows;
  - payouts match between books and table;
  - RTP is within 90–98%;
  - hit rate is better than 1 in 20 **(skill)**;
  - max payout equals the declared max win;
  - max win is more frequent than 1 in 10M **(skill)**;
  - no gaps across 16 win ranges **(skill)**;
  - a sample of books, plus every max-win book, replays to exactly its payout.

### Client

- **Adapter selection.** `StakeRgsAdapter` (`src/platform/StakeRgsAdapter.ts`) is selected
  automatically when the URL has `sessionID` and `rgs_url`.
- **Endpoints** (per the official RGS doc and ts-client):
  - `POST /wallet/authenticate` `{sessionID, language}`;
  - `POST /wallet/play` `{sessionID, amount, mode:"BASE"}`;
  - `POST /wallet/end-round` `{sessionID}`;
  - `POST /bet/event` `{sessionID, event}`, used to record bonus-stage reveal progress.
- **Money:** 6-decimal integers. Bet levels come from authenticate (within min/max, divisible
  by `stepBet`). Currency symbol and decimals use the table in the official doc.
- **Resume:** an active round found at authenticate is ended on load.
- **Jurisdiction flags:** `disabledSpacebar` is honoured; `displayRTP` controls the RTP line
  in the rules.
- **Static build:** fonts are bundled (`@fontsource`, OFL). An e2e test asserts that loading
  the game makes **no external requests**.
- **Rules screen:** shows the RTP and max-win frequency from the published table
  (`src/config/publishedMath.json`), the 50,000× max win, all pays, and all triggers.
- **Other requirements:** Spacebar = bet, mute and mobile layout were already in place.
  There is no autoplay.
- **Tests:** unit tests cover the adapter against a mocked RGS (authenticate, play, replay,
  end-round, verification failure). It has **not** been run against a real RGS.

## Remaining gaps / to verify on the platform

| # | Item | Status |
|---|---|---|
| 1 | Read the live approval guidelines and RGS docs (blocked here) and confirm every **(skill)** item | Open |
| 2 | Upload `math/publish/` through the Stake Engine dashboard and pass its math checks | Open; not attempted |
| 3 | Run against a real RGS session: authenticate, play, end-round, `/bet/event` resume, error codes (`ERR_IPB`, `ERR_IS`, …) | Open; only mocked |
| 4 | Book content style: books store seed + summary, not a full event list. Confirm with Stake that client-side deterministic replay is acceptable. The full event stream (`recordEvents`) can be exported per book instead if required; files would be much larger. | **Needs confirmation** |
| 5 | Bet replay mode (replaying a past bet from a platform link) | Open; the engine can replay any book, but the URL contract was not in the docs read |
| 6 | Mini-player / popout sizes and the full mobile size list **(skill)** | Open; only 1280×720 and Pixel 7 tested |
| 7 | `lang` / currency combinations, social-casino wording (`socialCasino` flag) **(skill)** | Open; English only, wording not adapted |
| 8 | Sound and art must be final, original or licensed **(skill)** | Open; placeholders |
| 9 | Optionally re-optimise with the official Math SDK optimizer, or confirm the in-house weighting is acceptable | Open |
| 10 | More books per mode if required (now 290k+; the skill guidance is 100k–1M) | Can be raised with `--natural` |

## How to regenerate and check the math

```bash
npm run books            # ~6 min: generates math/publish/* and src/config/publishedMath.json
npm run books:verify     # independent format + statistics + replay check
npm run build            # bakes the published RTP into the rules screen
```

**Bump `version` in `src/config/gameConfig.ts` whenever the math changes.** Books carry the
version, and the client rejects a mismatch.
