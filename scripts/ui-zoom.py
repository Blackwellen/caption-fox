"""Zoomed crop with absolute-coordinate rulers, for reading exact geometry.

  python scripts/ui-zoom.py <image> x y w h <out> [scale=2]

Grid lines every 10px (strong every 50px) labelled with ABSOLUTE image
coordinates, so values can be copied straight into a layout spec.
"""
import sys
from PIL import Image, ImageDraw
p, x, y, w, h, out = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
s = int(sys.argv[7]) if len(sys.argv) > 7 else 2
im = Image.open(p).convert('RGB').crop((x, y, x + w, y + h)).resize((w * s, h * s), Image.NEAREST)
pad = 34
c = Image.new('RGB', (im.width + pad, im.height + pad), 'white')
c.paste(im, (pad, pad))
d = ImageDraw.Draw(c)
for gx in range((x // 10) * 10, x + w + 1, 10):
    if gx < x: continue
    X = pad + (gx - x) * s
    strong = gx % 50 == 0
    d.line([(X, pad - (8 if strong else 3)), (X, c.height)], fill=(255, 0, 150) if strong else (255, 200, 230), width=1)
    if strong: d.text((X + 2, 2), str(gx), fill=(200, 0, 120))
for gy in range((y // 10) * 10, y + h + 1, 10):
    if gy < y: continue
    Y = pad + (gy - y) * s
    strong = gy % 50 == 0
    d.line([(pad - (8 if strong else 3), Y), (c.width, Y)], fill=(255, 0, 150) if strong else (255, 200, 230), width=1)
    if strong: d.text((1, Y + 2), str(gy), fill=(200, 0, 120))
c.save(out)
