import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../../src/game/state';
import { T } from '../../src/ui/theme';
import { TopBar, IconTile, NeonStat, SectionHeader } from '../../src/ui/components';
import { NegotiationModal } from '../../src/ui/NegotiationModal';
import { uiAlert } from '../../src/ui/ui-alert';

export default function FranchiseDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, proposeFranchiseTrade, acceptFranchiseOffer, counterFranchiseOffer, rejectFranchiseOffer, quoteFranchiseValue, quoteFranchiseBulkLicense, proposeBulkCatalogLicense, acceptBulkCatalogOffer, counterBulkCatalogOffer, rejectBulkCatalogOffer, quoteFranchiseBulkValueB } = useGame();
  const [tradeOpen, setTradeOpen] = useState(false);
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSvcId, setBulkSvcId] = useState<string | null>(null);
  const [bulkYears, setBulkYears] = useState('5');
  const [activeFranchiseBulkId, setActiveFranchiseBulkId] = useState<string | null>(null);
  if (!state) return null;
  const franchise = state.franchises.find(f => f.id === id);
  if (!franchise) return <View><Text>Not found</Text></View>;
  const movies = state.movies.filter(m => m.franchiseId === id).sort((a, b) => (a.releaseYear * 100 + a.releaseWeek) - (b.releaseYear * 100 + b.releaseWeek));
  const totalBO = movies.reduce((a, b) => a + b.boxOffice, 0);
  const own = franchise.studioId === state.player.id;
  const owner = own ? state.player : state.rivals.find(r => r.id === franchise.studioId);

  // Aggregate franchise stats (NEW)
  const investedM = movies.reduce((a, b) => a + (b.budget || 0) + (b.marketingBudget || 0), 0);
  const totalAwards = movies.reduce((a, b) => a + (b.awards || 0), 0);
  // Streaming availability — services carrying any movie of this franchise
  const movieIds = new Set(movies.map(m => m.id));
  const carryingServices = (state.streamingServices || []).filter(svc => svc.catalogMovieIds.some(mid => movieIds.has(mid)));
  // Crossover analysis: movies in this franchise that are crossovers; collect involved franchise IDs from those movies
  const crossoverMovies = movies.filter(m => m.brand === 'Crossover' || (m.crossoverFranchiseIds && m.crossoverFranchiseIds.length));
  const involvedFranchiseIds = new Set<string>();
  crossoverMovies.forEach(m => { m.crossoverFranchiseIds?.forEach(fid => involvedFranchiseIds.add(fid)); });
  const involvedFranchises = Array.from(involvedFranchiseIds).map(fid => state.franchises.find(f => f.id === fid)).filter(Boolean) as typeof state.franchises;
  const involvedStudios = new Set<string>([franchise.studioId, ...involvedFranchises.map(f => f.studioId)]);
  const involvedStudioNames = Array.from(involvedStudios).map(sid => sid === state.player.id ? state.player.name : state.rivals.find(r => r.id === sid)?.name || '—');

  const make = (brand: 'Sequel' | 'Prequel' | 'Spinoff' | 'Crossover') => {
    if (!own) return;
    router.push({ pathname: '/create-movie', params: { brand, franchiseId: franchise.id } });
  };

  // === Pull-and-push franchise trade flow ===
  const fairValue = quoteFranchiseValue(franchise.id);
  const activeTrade = activeTradeId ? (state.franchiseOffers || []).find(o => o.id === activeTradeId && o.status === 'pending') : null;
  const startSell = () => {
    const ask = +(fairValue * 1.1).toFixed(2); // start 10% above fair
    const r = proposeFranchiseTrade({ franchiseId: franchise.id, kind: 'sell', priceB: ask });
    if (r.error) { uiAlert('Cannot Sell', r.error); return; }
    if (r.offerId) setActiveTradeId(r.offerId);
    setTradeOpen(true);
  };
  const startBuy = () => {
    const bid = +(fairValue * 0.9).toFixed(2); // start 10% below fair
    const r = proposeFranchiseTrade({ franchiseId: franchise.id, kind: 'buy', priceB: bid });
    if (r.error) { uiAlert('Cannot Buy', r.error); return; }
    if (r.offerId) setActiveTradeId(r.offerId);
    setTradeOpen(true);
  };
  // Re-read live offer after each action — so AI counter shows up.
  const liveOffer = activeTradeId ? (state.franchiseOffers || []).find(o => o.id === activeTradeId) : null;
  const playerSide: 'buyer' | 'seller' = liveOffer ? ((liveOffer.kind === 'buy' && liveOffer.fromStudioId === state.player.id) || (liveOffer.kind === 'sell' && liveOffer.toStudioId === state.player.id) ? 'buyer' : 'seller') : 'buyer';
  const playerActor: 'from' | 'to' = liveOffer && liveOffer.fromStudioId === state.player.id ? 'from' : 'to';
  const playerRoundsUsed = liveOffer ? liveOffer.history.filter(h => h.actor === playerActor).length : 0;
  const roundsLeft = liveOffer ? Math.max(0, liveOffer.maxRounds - playerRoundsUsed) : 0;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Franchise" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.header}>
          <IconTile icon={franchise.iconKey} color={franchise.iconBg} size={120} />
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text style={s.title}>{franchise.name}</Text>
            <Text style={s.sub}>{owner?.name}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <NeonStat label="POP" value={franchise.popularity} color={T.cyan} />
              <NeonStat label="FILMS" value={movies.length} color={T.yellow} />
              <NeonStat label="AWARDS" value={totalAwards} color={T.pink} />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
              <NeonStat label="CAREER BO" value={`${totalBO.toFixed(2)} B`} color={T.magenta} />
              <NeonStat label="INVESTED" value={`${investedM.toFixed(0)} M`} color={T.green} />
            </View>
          </View>
        </View>

        <SectionHeader title="Streaming Availability" />
        <View style={s.statsBox}>
          {carryingServices.length === 0 ? (
            <Text style={s.statTxt}>None of this franchise's films are currently on any streaming service.</Text>
          ) : carryingServices.map(svc => {
            const ownerStudio = svc.studioId === state.player.id ? state.player : state.rivals.find(r => r.id === svc.studioId);
            const titleCount = svc.catalogMovieIds.filter(mid => movieIds.has(mid)).length;
            return (
              <View key={svc.id} style={s.streamRow}>
                <MaterialCommunityIcons name="play-circle" size={18} color={T.magenta} />
                <Text style={s.statTxt} numberOfLines={1}>{svc.name} ({ownerStudio?.name}) · {titleCount} title{titleCount > 1 ? 's' : ''}</Text>
              </View>
            );
          })}
        </View>

        {(crossoverMovies.length > 0 || involvedFranchises.length > 0) ? (
          <>
            <SectionHeader title="Crossover Universe" />
            <View style={s.statsBox}>
              {involvedStudioNames.length > 1 ? (
                <Text style={s.statTxt}>Studios involved: <Text style={{ color: T.cyan, fontWeight: '900' }}>{involvedStudioNames.join(' · ')}</Text></Text>
              ) : null}
              {involvedFranchises.length > 0 ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={[s.statTxt, { fontWeight: '900', color: T.text }]}>Tied Franchises:</Text>
                  {involvedFranchises.map(f => {
                    const ownerName = f.studioId === state.player.id ? state.player.name : state.rivals.find(r => r.id === f.studioId)?.name || '—';
                    return (
                      <TouchableOpacity key={f.id} style={s.crossRow} onPress={() => router.push(`/franchise/${f.id}`)} testID={`crossover-fr-${f.id}`}>
                        <IconTile icon={f.iconKey} color={f.iconBg} size={32} />
                        <View style={{ flex: 1, paddingHorizontal: 8 }}>
                          <Text style={s.crossTitle}>{f.name}</Text>
                          <Text style={s.crossSub}>{ownerName}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={T.textDim} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {own ? (
          <>
            <SectionHeader title="Expand Franchise" />
            <View style={s.btns}>
              {(['Sequel', 'Prequel', 'Spinoff', 'Crossover'] as const).map(b => (
                <TouchableOpacity key={b} style={s.btn} onPress={() => make(b)} testID={`make-${b}`}>
                  <MaterialCommunityIcons
                    name={b === 'Sequel' ? 'plus-circle' : b === 'Prequel' ? 'history' : b === 'Spinoff' ? 'source-branch' : 'link-variant'}
                    size={24} color={T.cyan}
                  />
                  <Text style={s.btnT}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <SectionHeader title="Trade" />
            <View style={[s.btns, { padding: 12 }]}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: T.cardDark, borderColor: T.green, flex: 1 }]}
                onPress={startSell}
                testID="franchise-sell-btn"
              >
                <MaterialCommunityIcons name="cash-multiple" size={24} color={T.green} />
                <Text style={[s.btnT, { color: T.green }]}>Sell to AI</Text>
                <Text style={s.btnSub}>Est. value ~${fairValue.toFixed(2)}B</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <SectionHeader title="Trade" />
            <View style={[s.btns, { padding: 12, gap: 8 }]}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: T.cardDark, borderColor: T.magenta, flex: 1 }]}
                onPress={() => router.push({ pathname: '/create-movie', params: { brand: 'Crossover', crossover: franchise.id } })}
                testID="license-crossover-btn"
              >
                <MaterialCommunityIcons name="handshake" size={24} color={T.magenta} />
                <Text style={[s.btnT, { color: T.text }]}>License Crossover</Text>
                <Text style={s.btnSub}>Use this franchise in a crossover with one of yours.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: T.cardDark, borderColor: T.cyan, flex: 1 }]}
                onPress={() => {
                  const playerSvcs = (state.streamingServices || []).filter(svc => svc.studioId === state.player.id);
                  if (playerSvcs.length === 0) { uiAlert('No Streaming Service', 'Launch your own streaming service before licensing a rival franchise to it.'); return; }
                  setBulkSvcId(playerSvcs[0].id);
                  setBulkYears('5');
                  setBulkOpen(true);
                }}
                testID="franchise-bulk-license-btn"
              >
                <MaterialCommunityIcons name="package-variant-closed" size={24} color={T.cyan} />
                <Text style={[s.btnT, { color: T.cyan }]}>Bulk-License to My Streaming</Text>
                <Text style={s.btnSub}>License every current + future film of this franchise.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: T.cardDark, borderColor: T.yellow, flex: 1 }]}
                onPress={startBuy}
                testID="franchise-buy-btn"
              >
                <MaterialCommunityIcons name="cash-fast" size={24} color={T.yellow} />
                <Text style={[s.btnT, { color: T.yellow }]}>Make Buy Offer</Text>
                <Text style={s.btnSub}>Acquire this franchise. Est. ${fairValue.toFixed(2)}B</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <SectionHeader title="Films" />
        {movies.map(m => (
          <TouchableOpacity key={m.id} style={s.movieRow} onPress={() => router.push(`/movie/${m.id}`)} testID={`f-movie-${m.id}`}>
            <IconTile icon={m.iconKey} color={m.iconBg} size={56} />
            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <Text style={s.movieTitle}>{m.title}</Text>
              <Text style={s.sub}>{m.brand} · Y{m.releaseYear || '-'} · {m.criticScore || '-'}/100</Text>
            </View>
            <Text style={[s.sub, { color: T.green }]}>{m.boxOffice.toFixed(2)}B</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Franchise Bulk License modal */}
      <Modal visible={bulkOpen} transparent animationType="slide" onRequestClose={() => setBulkOpen(false)}>
        {(() => {
          const playerSvcs = (state.streamingServices || []).filter(svc => svc.studioId === state.player.id);
          const yrs = parseInt(bulkYears, 10) || 0;
          const quote = bulkSvcId && yrs > 0 ? quoteFranchiseBulkLicense({ franchiseId: franchise.id, serviceId: bulkSvcId, years: yrs }) : null;
          return (
            <View style={fs.modalBg}>
              <View style={fs.modalCard}>
                <Text style={fs.modalTitle}>License {franchise.name}</Text>
                <Text style={fs.modalSub}>Adds every released film of this franchise to your service immediately, plus rights to future releases for the term (each film windows in 8–12w post-theatrical, 16–32w hybrid, 26–52w streaming-only).</Text>

                <Text style={fs.fieldLbl}>YOUR SERVICE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {playerSvcs.map(svc => (
                    <TouchableOpacity key={svc.id} style={[fs.chip, bulkSvcId === svc.id && { backgroundColor: T.cyan, borderColor: T.cyan }]} onPress={() => setBulkSvcId(svc.id)} testID={`fb-svc-${svc.id}`}>
                      <Text style={[fs.chipTxt, bulkSvcId === svc.id && { color: T.cardDark }]}>{svc.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={fs.fieldLbl}>YEARS (1–10)</Text>
                <TextInput value={bulkYears} onChangeText={(v) => setBulkYears(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" maxLength={2} style={fs.inp} testID="fb-years-input" />

                {quote && !quote.error ? (
                  <View style={fs.quoteBox}>
                    <Text style={fs.quoteLbl}>OPENING OFFER (negotiable)</Text>
                    <Text style={fs.quoteVal}>${(quote.feeM / 1000 * 0.85).toFixed(2)}B</Text>
                    <Text style={fs.quoteSub}>Fair value: ${(quote.feeM / 1000).toFixed(2)}B · {quote.movieCount} current films + future for {yrs}y · Cash: ${state.player.cash.toFixed(2)}B</Text>
                  </View>
                ) : quote?.error ? (
                  <Text style={[fs.modalSub, { color: T.red, marginTop: 10 }]}>{quote.error}</Text>
                ) : null}

                <TouchableOpacity
                  style={fs.signBtn}
                  onPress={() => {
                    if (!bulkSvcId) return;
                    const fairB = quoteFranchiseBulkValueB(franchise.id, yrs);
                    const opening = +(fairB * 0.85).toFixed(3);
                    const r = proposeBulkCatalogLicense({
                      toRivalStudioId: franchise.studioId,
                      movieIds: [],
                      priceB: opening,
                      years: yrs,
                      serviceId: bulkSvcId,
                      dealKind: 'franchise_bulk',
                      franchiseId: franchise.id,
                    });
                    if (r.error) { uiAlert('Cannot open', r.error); return; }
                    setBulkOpen(false);
                    if (r.offerId) setActiveFranchiseBulkId(r.offerId);
                  }}
                  testID="fb-sign-btn"
                >
                  <MaterialCommunityIcons name="handshake" size={20} color={T.cardDark} />
                  <Text style={fs.signTxt}>OPEN NEGOTIATION</Text>
                </TouchableOpacity>
                <TouchableOpacity style={fs.cancelBtn} onPress={() => setBulkOpen(false)}>
                  <Text style={fs.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </Modal>

      <NegotiationModal
        visible={tradeOpen && !!liveOffer}
        subjectTitle={franchise.name}
        subtitle={liveOffer?.kind === 'buy' ? `Buying from ${owner?.name || '—'}` : `Selling to a top bidder`}
        currentPriceB={liveOffer?.priceB || 0}
        fairValueB={fairValue}
        playerSide={playerSide}
        roundsLeft={roundsLeft}
        message={liveOffer?.message}
        history={liveOffer?.history}
        onAccept={() => {
          if (!liveOffer) return;
          const r = acceptFranchiseOffer(liveOffer.id);
          if (r.error) { uiAlert('Failed', r.error); return; }
          uiAlert('Trade Closed ✓', `Settled at $${liveOffer.priceB.toFixed(2)}B.`);
          setTradeOpen(false); setActiveTradeId(null);
        }}
        onCounter={(v: number) => {
          if (!liveOffer) return;
          const r = counterFranchiseOffer(liveOffer.id, v);
          if (r.error) { uiAlert('Counter Failed', r.error); return; }
          // Modal stays open for next AI counter — just refresh
        }}
        onReject={() => {
          if (!liveOffer) return;
          rejectFranchiseOffer(liveOffer.id);
          uiAlert('Walked Away', 'You rejected the offer.');
          setTradeOpen(false); setActiveTradeId(null);
        }}
        onClose={() => { setTradeOpen(false); setActiveTradeId(null); }}
      />

      {/* Franchise Bulk License negotiation */}
      {(() => {
        const live = activeFranchiseBulkId ? (state.bulkCatalogOffers || []).find(o => o.id === activeFranchiseBulkId && o.status === 'pending') : null;
        if (!live) return null;
        const playerActor: 'from' | 'to' = live.fromStudioId === state.player.id ? 'from' : 'to';
        const used = live.history.filter(h => h.actor === playerActor).length;
        const playerSide2: 'buyer' | 'seller' = live.fromStudioId === state.player.id ? 'buyer' : 'seller';
        return (
          <NegotiationModal
            visible={!!live}
            subjectTitle={`License whole ${franchise.name}`}
            subtitle={`${live.years}-year bulk license · current + future films`}
            currentPriceB={live.priceB}
            fairValueB={quoteFranchiseBulkValueB(franchise.id, live.years)}
            playerSide={playerSide2}
            roundsLeft={Math.max(0, live.maxRounds - used)}
            message={live.message}
            history={live.history}
            onAccept={() => {
              const r = acceptBulkCatalogOffer(live.id);
              if (r.error) { uiAlert('Failed', r.error); return; }
              uiAlert('Franchise Licensed ✓', `Settled at $${live.priceB.toFixed(2)}B for ${live.years}y.`);
              setActiveFranchiseBulkId(null);
            }}
            onCounter={(v: number) => {
              const r = counterBulkCatalogOffer(live.id, v);
              if (r.error) { uiAlert('Counter Failed', r.error); }
            }}
            onReject={() => { rejectBulkCatalogOffer(live.id); setActiveFranchiseBulkId(null); }}
            onClose={() => setActiveFranchiseBulkId(null)}
          />
        );
      })()}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', backgroundColor: T.cardDark, padding: 12 },
  title: { color: T.text, fontSize: 22, fontWeight: '900' },
  sub: { color: T.textDim, fontSize: 13, marginTop: 2 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  btn: { flexBasis: '47%', backgroundColor: T.card, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: T.border, gap: 4 },
  btnT: { color: T.text, fontWeight: '900', fontSize: 14 },
  btnSub: { color: T.textDim, fontSize: 11, textAlign: 'center' },
  movieRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  movieTitle: { color: T.text, fontWeight: '800', fontSize: 15 },
  statsBox: { backgroundColor: T.cardDark, marginHorizontal: 12, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: T.border, gap: 4 },
  statTxt: { color: T.textDim, fontSize: 13 },
  streamRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  crossRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, padding: 8, borderRadius: 6, marginTop: 4, borderWidth: 1, borderColor: T.border },
  crossTitle: { color: T.text, fontWeight: '800', fontSize: 13 },
  crossSub: { color: T.textDim, fontSize: 11 },
});

const fs = StyleSheet.create({
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
  quoteSub: { color: T.textDim, fontSize: 11, marginTop: 2, textAlign: 'center' },
  signBtn: { flexDirection: 'row', backgroundColor: T.green, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6, borderWidth: 2, borderColor: T.border },
  signTxt: { color: T.cardDark, fontWeight: '900' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelTxt: { color: T.textDim, fontWeight: '700' },
});
