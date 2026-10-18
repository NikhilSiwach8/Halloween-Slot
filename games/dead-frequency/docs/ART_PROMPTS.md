# Art prompts

## The Widow (replaces the Doll)

**Status: done.** The art is in `public/assets/symbols/widow.webp`. The prompt below is kept for
regenerating it.

The Doll was removed because Stake does not allow "artistic depictions of children or
child-like characters in any gambling context". The Widow takes the same slot and the same pays.
She is a clearly **adult** woman: in the game's story she calls the station every night at 3:33.

Use the same shared style block as the other symbols, then:

> Slot game symbol icon, single centered bust, 1:1 square, transparent background, no frame, no
> text. Dark analog-horror aesthetic, 1970s haunted radio station. Painterly semi-realistic
> rendering with a crisp readable silhouette, strong rim light, deep shadows, subtle film grain
> and faint VHS chromatic aberration on the edges. Palette: near-black charcoal, tarnished brass,
> sickly phosphor green (#36D9A0), warning red (#FF3B4F), aged ivory.
>
> **The bust of a gaunt adult widow in her fifties**, in a high-collared black Victorian mourning
> dress, her face half hidden behind a sheer black lace veil. Pale, hollow cheeks, dark tired eyes
> that faintly glow green behind the veil. She holds an old black rotary telephone receiver to her
> ear with a gloved hand; its coiled cord trails out of frame. A single red rose pinned at her
> collar. Mournful and menacing, not gory. Mature adult features only: lines around the eyes,
> sharp cheekbones. Must read clearly at 96×96 pixels. Lighting from the upper left.

To replace it: if the image has a painted checkerboard instead of real transparency, run
`python3 games/dead-frequency/scripts/art/cutout_single.py IN.webp
games/dead-frequency/public/assets/symbols/widow.webp`. It also clears the checkerboard showing
through lace. Then run `npm run df:stake:frontend`.

**Avoid:** a young face, big round eyes, dolls, school uniforms, pigtails or bows. Reviewers judge
how the art looks, not what the name says.

## Optional: ON AIR clipping on the Night Host

The ON AIR sign behind the Night Host is cut off at the right edge of the original sheet. If you
regenerate that symbol, leave a little margin around the whole sign.
