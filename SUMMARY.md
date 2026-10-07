# Map Work Summary

## 2026-10-07 — Two-finger rotation and gesture-path optimization

* **Implemented:** Continuous two-finger rotation combined with pinch and focal
  translation; rotated pan bounds; labels rotating with the floor at bounded
  screen sizes; shortest-path reset to 1×/0°/center; updated interaction hints.
* **Gesture path:** One memoized UI-thread manual gesture coordinates the camera
  from stable pointer IDs. Finger changes rebase, three fingers pause, UP events
  exclude departed IDs, and near-coincident fingers cannot produce invalid zoom.
  Incremental camera updates preserve the focal anchor away from map bounds.
* **Performance review:** Pan/rotation share one annotation parent transform and
  do not trigger individual label worklets. Zoom uses a shared derived scale and
  direct matrices without intermediate point allocations. Stable viewport-only
  layouts, source geometry, and discrete LOD/hysteresis are retained.
* **Verification:** 17 tests pass, including a 2,500-update camera sequence,
  glyph projection/sizing under rotation, real compiled gesture callbacks, and
  static worklet-dependency checks. Expo lint, TypeScript, targeted full-file
  ESLint, whitespace checks, and iOS/Android production Hermes exports pass.
  Hook tests simulate timing and do not measure native render performance.
* **Open:** No device is attached here. Android baseline/release comparisons and
  before/after frame times, then iOS smoothness checks, remain in `TODO.md`.
  Reported stutter is not confirmed resolved. Overview organization and remaining
  label alignment work are still open. No dependencies or SVG sources changed.

## 2026-10-05 — Interactive sample map and annotation refinement

* **Implemented:** Expo rendering of the labeled floor-2 SVG, viewport fitting,
  focal pinch-to-zoom, bounded panning, 1–8× zoom, and animated reset. Added
  source-derived room annotations, collision-aware placement, bounded label
  sizes, discrete detail levels, and SVG-transform cache invalidation.
* **Organization:** The labeled SVG is the sole map source. Metro extracts its
  existing geometry and label metadata at bundle time. `LabeledMap` renders
  structural layers; `InteractiveMap` owns the shared gesture/camera state;
  `AnnotationLayer` projects 36 room IDs and three area names using that camera.
  Label layouts are precomputed per viewport. Anchors come from glyph bounds,
  with small wall-constrained offsets; screen-sized glyphs prevent oversized text.
* **Zoom/detail:** Overview retains major structure and selected identifiers.
  Medium enters at 2× and adds rooms/dividers; Full enters at 3.4× and reveals
  all available geometry and labels. Exit thresholds of 1.75× and 3.1× provide
  hysteresis. Detail stays stable within a level; a 140 ms fade accompanies
  transitions. Camera/annotation positions still update during movement.
* **Decisions:** Preserve original SVG coordinates and glyph contours rather
  than redraw the floor or use alternate maps. Separate annotations from floor
  scaling. Replace approximate range-label placements with source-anchored
  identifiers. Bypass the export mask that hid existing walls and omit its
  redundant masked glyph outlines. Keep the existing Expo-compatible stack
  and the project limited to the sample 2D map stage.
* **Current limitations:** Movement still stutters; zoom/detail logic is a
  possible contributor, not a proven cause. Room-label alignment and overview
  organization remain imperfect. Placement uses export-specific glyph indices
  and nearby wall spans, not semantic room polygons. Automated checks and
  production exports do not verify native gesture smoothness or device layout.
* **Next:** Profile gesture-time calculations/rerenders and native SVG updates,
  optimize movement, improve overview label selection/spacing, and correct
  remaining alignment issues. Preserve discrete detail levels and verify the
  results across zoom levels on iOS/Android. See `TODO.md` for open tasks.

Verification: Expo lint and TypeScript typecheck pass. Earlier map verification
also passed nine automated tests and iOS/Android production exports; device
acceptance remains open. This documentation/Git review changed no implementation.
