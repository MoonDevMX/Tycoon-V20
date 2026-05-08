import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, IconTile } from '../src/ui/components';
import { monthOf, holidayFor, WEEKS_PER_YEAR } from '../src/game/data';
import { Movie } from '../src/game/types';

type Tab = 'now' | 'soon' | 'hold';

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export default function CurrentMovies() {
  const router = useRouter();
  const { state, setMovieReleaseDate, holdMovie } = useGame();
  const [tab, setTab] = useState<Tab>('now');
  const [scheduling, setScheduling] = useState<Movie | null>(null);

  const studios = useMemo(() => state ? [state.player, ...state.rivals] : [], [state]);
  const studioById = useMemo(() => Object.fromEntries(studios.map(st => [st.id, st])), [studios]);

  const data = useMemo(() => {
    if (!state) return [];
    if (tab === 'now') {
      // Now playing: released within last 12 weeks (theatrical or hybrid still in cinemas)
      return state.movies.filter(m => {
        if (m.status !== 'released') return false;
        if (m.releaseStrategy === 'streaming') return false;
        const wks = (state.year - m.releaseYear) * WEEKS_PER_YEAR + (state.week - m.releaseWeek);
        return wks <= 12 && wks >= 0;
      }).sort((a, b) => (b.releaseYear * 100 + b.releaseWeek) - (a.releaseYear * 100 + a.releaseWeek));
    }
    if (tab === 'soon') {
      // Coming soon: in production. Player movies must have a target release date and not be on hold.
      // Rival movies don't carry targetRelease* — fall back to weeksToRelease projection so they appear here too.
      return state.movies.filter(m => {
        if (m.status !== 'production') return false;
        if (m.onHold) return false;
        if (m.studioId === state.player.id) return !!m.targetReleaseWeek;
        // Rival in-production movies have a finite weeksToRelease (≠ 999999 sentinel)
        return typeof m.weeksToRelease === 'number' && m.weeksToRelease > 0 && m.weeksToRelease < 500;
      })
        .map(m => {
          // Project a release date for rivals so the existing "Y? · Month W? · in Nw" template still works.
          if (m.studioId === state.player.id) return m;
          let w = state.week + m.weeksToRelease; let y = state.year;
          while (w > WEEKS_PER_YEAR) { w -= WEEKS_PER_YEAR; y += 1; }
          return { ...m, targetReleaseWeek: w, targetReleaseYear: y };
        })
        .sort((a, b) => ((a.targetReleaseYear || 0) * 100 + (a.targetReleaseWeek || 0)) - ((b.targetReleaseYear || 0) * 100 + (b.targetReleaseWeek || 0)));
    }
    // hold: only player's, in production, on hold
    return state.movies.filter(m => m.studioId === state.player.id && m.status === 'production' && m.onHold);
  }, [state, tab]);

  if (!state) return null;

  const handleHold = (m: Movie) => {
    const r = holdMovie(m.id);
    if (r.error) notify('Cannot hold', r.error);
    else notify('Held', `${m.title} put on hold.`);
  };

  const renderItem = ({ item }: { item: Movie }) => {
    const studio = studioById[item.studioId];
    const isMine = item.studioId === state.player.id;
    const wkLeft = (item.targetReleaseYear || 0) * WEEKS_PER_YEAR + (item.targetReleaseWeek || 0) - (state.year * WEEKS_PER_YEAR + state.week);
    const hol = item.targetReleaseWeek ? holidayFor(item.targetReleaseWeek) : undefined;
    return (
      <View style={[s.row, isMine && { borderColor: T.cyan, borderWidth: 2 }]}>
        <TouchableOpacity style={s.rowMain} onPress={() => router.push(`/movie/${item.id}`)} testID={`current-movie-${item.id}`}>
          <IconTile icon={item.iconKey} color={item.iconBg} size={56} />
          <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <Text style={s.title} numberOfLines={1}>{item.title}</Text>
            <Text style={s.sub}>{studio?.name || 'Unknown'} · {item.brand} · {item.genre}</Text>
            {tab === 'now' && (
              <Text style={[s.tag, { color: T.green }]} numberOfLines={1}>
                Y{item.releaseYear} W{item.releaseWeek} · {item.criticScore}/100 · ${(item.boxOffice * 1000).toFixed(0)}M
              </Text>
            )}
            {tab === 'soon' && (
              <Text style={[s.tag, { color: T.cyan }]} numberOfLines={1}>
                Y{item.targetReleaseYear} · {monthOf(item.targetReleaseWeek!).name} W{monthOf(item.targetReleaseWeek!).weekInMonth} · in {wkLeft}w {hol ? `· 🎉${hol.name}` : ''}
              </Text>
            )}
            {tab === 'hold' && (
              <Text style={[s.tag, { color: T.orange }]}>ON HOLD — schedule when ready</Text>
            )}
          </View>
        </TouchableOpacity>
        {isMine && tab === 'soon' && (
          <View style={{ gap: 4 }}>
            <TouchableOpacity style={s.actBtn} onPress={() => router.push(`/marketing/${item.id}`)} testID={`marketing-${item.id}`}>
              <MaterialCommunityIcons name="bullhorn" size={16} color={T.magenta} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actBtn} onPress={() => setScheduling(item)} testID={`reschedule-${item.id}`}>
              <MaterialCommunityIcons name="calendar-edit" size={18} color={T.cyan} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.actBtn, { borderColor: T.orange }]} onPress={() => handleHold(item)} testID={`hold-${item.id}`}>
              <MaterialCommunityIcons name="pause" size={18} color={T.orange} />
            </TouchableOpacity>
          </View>
        )}
        {isMine && tab === 'hold' && (
          <View style={{ gap: 4 }}>
            <TouchableOpacity style={s.actBtn} onPress={() => router.push(`/marketing/${item.id}`)} testID={`marketing-hold-${item.id}`}>
              <MaterialCommunityIcons name="bullhorn" size={16} color={T.magenta} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.actBtn, { borderColor: T.green, backgroundColor: T.green + '33' }]} onPress={() => setScheduling(item)} testID={`schedule-${item.id}`}>
              <MaterialCommunityIcons name="calendar-plus" size={18} color={T.green} />
              <Text style={[s.actBtnTxt, { color: T.green }]}>Schedule</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Current Movies" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <View style={s.tabRow}>
        {([
          { k: 'now', label: 'Now Playing', icon: 'cinema-coupon' },
          { k: 'soon', label: 'Coming Soon', icon: 'clock-fast' },
          { k: 'hold', label: 'On Hold', icon: 'pause-circle' },
        ] as { k: Tab; label: string; icon: string }[]).map(opt => (
          <TouchableOpacity key={opt.k} style={[s.tab, tab === opt.k && s.tabActive]} onPress={() => setTab(opt.k)} testID={`tab-${opt.k}`}>
            <MaterialCommunityIcons name={opt.icon as any} size={20} color={tab === opt.k ? T.cardDark : T.text} />
            <Text style={[s.tabT, tab === opt.k && { color: T.cardDark }]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {data.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="filmstrip-off" size={48} color={T.textMute} />
          <Text style={s.emptyTxt}>
            {tab === 'now' ? 'No movies in cinemas right now.' :
             tab === 'soon' ? 'No upcoming releases.' :
             'No held titles. Create a movie without a release date to put it here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={renderItem}
        />
      )}

      {scheduling && (
        <ScheduleModal
          movie={scheduling}
          state={state}
          onClose={() => setScheduling(null)}
          onConfirm={(wk, yr) => {
            const r = setMovieReleaseDate(scheduling.id, wk, yr);
            if (r.error) notify('Cannot schedule', r.error);
            else { notify('Scheduled!', `${scheduling.title} → Y${yr} Wk ${wk}`); setScheduling(null); }
          }}
        />
      )}
    </SafeAreaView>
  );
}

function ScheduleModal({ movie, state, onClose, onConfirm }: { movie: Movie; state: any; onClose: () => void; onConfirm: (week: number, year: number) => void }) {
  const filmingWeeks = Math.max(2, Math.round(movie.runtime / 30) + 2);
  const [wk, setWk] = useState<number | null>(movie.targetReleaseWeek || null);
  const [yr, setYr] = useState<number | null>(movie.targetReleaseYear || null);

  return (
    <View style={s.modalBg}>
      <View style={s.modalCard}>
        <Text style={s.modalTitle}>Schedule "{movie.title}"</Text>
        <Text style={s.modalHint}>Filming needs ≥ {filmingWeeks} weeks from now.</Text>
        <ScrollView style={{ maxHeight: 320 }}>
          {[0, 1].map(off => {
            const y = state.year + off;
            return (
              <View key={y} style={{ marginBottom: 8 }}>
                <Text style={s.calYearLabel}>Year {y}</Text>
                <View style={s.calGrid}>
                  {Array.from({ length: WEEKS_PER_YEAR }, (_, i) => i + 1).map(w => {
                    const totalFromNow = (y - state.year) * WEEKS_PER_YEAR + (w - state.week);
                    const tooEarly = totalFromNow < filmingWeeks;
                    const hol = holidayFor(w);
                    const sel = wk === w && yr === y;
                    return (
                      <TouchableOpacity key={w} disabled={tooEarly}
                        style={[s.calCell, hol && s.calCellHoliday, sel && s.calCellSelected, tooEarly && s.calCellDisabled]}
                        onPress={() => { setWk(w); setYr(y); }}>
                        <Text style={[s.calCellTxt, hol && { color: T.yellow }, sel && { color: T.cardDark }]}>{w}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity style={[s.modalBtn, { backgroundColor: T.card }]} onPress={onClose}>
            <Text style={[s.modalBtnT, { color: T.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.modalBtn, { backgroundColor: T.green, opacity: wk && yr ? 1 : 0.4 }]}
            disabled={!wk || !yr}
            onPress={() => wk && yr && onConfirm(wk, yr)}>
            <Text style={[s.modalBtnT, { color: T.cardDark }]}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  tabRow: { flexDirection: 'row', padding: 8, gap: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: T.border, backgroundColor: T.cardDark },
  tabActive: { backgroundColor: T.cyan, borderColor: T.cyan },
  tabT: { color: T.text, fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 2, borderColor: T.border, gap: 6 },
  rowMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { color: T.text, fontSize: 15, fontWeight: '800' },
  sub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  tag: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  actBtn: { padding: 8, borderRadius: 8, borderWidth: 1.5, borderColor: T.cyan, backgroundColor: T.card, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actBtnTxt: { fontSize: 11, fontWeight: '900' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTxt: { color: T.textMute, fontSize: 14, marginTop: 12, textAlign: 'center' },
  modalBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: T.cardDark, padding: 14, borderRadius: 14, width: '100%', maxWidth: 420, borderWidth: 2, borderColor: T.border },
  modalTitle: { color: T.text, fontWeight: '900', fontSize: 16, marginBottom: 4 },
  modalHint: { color: T.textDim, fontSize: 12, marginBottom: 8 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: T.border },
  modalBtnT: { fontWeight: '900', fontSize: 14 },
  calYearLabel: { color: T.cyan, fontWeight: '900', fontSize: 12, marginBottom: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  calCell: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: T.card, borderRadius: 4, borderWidth: 1, borderColor: T.border },
  calCellHoliday: { borderColor: T.yellow, borderWidth: 1.5 },
  calCellSelected: { backgroundColor: T.green, borderColor: T.green },
  calCellDisabled: { opacity: 0.3 },
  calCellTxt: { color: T.text, fontSize: 11, fontWeight: '700' },
});
