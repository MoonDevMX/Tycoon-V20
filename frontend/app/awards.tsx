import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar } from '../src/ui/components';
import { useState } from 'react';
import { AwardCeremony, Movie } from '../src/game/types';

const POOL_DEFS = [
  { key: 'ricardos' as const, label: "Ricardo's Awards", desc: 'Oscars-style — every released film qualifies', color: '#F1C40F', filter: (_m: Movie) => true },
  { key: 'bigpic' as const, label: 'Big Picture Awards', desc: 'Films with budgets ≥ $200M', color: '#E74C3C', filter: (m: Movie) => m.budget >= 200 },
  { key: 'indie' as const, label: 'Independent Awards', desc: 'Films with budgets < $200M', color: '#3498DB', filter: (m: Movie) => m.budget < 200 },
  { key: 'guild' as const, label: 'Creative Guild Awards', desc: 'Films financed mostly via box office %', color: '#9B59B6', filter: (m: Movie) => m.cast.some(c => c.boPercent >= 6) },
];

const CATEGORY_ICON: Record<string, string> = {
  best_picture: 'movie-roll',
  best_director: 'movie-edit',
  best_writer: 'feather',
  best_leading_actor: 'star-circle',
  best_supporting_actor: 'account-star',
};

export default function Awards() {
  const router = useRouter();
  const { state } = useGame();
  if (!state) return null;

  const showYear = state.year;
  const [activeYear, setActiveYear] = useState<number>(showYear);
  // All years that have any awards or current year
  const allYears = Array.from(new Set([...(state.awardsLog || []).map(c => c.year), state.year])).sort((a, b) => b - a);

  // For current year (if before week 46), compute live nominees from current eligible movies
  const liveNominees = (poolKey: string): null | AwardCeremony => {
    if (activeYear !== state.year || state.week >= 46) return null;
    const def = POOL_DEFS.find(p => p.key === poolKey)!;
    const eligible = state.movies.filter(m => m.status === 'released' && m.releaseYear === state.year && def.filter(m));
    // Always return a ceremony shell (even with empty categories) so all 4 award systems render
    const sortDesc = <Tx,>(arr: Tx[], score: (x: Tx) => number) => [...arr].sort((a, b) => score(b) - score(a));
    const bp = sortDesc(eligible, m => m.criticScore).slice(0, 5).map(m => ({ movieId: m.id, score: m.criticScore }));
    const dir = sortDesc(eligible, m => {
      const d = state.talents.find(t => t.id === m.directorId);
      return m.criticScore * ((d?.skill || 50) / 100);
    }).slice(0, 5).map(m => ({ movieId: m.id, talentId: m.directorId, score: m.criticScore }));
    const wr = sortDesc(eligible, m => {
      const w = state.talents.find(t => t.id === m.writerId);
      return m.criticScore * ((w?.skill || 50) / 100);
    }).slice(0, 5).map(m => ({ movieId: m.id, talentId: m.writerId, score: m.criticScore }));
    type ActPair = { movieId: string; talentId: string; score: number };
    const lp: ActPair[] = []; const sp: ActPair[] = [];
    eligible.forEach(m => m.cast.forEach(c => {
      const t = state.talents.find(tt => tt.id === c.talentId); if (!t) return;
      const sc = m.criticScore * (t.skill / 100);
      if (c.role === 'lead_actor' || c.role === 'lead_actress') lp.push({ movieId: m.id, talentId: c.talentId, score: sc });
      else sp.push({ movieId: m.id, talentId: c.talentId, score: sc });
    }));
    return {
      year: state.year, poolKey: poolKey as any, poolLabel: def.label,
      categories: ([
        { key: 'best_picture' as const, label: 'Best Picture', nominees: bp, winnerIdx: -1 },
        { key: 'best_director' as const, label: 'Best Director', nominees: dir, winnerIdx: -1 },
        { key: 'best_writer' as const, label: 'Best Writer', nominees: wr, winnerIdx: -1 },
        { key: 'best_leading_actor' as const, label: 'Best Leading Performance', nominees: sortDesc(lp, p => p.score).slice(0, 5), winnerIdx: -1 },
        { key: 'best_supporting_actor' as const, label: 'Best Supporting Performance', nominees: sortDesc(sp, p => p.score).slice(0, 5), winnerIdx: -1 },
      ] as any[]),
    };
  };

  const ceremoniesForYear = POOL_DEFS.map(def => {
    const stored = (state.awardsLog || []).find(c => c.year === activeYear && c.poolKey === def.key);
    // Always render all 4 pools — fall back to empty live shell if no stored data and no current-year movies
    let ceremony = stored || liveNominees(def.key);
    if (!ceremony) {
      // Past year with no stored ceremony OR no eligible movies — render empty placeholder
      ceremony = {
        year: activeYear, poolKey: def.key as any, poolLabel: def.label,
        categories: [],
      };
    }
    return { def, ceremony };
  });

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Awards" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <View style={s.yearTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
          {allYears.map(y => (
            <View key={y} style={[s.yearChip, activeYear === y && { backgroundColor: T.cyan, borderColor: T.cyan }]}>
              <Text style={[s.yearChipT, activeYear === y && { color: T.cardDark }]} onPress={() => setActiveYear(y)} testID={`year-${y}`}>
                Y{y}{y === state.year && state.week < 46 ? ' (live)' : ''}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {ceremoniesForYear.map(({ def, ceremony }) => {
          if (!ceremony) return null;
          const totalNominees = ceremony.categories.reduce((a, c) => a + c.nominees.length, 0);
          return (
            <View key={def.key} style={[s.card, { borderColor: def.color }]}>
              <View style={s.cardHeader}>
                <MaterialCommunityIcons name="trophy" size={26} color={def.color} />
                <Text style={[s.title, { color: def.color }]}>{def.label}</Text>
              </View>
              <Text style={s.desc}>{def.desc}</Text>
              {totalNominees === 0 ? (
                <Text style={[s.empty, { padding: 12, fontSize: 12 }]}>No eligible movies for this ceremony in Y{activeYear}.</Text>
              ) : ceremony.categories.map(cat => (
                <View key={cat.key} style={s.catBlock}>
                  <View style={s.catHeader}>
                    <MaterialCommunityIcons name={CATEGORY_ICON[cat.key] as any} size={16} color={def.color} />
                    <Text style={[s.catTitle, { color: def.color }]}>{cat.label}</Text>
                  </View>
                  {cat.nominees.length === 0 ? (
                    <Text style={[s.subTxt, { paddingHorizontal: 8, fontStyle: 'italic' }]}>No eligible nominees.</Text>
                  ) : cat.nominees.map((nom, idx) => {
                    const movie = state.movies.find(m => m.id === nom.movieId);
                    if (!movie) return null;
                    const talent = nom.talentId ? state.talents.find(t => t.id === nom.talentId) : null;
                    const isWinner = idx === cat.winnerIdx;
                    const isLive = cat.winnerIdx === -1;
                    const owner = movie.studioId === state.player.id ? state.player : state.rivals.find(r => r.id === movie.studioId);
                    return (
                      <View key={`${cat.key}-${idx}`} style={[s.nominee, isWinner && { backgroundColor: T.card, borderLeftWidth: 4, borderLeftColor: def.color }]}>
                        <Text style={s.rank}>{isWinner ? '🏆' : isLive ? `#${idx + 1}` : `·${idx + 1}`}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.nName} numberOfLines={1}>
                            {talent ? talent.name : movie.title}
                            {talent ? <Text style={s.subTxt}>  · {movie.title}</Text> : null}
                          </Text>
                          <Text style={s.subTxt}>{owner?.name || 'Unknown'} · {movie.criticScore}/100</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}
        <Text style={s.note}>Winners declared end of year (Wk 46). Award wins boost talent fame +5, salary ×1.15, and franchise reputation.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  yearTabs: { paddingVertical: 8, backgroundColor: T.cardDark, borderBottomWidth: 1, borderBottomColor: T.border },
  yearChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 2, borderColor: T.border, backgroundColor: T.bg },
  yearChipT: { color: T.text, fontWeight: '900', fontSize: 12 },
  card: { backgroundColor: T.cardDark, borderWidth: 3, borderRadius: 12, marginHorizontal: 12, marginVertical: 8, padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontWeight: '900', fontSize: 18 },
  desc: { color: T.textDim, fontSize: 11, fontStyle: 'italic', marginBottom: 8 },
  catBlock: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: T.border },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  catTitle: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  nominee: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  rank: { color: T.yellow, fontWeight: '900', fontSize: 13, width: 32 },
  nName: { color: T.text, fontWeight: '700', fontSize: 13 },
  subTxt: { color: T.textDim, fontSize: 11 },
  empty: { color: T.text, fontStyle: 'italic', textAlign: 'center', padding: 24 },
  note: { color: T.textDim, fontSize: 11, textAlign: 'center', padding: 16, fontStyle: 'italic' },
});
