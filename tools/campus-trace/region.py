# Usage: region.py page.bmp x0 y0 x1 y1 minrun  -> prints long H/V dark runs (page coords)
import sys, struct
path = sys.argv[1]; x0, y0, x1, y1, minrun = map(int, sys.argv[2:7])
f = open(path, 'rb'); head = f.read(54)
off = struct.unpack_from('<I', head, 10)[0]; w, h = struct.unpack_from('<ii', head, 18); h = abs(h)
stride = (w * 3 + 3) & ~3
rows = []
for y in range(y0, y1):
    f.seek(off + y * stride + 3 * x0); b = f.read(3 * (x1 - x0))
    rows.append(bytes(1 if b[3*i] + b[3*i+1] + b[3*i+2] < 300 else 0 for i in range(x1 - x0)))
def runs(seq):
    out = []; s = None
    for i, v in enumerate(seq):
        if v and s is None: s = i
        if not v and s is not None: out.append((s, i - 1)); s = None
    if s is not None: out.append((s, len(seq) - 1))
    return out
items = []
for j, r in enumerate(rows):
    for a, b in runs(r):
        if b - a >= minrun: items.append(('H', y0 + j, x0 + a, x0 + b))
for i in range(x1 - x0):
    col = [rows[j][i] for j in range(len(rows))]
    for a, b in runs(col):
        if b - a >= minrun: items.append(('V', x0 + i, y0 + a, y0 + b))
for kind in 'HV':
    groups = []
    for _, p, a, b in sorted(t for t in items if t[0] == kind):
        for g in groups:
            if abs(g[0][-1] - p) <= 3 and a <= g[2] + 40 and b >= g[1] - 40:
                g[0].append(p); g[1] = min(g[1], a); g[2] = max(g[2], b); break
        else: groups.append([[p], a, b])
    for ps, a, b in sorted(groups, key=lambda g: sum(g[0]) / len(g[0])):
        print(kind, round(sum(ps) / len(ps)), a, b, 'n=%d' % len(ps))
