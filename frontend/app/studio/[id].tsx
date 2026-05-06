import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useGame } from '../../src/game/state';
import { T } from '../../src/ui/theme';
import { TopBar, NeonStat, SectionHeader } from '../../src/ui/components';
import { monthOf, getRel, relLabel } from '../../src/game/data';

export default function StudioDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useGame();

  const studio = useMemo(() => {
    if (!state) return null;
    if (state.player.id === id) return state.player;
    return state.rivals.find(r => r.id === id) || null;
  }, [state, id]);

  if (!state || !studio) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <TopBar title="Studio" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
        <Text style={s.empty}>Studio not found.</Text>
      </SafeAreaView>
    );
  }

  const isPlayer = studio.isPlayer;
  const studioMovies = state.movies.filter(m => m.studioId === studio.id);
  const released = studioMovies.filter(m => m.status === 'released');
  const inProd = studioMovies.filter(m => m.status === 'production');
  const ownedFranchises = state.franchises.filter(f => f.studioId === studio.id);
  const sortedReleased = [...released].sort((a, b) => (b.releaseYear * 100 + b.releaseWeek) - (a.releaseYear * 100 + a.releaseWeek));
  const avgCritic = released.length ? +(released.reduce((a, b) => a + b.criticScore, 0) / released.length).toFixed(1) : 0;
  const reputation = Math.min(100, Math.round(avgCritic * 0.5 + Math.min(studio.awards, 60) * 0.8));

  // Relationship to player
  const playerRel = !isPlayer ? getRel(state.relationships, state.player.id, studio.id) : 0;
  const playerRelInfo = !isPlayer ? relLabel(playerRel) : null;

  // Top relationships for the player view (best friends + worst rivals)
  const allOtherStudios = isPlayer
    ? state.rivals.map(r => ({ studio: r, score: getRel(state.relationships, state.player.id, r.id) }))
    : [];
  const friends = [...allOtherStudios].filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const rivalsList = [...allOtherStudios].filter(x => x.score < 0).sort((a, b) => a.score - b.score).slice(0, 5);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title={isPlayer ? 'My Studio' : 'Studio'} onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={s.header}>
          <View style={[s.logo, { backgroundColor: studio.logoBg }]}>
            <MaterialCommunityIcons name={studio.logoIcon as any} size={48} color={T.yellow} />
          </View>
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text style={s.name}>{studio.name}</Text>
            <Text style={s.sub}>★ {studio.rating} · Reputation {reputation}/100</Text>
            {!isPlayer && playerRelInfo && (
              <View style={[s.relPill, { backgroundColor: playerRelInfo.color + '22', borderColor: playerRelInfo.color }]}>
                <View style={[s.relDot, { backgroundColor: playerRelInfo.color }]} />
                <Text style={[s.relTxt, { color: playerRelInfo.color }]}>
                  {playerRelInfo.descriptor} · {playerRel >= 0 ? '+' : ''}{playerRel}
                </Text>
              </View>
            )}
          </View>
        </View>

        {!isPlayer && playerRelInfo && (
          <View style={s.relMeterWrap}>
            <View style={s.relMeterBg}>
              <View style={[s.relMeterFill, {
                left: playerRel >= 0 ? '50%' : `${50 + playerRel / 2}%`,
                width: `${Math.abs(playerRel) / 2}%`,
                backgroundColor: playerRelInfo.color,
              }]} />
              <View style={s.relMeterCenter} />
            </View>
            <View style={s.relMeterLabels}>
              <Text style={s.relMeterLbl}>Rival -100</Text>
              <Text style={s.relMeterLbl}>Neutral 0</Text>
              <Text style={s.relMeterLbl}>+100 Friend</Text>
            </View>
          </View>
        )}

        <SectionHeader title="Career" />
        <View style={s.row}>
          <NeonStat label="RELEASES" value={studio.releases} color={T.cyan} />
          <NeonStat label="IN PROD" value={inProd.length} color={T.orange} />
          <NeonStat label="AWARDS" value={studio.awards} color={T.yellow} />
        </View>
        <View style={s.row}>
          <NeonStat label="TOTAL B.O." value={`${studio.totalBO.toFixed(2)} B`} color={T.magenta} />
          {isPlayer && <NeonStat label="CASH" value={`${studio.cash.toFixed(2)} B`} color={T.green} />}
          <NeonStat label="AVG CRITIC" value={avgCritic || '-'} color={T.cyan} />
        </View>
        <View style={s.row}>
          <NeonStat label="FRANCHISES" value={ownedFranchises.length} color={T.pink} />
          <NeonStat label="REPUTATION" value={reputation} color={T.green} />
        </View>

        {isPlayer && (
          <>
            <SectionHeader title="Industry Relationships" />
            {friends.length === 0 && rivalsList.length === 0 && allOtherStudios.length > 0 && (
              <Text style={s.empty}>You're on neutral terms with everyone. Start collaborating to forge alliances or rivalries.</Text>
            )}
            {friends.length > 0 && (
              <View style={{ paddingHorizontal: 8 }}>
                <Text style={s.relSubhead}>Allies</Text>
                {friends.map(({ studio: rs, score }) => {
                  const lbl = relLabel(score);
                  return (
                    <TouchableOpacity key={rs.id} style={s.relRow} onPress={() => router.push(`/studio/${rs.id}`)} testID={`rel-${rs.id}`}>
                      <View style={[s.relLogo, { backgroundColor: rs.logoBg }]}>
                        <MaterialCommunityIcons name={rs.logoIcon as any} size={20} color={T.yellow} />
                      </View>
                      <Text style={s.relName} numberOfLines={1}>{rs.name}</Text>
                      <Text style={[s.relScore, { color: lbl.color }]}>+{score}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {rivalsList.length > 0 && (
              <View style={{ paddingHorizontal: 8, marginTop: 8 }}>
                <Text style={s.relSubhead}>Rivals</Text>
                {rivalsList.map(({ studio: rs, score }) => {
                  const lbl = relLabel(score);
                  return (
                    <TouchableOpacity key={rs.id} style={s.relRow} onPress={() => router.push(`/studio/${rs.id}`)} testID={`rel-${rs.id}`}>
                      <View style={[s.relLogo, { backgroundColor: rs.logoBg }]}>
                        <MaterialCommunityIcons name={rs.logoIcon as any} size={20} color={T.yellow} />
                      </View>
                      <Text style={s.relName} numberOfLines={1}>{rs.name}</Text>
                      <Text style={[s.relScore, { color: lbl.color }]}>{score}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {ownedFranchises.length > 0 && (
          <>
            <SectionHeader title={`Franchises (${ownedFranchises.length})`} />
            {ownedFranchises.map(f => (
              <TouchableOpacity key={f.id} style={s.franchiseRow} onPress={() => router.push(`/franchise/${f.id}`)} testID={`franchise-${f.id}`}>
                <View style={[s.icon, { backgroundColor: f.iconBg }]}>
                  <MaterialCommunityIcons name={f.iconKey as any} size={20} color="#fff" />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 8 }}>
                  <Text style={s.mTitle} numberOfLines={1}>{f.name}</Text>
                  <Text style={s.mSub}>Popularity {f.popularity}/100 · {f.movieIds.length} releases</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={T.textMute} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <SectionHeader title={`Chronology (${sortedReleased.length})`} />
        {sortedReleased.length === 0 ? (
          <Text style={s.empty}>No releases yet.</Text>
        ) : sortedReleased.map(m => {
          const mt = monthOf(m.releaseWeek);
          return (
            <TouchableOpacity key={m.id} style={s.movieRow} onPress={() => router.push(`/movie/${m.id}`)} testID={`chron-${m.id}`}>
              <View style={[s.icon, { backgroundColor: m.iconBg }]}>
                <MaterialCommunityIcons name={m.iconKey as any} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <Text style={s.mTitle} numberOfLines={1}>{m.title}</Text>
                <Text style={s.mSub}>{mt.name} W{mt.weekInMonth}, Y{m.releaseYear} · {m.brand} · Critic {m.criticScore}</Text>
              </View>
              <Text style={[s.mSub, { color: T.green }]}>{(m.boxOffice * 1000).toFixed(0)}M</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', backgroundColor: T.cardDark, padding: 12, alignItems: 'center' },
  logo: { width: 80, height: 80, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border },
  name: { color: T.text, fontSize: 22, fontWeight: '900' },
  sub: { color: T.textDim, fontSize: 13, marginTop: 2 },
  relPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1.5, gap: 6 },
  relDot: { width: 8, height: 8, borderRadius: 4 },
  relTxt: { fontWeight: '900', fontSize: 12 },
  relMeterWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: T.cardDark },
  relMeterBg: { width: '100%', height: 8, backgroundColor: T.panel, borderRadius: 4, position: 'relative', borderWidth: 1, borderColor: T.border },
  relMeterFill: { position: 'absolute', height: '100%', borderRadius: 4 },
  relMeterCenter: { position: 'absolute', left: '50%', width: 2, height: 8, backgroundColor: T.yellow },
  relMeterLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  relMeterLbl: { color: T.textMute, fontSize: 10, fontWeight: '700' },
  relSubhead: { color: T.text, fontWeight: '900', fontSize: 12, paddingHorizontal: 6, marginTop: 4, marginBottom: 4 },
  relRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 8, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: T.border, gap: 8 },
  relLogo: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  relName: { color: T.text, fontWeight: '800', flex: 1, fontSize: 13 },
  relScore: { fontWeight: '900', fontSize: 13 },
  row: { flexDirection: 'row', gap: 6, padding: 8, justifyContent: 'space-around', flexWrap: 'wrap' },
  empty: { color: T.cardDark, padding: 16, fontStyle: 'italic' },
  franchiseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 8, marginHorizontal: 8, marginBottom: 6, borderRadius: 8, borderWidth: 1, borderColor: T.border },
  movieRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  icon: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  mTitle: { color: T.text, fontWeight: '800', fontSize: 14 },
  mSub: { color: T.textDim, fontSize: 11, marginTop: 1, fontWeight: '700' },
});
