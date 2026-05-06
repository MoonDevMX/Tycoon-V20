import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, NeonStat, SectionHeader } from '../src/ui/components';

function fmtSubs(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}

export default function StreamingHub() {
  const router = useRouter();
  const { state } = useGame();

  const playerServices = useMemo(() => state ? (state.streamingServices || []).filter(s => s.studioId === state.player.id) : [], [state]);
  const sortedServices = useMemo(() => {
    if (!state) return [];
    return (state.streamingServices || []).slice().sort((a, b) => b.subscribers - a.subscribers);
  }, [state]);

  if (!state) return null;

  const studioById = Object.fromEntries([state.player, ...state.rivals].map(st => [st.id, st]));
  const canLaunchMore = playerServices.length < 3;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Streaming Wars" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {playerServices.length > 0 ? (
          <View>
            <SectionHeader title={`Your Services · ${playerServices.length}/3`} />
            {playerServices.map((svc) => (
              <TouchableOpacity key={svc.id} style={s.heroCard} onPress={() => router.push(`/streaming/${svc.id}`)} testID={`player-service-${svc.id}`}>
                <View style={s.heroHeader}>
                  <View style={[s.logo, { backgroundColor: state.player.logoBg }]}>
                    <MaterialCommunityIcons name="play-circle" size={28} color={T.yellow} />
                  </View>
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <Text style={s.serviceName}>{svc.name}</Text>
                    <Text style={s.serviceSub}>{state.player.name} · {svc.tiers.length} tiers · {svc.catalogMovieIds.length} titles</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={28} color={T.textMute} />
                </View>
                <View style={s.heroStats}>
                  <NeonStat label="SUBSCRIBERS" value={fmtSubs(svc.subscribers)} color={T.cyan} />
                  <NeonStat label="REVENUE/MO" value={`${svc.monthlyRevenue.toFixed(2)}M`} color={T.green} />
                  <NeonStat label="REPUTATION" value={`${svc.reputation}/100`} color={T.yellow} />
                </View>
              </TouchableOpacity>
            ))}
            {canLaunchMore && (
              <TouchableOpacity style={s.addServiceBtn} onPress={() => router.push('/streaming/launch')} testID="add-service-btn">
                <MaterialCommunityIcons name="plus-circle" size={20} color={T.cyan} />
                <Text style={s.addServiceTxt}>Launch Another Service ({playerServices.length}/3)</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.launchPanel}>
            <View style={[s.logo, { backgroundColor: state.player.logoBg, marginBottom: 12 }]}>
              <MaterialCommunityIcons name="play-circle" size={36} color={T.yellow} />
            </View>
            <Text style={s.launchTitle}>Enter the streaming wars</Text>
            <Text style={s.launchBody}>Launch your own subscription service to monetize your catalog and reach audiences who skip cinemas.</Text>
            <View style={s.bullets}>
              <Bullet text="Own up to 3 streaming services" />
              <Bullet text="Set 1–4 subscription tiers (price, screens, profiles)" />
              <Bullet text="Your released movies stream for free" />
              <Bullet text="Subscribers grow weekly based on catalog & reputation" />
              <Bullet text="One-time launch cost: $200M per service" />
            </View>
            <TouchableOpacity style={s.cta} onPress={() => router.push('/streaming/launch')} testID="launch-btn">
              <MaterialCommunityIcons name="rocket-launch" size={20} color={T.cardDark} />
              <Text style={s.ctaTxt}>Launch Streaming Service</Text>
            </TouchableOpacity>
          </View>
        )}

        <SectionHeader title={`Industry Leaderboard · ${sortedServices.length}`} />
        {sortedServices.length === 0 ? (
          <Text style={s.empty}>No streaming services exist yet.</Text>
        ) : sortedServices.map((svc, idx) => {
          const studio = studioById[svc.studioId];
          const isMine = svc.studioId === state.player.id;
          return (
            <TouchableOpacity
              key={svc.id}
              style={[s.row, isMine && { borderColor: T.cyan, borderWidth: 2 }]}
              onPress={() => router.push(`/streaming/${svc.id}`)}
              testID={`svc-${svc.id}`}
            >
              <Text style={s.rank}>{idx + 1}</Text>
              <View style={[s.miniLogo, { backgroundColor: studio?.logoBg || T.cardDark }]}>
                <MaterialCommunityIcons name={(studio?.logoIcon as any) || 'play'} size={18} color={T.yellow} />
              </View>
              <View style={{ flex: 1, paddingLeft: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.svcName} numberOfLines={1}>{svc.name}</Text>
                  {isMine && <Text style={s.youTag}>YOU</Text>}
                </View>
                <Text style={s.svcSub} numberOfLines={1}>{studio?.name} · {svc.catalogMovieIds.length} titles · {svc.tiers.length} tiers</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.svcSubs}>{fmtSubs(svc.subscribers)}</Text>
                <Text style={s.svcRev}>${svc.monthlyRevenue.toFixed(1)}M/mo</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bullet}>
      <MaterialCommunityIcons name="check-circle" size={16} color={T.green} />
      <Text style={s.bulletTxt}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  heroCard: { backgroundColor: T.cardDark, marginHorizontal: 12, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: T.cyan },
  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, gap: 6 },
  logo: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border },
  serviceName: { color: T.text, fontSize: 20, fontWeight: '900' },
  serviceSub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  launchPanel: { backgroundColor: T.cardDark, margin: 12, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: T.border, alignItems: 'center' },
  launchTitle: { color: T.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  launchBody: { color: T.textDim, fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 12 },
  bullets: { alignSelf: 'stretch', marginTop: 14, gap: 6 },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletTxt: { color: T.text, fontSize: 13, flex: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.green, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, marginTop: 18, gap: 8, borderWidth: 2, borderColor: T.border, alignSelf: 'stretch' },
  ctaTxt: { color: T.cardDark, fontSize: 16, fontWeight: '900' },
  addServiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 12, marginTop: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: T.cyan, borderStyle: 'dashed' as any, gap: 6 },
  addServiceTxt: { color: T.cyan, fontWeight: '800', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderBottomWidth: 1, borderBottomColor: T.border, gap: 8 },
  rank: { color: T.textMute, fontSize: 16, fontWeight: '900', width: 24 },
  miniLogo: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  svcName: { color: T.text, fontWeight: '800', fontSize: 15, flexShrink: 1 },
  youTag: { color: T.cardDark, backgroundColor: T.cyan, fontSize: 9, fontWeight: '900', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  svcSub: { color: T.textDim, fontSize: 11, marginTop: 1 },
  svcSubs: { color: T.cyan, fontWeight: '900', fontSize: 14 },
  svcRev: { color: T.green, fontWeight: '700', fontSize: 11, marginTop: 2 },
  empty: { color: T.textMute, padding: 16, fontStyle: 'italic', textAlign: 'center' },
});
