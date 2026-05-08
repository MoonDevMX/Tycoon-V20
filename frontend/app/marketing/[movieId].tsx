import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../../src/game/state';
import { T } from '../../src/ui/theme';
import { TopBar, IconTile } from '../../src/ui/components';
import { MARKETING_CHANNELS, ageWeightsForSegment, computeMarketingEfficiency, AgeBand } from '../../src/game/marketing';

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export default function MarketingAlloc() {
  const router = useRouter();
  const { movieId } = useLocalSearchParams<{ movieId: string }>();
  const { state, setMarketingAllocation } = useGame();
  const [alloc, setAlloc] = useState<Record<string, number>>({});

  const movie = useMemo(() => state?.movies.find(m => m.id === movieId), [state, movieId]);

  useEffect(() => {
    if (movie) {
      // Init from saved allocation OR even split across all channels
      if (movie.marketingAllocation) {
        setAlloc({ ...movie.marketingAllocation });
      } else {
        // Suggest a sensible default: spread across mass channels
        const def: Record<string, number> = {};
        const defaults = ['network_tv', 'cable', 'internet', 'trailers_medium', 'billboards', 'radio'];
        const each = movie.marketingBudget / defaults.length;
        defaults.forEach(k => { def[k] = +each.toFixed(2); });
        setAlloc(def);
      }
    }
  }, [movie?.id]);

  const totalAlloc = Object.values(alloc).reduce((a, b) => a + (b || 0), 0);
  const remaining = movie ? +(movie.marketingBudget - totalAlloc).toFixed(2) : 0;
  const efficiency = computeMarketingEfficiency(alloc, state?.audience || []);
  const efficiencyPct = ((efficiency - 1) * 100).toFixed(1);

  // Age band breakdown: weighted reach by audience composition (always called — pre-return)
  const reachByAge = useMemo(() => {
    const totals: Record<AgeBand, number> = { young: 0, adult: 0, mid: 0, senior: 0 };
    if (!state) return totals;
    state.audience.forEach(seg => {
      const w = ageWeightsForSegment(seg.label);
      MARKETING_CHANNELS.forEach(ch => {
        const spent = alloc[ch.key] || 0;
        if (spent <= 0) return;
        (Object.keys(ch.reach) as AgeBand[]).forEach(ab => {
          totals[ab] += w[ab] * ch.reach[ab] * spent * ch.costEfficiency * seg.share;
        });
      });
    });
    return totals;
  }, [alloc, state?.audience]);

  if (!state) return null;
  if (!movie) return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Marketing" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <Text style={s.empty}>Movie not found.</Text>
    </SafeAreaView>
  );

  const maxReach = Math.max(0.01, ...Object.values(reachByAge));

  const adjust = (key: string, delta: number) => {
    setAlloc(prev => {
      const cur = prev[key] || 0;
      const next = Math.max(0, +(cur + delta).toFixed(1));
      return { ...prev, [key]: next };
    });
  };

  const save = () => {
    if (totalAlloc > movie.marketingBudget + 0.01) {
      notify('Over budget', `Total $${totalAlloc.toFixed(1)}M exceeds budget $${movie.marketingBudget}M.`);
      return;
    }
    const r = setMarketingAllocation(movie.id, alloc);
    if (r.error) notify('Cannot save', r.error);
    else { notify('Saved', `Marketing plan stored. Efficiency: ${efficiency >= 1 ? '+' : ''}${efficiencyPct}%`); router.back(); }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Marketing Plan" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 100 }}>
        {/* Header card */}
        <View style={s.header}>
          <IconTile icon={movie.iconKey} color={movie.iconBg} size={56} />
          <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <Text style={s.title} numberOfLines={1}>{movie.title}</Text>
            <Text style={s.sub}>{movie.brand} · {movie.genre} · Budget ${movie.marketingBudget}M</Text>
          </View>
        </View>

        {/* Summary panel */}
        <View style={s.summary}>
          <View style={s.sumRow}>
            <Text style={s.sumLbl}>ALLOCATED</Text>
            <Text style={[s.sumVal, totalAlloc > movie.marketingBudget && { color: T.red }]}>
              ${totalAlloc.toFixed(1)}M / ${movie.marketingBudget}M
            </Text>
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumLbl}>REMAINING</Text>
            <Text style={[s.sumVal, { color: remaining >= 0 ? T.green : T.red }]}>${remaining.toFixed(1)}M</Text>
          </View>
          <View style={s.sumRow}>
            <Text style={s.sumLbl}>EFFICIENCY</Text>
            <Text style={[s.sumVal, { color: efficiency >= 1.05 ? T.green : efficiency >= 0.95 ? T.cyan : T.orange }]}>
              {efficiency >= 1 ? '+' : ''}{efficiencyPct}% Opening BO
            </Text>
          </View>
        </View>

        {/* Age band reach */}
        <Text style={s.sectionTitle}>Reach by Age Band</Text>
        <View style={s.ageBlock}>
          {([
            { k: 'young' as AgeBand, label: '18-29' },
            { k: 'adult' as AgeBand, label: '30-39' },
            { k: 'mid' as AgeBand, label: '40-59' },
            { k: 'senior' as AgeBand, label: '60+' },
          ]).map(ab => {
            const pct = (reachByAge[ab.k] / maxReach) * 100;
            return (
              <View key={ab.k} style={s.ageRow}>
                <Text style={s.ageLbl}>{ab.label}</Text>
                <View style={s.ageBar}>
                  <View style={[s.ageFill, { width: `${pct}%` }]} />
                </View>
                <Text style={s.ageVal}>{reachByAge[ab.k].toFixed(1)}</Text>
              </View>
            );
          })}
        </View>

        {/* Channels */}
        <Text style={s.sectionTitle}>Marketing Channels</Text>
        {MARKETING_CHANNELS.map(ch => {
          const spent = alloc[ch.key] || 0;
          return (
            <View key={ch.key} style={[s.chRow, spent > 0 && { borderColor: T.cyan }]}>
              <MaterialCommunityIcons name={ch.icon as any} size={26} color={spent > 0 ? T.cyan : T.textMute} />
              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <Text style={s.chLbl}>{ch.label}</Text>
                <Text style={s.chDesc}>{ch.desc}</Text>
                <View style={s.miniReachRow}>
                  {(['young', 'adult', 'mid', 'senior'] as AgeBand[]).map(ab => (
                    <View key={ab} style={[s.miniReachDot, { opacity: ch.reach[ab] }]}>
                      <Text style={s.miniReachT}>{ab === 'young' ? '18-29' : ab === 'adult' ? '30-39' : ab === 'mid' ? '40-59' : '60+'}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={s.chControls}>
                <TouchableOpacity style={s.chBtn} onPress={() => adjust(ch.key, -1)} disabled={spent <= 0} testID={`ch-${ch.key}-dec`}>
                  <MaterialCommunityIcons name="minus" size={16} color={spent > 0 ? T.text : T.textMute} />
                </TouchableOpacity>
                <Text style={s.chSpent}>${spent.toFixed(1)}M</Text>
                <TouchableOpacity style={s.chBtn} onPress={() => adjust(ch.key, +1)} disabled={remaining < 1} testID={`ch-${ch.key}-inc`}>
                  <MaterialCommunityIcons name="plus" size={16} color={remaining >= 1 ? T.green : T.textMute} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={[s.saveBtn, totalAlloc > movie.marketingBudget && { opacity: 0.5 }]}
          onPress={save} disabled={totalAlloc > movie.marketingBudget} testID="save-marketing-btn">
          <Text style={s.saveTxt}>SAVE MARKETING PLAN</Text>
        </TouchableOpacity>
        <Text style={s.note}>Higher efficiency = more opening box office. Channels matched to your audience age mix yield up to +15% opening.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  empty: { color: T.textMute, padding: 24, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: T.border, marginBottom: 10 },
  title: { color: T.text, fontWeight: '900', fontSize: 16 },
  sub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  summary: { backgroundColor: T.cardDark, padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 2, borderColor: T.border, gap: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sumLbl: { color: T.textDim, fontWeight: '800', fontSize: 11 },
  sumVal: { color: T.text, fontWeight: '900', fontSize: 14 },
  sectionTitle: { color: T.cyan, fontWeight: '900', fontSize: 13, marginTop: 14, marginBottom: 6, letterSpacing: 1 },
  ageBlock: { backgroundColor: T.cardDark, padding: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: T.border },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ageLbl: { color: T.text, fontSize: 12, fontWeight: '700', width: 50 },
  ageBar: { flex: 1, height: 10, backgroundColor: T.bg, borderRadius: 5, overflow: 'hidden' },
  ageFill: { height: '100%', backgroundColor: T.magenta, borderRadius: 5 },
  ageVal: { color: T.textDim, fontSize: 11, fontWeight: '700', minWidth: 36, textAlign: 'right' },
  chRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderRadius: 10, marginBottom: 6, borderWidth: 2, borderColor: T.border },
  chLbl: { color: T.text, fontWeight: '900', fontSize: 13 },
  chDesc: { color: T.textDim, fontSize: 11, marginTop: 2 },
  miniReachRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  miniReachDot: { backgroundColor: T.magenta, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  miniReachT: { color: T.cardDark, fontSize: 8, fontWeight: '900' },
  chControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
  chSpent: { color: T.text, fontWeight: '900', fontSize: 12, minWidth: 50, textAlign: 'center' },
  saveBtn: { backgroundColor: T.green, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 14, borderWidth: 2, borderColor: T.border },
  saveTxt: { color: T.cardDark, fontWeight: '900', fontSize: 15 },
  note: { color: T.textDim, fontSize: 11, textAlign: 'center', padding: 12, fontStyle: 'italic' },
});
