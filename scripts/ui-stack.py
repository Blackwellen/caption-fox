"""Native-resolution stacked comparison: reference region above, implementation below.

No scaling — both crops are shown at true pixels with x/y rulers every 50px
(labels are offsets from each crop's own origin), so font sizes, paddings and
box heights can be read directly.

  python scripts/ui-stack.py <folder> <name> ref_x ref_y imp_x imp_y width height [suffix]

Writes <name>-stack[-suffix].png.
"""
import sys, os
from PIL import Image, ImageDraw

folder, name = sys.argv[1], sys.argv[2]
rx, ry, ix, iy, w, h = (int(v) for v in sys.argv[3:9])
suffix = f'-{sys.argv[9]}' if len(sys.argv) > 9 else ''
ref = Image.open(os.path.join(folder, f'{name}-reference.png')).convert('RGB')
imp = Image.open(os.path.join(folder, f'{name}-implementation.png')).convert('RGB')
pad, gap = 30, 14
out = Image.new('RGB', (w + pad, (h + pad) * 2 + gap), 'white')
d = ImageDraw.Draw(out)
for k, (img, x, y, tag) in enumerate(((ref, rx, ry, 'REF'), (imp, ix, iy, 'IMP'))):
    oy = k * (h + pad + gap)
    out.paste(img.crop((x, y, x + w, y + h)), (pad, oy + pad))
    d.text((2, oy + 2), tag, fill=(0, 0, 0))
    for gx in range(0, w, 50):
        d.line([(pad + gx, oy + pad - 6), (pad + gx, oy + pad + h)], fill=(255, 0, 180) if gx % 100 == 0 else (255, 170, 225), width=1)
        if gx % 100 == 0:
            d.text((pad + gx + 2, oy + 2 + 10), str(gx), fill=(255, 0, 180))
    for gy in range(0, h, 25):
        col = (255, 0, 180) if gy % 50 == 0 else (255, 190, 235)
        d.line([(pad - 6, oy + pad + gy), (pad + w, oy + pad + gy)], fill=col, width=1)
        if gy % 50 == 0:
            d.text((1, oy + pad + gy + 1), str(gy), fill=(255, 0, 180))
out.save(os.path.join(folder, f'{name}-stack{suffix}.png'))
print('ok', out.size)
