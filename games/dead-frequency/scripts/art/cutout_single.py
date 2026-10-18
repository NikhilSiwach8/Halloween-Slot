"""
Cuts one symbol out of an image whose transparency is a *painted* checkerboard (a common export
from image generators), and saves it as a 512x512 transparent WebP.

    pip install numpy pillow scipy
    python3 games/dead-frequency/scripts/art/cutout_single.py IN.webp OUT.webp

The checkerboard is a regular grid, so its square size and alignment are fitted from the image
edges. A pixel is background when it is neutral grey and matches the colour the checkerboard
should have at that exact position. That also clears the many small holes in lace or hair that
show the checkerboard through them, which a plain flood fill would miss.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
lum = im.mean(2)
neutral = (im.max(2) - im.min(2)) <= 12


def fit_axis(profile):
    """Square size and offset from light/dark transitions along an edge row or column."""
    b = (profile > (profile.min() + profile.max()) / 2).astype(int)
    t = np.array([i for i in range(1, len(b)) if b[i] != b[i - 1]], float)
    k = np.arange(len(t))
    size, start = np.polyfit(k, t, 1)
    return size, start, b[0]


# Fit on the top-left corner strips only, where nothing but checkerboard is visible.
sx, x0, light_first_x = fit_axis(lum[2, :300])
sy, y0, _ = fit_axis(lum[:300, 2])
corner = lum[:80, :80]
light = np.median(corner[corner > (corner.min() + corner.max()) / 2])
dark = np.median(corner[corner <= (corner.min() + corner.max()) / 2])
print(f'grid {sx:.3f} x {sy:.3f} px, offsets {x0:.2f}/{y0:.2f}, tones {light:.0f}/{dark:.0f}')

ys, xs = np.mgrid[0:H, 0:W]
cx = np.floor((xs - x0) / sx) + 1
cy = np.floor((ys - y0) / sy) + 1
expected = np.where(((cx + cy) % 2 == 0) == bool(light_first_x), light, dark)
fx = ((xs - x0) / sx) % 1
fy = ((ys - y0) / sy) % 1
near_edge = (np.minimum(fx, 1 - fx) * sx < 1.6) | (np.minimum(fy, 1 - fy) * sy < 1.6)
in_range = (lum >= dark - 6) & (lum <= light + 4)
match = neutral & ((np.abs(lum - expected) <= 9) | (near_edge & in_range))

lab, n = ndi.label(match)
sizes = ndi.sum(match, lab, range(1, n + 1))
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
keep_ids = [i + 1 for i in range(n) if (i + 1) in border or sizes[i] >= 6]
bg = np.isin(lab, keep_ids)

alpha = np.where(bg, 0.0, 255.0)
rgb = im.copy()

# See-through areas (lace netting, smoke): generators paint them over the checkerboard, so every
# hole in a fine net shows the checker colour for its square. Find the netting by its density of
# light, neutral "hole" pixels, then un-mix every pixel in it against the exact checker colour
# behind it: observed = a*thread + (1-a)*checker, with dark threads, so
#   a = (checker - observed) / (checker - THREAD),  colour = (observed - (1-a)*checker) / a.
THREAD = 22.0
holes = neutral & (lum > 120) & ~bg
density = ndi.uniform_filter(holes.astype(np.float32), size=19)
net = ndi.binary_closing(density > 0.06, iterations=4) & ~bg
net = ndi.binary_opening(net, iterations=2)
weight = np.clip(ndi.gaussian_filter(net.astype(np.float32), 2.5) * 1.4, 0, 1) * ~bg
a = np.clip((expected - lum) / (expected - THREAD), 0, 1)
a = np.where(neutral | (lum > 90), a, 1.0)  # coloured (non-grey) pixels are the artwork itself
a_safe = np.maximum(a, 0.06)[..., None]
colour = np.clip((im - (1 - a[..., None]) * expected[..., None]) / a_safe, 0, 255)
rgb = rgb * (1 - weight[..., None]) + colour * weight[..., None]
alpha = alpha * (1 - weight) + a * 255 * weight
print(f'net / see-through pixels un-mixed: {int(net.sum()):,}')
# Soft 2px edge: light neutral fringe pixels next to the background fade out.
ring = ndi.binary_dilation(bg, iterations=2) & ~bg
fade = np.clip((215 - lum) / 70, 0, 1) * 255
alpha[ring & neutral] = np.minimum(alpha[ring & neutral], fade[ring & neutral])

# Checker leftovers along the outline: light grey pixels in a thin band next to the background.
# (Interior highlights, e.g. on glossy objects, are far from the background and untouched.)
edge_band = ndi.binary_dilation(bg, iterations=6) & ~bg
alpha[edge_band & neutral & (lum > 185)] = 0

ysel, xsel = np.where(alpha > 0)
fg = alpha > 0
lab2, n2 = ndi.label(fg)
big = np.argmax(ndi.sum(fg, lab2, range(1, n2 + 1))) + 1
core = ndi.binary_dilation(lab2 == big, iterations=40)
alpha[~core] = 0  # drop stray specks far from the figure
specks, ns = ndi.label(alpha > 0)
ssz = ndi.sum(alpha > 0, specks, range(1, ns + 1))
smean = ndi.mean(lum, specks, range(1, ns + 1))
for i in range(ns):
    if ssz[i] < 40 and smean[i] > 150:
        alpha[specks == i + 1] = 0
ysel, xsel = np.where(alpha > 0)
y0b, y1b, x0b, x1b = ysel.min(), ysel.max() + 1, xsel.min(), xsel.max() + 1
rgba = np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)])[y0b:y1b, x0b:x1b]
crop = Image.fromarray(rgba, 'RGBA')
side = int(max(crop.size) / 0.9)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
canvas.resize((512, 512), Image.LANCZOS).save(out, 'WEBP', quality=90, method=6)
print('saved', out, 'crop', (x0b, y0b, x1b, y1b))
