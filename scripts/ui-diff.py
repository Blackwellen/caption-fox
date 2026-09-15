"""Visual comparison for the 1:1 design workflow.

  python scripts/ui-diff.py docs/ui-verification/caption-fox/brand-assets overview

Reads <name>-reference.png and <name>-implementation.png, crops the
implementation to the reference viewport (1491x1055, top-left), and writes:
  <name>-diff.png   heat map of per-pixel difference over a faded reference
  <name>-side.png   reference | implementation side by side
and prints the mean difference plus the worst 8 regions on a 12x8 grid, so
systematic offsets are fixed before isolated details.

The sidebar region (x < 230) is reported separately: Caption Fox keeps its own
canonical sidebar by rule, so differences there are expected and excluded
from the content score.
"""
import sys, os
import numpy as np
from PIL import Image

folder, name = sys.argv[1], sys.argv[2]
ref = Image.open(os.path.join(folder, f'{name}-reference.png')).convert('RGB')
imp = Image.open(os.path.join(folder, f'{name}-implementation.png')).convert('RGB')
W, H = ref.size
imp = imp.crop((0, 0, W, H)) if imp.width >= W and imp.height >= H else imp.resize((W, H))

a = np.asarray(ref, dtype=np.int16)
b = np.asarray(imp, dtype=np.int16)
d = np.abs(a - b).mean(axis=2)

SIDEBAR = 230
content = d[:, SIDEBAR:]
print(f'{name}: mean diff content={content.mean():.1f} sidebar={d[:, :SIDEBAR].mean():.1f} (0=identical, 255=inverse)')

gx, gy = 12, 8
cells = []
cw, ch = (W - SIDEBAR) / gx, H / gy
for j in range(gy):
    for i in range(gx):
        x0, y0 = int(SIDEBAR + i * cw), int(j * ch)
        cells.append((d[y0:int(y0 + ch), x0:int(x0 + cw)].mean(), x0, y0))
for score, x0, y0 in sorted(cells, reverse=True)[:8]:
    print(f'  hot region x={x0}-{int(x0 + cw)} y={y0}-{int(y0 + ch)} diff={score:.1f}')

heat = np.zeros((H, W, 3), dtype=np.uint8)
norm = np.clip(d * 3, 0, 255).astype(np.uint8)
heat[..., 0] = norm
heat[..., 1] = (255 - norm) // 3
faded = (np.asarray(ref, dtype=np.float32) * 0.35 + 255 * 0.65).astype(np.uint8)
mask = (norm > 24)[..., None]
out = np.where(mask, heat, faded)
Image.fromarray(out).save(os.path.join(folder, f'{name}-diff.png'))

side = Image.new('RGB', (W * 2 + 12, H), 'white')
side.paste(ref, (0, 0))
side.paste(imp, (W + 12, 0))
side.save(os.path.join(folder, f'{name}-side.png'))
