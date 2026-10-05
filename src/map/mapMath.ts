export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

export function fitMap(width: number, height: number, mapWidth: number, mapHeight: number) {
  const padding = Math.min(24, width / 10, height / 10);
  const scale = Math.min((width - padding * 2) / mapWidth, (height - padding * 2) / mapHeight);
  return { width: mapWidth * scale, height: mapHeight * scale };
}

export function boundPan(offset: number, mapSize: number, viewportSize: number, zoom: number) {
  'worklet';
  const limit = Math.max(0, (mapSize * zoom - viewportSize) / 2);
  return clamp(offset, -limit, limit);
}

// Coordinates are relative to the viewport's center. Keep the map point under
// the initial focal point under the moving focal point at the new zoom.
export function focalOffset(startOffset: number, startFocal: number, focal: number, ratio: number) {
  'worklet';
  return focal - (startFocal - startOffset) * ratio;
}
