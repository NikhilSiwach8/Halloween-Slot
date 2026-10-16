# Stake Engine Integration Assessment

**Status: not integrated, and not compatible as-is.** This project is a standalone prototype.
It is **not** publishable, certified or approved on Stake Engine or any other platform.

## What was checked, and how

| Source | Access | Notes |
|---|---|---|
| `stakeengine.github.io`, `stake-engine.com/docs` | **Blocked** | The session's network policy refused both hosts; they could not be read directly |
| Official repo `github.com/StakeEngine/math-sdk` @ `a6dccd8` (2026-09-22) | Read | `docs/rgs_docs/RGS.md` (RGS endpoints, money, bet levels, wallet/play/end-round/event, error codes); `docs/rgs_docs/data_format.md` (publication files); `docs/math_docs/*` (game format, bet modes) |
| Official repo `github.com/StakeEngine/web-sdk` @ `1843d60` (2025-11-28) | Cloned | Frontend reference implementation (Svelte + PixiJS) |
| `engineio/ts-client` (the repo you linked) | Read | TypeScript RGS client: `RGSClient({url})` with `Authenticate`, `Play({amount, mode})`, `EndRound`, `Event` |
| Installed skills `stake-math-sdk` / `stake-web-sdk` (`approval-math.md`, `approval-frontend.md`) | Read | These *state* they are distilled from the official approval guidelines. I could not verify that against the live site, so items sourced only from them are marked **(skill)**. |

## How Stake Engine resolves outcomes (from the official repo)

- **Math is precomputed.** Each bet mode uploads three files:
  - `index.json`;
  - `books_<mode>.jsonl.zst`: zstd-compressed JSON lines, each with `id`, `events`,
    `payoutMultiplier`;
  - `lookUpTable_<mode>.csv`: `id, probability(uint64), payoutMultiplier(uint64)`. The
    payout multiplier must match the book exactly.
- **Play flow:**
  1. `/wallet/authenticate` returns the balance, bet levels, step bet and jurisdiction flags.
  2. `/wallet/play` (`amount`, `mode`) debits the stake and returns `round`. This is one
     book, selected by the RGS by weight.
  3. `/wallet/end-round` pays out.
  4. `/bet/event` records in-progress progress for resume.
- **Money:** integers with **6 decimals** (1,000,000 = 1.0). Currency affects display only.
- **Statelessness (skill):** each bet must be independent of previous rounds; no round
  continuation between sessions beyond active-round resume.

## Gap list

| # | Requirement | This prototype | Gap / required work |
|---|---|---|---|
| 1 | Outcomes come from precomputed books chosen by the RGS | Engine resolves live with a seeded PRNG | Build a **book exporter**: run the engine headless (stateless profile, fixed choice handling), write each round's event list + `payoutMultiplier` (stake = 1.0 → integer multiplier ×100), weight it, write the lookup table and `index.json`, compress with zstd. In production the browser engine must **only replay** the returned book. |
| 2 | Stateless rounds (skill) | Paradox Debt, Echo Ledger and split prime persist across rounds | Use a ROUND-scope design. `STATELESS_CONFIG` exists and is simulated, but measures **90.06% RTP**, echoes fire in 0.26% of rounds and Discharge in 0.003%: the identity mechanics go inert. **Design work needed:** e.g. seed the ledger from the round's own opening board and cascades, size debt gains so the meter can fill within one round (bonus especially), then re-tune. |
| 3 | No mid-round player decisions inside a book | Clockmaker's Choice changes the outcome mid-round | Options: (a) make the choice presentation-only (the book fixes the path, labelled as such); (b) resolve the path inside the math with a fixed rule; (c) model each path as a separate bet mode (both ≤0.5% RTP apart, **(skill)**). Today's UI says the choice changes gameplay, so option (a) needs the rules text changed. |
| 4 | Bonus stages started by the player | Engine pauses between stages | Compatible as **pacing only**: the whole bonus is inside one book, and the frontend reveals it stage by stage. The adapter must not request anything per stage. Use `/bet/event` to persist the revealed stage for resume. |
| 5 | Money in 6-decimal integers; bet levels, `minBet`/`maxBet`/`stepBet` from authenticate | Integer units, 100 per credit, fixed `bets` | Adapter converts units; the stake selector is built from `betLevels`; currency display uses the RGS currency (rules list `formatCredits` as display-only). |
| 6 | RTP 90–98% per bet mode; multiple modes within 0.5% (skill) | Standalone ≈95.5% (3M rounds, ±0.65 pt/run); stateless ≈90.1% | Re-tune the stateless model and compute exact RTP from the published lookup table (book weights), not from Monte Carlo. |
| 7 | Max win realistically obtainable, roughly more often than 1 in 10M (skill) | Cap 5,000×, max observed 741× in 3M rounds | Lower the cap or add a high-end path, then measure its book frequency. |
| 8 | Hit rate better than 1 in 20 (skill) | 29.9% | Meets the stated threshold (simulated). |
| 9 | Static build, no external fetches, strict XSS (skill) | Loads Google Fonts; everything else bundled | Self-host the Cinzel / Cormorant fonts (OFL) in the build, or use system fonts. |
| 10 | Rules must show RTP, max win, all pays, feature triggers (skill) | Rules show max win, full paytable, all triggers | Add the **RTP value** once it is final; must come from the published math. |
| 11 | Spacebar = bet; mute; autoplay needs confirmation (skill) | Spacebar spins / starts stage / skips; mute present; no autoplay | Compatible. Keep any future autoplay behind explicit confirmation with a stop control. |
| 12 | Mini-player / popout and mobile layouts (skill) | Responsive; e2e covers 1280×720 and Pixel 7; landscape CSS present | Test the popout sizes listed in the web-sdk references; not verified. |
| 13 | `lang` parameter must not break text; `en` only is acceptable (skill) | English only, ignores `lang` | Verify with other `lang` values in the platform harness. |
| 14 | Bet replay mode (skill) | Local `replay()` exists (seed + actions) | Implement replay from a platform-provided book/event. |
| 15 | Unique assets; no sample-game assets (skill) | Original SVG placeholders | Final art and audio must also be original or licensed. |
| 16 | Certified RNG | Seeded sfc32 (dev only) | Outcome selection belongs to the RGS; the client must not draw outcomes. |
| 17 | Social-casino wording (`jurisdiction.socialCasino`) (skill) | Uses "credits", "win", "stake" | Review wording rules when the jurisdiction flags are known. |

## Proposed adapter shape (not implemented)

`StakeRgsAdapter implements PlatformAdapter` using the documented endpoints. The method names
below follow `engineio/ts-client` and must be re-checked against the current official docs
before coding.

| Method | Endpoint | Behaviour |
|---|---|---|
| `getState()` | `Authenticate` | Balance, bet levels, any active round to resume |
| `spin(bet)` | `Play({ amount, mode: 'BASE' })` | Gets one book; converts its events into the existing `GameEvent` stream (or emits book events directly); then `EndRound` once the reveal finishes and the payout is non-zero |
| `chooseClockmakerPath` / `playBonusStage` | none | Reveal-only; no network call. Becomes presentation per gap #3 / #4 |

This requires the engine's event stream to be **serialisable into books**. Events are
already plain JSON. The board snapshots would need compacting to fit book-size limits.

## Exact next steps

1. Read the current official approval guidelines and RGS docs directly. They were blocked
   here. Confirm every **(skill)** item.
2. Decide the in-round design for the Echo Ledger and Paradox Debt (gap #2) and for
   Clockmaker's Choice (gap #3). Update GAME_RULES.md.
3. Re-tune the stateless config until RTP is inside the target band, with ≥1M rounds per
   seed across several seeds.
4. Write `scripts/export-books.ts`:
   - stateless engine, `recordEvents` on, compact snapshots;
   - 100k–1M books per mode;
   - integer payout multipliers;
   - lookup table with uint64 weights;
   - `index.json`;
   - zstd compression.
5. Optionally hand the books to the official Math SDK optimizer to set weights for the
   target RTP, hit-rate and max-win frequency. Compute RTP exactly from the lookup table.
6. Implement `StakeRgsAdapter` plus a book player. Remove client-side outcome generation
   from the production build; keep `LocalDemoAdapter` for development.
7. Self-host fonts. Add RTP to the rules. Wire bet levels and currency formatting. Add
   replay mode and `/bet/event` resume.
8. Run the platform's own validation and the frontend checklist (mini-player, mobile sizes,
   console and network clean). Only then submit for review.
