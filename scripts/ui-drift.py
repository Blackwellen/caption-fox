"""Vertical drift profile: for each horizontal band of the reference content,
find the vertical shift that best matches the implementation.

A constant dy means a whole-page offset; a dy that grows down the page means a
section above it is the wrong height. Prints band -> dy (px, + = ours is lower).

  python scripts/ui-drift.py <folder> <name> [ref_left=248] [ref_top=88] [imp_left=288] [imp_top=98]
"""
import sys
import numpy as np
from PIL import Image

folder, name = sys.argv[1], sys.argv[2]
rl, rt, il, it = (int(x) for x in (sys.argv[3:7] + ['248', '88', '288', '98'][len(sys.argv[3:7]):]))
ref = Image.open(f'{folder}/{name}-reference.png').convert('RGB')
imp = Image.open(f'{folder}/{name}-implementation.png').convert('RGB').crop((0, 0, 1491, 1055))
rc = ref.crop((rl, rt, ref.width, ref.height))
ic = imp.crop((il, it, imp.width, imp.height))
scale = ic.width / rc.width
rc = rc.resize((ic.width, round(rc.height * scale)), Image.LANCZOS)
A = np.asarray(rc.convert('L'), np.float32)
B = np.asarray(ic.convert('L'), np.float32)
H = min(A.shape[0], B.shape[0])
BAND, R = 60, 34
print(f'{name}: band -> best dy (+ = implementation sits lower than the reference)')
for y in range(0, H - BAND, BAND):
    a = A[y:y + BAND]
    best = None
    for dy in range(-R, R + 1):
        y2 = y + dy
        if y2 < 0 or y2 + BAND > B.shape[0]:
            continue
        d = np.abs(a - B[y2:y2 + BAND]).mean()
        if best is None or d < best[0]:
            best = (d, dy)
    print(f'  y{y:<4} dy={best[1]:+3d}  diff={best[0]:.0f}')
