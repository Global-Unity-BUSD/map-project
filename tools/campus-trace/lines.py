import sys, struct
path, minrun = sys.argv[1], int(sys.argv[2])
data = open(path, 'rb').read()
off = struct.unpack_from('<I', data, 10)[0]
w, h = struct.unpack_from('<ii', data, 18)
h = abs(h); stride = (w * 3 + 3) & ~3
dark = [bytearray(w) for _ in range(h)]
for y in range(h):
    row = data[off + y * stride: off + y * stride + w * 3]
    d = dark[y]
    for x in range(w):
        b, g, r = row[3*x], row[3*x+1], row[3*x+2]
        if (r + g + b) < 300: d[x] = 1
import pickle
pickle.dump((w, h, [bytes(r) for r in dark]), open(sys.argv[3], 'wb'))
def runs(seq):
    out = []; start = None
    for i, v in enumerate(seq):
        if v and start is None: start = i
        if not v and start is not None: out.append((start, i - 1)); start = None
    if start is not None: out.append((start, len(seq) - 1))
    return out
print('H lines (y: x0-x1 len)')
for y in range(h):
    for a, b in runs(dark[y]):
        if b - a >= minrun: print('H', y, a, b, b - a)
print('V lines (x: y0-y1 len)')
for x in range(w):
    col = [dark[y][x] for y in range(h)]
    for a, b in runs(col):
        if b - a >= minrun: print('V', x, a, b, b - a)
