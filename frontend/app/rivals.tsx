import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar } from '../src/ui/components';
import { NegotiationModal } from '../src/ui/NegotiationModal';
import { uiAlert } from '../src/ui/ui-alert';
import { getRel, relLabel } from '../src/game/data';

export default function Rivals() {
  const router = useRouter();
  const { state, signBulkLicenseDeal, quoteBulkLicenseDeal, proposeBulkCatalogLicense, acceptBulkCatalogOffer, counterBulkCatalogOffer, rejectBulkCatalogOffer, quoteBulkCatalogValue } = useGame();
  const [bulkRivalId, setBulkRivalId] = useState<string | null>(null);
  const [bulkSvcId, setBulkSvcId] = useState<string | null>(null);
  const [bulkMovies, setBulkMovies] = useState('5');
  const [bulkYears, setBulkYears] = useState('2');
  const [activeCatalogId, setActiveCatalogId] = useState<string | null>(null);
  if (!state) return null;

  const playerSvcs = (state.streamingServices || []).filter(svc => svc.studioId === state.player.id);
  const sortedRivals = [...state.rivals].sort((a, b) => {
    const sa = getRel(state.relationships, state.player.id, a.id);
    const sb = getRel(state.relationships, state.player.id, b.id);
    return sb - sa;
  });

  const openBulk = (rivalId: string) => {
    if (playerSvcs.length === 0) {
      uiAlert('No Streaming Service', 'Launch your own streaming service first to sign bulk licensing deals.');
      return;
    }
    setBulkRivalId(rivalId);
    setBulkSvcId(playerSvcs[0].id);
    setBulkMovies('5');
    setBulkYears('2');
  };

  const submitBulk = () => {
    if (!bulkRivalId || !bulkSvcId) return;
    const m = parseInt(bulkMovies, 10) || 0;
    const y = parseInt(bulkYears, 10) || 0;
    if (m < 1 || m > 50) { uiAlert('Invalid', 'Movies must be 1–50.'); return; }
    if (y < 1 || y > 10) { uiAlert('Invalid', 'Years must be 1–10.'); return; }
    const r = signBulkLicenseDeal({ rivalStudioId: bulkRivalId, serviceId: bulkSvcId, movieCount: m, years: y });
    if (r.error) { uiAlert('Deal Failed', r.error); return; }
    uiAlert('Bulk License Signed ✓', `Paid $${r.feeM?.toFixed(1)}M for ${m} of their next films over ${y} years.`);
    setBulkRivalId(null);
  };

  const liveQuote = bulkRivalId && bulkSvcId ? quoteBulkLicenseDeal({
    rivalStudioId: bulkRivalId, serviceId: bulkSvcId,
    movieCount: parseInt(bulkMovies, 10) || 0,
    years: parseInt(bulkYears, 10) || 0,
  }) : null;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title={`Rival Studios · ${state.rivals.length}`} onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <FlatList
        data={sortedRivals}
        keyExtractor={r => r.id}
        contentContainerStyle={{ padding: 12 }}
        initialNumToRender={8}
        renderItem={({ item: r }) => {
          const fr = state.franchises.filter(f => f.studioId === r.id);
          const score = getRel(state.relationships, state.player.id, r.id);
          const lbl = relLabel(score);
          // Active bulk deals between player and this rival
          const activeBulks = playerSvcs.flatMap(svc => (svc.bulkLicenseDeals || []).filter(d => d.rivalStudioId === r.id && (d.expiresYear * 48 + d.expiresWeek) >= (state.year * 48 + state.week)).map(d => ({ d, svcName: svc.name })));
          return (
            <View style={s.card}>
              <TouchableOpacity style={s.row} onPress={() => router.push(`/studio/${r.id}`)} testID={`rival-${r.id}`}>
                <View style={[s.logo, { backgroundColor: r.logoBg }]}>
                  <MaterialCommunityIcons name={r.logoIcon as any} size={32} color={T.yellow} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.title} numberOfLines={1}>{r.name}</Text>
                    <View style={[s.relPill, { backgroundColor: lbl.color + '22', borderColor: lbl.color }]}>
                      <View style={[s.relDot, { backgroundColor: lbl.color }]} />
                      <Text style={[s.relTxt, { color: lbl.color }]}>{lbl.descriptor}</Text>
                    </View>
                  </View>
                  <Text style={s.sub}>★ {r.rating} · {r.releases} releases · {r.totalBO.toFixed(0)}B career</Text>
                  <Text style={s.subDim}>{score >= 0 ? '+' : ''}{score} relationship · {fr.length} franchises</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={T.textMute} />
              </TouchableOpacity>

              {/* Bulk License action */}
              <TouchableOpacity style={s.bulkBtn} onPress={() => openBulk(r.id)} testID={`bulk-license-${r.id}`}>
                <MaterialCommunityIcons name="cash-multiple" size={16} color={T.yellow} />
                <Text style={s.bulkTxt}>Bulk-License Future Releases</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.bulkBtn, { borderColor: T.magenta, marginTop: 6 }]}
                onPress={() => {
                  if (playerSvcs.length === 0) { uiAlert('No Streaming Service', 'Launch your own streaming service first.'); return; }
                  const released = state.movies.filter(m => m.studioId === r.id && m.status === 'released');
                  if (released.length < 3) { uiAlert('Not Enough Catalog', `${r.name} has too few released titles for a bulk pack.`); return; }
                  const picks = [...released].sort((a, b) => (b.releaseYear * 100 + b.releaseWeek) - (a.releaseYear * 100 + a.releaseWeek)).slice(0, Math.min(5, released.length));
                  const years = 3;
                  const fair = quoteBulkCatalogValue(picks.map(m => m.id), years);
                  const opening = +(fair * 0.85).toFixed(3);
                  const result = proposeBulkCatalogLicense({ toRivalStudioId: r.id, movieIds: picks.map(m => m.id), priceB: opening, years, serviceId: playerSvcs[0].id });
                  if (result.error) { uiAlert('Failed', result.error); return; }
                  if (result.offerId) setActiveCatalogId(result.offerId);
                }}
                testID={`bulk-catalog-${r.id}`}
              >
                <MaterialCommunityIcons name="package-variant" size={16} color={T.magenta} />
                <Text style={[s.bulkTxt, { color: T.magenta }]}>Bulk Catalog Pack (Existing Films)</Text>
              </TouchableOpacity>
              {activeBulks.length > 0 && activeBulks.map((ab, i) => (
                <View key={i} style={s.activeBulkRow}>
                  <Text style={s.activeBulkTxt}>📋 {ab.svcName}: {ab.d.movieCountTotal - ab.d.moviesUsed} films left · expires Y{ab.d.expiresYear}</Text>
                </View>
              ))}

              {fr.length > 0 && (
                <View style={s.fr}>
                  <Text style={s.frHeader}>Franchises (tap to license a crossover)</Text>
                  {fr.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={s.frRow}
                      onPress={() => router.push(`/franchise/${f.id}`)}
                      testID={`rival-fr-${f.id}`}
                    >
                      <View style={[s.miniIcon, { backgroundColor: f.iconBg }]}>
                        <MaterialCommunityIcons name={f.iconKey as any} size={18} color="#fff" />
                      </View>
                      <Text style={s.frName} numberOfLines={1}>{f.name}</Text>
                      <Text style={s.frPop}>pop {f.popularity}</Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={T.textMute} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />

      <Modal visible={!!bulkRivalId} transparent animationType="slide" onRequestClose={() => setBulkRivalId(null)}>
        {bulkRivalId ? (() => {
          const rival = state.rivals.find(r => r.id === bulkRivalId);
          if (!rival) return <View />;
          return (
            <View style={s.modalBg}>
              <View style={s.modalCard}>
                <Text style={s.modalTitle}>Bulk License — {rival.name}</Text>
                <Text style={s.modalSub}>Pay upfront. Future releases auto-stream on YOUR service until quota or term expires.</Text>

                <Text style={s.fieldLbl}>YOUR SERVICE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {playerSvcs.map(svc => (
                    <TouchableOpacity key={svc.id} style={[s.chip, bulkSvcId === svc.id && { backgroundColor: T.cyan, borderColor: T.cyan }]} onPress={() => setBulkSvcId(svc.id)}>
                      <Text style={[s.chipTxt, bulkSvcId === svc.id && { color: T.cardDark }]}>{svc.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={s.fieldLbl}>NUMBER OF MOVIES (1–50)</Text>
                <TextInput value={bulkMovies} onChangeText={(v) => setBulkMovies(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" maxLength={2} style={s.inp} testID="bulk-movies-input" />

                <Text style={s.fieldLbl}>YEARS (1–10)</Text>
                <TextInput value={bulkYears} onChangeText={(v) => setBulkYears(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" maxLength={2} style={s.inp} testID="bulk-years-input" />

                {liveQuote && !liveQuote.error ? (
                  <View style={s.quoteBox}>
                    <Text style={s.quoteLbl}>UPFRONT FEE</Text>
                    <Text style={s.quoteVal}>${liveQuote.feeM.toFixed(1)}M</Text>
                    <Text style={s.quoteSub}>Cash on hand: ${(state.player.cash * 1000).toFixed(0)}M</Text>
                  </View>
                ) : null}

                <TouchableOpacity style={s.signBtn} onPress={submitBulk} testID="bulk-sign-btn">
                  <MaterialCommunityIcons name="handshake" size={20} color={T.cardDark} />
                  <Text style={s.signTxt}>SIGN DEAL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setBulkRivalId(null)}>
                  <Text style={s.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })() : <View />}
      </Modal>

      {/* Bulk catalog negotiation (player → rival, existing films) */}
      {(() => {
        const liveCatalog = activeCatalogId ? (state.bulkCatalogOffers || []).find(o => o.id === activeCatalogId && o.status === 'pending') : null;
        if (!liveCatalog) return null;
        const playerActor: 'from' | 'to' = liveCatalog.fromStudioId === state.player.id ? 'from' : 'to';
        const used = liveCatalog.history.filter(h => h.actor === playerActor).length;
        const playerSide: 'buyer' | 'seller' = liveCatalog.fromStudioId === state.player.id ? 'buyer' : 'seller';
        return (
          <NegotiationModal
            visible={!!liveCatalog}
            subjectTitle={`${liveCatalog.movieIds.length}-title catalog pack`}
            subtitle={`${liveCatalog.years}-year license`}
            currentPriceB={liveCatalog.priceB}
            fairValueB={quoteBulkCatalogValue(liveCatalog.movieIds, liveCatalog.years)}
            playerSide={playerSide}
            roundsLeft={Math.max(0, liveCatalog.maxRounds - used)}
            message={liveCatalog.message}
            history={liveCatalog.history}
            onAccept={() => {
              const r = acceptBulkCatalogOffer(liveCatalog.id);
              if (r.error) { uiAlert('Failed', r.error); return; }
              uiAlert('Pack Closed ✓', `Settled at $${liveCatalog.priceB.toFixed(2)}B for ${liveCatalog.movieIds.length} titles.`);
              setActiveCatalogId(null);
            }}
            onCounter={(v: number) => {
              const r = counterBulkCatalogOffer(liveCatalog.id, v);
              if (r.error) { uiAlert('Counter Failed', r.error); }
            }}
            onReject={() => { rejectBulkCatalogOffer(liveCatalog.id); setActiveCatalogId(null); }}
            onClose={() => setActiveCatalogId(null)}
          />
        );
      })()}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  card: { backgroundColor: T.cardDark, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 2, borderColor: T.border },
  row: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border },
  title: { color: T.text, fontSize: 17, fontWeight: '900', flexShrink: 1 },
  sub: { color: T.textDim, fontSize: 12, marginTop: 4 },
  subDim: { color: T.textMute, fontSize: 11, marginTop: 2, fontWeight: '700' },
  relPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, gap: 4 },
  relDot: { width: 6, height: 6, borderRadius: 3 },
  relTxt: { fontWeight: '900', fontSize: 10 },
  fr: { marginTop: 10, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8 },
  frHeader: { color: T.textMute, fontSize: 11, fontWeight: '800', marginBottom: 6 },
  frRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, padding: 8, borderRadius: 8, marginBottom: 4, gap: 8 },
  miniIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  frName: { color: T.text, fontWeight: '800', flex: 1 },
  frPop: { color: T.cyan, fontWeight: '700', fontSize: 12 },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card, padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1.5, borderColor: T.yellow, justifyContent: 'center' },
  bulkTxt: { color: T.yellow, fontWeight: '900', fontSize: 12 },
  activeBulkRow: { backgroundColor: T.green + '22', padding: 6, borderRadius: 6, marginTop: 4, borderLeftWidth: 3, borderLeftColor: T.green },
  activeBulkTxt: { color: T.text, fontSize: 11, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#4d5058', padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: T.border },
  modalTitle: { color: T.text, fontSize: 22, fontWeight: '900' },
  modalSub: { color: T.textDim, fontSize: 12, marginTop: 4 },
  fieldLbl: { color: T.yellow, marginTop: 14, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  inp: { backgroundColor: T.cardDark, color: T.text, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, borderWidth: 2, borderColor: T.border, marginTop: 6, fontSize: 18, fontWeight: '900' },
  chip: { backgroundColor: T.cardDark, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: T.border, marginRight: 6 },
  chipTxt: { color: T.text, fontWeight: '800', fontSize: 12 },
  quoteBox: { backgroundColor: T.cardDark, padding: 12, borderRadius: 8, marginTop: 12, borderWidth: 2, borderColor: T.green, alignItems: 'center' },
  quoteLbl: { color: T.green, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  quoteVal: { color: T.green, fontSize: 28, fontWeight: '900' },
  quoteSub: { color: T.textDim, fontSize: 11, marginTop: 2 },
  signBtn: { flexDirection: 'row', backgroundColor: T.green, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6, borderWidth: 2, borderColor: T.border },
  signTxt: { color: T.cardDark, fontWeight: '900' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelTxt: { color: T.textDim, fontWeight: '700' },
});
