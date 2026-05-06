import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T, SHADOW } from '../src/ui/theme';
import { GreyButton, NeonStat, SectionHeader, IconTile } from '../src/ui/components';
import { monthOf, nextHolidays } from '../src/game/data';

export default function Dashboard() {
  const router = useRouter();
  const { state, simulateWeek, simulateMultiple } = useGame();
  const [showInfo, setShowInfo] = useState(false);
  const [showMulti, setShowMulti] = useState(false);
  const [multiWeeks, setMultiWeeks] = useState('4');

  if (!state) {
    return (
      <View style={s.container}><Text>No game</Text></View>
    );
  }

  const { player, week, year, movies } = state;
  const inProduction = movies.filter(m => m.status === 'production' && m.studioId === player.id);
  const released = movies.filter(m => m.status === 'released' && m.studioId === player.id);
  const stars = '★'.repeat(player.rating) + '☆'.repeat(5 - player.rating);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Studio Header Card */}
        <View style={s.studioHeader}>
          <View style={[s.logoBox, { backgroundColor: player.logoBg }]}>
            <MaterialCommunityIcons name={player.logoIcon as any} size={48} color={T.yellow} />
            <Text style={s.logoLabel} numberOfLines={1}>{player.name.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text style={s.studioName} numberOfLines={1}>{player.name}</Text>
            <View style={s.statRow}>
              <NeonStat label="RELEASES" value={player.releases} color={T.cyan} testID="stat-releases" />
              <NeonStat label="AWARDS" value={player.awards} color={T.yellow} testID="stat-awards" />
            </View>
            <View style={s.statRow}>
              <NeonStat label="TOTAL BO" value={`${player.totalBO.toFixed(1)} B`} color={T.magenta} testID="stat-bo" />
              <NeonStat label="CASH" value={`${player.cash.toFixed(1)} B`} color={T.green} testID="stat-cash" />
            </View>
          </View>
        </View>

        <View style={s.starRow}><Text style={s.starText}>{stars}</Text></View>

        <SectionHeader title="General" />
        <View style={s.row2}>
          <GreyButton
            label={`${monthOf(week).name} W${monthOf(week).weekInMonth}`}
            sublabel={`Year ${year}\nInformation`}
            onPress={() => setShowInfo(true)}
            style={{ flex: 1 }}
            testID="info-btn"
          />
          <GreyButton
            label="Search"
            sublabel="People and Movies"
            onPress={() => router.push('/movies')}
            style={{ flex: 1 }}
            icon="magnify"
            iconColor={T.magenta}
            testID="search-btn"
          />
        </View>

        <SectionHeader title="Weekly Tasks" />
        <View style={s.row2}>
          <GreyButton
            label={'Simulate\nMultiple Weeks'}
            onPress={() => setShowMulti(true)}
            style={{ flex: 1 }}
            icon="fast-forward"
            iconColor={T.cyan}
            testID="sim-multi-btn"
          />
          <GreyButton
            label="Simulate Week"
            onPress={simulateWeek}
            style={{ flex: 1 }}
            icon="play"
            iconColor={T.green}
            testID="sim-week-btn"
          />
        </View>
        <View style={{ paddingHorizontal: 12, gap: 10, marginTop: 6 }}>
          <GreyButton
            label="Create New Movie"
            sublabel={`${inProduction.length} in production`}
            onPress={() => router.push({ pathname: '/create-movie', params: { reset: '1' } })}
            icon="movie-open-plus"
            iconColor={T.green}
            testID="create-movie-btn"
          />
          <GreyButton
            label="Current Movies"
            sublabel="Now playing · Coming soon · On hold"
            onPress={() => router.push('/current-movies')}
            icon="filmstrip-box-multiple"
            iconColor={T.cyan}
            testID="current-movies-btn"
          />
          <GreyButton
            label="Talent Database"
            sublabel="Hire writers, directors and cast"
            onPress={() => router.push('/talent')}
            icon="account-search"
            iconColor={T.pink}
            testID="talent-btn"
          />
        </View>

        <SectionHeader title="My Studio" />
        <View style={s.row2}>
          <GreyButton
            label="My Studio"
            sublabel="Stats & chronology"
            onPress={() => router.push('/studio-stats')}
            style={{ flex: 1 }}
            icon="domain"
            iconColor={T.green}
            testID="studio-stats-btn"
          />
          <GreyButton
            label="Movies"
            sublabel={`${released.length} released`}
            onPress={() => router.push('/movies')}
            style={{ flex: 1 }}
            icon="filmstrip"
            iconColor={T.cyan}
            testID="movies-btn"
          />
        </View>
        <View style={s.row2}>
          <GreyButton
            label="Franchises"
            sublabel={`${state.franchises.filter(f => f.studioId === player.id).length} owned`}
            onPress={() => router.push('/franchises')}
            style={{ flex: 1 }}
            icon="star-circle"
            iconColor={T.yellow}
            testID="franchises-btn"
          />
          <GreyButton
            label="Calendar"
            sublabel="Holidays & seasons"
            onPress={() => router.push('/calendar')}
            style={{ flex: 1 }}
            icon="calendar-month"
            iconColor={T.cyan}
            testID="calendar-btn"
          />
        </View>
        <View style={s.row2}>
          <GreyButton
            label="Streaming"
            sublabel={`${(state.streamingServices || []).length} services`}
            onPress={() => router.push('/streaming')}
            style={{ flex: 1 }}
            icon="play-circle"
            iconColor={T.magenta}
            testID="streaming-btn"
          />
          <GreyButton
            label="Rival Studios"
            sublabel={`${state.rivals.length} studios industry-wide`}
            onPress={() => router.push('/rivals')}
            style={{ flex: 1 }}
            icon="domain"
            iconColor={T.orange}
            testID="rivals-btn"
          />
        </View>
        <View style={s.row2}>
          <GreyButton
            label="Audience & Trends"
            sublabel="Genres · Demographics"
            onPress={() => router.push('/trends')}
            style={{ flex: 1 }}
            icon="chart-line-variant"
            iconColor={T.magenta}
            testID="trends-btn"
          />
          <GreyButton
            label="Awards"
            sublabel="4 award systems"
            onPress={() => router.push('/awards')}
            style={{ flex: 1 }}
            icon="trophy"
            iconColor={T.yellow}
            testID="awards-btn"
          />
        </View>
        <View style={s.row2}>
          <GreyButton
            label="Festivals"
            sublabel="4 per year · live auctions"
            onPress={() => router.push('/festivals')}
            style={{ flex: 1 }}
            icon="movie-roll"
            iconColor={T.yellow}
            testID="festivals-btn"
          />
          <GreyButton
            label="Cinemas"
            sublabel={`${(state.cinemaDeals || []).filter(d => d.studioId === player.id).length} active deals`}
            onPress={() => router.push('/cinemas')}
            style={{ flex: 1 }}
            icon="theater"
            iconColor={T.cyan}
            testID="cinemas-btn"
          />
        </View>
        <View style={{ paddingHorizontal: 12, marginTop: 6 }}>
          {(() => {
            const playerId = state.player.id;
            const licensingCount = state.pendingOffers?.length ?? 0;
            const franchiseCount = (state.franchiseOffers || []).filter(o => o.status === 'pending' && (o.fromStudioId === playerId || o.toStudioId === playerId)).length;
            const bulkCount = (state.bulkCatalogOffers || []).filter(o => o.status === 'pending' && (o.fromStudioId === playerId || o.toStudioId === playerId)).length;
            const total = licensingCount + franchiseCount + bulkCount;
            const summary = total === 0
              ? 'No pending offers'
              : [
                  licensingCount > 0 ? `${licensingCount} streamer${licensingCount > 1 ? 's' : ''}` : '',
                  franchiseCount > 0 ? `${franchiseCount} franchise trade${franchiseCount > 1 ? 's' : ''}` : '',
                  bulkCount > 0 ? `${bulkCount} catalog pack${bulkCount > 1 ? 's' : ''}` : '',
                ].filter(Boolean).join(' · ');
            return (
              <View>
                <GreyButton
                  label="Pending Trades & Offers"
                  sublabel={summary}
                  onPress={() => router.push('/offers')}
                  icon="handshake"
                  iconColor={total > 0 ? T.yellow : T.cyan}
                  testID="offers-btn"
                />
                {total > 0 ? (
                  <View style={s.badge} testID="offers-badge"><Text style={s.badgeTxt}>{total}</Text></View>
                ) : null}
              </View>
            );
          })()}
        </View>

        {/* News feed */}
        {state.newsLog.length > 0 ? (
          <>
            <SectionHeader title="Industry News" />
            <View style={{ paddingHorizontal: 12 }}>
              {state.newsLog.slice(0, 6).map((n, i) => (
                <View key={i} style={s.newsItem}>
                  <Text style={s.newsTime}>W{n.week} Y{n.year}</Text>
                  <Text style={s.newsText}>{n.text}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Information modal */}
      <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={s.modalIcon}>
              <MaterialCommunityIcons name="chart-line" size={44} color={T.cyan} />
            </View>
            <Text style={s.modalTitle}>General Information</Text>
            <View style={[s.logoBox, { alignSelf: 'center', backgroundColor: player.logoBg, marginVertical: 12 }]}>
              <MaterialCommunityIcons name={player.logoIcon as any} size={48} color={T.yellow} />
              <Text style={s.logoLabel}>{player.name.toUpperCase()}</Text>
            </View>
            <View style={s.statRow}>
              <NeonStat label="RELEASES" value={player.releases} color={T.cyan} />
              <NeonStat label="AWARDS" value={player.awards} color={T.pink} />
            </View>
            <View style={[s.statRow, { marginTop: 8 }]}>
              <NeonStat label="TOTAL BO" value={`${player.totalBO.toFixed(1)} B`} color={T.magenta} />
              <NeonStat label="CASH" value={`${player.cash.toFixed(1)} B`} color={T.green} />
            </View>
            <Text style={[s.modalTitle, { fontSize: 18, marginTop: 12 }]}>{monthOf(week).name} W{monthOf(week).weekInMonth}, Year {year}</Text>
            <Text style={[s.modalTitle, { fontSize: 14, fontWeight: '700', color: T.cyan }]}>Upcoming Holidays</Text>
            {nextHolidays(week, year, 3).map((h, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8 }}>
                <Text style={{ color: T.text, fontWeight: '800' }}>{h.h.name}</Text>
                <Text style={{ color: T.green }}>+{Math.round((h.h.mult - 1) * 100)}% · in {h.weeksAway}w</Text>
              </View>
            ))}
            <TouchableOpacity style={s.modalOk} onPress={() => setShowInfo(false)} testID="info-ok">
              <Text style={s.modalOkText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Multi-week modal */}
      <Modal visible={showMulti} transparent animationType="fade" onRequestClose={() => setShowMulti(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Simulate Multiple Weeks</Text>
            <Text style={[s.modalTitle, { fontSize: 12, fontWeight: '700', color: T.textDim, marginBottom: 8 }]}>
              Enter any number from 1 to 96 (≈2 years).
            </Text>
            <TextInput
              value={multiWeeks}
              onChangeText={(v) => setMultiWeeks(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              maxLength={3}
              style={s.weekInput}
              placeholder="e.g. 12"
              placeholderTextColor={T.textMute}
              testID="multi-weeks-input"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                const n = Math.max(1, Math.min(96, parseInt(multiWeeks, 10) || 0));
                if (n >= 1) { simulateMultiple(n); setShowMulti(false); }
              }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
              {[1, 4, 12, 24, 48].map(w => (
                <TouchableOpacity
                  key={w}
                  style={s.weekChip}
                  onPress={() => setMultiWeeks(String(w))}
                  testID={`week-chip-${w}`}
                >
                  <Text style={s.weekChipTxt}>{w}w</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[s.modalOk, { backgroundColor: T.cardDark, flex: 1 }]} onPress={() => setShowMulti(false)}>
                <Text style={[s.modalOkText, { color: T.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalOk, { flex: 1 }]}
                onPress={() => {
                  const n = Math.max(1, Math.min(96, parseInt(multiWeeks, 10) || 0));
                  if (n >= 1) { simulateMultiple(n); setShowMulti(false); }
                }}
                testID="multi-weeks-go"
              >
                <Text style={s.modalOkText}>SIMULATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  studioHeader: {
    flexDirection: 'row', backgroundColor: T.cardDark, padding: 12, alignItems: 'center',
  },
  logoBox: {
    width: 130, height: 90, borderRadius: 10, padding: 6,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border,
  },
  logoLabel: { color: '#fff', fontSize: 9, fontWeight: '900', marginTop: 2, letterSpacing: 1 },
  studioName: { color: T.text, fontSize: 20, fontWeight: '900', marginBottom: 8 },
  statRow: { flexDirection: 'row', gap: 8, marginVertical: 3 },
  starRow: { backgroundColor: T.cardDark, paddingHorizontal: 12, paddingBottom: 8 },
  starText: { color: T.yellow, fontSize: 22, letterSpacing: 4 },
  row2: { flexDirection: 'row', padding: 12, gap: 10 },
  newsItem: {
    backgroundColor: T.cardDark, padding: 10, borderRadius: 8, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: T.cyan,
  },
  newsTime: { color: T.cyan, fontSize: 11, fontWeight: '800' },
  newsText: { color: T.text, fontSize: 13, marginTop: 2 },
  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#5A5D63', padding: 20, borderRadius: 14, width: '100%', maxWidth: 380, borderWidth: 3, borderColor: T.border },
  modalIcon: { alignSelf: 'center', backgroundColor: T.cyan, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  modalTitle: { color: T.text, fontSize: 22, fontWeight: '900', textAlign: 'center', marginVertical: 8 },
  modalOk: { backgroundColor: T.cyan, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 14, borderWidth: 2, borderColor: T.border },
  modalOkText: { color: T.cardDark, fontWeight: '900', fontSize: 16 },
  weekOpt: { backgroundColor: T.card, padding: 12, borderRadius: 8, marginVertical: 4, alignItems: 'center', borderWidth: 2, borderColor: T.border },
  weekOptTxt: { color: T.text, fontWeight: '800', fontSize: 16 },
  weekInput: { backgroundColor: T.cardDark, borderWidth: 2, borderColor: T.cyan, borderRadius: 10, color: T.text, fontSize: 24, fontWeight: '900', textAlign: 'center', paddingVertical: 14, marginTop: 4 },
  weekChip: { backgroundColor: T.card, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: T.border },
  weekChipTxt: { color: T.text, fontWeight: '900', fontSize: 12 },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#E84545', minWidth: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border, paddingHorizontal: 6 },
  badgeTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
