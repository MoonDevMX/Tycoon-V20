import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, SectionHeader } from '../src/ui/components';
import { COLOR_HEX, GENRES } from '../src/game/data';
import { Genre, ColorTrait } from '../src/game/types';
import { useMemo } from 'react';

const GENRE_COLOR: Record<string, string> = {
  Action: '#E74C3C', Comedy: '#F1C40F', Drama: '#3498DB', Romance: '#E91E63',
  Horror: '#7F1D1D', Thriller: '#9B59B6', SciFi: '#16A085', Fantasy: '#8E44AD',
  Animation: '#FF9800', Documentary: '#95A5A6', Musical: '#FF6F00', Mystery: '#34495E',
  Adventure: '#27AE60', Crime: '#2C3E50', Family: '#FFB300', Superhero: '#C0392B',
  Monster: '#5D4037', Sport: '#1ABC9C', War: '#7B6F47',
};

export default function Trends() {
  const router = useRouter();
  const { state } = useGame();
  if (!state) return null;

  // Aggregate genre BO across last 5 years
  const allYears = Object.keys(state.genreYearlyBO || {}).map(Number).sort();
  const last5 = allYears.slice(-5);

  // Top genres overall (sum across all tracked years)
  const totalsByGenre = useMemo(() => {
    const t: Record<string, number> = {};
    Object.values(state.genreYearlyBO || {}).forEach(yearMap => {
      Object.entries(yearMap || {}).forEach(([g, bo]) => { t[g] = (t[g] || 0) + (bo || 0); });
    });
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [state.genreYearlyBO]);
  const totalAll = totalsByGenre.reduce((a, b) => a + b[1], 0);
  const maxByYear: Record<number, number> = {};
  last5.forEach(y => { maxByYear[y] = Math.max(1, ...Object.values(state.genreYearlyBO?.[y] || {}).map(v => v || 0)); });

  // Current audience snapshot
  const currentAudience = state.audience;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Audience & Trends" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SectionHeader title="Genre Box Office — Last 5 Years" />
        {last5.length === 0 ? (
          <Text style={s.empty}>No release data yet — simulate at least one year.</Text>
        ) : (
          <View style={s.yearGrid}>
            {last5.map(yr => {
              const yearData = state.genreYearlyBO?.[yr] || {};
              const sorted = Object.entries(yearData).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 6);
              return (
                <View key={yr} style={s.yearCard}>
                  <Text style={s.yearLabel}>Year {yr}</Text>
                  {sorted.map(([g, bo]) => {
                    const pct = ((bo || 0) / maxByYear[yr]) * 100;
                    return (
                      <View key={g} style={s.barRow}>
                        <Text style={s.barLabel}>{g}</Text>
                        <View style={s.barTrack}>
                          <View style={[s.barFill, { width: `${pct}%`, backgroundColor: GENRE_COLOR[g] || T.cyan }]} />
                        </View>
                        <Text style={s.barValue}>${(bo || 0).toFixed(0)}M</Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        )}

        <SectionHeader title={`Lifetime Genre Totals · $${(totalAll / 1000).toFixed(1)}B`} />
        <View style={s.lifetimeBlock}>
          {totalsByGenre.slice(0, 10).map(([g, bo]) => {
            const pct = totalAll > 0 ? (bo / totalAll) * 100 : 0;
            return (
              <View key={g} style={s.barRow}>
                <Text style={s.barLabel}>{g}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${pct}%`, backgroundColor: GENRE_COLOR[g] || T.cyan }]} />
                </View>
                <Text style={s.barValue}>{pct.toFixed(1)}%</Text>
              </View>
            );
          })}
        </View>

        <SectionHeader title="Audience Demographics & Preferences" />
        <View style={s.audienceBlock}>
          {currentAudience.map((seg) => (
            <View key={seg.label} style={[s.segCard, { borderLeftColor: COLOR_HEX[seg.preferredColor] }]}>
              <View style={s.segHead}>
                <Text style={s.segName}>{seg.label}</Text>
                <Text style={s.segShare}>{(seg.share * 100).toFixed(0)}%</Text>
              </View>
              <View style={s.segGenres}>
                {seg.preferredGenres.map(g => (
                  <View key={g} style={[s.genreChip, { backgroundColor: (GENRE_COLOR[g] || T.cyan) + '33', borderColor: GENRE_COLOR[g] || T.cyan }]}>
                    <Text style={[s.genreChipT, { color: GENRE_COLOR[g] || T.cyan }]}>{g}</Text>
                  </View>
                ))}
              </View>
              <View style={s.segColorRow}>
                <View style={[s.colorDot, { backgroundColor: COLOR_HEX[seg.preferredColor] }]} />
                <Text style={s.segSub}>Resonates with {seg.preferredColor} talents</Text>
              </View>
            </View>
          ))}
        </View>

        {state.audienceYearlySnapshot && Object.keys(state.audienceYearlySnapshot).length > 0 && (
          <>
            <SectionHeader title="Preference Evolution" />
            <View style={s.evoBlock}>
              {Object.keys(state.audienceYearlySnapshot).map(Number).sort().slice(-3).map(yr => (
                <View key={yr} style={s.evoCard}>
                  <Text style={s.evoYear}>Year {yr} · Top genre per segment</Text>
                  {(state.audienceYearlySnapshot![yr] || []).slice(0, 6).map((seg) => (
                    <Text key={seg.label} style={s.evoLine}>
                      <Text style={{ color: T.text, fontWeight: '700' }}>{seg.label}</Text>
                      <Text style={{ color: T.textDim }}>: {seg.preferredGenres.slice(0, 2).join(' · ')}</Text>
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={s.note}>📊 Audience preferences shift based on the prior year's hits. Hit films pull audience tastes toward their genre.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  empty: { color: T.textDim, fontStyle: 'italic', textAlign: 'center', padding: 24 },
  yearGrid: { paddingHorizontal: 12, gap: 8 },
  yearCard: { backgroundColor: T.cardDark, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: T.border },
  yearLabel: { color: T.cyan, fontWeight: '900', fontSize: 13, marginBottom: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  barLabel: { color: T.text, fontSize: 11, fontWeight: '700', width: 80 },
  barTrack: { flex: 1, height: 12, backgroundColor: T.bg, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  barValue: { color: T.textDim, fontSize: 11, fontWeight: '700', minWidth: 56, textAlign: 'right' },
  lifetimeBlock: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: T.cardDark, marginHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: T.border },
  audienceBlock: { paddingHorizontal: 12, gap: 8 },
  segCard: { backgroundColor: T.cardDark, padding: 10, borderRadius: 8, borderLeftWidth: 4, borderWidth: 1, borderColor: T.border },
  segHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  segName: { color: T.text, fontWeight: '900', fontSize: 14 },
  segShare: { color: T.cyan, fontWeight: '900', fontSize: 13 },
  segGenres: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  genreChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  genreChipT: { fontSize: 10, fontWeight: '800' },
  segColorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  segSub: { color: T.textDim, fontSize: 10 },
  evoBlock: { paddingHorizontal: 12, gap: 8 },
  evoCard: { backgroundColor: T.cardDark, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: T.border },
  evoYear: { color: T.cyan, fontWeight: '900', fontSize: 12, marginBottom: 6 },
  evoLine: { fontSize: 11, marginBottom: 2 },
  note: { color: T.textDim, fontSize: 11, textAlign: 'center', padding: 16, fontStyle: 'italic' },
});
