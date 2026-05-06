import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useGame } from '../../src/game/state';
import { T } from '../../src/ui/theme';
import { TopBar, NeonStat, SectionHeader } from '../../src/ui/components';
import { calculateTalentExpectations } from '../../src/game/sim';
import { evaluateNegotiation, inferNegotiationStyle, NegotiationOutcome } from '../../src/game/data';

export default function NegotiateScreen() {
  const router = useRouter();
  const { talentId } = useLocalSearchParams<{ talentId: string }>();
  const { state, signNegotiated } = useGame();
  const [numMovies, setNumMovies] = useState(2);
  const [upfront, setUpfront] = useState(0);
  const [boPercent, setBoPercent] = useState(3);
  const [round, setRound] = useState(1);
  const [outcome, setOutcome] = useState<NegotiationOutcome | null>(null);

  if (!state) return null;
  const t = state.talents.find(x => x.id === talentId);

  const exp = useMemo(() => t ? calculateTalentExpectations(t, numMovies) : null, [t, numMovies]);

  // Initialize upfront once expectations are ready
  useEffect(() => {
    if (exp && upfront === 0) setUpfront(+(exp.minUpfront * 0.85).toFixed(1));
  }, [exp]);

  if (!t) return <SafeAreaView style={s.container}><TopBar title="Not found" onBack={() => router.back()} /></SafeAreaView>;
  const style = inferNegotiationStyle(t);

  if (!exp) return null;

  const contracted = t.underContract && t.underContract.studioId === state.player.id;
  const offer = { upfront: +upfront.toFixed(2), boPercent: +boPercent.toFixed(1), numMovies };
  const totalOfferValue = upfront + 150 * (boPercent / 100) * numMovies;
  const ratio = totalOfferValue / Math.max(1, exp.expectedTotal);

  const submit = () => {
    if (round > 3) { Alert.alert('Limit', '3 rounds maximum.'); return; }
    const r = evaluateNegotiation(t, offer, exp, round);
    setOutcome(r);
    if (r.kind === 'accept') {
      const res = signNegotiated(t.id, numMovies, upfront, boPercent);
      if (res.error) { Alert.alert('Error', res.error); return; }
      setRound(99);
    } else if (r.kind === 'reject_offended') {
      setRound(99);
    } else {
      setRound(round + 1);
    }
  };

  const acceptCounter = () => {
    if (!outcome?.counter) return;
    const c = outcome.counter;
    const res = signNegotiated(t.id, c.numMovies, c.upfront, c.boPercent);
    if (res.error) { Alert.alert('Error', res.error); return; }
    setOutcome({ kind: 'accept', reason: `"Done. Let's make movies."` });
    setRound(99);
  };

  const walkAway = () => { setOutcome({ kind: 'reject_offended', reason: 'You walked away.' }); setRound(99); };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Negotiate Contract" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <View style={[s.avatar, { backgroundColor: t.avatarColor }]}>
              <MaterialCommunityIcons name="account" size={48} color={t.hairColor} />
            </View>
            <View style={{ flex: 1, paddingLeft: 12 }}>
              <Text style={s.name}>{t.name}</Text>
              <Text style={s.role}>{t.role}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <NeonStat label="FAME" value={t.fame} color={T.pink} />
                <NeonStat label="SKILL" value={t.skill} color={T.cyan} />
              </View>
              <View style={[s.styleBadge, { borderColor: styleColor(style) }]}>
                <Text style={[s.styleBadgeT, { color: styleColor(style) }]}>{style.toUpperCase()} NEGOTIATOR</Text>
              </View>
            </View>
          </View>

          {contracted ? (
            <View style={[s.warning, { borderColor: T.green }]}>
              <MaterialCommunityIcons name="check-circle" size={20} color={T.green} />
              <Text style={[s.warnT, { color: T.green }]}>Already under contract with {state.player.name}{t.underContract?.remainingMovies ? ` · ${t.underContract.remainingMovies} films left` : ''}.</Text>
            </View>
          ) : null}

          <SectionHeader title="Contract Length" />
          <View style={s.kindRow}>
            {[1, 2, 3].map(n => (
              <TouchableOpacity key={n} onPress={() => setNumMovies(n)}
                style={[s.kindBtn, numMovies === n && { backgroundColor: T.yellow, borderColor: T.yellow }]}
                testID={`kind-${n}`}>
                <Text style={[s.kindT, numMovies === n && { color: T.cardDark }]}>{n} movie{n > 1 ? 's' : ''}</Text>
                <Text style={[s.kindSub, numMovies === n && { color: T.cardDark }]}>{n === 1 ? '100%' : n === 2 ? '90% bulk' : '80% bulk'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <SectionHeader title="Your Offer" />
          <View style={s.sliderBlock}>
            <View style={s.sliderRow}>
              <Text style={s.sliderLbl}>Upfront Payment</Text>
              <Text style={s.sliderVal}>${upfront.toFixed(1)}M</Text>
            </View>
            <Slider minimumValue={1} maximumValue={Math.max(80, exp.maxUpfront * 1.4)} value={upfront} step={0.5} onValueChange={setUpfront}
              minimumTrackTintColor={T.green} maximumTrackTintColor={T.border} thumbTintColor={T.cyan} testID="slider-upfront" />
          </View>
          <View style={s.sliderBlock}>
            <View style={s.sliderRow}>
              <Text style={s.sliderLbl}>Box Office %</Text>
              <Text style={s.sliderVal}>{boPercent.toFixed(1)}%</Text>
            </View>
            <Slider minimumValue={0} maximumValue={15} value={boPercent} step={0.5} onValueChange={setBoPercent}
              minimumTrackTintColor={T.magenta} maximumTrackTintColor={T.border} thumbTintColor={T.cyan} testID="slider-bo" />
          </View>

          <SectionHeader title="Talent's Expectations" />
          <View style={s.panel}>
            <Row label={`Min upfront (${style})`} value={`$${exp.minUpfront.toFixed(1)}M`} />
            <Row label="Max upfront they'd hold out for" value={`$${exp.maxUpfront.toFixed(1)}M`} />
            <Row label="Expected total value" value={`$${exp.expectedTotal.toFixed(1)}M`} />
            <Row label="BO % range" value={`${exp.minBoPercent}% – ${exp.maxBoPercent}%`} />
            <View style={s.sep} />
            <Row label="Your offer total value" value={`$${totalOfferValue.toFixed(1)}M`} bold />
            <Row label="Ratio vs expected" value={`${(ratio * 100).toFixed(0)}%`}
              color={ratio >= 1.0 ? T.green : ratio >= 0.82 ? T.yellow : '#E84545'} />
          </View>

          {outcome ? (
            <View style={[s.outcome, { borderColor: outcome.kind === 'accept' ? T.green : outcome.kind === 'counter' ? T.yellow : '#E84545' }]}>
              <Text style={[s.outcomeBadge, { color: outcome.kind === 'accept' ? T.green : outcome.kind === 'counter' ? T.yellow : '#E84545' }]}>
                {outcome.kind === 'accept' ? '✓ ACCEPTED' : outcome.kind === 'counter' ? '↩ COUNTER-OFFER' : '✗ REJECTED'}
              </Text>
              <Text style={s.outcomeTxt}>{outcome.reason}</Text>
              {outcome.counter ? (
                <View style={[s.panel, { marginTop: 8, borderColor: T.yellow }]}>
                  <Text style={s.counterHeader}>Their counter:</Text>
                  <Row label="Upfront" value={`$${outcome.counter.upfront.toFixed(1)}M`} bold color={T.yellow} />
                  <Row label="Box Office %" value={`${outcome.counter.boPercent.toFixed(1)}%`} color={T.yellow} />
                  <Row label="# Movies" value={`${outcome.counter.numMovies}`} color={T.yellow} />
                  <TouchableOpacity style={s.btnAccept} onPress={acceptCounter} testID="accept-counter">
                    <Text style={s.btnAcceptT}>ACCEPT THEIR COUNTER</Text>
                  </TouchableOpacity>
                  {round <= 3 ? <Text style={s.hint}>Adjust sliders and submit again (max 3 rounds).</Text> : null}
                  <TouchableOpacity style={s.btnWalk} onPress={walkAway} testID="walk-away">
                    <Text style={s.btnWalkT}>Walk Away</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}

          {!contracted && round <= 3 && (!outcome || outcome.kind === 'counter') ? (
            <TouchableOpacity style={[s.btnSubmit, outcome?.kind === 'counter' && { backgroundColor: T.cyan }]} onPress={submit} testID="submit-offer">
              <Text style={s.btnSubmitT}>{round === 1 ? 'SUBMIT OFFER' : `NEW COUNTER (ROUND ${round})`}</Text>
            </TouchableOpacity>
          ) : null}

          {contracted || outcome?.kind === 'accept' || outcome?.kind === 'reject_offended' ? (
            <TouchableOpacity style={[s.btnSubmit, { backgroundColor: outcome?.kind === 'reject_offended' ? T.cardDark : T.green, borderColor: T.border }]}
              onPress={() => router.back()}>
              <Text style={[s.btnSubmitT, outcome?.kind === 'reject_offended' && { color: T.text }]}>BACK TO TALENT</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowL}>{label}</Text>
      <Text style={[s.rowV, bold && { fontWeight: '900' }, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function styleColor(style: string): string {
  if (style === 'tough') return '#FF8C42';
  if (style === 'diva') return T.magenta;
  if (style === 'generous') return T.green;
  return T.cyan;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', backgroundColor: T.cardDark, padding: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border },
  name: { color: T.text, fontSize: 20, fontWeight: '900' },
  role: { color: T.textDim, fontSize: 13, fontStyle: 'italic', textTransform: 'capitalize' },
  styleBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 2, backgroundColor: T.cardDark },
  styleBadgeT: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.cardDark, margin: 12, padding: 10, borderRadius: 8, borderWidth: 2 },
  warnT: { fontSize: 12, fontWeight: '700', flex: 1 },
  kindRow: { flexDirection: 'row', gap: 6, padding: 12 },
  kindBtn: { flex: 1, backgroundColor: T.cardDark, padding: 12, borderRadius: 8, borderWidth: 2, borderColor: T.border, alignItems: 'center' },
  kindT: { color: T.text, fontWeight: '800', fontSize: 13 },
  kindSub: { color: T.textDim, fontSize: 11, marginTop: 2 },
  sliderBlock: { backgroundColor: T.cardDark, marginHorizontal: 12, padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: T.border },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLbl: { color: T.text, fontWeight: '800', fontSize: 13 },
  sliderVal: { color: T.green, fontWeight: '900', fontSize: 16 },
  panel: { backgroundColor: T.cardDark, marginHorizontal: 12, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: T.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowL: { color: T.textDim, fontSize: 13 },
  rowV: { color: T.text, fontWeight: '800', fontSize: 13 },
  sep: { height: 1, backgroundColor: T.border, marginVertical: 6 },
  outcome: { marginHorizontal: 12, marginTop: 12, padding: 12, backgroundColor: T.cardDark, borderRadius: 10, borderWidth: 2 },
  outcomeBadge: { fontWeight: '900', letterSpacing: 1, fontSize: 13 },
  outcomeTxt: { color: T.text, fontStyle: 'italic', marginTop: 6 },
  counterHeader: { color: T.yellow, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  hint: { color: T.textDim, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  btnAccept: { backgroundColor: T.green, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', marginTop: 6, borderWidth: 2, borderColor: T.border },
  btnAcceptT: { color: T.cardDark, fontWeight: '900', fontSize: 13 },
  btnWalk: { marginTop: 8, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#E84545' },
  btnWalkT: { color: '#E84545', fontWeight: '800' },
  btnSubmit: { marginHorizontal: 12, marginTop: 14, backgroundColor: T.green, padding: 16, borderRadius: 10, alignItems: 'center', borderWidth: 3, borderColor: T.border },
  btnSubmitT: { color: T.cardDark, fontWeight: '900', letterSpacing: 1, fontSize: 15 },
});
