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

**Screen layout.** The logo is top left, the Signal Panel is left of the reels (one lamp per
Antenna, and the spins left during a bonus), and the Night Host stands to the right. The reels sit
in a radio-console frame with a multiplier plaque and an LED ticker. The control bar holds Turbo,
Balance / Win, the Bet with ˄ ˅, Double Chance (2×), the round Spin button and the Buy (tower) button.
Portrait screens stack the parts; the mini-player moves the controls into a column beside the reels.

**Title screen.** After loading, the game opens on a title screen: the logo, three vintage radio
cabinets advertising Static & Retune / On Air wilds, the Antenna bonuses and Mystery Bonus, and the
max win (numbers read from the game config), and "Click to continue" (any click or key). It is not
shown in bet replay, and the player can tick "Don't show again" (kept in the browser).

**The board.** The reels sit in a 1970s broadcast monitor: a walnut cabinet with brass art-deco
corners; a nixie-tube multiplier, a live oscilloscope and a VFD ticker on top; a VU meter and a
speaker grille either side; the reels behind curved CRT glass (scanlines, a rolling refresh band,
glare); and a channel strip (CH1–CH6) whose LEDs blink as each reel stops and light up for reels
in a win. Tiles are smoky glass with a phosphor line in each symbol's colour. The screen's
phosphor colour changes per bonus (green, violet, red), and winning tiles get a CRT scan sweep.

**Art style.** A bold cartoon look: thick dark-brown ink outlines, flat colour with hard highlight
and shadow bands, solid offset shadows, chunky Lilita One lettering, and a Halloween palette
(pumpkin, toxic green, bone, blood red, plum, warm wood) under a purple night sky with an orange
moon. The cabinet is chunky cartoon wood with skull mascots in headphones on the top corners and
rope lashings at the bottom. The painted symbols and the Night Host carry a thick sticker outline
for now (`scripts/art/toonify.py`; originals in `art/painted/`). Prompts to redraw them in the
cartoon style are in [docs/ART_PROMPTS.md](docs/ART_PROMPTS.md) ("Cartoon redraw").

**Symbol animations.** Every symbol lands with a cartoon squash-and-stretch as its reel stops,
and acts out its own loop while it is part of a win: the Night Host headbangs with flaring eyes,
the Widow drifts and fades like a ghost, the Priest levitates in a green glow, the Radio's speaker
thumps, the Microphone swings, the Headphones bounce to the beat, the Cassette rocks, the Valve
hums and flickers, the ON AIR neon buzzes, Static glitches, the Antenna sends out signal rings and
the Tape rattles. The wild, the Antenna and the Tape keep a gentle idle animation so they stand
out. Only transform and opacity animate, so it costs nothing measurable per frame.

**Depth and life.** One light from the upper left shades the whole game: bevelled glass tiles with
symbols casting shadows, a walnut cabinet with real slab thickness, domed physical buttons that press
down, an extruded logo, and solid, deeper radio cabinets on the title screen. Winning symbols turn in
3D, and the characters breathe. The Night Host acts like someone in the room: he shifts his weight,
glances at the reels, leans in while they spin and nods along on a win. For 3D re-renders of the
painted symbols, see "3D, lifelike re-renders" in [docs/ART_PROMPTS.md](docs/ART_PROMPTS.md).

**Presentation.** Reels scroll downward and stop left to right with a bounce. A small reel engine
(Reels.tsx) moves them with transforms only, one animation loop for all six reels; each stop eases
out from exactly the cruise speed, so there is no jolt. Once two Antennas
are showing, every later reel spins on longer and glows red (the tease). Round wins of 10x, 50x,
200x and 1,000x open the GOOD / MEGA / INSANE / EPIC WIN screen, and a capped round opens MAX WIN.
The amount counts up and the title climbs through the tiers it passes; the button or Space skips
the count, then collects. Every tier opens with a jump scare by that tier's ghost (the Priest, the
Widow, the Night Host, all three for EPIC, the Host in red for MAX) and a line from the station.
Reduced motion turns the scares off. Behind it all, the background has a moon, storm clouds, lightning bolts,
bats, and a power line with sparks, and it surges on every sizeable win.

## Layout

```
games/dead-frequency/
  src/config/      gameConfig.ts (all math), types.ts, symbols.ts, publishedMath.json (written by df:books)
  src/engine/      rng.ts, board.ts (board draws), ways.ts (evaluation), round.ts (spins, bonuses, mystery, cap)
  src/simulation/  simulator.ts (whole-round simulation)
  src/app/         App.tsx, useGame.ts (round playback), audio.ts (music loop + synthesized effects),
                   socialText.ts (Stake.us wording), styles.css
  src/math/        bookFormat.ts (round <-> book events), books.ts (Stake books + lookup tables)
  src/platform/    platform.ts (local demo, Stake RGS client, bet replay)
  src/components/  Reels (scrolling reels, staggered stops, tease, win pop-up), BigWin (tier celebration), Splash (title screen), Cabinet (logo, reel frame,
                   Signal Panel, Night Host, icons, rolling win meter), SymbolArt (image + SVG fallback),
                   assets.ts, Background (animated canvas scene), Overlays (incl. the "Signal
                   Intercepted" bonus intro), StationMenu, Rules
  public/assets/   symbols/*.webp, audio/halloween-waltz-loop.mp3
  scripts/         simulate.ts, rtp.ts, export-books.ts, verify-books.ts, replay-examples.ts,
                   art/ (slice_symbol_sheet.py, cutout_single.py)
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
- [docs/AUDIO.md](docs/AUDIO.md): the music loop (source, licence, how it was cut) and the sound design

## Known limitations

- **Music licence to confirm.** The background music is a licensed track supplied by the owner
  (see [docs/AUDIO.md](docs/AUDIO.md)); keep its licence record for the submission. The sound
  effects are synthesized live with the Web Audio API.
- **Local demo RNG.** The local demo uses a development PRNG with demo credits. On Stake, the RGS
  picks every outcome from the published books.
- **Not yet run on Stake Engine.** It has only been tested against a mock RGS that serves the real
  books.
- **Missing features.** There is no autoplay, no languages other than English, and no Playwright
  tests in the repo for this game.

## Next steps

1. Upload `stake-upload/` and test every mode, social mode, the mini-player and the replay ids on
   the dashboard.
