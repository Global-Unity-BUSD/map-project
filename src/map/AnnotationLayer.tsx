import { memo, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedReaction, useSharedValue, withTiming,
  type SharedValue } from 'react-native-reanimated';

import map from '../../2026-10-04_floor2-labeled.svg';
import { annotationMatrix, layoutAnnotations, projectAnchor, type PlacedAnnotation } from './annotationLayout';
import { DETAIL_FADE_MS, type DetailLevel } from './detailPolicy';

const AnimatedGroup = Animated.createAnimatedComponent(G<{ matrix?: number[] }>);
const MAP_WIDTH = map.width;
const MAP_HEIGHT = map.height;
const IS_WEB = Platform.OS === 'web';
function matrixProps(matrix: number[]): { matrix?: number[]; transform?: string } {
  'worklet';
  // Native SVG exposes its affine matrix directly; SVG DOM uses transform.
  return IS_WEB ? { transform: `matrix(${matrix.join(' ')})` } : { matrix };
}
type Camera = { width: number; height: number; fitScale: number;
  zoom: SharedValue<number>; detail: SharedValue<DetailLevel> };

const Annotation = memo(function Annotation({ label, width, height, fitScale, zoom, detail }: Camera & {
  label: PlacedAnnotation;
}) {
  const { anchor, placements, d, kind } = label;
  const opacity = useSharedValue(placements[0].visible ? 1 : 0);
  useAnimatedReaction(() => detail.value, (level, previous) => {
    if (level !== previous) opacity.value = withTiming(placements[level].visible ? 1 : 0,
      { duration: DETAIL_FADE_MS });
  });
  const animatedProps = useAnimatedProps<{ opacity: number; matrix?: number[]; transform?: string }>(() => {
    const placement = placements[detail.value];
    // Hidden labels retain their previous matrix. Avoid pushing unused native
    // transforms throughout an overview pinch; fading-out labels still track.
    if (!placement.visible && opacity.value === 0) return { opacity: 0 };
    const point = projectAnchor(anchor, fitScale, zoom.value, width, height, MAP_WIDTH, MAP_HEIGHT);
    return {
      opacity: opacity.value,
      // Native SVG matrix: keep source anchor attached to the camera, but
      // render glyph contours at a bounded screen-pixel size, not zoom × size.
      ...matrixProps(annotationMatrix(anchor, placement, point)),
    };
  });
  return (
    <AnimatedGroup opacity={placements[0].visible ? 1 : 0}
      transform={annotationMatrix(anchor, placements[0], projectAnchor(anchor, fitScale, 1,
        width, height, MAP_WIDTH, MAP_HEIGHT))}
      animatedProps={animatedProps}>
      <Path d={d} fill="#f8fafc" stroke="#f8fafc" strokeWidth={1.5}
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <Path d={d} fill={kind === 'area' ? '#234a62' : '#263b49'} />
    </AnimatedGroup>
  );
});

export default memo(function AnnotationLayer({ x, y, ...camera }: Camera & {
  x: SharedValue<number>; y: SharedValue<number>;
}) {
  const { fitScale, width, height } = camera;
  const labels = useMemo(() => layoutAnnotations(map.annotations, map.walls, fitScale), [fitScale]);
  // Pan a parent SVG group so clipping happens AFTER the camera translation.
  // A translated View/Svg viewport would prematurely clip offscreen anchors
  // and make them disappear when panned back into view.
  const panProps = useAnimatedProps(() => matrixProps([1, 0, 0, 1, x.value, y.value]));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <AnimatedGroup animatedProps={panProps}>
          {labels.map((label) => <Annotation key={label.id} label={label} {...camera} />)}
        </AnimatedGroup>
      </Svg>
    </View>
  );
});
