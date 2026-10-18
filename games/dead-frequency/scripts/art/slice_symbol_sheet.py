"""
Cuts the Dead Frequency symbol sheet (a 4x3 grid on a baked-in checkerboard) into 12
transparent 512x512 WebP symbols.

    pip install numpy pillow scipy
    python3 games/dead-frequency/scripts/art/slice_symbol_sheet.py SHEET.webp games/dead-frequency/public/assets/symbols

Grid order (rows top to bottom): valve cassette mic headphones / radio doll priest host /
wild static antenna tape.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
H, W, _ = im.shape
mx, mn = im.max(2), im.min(2)
# Baked checkerboard: bright, near-neutral pixels connected to the image border.
cand = ((mx - mn) <= 14) & (mn >= 200)
lab, _ = ndi.label(cand)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border))
# Enclosed gaps (inside the headphone band, the tape loops) are checkerboard too. Checker regions
# have the checker's statistics: mean brightness ~238 and a two-tone spread (std ~14).
idx = range(1, lab.max() + 1)
lum0 = im.mean(2)
areas = ndi.sum(cand, lab, idx)
means = ndi.mean(lum0, lab, idx)
stds = ndi.standard_deviation(lum0, lab, idx)
holes = [i + 1 for i in range(len(areas)) if areas[i] >= 150 and 232 <= means[i] <= 244 and stds[i] >= 12]
bg |= np.isin(lab, holes)

# Soft edge: a 3px ring around the background fades out light, neutral anti-aliasing.
ring = ndi.binary_dilation(bg, iterations=3) & ~bg
alpha = np.where(bg, 0, 255).astype(np.float32)
lum = im.mean(2)
neutral = (mx - mn) <= 45
fade = np.clip((205 - lum) / 70, 0, 1) * 255
alpha[ring & neutral] = np.minimum(alpha[ring & neutral], fade[ring & neutral])

fg = ndi.binary_opening(alpha > 0, iterations=2)
lab2, n = ndi.label(fg)
sizes = ndi.sum(fg, lab2, range(1, n + 1))
names = [['VALVE', 'CASSETTE', 'MIC', 'HEADPHONES'], ['RADIO', 'DOLL', 'PRIEST', 'HOST'], ['WILD', 'STATIC', 'ANTENNA', 'TAPE']]
boxes = {}
for i, objs in enumerate(ndi.find_objects(lab2), start=1):
    if sizes[i - 1] < 400:
        continue
    ys, xs = objs
    cy, cx = (ys.start + ys.stop) / 2, (xs.start + xs.stop) / 2
    name = names[min(int(cy // (H / 3)), 2)][min(int(cx // (W / 4)), 3)]
    b = boxes.get(name)
    boxes[name] = (ys.start, ys.stop, xs.start, xs.stop) if not b else (min(b[0], ys.start), max(b[1], ys.stop), min(b[2], xs.start), max(b[3], xs.stop))

rgba = np.dstack([im.astype(np.uint8), alpha.astype(np.uint8)])
keep = np.zeros((H, W), bool)
for i in range(1, n + 1):
    if sizes[i - 1] >= 400:
        keep |= lab2 == i
rgba[..., 3] = np.where(keep, rgba[..., 3], 0)

for row in names:
    for name in row:
        y0, y1, x0, x1 = boxes[name]
        crop = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
        side = int(max(crop.size) / 0.9)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
        canvas = canvas.resize((512, 512), Image.LANCZOS)
        canvas.save(f'{out}/{name.lower()}.webp', 'WEBP', quality=90, method=6)
        print(name, (x0, y0, x1, y1))
