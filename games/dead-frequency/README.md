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
That makes the game suitable for book-based platforms such as Stake Engine. Publication files are
not generated yet; see [Next steps](#next-steps).

## Run it

From the repository root (Node 20+):

```bash
npm install
npm run df:dev        # http://localhost:5173
npm run df:build      # typecheck + production build to games/dead-frequency/dist
npm run df:test       # unit tests for this game (also part of `npm test`)
npm run df:simulate -- --modes BASE,DOUBLE_CHANCE --rounds 1000000 --seeds 1,2
npm run df:rtp -- --rounds 4000000 --bonusRounds 1000000   # low-variance RTP per mode
```

`?seed=123` gives a reproducible session. **Space** spins, or skips the current animation.

## Layout

```
games/dead-frequency/
  src/config/      gameConfig.ts (all math), types.ts, symbols.ts, measuredRtp.json
  src/engine/      rng.ts, board.ts (board draws), ways.ts (evaluation), round.ts (spins, bonuses, mystery, cap)
  src/simulation/  simulator.ts (whole-round simulation)
  src/app/         App.tsx, useGame.ts (round playback), audio.ts (synth placeholders), styles.css
  src/components/  Reels, SymbolArt (image + SVG fallback), assets.ts, Overlays, StationMenu, Rules
  public/assets/   symbols/*.webp
  scripts/         simulate.ts, rtp.ts, art/slice_symbol_sheet.py
  tests/           engine.test.ts
  docs/            GAME_RULES.md, MATH_MODEL.md
```

The engine is pure TypeScript with no UI dependencies. `playRound(cfg, mode, rng)` returns the
whole round (paid spin, reveal, Retune, Mystery prize, every bonus spin). The UI only plays that
result back, so the player's clicks (for example "Play the tape") never change an outcome.

## Documentation

- [docs/GAME_RULES.md](docs/GAME_RULES.md): every rule, trigger and the resolution order
- [docs/MATH_MODEL.md](docs/MATH_MODEL.md): targets, method and measured RTP per mode

## Known limitations

- **Placeholder audio.** Sounds are synthesized. The symbol art is final-style artwork in
  `public/assets/symbols/` (512×512 WebP, cut from the symbol sheet with
  `scripts/art/slice_symbol_sheet.py`). The hand-built SVGs remain as a fallback.
- **Development PRNG.** It is not a certified RNG, and there are demo credits only.
- **Simulated RTP only.** Figures are simulation estimates with stated error bars, not certified
  values.
- **No platform integration yet.** There are no Stake Engine books or lookup tables and no RGS
  adapter for this game.
- **Missing features.** There is no autoplay, no localisation, and no browser (Playwright) tests
  for this game yet.

## Next steps

1. Generate weighted books and lookup tables per mode, as The Hollow Hour does in
   `scripts/export-books.ts`. That gives an exact RTP per mode.
2. Add an RGS adapter and replay mode.
3. Add final audio, backgrounds and win animations.
