import { LAYOUT_MIN_ZOOM, type DetailLevel } from './detailPolicy.ts';

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type WallSegment = { x1: number; y1: number; x2: number; y2: number };
export type MapAnnotation = {
  id: string;
  kind: 'room' | 'area';
  d: string;
  anchor: { x: number; y: number };
  bounds: Bounds;
  glyphHeight: number;
  roomBounds: Bounds;
  priority: number;
  minLevel: DetailLevel;
};
export type Placement = {
  visible: boolean;
  offsetX: number;
  offsetY: number;
  scale: number;
  width: number;
  height: number;
};
export type PlacedAnnotation = MapAnnotation & { placements: [Placement, Placement, Placement] };

// Local screen-pixel adjustments around the source anchor, never viewport-fixed
// positions. Keep displacement small and constrain it to the original walls.
export const MAX_LABEL_OFFSET = 6;
export const ROOM_SCREEN_SIZES = [10, 11, 12] as const;
const GAP = 2;
const WALL_MARGIN = 1.5;
const OFFSETS = [[0, 0], [0, -4], [0, 4], [-4, 0], [4, 0],
  [-6, -4], [6, -4], [-6, 4], [6, 4]];

export function boxesOverlap(a: Bounds, b: Bounds) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

export function annotationBox(annotation: MapAnnotation, placement: Placement, mapScale: number): Bounds {
  const x = annotation.anchor.x * mapScale + placement.offsetX;
  const y = annotation.anchor.y * mapScale + placement.offsetY;
  return { minX: x - placement.width / 2, maxX: x + placement.width / 2,
    minY: y - placement.height / 2, maxY: y + placement.height / 2 };
}

function padded(box: Bounds, padding: number): Bounds {
  return { minX: box.minX - padding, minY: box.minY - padding,
    maxX: box.maxX + padding, maxY: box.maxY + padding };
}

function crossesWall(box: Bounds, walls: WallSegment[], mapScale: number) {
  return walls.some(({ x1, y1, x2, y2 }) => boxesOverlap(box, {
    minX: Math.min(x1, x2) * mapScale - 0.2,
    maxX: Math.max(x1, x2) * mapScale + 0.2,
    minY: Math.min(y1, y2) * mapScale - 0.2,
    maxY: Math.max(y1, y2) * mapScale + 0.2,
  }));
}

// Compute three stable placements once per viewport. Conservative reference
// zooms cover the hysteresis bands, so labels don't start colliding on zoom-out.
// Priority + bounded offsets resolve clutter; do not run this during a pinch.
export function layoutAnnotations(annotations: MapAnnotation[], walls: WallSegment[], fitScale: number): PlacedAnnotation[] {
  const result: PlacedAnnotation[] = annotations.map((annotation) => ({
    ...annotation,
    placements: [0, 1, 2].map((level) => {
      const width = annotation.bounds.maxX - annotation.bounds.minX;
      const height = annotation.bounds.maxY - annotation.bounds.minY;
      // Preserve the source's rotated/narrow-room labels and multi-line names.
      const glyphHeight = annotation.glyphHeight;
      const desiredSize = annotation.kind === 'room' ? ROOM_SCREEN_SIZES[level]
        : annotation.id === 'STEAM Lab' ? 14 : annotation.id === 'Small Quad' ? 12 : 10;
      const minimumSize = 10;
      const refScale = fitScale * LAYOUT_MIN_ZOOM[level];
      const room = annotation.roomBounds;
      const fit = Math.min(
        ((room.maxX - room.minX) * refScale - WALL_MARGIN * 2) / width,
        ((room.maxY - room.minY) * refScale - WALL_MARGIN * 2) / height,
      );
      const scale = Math.min(desiredSize / glyphHeight, fit);
      return { visible: annotation.minLevel <= level && scale * glyphHeight >= minimumSize - 1e-6,
        offsetX: 0, offsetY: 0, scale: Math.max(0.01, scale), width: width * scale, height: height * scale };
    }) as [Placement, Placement, Placement],
  }));
  const sorted = [...result].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const level of [0, 1, 2] as const) {
    const occupied: Bounds[] = [];
    const refScale = fitScale * LAYOUT_MIN_ZOOM[level];
    for (const label of sorted) {
      const placement = label.placements[level];
      if (!placement.visible) continue;
      const room = label.roomBounds;
      const anchorX = label.anchor.x * refScale;
      const anchorY = label.anchor.y * refScale;
      const minX = room.minX * refScale + WALL_MARGIN + placement.width / 2;
      const maxX = room.maxX * refScale - WALL_MARGIN - placement.width / 2;
      const minY = room.minY * refScale + WALL_MARGIN + placement.height / 2;
      const maxY = room.maxY * refScale - WALL_MARGIN - placement.height / 2;
      let found = false;
      for (const [dx, dy] of OFFSETS) {
        const offsetX = Math.max(minX, Math.min(maxX, anchorX + dx)) - anchorX;
        const offsetY = Math.max(minY, Math.min(maxY, anchorY + dy)) - anchorY;
        if (Math.abs(offsetX) > MAX_LABEL_OFFSET || Math.abs(offsetY) > MAX_LABEL_OFFSET) continue;
        const candidate = { ...placement, offsetX, offsetY };
        const box = annotationBox(label, candidate, refScale);
        if (crossesWall(padded(box, 0.75), walls, refScale)
          || occupied.some((other) => boxesOverlap(padded(box, GAP), other))) continue;
        placement.offsetX = offsetX;
        placement.offsetY = offsetY;
        occupied.push(padded(box, GAP));
        found = true;
        break;
      }
      placement.visible = found;
    }
  }
  return result;
}

// Common camera projection for annotation anchors; labels themselves use a
// fixed screen-space scale, independent of geometry zoom. Pan is supplied by
// the annotation container's translation, using the same x/y as the floor.
export function projectAnchor(anchor: MapAnnotation['anchor'], fitScale: number, zoom: number,
  width: number, height: number, mapWidth: number, mapHeight: number) {
  'worklet';
  return { x: width / 2 + (anchor.x - mapWidth / 2) * fitScale * zoom,
    y: height / 2 + (anchor.y - mapHeight / 2) * fitScale * zoom };
}

export function annotationMatrix(anchor: MapAnnotation['anchor'], placement: Placement,
  projected: { x: number; y: number }): [number, number, number, number, number, number] {
  'worklet';
  const scale = placement.scale;
  return [scale, 0, 0, scale,
    projected.x + placement.offsetX - anchor.x * scale,
    projected.y + placement.offsetY - anchor.y * scale];
}
