"""
Cartoon ("toon") pass over the painted symbol art, to match a bold cartoon slot style:
  1. flatten the shading a little (edge-preserving smoothing + colour quantisation = cel look),
  2. push saturation and contrast,
  3. add a hard top-left highlight band and a darker lower-right shade (two-tone cel lighting),
  4. draw a thick dark outline around the silhouette, with a thin light inner rim.
Input and output are RGBA images with transparent backgrounds. The originals are kept in
public/assets/symbols-painted/, so the pass can be re-run or undone.

    python3 scripts/art/toonify.py <in.png|webp> <out.webp> [outline_px] [size] [flatten 0..1]

The game ships the "sticker" variant (flatten=0): the paintings as they are, with a thick ink
outline, a light inner rim and a little more colour, so they sit in the cartoon UI.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageChops

def toonify(src, outline=14, size=512, colors=40, flatten=0.65):
    im = src.convert("RGBA")
    # Work at 2x for clean edges, then downsample.
    W = size * 2
    im = im.resize((W, W), Image.LANCZOS)
    rgb, a = im.convert("RGB"), im.getchannel("A")
    # 1. cel flattening: smooth inside regions, then quantise colours
    flat = rgb.filter(ImageFilter.ModeFilter(7)).filter(ImageFilter.SMOOTH_MORE)
    flat = flat.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    # keep some original detail (flatten=0 keeps the painting as it is: "sticker" mode)
    rgb = Image.blend(rgb, flat, flatten)
    # 2. punchier colour
    rgb = ImageEnhance.Color(rgb).enhance(1.45 if flatten else 1.22)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.18 if flatten else 1.08)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.08 if flatten else 1.06)
    # 3. two-tone cel lighting from the upper left
    yy, xx = np.mgrid[0:W, 0:W] / W
    light = np.clip(1.0 - (xx * 0.55 + yy * 0.75), 0, 1)
    band = ((light > 0.62).astype(np.float32) * 0.10 - (light < 0.2).astype(np.float32) * 0.12) * (1 if flatten else 0.4)
    arr = np.asarray(rgb).astype(np.float32) / 255
    arr = np.clip(arr * (1 + band[..., None]) + band[..., None].clip(0) * 0.06, 0, 1)
    rgb = Image.fromarray((arr * 255).astype(np.uint8))
    # 4. outline: dilate the silhouette; light inner rim just inside the edge
    alpha = a.point(lambda v: 255 if v > 90 else 0)
    k = outline * 2 + 1
    dil = alpha.filter(ImageFilter.MaxFilter(k if k % 2 else k + 1))
    dil = dil.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 if v > 110 else 0)
    ero = alpha.filter(ImageFilter.MinFilter(5))
    rim = ImageChops.subtract(alpha, ero)
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    outline_layer = Image.new("RGBA", (W, W), (27, 14, 8, 255))
    out.paste(outline_layer, (0, 0), dil)
    body = rgb.convert("RGBA")
    body.putalpha(a)
    out = Image.alpha_composite(out, body)
    rim_layer = Image.new("RGBA", (W, W), (255, 240, 220, 0))
    rim_layer.putalpha(rim.point(lambda v: int(v * 0.35)))
    out = Image.alpha_composite(out, rim_layer)
    # Fit with a margin so the thick outline is never clipped.
    bbox = out.getbbox()
    out = out.crop(bbox)
    side = max(out.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(out, ((side - out.width) // 2, (side - out.height) // 2))
    pad = int(side * 0.04)
    framed = Image.new("RGBA", (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
    framed.paste(canvas, (pad, pad))
    return framed.resize((size, size), Image.LANCZOS)

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    outline = int(sys.argv[3]) if len(sys.argv) > 3 else 14
    size = int(sys.argv[4]) if len(sys.argv) > 4 else 512
    flatten = float(sys.argv[5]) if len(sys.argv) > 5 else 0.65
    toonify(Image.open(src), outline, size, flatten=flatten).save(dst, quality=92)
