# Dead Frequency: Stake Engine upload

This folder holds everything to upload to the Stake Engine dashboard.

```
stake-upload/
  math/                         <- upload as the game's math files
    index.json
    books_base.jsonl.zst             lookUpTable_base_0.csv
    books_double_chance.jsonl.zst    lookUpTable_double_chance_0.csv
    books_static_storm.jsonl.zst     lookUpTable_static_storm_0.csv
    books_haunted_wilds.jsonl.zst    lookUpTable_haunted_wilds_0.csv
    books_night_shift.jsonl.zst      lookUpTable_night_shift_0.csv
    books_possession.jsonl.zst       lookUpTable_possession_0.csv
    books_dead_air.jsonl.zst         lookUpTable_dead_air_0.csv
  frontend/                     <- upload as the game's frontend (static files)
    index.html, assets/…, favicon.svg
  replay-examples.json          <- book ids to give reviewers (not uploaded)
  math-summary.json             <- statistics per mode (not uploaded)
```

## Steps

1. **Math.** In your game's math upload, add all **15 files** from `math/`: `index.json` plus 7
   books and 7 lookup tables. Upload them together; the RGS checks that every book's payout matches
   its lookup row.
2. **Frontend.** Upload the **contents** of `frontend/`, with `index.html` at the top level. If the
   dashboard asks for an archive, zip the contents (not the folder itself), e.g.
   `cd frontend && zip -r ../frontend.zip .`
3. **Test session.** Open the game from the dashboard. It reads `sessionID` and `rgs_url` from the
   URL. Play every mode: Base, Double Chance (toggle), Static Storm and Haunted Wilds
   (Feature Spins menu), and the three bonus buys.
4. **Replay.** For each mode, open the replay link for the ids in `replay-examples.json`:
   `?replay=true&game=<game>&version=<version>&mode=<MODE>&event=<id>&rgs_url=<rgs>&currency=USD&amount=1000000`.
   Reviewers ask for a loss, a normal win, a big win, the max win and (Base / Double Chance) a
   bonus trigger per mode.
5. **Submit.** Rules, RTP, max win per mode and the disclaimer are in the in-game rules (the ?
   button).

## Modes

| Mode | `mode` sent to /wallet/play | Cost | RTP | Max win | Max win odds |
|---|---|---|---|---|---|
| Base | `BASE` | 1x | 96.00% | 50,000x | 1 in 8,000,000 |
| Double Chance | `DOUBLE_CHANCE` | 1.5x | 96.00% | 50,000x | 1 in 6,000,000 |
| Feature Spins: Static Storm | `STATIC_STORM` | 8x | 96.00% | 10,240x | 1 in 5,000,000 |
| Feature Spins: Haunted Wilds | `HAUNTED_WILDS` | 12x | 96.00% | 50,000x | 1 in 8,000,000 |
| Buy Night Shift | `NIGHT_SHIFT` | 80x | 96.00% | 50,000x | 1 in 2,000,000 |
| Buy Possession | `POSSESSION` | 160x | 96.00% | 50,000x | 1 in 2,000,000 |
| Buy Dead Air | `DEAD_AIR` | 275x | 96.00% | 50,000x | 1 in 20,000 |

## Before you submit

Read **[../docs/STAKE_ENGINE.md](../docs/STAKE_ENGINE.md), "Open items before submission"**.
In particular:
- **The Doll symbol** risks Stake's rule against child-like characters. Replace that art.
- **Audio** is still placeholder.

## Regenerating

From the repository root:

```bash
npm run df:books && npm run df:books:verify && npm run df:replay-examples && npm run df:stake:frontend
```

Bump `version` in `games/dead-frequency/src/config/gameConfig.ts` whenever the math changes.
