import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import InteractiveMap from './src/map/InteractiveMap';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Sample map · Floor 2</Text>
            <Text style={styles.hint}>Two fingers to zoom & rotate · Drag to pan</Text>
          </View>
          <InteractiveMap />
          <StatusBar style="dark" />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#24364b' },
  hint: { marginTop: 4, fontSize: 14, color: '#596779' },
});
