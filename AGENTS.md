# AGENTS.md

## Project

This is an Expo/React Native mobile application for a school indoor-navigation project.

Prioritize:

* mobile-first design
* smooth performance
* cross-platform compatibility
* maintainable code
* simple architecture
* small, focused changes

The project is currently in the **2D map development stage**.

---

## Scope Discipline

The AI is an implementation agent, not the project owner.

Implement the requested task without expanding its scope.

Do not independently begin future project systems just because they are mentioned in project documentation.

Current development direction:

```text
Sample 2D Map
    ↓
Real School Map
    ↓
Indoor Positioning
    ↓
Navigation
    ↓
AR
```

Only the current stage/task should be implemented.

If a requested change would significantly alter the architecture, dependencies, project phase, or scope, stop and explain the change before implementing it.

---

## Current Map Architecture

The project already has a detailed SVG map.

The existing SVG is the source of truth for the map.

Do not:

* redraw the map
* replace the SVG with React Native shapes
* create unrelated replacement maps
* rasterize the SVG
* create separate SVG files for different zoom levels

The application should render and interact with the existing SVG.

The current map system should support:

* pan
* pinch-to-zoom
* sensible zoom limits
* smooth interaction
* dynamic SVG Level-of-Detail (LOD)

### SVG Level-of-Detail

The detailed SVG represents the highest-detail version of the map.

When zooming in:

* reveal more information
* reveal smaller details
* reveal labels/details specified by the current map specification

When zooming out:

* progressively hide less-important details
* simplify the map
* keep important structural information visible

Use the same underlying SVG rather than switching between separate maps.

When possible, use SVG groups/layers and opacity/visibility based on the current zoom level.

Do not invent map features or decide on visual details that have not been specified.

---

## Architecture

Keep these concerns reasonably separated:

```text
SVG Map
   ↓
Map Rendering
   ↓
Gesture / Zoom State
   ↓
LOD / Detail Visibility
```

Do not introduce unnecessary architecture.

Avoid adding:

* backend services
* databases
* state-management libraries
* APIs
* authentication
* unnecessary abstractions
* unnecessary dependencies

Prefer the simplest implementation that satisfies the current task.

---

## Dependencies

Before adding a dependency:

1. Check whether the project already has a suitable dependency.
2. Check the current Expo SDK compatibility.
3. Prefer Expo-recommended libraries.
4. Do not add a dependency merely for convenience if the existing stack can handle the task.

Never silently introduce a major library or architecture change.

---

## Expo / React Native

Follow the Expo rules already documented above.

Expo and React Native APIs must be checked against the project's installed Expo SDK rather than relying on model memory.

Before using an Expo/React Native API:

1. Read the major Expo version from `package.json`.
2. Use the matching Expo documentation.
3. Check `https://docs.expo.dev/llms.txt` when documentation or API behavior is uncertain.

Use the package manager already used by the project.

If `bun.lock` exists, use Bun-compatible commands.

When installing Expo-compatible packages, use:

```bash
npx expo install <package>
```

or the equivalent project package-manager command when appropriate.

Do not manually edit generated native `ios/` or `android/` directories when Continuous Native Generation is being used.

---

## Verification

Before declaring a task complete:

```bash
npx expo lint
npx tsc --noEmit
```

Run other relevant checks when appropriate.

Do not claim something works if it was not actually verified.

If a check cannot be run, explicitly state that.

---

## Existing Code

Before modifying code:

1. Inspect the existing project structure.
2. Inspect relevant existing components/files.
3. Reuse existing code where practical.
4. Avoid changing unrelated files.
5. Preserve working functionality.

Do not rewrite the application simply to implement a small feature.

---

## Communication

Before implementing a task, determine:

* what the current task is
* what files are relevant
* what the expected result is
* what is explicitly outside the task

If requirements are unclear or conflict with existing project decisions, stop and ask/report rather than silently guessing.

At completion, briefly report:

* what changed
* files changed
* tests/checks performed
* anything intentionally not changed
* any unresolved issue

## Core Rule

**Build exactly what is requested, build it cleanly, verify it, and stop.**
