const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const generate = require('@babel/generator').default;
const { prepareLabeledSvg } = require('../src/map/prepareLabeledSvg.cjs');
const transformer = require('../svg-transformer.cjs');
const { pathBounds } = require('../src/map/sourceAnnotations.cjs');
const { annotationBox, annotationMatrix, boxesOverlap, layoutAnnotations, MAX_LABEL_OFFSET,
  projectAnchor } = require('../src/map/annotationLayout.ts');
const { LAYOUT_MIN_ZOOM, nextDetailLevel } = require('../src/map/detailPolicy.ts');
const { boundPan, clamp, fitMap, focalOffset,
  MIN_ZOOM, MAX_ZOOM } = require('../src/map/mapMath.ts');

const source = readFileSync(resolve(__dirname, '../2026-10-04_floor2-labeled.svg'), 'utf8');
const map = prepareLabeledSvg(source);

test('bundling uses only labeled SVG geometry without rendering clipped glyph outlines', () => {
  const maskXml = source.match(/<mask\b[^>]*>[\s\S]*?<\/mask>/)[0];
  const sourcePaths = [...source.replace(maskXml, '').matchAll(/<path d="([^"]*)"/g)]
    .map((match) => match[1]);
  const outlineParts = sourcePaths.at(-1).match(/M[^M]*/g);
  const walls = Object.values(map.structure).flatMap(({ d }) => [...d.matchAll(/M[^M]*/g)].map(([part]) => part));
  assert.deepEqual(walls.sort(), outlineParts.slice(0, 377).sort());
  assert.equal(map.border.d, outlineParts.slice(377, 381).join(''));
  assert.equal(map.base.d, sourcePaths[0]);
  const labels = sourcePaths.slice(1, -1).join('').match(/M[^M]*/g);
  const preparedLabels = map.annotations.flatMap(({ d }) => d.match(/M[^M]*/g));
  assert.deepEqual(preparedLabels.sort(), labels.sort());
  assert.equal(map.annotations.length, 39);
  assert.equal(map.annotations.filter(({ kind }) => kind === 'room').length, 36);
  const renderedLength = [map.base, ...Object.values(map.structure), map.border,
    ...map.annotations].reduce((sum, path) => sum + path.d.length, 0);
  assert.ok(renderedLength < sourcePaths.at(-1).length / 2);
  assert.throws(() => prepareLabeledSvg(source.replace('M133.6 100.1H133.55', 'M133.7 100.1H133.55')),
    /path order changed/);
});

test('glyph bounds are exact, including curves and scientific-notation coordinates', () => {
  assert.deepEqual(pathBounds('M0 0C0 100 100 100 100 0Z'),
    { minX: 0, minY: 0, maxX: 100, maxY: 75 });
  assert.deepEqual(pathBounds('M1e-3 -2H3V4L-1 -2Z'),
    { minX: -1, minY: -2, maxX: 3, maxY: 4 });
  assert.throws(() => pathBounds('M0 0Q20 20 40 0'), /Unsupported/);
});

test('room anchors match the actual labeled SVG glyph centers, not the old range positions', () => {
  const expected = {
    1202: [58.4182, 223.729], 1208: [141.0355, 223.918],
    1216: [116.5675, 133.91855], 1217: [98.43125, 135.8885],
    1218: [78.95095, 131.6615], 1229: [78.9476, 105.22218],
    1230: [98.10025, 102.9185], 1233: [150.1045, 117.9185],
    1234: [151.1555, 106.9185], 1236: [96.08325, 119.91855],
    1242: [143.974, 33.88835], 1245: [82.99995, 45.9182], 1248: [83.0383, 79.9182],
  };
  for (const [id, [x, y]] of Object.entries(expected)) {
    const label = map.annotations.find((a) => a.id === id);
    assert.ok(label, id);
    assert.ok(Math.abs(label.anchor.x - x) < 0.0001, `${id}: x`);
    assert.ok(Math.abs(label.anchor.y - y) < 0.0001, `${id}: y`);
    const room = label.roomBounds;
    assert.ok(x > room.minX && x < room.maxX && y > room.minY && y < room.maxY, id);
  }
});

test('three layouts avoid label/wall collisions, bound offsets, and reveal all detail', () => {
  for (const [width, height] of [[320, 500], [390, 650], [430, 780], [768, 1024], [1024, 640]]) {
    const fitScale = fitMap(width, height, 201, 258).width / 201;
    const labels = layoutAnnotations(map.annotations, map.walls, fitScale);
    const counts = [];
    for (const level of [0, 1, 2]) {
      const visible = labels.filter((label) => label.placements[level].visible);
      counts.push(visible.length);
      const scale = fitScale * LAYOUT_MIN_ZOOM[level];
      const boxes = visible.map((label) => annotationBox(label, label.placements[level], scale));
      for (let i = 0; i < visible.length; i++) {
        const label = visible[i];
        const placement = label.placements[level];
        assert.ok(Math.abs(placement.offsetX) <= MAX_LABEL_OFFSET && Math.abs(placement.offsetY) <= MAX_LABEL_OFFSET);
        const b = boxes[i];
        const room = label.roomBounds;
        assert.ok(b.minX >= room.minX * scale && b.maxX <= room.maxX * scale);
        assert.ok(b.minY >= room.minY * scale && b.maxY <= room.maxY * scale);
        const glyphSize = label.glyphHeight * placement.scale;
        assert.ok(glyphSize >= 10 - 1e-6 && glyphSize <= (label.kind === 'room' ? 12 : 14) + 1e-6);
        for (let j = i + 1; j < visible.length; j++) {
          assert.ok(!boxesOverlap(b, boxes[j]), `${width}px level ${level}: ${label.id}/${visible[j].id}`);
        }
        assert.ok(!map.walls.some((wall) => boxesOverlap(b, {
          minX: Math.min(wall.x1, wall.x2) * scale - 0.1,
          maxX: Math.max(wall.x1, wall.x2) * scale + 0.1,
          minY: Math.min(wall.y1, wall.y2) * scale - 0.1,
          maxY: Math.max(wall.y1, wall.y2) * scale + 0.1,
        })), `${label.id} sits on a wall`);
      }
      // Membership, offsets and sizes are fixed while zoom changes within a
      // level. Re-check overlaps throughout its range, not only at entry.
      const zooms = level === 0 ? [1, 1.5, 1.99] : level === 1 ? [1.75, 2, 2.6, 3.39] : [3.1, 4, 6, 8];
      for (const zoom of zooms) {
        const atZoom = visible.map((label) => annotationBox(label, label.placements[level], fitScale * zoom));
        for (let i = 0; i < atZoom.length; i++) for (let j = i + 1; j < atZoom.length; j++) {
          assert.ok(!boxesOverlap(atZoom[i], atZoom[j]), `${width}px/${zoom}x ${visible[i].id}/${visible[j].id}`);
        }
      }
    }
    assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
    assert.equal(counts[2], 39, `${width}px full detail must show all rooms and names`);
    for (const id of ['STEAM Lab', 'Small Quad']) {
      assert.ok(labels.find((a) => a.id === id).placements[0].visible, `${width}px ${id} overview`);
    }
  }
});

test('annotations track geometry through zoom/pan without growing or drifting from their rooms', () => {
  const width = 390; const height = 650;
  const fitScale = fitMap(width, height, 201, 258).width / 201;
  const labels = layoutAnnotations(map.annotations, map.walls, fitScale);
  const apply = (matrix, x, y) => ({ x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5] });
  for (const label of labels) {
    const placement = label.placements[2];
    for (const zoom of [3.4, 4, 6, 8]) {
      const projected = projectAnchor(label.anchor, fitScale, zoom, width, height, 201, 258);
      const matrix = annotationMatrix(label.anchor, placement, projected);
      const drawn = apply(matrix, label.anchor.x, label.anchor.y);
      assert.ok(Math.abs(drawn.x - projected.x - placement.offsetX) < 1e-9);
      assert.ok(Math.abs(drawn.y - projected.y - placement.offsetY) < 1e-9);
      // Parent SVG pan adds identical x/y translation to room anchors and labels.
      const panX = -160; const panY = 220;
      assert.ok(Math.abs((drawn.x + panX) - (projected.x + panX) - placement.offsetX) < 1e-9);
      assert.ok(Math.abs((drawn.y + panY) - (projected.y + panY) - placement.offsetY) < 1e-9);
      const corner = apply(matrix, label.bounds.maxX, label.bounds.maxY);
      const other = apply(matrix, label.bounds.minX, label.bounds.minY);
      assert.ok(Math.abs(corner.x - other.x - placement.width) < 1e-9);
      assert.ok(Math.abs(corner.y - other.y - placement.height) < 1e-9);
    }
  }
});

test('detail stays discrete within levels and hysteresis prevents threshold flicker', () => {
  let level = 0;
  for (const zoom of [1, 1.3, 1.8, 1.99]) {
    level = nextDetailLevel(zoom, level); assert.equal(level, 0);
  }
  level = nextDetailLevel(2, level); assert.equal(level, 1);
  for (const zoom of [1.99, 2.01, 1.8, 3.39, 2.4]) {
    level = nextDetailLevel(zoom, level); assert.equal(level, 1);
  }
  level = nextDetailLevel(3.4, level); assert.equal(level, 2);
  for (const zoom of [3.39, 3.41, 3.2, 8, 3.1]) {
    level = nextDetailLevel(zoom, level); assert.equal(level, 2);
  }
  level = nextDetailLevel(3.09, level); assert.equal(level, 1);
  level = nextDetailLevel(1.74, level); assert.equal(level, 0);
  assert.equal(nextDetailLevel(8, 0), 2);
  assert.equal(nextDetailLevel(1, 2), 0);
});

test('Metro transforms fresh source-derived annotation metadata and tracks adapter cache', () => {
  const root = resolve(__dirname, '..');
  const options = { projectRoot: root };
  const key = transformer.getCacheKey(options);
  assert.match(key, /^[0-9a-f]{64}$/);
  const transformed = transformer.transform({
    filename: resolve(root, '2026-10-04_floor2-labeled.svg'), src: source,
    options: { dev: true, platform: 'ios', projectRoot: root },
  });
  const context = { module: { exports: {} } };
  runInNewContext(generate(transformed.ast).code, context);
  assert.equal(context.module.exports.annotations.length, 39);
  assert.equal(context.module.exports.annotations.find((a) => a.id === '1202').anchor.x, 58.4182);
});

test('pinch preserves the touched map point through scale and focal movement', () => {
  for (const [startZoom, desiredZoom, startOffset, startFocal, currentFocal] of [
    [1, 2, 0, 35, 60], [3, 1.5, -120, -75, 20], [6, 30, 210, 100, -40],
  ]) {
    const zoom = clamp(desiredZoom, MIN_ZOOM, MAX_ZOOM);
    const offset = focalOffset(startOffset, startFocal, currentFocal, zoom / startZoom);
    const mapPointBefore = (startFocal - startOffset) / startZoom;
    const mapPointAfter = (currentFocal - offset) / zoom;
    assert.ok(Math.abs(mapPointBefore - mapPointAfter) < 1e-10);
  }
});

test('fit and bounds keep the map reachable across phone/tablet viewports and zoom limits', () => {
  for (const [width, height] of [[320, 500], [430, 780], [1024, 640]]) {
    const fitted = fitMap(width, height, 201, 258);
    assert.ok(fitted.width < width && fitted.height < height);
    assert.ok(Math.abs(fitted.width / fitted.height - 201 / 258) < 1e-10);
    assert.equal(boundPan(1e6, fitted.width, width, MIN_ZOOM), 0);
    for (const zoom of [1, 2, 4, 8]) {
      const limit = Math.max(0, (fitted.width * zoom - width) / 2);
      assert.equal(boundPan(1e6, fitted.width, width, zoom), limit);
      assert.equal(boundPan(-1e6, fitted.width, width, zoom), -limit);
    }
  }
});
