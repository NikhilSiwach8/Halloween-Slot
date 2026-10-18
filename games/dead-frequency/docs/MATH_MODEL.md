# Dead Frequency: Math Model (v0.1.0)

All parameters live in `src/config/gameConfig.ts`. The figures below describe the game's natural
math and were **measured by simulation**. Raw output is in `docs/simulation/`.

The **published** Stake Engine lookup tables (`stake-upload/math/`) return exactly 96.00% in every
mode. They are built from these same rounds; see [STAKE_ENGINE.md](STAKE_ENGINE.md) for how.

## Targets

| Item | Target |
|---|---|
| RTP, every mode | 96.0% (aim: within ±0.5%) |
| Max win | 50,000× base stake per round, hard cap |
| Base hit frequency | about 35% |
| Base RTP split | about half from spin wins + Mystery, about half from Antenna bonuses |
| Double Chance | cost 1.5×, exactly 2× weight on each bonus-triggering Antenna count |

The base split is what lets Double Chance double the bonus chance and still return 96%. Write
*x* for the RTP from spin wins and the Mystery Bonus, and *y* for the RTP from Antenna bonuses.
Then x + y = 0.96 (base) and (x + 2y) / 1.5 = 0.96 (Double Chance), which gives
x = y = 0.48.

## Board model

- Cells are independent weighted draws. A cell repeats the paying symbol above it with probability
  0.40, which works like stacking on a reel strip. Stacking lowers the hit rate and adds full-reel
  ways.
- **Static:** a per-reel chance of a stack (base 6%), with heights 1–4 weighted 30/30/25/15.
- **Antennas:** the count is drawn from a weighted table and each Antenna goes on a different
  reel. Base weights per million boards:

  | Count | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
  |---|---|---|---|---|---|---|---|
  | Base | 689,897 | 260,000 | 45,000 | 4,153 | 760 | 160 | 30 |
  | Double Chance | same | same | same | 8,306 | 1,520 | 320 | 60 |

- **Tape:** reel 6, 0.19% of base and Double Chance boards.
- **Wilds:** never on reel 1. Weight 12 in base, 24 in Night Shift and Possession, 40 in Dead
  Air. Dead Air wild multipliers x2/x3/x5/x10/x25 have weights 50/25/15/8/2.

| Bonus board | Static chance per reel | Other |
|---|---|---|
| Night Shift | 16.36% | Signal Meter +1 per Static reel, max x100 |
| Possession | 8.95% | Sticky Static |
| Dead Air | 26% | Expanding Static, multiplier wilds |

## Measured results

### Composed RTP: `npm run df:rtp -- --rounds 6000000 --bonusRounds 2000000 --seed 2026`

A paid spin's return is split into three parts:

1. the spin win plus Mystery cash, from 6M spins with bonuses not played;
2. the probability of each bonus, taken exactly from the Antenna table and the Mystery prize table;
3. each bonus's mean win, from 2M simulated bonuses.

This has far less variance than simulating whole rounds, where only about 10,000 bonuses land in
2M base spins.

| Mode | Cost | RTP | 95% CI | Split |
|---|---|---|---|---|
| Base | 1x | **95.82%** | ±0.28% | spin + Mystery cash 44.98%, Antenna bonuses 48.41%, Mystery bonuses 2.42% |
| Double Chance | 1.5x | **95.76%** | ±0.24% | 29.92% / 64.22% / 1.62% |
| Static Storm | 8x | **95.61%** | ±0.37% | spin only |
| Haunted Wilds | 12x | **96.32%** | ±0.30% | spin only |
| Buy Night Shift | 80x | **95.52%** | ±0.36% | mean 76.42x |
| Buy Possession | 160x | **95.90%** | ±0.44% | mean 153.44x |
| Buy Dead Air | 275x | **96.02%** | ±0.46% | mean 264.06x; max win 1 in ~20,800 buys |

### Whole-round simulation: `npm run df:simulate -- --rounds 2000000 --seeds 101`

This is an independent check with a different seed, simulating complete rounds.

| Mode | RTP (95% CI) | Hit freq | Bonus rounds | Max-win rounds |
|---|---|---|---|---|
| Base | 100.07% ±4.05% | 35.45% | 1 in 182 | 0 |
| Double Chance | 97.57% ±3.39% | 35.73% | 1 in 96 | 0 |
| Static Storm | 96.10% ±0.66% | 41.26% | none | 0 |
| Haunted Wilds | 96.53% ±0.51% | 63.83% | none | 0 |
| Buy Night Shift | 96.14% ±0.37% | 99.49% | every round | 1 |
| Buy Possession | 96.36% ±0.44% | 99.65% | every round | 1 |
| Buy Dead Air | 95.52% ±0.45% | 99.84% | every round | 87 (1 in ~23,000) |

Base and Double Chance have wide intervals because the bonus tail dominates their variance. That
is why the composed estimate is used for tuning. Every interval in both runs covers 96%, or misses
it by less than one standard error.

Other measured figures (base game, seed 101):

- Mystery Bonus: 1 in ~513 spins.
- Retune: happens on about 29% of base spins. It is about 77% in Static Storm, where most spins
  carry Static.
- Night Shift : Possession : Dead Air from Antennas is about 22 : 4 : 1.

### Max-win frequency (estimate)

From the composed figures, the chance per base spin of starting Dead Air is about 2.1 × 10⁻⁴,
counting Antennas and the Mystery Bonus. Dead Air reaches 50,000x about 1 time in 21,000–23,000.
Night Shift and Possession also reached it once each in 2M buys. Together that puts a base-game
max win at roughly **1 in 80–100 million spins**. This is an estimate, not a measured count;
an exact figure needs the published lookup tables.

## Volatility notes

- Base: 64.5% of spins win nothing; 0.6% pay 20x or more.
- The bonuses are graded. Night Shift is the most frequent and the smoothest (its median win is
  in the 20–100x range). Possession has a fatter tail. Dead Air carries most of the max-win
  probability.

## Tuning history (v0.1.0)

1. A first pass with every cell independent gave a 66% hit rate and 130% base RTP. I added
   symbol stacking (0.40), cut the wild weight from 22 to 12, and roughly halved all pays.
2. Antennas changed from a per-reel chance to a weighted count table. That made "Double Chance =
   exactly 2× each trigger weight" possible, and made the Possession and Dead Air frequencies
   independent of Night Shift.
3. I tuned each bonus's Static chance to its target mean (buy price × 0.96). Dead Air was planned
   at 400x, but would have needed a much heavier tail to reach that mean. I re-priced it to 275x
   instead, which keeps its max-win rate near 1 in 20,000 buys.
4. I set Feature Spins prices (8x, 12x) from their measured mean, then trimmed the guarantee
   weights to 96%.
5. Final: base Antenna-3 weight and Tape chance balanced so x ≈ y ≈ 0.48 (see Targets).

## Before release

- Generate per-mode books and lookup tables; then RTP is exact and the max-win frequency can be
  stated.
- Confirm that the base RTP's dependence on bonus means is within the platform's tolerance across
  modes. The current spread is 95.5–96.3%, within simulation error.
- Review Retune's player-facing presentation with compliance. It is a second reveal, not a
  second paid chance; the outcome is fixed before any animation.
