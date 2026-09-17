"""Extract card/panel rectangles from a light-theme screenshot.

Finds long horizontal and vertical border runs (1px lines a little darker than
their surroundings) and pairs them into boxes, so a design image's layout grid
(card x/y/width/height and gutters) can be read as numbers.

  python scripts/ui-boxes.py <image> [left=236] [top=60] [min_w=120] [min_h=40]
"""
import sys
import numpy as np
from PIL import Image

path = sys.argv[1]
left = int(sys.argv[2]) if len(sys.argv) > 2 else 236
top = int(sys.argv[3]) if len(sys.argv) > 3 else 60
min_w = int(sys.argv[4]) if len(sys.argv) > 4 else 120
min_h = int(sys.argv[5]) if len(sys.argv) > 5 else 40
a = np.asarray(Image.open(path).convert('L'), np.int16)
H, W = a.shape
# a border pixel is darker than both neighbours across the line by a small margin
def runs(mask, axis_len, min_len):
    out = []
    for i, row in enumerate(mask):
        j = 0
        n = len(row)
        while j < n:
            if row[j]:
                k = j
                while k < n and row[k]: k += 1
                if k - j >= min_len: out.append((i, j, k))
                j = k
            else: j += 1
    return out
up = np.zeros_like(a, bool); up[1:-1] = (a[1:-1] < a[:-2] - 6) & (a[1:-1] < a[2:] - 3) & (a[1:-1] > 170)
dn = np.zeros_like(a, bool); dn[1:-1] = (a[1:-1] < a[2:] - 6) & (a[1:-1] < a[:-2] - 3) & (a[1:-1] > 170)
hm = up | dn
hr = [(y, x0, x1) for y, x0, x1 in runs(hm, W, min_w) if x0 >= left and y >= top]
vm = np.zeros_like(a, bool); vm[:, 1:-1] = (a[:, 1:-1] < a[:, :-2] - 6) & (a[:, 1:-1] < a[:, 2:] - 3) & (a[:, 1:-1] > 170)
vr = [(x, y0, y1) for x, y0, y1 in runs(vm.T, H, min_h) if x >= left and y0 >= top]
# merge near-duplicate horizontal runs
hr.sort()
print('H lines (y: x0-x1 w):')
last = None
for y, x0, x1 in hr:
    if last and abs(y - last[0]) <= 1 and abs(x0 - last[1]) <= 3: continue
    print(f'  y={y:4d} x={x0:4d}-{x1:4d} w={x1-x0}')
    last = (y, x0, x1)
print('V lines (x: y0-y1 h):')
vr.sort(key=lambda r: (r[1], r[0]))
last = None
for x, y0, y1 in vr:
    if last and abs(x - last[0]) <= 1 and abs(y0 - last[1]) <= 3: continue
    print(f'  x={x:4d} y={y0:4d}-{y1:4d} h={y1-y0}')
    last = (x, y0, y1)
