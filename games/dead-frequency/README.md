# Dead Frequency

*"Some signals should never be found."*

An original haunted-radio horror slot prototype. Its theme: a station that went off air in 1979
has started broadcasting again. Tonight's host is not alive.

It is a **6×4, 4,096-ways** game with a **50,000× max win** and:

| Feature | Summary |
|---|---|
| **Static & Retune** (signature) | Static lands in stacks and all of it reveals as one symbol. A reveal that wins nothing **retunes** once to a different symbol. |
| **Three bonuses** | **Night Shift**: a Signal Meter multiplier that climbs per Static reel and never resets. **Possession**: Sticky Static. **Dead Air**: Expanding Static plus x2–x25 multiplier wilds. |
| **Mystery Bonus** | The **Unmarked Tape** on reel 6 holds a cash prize (2x–500x) or any of the three bonuses. |
| **Double Chance** | 1.5× stake; every bonus-triggering Antenna count is exactly twice as likely. |
| **Feature Spins** | **Static Storm** (8x, 2–3 full Static reels every spin) and **Haunted Wilds** (12x, 2–3 multiplier wilds every spin). |
| **Bonus Buy** | Night Shift 80x · Possession 160x · Dead Air 275x. |

Every round is independent: nothing carries over from one round to the next.

**Stake Engine:** the upload is ready in [`stake-upload/`](stake-upload/README.md). It contains
the math files for all 7 modes (exactly 96.00% RTP each) and the static frontend build, which
talks to the RGS and supports bet replay. It has not been uploaded or approved yet; see
[docs/STAKE_ENGINE.md](docs/STAKE_ENGINE.md) for the checks and the open items.

## Run it

From the repository root (Node 20+):

```bash
npm install
npm run df:dev        # http://localhost:5173
npm run df:build      # typecheck + production build to games/dead-frequency/dist
npm run df:test       # unit tests for this game (also part of `npm test`)
npm run df:simulate -- --modes BASE,DOUBLE_CHANCE --rounds 1000000 --seeds 1,2
npm run df:rtp -- --rounds 4000000 --bonusRounds 1000000   # low-variance RTP per mode
npm run df:books && npm run df:books:verify                 # Stake math upload (~17 min) + checks
npm run df:replay-examples && npm run df:stake:frontend     # replay ids + frontend build for Stake
```

`?seed=123` gives a reproducible session. **Space** spins, or skips the current animation.

## Layout

```
games/dead-frequency/
  src/config/      gameConfig.ts (all math), types.ts, symbols.ts, publishedMath.json (written by df:books)
  src/engine/      rng.ts, board.ts (board draws), ways.ts (evaluation), round.ts (spins, bonuses, mystery, cap)
  src/simulation/  simulator.ts (whole-round simulation)
  src/app/         App.tsx, useGame.ts (round playback), audio.ts (synthesized sound design),
                   socialText.ts (Stake.us wording), styles.css
  src/math/        bookFormat.ts (round <-> book events), books.ts (Stake books + lookup tables)
  src/platform/    platform.ts (local demo, Stake RGS client, bet replay)
  src/components/  Reels, SymbolArt (image + SVG fallback), assets.ts, Background (animated canvas scene),
                   Overlays (incl. the "Signal Intercepted" bonus intro), StationMenu, Rules
  public/assets/   symbols/*.webp
  scripts/         simulate.ts, rtp.ts, export-books.ts, verify-books.ts, replay-examples.ts, art/
  stake-upload/    the Stake Engine upload: math/, frontend/, replay-examples.json
  tests/           engine.test.ts, stake.test.ts
  docs/            GAME_RULES.md, MATH_MODEL.md, STAKE_ENGINE.md, ART_PROMPTS.md
```

The engine is pure TypeScript with no UI dependencies. `playRound(cfg, mode, rng)` returns the
whole round (paid spin, reveal, Retune, Mystery prize, every bonus spin). The UI only plays that
result back, so the player's clicks (for example "Play the tape") never change an outcome.

## Documentation

- [docs/GAME_RULES.md](docs/GAME_RULES.md): every rule, trigger and the resolution order
- [docs/MATH_MODEL.md](docs/MATH_MODEL.md): targets, method and measured RTP per mode
- [docs/STAKE_ENGINE.md](docs/STAKE_ENGINE.md): Stake Engine files, checks and open items

## Known limitations

- **Interim Widow art.** The Widow (which replaced the Doll) uses a built-in drawing until
  painted art arrives; the prompt is in [docs/ART_PROMPTS.md](docs/ART_PROMPTS.md).
- **Code-synthesized audio.** Sound is generated live with the Web Audio API: original, but not
  studio-recorded.
- **Local demo RNG.** The local demo uses a development PRNG with demo credits. On Stake, the RGS
  picks every outcome from the published books.
- **Not yet run on Stake Engine.** It has only been tested against a mock RGS that serves the real
  books.
- **Missing features.** There is no autoplay, no languages other than English, and no Playwright
  tests in the repo for this game.

## Next steps

1. Add the Widow artwork (docs/ART_PROMPTS.md).
2. Upload `stake-upload/` and test every mode, social mode, the mini-player and the replay ids on
   the dashboard.
