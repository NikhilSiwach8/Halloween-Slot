# The Hollow Hour

*"Time Is a Prize. Eternity Is the Price."*

An original cinematic time-horror slot prototype. It is a 5×5 cluster-pays game with
cascades, built around three signature systems: the **Echo Ledger**, the **Three Ages** and
the **Paradox Split**. Time Corruption, Paradox Debt, Clockmaker's Choice and a four-stage
bonus, **The Last Second**, support them.

> **Demo credits only.** There are no deposits, cashouts, wallets or payments. Outcomes come
> from a seeded development PRNG, not a certified gaming RNG. RTP figures are simulation
> estimates, not validated values. This is not a Stake Engine (or any platform) build; see
> [docs/STAKE_ENGINE_INTEGRATION.md](docs/STAKE_ENGINE_INTEGRATION.md).

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
| `npm run simulate -- --profile stateless` | Simulate the round-scoped profile |

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
| Cluster pays | 5×5, orthogonal, min 5, wild substitution and bridging, cascades and gravity, cascade limit, 5,000× round cap |
| Three Ages | Original → Fractured → Hollow → collapse to wild. Ages raise the cluster multiplier, generate debt and feed the ledger. |
| Time Corruption | Fracture Spread around every win, plus Orb Burst |
| Echo Ledger | Bounded, expiring memory of past boards. Echoes return one age older and are consumed. The inspectable ledger drawer shows sources and status. |
| Paradox Split | Present / Hollow timelines with a cell-level merge into one evaluated board |
| Paradox Debt | Four-state meter with spin-start modifiers and a Discharge effect |
| Clockmaker's Choice | Two clickable paths, each a real engine effect |
| The Last Second | Four player-started stages: Frozen, Divergence, Echo, Collapse |

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

- **Placeholder visuals and audio:** symbol art is hand-built SVG, the environment is
  procedural, and sounds are synthesized.
- **Math:** prototype only. Pooled RTP is ≈95.5% across 3M simulated rounds. The highest
  observed win, ~741×, is far below the 5,000× cap. There is no volatility review.
- **Clockmaker's Choice:** no measured RTP difference between paths at the current sample
  size.
- **Persistence:** cross-round persistence of debt and ledger makes the standalone game
  stateful, which is incompatible with stateless platforms. The stateless profile measures
  ≈90.1% RTP and weakens the signature mechanics (see MATH_MODEL §4).
- **Not included:** autoplay, bonus buy and localisation.
- **Fonts:** Cinzel and Cormorant Garamond load from Google Fonts. A platform build must
  self-host them.
- **Browser coverage:** the 3D background is about 221 kB gzip, lazy-loaded. Low-end mobile
  performance has not been profiled. E2E covers Chromium only.
- **Session state:** balance resets on reload by design.
