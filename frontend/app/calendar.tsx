import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar } from '../src/ui/components';
import { HOLIDAYS, MONTH_NAMES, SEASON_GENRE_BONUS, SEASON_OF_WEEK, monthOf } from '../src/game/data';

const SEASON_COLOR: Record<string, string> = { Winter: '#3DB5E0', Spring: '#2ECC71', Summer: '#E67E22', Fall: '#9B59B6' };

export default function Calendar() {
  const router = useRouter();
  const { state } = useGame();
  if (!state) return null;
  const cur = monthOf(state.week);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title={`Calendar · Y${state.year}`} onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        <Text style={s.now}>NOW: {cur.name} W{cur.weekInMonth}, Year {state.year} · {SEASON_OF_WEEK(state.week)}</Text>

        {(['Winter', 'Spring', 'Summer', 'Fall'] as const).map(season => (
          <View key={season} style={[s.seasonCard, { borderColor: SEASON_COLOR[season] }]}>
            <View style={s.seasonHeader}>
              <Text style={[s.seasonName, { color: SEASON_COLOR[season] }]}>{season}</Text>
              <Text style={s.seasonBonus}>Genre boost: {SEASON_GENRE_BONUS[season].join(' · ')}</Text>
            </View>
            <View style={s.weekGrid}>
              {[...Array(48).keys()].map(idx => {
                const wk = idx + 1;
                if (SEASON_OF_WEEK(wk) !== season) return null;
                const m = monthOf(wk);
                const h = HOLIDAYS.find(hh => hh.week === wk);
                const isCurrent = wk === state.week;
                return (
                  <View key={wk} style={[s.weekCell, isCurrent && { borderColor: T.cyan, borderWidth: 3 }, h && { backgroundColor: T.cardDark }]} testID={`cal-w${wk}`}>
                    <Text style={s.weekTxt}>{m.name} W{m.weekInMonth}</Text>
                    {h ? (
                      <>
                        <Text style={s.holidayName}>{h.name}</Text>
                        <Text style={s.holidayMult}>+{Math.round((h.mult - 1) * 100)}%</Text>
                      </>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  now: { color: T.cardDark, fontWeight: '900', fontSize: 16, textAlign: 'center', marginBottom: 12, letterSpacing: 1 },
  seasonCard: { borderWidth: 3, borderRadius: 12, marginBottom: 14, padding: 10, backgroundColor: 'rgba(0,0,0,0.05)' },
  seasonHeader: { marginBottom: 8 },
  seasonName: { fontWeight: '900', fontSize: 22, letterSpacing: 1 },
  seasonBonus: { color: T.cardDark, fontSize: 12, fontWeight: '700' },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  weekCell: { width: '23%', backgroundColor: T.card, borderRadius: 6, padding: 4, borderWidth: 1, borderColor: T.border, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  weekTxt: { color: T.text, fontSize: 10, fontWeight: '700' },
  holidayName: { color: T.yellow, fontSize: 10, fontWeight: '900', textAlign: 'center', marginTop: 2 },
  holidayMult: { color: T.green, fontSize: 10, fontWeight: '900' },
});
