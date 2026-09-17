"""Compare the horizontal rules of a page: panel tops/bottoms, table rules, card
edges. Robust where text-edge matching is not, because it ignores glyph shapes.

Prints reference line -> nearest implementation line and the offset, so a
section that is the wrong height shows up as a step in the offsets.

  python scripts/ui-lines.py <folder> <name> [imp_left] [imp_top]
"""
import sys
import numpy as np
from PIL import Image

folder, name = sys.argv[1], sys.argv[2]
il = int(sys.argv[3]) if len(sys.argv) > 3 else 288
it = int(sys.argv[4]) if len(sys.argv) > 4 else 98
ref = Image.open(f'{folder}/{name}-reference.png').convert('RGB').crop((248, 88, 1491, 1055))
imp = Image.open(f'{folder}/{name}-implementation.png').convert('RGB').crop((il, it, 1491, 1055))
scale = imp.width / ref.width
ref = ref.resize((imp.width, round(ref.height * scale)), Image.LANCZOS)

def lines(img):
    a = np.asarray(img.convert('L'), np.float32)
    d = np.abs(np.diff(a, axis=0))            # vertical change per row
    strength = (d > 8).mean(axis=1)           # share of the width that changes
    out = []
    for y in range(1, len(strength) - 1):
        if strength[y] > 0.35 and strength[y] >= strength[y - 1] and strength[y] > strength[y + 1]:
            if not out or y - out[-1][0] > 4:
                out.append((y, strength[y]))
    return [y for y, _ in out]

R, I = lines(ref), lines(imp)
print(f'{name}: {len(R)} reference rules vs {len(I)} implementation rules (align {il}/{it})')
offs = []
for y in R:
    if not I:
        break
    j = min(I, key=lambda v: abs(v - y))
    d = j - y
    flag = '' if abs(d) <= 3 else ('  <-- off' if abs(d) <= 25 else '  <-- no match')
    if abs(d) <= 25:
        offs.append(d)
    print(f'  ref y{y:<4} -> imp y{j:<4} ({d:+d}){flag}')
if offs:
    print(f'  median offset {int(np.median(offs)):+d}px over {len(offs)} matched rules')
