import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, IconTile, NeonStat, SectionHeader } from '../src/ui/components';
import { NegotiationModal } from '../src/ui/NegotiationModal';
import { uiAlert } from '../src/ui/ui-alert';
import { LicenseOffer, FranchiseOffer, BulkCatalogOffer } from '../src/game/types';

export default function OffersScreen() {
  const router = useRouter();
  const { state, acceptOffer, counterOffer, rejectOffer, acceptFranchiseOffer, counterFranchiseOffer, rejectFranchiseOffer, quoteFranchiseValue, acceptBulkCatalogOffer, counterBulkCatalogOffer, rejectBulkCatalogOffer, quoteBulkCatalogValue } = useGame();
  const [active, setActive] = useState<LicenseOffer | null>(null);
  const [counterVal, setCounterVal] = useState('');
  const [activeFranchiseId, setActiveFranchiseId] = useState<string | null>(null);
  const [activeBulkId, setActiveBulkId] = useState<string | null>(null);

  if (!state) return null;
  const offers = state.pendingOffers || [];
  const franchiseOffers = (state.franchiseOffers || []).filter(o => o.status === 'pending' && (o.fromStudioId === state.player.id || o.toStudioId === state.player.id));
  const bulkOffers = (state.bulkCatalogOffers || []).filter(o => o.status === 'pending' && (o.fromStudioId === state.player.id || o.toStudioId === state.player.id));

  const liveFranchise = activeFranchiseId ? franchiseOffers.find(o => o.id === activeFranchiseId) : null;
  const liveBulk = activeBulkId ? bulkOffers.find(o => o.id === activeBulkId) : null;
  const playerActorOf = (o: { fromStudioId: string; toStudioId: string }): 'from' | 'to' => o.fromStudioId === state.player.id ? 'from' : 'to';
  const roundsLeft = (o: FranchiseOffer | BulkCatalogOffer): number => {
    const a = playerActorOf(o);
    const used = o.history.filter(h => h.actor === a).length;
    return Math.max(0, o.maxRounds - used);
  };
  const sideOf = (o: FranchiseOffer | BulkCatalogOffer): 'buyer' | 'seller' => {
    if ('kind' in o) {
      const playerIsFrom = o.fromStudioId === state.player.id;
      if (o.kind === 'buy') return playerIsFrom ? 'buyer' : 'seller';
      return playerIsFrom ? 'seller' : 'buyer';
    }
    return o.fromStudioId === state.player.id ? 'buyer' : 'seller';
  };

  const open = (o: LicenseOffer) => { setActive(o); setCounterVal(o.feeM.toFixed(1)); };
  const doAccept = () => {
    if (!active) return;
    const movie = state.movies.find(m => m.id === active.movieId);
    const svc = (state.streamingServices || []).find(x => x.id === active.serviceId);
    const r = acceptOffer(active.id);
    if (r.error) { uiAlert('Could not close deal', r.error); return; }
    uiAlert('Deal Confirmed ✓', `${svc?.name || 'Streamer'} now licenses ${movie?.title || 'this title'} for $${active.feeM.toFixed(1)}M / ${active.years}yr.`);
    setActive(null);
  };
  const doReject = () => {
    if (!active) return;
    const movie = state.movies.find(m => m.id === active.movieId);
    uiAlert('Offer Rejected', `You walked away from the offer on ${movie?.title || 'this title'}.`);
    rejectOffer(active.id);
    setActive(null);
  };
  const doCounter = () => {
    if (!active) return;
    const val = parseFloat(counterVal);
    if (isNaN(val) || val <= 0) { uiAlert('Invalid', 'Enter a positive fee.'); return; }
    const movie = state.movies.find(m => m.id === active.movieId);
    const svc = (state.streamingServices || []).find(x => x.id === active.serviceId);
    counterOffer(active.id, val);
    uiAlert(
      'Counter Submitted',
      `${svc?.name || 'Streamer'} is reviewing your $${val.toFixed(1)}M counter on ${movie?.title || 'this title'}. Check News & Offers for the response.`,
    );
    setActive(null);
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Licensing Offers" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      {offers.length === 0 && franchiseOffers.length === 0 && bulkOffers.length === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="handshake-outline" size={64} color={T.textDim} />
          <Text style={s.emptyTxt}>No pending offers.</Text>
          <Text style={s.emptySub}>AI studios approach you about licensing, franchise trades, and bulk catalog packs over time.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {franchiseOffers.length > 0 && <SectionHeader title="Franchise Trade Offers" />}
          {franchiseOffers.map(o => {
            const fr = state.franchises.find(f => f.id === o.franchiseId);
            const otherId = o.fromStudioId === state.player.id ? o.toStudioId : o.fromStudioId;
            const other = otherId === state.player.id ? state.player : state.rivals.find(r => r.id === otherId);
            const myActor = playerActorOf(o);
            const aiAwaiting = o.lastActor !== myActor;
            return (
              <TouchableOpacity key={o.id} style={[s.card, { borderColor: o.kind === 'buy' ? T.yellow : T.green }]} onPress={() => setActiveFranchiseId(o.id)} testID={`fo-${o.id}`}>
                <MaterialCommunityIcons name={o.kind === 'buy' ? 'cart' : 'cash-multiple'} size={32} color={o.kind === 'buy' ? T.yellow : T.green} />
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={s.title}>{fr?.name || '—'}</Text>
                  <Text style={s.sub}>{o.kind === 'buy' ? `${other?.name} wants to BUY` : `${other?.name} interested · YOU sell`} · ${o.priceB.toFixed(2)}B {aiAwaiting ? '· counter-offered' : '· awaiting their reply'}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={28} color={T.textDim} />
              </TouchableOpacity>
            );
          })}

          {bulkOffers.length > 0 && <SectionHeader title="Bulk Catalog Offers" />}
          {bulkOffers.map(o => {
            const otherId = o.fromStudioId === state.player.id ? o.toStudioId : o.fromStudioId;
            const other = otherId === state.player.id ? state.player : state.rivals.find(r => r.id === otherId);
            return (
              <TouchableOpacity key={o.id} style={[s.card, { borderColor: T.magenta }]} onPress={() => setActiveBulkId(o.id)} testID={`bco-${o.id}`}>
                <MaterialCommunityIcons name="package-variant" size={32} color={T.magenta} />
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={s.title}>{o.movieIds.length}-title catalog pack</Text>
                  <Text style={s.sub}>{other?.name} · {o.years}yr · ${o.priceB.toFixed(2)}B</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={28} color={T.textDim} />
              </TouchableOpacity>
            );
          })}

          {offers.length > 0 && <SectionHeader title="Streaming License Offers" />}
          {offers.map(item => {
            const movie = state.movies.find(m => m.id === item.movieId);
            const svc = (state.streamingServices || []).find(x => x.id === item.serviceId);
            if (!movie || !svc) return null;
            return (
              <TouchableOpacity key={item.id} style={s.card} onPress={() => open(item)} testID={`offer-${item.id}`}>
                <IconTile icon={movie.iconKey} color={movie.iconBg} size={56} />
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={s.title}>{movie.title}</Text>
                  <Text style={s.sub}>From: {svc.name}</Text>
                  <Text style={[s.sub, { color: T.green }]}>${item.feeM.toFixed(1)}M · {item.years} year{item.years > 1 ? 's' : ''}{item.round > 1 ? ' · Counter' : ''}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={28} color={T.textDim} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Franchise trade negotiation */}
      <NegotiationModal
        visible={!!liveFranchise}
        subjectTitle={liveFranchise ? (state.franchises.find(f => f.id === liveFranchise.franchiseId)?.name || '—') : ''}
        subtitle={liveFranchise ? (() => {
          const otherId = liveFranchise.fromStudioId === state.player.id ? liveFranchise.toStudioId : liveFranchise.fromStudioId;
          const other = otherId === state.player.id ? state.player : state.rivals.find(r => r.id === otherId);
          return `${liveFranchise.kind === 'buy' ? 'Buy' : 'Sell'} ↔ ${other?.name || '—'}`;
        })() : ''}
        currentPriceB={liveFranchise?.priceB || 0}
        fairValueB={liveFranchise ? quoteFranchiseValue(liveFranchise.franchiseId) : 0}
        playerSide={liveFranchise ? sideOf(liveFranchise) : 'buyer'}
        roundsLeft={liveFranchise ? roundsLeft(liveFranchise) : 0}
        message={liveFranchise?.message}
        history={liveFranchise?.history}
        onAccept={() => {
          if (!liveFranchise) return;
          const r = acceptFranchiseOffer(liveFranchise.id);
          if (r.error) { uiAlert('Failed', r.error); return; }
          uiAlert('Trade Closed ✓', `Settled at $${liveFranchise.priceB.toFixed(2)}B.`);
          setActiveFranchiseId(null);
        }}
        onCounter={(v: number) => {
          if (!liveFranchise) return;
          const r = counterFranchiseOffer(liveFranchise.id, v);
          if (r.error) { uiAlert('Counter Failed', r.error); }
        }}
        onReject={() => {
          if (!liveFranchise) return;
          rejectFranchiseOffer(liveFranchise.id);
          setActiveFranchiseId(null);
        }}
        onClose={() => setActiveFranchiseId(null)}
      />

      {/* Bulk catalog negotiation */}
      <NegotiationModal
        visible={!!liveBulk}
        subjectTitle={liveBulk ? `${liveBulk.movieIds.length}-title catalog pack` : ''}
        subtitle={liveBulk ? `${liveBulk.years}-year license` : ''}
        currentPriceB={liveBulk?.priceB || 0}
        fairValueB={liveBulk ? quoteBulkCatalogValue(liveBulk.movieIds, liveBulk.years) : 0}
        playerSide={liveBulk ? sideOf(liveBulk) : 'buyer'}
        roundsLeft={liveBulk ? roundsLeft(liveBulk) : 0}
        message={liveBulk?.message}
        history={liveBulk?.history}
        onAccept={() => {
          if (!liveBulk) return;
          const r = acceptBulkCatalogOffer(liveBulk.id);
          if (r.error) { uiAlert('Failed', r.error); return; }
          uiAlert('Pack Closed ✓', `Settled at $${liveBulk.priceB.toFixed(2)}B for ${liveBulk.movieIds.length} titles.`);
          setActiveBulkId(null);
        }}
        onCounter={(v: number) => {
          if (!liveBulk) return;
          const r = counterBulkCatalogOffer(liveBulk.id, v);
          if (r.error) { uiAlert('Counter Failed', r.error); }
        }}
        onReject={() => {
          if (!liveBulk) return;
          rejectBulkCatalogOffer(liveBulk.id);
          setActiveBulkId(null);
        }}
        onClose={() => setActiveBulkId(null)}
      />

      <Modal visible={!!active} transparent animationType="slide" onRequestClose={() => setActive(null)}>
        {active ? (() => {
          const movie = state.movies.find(m => m.id === active.movieId);
          const svc = (state.streamingServices || []).find(x => x.id === active.serviceId);
          if (!movie || !svc) return <View />;
          return (
            <View style={s.modalBg}>
              <View style={s.modalCard}>
                <ScrollView>
                  <View style={{ alignItems: 'center' }}>
                    <IconTile icon={movie.iconKey} color={movie.iconBg} size={80} />
                    <Text style={s.modalTitle}>{movie.title}</Text>
                    <Text style={s.modalSub}>{svc.name}</Text>
                  </View>

                  <View style={s.quoteBox}>
                    <MaterialCommunityIcons name="format-quote-open" size={18} color={T.cyan} />
                    <Text style={s.quoteTxt}>{active.reasoning}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <NeonStat label="FEE" value={`$${active.feeM.toFixed(1)}M`} color={T.green} />
                    <NeonStat label="YEARS" value={active.years} color={T.cyan} />
                    <NeonStat label="ROUND" value={active.round} color={T.yellow} />
                  </View>

                  <TouchableOpacity style={s.btnAccept} onPress={doAccept} testID="offer-accept">
                    <MaterialCommunityIcons name="check-bold" color={T.cardDark} size={20} />
                    <Text style={s.btnAcceptT}>ACCEPT · ${active.feeM.toFixed(1)}M</Text>
                  </TouchableOpacity>

                  {active.round <= 1 ? (
                    <>
                      <Text style={s.sectionLbl}>COUNTER-OFFER</Text>
                      <View style={s.counterRow}>
                        <TextInput value={counterVal} onChangeText={setCounterVal} keyboardType="numeric" style={s.counterInput} testID="offer-counter-input" />
                        <Text style={s.counterCurr}>M</Text>
                        <TouchableOpacity style={s.btnCounter} onPress={doCounter} testID="offer-counter">
                          <Text style={s.btnCounterT}>COUNTER</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={s.counterHint}>Ask up to ~35% more. They may accept, counter back, or walk.</Text>
                    </>
                  ) : null}

                  <TouchableOpacity style={s.btnReject} onPress={doReject} testID="offer-reject">
                    <Text style={s.btnRejectT}>REJECT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnCancel} onPress={() => setActive(null)}>
                    <Text style={s.btnCancelT}>Close</Text>
                  </TouchableOpacity>
                </ScrollView>
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTxt: { color: T.text, fontSize: 17, marginTop: 12, fontWeight: '800' },
  emptySub: { color: T.textDim, fontSize: 12, textAlign: 'center', marginTop: 6 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 2, borderColor: T.border },
  title: { color: T.text, fontSize: 16, fontWeight: '800' },
  sub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#4d5058', padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '90%', borderWidth: 3, borderColor: T.border },
  modalTitle: { color: T.text, fontSize: 22, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  modalSub: { color: T.cyan, fontSize: 13, fontWeight: '700', marginTop: 2 },
  quoteBox: { backgroundColor: T.cardDark, borderRadius: 10, padding: 12, marginTop: 14, borderLeftWidth: 3, borderLeftColor: T.cyan, flexDirection: 'row', gap: 6 },
  quoteTxt: { color: T.text, fontStyle: 'italic', flex: 1, fontSize: 13 },
  sectionLbl: { color: T.yellow, marginTop: 14, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  counterInput: { flex: 1, backgroundColor: T.cardDark, color: T.text, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, borderWidth: 2, borderColor: T.border, fontSize: 16, fontWeight: '800' },
  counterCurr: { color: T.green, fontWeight: '900', fontSize: 18 },
  btnCounter: { backgroundColor: T.yellow, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, borderWidth: 2, borderColor: T.border },
  btnCounterT: { color: T.cardDark, fontWeight: '900' },
  counterHint: { color: T.textDim, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  btnAccept: { flexDirection: 'row', backgroundColor: T.green, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderWidth: 2, borderColor: T.border, gap: 6 },
  btnAcceptT: { color: T.cardDark, fontWeight: '900', fontSize: 15 },
  btnReject: { backgroundColor: T.cardDark, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, borderWidth: 2, borderColor: '#E84545' },
  btnRejectT: { color: '#E84545', fontWeight: '900' },
  btnCancel: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  btnCancelT: { color: T.textDim, fontWeight: '700' },
});
