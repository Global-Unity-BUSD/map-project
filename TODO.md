# Current TODO

## Current Task

Refine the interactive sample SVG map: prioritize movement performance,
zoomed-out organization, and remaining label alignment issues.

### Remaining Map Work

* [ ] Optimize panning/zooming performance: movement still stutters. Investigate
  dynamic zoom/detail processing as a possible contributor, not a confirmed cause.
* [ ] Profile unnecessary recalculations, rerenders, and native SVG updates during
  gestures. Layouts are already memoized per viewport; check the UI-thread
  annotation transforms, SVG drawing, and threshold-transition fades as well.
* [ ] Improve the zoomed-out layout and explore cleaner organization of visible
  rooms/labels, priorities, spacing, and omissions while retaining useful orientation.
* [ ] Fix remaining room-label positioning/alignment issues against the labeled
  SVG and actual room boundaries; verify anchors and local offsets on devices.
* [ ] Preserve discrete Overview/Medium/Full levels and hysteresis during these
  improvements. Keep detail stable inside each range rather than changing it
  continuously with every zoom update.
* [ ] Recheck movement, alignment, and readability at multiple zoom levels on
  iOS and Android; automated layout checks alone do not establish device quality.

### Map

* [x] Render the existing detailed SVG in the React Native app
* [x] Make the SVG fit correctly within the map viewport
* [x] Add pinch-to-zoom
* [x] Add panning
* [x] Add sensible minimum/maximum zoom
* [x] Keep zooming centered around the user's pinch gesture
* [ ] Confirm pinch smoothness on an iOS and Android device (user reported stutter)

### Dynamic Detail / LOD

* [x] Inspect the existing SVG structure
* [x] Identify groups/elements that should change with zoom
* [x] Define the detail levels from the provided map specification
* [x] Hide less-important details when zooming out
* [x] Reveal additional details when zooming in
* [x] Add smooth opacity transitions where appropriate
* [x] Verify the map becomes progressively more minimal when zoomed out
* [x] Verify the full detailed SVG appears when sufficiently zoomed in

### Verification

* [ ] Test on iOS
* [ ] Test on Android
* [x] Run Expo lint
* [x] Run TypeScript typecheck

### Map Refinement

* [x] Anchor each room/area annotation to exact labeled SVG glyph bounds
* [x] Keep room annotations at readable, bounded screen sizes while geometry zooms
* [x] Use source walls, bounded local offsets and priority-based collision handling
* [x] Replace approximate range labels with SVG-derived individual identifiers
* [x] Use Overview/Medium/Full detail thresholds with hysteresis and short transition fades
* [x] Keep important room identifiers at overview and reveal all labels at Full detail
* [x] Remove redundant masked glyph-outline rendering from the pinch path
* [x] Invalidate Metro cache when the labeled SVG adapter changes
* [ ] Confirm pinch responsiveness and overview readability on devices

### Implementation / Verification Notes (2026-10-05)

* Only `2026-10-04_floor2-labeled.svg` is imported. Its geometry is extracted
  at bundle time; the original SVG is unchanged. Its export mask hid the wall
  subpaths, so those existing subpaths are rendered outside that mask.
* Source-derived annotations replace approximate range labels. Exact glyph
  bounds anchor all 36 room IDs and three area names. Room label sizes remain
  10–12 logical screen pixels at every zoom; area-name glyphs are 10–14 pixels
  per line. At most six-pixel local offsets are constrained by SVG walls and
  collision checks.
* Stable levels: Overview initially; Medium enters at 2× and exits below 1.75×;
  Full enters at 3.4× and exits below 3.1×. A 140 ms fade happens only at a level
  transition. No continuous zoom-driven visibility changes remain. Full shows
  every original wall subpath and every source room/area label. Zoom is 1–8×.
* The clipped SVG outline/mask was responsible for thousands of extra glyph
  fragments and 177 mask paths. Only the original visible border is drawn;
  unchanged SVG glyph contours now form a separately projected annotation
  layer. UI-thread gestures and discrete transition fades are retained.
  Movement still stutters according to current user feedback; its cause is not
  established. Zoomed-out organization and room-label alignment still need work.
  Smoothness and readability require the iOS/Android device tests above.
* Passed for this refinement: `npx expo lint`, `npx tsc --noEmit`, full-file
  ESLint, `node --test tests/map.test.cjs` (9 tests), and iOS/Android production
  Hermes exports. No dependencies changed.
* Exports are not device tests. Automated tests cover source preservation,
  requested room anchors, bounded sizing/projection during pan/zoom, label/wall
  collisions on phone/tablet sizes, and threshold jitter. Rendered previews at
  Overview, Medium, Full and 8× check visual organization and small high-zoom labels.
* The `areas` runtime error was caused by a transformed SVG from an older
  adapter remaining in Metro's cache. The transformer now keys its cache on
  the adapter source. Restart an existing session with `npx expo start --clear`.
* See `src/map/README.md` for the source adapter, LOD policy and device checks.
* See `SUMMARY.md` for today's architecture, decisions, limitations, and next steps.

## Not Current

Do not work on these yet:

* GPS
* indoor positioning
* BLE
* Wi-Fi positioning
* sensors
* PDR
* sensor fusion
* ML
* navigation
* routing
* AR
* backend
* databases
* authentication
* analytics
* tracking
* beacon deployment
