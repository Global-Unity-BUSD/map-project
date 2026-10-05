export type DetailLevel = 0 | 1 | 2;
export const DETAIL_NAMES = ['Overview', 'Medium', 'Full'] as const;
export const DETAIL_FADE_MS = 140;

// Relative to viewport fit. A lower exit boundary prevents boundary jitter.
export const DETAIL_THRESHOLDS = {
  mediumEnter: 2,
  mediumExit: 1.75,
  fullEnter: 3.4,
  fullExit: 3.1,
};
export const LAYOUT_MIN_ZOOM = [1, DETAIL_THRESHOLDS.mediumExit, DETAIL_THRESHOLDS.fullExit] as const;

export function nextDetailLevel(zoom: number, current: DetailLevel): DetailLevel {
  'worklet';
  if (zoom >= DETAIL_THRESHOLDS.fullEnter) return 2;
  if (current === 2 && zoom >= DETAIL_THRESHOLDS.fullExit) return 2;
  if (zoom >= DETAIL_THRESHOLDS.mediumEnter) return 1;
  if (current >= 1 && zoom >= DETAIL_THRESHOLDS.mediumExit) return 1;
  return 0;
}
