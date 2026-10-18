# Dead Frequency: Game Rules

*"Some signals should never be found."*

A late-night radio station went off air in 1979 during a live broadcast. Tonight the
transmitter switched itself back on. You are tuning in.

All numbers below come from `src/config/gameConfig.ts`; the engine reads every value from there.

## Grid and ways

- 6 reels × 4 rows, **4,096 ways**.
- A win needs the same symbol on 3 or more **adjacent reels starting from reel 1**.
- Win = symbol pay × number of ways (× wild multipliers, × the Signal Meter in Night Shift).
- Every winning symbol pays; wins on different symbols are added together.
- Pays are per way, in multiples of the base stake:

| Symbol | 3 | 4 | 5 | 6 |
|---|---|---|---|---|
| The Night Host | 0.15x | 0.50x | 1.25x | 2.50x |
| The Priest | 0.10x | 0.25x | 0.50x | 1.25x |
| The Doll | 0.08x | 0.15x | 0.40x | 0.80x |
| Old Radio | 0.05x | 0.12x | 0.25x | 0.50x |
| Headphones | 0.04x | 0.08x | 0.15x | 0.30x |
| Microphone | 0.04x | 0.08x | 0.15x | 0.30x |
| Cassette | 0.03x | 0.05x | 0.10x | 0.20x |
| Valve | 0.03x | 0.05x | 0.10x | 0.20x |

## Special symbols

| Symbol | Rule |
|---|---|
| **On Air** (wild) | Reels 2–6 only. Substitutes for every paying symbol. In Dead Air and Haunted Wilds it carries a multiplier. When a way passes through several multiplier wilds, their multipliers **multiply**. |
| **Static** (mystery) | Lands in stacks of 1–4. When the reels stop, **every Static on the screen reveals as the same paying symbol**. |
| **Antenna** (scatter) | At most one per reel. 3 / 4 / 5–6 Antennas start Night Shift / Possession / Dead Air. |
| **Unmarked Tape** | Reel 6 only, base game and Double Chance only. Plays the Mystery Bonus. |

## Signature mechanic: Static & Retune

Static reveals first. If **none** of the revealed Static positions is part of a win, the signal
**retunes once**: every Static reveals again as a different symbol, and the board is
evaluated again. A Static reveal never produces a wild.

## Bonuses

All three are free-spin bonuses with different mechanics. During any bonus, 3 or more Antennas
add **+5 spins**, up to 50 spins in total. Neither Tapes nor further bonuses can land during a bonus.

### Night Shift (3 Antennas): 10 spins, the Signal Meter

- The **Signal Meter** starts at x1. At the start of every spin it rises by **+1 for every reel
  that shows Static**. The rise counts towards that spin.
- The meter **never resets** during the bonus (maximum x100).
- Every win in the bonus is multiplied by the meter.

### Possession (4 Antennas): 10 spins, Sticky Static

- Every Static that lands becomes **sticky** and stays in place for the rest of the bonus.
- Each spin, all Statics (old and new) reveal together as one symbol, with Retune as usual.
- The screen fills with Static as the bonus goes on.

### Dead Air (5 or 6 Antennas): 12 spins, Expanding Static and multiplier wilds

- A reel that shows any Static **expands to a full reel of Static**.
- On Air wilds carry **x2, x3, x5, x10 or x25**; multipliers on a way multiply together.
- This is the bonus built for the 50,000x maximum win.

## Mystery Bonus: the Unmarked Tape

When a Tape lands on reel 6, the Mystery Bonus plays. The tape holds one prize:

- a cash prize of **2x, 5x, 10x, 25x, 100x or 500x**, or
- **Night Shift**, **Possession** or **Dead Air**.

The prize is drawn when the spin lands. The tape animation only reveals it; nothing the player
does changes it. If the same spin also starts an Antenna bonus, both bonuses play, the Antenna
bonus first.

## Double Chance

A toggle for normal spins. It raises the cost of a spin to **1.5× the stake**, and every
bonus-triggering Antenna count (3, 4, 5 and 6) becomes **twice as likely** to land. It does not
change pays, the Mystery Bonus, Feature Spins or Bonus Buys.

## Feature Spins

A paid spin mode that stays on until the player switches it off. Every spin carries a guaranteed
feature. Antennas and Tapes cannot land, so Feature Spins never start a bonus.

| Mode | Cost per spin | Guarantee |
|---|---|---|
| Static Storm | 8x | 2 or 3 random reels are full Static (on top of any natural Static) |
| Haunted Wilds | 12x | 2 or 3 extra On Air wilds on reels 2–6 carrying x2, x3, x5 or x10 |

## Bonus Buy

| Bonus | Price |
|---|---|
| Night Shift | 80x |
| Possession | 160x |
| Dead Air | 275x |

A bought bonus is identical to a triggered one; only the paid spin is skipped.

## Maximum win

**50,000× the base stake per round**, counting the paid spin, Mystery cash and every bonus. When a
round reaches it, the win is capped at exactly 50,000x and the round ends immediately; any
remaining free spins are not played.

## Resolution order of a paid spin

1. The board lands (Static, symbols, Antennas, Tape, guaranteed features).
2. Night Shift only: the Signal Meter rises.
3. Static reveals; Retune if the reveal won nothing.
4. Ways are evaluated and paid (capped at the max win).
5. Mystery Bonus, if a Tape landed (cash is paid here).
6. Antenna bonus, if 3+ Antennas landed.
7. Bonus from the Mystery Bonus, if the tape held one.
