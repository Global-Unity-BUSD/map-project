# Map Work Summary

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
