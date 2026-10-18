# The Hollow Hour

> **This repository holds two games.** This README covers *The Hollow Hour*.
> **[Dead Frequency](games/dead-frequency/README.md)** is a second horror slot set at a haunted
> radio station: 6×4 ways, 50,000× max win, Static & Retune mystery symbols, three bonuses, a
> Mystery Bonus, Double Chance, Feature Spins and Bonus Buy. Run it with `npm run df:dev`.

*"Time Is a Prize. Eternity Is the Price."*

An original cinematic time-horror slot prototype. It is a 5×5 cluster-pays game with
cascades, built around three signature systems: the **Echo Ledger**, the **Three Ages** and
the **Paradox Split**. Time Corruption, Paradox Debt, Clockmaker's Choice and a four-stage
bonus, **The Last Second**, support them.

> **Math v0.2.0 is built to the Stake Engine model.**
>
> - Rounds are stateless.
> - Publication files (books, lookup table, index) are generated with an exact **96.00%
>   RTP** computed from the table.
> - Max win is **50,000× stake**.
> - There is an RGS client adapter.
>
> None of it has been run on Stake Engine yet, so the game is not published, certified or
> approved; see [docs/STAKE_ENGINE_INTEGRATION.md](docs/STAKE_ENGINE_INTEGRATION.md). The local
> demo uses demo credits and a development PRNG.

## Quick start

Requires Node 20+ (tested on Node 22).

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Unit and math tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright: desktop + Pixel 7) |
| `npm run simulate -- --rounds 1000000 --seeds 1,2,3 --policy ALTERNATE` | Headless simulator |
| `npm run simulate -- --profile session` | Simulate the old cross-round (non-Stake) profile |
| `npm run books` | Generate Stake publication files into `math/publish/` (about 6 min) |
| `npm run books:verify` | Independently verify those files (format, RTP, max-win frequency, win-range gaps, replay) |

Playwright uses its own Chromium. In environments that ship a different build, set
`PW_CHROMIUM_PATH=/path/to/chromium`.

### Development URL parameters

| Param | Effect |
|---|---|
| `?seed=123` | Reproducible session |
| `?dev=1` | Adds a clearly labelled **DEV ONLY** panel with forced triggers (Last Second, Clockmaker, Paradox Split, Hourglass win, Full debt). The ordinary configuration rejects forced triggers. |
| `?speed=fast` or `?speed=instant` | Animation speed override |
| `?bg=0` | Disables the 3D background |

**Controls:** Spin button or **Space** spins, starts the next bonus stage, or skips the
current animation. The HUD has the stake −/+, the rules (?) and settings (⚙) buttons and
mute. Settings holds volume, mute, reduced motion, animation speed and the session log
export.

## What is playable

Every mechanic below runs through the engine:

| Mechanic | What it does |
|---|---|
| Cluster pays | 5×5, orthogonal, min 5, wild substitution and bridging, cascades and gravity, cascade limit, **50,000× round cap** |
| Three Ages | Original → Fractured → Hollow → collapse to wild. Ages raise the cluster multiplier, generate debt and feed the ledger. |
| Time Corruption | Fracture Spread around every win, plus Orb Burst |
| Echo Ledger | Round-scoped memory, seeded with "Remnants of the Hour" and fed by every win. Echoes return one age older and are consumed. The inspectable ledger drawer shows sources and status. |
| Paradox Split | Present / Hollow timelines with a cell-level merge into one evaluated board |
| Paradox Debt | Four-state meter. Each round starts from a drawn value; spin-start modifiers; Discharge effect |
| Clockmaker's Choice | Two paths, each a real engine effect. The Clockmaker picks inside the round, and the UI reveals his pick. |
| The Last Second | Four player-started stages (Frozen, Divergence, Echo, Collapse) plus the **Hour Multiplier**, which a Discharge triples |

## Documentation

| Doc | Contents |
|---|---|
| [docs/GAME_RULES.md](docs/GAME_RULES.md) | Every rule, trigger, limit and the resolution order |
| [docs/MATH_MODEL.md](docs/MATH_MODEL.md) | Parameters, tuning history and measured simulation results |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layers, key decisions, rendering, assets |
| [docs/STAKE_ENGINE_INTEGRATION.md](docs/STAKE_ENGINE_INTEGRATION.md) | What was checked, the gap list and next steps |
| `docs/simulation/` | Raw simulator output used in MATH_MODEL.md |

## Replacing placeholder art and audio

- **Symbols:** drop images into `public/assets/symbols/` and map them in
  `src/rendering/assetManifest.ts`. The spec is in that file. A missing image falls back
  to the built-in SVG.
- **Background plate:** set `BACKGROUND_IMAGE` in the same file.
- **Audio:** call `audio.registerSample(category, url)` in `src/audio/AudioManager.ts`;
  the categories are listed there.

## Known limitations

- **Never run on Stake Engine:** the math files and the RGS adapter have not been uploaded or
  run against a real RGS; the adapter is tested only against a mocked RGS. Whether Stake
  accepts seed-based books must be confirmed (see the integration doc).
- **Placeholder visuals and audio:** symbol art is hand-built SVG, the environment is
  procedural, and sounds are synthesized.
- **Local demo vs published table:** the demo draws rounds naturally. Its long-run return
  differs slightly from the published table's exact 96.00%, which is what a platform uses.
- **Not included:** autoplay, bonus buy and localisation.
- **Browser coverage:** low-end mobile performance has not been profiled. E2E covers
  Chromium only.
