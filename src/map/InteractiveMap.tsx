import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import LabeledMap, { MAP_SIZE } from './LabeledMap';
import AnnotationLayer from './AnnotationLayer';
import { nextDetailLevel, type DetailLevel } from './detailPolicy';
import { fitMap, moveCamera, normalizeAngle, touchFrame, MIN_ZOOM, type TouchFrame } from './mapMath';

function MapViewport({ width, height }: { width: number; height: number }) {
  const fitted = fitMap(width, height, MAP_SIZE.width, MAP_SIZE.height);
  const zoom = useSharedValue(MIN_ZOOM);
  const rotation = useSharedValue(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const detail = useSharedValue<DetailLevel>(0);
  useAnimatedReaction(() => zoom.value, (currentZoom) => {
    const next = nextDetailLevel(currentZoom, detail.value);
    if (next !== detail.value) detail.value = next;
  });
  const previous = useSharedValue<TouchFrame | null>(null);

  // A single UI-thread pointer stream prevents independent pinch/rotation/pan
  // handlers from overwriting each other's focal translation. The attached
  // surface never transforms, so touch coordinates remain viewport-relative.
  const gesture = useMemo(() => Gesture.Manual()
    .shouldCancelWhenOutside(false)
    .onTouchesDown((event, manager) => {
      cancelAnimation(zoom);
      cancelAnimation(rotation);
      cancelAnimation(x);
      cancelAnimation(y);
      previous.set(touchFrame(event.allTouches, width, height));
      manager.activate();
    })
    .onTouchesMove((event) => {
      const current = touchFrame(event.allTouches, width, height);
      if (!current) return;
      // Reset can be pressed while another finger is still on the map.
      if (!previous.value) {
        cancelAnimation(zoom);
        cancelAnimation(rotation);
        cancelAnimation(x);
        cancelAnimation(y);
      }
      const next = moveCamera(
        { zoom: zoom.value, rotation: rotation.value, x: x.value, y: y.value },
        previous.value, current, fitted.width, fitted.height, width, height,
      );
      zoom.set(next.zoom);
      rotation.set(next.rotation);
      x.set(next.x);
      y.set(next.y);
      previous.set(current);
    })
    .onTouchesUp((event, manager) => {
      previous.set(touchFrame(event.allTouches, width, height, event.changedTouches));
      if (!previous.value) manager.end();
    })
    .onTouchesCancelled((_event, manager) => {
      previous.set(null);
      manager.fail();
    })
    .onFinalize(() => { previous.set(null); }),
  [width, height, fitted.width, fitted.height, previous, zoom, rotation, x, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value },
      { rotate: `${rotation.value}rad` }, { scale: zoom.value }],
  }));

  const reset = () => {
    scheduleOnUI(() => {
      'worklet';
      previous.set(null);
      // Equivalent orientation, shortest reset path even after several turns.
      rotation.set(normalizeAngle(rotation.value));
      rotation.set(withTiming(0, { duration: 250 }));
      zoom.set(withTiming(MIN_ZOOM, { duration: 250 }));
      x.set(withTiming(0, { duration: 250 }));
      y.set(withTiming(0, { duration: 250 }));
    });
  };

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={gesture} touchAction="none">
        <View style={styles.gestureSurface} collapsable={false}
          accessible accessibilityLabel="Interactive floor 2 map"
          accessibilityHint="Use two fingers to zoom, rotate, and move the map, or drag with one finger to pan. Labels rotate with the floor; more detail appears at zoom thresholds.">
          <Animated.View pointerEvents="none" style={[
            { width: fitted.width, height: fitted.height }, animatedStyle,
          ]}>
            <LabeledMap width={fitted.width} height={fitted.height} detail={detail} />
          </Animated.View>
          <AnnotationLayer width={width} height={height} fitScale={fitted.width / MAP_SIZE.width}
            zoom={zoom} rotation={rotation} x={x} y={y} detail={detail} />
        </View>
      </GestureDetector>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset map to overview"
        onPress={reset} style={({ pressed }) => [styles.reset, pressed && styles.pressed]}>
        <Text style={styles.resetText}>Reset view</Text>
      </Pressable>
    </View>
  );
}

export default function InteractiveMap() {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    setViewport((previous) => previous.width === layout.width && previous.height === layout.height
      ? previous : { width: layout.width, height: layout.height });
  };
  return (
    <View style={styles.viewport} onLayout={onLayout}>
      {viewport.width > 0 && viewport.height > 0 && (
        // Fit and center again when the viewport changes (e.g. tablet resize).
        <MapViewport key={`${viewport.width}:${viewport.height}`} {...viewport} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#f1f3f5' },
  gestureSurface: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reset: {
    position: 'absolute', right: 16, bottom: 16, minHeight: 44,
    justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d8dee6',
  },
  pressed: { opacity: 0.65 },
  resetText: { color: '#24364b', fontWeight: '600' },
});
