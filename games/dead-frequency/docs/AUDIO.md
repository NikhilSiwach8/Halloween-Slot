# Dead Frequency: audio

## Music

| | |
|---|---|
| File | `public/assets/audio/halloween-waltz-loop.mp3` (160 kbps MP3, 20.714 s, about 415 KB) |
| Source | "Halloween Suspense Horror (Version 7) – Halloween Waltz" by **bombinsound**, supplied by the game owner as `bombinsound-halloween-suspense-horror-version-7-halloween-waltz-619340.mp3` |
| Licence | **To be confirmed by the owner.** The file name matches a Pixabay track (id 619340). Keep the licence record (download page or receipt) with the submission. Stake requires the rights to every asset in the game. |

### How the loop was cut

The original is 24.03 s long and fades out over its last ~1.5 s, so it cannot loop as it is.

1. **Loop length.** The beat is 0.5455 s (110 bpm, a waltz). The rhythm of the opening 3 s recurs best 20.714 s in (onset-envelope correlation; a spectral comparison agrees). That is before the fade-out.
2. **Seam.** The 0.30 s of music that follows the loop point is cross-faded (equal power) into the loop's first 0.30 s. When the loop wraps, the last sample flows straight into the continuation, which fades into the opening. The jump at the wrap (0.007) is smaller than the median sample-to-sample step (0.016), so there is no click.
3. **Level.** Scaled to a 0.89 peak (the cross-fade peaked at 1.05), then encoded with LAME at 160 kbps.

In the game (`src/app/audio.ts`) the track plays through an `AudioBufferSourceNode` with
`loop = true`, which loops sample-accurately. `loopEnd` is set to the loop length counted from the
first non-silent sample, so the loop stays exact whether or not a browser trims the MP3 encoder
delay. Chrome trims it and decodes exactly 20.714 s.

To re-cut it from the original, decode it to 44.1 kHz stereo and apply the steps above with
`L = 913475` samples. The constant `MUSIC_LOOP_S` in `audio.ts` must match the file.

### Behaviour

- **Starts** on the player's first click or key (browser autoplay rules), usually on the title
  screen's "click to continue", and fades in over about 2 s.
- **Plays throughout** the base game, Double Chance, Feature Spins, bonus buys and every bonus. It
  is a little louder in bonuses (0.38 instead of 0.30).
- **Ducks** under the bonus intro's jump scare (to 6%), each win-screen scare (to 15%), and the
  big-win swell (to 50%), then comes back.
- **Mute** silences it along with everything else; mute is remembered. Sound pauses while the tab
  is hidden.
- The synthesized ambience (drone, hiss, ghost voices) carries on under the music at a lower level.
  If the music cannot load, the ambience plays alone.

## Effects

Every effect is synthesized live with the Web Audio API, so it is original to the game: reel
thunks, the tease whine, Static bursts, the Retune sweep, win bells, the tape deck, the bonus jump
scare, the win-screen scares, tier hits and the win counter.
