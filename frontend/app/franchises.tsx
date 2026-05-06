import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, IconTile } from '../src/ui/components';

export default function Franchises() {
  const router = useRouter();
  const { state } = useGame();
  if (!state) return null;
  const own = state.franchises.filter(f => f.studioId === state.player.id);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="My Franchises" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      {own.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="star-off" size={64} color={T.textMute} />
          <Text style={s.emptyTxt}>No franchises yet. Release an Original to start one.</Text>
        </View>
      ) : (
        <FlatList
          data={own}
          keyExtractor={f => f.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const movies = state.movies.filter(m => m.franchiseId === item.id);
            const totalBO = movies.reduce((a, b) => a + b.boxOffice, 0);
            return (
              <TouchableOpacity style={s.row} onPress={() => router.push(`/franchise/${item.id}`)} testID={`franchise-${item.id}`}>
                <IconTile icon={item.iconKey} color={item.iconBg} size={64} />
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={s.title}>{item.name}</Text>
                  <Text style={s.sub}>{movies.length} films · pop {item.popularity}</Text>
                  <Text style={[s.sub, { color: T.green }]}>{totalBO.toFixed(2)} B career</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={28} color={T.textMute} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 2, borderColor: T.border },
  title: { color: T.text, fontSize: 17, fontWeight: '900' },
  sub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTxt: { color: T.cardDark, fontSize: 15, marginTop: 12, textAlign: 'center', fontWeight: '700' },
});
