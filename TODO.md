# Current TODO

## Current Task

Diagnose and fix persistent Android map slowdown and unexpected white shapes
over floor lines. The user reports that panning, pinch zoom, rotation, and detail
changes still slow down in Expo Go after the rotation/performance work.

**Read [MAP_RENDERING_ISSUE.md](./MAP_RENDERING_ISSUE.md) first** for the detailed
reproduction, layer-isolation, device-profiling, and verification plan. The cause
is unconfirmed; the issue remains open despite passing automated checks.

### Open Issue — Persistent Slowdown and White Artifacts

* [ ] Collect phone model/Android version, a marked screenshot of the white
  shapes, and a short reproduction video; see `MAP_RENDERING_ISSUE.md`, Step 1.
* [ ] Establish repeatable Android gesture/frame-time baselines, with three
  measured runs per case and no screen recording during timing captures.
* [ ] Add temporary layer/halo/LOD diagnostic switches and compare variants
  before choosing a fix; opacity-zero alone does not remove update work.
* [ ] Capture native Android traces and compare Expo Go with an installed
  optimized/release build on the same device.
* [ ] Implement the evidence-backed fix and repeat the same device measurements.
* [ ] Confirm the white artifacts are explained/addressed, then verify gestures,
  label alignment, clipping, detail levels, and iOS regression behavior.
* [ ] Record findings in `MAP_RENDERING_ISSUE.md` and remove temporary controls.

### Two-Finger Rotation and Gesture Performance

* [ ] Establish an Android performance baseline for pan, pinch, and LOD
  transitions; record device, build mode, frame times, and dropped frames.
* [ ] Compare development and optimized/release builds; identify gesture,
  annotation, SVG-rendering, or transition bottlenecks.
* [x] Add continuous two-finger rotation alongside simultaneous pinch and
  two-finger translation using the existing gesture/Reanimated stack.
* [x] Coordinate gesture baselines and preserve the map point under the
  moving focal point without duplicate translation or camera jumps.
* [x] Handle one/two/three-finger transitions and gesture cancellation.
* [x] Rotate annotations with the floor while preserving source anchors
  and bounded screen sizes; prefer a shared parent rotation transform.
* [x] Update pan limits for rotated map extents and preserve correct clipping.
* [x] Make Reset view restore centered translation, 1× zoom, and 0° rotation;
  allow gestures to interrupt the reset animation.
* [x] Review and optimize shared camera calculations, per-frame SVG updates,
  allocations, and unnecessary annotation work in multiple passes.
* [x] Preserve viewport-memoized layouts, Overview/Medium/Full levels,
  hysteresis, and transition-only detail fades.
* [x] Update the interaction hint and accessibility description for rotation.
* [x] Extend automated checks for combined focal anchoring, rotated bounds,
  annotation transforms/sizing, and unchanged detail thresholds.
* [x] Run `node --test tests/map.test.cjs`, `npx expo lint`,
  and `npx tsc --noEmit`.
* [ ] Compare before/after performance on Android and verify combined
  gestures, reset, clipping, alignment, and readability on iOS.

### Remaining Map Work

* [ ] Resolve the confirmed persistent Android stutter and reported white artifacts
  using [MAP_RENDERING_ISSUE.md](./MAP_RENDERING_ISSUE.md). Native SVG drawing,
  label halos/updates, fades, and build-mode overhead are hypotheses to test.
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
* [x] Add continuous two-finger rotation, combined with pinch and translation
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

### Rotation / Performance Notes (2026-10-07)

* A memoized `Gesture.Manual()` consumes one UI-thread touch stream. Pointer IDs
  stabilize pair ordering. One finger pans; two simultaneously translate, pinch,
  and rotate; three or more pause movement. Adding/removing fingers rebases the
  camera without jumps. Departing touch IDs are excluded from UP payloads on both
  platforms. Tiny finger separations rebase instead of producing invalid scales.
* Labels rotate with the floor and keep their original bounded screen sizes.
  Rotation/pan update one annotation parent, not 39 individual glyph transforms.
  Zoom uses one shared derived map scale and direct label matrices without an
  intermediate point allocation. Hidden labels emit no transform. Layouts and
  floor geometry are not rebuilt during gestures; LOD thresholds are unchanged.
* Pan bounds use rotated map extents (empty corners are possible). Reset returns
  to 1× / 0° / centered translation over 250 ms using the shortest rotation path.
  All four reset animations can be interrupted by touch input.
* Review passes covered camera math, real compiled gesture callbacks and worklet
  dependencies, and production bundling. The 17 tests include 2,500 combined
  rotation/zoom updates, full-turn continuity, finger transitions, reset/cancel,
  rotated bounds, glyph alignment/sizing, and parent-only pan/rotation updates.
  The hook harness captures static worklet-closure dependencies like Reanimated;
  its animation timing is simulated and it does not measure native FPS.
* All 17 tests, Expo lint, TypeScript, targeted full-file ESLint, and Git whitespace
  checks passed. iOS and Android production Hermes exports passed. No SVG files or dependencies
  changed. There is no attached device/Android tooling in this environment, so
  native frame-time baselines, before/after measurements, and physical-device
  smoothness remain open. Implementation checks do not establish stutter removal.
* Device profiling protocol: record model/OS, app revision, build mode and refresh
  rate; compare the same 10-second pan, off-center pinch/twist, combined movement,
  and LOD-crossing sequences at 1×/2×/4×/8×. Capture UI/JS frame times and dropped
  frames in development and release builds. Repeat on Android, then check iOS.
  See `src/map/README.md` for gesture edge cases.

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
