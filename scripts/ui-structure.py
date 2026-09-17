"""Structure-only comparison: how well do edges (text, borders, card outlines)
line up, ignoring what the photographs actually show?

Colour diff punishes demo photos that can never equal the reference's generated
ones. This compares gradient (edge) maps instead, at the best alignment found by
a small search, and reports the share of reference edges matched within 2px.

  python scripts/ui-structure.py <folder> <name...>
"""
import sys
import numpy as np
from PIL import Image

folder = sys.argv[1]
def prep(img, l, t):
    return img.crop((l, t, img.width, img.height))
def edges(a):
    gx = np.abs(np.diff(a, axis=1))[:-1, :]
    gy = np.abs(np.diff(a, axis=0))[:, :-1]
    return (np.hypot(gx, gy) > 28)
def dilate(m, r=2):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out

for name in sys.argv[2:]:
    ref = Image.open(f'{folder}/{name}-reference.png').convert('RGB')
    imp = Image.open(f'{folder}/{name}-implementation.png').convert('RGB').crop((0, 0, 1491, 1055))
    best = None
    for it in range(96, 112, 2):
        for il in range(278, 292, 2):
            rc = prep(ref, 248, 88); ic = prep(imp, il, it)
            sc = ic.width / rc.width
            rc = rc.resize((ic.width, round(rc.height * sc)), Image.LANCZOS)
            h = min(rc.height, ic.height)
            A = np.asarray(rc.convert('L').crop((0, 0, ic.width, h)), np.float32)
            B = np.asarray(ic.convert('L').crop((0, 0, ic.width, h)), np.float32)
            col = np.abs(np.asarray(rc.crop((0, 0, ic.width, h)), np.int16) - np.asarray(ic.crop((0, 0, ic.width, h)), np.int16)).mean()
            ea, eb = edges(A), edges(B)
            matched = (ea & dilate(eb)).sum() / max(1, ea.sum())
            if best is None or matched > best[0]:
                best = (matched, col, il, it)
    print(f'{name}: structure match {best[0]*100:.1f}%  colour diff {best[1]:.1f}  (align {best[2]}/{best[3]})')
