# Stake Engine approval checklist: Dead Frequency

Status of every item on Stake Engine's approval checklist. **Verified** items were checked in a
browser against a mock RGS (22 checks) and by unit tests (`tests/approval.test.ts`,
`tests/stake.test.ts`). **You** marks items only the game owner or Stake can do.

## PreChecks
| Item | Status | How |
|---|---|---|
| Game authenticates with RGS successfully on launch | Verified | `/wallet/authenticate` with sessionID and language on load |
| Authentication fails correctly with an invalid rgs_url | Verified | Shows "Could not connect to the game server. Please check the game link and your connection, then reload." |
| Clicking the bet button sends a successful play request | Verified | `/wallet/play` with amount and mode |
| Game does not contain the Stake Engine Loader | Done | No loader or "Powered by" screen in the game |

## Compliance
| Item | Status | How |
|---|---|---|
| Title unique, no restricted terms | Checked | No existing slot named "Dead Frequency" found in a web search; please also search Stake's own catalogue |
| Assets not offensive or inappropriate | **You decide** | Horror theme. Note: the Priest is an undead clergyman holding a crucifix. Religious imagery can be judged offensive; if Stake raises it, he can be swapped for a non-religious character |
| Sufficiently distinct from existing titles | Done | Original theme, mechanics (Static & Retune, Signal Meter) and art |
| Thumbnail meets artwork guidelines | **You** | Prompts for 3:4 and 16:9 tiles were provided; check them against Stake's artwork guidelines |

## RGS requirements
| Item | Status | How |
|---|---|---|
| Uses all betting parameters from authenticate | Verified | betLevels within minBet/maxBet on the stepBet grid, defaultBetLevel; if betLevels is empty, levels are built from min/max/step |
| Active rounds restore the bet amount | Verified | An active round's `amount` becomes the current bet |
| Currencies supported and displayed correctly | Verified | Symbol, decimals and placement per currency; unknown codes show the code after the amount |
| Sub-cent payouts displayed correctly | Verified | Extra digits as needed, e.g. a 0.06x win on a 0.10 bet shows $0.006 |
| Zero-win bets send no end-round | Verified | Only `/wallet/balance` after a losing round |
| Insufficient balance sends no play request | Verified | Spin and Space do nothing; no request |

## Frontend
| Item | Status | How |
|---|---|---|
| Space bar bound to the bet button | Verified | Unless the RGS sets `disabledSpacebar` |
| Main game frame not scrollable | Verified | `overflow: hidden` on the page; dialogs scroll inside themselves |

## Game rules
| Item | Status | How |
|---|---|---|
| RTP and max win clearly stated | Done | Table per mode (RTP hidden if the RGS sets `displayRTP: false`) |
| Payout per symbol | Done | Paytable for 3/4/5/6 of a kind |
| Win combinations displayed | Done | Ways explanation plus a worked example |
| Modes with description and cost | Done | Every mode's cost in the table, descriptions in the text and menu |
| Free game and retrigger conditions | Done | Bonuses section: triggers, spins, +5 retrigger, 30-spin cap |
| General disclaimer | Done | In the rules |
| Mystery values accurate | Done | The rules list the Mystery prizes but state no probabilities |

## Auto play
| Item | Status | How |
|---|---|---|
| Auto-bet requires confirmation before starting | Verified | Auto panel (10/25/50/100/250 rounds, stop conditions), then a confirm step: "Start 25 auto bets at $1.00 each (up to $25.00 in total)?"; nothing is sent before Confirm. Stops on Stop/Space, when the rounds run out, when the balance can't cover a round, on the loss limit, on a big single win, or when a bonus starts (default on). Hidden in replay and if the RGS jurisdiction sets `disabledAutoplay` |
| High-cost modes require confirmation | Verified | Switching on Feature Spins (8x, 12x) and every Bonus Buy asks to confirm |

## Responsive
| Item | Status | How |
|---|---|---|
| Desktop / laptop, Popout S/L, mobile | Verified | 8 viewport sizes checked: no overlaps, no scrolling |
| Double tap to zoom disabled | Verified | `user-scalable=no` and `touch-action: manipulation` |
| User interaction guide in the game info | Done | Controls section in the rules |
| Option to disable sounds | Done | Speaker button; remembered |

## Language
| Item | Status | How |
|---|---|---|
| English supported | Done | |
| Invalid language parameters don't break the display | Verified | `lang=zz-INVALID` loads normally |

## Stake.us
| Item | Status | How |
|---|---|---|
| Social-game translations | Verified | `social=true` or the RGS socialCasino flag rewrites restricted words; scan finds none |
| SC/GC without a "$" prefix | Verified | "100.00 SC" |
| Mode naming follows social terminology | Done | "Bonus Buy" becomes "Get Bonus", and so on |
| Replay window has no restricted words | Verified | |
| English only in social mode | Done | |

## Replay
| Item | Status | How |
|---|---|---|
| Replay URLs load and play the event | Verified | |
| Optional parameters (currency, language, amount) | Done | currency and amount are used; language is accepted |
| Replay again after completion | Verified | Button changes to PLAY AGAIN |
| Shows bet cost and applied multiplier | Verified | "Bet replay · Dead Air · bet $1.00 × 275 = $275.00" |
| Replays in Popout S | Verified | The cost line stays on screen at 400×225 |

## Check 5 wins per mode against the rules
**You (on the dashboard).** Use the ids in `stake-upload/replay-examples.json`. Every book is
also verified by `npm run df:books:verify`: each payout is recomputed from its events and checked
against the lookup table.

## Older devices
The build targets iOS Safari 14+, Chrome 87+, Firefox 78+ and Edge 88+. Tiles fall back to a
padding trick where `aspect-ratio` is missing (iOS < 15). Please still test on a real older
Android phone and iPhone.

## Final approval (you / Stake)
Bet-level templates applied; Provably Fair and Replay enabled; front and math requests approved;
posting in stake-engine-game-approved; closing the approval request once live.
