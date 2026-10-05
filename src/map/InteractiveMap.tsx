import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import LabeledMap, { MAP_SIZE } from './LabeledMap';
import AnnotationLayer from './AnnotationLayer';
import { nextDetailLevel, type DetailLevel } from './detailPolicy';
import { boundPan, clamp, fitMap, focalOffset, MAX_ZOOM, MIN_ZOOM } from './mapMath';

function MapViewport({ width, height }: { width: number; height: number }) {
  const fitted = fitMap(width, height, MAP_SIZE.width, MAP_SIZE.height);
  const zoom = useSharedValue(MIN_ZOOM);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const detail = useSharedValue<DetailLevel>(0);
  useAnimatedReaction(() => zoom.value, (currentZoom) => {
    const next = nextDetailLevel(currentZoom, detail.value);
    if (next !== detail.value) detail.value = next;
  });
  const pinchZoom = useSharedValue(1);
  const pinchScale = useSharedValue(1);
  const pinchPointers = useSharedValue(2);
  const pinchX = useSharedValue(0);
  const pinchY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const pinching = useSharedValue(false);
  const panReady = useSharedValue(false);
  const lastPanX = useSharedValue(0);
  const lastPanY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      cancelAnimation(zoom);
      cancelAnimation(x);
      cancelAnimation(y);
      pinching.value = true;
      panReady.value = false;
      pinchZoom.value = zoom.value;
      pinchScale.value = event.scale;
      pinchPointers.value = event.numberOfPointers;
      pinchX.value = x.value;
      pinchY.value = y.value;
      focalX.value = event.focalX - width / 2;
      focalY.value = event.focalY - height / 2;
    })
    .onUpdate((event) => {
      // Rebase if a finger is added/removed instead of using a stale focal
      // anchor (some Android devices keep the pinch active after finger lift).
      if (event.numberOfPointers !== 2 || pinchPointers.value !== 2) {
        pinchZoom.value = zoom.value;
        pinchScale.value = event.scale;
        pinchPointers.value = event.numberOfPointers;
        pinchX.value = x.value;
        pinchY.value = y.value;
        focalX.value = event.focalX - width / 2;
        focalY.value = event.focalY - height / 2;
        return;
      }
      const nextZoom = clamp(pinchZoom.value * event.scale / pinchScale.value, MIN_ZOOM, MAX_ZOOM);
      const ratio = nextZoom / pinchZoom.value;
      zoom.set(nextZoom);
      x.value = boundPan(
        focalOffset(pinchX.value, focalX.value, event.focalX - width / 2, ratio),
        fitted.width, width, nextZoom,
      );
      y.value = boundPan(
        focalOffset(pinchY.value, focalY.value, event.focalY - height / 2, ratio),
        fitted.height, height, nextZoom,
      );
    })
    .onFinalize(() => {
      pinching.value = false;
      panReady.value = false;
    });

  const pan = Gesture.Pan().minDistance(1).averageTouches(true)
    .onStart((event) => {
      cancelAnimation(zoom);
      cancelAnimation(x);
      cancelAnimation(y);
      lastPanX.value = event.translationX;
      lastPanY.value = event.translationY;
      panReady.value = event.numberOfPointers === 1 && !pinching.value;
    })
    .onUpdate((event) => {
      // Pinch handles both scale and two-finger translation. Never apply the
      // simultaneous pan twice. Rebase one-finger pan on pointer transitions.
      if (pinching.value || event.numberOfPointers !== 1) {
        panReady.value = false;
        return;
      }
      if (panReady.value) {
        x.value = boundPan(x.value + event.translationX - lastPanX.value,
          fitted.width, width, zoom.value);
        y.value = boundPan(y.value + event.translationY - lastPanY.value,
          fitted.height, height, zoom.value);
      }
      lastPanX.value = event.translationX;
      lastPanY.value = event.translationY;
      panReady.value = true;
    })
    .onFinalize(() => { panReady.value = false; });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: zoom.value }],
  }));

  const reset = () => {
    zoom.set(withTiming(MIN_ZOOM, { duration: 250 }));
    x.set(withTiming(0, { duration: 250 }));
    y.set(withTiming(0, { duration: 250 }));
  };

  return (
    <View style={styles.viewport}>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <View style={styles.gestureSurface} collapsable={false}
          accessible accessibilityLabel="Interactive floor 2 map"
          accessibilityHint="Pinch to zoom and drag to pan. Room labels stay readable; more detail appears at zoom thresholds.">
          <Animated.View pointerEvents="none" style={[
            { width: fitted.width, height: fitted.height }, animatedStyle,
          ]}>
            <LabeledMap width={fitted.width} height={fitted.height} detail={detail} />
          </Animated.View>
          <AnnotationLayer width={width} height={height} fitScale={fitted.width / MAP_SIZE.width}
            zoom={zoom} x={x} y={y} detail={detail} />
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
