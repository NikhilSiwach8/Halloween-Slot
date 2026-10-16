# Architecture

```
src/
├── config/          Math & rules configuration (data only) + validation
│   ├── types.ts         GameConfig schema
│   ├── symbols.ts       symbol definitions, evaluation order
│   └── gameConfig.ts    DEFAULT_CONFIG, STATELESS_CONFIG, createDevConfig(), validateConfig()
├── engine/          Authoritative, headless game engine (no DOM, no timers)
│   ├── rng/             seedable sfc32 PRNG, weightedPick, sampleDistinct
│   ├── board/           board model, neighbours, gravity + refill
│   ├── clusters/        BFS cluster detection
│   ├── payouts/         paytable lookup, age multiplier, PayoutLedger (single authority)
│   ├── events/          typed event payloads (discriminated union)
│   ├── state/           phase machine with an explicit transition table
│   ├── context.ts       SpinContext shared with mechanics; RoundStats
│   └── GameEngine.ts    the resolution pipeline + replay()
├── mechanics/       One module per mechanic, all driven through SpinContext
│   ├── threeAges/       nextAgeTransition() — the single age rule; applyAgeSteps()
│   ├── timeCorruption/  Fracture Spread, Orb Burst
│   ├── echoLedger/      bounded EchoLedger, projectEchoes()
│   ├── paradoxSplit/    Hollow timeline derivation + merge
│   ├── paradoxDebt/     meter, states, Discharge
│   ├── clockmakerChoice/ path definitions + resolution
│   └── lastSecond/      stage table + stage effects
├── simulation/      runSimulation() — headless statistics
├── platform/        PlatformAdapter interface + LocalDemoAdapter
├── app/             React shell: useGame (event player), presentation reducer, styles
├── components/      GameBoard, Symbol, HUD, EchoLedger, ParadoxMeter, ClockmakerChoice, LastSecond, Modals
├── rendering/       3D clocktower (React Three Fiber, lazy-loaded), asset manifest
├── audio/           Web Audio manager with replaceable synthesized cues
└── utils/
scripts/simulate.ts  CLI simulator
tests/unit           Vitest: engine + mechanics (no React)
tests/e2e            Playwright: desktop + Pixel 7 viewport
```

## Key decisions

1. **The engine decides, the UI animates.**
   - `GameEngine` resolves every step synchronously and returns a list of typed events.
     Events carry board snapshots where the board changed.
   - The UI feeds those events through a pure reducer (`app/presentation.ts`) and paces
     them with timers.
   - No React component can change game state. Animation timing, skipping, reduced motion
     and recording events on or off have no effect on outcomes; unit tests cover this.

2. **One resolution pipeline.**
   - The order in GAME_RULES.md §2 lives in `GameEngine` and nowhere else.
   - Mechanics are plain functions over a `SpinContext`. They cannot reorder themselves.
   - Phases (`IDLE`, `SPINNING`, `EVALUATING`, `CASCADING`, `TEMPORAL_EFFECT`,
     `PARADOX_SPLIT`, `CLOCKMAKER_CHOICE`, `BONUS_INTRO`, `BONUS_PLAYING`,
     `BONUS_RESOLVING`, `ROUND_SETTLING`) follow an explicit transition table. An illegal
     transition throws.

3. **Centralised side effects.** All age changes go through `applyAgeSteps()` /
   `collapseToWild()`, which emit the event, write ledger entries and add debt. A mechanic
   cannot age a symbol "quietly".

4. **Single payout authority.** `PayoutLedger` is created per round.
   - Award ids are `R<n>:A<k>`. Duplicate ids and foreign-round ids are rejected.
   - The cap is applied when an award is recorded.
   - `settle()` works exactly once, and the engine also refuses to settle a round id twice.
   - The UI shows `spinWin` / `roundWin` from `WIN_RECORDED` and the balance from
     `ROUND_SETTLED`.

5. **Player decisions are explicit engine states.** Clockmaker's Choice and each bonus stage
   are waiting phases. The engine exposes `chooseClockmakerPath()` and `playBonusStage()`
   and rejects calls in any other phase. Overlapping spins are rejected both by the engine
   and by the UI.

6. **Determinism and replay.**
   - The engine's only randomness is its injected `Rng`. The browser clock is never used.
   - The engine logs every action (`SPIN`, `CHOOSE`, `BONUS_STAGE`).
     `replay(config, seed, actions)` reproduces the event log byte-for-byte; a test covers
     this.
   - Settings → *Export session log* downloads the seed and action list.

7. **Platform boundary.**
   - The UI talks only to `PlatformAdapter`, whose methods are async.
   - `LocalDemoAdapter` wraps the engine. A platform adapter can replace it without UI
     changes, apart from the gaps listed in STAKE_ENGINE_INTEGRATION.md.
   - There are no wallets, deposits or cashouts anywhere. `demoCreditsOnly: true` is part
     of the interface.

8. **Persistence.** Only user settings (volume, mute, reduced motion, speed) are written to
   `localStorage`. Balance and game state are in-memory and reset on reload.

## Rendering

- **Board, HUD and overlays:** DOM + CSS.
  - Symbols are absolutely positioned and keyed by a stable `uid`, so gravity animates as
    a CSS `top` transition.
  - Age treatments are pure CSS/SVG layers.
  - DOM text stays crisp and accessible: each tile has an ARIA label naming the symbol,
    its age and its frozen state.
- **Environment:** React Three Fiber scene (`rendering/ClocktowerScene.tsx`) with:
  - a clock face, which freezes at 11:59 in the bonus;
  - rotating gears, gothic pillars, an impossible-staircase fragment, instanced debris,
    rising motes and fog;
  - lights that tint by debt state, split (violet) and bonus (crimson).

  It is code-split (~221 kB gzip) and lazy-loaded. It falls back to a CSS gradient if
  WebGL is unavailable or the scene throws, and runs `frameloop="demand"` under reduced
  motion. `?bg=0` disables it.
- **Reduced motion** removes every CSS animation and transition and stops the 3D motion.
  Banners, highlight rings, badges and the event feed still convey every state.

## Assets

- Placeholder art is original inline SVG (`components/Symbol/symbolArt.tsx`).
- Final art goes in `public/assets/symbols/` and is mapped in `rendering/assetManifest.ts`.
  - Spec: 512×512 transparent PNG/WebP, subject in a 420 px safe area, readable at 48 px,
    no baked frame.
  - A missing or broken image falls back to the SVG.
- A background plate can be set via `BACKGROUND_IMAGE`.
- Audio categories can be swapped for samples with `audio.registerSample(category, url)`.

## URL parameters (development)

| Param | Effect |
|---|---|
| `seed=N` | Fixed RNG seed (otherwise random per load) |
| `dev=1` | Dev config (`allowForcing`) + DEV panel with forced triggers: Last Second, Clockmaker, Paradox Split, Hourglass win, Full debt |
| `speed=fast\|instant` | Animation speed override |
| `bg=0` | Disable the 3D background |

Forced triggers are rejected by the engine (`FORCING_DISABLED`) under `DEFAULT_CONFIG`, which
is the ordinary gameplay configuration.
