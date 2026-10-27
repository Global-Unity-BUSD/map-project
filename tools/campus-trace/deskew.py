import sys, struct, math
src, out, deg = sys.argv[1], sys.argv[2], float(sys.argv[3])
data = open(src, 'rb').read()
off = struct.unpack_from('<I', data, 10)[0]
w, h = struct.unpack_from('<ii', data, 18); h = abs(h)
stride = (w * 3 + 3) & ~3
t = math.radians(deg); c, s = math.cos(t), math.sin(t)
cx, cy = w / 2, h / 2
buf = bytearray(b'\xff' * (stride * h))
for v in range(h):
    dy = v - cy
    for u in range(w):
        dx = u - cx
        # Source point: rotate output point by +theta (scan is rotated clockwise).
        x = int(round(cx + c * dx - s * dy)); y = int(round(cy + s * dx + c * dy))
        if 0 <= x < w and 0 <= y < h:
            i = off + y * stride + 3 * x; j = v * stride + 3 * u
            buf[j:j+3] = data[i:i+3]
header = bytearray(data[:off]); struct.pack_into('<i', header, 22, -h)
open(out, 'wb').write(bytes(header) + bytes(buf))
