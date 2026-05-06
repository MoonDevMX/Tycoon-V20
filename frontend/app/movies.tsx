import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, IconTile } from '../src/ui/components';
import { GENRES } from '../src/game/data';
import { Genre, MovieType } from '../src/game/types';

const STATUS_OPTS: { key: 'all' | 'production' | 'released'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'released', label: 'Released' },
  { key: 'production', label: 'In Production' },
];
const BRAND_OPTS: { key: 'all' | 'Original' | 'Sequel' | 'Prequel' | 'Spinoff' | 'Crossover'; label: string }[] = [
  { key: 'all', label: 'Any Brand' },
  { key: 'Original', label: 'Original' },
  { key: 'Sequel', label: 'Sequel' },
  { key: 'Prequel', label: 'Prequel' },
  { key: 'Spinoff', label: 'Spinoff' },
  { key: 'Crossover', label: 'Crossover' },
];
const SORT_OPTS: { key: 'bo' | 'year' | 'critic' | 'title'; label: string }[] = [
  { key: 'bo', label: 'Box Office ↓' },
  { key: 'year', label: 'Newest' },
  { key: 'critic', label: 'Critic ↓' },
  { key: 'title', label: 'Title A-Z' },
];

export default function Movies() {
  const router = useRouter();
  const { state } = useGame();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [status, setStatus] = useState<'all' | 'production' | 'released'>('all');
  const [genre, setGenre] = useState<'all' | Genre>('all');
  const [brand, setBrand] = useState<'all' | 'Original' | 'Sequel' | 'Prequel' | 'Spinoff' | 'Crossover'>('all');
  const [studioId, setStudioId] = useState<'all' | string>('all');
  const [sortKey, setSortKey] = useState<'bo' | 'year' | 'critic' | 'title'>('year');

  const studios = useMemo(() => state ? [state.player, ...state.rivals] : [], [state]);
  const studioById = useMemo(() => Object.fromEntries(studios.map(st => [st.id, st])), [studios]);
  const talentNameById = useMemo(() => state ? Object.fromEntries(state.talents.map(t => [t.id, t.name])) : {}, [state]);
  const franchiseNameById = useMemo(() => state ? Object.fromEntries(state.franchises.map(f => [f.id, f.name])) : {}, [state]);

  const data = useMemo(() => {
    if (!state) return [];
    let arr = state.movies.slice();
    if (scope === 'mine') arr = arr.filter(m => m.studioId === state.player.id);
    if (status !== 'all') arr = arr.filter(m => m.status === status);
    if (genre !== 'all') arr = arr.filter(m => m.genre === genre);
    if (brand !== 'all') arr = arr.filter(m => m.brand === brand);
    if (studioId !== 'all') arr = arr.filter(m => m.studioId === studioId);
    if (q.trim()) {
      const needle = q.toLowerCase().trim();
      arr = arr.filter(m => {
        if (m.title.toLowerCase().includes(needle)) return true;
        const fr = m.franchiseId ? franchiseNameById[m.franchiseId] : '';
        if (fr && fr.toLowerCase().includes(needle)) return true;
        const writer = talentNameById[m.writerId];
        if (writer && writer.toLowerCase().includes(needle)) return true;
        const director = talentNameById[m.directorId];
        if (director && director.toLowerCase().includes(needle)) return true;
        for (const c of m.cast) {
          const n = talentNameById[c.talentId];
          if (n && n.toLowerCase().includes(needle)) return true;
        }
        return false;
      });
    }
    arr.sort((a, b) => {
      if (sortKey === 'bo') return b.boxOffice - a.boxOffice;
      if (sortKey === 'critic') return b.criticScore - a.criticScore;
      if (sortKey === 'title') return a.title.localeCompare(b.title);
      return (b.releaseYear * 100 + b.releaseWeek) - (a.releaseYear * 100 + a.releaseWeek);
    });
    return arr;
  }, [state, scope, status, genre, brand, studioId, q, sortKey, talentNameById, franchiseNameById]);

  if (!state) return null;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Movie Database" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />

      <View style={s.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={20} color={T.textMute} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search title, franchise, actor, director…"
          placeholderTextColor={T.textMute}
          style={s.searchInput}
          testID="movies-search"
        />
      </View>

      <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
        <ChipRow opts={[{ key: 'mine', label: 'My Studio' }, { key: 'all', label: 'All Studios' }]} value={scope} onChange={setScope} testIdPrefix="scope" accent={T.cyan} />
        <ChipRow opts={STATUS_OPTS} value={status} onChange={setStatus} testIdPrefix="status" />
        <ChipRow opts={BRAND_OPTS} value={brand} onChange={setBrand} testIdPrefix="brand" />
        <ChipRow opts={[{ key: 'all', label: 'Any Genre' }, ...GENRES.map(g => ({ key: g, label: g }))]} value={genre} onChange={setGenre} testIdPrefix="genre" />
        {scope === 'all' && (
          <ChipRow opts={[{ key: 'all', label: 'Any Studio' }, ...studios.map(st => ({ key: st.id, label: st.name }))]} value={studioId} onChange={setStudioId} testIdPrefix="studio" />
        )}
        <ChipRow opts={SORT_OPTS} value={sortKey} onChange={setSortKey} testIdPrefix="sort" accent={T.yellow} />
      </ScrollView>

      <View style={s.metaRow}>
        <Text style={s.metaTxt}>{data.length} {data.length === 1 ? 'movie' : 'movies'}</Text>
        <TouchableOpacity onPress={() => router.push('/create-movie')} testID="header-create">
          <Text style={[s.metaTxt, { color: T.green }]}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {data.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="filmstrip-off" size={64} color={T.textMute} />
          <Text style={s.emptyTxt}>No movies match these filters.</Text>
          {scope === 'mine' && state.movies.filter(m => m.studioId === state.player.id).length === 0 && (
            <TouchableOpacity style={s.cta} onPress={() => router.push('/create-movie')} testID="empty-create-btn">
              <Text style={s.ctaTxt}>Create Movie</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 12 }}
          initialNumToRender={15}
          windowSize={10}
          removeClippedSubviews
          renderItem={({ item }) => {
            const studio = studioById[item.studioId];
            return (
              <TouchableOpacity style={s.row} onPress={() => router.push(`/movie/${item.id}`)} testID={`movie-${item.id}`}>
                <IconTile icon={item.iconKey} color={item.iconBg} size={64} />
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={s.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.sub} numberOfLines={1}>
                    {studio ? studio.name : 'Unknown Studio'} · {item.brand} · {item.genre}
                  </Text>
                  {item.status === 'production' ? (
                    <Text style={[s.tag, { color: T.orange }]}>In production · {item.weeksToRelease}w</Text>
                  ) : (
                    <Text style={[s.tag, { color: T.green }]} numberOfLines={1}>
                      Y{item.releaseYear} W{item.releaseWeek} · {item.criticScore}/100 · {(item.boxOffice * 1000).toFixed(0)}M
                    </Text>
                  )}
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

function ChipRow<K extends string>({ opts, value, onChange, testIdPrefix, accent }: { opts: { key: K; label: string }[]; value: K; onChange: (k: K) => void; testIdPrefix: string; accent?: string }) {
  const hi = accent || T.cyan;
  return (
    <FlatList
      horizontal
      data={opts}
      keyExtractor={o => o.key}
      contentContainerStyle={{ paddingHorizontal: 10, gap: 6, paddingVertical: 4 }}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onChange(item.key)}
          style={[s.chip, value === item.key && { backgroundColor: hi, borderColor: hi }]}
          testID={`${testIdPrefix}-${item.key}`}
        >
          <Text style={[s.chipT, value === item.key && { color: T.cardDark }]}>{item.label}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderBottomWidth: 2, borderBottomColor: T.border },
  searchInput: { flex: 1, color: T.text, fontSize: 14 },
  chip: { backgroundColor: T.cardDark, borderWidth: 2, borderColor: T.border, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  chipT: { color: T.text, fontWeight: '800', fontSize: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6 },
  metaTxt: { color: T.text, fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 2, borderColor: T.border },
  title: { color: T.text, fontSize: 16, fontWeight: '800' },
  sub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  tag: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTxt: { color: T.cardDark, fontSize: 16, marginTop: 12, fontWeight: '700', textAlign: 'center' },
  cta: { marginTop: 16, backgroundColor: T.green, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10, borderWidth: 2, borderColor: T.border },
  ctaTxt: { color: T.cardDark, fontWeight: '900', fontSize: 16 },
});
