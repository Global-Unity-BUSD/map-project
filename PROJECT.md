# School Indoor Navigation App

## Purpose

A cross-platform Expo/React Native mobile application for developing an indoor navigation system for a school.

The long-term goal is to provide accurate indoor maps, positioning, navigation, and eventually AR navigation.

## Current Stage

The project is currently focused on the **2D map system**.

The immediate goal is to build and refine a sample map using the existing detailed SVG.

The sample map is a prototype for the eventual real school map.

## Current Focus

The current map should:

* use the existing SVG
* support panning
* support pinch-to-zoom
* have sensible zoom limits
* dynamically change the amount of visible SVG detail based on zoom
* become more detailed when zooming in
* become more minimal when zooming out
* remain smooth and responsive on mobile

The detailed SVG is the highest-detail version of the map.

The map should use one underlying SVG and progressively show/hide its existing details rather than switching between separate maps.

## Project Direction

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

Only the current stage should be actively implemented.

## Future Systems

The eventual project may include:

* GPS/reference coordinates
* phone sensors
* indoor positioning
* BLE beacons
* sensor fusion
* map constraints
* navigation/routing
* machine learning where useful
* AR navigation

These are future project areas and should not be implemented during the current map stage unless specifically requested.

## Important Principle

The map system should be built so that the sample SVG can eventually be replaced or redesigned using the real school map without requiring the entire application to be rewritten.
