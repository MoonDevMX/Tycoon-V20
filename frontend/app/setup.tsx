import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar } from '../src/ui/components';
import { STUDIO_LOGOS } from '../src/game/data';

const CASH_OPTIONS = [
  { label: '500 M', value: 0.5, tag: 'Indie' },
  { label: '1 B', value: 1, tag: 'Boutique' },
  { label: '2 B', value: 2, tag: 'Mid-Major' },
  { label: '5 B', value: 5, tag: 'Major Studio' },
  { label: '10 B', value: 10, tag: 'Conglomerate' },
];

export default function Setup() {
  const [name, setName] = useState('Luna Productions');
  const [logoIdx, setLogoIdx] = useState(0);
  const [cashIdx, setCashIdx] = useState(0);
  const router = useRouter();
  const { startNewGame, setState, state } = useGame();

  const start = async () => {
    await startNewGame(name.trim() || 'Luna Productions', logoIdx);
    // Override starting cash from current state
    setTimeout(() => {
      // Use a one-shot override via setState after newGame creates state
    }, 0);
    // Apply via direct setState below by reading newest state -- simpler: call startNewGame then post-mutate
    router.replace('/dashboard');
  };

  // Custom start that sets cash post-init
  const startWithCash = async () => {
    const fresh = (await import('../src/game/sim')).newGame(name.trim() || 'Luna Productions', logoIdx);
    fresh.player.cash = CASH_OPTIONS[cashIdx].value;
    fresh.newsLog.unshift({ week: 1, year: fresh.year, text: `${fresh.player.name} launches as a ${CASH_OPTIONS[cashIdx].tag} with ${CASH_OPTIONS[cashIdx].label} treasury.` });
    setState(fresh);
    router.replace('/dashboard');
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="New Studio" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={s.label}>Studio Name</Text>
          <TextInput
            value={name} onChangeText={setName}
            style={s.input} placeholder="Studio Name" placeholderTextColor={T.textMute}
            maxLength={28} testID="studio-name-input"
          />

          <Text style={s.label}>Studio Logo</Text>
          <View style={s.logoGrid}>
            {STUDIO_LOGOS.map((l, i) => (
              <TouchableOpacity
                key={`${l.icon}-${l.bg}`} onPress={() => setLogoIdx(i)}
                style={[s.logoTile, { backgroundColor: l.bg }, logoIdx === i && { borderColor: T.cyan, borderWidth: 4 }]}
                testID={`logo-${i}`}
              >
                <MaterialCommunityIcons name={l.icon as any} size={48} color="#fff" />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Starting Treasury</Text>
          <View style={s.cashGrid}>
            {CASH_OPTIONS.map((c, i) => (
              <TouchableOpacity
                key={c.label} onPress={() => setCashIdx(i)}
                style={[s.cashTile, cashIdx === i && { borderColor: T.green, backgroundColor: T.green }]}
                testID={`cash-${i}`}
              >
                <Text style={[s.cashValue, cashIdx === i && { color: T.cardDark }]}>{c.label}</Text>
                <Text style={[s.cashTag, cashIdx === i && { color: T.cardDark }]}>{c.tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={s.start} onPress={startWithCash} testID="start-game-btn">
            <Text style={s.startTxt}>START STUDIO</Text>
          </TouchableOpacity>
          <Text style={s.tip}>Higher treasuries let you outbid AI studios for A-list talent and bigger franchise plays.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  label: { color: T.cardDark, fontSize: 14, fontWeight: '800', marginTop: 16, marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: T.cardDark, color: T.text, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, borderWidth: 2, borderColor: T.border },
  logoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  logoTile: { width: 80, height: 80, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border },
  cashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cashTile: { backgroundColor: T.cardDark, borderRadius: 10, padding: 12, borderWidth: 3, borderColor: T.border, alignItems: 'center', minWidth: 90, flex: 1 },
  cashValue: { color: T.green, fontWeight: '900', fontSize: 18 },
  cashTag: { color: T.textDim, fontSize: 11, marginTop: 2 },
  start: { marginTop: 28, backgroundColor: T.green, paddingVertical: 18, borderRadius: 12, alignItems: 'center', borderWidth: 3, borderColor: T.border },
  startTxt: { color: T.cardDark, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  tip: { color: T.cardDark, fontSize: 12, marginTop: 16, textAlign: 'center', opacity: 0.7 },
});
