"""Content-aligned comparison for pages rendered inside the locked app shell.

The shell (sidebar ~264px + 72px top bar) differs from the design images'
sidebar (~230px + 80px bar) by rule, so a raw pixel diff measures the shell,
not the page. This crops both images to their content area (right of the
sidebar, below the top bar), scales the reference content to the
implementation's content width, and diffs what is left.

  python scripts/ui-diff-content.py <folder> <name> [ref_left=230] [ref_top=80] [imp_left=264] [imp_top=72]

Writes <name>-content-side.png and <name>-content-diff.png and prints the
mean difference plus the hottest rows (vertical rhythm) and columns (widths).
"""
import sys, os
import numpy as np
from PIL import Image

folder, name = sys.argv[1], sys.argv[2]
rl, rt, il, it = (int(x) for x in (sys.argv[3:7] + ['230', '80', '264', '72'][len(sys.argv[3:7]):]))
ref = Image.open(os.path.join(folder, f'{name}-reference.png')).convert('RGB')
imp = Image.open(os.path.join(folder, f'{name}-implementation.png')).convert('RGB')
imp = imp.crop((0, 0, min(imp.width, 1491), min(imp.height, 1055)))
rc = ref.crop((rl, rt, ref.width, ref.height))
ic = imp.crop((il, it, imp.width, imp.height))
scale = ic.width / rc.width
rc = rc.resize((ic.width, round(rc.height * scale)), Image.LANCZOS)
h = min(rc.height, ic.height)
rc, ic = rc.crop((0, 0, ic.width, h)), ic.crop((0, 0, ic.width, h))
a, b = np.asarray(rc, np.int16), np.asarray(ic, np.int16)
d = np.abs(a - b).mean(axis=2)
print(f'{name}: content-aligned mean diff {d.mean():.1f}  (ref content scaled x{scale:.3f}, compared {ic.width}x{h})')
rows = d.mean(axis=1)
bands = [(rows[y:y + 40].mean(), y) for y in range(0, h - 40, 40)]
print('  worst 40px rows (y from content top):', ', '.join(f'y{y}:{s:.0f}' for s, y in sorted(bands, reverse=True)[:6]))
side = Image.new('RGB', (ic.width * 2 + 10, h), 'white'); side.paste(rc, (0, 0)); side.paste(ic, (ic.width + 10, 0))
side.save(os.path.join(folder, f'{name}-content-side.png'))
norm = np.clip(d * 3, 0, 255).astype(np.uint8)
heat = np.stack([norm, (255 - norm) // 3, np.zeros_like(norm)], axis=2)
faded = (a * 0.35 + 255 * 0.65).astype(np.uint8)
Image.fromarray(np.where((norm > 24)[..., None], heat, faded).astype(np.uint8)).save(os.path.join(folder, f'{name}-content-diff.png'))
