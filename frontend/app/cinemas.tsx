import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, NeonStat, SectionHeader } from '../src/ui/components';
import { uiAlert } from '../src/ui/ui-alert';
import { CINEMA_CHAINS, CINEMA_REGIONS, cinemaDealRange } from '../src/game/data';

export default function CinemasScreen() {
  const router = useRouter();
  const { state, signCinemaDeal } = useGame();
  const [chainId, setChainId] = useState<string | null>(null);
  const [years, setYears] = useState(7);
  const [openShare, setOpenShare] = useState('');
  const [lateShare, setLateShare] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ kind: 'ok' | 'err' | 'counter'; text: string } | null>(null);
  const [chainCounter, setChainCounter] = useState<{ openShare: number; lateShare: number; years: number; reason: string } | null>(null);
  const [round, setRound] = useState(1);

  if (!state) return null;
  const playerDeals = (state.cinemaDeals || []).filter(d => d.studioId === state.player.id);

  const openModal = (id: string) => {
    const chain = CINEMA_CHAINS.find(c => c.id === id);
    if (!chain) return;
    const range = cinemaDealRange(chain.reputation, state.player.rating);
    setChainId(id);
    setYears(7);
    setOpenShare(((range.minOpen + range.maxOpen) / 2).toFixed(2));
    setLateShare(((range.minLate + range.maxLate) / 2).toFixed(2));
    setStatusMsg(null);
    setChainCounter(null);
    setRound(1);
  };

  const submitDeal = () => {
    if (!chainId) return;
    const o = parseFloat(openShare); const l = parseFloat(lateShare);
    if (isNaN(o) || isNaN(l)) { setStatusMsg({ kind: 'err', text: 'Enter both shares as decimals (e.g., 0.65).' }); uiAlert('Invalid', 'Enter both shares as decimals (e.g., 0.65).'); return; }
    const r = signCinemaDeal(chainId, years, o, l);
    if (r.error) {
      const text = `❌ ${r.error}`;
      setStatusMsg({ kind: 'err', text });
      uiAlert('Negotiation Failed', r.error);
      return;
    }
    if (r.counter) {
      // Chain pushed back — show counter and let player accept/re-counter/walk.
      setChainCounter(r.counter);
      setRound(round + 1);
      setStatusMsg({ kind: 'counter', text: `🤝 Round ${round}: ${CINEMA_CHAINS.find(c => c.id === chainId)?.name} counters — opening ${(r.counter.openShare * 100).toFixed(0)}% / late ${(r.counter.lateShare * 100).toFixed(0)}% (${r.counter.reason}).` });
      return;
    }
    const chainName = CINEMA_CHAINS.find(c => c.id === chainId)?.name || 'this chain';
    const ok = `✅ Deal signed with ${chainName} for ${years} years.`;
    setStatusMsg({ kind: 'ok', text: ok });
    uiAlert('Cinema Deal Signed ✓', `Welcome to the ${chainName} circuit. ${years}-year term locked in.`);
    setTimeout(() => { setChainId(null); setStatusMsg(null); setChainCounter(null); setRound(1); }, 900);
  };

  const acceptCounter = () => {
    if (!chainId || !chainCounter) return;
    const r = signCinemaDeal(chainId, chainCounter.years, chainCounter.openShare, chainCounter.lateShare);
    if (r.error) { setStatusMsg({ kind: 'err', text: `❌ ${r.error}` }); return; }
    if (r.counter) {
      // Chain still wants more — should be rare since we're accepting their terms verbatim, but handle gracefully.
      setChainCounter(r.counter);
      setStatusMsg({ kind: 'counter', text: `Round ${round + 1}: ${CINEMA_CHAINS.find(c => c.id === chainId)?.name} counter ${(r.counter.openShare * 100).toFixed(0)}% / ${(r.counter.lateShare * 100).toFixed(0)}%` });
      setRound(round + 1);
      return;
    }
    const chainName = CINEMA_CHAINS.find(c => c.id === chainId)?.name || 'this chain';
    setStatusMsg({ kind: 'ok', text: `✅ Counter accepted — ${chainName} signed for ${chainCounter.years} years.` });
    uiAlert('Cinema Deal Signed ✓', `${chainName} circuit. ${chainCounter.years}-year term.`);
    setTimeout(() => { setChainId(null); setStatusMsg(null); setChainCounter(null); setRound(1); }, 900);
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Cinema Distribution" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        <View style={s.intro}>
          <MaterialCommunityIcons name="theater" size={28} color={T.cyan} />
          <Text style={s.introTxt}>Cinema deals share box office. Opening weeks favour studios; later weeks shift to cinemas.</Text>
        </View>

        {playerDeals.length > 0 ? (
          <>
            <SectionHeader title="Active Deals" />
            {playerDeals.map(d => {
              const chain = CINEMA_CHAINS.find(c => c.id === d.chainId);
              return (
                <View key={d.id} style={s.dealCard}>
                  <Text style={s.chainName}>{chain?.name || '—'}</Text>
                  <Text style={s.chainSub}>{d.region} · {d.years}-year term · {d.guaranteedTheaters.toLocaleString()} theaters guaranteed</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <NeonStat label="OPENING%" value={`${(d.openingStudioShare * 100).toFixed(0)}%`} color={T.green} />
                    <NeonStat label="LATE%" value={`${(d.lateStudioShare * 100).toFixed(0)}%`} color={T.yellow} />
                    <NeonStat label="EXPIRES" value={`Y${d.expiresYear}`} color={T.orange} />
                  </View>
                </View>
              );
            })}
          </>
        ) : null}

        <SectionHeader title="Available Chains" />
        {CINEMA_REGIONS.map(region => {
          const chains = CINEMA_CHAINS.filter(c => c.region === region);
          return (
            <View key={region} style={{ marginTop: 6 }}>
              <Text style={s.regionLbl}>{region}</Text>
              {chains.map(chain => {
                const existing = playerDeals.find(d => d.chainId === chain.id);
                return (
                  <TouchableOpacity
                    key={chain.id}
                    style={[s.chainRow, existing && { borderColor: T.green }]}
                    onPress={() => existing ? uiAlert('Already signed', `Active deal with ${chain.name}.`) : openModal(chain.id)}
                    testID={`chain-${chain.id}`}>
                    <MaterialCommunityIcons name="theater" size={22} color={existing ? T.green : T.cyan} />
                    <View style={{ flex: 1, paddingHorizontal: 8 }}>
                      <Text style={s.chainName}>{chain.name}</Text>
                      <Text style={s.chainSub}>{chain.theaters.toLocaleString()} theaters · Reputation {chain.reputation}/100{existing ? ' · ACTIVE' : ''}</Text>
                    </View>
                    <MaterialCommunityIcons name={existing ? 'check-circle' : 'chevron-right'} size={22} color={existing ? T.green : T.textDim} />
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!chainId} transparent animationType="slide" onRequestClose={() => setChainId(null)}>
        {chainId ? (() => {
          const chain = CINEMA_CHAINS.find(c => c.id === chainId);
          if (!chain) return <View />;
          const range = cinemaDealRange(chain.reputation, state.player.rating);
          return (
            <View style={s.modalBg}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>{chain.name}</Text>
                <Text style={s.modalSub}>{chain.region} · {chain.theaters.toLocaleString()} theaters · Rep {chain.reputation}</Text>

                <Text style={s.fieldLbl}>YEARS (5–10)</Text>
                <View style={s.yearsRow}>
                  {[5, 7, 10].map(y => (
                    <TouchableOpacity key={y} style={[s.yearChip, years === y && { backgroundColor: T.cyan }]} onPress={() => setYears(y)} testID={`years-${y}`}>
                      <Text style={[s.yearTxt, years === y && { color: T.cardDark }]}>{y}y</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.fieldLbl}>OPENING WEEK STUDIO % (range {(range.minOpen * 100).toFixed(0)}–{(range.maxOpen * 100).toFixed(0)}%)</Text>
                <TextInput value={openShare} onChangeText={setOpenShare} keyboardType="decimal-pad" style={s.inp} placeholder="e.g. 0.68" placeholderTextColor={T.textMute} testID="open-share-input" />

                <Text style={s.fieldLbl}>LATE WEEK STUDIO % (range {(range.minLate * 100).toFixed(0)}–{(range.maxLate * 100).toFixed(0)}%)</Text>
                <TextInput value={lateShare} onChangeText={setLateShare} keyboardType="decimal-pad" style={s.inp} placeholder="e.g. 0.42" placeholderTextColor={T.textMute} testID="late-share-input" />

                <Text style={s.modalHint}>Higher % = more revenue but harder to sign. Stay near midpoint to be safe.</Text>

                {statusMsg ? (
                  <View style={[s.statusBox, statusMsg.kind === 'ok' ? { borderColor: T.green, backgroundColor: T.green + '22' } : statusMsg.kind === 'counter' ? { borderColor: T.yellow, backgroundColor: T.yellow + '22' } : { borderColor: '#E84545', backgroundColor: '#E8454522' }]} testID="cinema-status">
                    <Text style={[s.statusTxt, statusMsg.kind === 'ok' ? { color: T.green } : statusMsg.kind === 'counter' ? { color: T.yellow } : { color: '#E84545' }]}>{statusMsg.text}</Text>
                  </View>
                ) : null}

                {chainCounter ? (
                  <View style={s.counterBox}>
                    <Text style={s.counterTitle}>CHAIN COUNTER OFFER</Text>
                    <Text style={s.counterTxt}>Opening: {(chainCounter.openShare * 100).toFixed(0)}%  ·  Late: {(chainCounter.lateShare * 100).toFixed(0)}%  ·  {chainCounter.years}y</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity style={[s.counterBtn, { backgroundColor: T.green }]} onPress={acceptCounter} testID="accept-counter-btn">
                        <Text style={[s.counterBtnTxt, { color: T.cardDark }]}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.counterBtn, { backgroundColor: T.cyan }]}
                        onPress={() => { setOpenShare(chainCounter.openShare.toFixed(2)); setLateShare(chainCounter.lateShare.toFixed(2)); setChainCounter(null); }}
                        testID="counter-again-btn">
                        <Text style={[s.counterBtnTxt, { color: T.cardDark }]}>Counter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.counterBtn, { backgroundColor: T.card }]} onPress={() => setChainId(null)} testID="walk-away-btn">
                        <Text style={[s.counterBtnTxt, { color: T.text }]}>Walk Away</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity style={s.signBtn} onPress={submitDeal} testID="sign-deal-btn">
                  <MaterialCommunityIcons name="handshake" size={20} color={T.cardDark} />
                  <Text style={s.signTxt}>{round === 1 ? 'NEGOTIATE & SIGN' : `RE-SUBMIT (Round ${round})`}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setChainId(null)}>
                  <Text style={s.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })() : <View />}
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  intro: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 12, borderRadius: 10, gap: 10, borderWidth: 2, borderColor: T.cyan },
  introTxt: { color: T.text, fontSize: 12, flex: 1 },
  dealCard: { backgroundColor: T.cardDark, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 2, borderColor: T.green },
  chainRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderRadius: 8, marginBottom: 6, borderWidth: 2, borderColor: T.border },
  chainName: { color: T.text, fontWeight: '800', fontSize: 14 },
  chainSub: { color: T.textDim, fontSize: 11, marginTop: 2 },
  regionLbl: { color: T.cyan, fontWeight: '900', fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#4d5058', padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: T.border },
  modalTitle: { color: T.text, fontSize: 22, fontWeight: '900' },
  modalSub: { color: T.cyan, fontSize: 13, fontWeight: '700', marginTop: 4 },
  fieldLbl: { color: T.yellow, marginTop: 12, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  yearsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  yearChip: { backgroundColor: T.cardDark, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: T.border },
  yearTxt: { color: T.text, fontWeight: '900' },
  inp: { backgroundColor: T.cardDark, color: T.text, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2, borderColor: T.border, marginTop: 6, fontSize: 16, fontWeight: '800' },
  modalHint: { color: T.textDim, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  statusBox: { padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 2 },
  statusTxt: { fontWeight: '900', fontSize: 13, textAlign: 'center' },
  counterBox: { backgroundColor: T.cardDark, padding: 12, borderRadius: 10, marginTop: 10, borderWidth: 2, borderColor: T.yellow },
  counterTitle: { color: T.yellow, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  counterTxt: { color: T.text, fontWeight: '700', fontSize: 13, marginTop: 4 },
  counterBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: T.border },
  counterBtnTxt: { fontWeight: '900', fontSize: 12 },
  signBtn: { flexDirection: 'row', backgroundColor: T.green, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6, borderWidth: 2, borderColor: T.border },
  signTxt: { color: T.cardDark, fontWeight: '900' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelTxt: { color: T.textDim, fontWeight: '700' },
});
