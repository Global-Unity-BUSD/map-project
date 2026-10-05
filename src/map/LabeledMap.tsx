import { memo } from 'react';
import Svg, { G, Path, type PathProps } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedReaction, useSharedValue, withTiming,
  type SharedValue } from 'react-native-reanimated';

import map from '../../2026-10-04_floor2-labeled.svg';
import { DETAIL_FADE_MS, type DetailLevel } from './detailPolicy';

const AnimatedGroup = Animated.createAnimatedComponent(G);
function DetailWalls({ minimum, path, detail }: {
  minimum: DetailLevel;
  path: PathProps;
  detail: SharedValue<DetailLevel>;
}) {
  const opacity = useSharedValue(0);
  useAnimatedReaction(() => detail.value, (level, previous) => {
    if (level !== previous) opacity.value = withTiming(level >= minimum ? 1 : 0,
      { duration: DETAIL_FADE_MS });
  });
  const animatedProps = useAnimatedProps(() => ({ opacity: opacity.value }));
  return (
    <AnimatedGroup opacity={0} animatedProps={animatedProps}>
      <Path {...path} fill="#788791" stroke="#788791" strokeWidth={0.12} />
    </AnimatedGroup>
  );
}

export const MAP_SIZE = { width: map.width, height: map.height };

export default memo(function LabeledMap({ width, height, detail }: {
  width: number;
  height: number;
  detail: SharedValue<DetailLevel>;
}) {
  return (
    <Svg width={width} height={height} viewBox={map.viewBox} fill={map.fill}>
      <Path {...map.base} fill="#f8fafc" />
      <Path {...map.structure.major} fill="#788791" stroke="#788791" strokeWidth={0.12} />
      <DetailWalls minimum={1} path={map.structure.partitions} detail={detail} />
      <DetailWalls minimum={2} path={map.structure.fine} detail={detail} />
      <Path {...map.border} fill="#788791" />
    </Svg>
  );
});
