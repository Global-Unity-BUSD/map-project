import sys, struct
src, out, step = sys.argv[1], sys.argv[2], int(sys.argv[3])
data = bytearray(open(src, 'rb').read())
off = struct.unpack_from('<I', data, 10)[0]
w, h = struct.unpack_from('<ii', data, 18); h = abs(h)
stride = (w * 3 + 3) & ~3
def put(x, y, bgr):
    i = off + y * stride + 3 * x; data[i:i+3] = bytes(bgr)
for y in range(h):
    for x in range(w):
        if x % step == 0 or y % step == 0:
            major = (x % (step * 5) == 0) if x % step == 0 else (y % (step * 5) == 0)
            put(x, y, (0, 0, 255) if major else (255, 160, 0))
open(out, 'wb').write(bytes(data))
