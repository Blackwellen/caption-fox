"""Side-by-side reference vs implementation with a labelled 50px ruler.

Same content alignment as ui-diff-content.py (shell cropped, reference scaled
to the implementation's content width). Splits the result into horizontal
bands so each can be viewed near native resolution, and draws a y-ruler so
section offsets can be read directly.

  python scripts/ui-ruler.py <folder> <name> ref_left ref_top imp_left imp_top [band_height=480]

Writes <name>-ruler-<n>.png.
"""
import sys, os
from PIL import Image, ImageDraw

folder, name = sys.argv[1], sys.argv[2]
rl, rt, il, it = (int(x) for x in sys.argv[3:7])
band = int(sys.argv[7]) if len(sys.argv) > 7 else 480
ref = Image.open(os.path.join(folder, f'{name}-reference.png')).convert('RGB')
imp = Image.open(os.path.join(folder, f'{name}-implementation.png')).convert('RGB')
imp = imp.crop((0, 0, min(imp.width, 1491), min(imp.height, 1055)))
rc = ref.crop((rl, rt, ref.width, ref.height))
ic = imp.crop((il, it, imp.width, imp.height))
scale = ic.width / rc.width
rc = rc.resize((ic.width, round(rc.height * scale)), Image.LANCZOS)
h = max(rc.height, ic.height)
gut = 34
W = ic.width * 2 + gut * 2
n = 0
for top in range(0, h, band):
    bh = min(band, h - top)
    out = Image.new('RGB', (W, bh), 'white')
    out.paste(rc.crop((0, top, rc.width, min(top + bh, rc.height))), (gut, 0))
    out.paste(ic.crop((0, top, ic.width, min(top + bh, ic.height))), (gut * 2 + ic.width, 0))
    d = ImageDraw.Draw(out)
    for y in range((top // 50) * 50, top + bh, 50):
        if y < top:
            continue
        yy = y - top
        for x0 in (gut, gut * 2 + ic.width):
            d.line([(x0, yy), (x0 + ic.width, yy)], fill=(255, 0, 180), width=1)
        d.text((2, yy + 1), str(y), fill=(255, 0, 180))
        d.text((gut + ic.width + 2, yy + 1), str(y), fill=(255, 0, 180))
    n += 1
    out.save(os.path.join(folder, f'{name}-ruler-{n}.png'))
print(f'{name}: {n} bands (ref scaled x{scale:.3f})')
