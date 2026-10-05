# Interactive labeled sample map

The only map input is `2026-10-04_floor2-labeled.svg`. Metro's small transformer
extracts its existing paths at bundle time; there are no generated map files,
network asset fetches, per-frame XML parsing, or alternate zoom-level maps.

## Export-specific geometry

The SVG has a gray base, 176 individual label glyph paths, and one huge
masked stroke path. Its first 377 closed subpaths contain the original
building, hallways and partitions; the next four contain the border. The
exported outside-background mask clips the walls away, and thousands of tiny
remaining outline fragments are mostly clipped too. The adapter renders the
same walls and border directly, omitting the costly masked glyph outlines
(which can contribute subpixel edge differences).
Glyph paths are joined per source label without changing their coordinates.
The SVG itself is untouched. The adapter fails if the expected export order
changes, and its cache key includes all build-time geometry/annotation helpers.

## Source-anchored annotations

`sourceAnnotations.cjs` identifies each four-glyph room number and the three
existing area names. It computes **exact path bounds**, including cubic curve
extrema, and uses each label's bounding-box center as its map-coordinate anchor.
For example, 1202 is anchored at `(58.4182, 223.729)` and 1208 at
`(141.0355, 223.918)` in the original `201 × 258` viewBox. There are no guessed
range-label coordinates. Original glyph contours and their rotated/multiline
orientations are retained.

The floor SVG scales and pans normally. `AnnotationLayer.tsx` projects these
anchors using the **same fitted camera, zoom and pan**, but scales glyphs
separately. Room glyph heights are 10–12 logical screen pixels, independent of
pinch zoom. Area-name glyphs stay within 10–14 pixels per line, including the
existing multiline names. At 8×, labels remain relatively small
inside enlarged rooms instead of becoming 8× larger.

`annotationLayout.ts` computes three stable layouts only when the viewport
changes. Source wall spans constrain local offsets to the room's surrounding
walls. Small offsets (at most six pixels per axis **relative to the anchor**)
avoid walls/doors and label collisions. A label which cannot fit at its minimum
readable size is omitted at that level. It is never moved to another wing or
assigned a fixed screen position. Glyph rectangles include collision padding,
and a thin screen-sized halo helps separate text from the background.

## Discrete detail policy

Zoom is relative to the initial aspect-ratio-preserving viewport fit:

| Zoom | Visible detail |
| --- | --- |
| Overview | Initial level; important building/hallway geometry and a sparse set of actual room IDs, STEAM Lab and Small Quad |
| Medium | Enter at 2×; add room dividers and more individual numbers as space permits |
| Full | Enter at 3.4×; reveal every original wall subpath, all 36 room IDs and all three area names |

Full exits below 3.1×; Medium exits below 1.75×. This hysteresis prevents rapid
switching around a threshold. Visibility, placement and glyph size stay
unchanged throughout each level. Only camera positions change while pinching.
At a crossing, a 140 ms opacity fade settles to the new discrete state; fades
are time-based, never proportional to every small zoom change. Layouts are
checked at the lower hysteresis limits so zooming out within a level is safe.

The annotation overlay updates its small affine transforms on the UI thread;
pan uses one parent SVG group so previously offscreen labels can pan into view
without premature viewport clipping. The floor's LOD opacity changes only on
level transitions, avoiding expensive per-frame floor-SVG invalidation. No
React state updates or XML parsing occur during gestures. No libraries were
added for this refinement.

The SVG is transformed at bundle time. The transformer's cache key includes
its adapter source, so changes in how the SVG is prepared no longer leave
stale exports such as a missing `labels.areas`. After updating a running Expo
session from an older version, restart it once with `npx expo start --clear`.

## Interaction and checks

One finger pans; two fingers zoom and pan about their moving focal point.
Zoom is limited to 1–8×, and translation is constrained to map edges. When a
scaled axis is smaller than the viewport, it stays centered. At these bounds,
keeping the map reachable takes precedence over focal anchoring. Reset view
animates back to the overview. Viewport resizing refits the map.

Run `node --test tests/map.test.cjs` (Node 22.18+ for TypeScript stripping),
`npx expo lint`, and `npx tsc --noEmit`.
Platform bundling can be checked with `npx expo export --platform ios` and
`npx expo export --platform android`.
On iOS and Android devices, check off-center pinch, two-finger translation,
one/two/three-finger transitions, pan limits, reset during a zoom, and discrete
levels in both directions. Verify that labels coming from outside the viewport
appear while panning. Automated tests cover original glyph/wall preservation,
the requested room anchors, stable bounded sizing, collisions, camera movement
and hysteresis. Device smoothness still needs physical testing.
