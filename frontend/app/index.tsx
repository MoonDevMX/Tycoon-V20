import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';

export default function Index() {
  const router = useRouter();
  const { state, loading, resetGame } = useGame();

  useEffect(() => { /* no-op */ }, []);

  if (loading) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={T.cyan} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.heroBox}>
        <MaterialCommunityIcons name="movie-roll" size={120} color={T.cyan} />
        <Text style={s.title} testID="app-title">MOON CINEMA</Text>
        <Text style={s.subtitle}>TYCOON</Text>
        <Text style={s.tagline}>Run a studio. Build franchises. Crossover the world.</Text>
      </View>

      <View style={s.menu}>
        {state?.initialized ? (
          <TouchableOpacity
            style={[s.btn, { backgroundColor: T.cyan }]}
            onPress={() => router.push('/dashboard')}
            testID="continue-btn"
          >
            <Text style={s.btnText}>Continue — {state.player.name}</Text>
            <Text style={s.btnSub}>Week {state.week}, Year {state.year}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[s.btn, { backgroundColor: T.green }]}
          onPress={() => router.push('/setup')}
          testID="new-game-btn"
        >
          <Text style={[s.btnText, { color: T.cardDark }]}>New Studio</Text>
        </TouchableOpacity>

        {state?.initialized ? (
          <TouchableOpacity style={s.dangerBtn} onPress={resetGame} testID="reset-btn">
            <Text style={s.dangerText}>Reset Save</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  heroBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { color: T.cardDark, fontSize: 44, fontWeight: '900', letterSpacing: 4, marginTop: 18 },
  subtitle: { color: T.cardDark, fontSize: 26, fontWeight: '900', letterSpacing: 8, marginTop: -6 },
  tagline: { color: T.cardDark, fontSize: 14, marginTop: 14, textAlign: 'center', opacity: 0.8 },
  menu: { padding: 20, gap: 12 },
  btn: { paddingVertical: 18, borderRadius: 12, alignItems: 'center', borderWidth: 3, borderColor: T.border },
  btnText: { color: T.cardDark, fontSize: 18, fontWeight: '900' },
  btnSub: { color: T.cardDark, fontSize: 12, marginTop: 4, opacity: 0.7 },
  dangerBtn: { paddingVertical: 12, alignItems: 'center' },
  dangerText: { color: T.cardDark, fontSize: 13, opacity: 0.6 },
});
