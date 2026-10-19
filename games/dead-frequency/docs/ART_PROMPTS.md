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

## 3D, lifelike re-renders of every symbol

These prompts turn each painted symbol into a premium 3D render, keeping its subject, pose, colours
and silhouette, so nothing else in the game has to change. The best route is to give the image tool
the current symbol as the reference image (`public/assets/symbols/<name>.webp`) and use an "edit"
or "image-to-image" mode.

**Shared style (put this before every prompt):**

> Re-render this exact slot-game symbol as a premium 3D render, like a AAA game asset or a
> high-end animated film still. Keep the same subject, pose, silhouette, framing, colour palette
> and every identifying detail. Make it tangible and lifelike: physically based materials with real
> texture (worn metal, glass, fabric, skin pores, wood grain), a soft key light from the upper left,
> a warm rim light, ambient occlusion and contact shadows. Dark gothic horror mood, 1970s haunted
> radio station. Centred, filling about 85% of the frame. Fully transparent background, no frame,
> no added text, no watermark. 1024×1024.

| File | Add to the shared style |
|---|---|
| `host` | The Night Host: an undead radio DJ with a skull face, glowing green eyes, red headphones, a vintage microphone and an ON AIR sign behind him. Humanise him: leathery skin drawn tight over the skull, believable anatomy, expressive eyes and a sly grin, a worn 1970s shirt. Keep the ON AIR sign text exactly. |
| `widow` | The Widow: an adult woman in a black lace mourning veil, pale and grieving. Humanise her: realistic skin with subsurface scattering, tear-wet eyes, fine lace you can see through, strands of dark hair. Clearly an adult. |
| `priest` | The Priest: an elderly priest with a ghostly green underlight, holding a crucifix. Humanise him: deep wrinkles, sunken eyes, stubble, a worn cassock and a real metal crucifix. |
| `radio` | A gothic arched tube radio: carved walnut with real grain and wear, a glowing green dial behind glass, brass trim with fingerprints. |
| `mic` | A vintage chrome studio microphone: brushed and pitted chrome, a fine mesh grille, a weighted base. |
| `headphones` | Vintage studio headphones: cracked leather cushions, scuffed metal band, a coiled cable, a faint blue glow. |
| `cassette` | A worn cassette tape: scratched plastic shell, a faded handwritten label, visible tape spools. |
| `valve` | A glowing vacuum tube: real glass with reflections, an orange filament inside, a little smoke curling around it. |
| `wild` | The ON AIR sign: a red neon studio sign in a metal housing, the glass tubes glowing, a subtle reflection. Keep the text ON AIR exactly. |
| `static` | A small CRT screen full of TV static with a ghostly face and a question mark showing through. Keep the "?" exactly. |
| `antenna` | A red radio-tower antenna crackling with energy, its metal lattice wrapped in static and red light. |
| `tape` | An unmarked VHS-style tape with a green glow and the hand-written label "DON'T PLAY". Keep the label text exactly. |

**To swap them in:** save each as a 512×512 transparent WebP with the same file name in
`public/assets/symbols/` (or a 1024 PNG, then convert with
`python3 -c "from PIL import Image; Image.open('host.png').resize((512,512), Image.LANCZOS).save('host.webp', quality=92)"`).
The game picks them up with no code changes. Check that every symbol still reads clearly at phone
size, and that the Widow and every other character are clearly adults (Stake's content rules).
