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
  projectAnchor, zoomAnnotationMatrix } = require('../src/map/annotationLayout.ts');
const { LAYOUT_MIN_ZOOM, nextDetailLevel } = require('../src/map/detailPolicy.ts');
const { boundPan, cameraMatrix, clamp, fitMap, focalOffset, moveCamera, normalizeAngle, rotatedSize, touchFrame,
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

function near(actual, expected, message = '') {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
}

function applyMatrix(matrix, point) {
  return { x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5] };
}

function pairFrame(x, y, distance, angle, reverse = false) {
  const dx = Math.cos(angle) * distance / 2;
  const dy = Math.sin(angle) * distance / 2;
  const points = [{ id: 3, x: 195 + x - dx, y: 325 + y - dy },
    { id: 8, x: 195 + x + dx, y: 325 + y + dy }];
  return touchFrame(reverse ? points.reverse() : points, 390, 650);
}

function mapPointUnderFocal(camera, frame) {
  const dx = (frame.x - camera.x) / camera.zoom;
  const dy = (frame.y - camera.y) / camera.zoom;
  const c = Math.cos(camera.rotation);
  const s = Math.sin(camera.rotation);
  return { x: c * dx + s * dy, y: -s * dx + c * dy };
}

test('combined pinch, rotation and focal translation preserve the touched map point', () => {
  for (const rotation of [-Math.PI, -0.5, 0, Math.PI / 2, 8 * Math.PI]) {
    for (const zoom of [1, 3, 7]) {
      const camera = { zoom, rotation, x: -30, y: 25 };
      const start = pairFrame(40, -60, 100, 0.3);
      const current = pairFrame(-25, 45, 130, 0.9, true);
      const next = moveCamera(camera, start, current, 2000, 2000, 390, 650);
      const before = mapPointUnderFocal(camera, start);
      const after = mapPointUnderFocal(next, current);
      near(after.x, before.x, 'focal x');
      near(after.y, before.y, 'focal y');
      near(next.zoom, Math.min(8, zoom * 1.3));
      near(next.rotation, rotation + 0.6);
    }
  }
});

test('rotation remains continuous across the angle seam and many complete turns', () => {
  let camera = { zoom: 3, rotation: 0.4, x: -22, y: 15 };
  let previous = pairFrame(20, -35, 100, Math.PI - 0.01);
  const anchor = mapPointUnderFocal(camera, previous);
  for (let step = 1; step <= 2500; step++) {
    const angle = Math.PI - 0.01 + step * 0.03;
    const current = pairFrame(20 + 10 * Math.sin(step / 50), -35 + 10 * Math.cos(step / 40),
      100 + 20 * Math.sin(step / 30), angle, step % 2 === 0);
    const next = moveCamera(camera, previous, current, 2000, 2000, 390, 650);
    near(next.rotation - camera.rotation, 0.03, 'no seam jump');
    const point = mapPointUnderFocal(next, current);
    near(point.x, anchor.x, 'long gesture x');
    near(point.y, anchor.y, 'long gesture y');
    camera = next;
    previous = current;
  }
  near(camera.rotation, 0.4 + 2500 * 0.03);
  const normalized = normalizeAngle(camera.rotation);
  assert.ok(normalized >= -Math.PI && normalized < Math.PI);
  near(Math.sin(normalized), Math.sin(camera.rotation));
  near(Math.cos(normalized), Math.cos(camera.rotation));
});

test('pointer membership changes rebase without jumps and three fingers pause movement', () => {
  const camera = { zoom: 3, rotation: 0.8, x: 10, y: -20 };
  const one = touchFrame([{ id: 3, x: 170, y: 310 }], 390, 650);
  const two = pairFrame(30, -10, 100, 0.2);
  const three = touchFrame([{ id: 3, x: 100, y: 200 }, { id: 8, x: 200, y: 250 },
    { id: 9, x: 210, y: 260 }], 390, 650);
  const move = (previous, current) => moveCamera(camera, previous, current, 2000, 2000, 390, 650);
  assert.equal(move(null, two), camera);
  assert.equal(move(one, two), camera);
  assert.equal(move(two, three), camera);
  assert.equal(move(three, three), camera);
  assert.equal(move(three, two), camera);
  assert.equal(move(two, { ...two, secondId: 99 }), camera);

  // Touch-up payloads can include or omit the departing touch. Both rebase to
  // the same remaining finger, and the next move pans without a stale focal.
  const first = { id: 3, x: 170, y: 310 };
  const departing = { id: 8, x: 240, y: 350 };
  const up = touchFrame([departing, first], 390, 650, [departing]);
  assert.deepEqual(up, touchFrame([first], 390, 650, [departing]));
  const moved = touchFrame([{ ...first, x: 177, y: 301 }], 390, 650);
  const next = move(up, moved);
  near(next.x, camera.x + 7);
  near(next.y, camera.y - 9);
  near(next.rotation, camera.rotation);
  assert.equal(touchFrame([first], 390, 650, [first]), null);
  assert.equal(touchFrame([], 390, 650), null);
});

test('zoom limits reverse immediately and near-coincident fingers cannot corrupt the camera', () => {
  const initial = { zoom: 7, rotation: 0, x: 0, y: 0 };
  const a = pairFrame(0, 0, 100, 0);
  const b = pairFrame(0, 0, 200, 0);
  const max = moveCamera(initial, a, b, 2000, 2000, 390, 650);
  assert.equal(max.zoom, 8);
  const reverse = moveCamera(max, b, pairFrame(0, 0, 190, 0), 2000, 2000, 390, 650);
  near(reverse.zoom, 7.6);
  const small = pairFrame(0, 0, 10, 0);
  const min = moveCamera(reverse, b, small, 2000, 2000, 390, 650);
  assert.equal(min.zoom, 1);
  const out = moveCamera(min, small, pairFrame(0, 0, 11, 0), 2000, 2000, 390, 650);
  near(out.zoom, 1.1);
  const coincident = pairFrame(0, 0, 0, 0);
  assert.equal(moveCamera(initial, coincident, b, 2000, 2000, 390, 650), initial);
  assert.equal(moveCamera(initial, a, coincident, 2000, 2000, 390, 650), initial);
});

test('rotated bounds enclose every corner and keep smaller axes centered', () => {
  near(rotatedSize(200, 300, 0).width, 200);
  near(rotatedSize(200, 300, Math.PI / 2).width, 300);
  near(rotatedSize(200, 300, Math.PI / 2).height, 200);
  for (const [width, height] of [[320, 500], [430, 780], [1024, 640]]) {
    const fitted = fitMap(width, height, 201, 258);
    for (const rotation of [0, Math.PI / 6, Math.PI / 4, Math.PI / 2, -2.5, 8 * Math.PI]) {
      const extent = rotatedSize(fitted.width, fitted.height, rotation);
      const matrix = cameraMatrix(0, 0, 0, 0, rotation);
      for (const x of [-fitted.width / 2, fitted.width / 2]) {
        for (const y of [-fitted.height / 2, fitted.height / 2]) {
          const p = applyMatrix(matrix, { x, y });
          assert.ok(Math.abs(p.x) <= extent.width / 2 + 1e-8);
          assert.ok(Math.abs(p.y) <= extent.height / 2 + 1e-8);
        }
      }
      for (const zoom of [1, 2, 8]) {
        const camera = { zoom, rotation, x: 0, y: 0 };
        const start = touchFrame([{ id: 1, x: 0, y: 0 }], width, height);
        const current = touchFrame([{ id: 1, x: 1e6, y: -1e6 }], width, height);
        const next = moveCamera(camera, start, current, fitted.width, fitted.height, width, height);
        near(next.x, Math.max(0, (extent.width * zoom - width) / 2));
        near(next.y, -Math.max(0, (extent.height * zoom - height) / 2));
      }
    }
  }
});

test('shared annotation rotation follows floor anchors and preserves glyph sizes at all levels', () => {
  const width = 390; const height = 650;
  const fitScale = fitMap(width, height, 201, 258).width / 201;
  const labels = layoutAnnotations(map.annotations, map.walls, fitScale);
  for (const level of [0, 1, 2]) {
    for (const zoom of [LAYOUT_MIN_ZOOM[level], level === 2 ? 8 : LAYOUT_MIN_ZOOM[level] + 0.2]) {
      for (const rotation of [0, Math.PI / 4, Math.PI / 2, Math.PI, -2.4, 10 * Math.PI]) {
        const parent = cameraMatrix(width, height, -150, 220, rotation);
        for (const label of labels) {
          const placement = label.placements[level];
          if (!placement.visible) continue;
          const matrix = zoomAnnotationMatrix(label.anchor, placement, fitScale * zoom,
            width, height, 201, 258);
          const unrotatedAnchor = projectAnchor(label.anchor, fitScale, zoom, width, height, 201, 258);
          const original = annotationMatrix(label.anchor, placement, unrotatedAnchor);
          matrix.forEach((value, i) => near(value, original[i]));
          const drawn = applyMatrix(parent, applyMatrix(matrix, label.anchor));
          const expected = applyMatrix(parent, {
            x: unrotatedAnchor.x + placement.offsetX, y: unrotatedAnchor.y + placement.offsetY,
          });
          near(drawn.x, expected.x);
          near(drawn.y, expected.y);
          const origin = applyMatrix(parent, applyMatrix(matrix, { x: 0, y: 0 }));
          const right = applyMatrix(parent, applyMatrix(matrix, { x: 1, y: 0 }));
          near(Math.hypot(right.x - origin.x, right.y - origin.y), placement.scale);
          near(right.x - origin.x, Math.cos(rotation) * placement.scale);
          near(right.y - origin.y, Math.sin(rotation) * placement.scale);
        }
      }
    }
  }
});

// Execute the real components' compiled callbacks with a small hook harness.
// This checks event wiring and shared-value dependencies, not native drawing/FPS.
function componentHarness() {
  const { transformSync } = require('@babel/core');
  const hooks = [];
  const changed = new Set();
  const sharedValues = new Set();
  const cancelled = [];
  let dependencies;
  const shared = (initial) => {
    let value = initial;
    const result = {
      get value() { dependencies?.add(result); return value; },
      set value(next) { result.set(next); },
      get() { return result.value; },
      set(next) {
        if (!Object.is(next, value)) { value = next; changed.add(result); }
      },
    };
    sharedValues.add(result);
    return result;
  };
  const closureInputs = (worklet) => {
    const inputs = new Set();
    const visit = (value) => {
      if (sharedValues.has(value)) inputs.add(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(worklet.__closure);
    return inputs;
  };
  const subscribe = (run, inputs = new Set()) => {
    const hook = { runs: 0, dependencies: new Set(), update: null, value: undefined };
    hook.update = () => {
      // Reanimated captures shared values from the entire worklet closure,
      // including branches which are not read during this particular update.
      dependencies = new Set(inputs);
      hook.value = run();
      hook.dependencies = dependencies;
      dependencies = undefined;
      hook.runs++;
    };
    hooks.push(hook);
    hook.update();
    return hook;
  };
  const flush = () => {
    let passes = 0;
    while (changed.size) {
      assert.ok(passes++ < 20, 'shared-value graph must settle');
      const pending = new Set(changed);
      changed.clear();
      for (const hook of hooks) {
        if ([...hook.dependencies].some((value) => pending.has(value))) hook.update();
      }
    }
  };
  const react = { memo: (fn) => fn, useMemo: (fn) => fn() };
  const native = { View: 'View', Pressable: 'Pressable', Text: 'Text',
    Platform: { OS: 'ios' }, StyleSheet: { create: (value) => value, absoluteFill: {} } };
  const reanimated = {
    default: { View: 'AnimatedView', createAnimatedComponent: (component) => component },
    useSharedValue: shared,
    cancelAnimation: (value) => { cancelled.push(value); },
    withTiming: (target) => target,
    useAnimatedReaction: (prepare, reactToValue) => {
      let previous = null;
      subscribe(() => {
        const current = prepare();
        // Only the prepare worklet's dependencies trigger a reaction.
        const inputs = dependencies;
        dependencies = undefined;
        reactToValue(current, previous);
        dependencies = inputs;
        previous = current;
      }, closureInputs(prepare));
    },
    useAnimatedStyle: (fn) => { subscribe(fn, closureInputs(fn)); return {}; },
    useAnimatedProps: (fn) => { subscribe(fn, closureInputs(fn)); return {}; },
    useDerivedValue: (fn) => {
      const value = shared(undefined);
      subscribe(() => value.set(fn()), closureInputs(fn));
      return value;
    },
  };
  const gesture = { callbacks: {}, shouldCancelWhenOutside() { return this; } };
  for (const callback of ['onTouchesDown', 'onTouchesMove', 'onTouchesUp', 'onTouchesCancelled', 'onFinalize']) {
    gesture[callback] = function (fn) { this.callbacks[callback] = fn; return this; };
  }
  const modules = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': native,
    'react-native-svg': { default: 'Svg', G: 'Group', Path: 'Path' },
    'react-native-reanimated': { __esModule: true, ...reanimated },
    'react-native-worklets': { scheduleOnUI: (fn) => fn() },
    'react-native-gesture-handler': { Gesture: { Manual: () => gesture }, GestureDetector: 'GestureDetector' },
    './LabeledMap': { __esModule: true, default: 'Floor', MAP_SIZE: { width: 201, height: 258 } },
    './AnnotationLayer': { __esModule: true, default: 'Annotations' },
    './annotationLayout': require('../src/map/annotationLayout.ts'),
    './detailPolicy': require('../src/map/detailPolicy.ts'),
    './mapMath': require('../src/map/mapMath.ts'),
    '../../2026-10-04_floor2-labeled.svg': { __esModule: true, default: map },
  };
  const load = (name, exposeViewport = false) => {
    const filename = resolve(__dirname, '../src/map', name);
    const { code } = transformSync(readFileSync(filename, 'utf8'), {
      filename, babelrc: false, configFile: false,
      presets: ['babel-preset-expo'],
      caller: { name: 'metro', platform: 'ios', supportsStaticESM: false },
    });
    const context = { exports: {}, global: { Error }, require: (id) => {
      if (id.startsWith('@babel/runtime/helpers/')) return require(id);
      assert.ok(id in modules, `unexpected runtime import: ${id}`);
      return modules[id];
    } };
    runInNewContext(code + (exposeViewport ? '\nexports.MapViewport = MapViewport;' : ''), context);
    return context.exports;
  };
  return { shared, hooks, changed, flush, cancelled, gesture, load };
}

test('real gesture callbacks rebase finger transitions, cancel, reset, and resume cleanly', () => {
  const harness = componentHarness();
  const tree = harness.load('InteractiveMap.tsx', true).MapViewport({ width: 390, height: 650 });
  const detector = tree.props.children[0];
  const surface = detector.props.children;
  const camera = surface.props.children[1].props;
  const reset = tree.props.children[1].props.onPress;
  const { callbacks } = harness.gesture;
  let ended = 0; let failed = 0; let activated = 0;
  const manager = { activate: () => activated++, end: () => ended++, fail: () => failed++ };
  const event = (allTouches, changedTouches = allTouches) => ({ allTouches, changedTouches });
  const start = [{ id: 3, x: 145, y: 325 }, { id: 8, x: 245, y: 325 }];
  callbacks.onTouchesDown(event(start), manager);
  callbacks.onTouchesMove(event([{ id: 3, x: 195, y: 175 }, { id: 8, x: 195, y: 475 }]));
  harness.flush();
  near(camera.zoom.value, 3);
  near(camera.rotation.value, Math.PI / 2);
  assert.equal(activated, 1);
  const before = { x: camera.x.value, y: camera.y.value };
  callbacks.onTouchesUp(event([{ id: 3, x: 195, y: 175 }, { id: 8, x: 195, y: 475 }],
    [{ id: 8, x: 195, y: 475 }]), manager);
  callbacks.onTouchesMove(event([{ id: 3, x: 205, y: 160 }]));
  near(camera.x.value, before.x + 10);
  near(camera.y.value, before.y - 15);
  callbacks.onTouchesCancelled(event([]), manager);
  callbacks.onFinalize();
  assert.equal(failed, 1);
  camera.rotation.set(8 * Math.PI + 0.5);
  reset();
  harness.flush();
  near(camera.zoom.value, 1);
  near(camera.rotation.value, 0);
  near(camera.x.value, 0);
  near(camera.y.value, 0);
  const cancelCount = harness.cancelled.length;
  callbacks.onTouchesDown(event(start), manager);
  assert.equal(harness.cancelled.length, cancelCount + 4, 'all reset animations interrupted');
  callbacks.onTouchesUp(event(start, start), manager);
  callbacks.onFinalize();
  assert.equal(ended, 1, 'manual gesture ends when the last fingers lift');
  assert.equal(camera.zoom.value, 1);
});

test('pan and rotation update only the annotation parent; labels subscribe to zoom/detail', () => {
  const harness = componentHarness();
  const camera = { width: 390, height: 650, fitScale: fitMap(390, 650, 201, 258).width / 201,
    zoom: harness.shared(1), rotation: harness.shared(0), x: harness.shared(0), y: harness.shared(0),
    detail: harness.shared(0) };
  const tree = harness.load('AnnotationLayer.tsx').default(camera);
  const group = tree.props.children.props.children;
  for (const element of group.props.children) element.type(element.props);
  harness.flush();
  const counts = harness.hooks.map((hook) => hook.runs);
  camera.x.set(25); camera.y.set(-40); camera.rotation.set(0.8);
  harness.flush();
  const changedHooks = harness.hooks.filter((hook, i) => hook.runs !== counts[i]);
  assert.equal(changedHooks.length, 1, 'no per-label worklets run during pan/rotation');
  assert.ok(changedHooks[0].dependencies.has(camera.rotation));
  assert.ok(changedHooks[0].dependencies.has(camera.x));
  const beforeZoom = harness.hooks.map((hook) => hook.runs);
  camera.zoom.set(1.5);
  harness.flush();
  const zoomHooks = harness.hooks.filter((hook, i) => hook.runs !== beforeZoom[i]);
  const visibleCount = layoutAnnotations(map.annotations, map.walls, camera.fitScale)
    .filter((label) => label.placements[0].visible).length;
  assert.equal(zoomHooks.length, 40, 'one shared scale plus 39 label worklets');
  assert.equal(zoomHooks.filter((hook) => hook.value?.matrix).length, visibleCount,
    'only visible labels emit a transform; hidden labels return opacity alone');
  assert.ok(!zoomHooks.includes(changedHooks[0]), 'parent does not update for zoom');
  camera.detail.set(2);
  harness.flush();
  const beforeFullZoom = harness.hooks.map((hook) => hook.runs);
  camera.zoom.set(4);
  harness.flush();
  assert.equal(harness.hooks.filter((hook, i) => hook.runs !== beforeFullZoom[i]).length, 40,
    'Full updates one scale plus 39 labels, without recalculating layouts');
});
