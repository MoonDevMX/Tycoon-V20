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
import { LicenseOffer, FranchiseOffer, BulkCatalogOffer, IPCategory } from '../src/game/types';

const CAT_LABEL: Record<IPCategory, string> = {
  book: 'Book', video_game: 'Video Game', toy: 'Toy', sports: 'Sports', comic: 'Comic', music: 'Music',
};
const CAT_ICON: Record<IPCategory, string> = {
  book: 'book-open-variant', video_game: 'gamepad-variant', toy: 'teddy-bear', sports: 'basketball', comic: 'book-multiple', music: 'music-circle',
};

export default function OffersScreen() {
  const router = useRouter();
  const { state, acceptOffer, counterOffer, rejectOffer, acceptFranchiseOffer, counterFranchiseOffer, rejectFranchiseOffer, quoteFranchiseValue, acceptBulkCatalogOffer, counterBulkCatalogOffer, rejectBulkCatalogOffer, quoteBulkCatalogValue, quoteFutureReleasesValueB, quoteFranchiseBulkValueB, acceptIPOffer, counterIPOffer, rejectIPOffer, acceptOutboundBid, rejectOutboundBid, counterOutboundBid } = useGame();
  const [active, setActive] = useState<LicenseOffer | null>(null);
  const [counterVal, setCounterVal] = useState('');
  const [activeFranchiseId, setActiveFranchiseId] = useState<string | null>(null);
  const [activeBulkId, setActiveBulkId] = useState<string | null>(null);
  // IP inbound counter modal
  const [ipCounterId, setIpCounterId] = useState<string | null>(null);
  const [cFee, setCFee] = useState(''); const [cBO, setCBO] = useState(''); const [cMerch, setCMerch] = useState('');
  const [cYears, setCYears] = useState(''); const [cPacks, setCPacks] = useState('');
  const [cExcl, setCExcl] = useState(false); const [cSub, setCSub] = useState(false);
  // Outbound bid counter modal
  const [bidCounterId, setBidCounterId] = useState<string | null>(null);
  const [bcFee, setBcFee] = useState(''); const [bcRoy, setBcRoy] = useState(''); const [bcYears, setBcYears] = useState('');

  if (!state) return null;
  const offers = state.pendingOffers || [];
  const franchiseOffers = (state.franchiseOffers || []).filter(o => o.status === 'pending' && (o.fromStudioId === state.player.id || o.toStudioId === state.player.id));
  const bulkOffers = (state.bulkCatalogOffers || []).filter(o => o.status === 'pending' && (o.fromStudioId === state.player.id || o.toStudioId === state.player.id));
  const ipInbound = (state.externalIPOffers || []).filter(o => o.status === 'pending');
  const myListings = (state.outboundIPListings || []).filter(l => l.studioId === state.player.id);
  const ipOutboundBids = (state.outboundIPBids || []).filter(b => b.status === 'pending' && myListings.some(l => l.id === b.listingId));
  const totalCount = offers.length + franchiseOffers.length + bulkOffers.length + ipInbound.length + ipOutboundBids.length;

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
      <TopBar title={`Deals & Offers · ${totalCount}`} onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      {totalCount === 0 ? (
        <View style={s.empty}>
          <MaterialCommunityIcons name="handshake-outline" size={64} color={T.textDim} />
          <Text style={s.emptyTxt}>No pending deals.</Text>
          <Text style={s.emptySub}>AI studios approach you about licensing, franchise trades, bulk catalog packs, and external IPs over time.</Text>
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

          {bulkOffers.length > 0 && <SectionHeader title="Bulk Catalog & License Offers" />}
          {bulkOffers.map(o => {
            const otherId = o.fromStudioId === state.player.id ? o.toStudioId : o.fromStudioId;
            const other = otherId === state.player.id ? state.player : state.rivals.find(r => r.id === otherId);
            const kind = o.dealKind || 'catalog';
            const label = kind === 'future_releases'
              ? `${o.futureMovieCount} future ${other?.name || 'rival'} films`
              : kind === 'franchise_bulk'
                ? `${state.franchises.find(f => f.id === o.franchiseId)?.name || 'Franchise'} — full bulk license`
                : `${o.movieIds.length}-title catalog pack`;
            const iconName = kind === 'future_releases' ? 'movie-roll' : kind === 'franchise_bulk' ? 'star-circle' : 'package-variant';
            return (
              <TouchableOpacity key={o.id} style={[s.card, { borderColor: T.magenta }]} onPress={() => setActiveBulkId(o.id)} testID={`bco-${o.id}`}>
                <MaterialCommunityIcons name={iconName as any} size={32} color={T.magenta} />
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={s.title} numberOfLines={1}>{label}</Text>
                  <Text style={s.sub}>{other?.name} · {o.years}yr · ${o.priceB.toFixed(2)}B</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={28} color={T.textDim} />
              </TouchableOpacity>
            );
          })}

          {ipInbound.length > 0 && <SectionHeader title="External IP Offers (Inbound)" />}
          {ipInbound.map(o => {
            const ip = state.externalIPs?.find(i => i.id === o.ipId);
            const lic = state.externalLicensors?.find(l => l.id === o.fromStudioId);
            if (!ip || !lic) return null;
            return (
              <View key={o.id} style={[s.card, { borderColor: T.cyan, flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name={CAT_ICON[ip.category] as any} size={28} color={T.cyan} />
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text style={s.title} numberOfLines={1}>{ip.name}</Text>
                    <Text style={s.sub}>{lic.name} · {CAT_LABEL[ip.category]} · Pop {ip.popularity}/100</Text>
                  </View>
                </View>
                <View style={s.ipTerms}>
                  <Text style={s.ipTerm}>Fee: <Text style={s.ipTermVal}>${o.feeM.toFixed(1)}M</Text></Text>
                  <Text style={s.ipTerm}>BO%: <Text style={s.ipTermVal}>{o.boPercent}%</Text></Text>
                  <Text style={s.ipTerm}>Merch%: <Text style={s.ipTermVal}>{o.merchPercent}%</Text></Text>
                  <Text style={s.ipTerm}>Term: <Text style={s.ipTermVal}>{o.years}y</Text></Text>
                  <Text style={s.ipTerm}>Packs: <Text style={s.ipTermVal}>{o.packs}</Text></Text>
                  {o.exclusivity ? <Text style={[s.ipTerm, { color: T.yellow }]}>EXCLUSIVE</Text> : null}
                </View>
                <View style={s.ipBtnRow}>
                  <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.green }]} onPress={() => {
                    const r = acceptIPOffer(o.id);
                    if (r.error) uiAlert('Cannot Accept', r.error);
                  }} testID={`accept-ip-${o.id}`}>
                    <Text style={s.ipBtnTxt}>ACCEPT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.yellow }]} onPress={() => {
                    setIpCounterId(o.id); setCFee(String(o.feeM)); setCBO(String(o.boPercent)); setCMerch(String(o.merchPercent)); setCYears(String(o.years)); setCPacks(String(o.packs)); setCExcl(o.exclusivity); setCSub(o.sublicensable);
                  }} testID={`counter-ip-${o.id}`}>
                    <Text style={s.ipBtnTxt}>COUNTER</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.red }]} onPress={() => rejectIPOffer(o.id)} testID={`reject-ip-${o.id}`}>
                    <Text style={s.ipBtnTxt}>REJECT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {ipOutboundBids.length > 0 && <SectionHeader title="Spin-off Bids (Outbound)" />}
          {ipOutboundBids.map(b => {
            const list = myListings.find(l => l.id === b.listingId);
            const fr = list?.sourceFranchiseId ? state.franchises.find(f => f.id === list.sourceFranchiseId) : null;
            const lic = state.externalLicensors?.find(l => l.id === b.licensorId);
            return (
              <View key={b.id} style={[s.card, { borderColor: T.green, flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="cash-fast" size={28} color={T.green} />
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text style={s.title} numberOfLines={1}>{fr?.name || 'Listing'} → {list ? CAT_LABEL[list.category] : '—'}</Text>
                    <Text style={s.sub}>{lic?.name}</Text>
                  </View>
                </View>
                <View style={s.ipTerms}>
                  <Text style={s.ipTerm}>Upfront: <Text style={s.ipTermVal}>${b.feeM.toFixed(1)}M</Text></Text>
                  <Text style={s.ipTerm}>Royalty: <Text style={s.ipTermVal}>{b.royaltyPercent}%</Text></Text>
                  <Text style={s.ipTerm}>Term: <Text style={s.ipTermVal}>{b.years}y</Text></Text>
                </View>
                <View style={s.ipBtnRow}>
                  <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.green }]} onPress={() => {
                    const r = acceptOutboundBid(b.id);
                    if (r.error) uiAlert('Cannot Accept', r.error);
                  }} testID={`accept-bid-o-${b.id}`}>
                    <Text style={s.ipBtnTxt}>ACCEPT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.yellow }]} onPress={() => {
                    setBidCounterId(b.id);
                    setBcFee(String(+(b.feeM * 1.15).toFixed(1)));
                    setBcRoy(String(+(b.royaltyPercent + 1).toFixed(1)));
                    setBcYears(String(b.years));
                  }} testID={`counter-bid-o-${b.id}`}>
                    <Text style={s.ipBtnTxt}>COUNTER</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.red }]} onPress={() => rejectOutboundBid(b.id)} testID={`reject-bid-o-${b.id}`}>
                    <Text style={s.ipBtnTxt}>REJECT</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
        subjectTitle={liveBulk ? (
          (liveBulk.dealKind || 'catalog') === 'future_releases'
            ? `${liveBulk.futureMovieCount} future ${state.rivals.find(r => r.id === (liveBulk.fromStudioId === state.player.id ? liveBulk.toStudioId : liveBulk.fromStudioId))?.name || 'rival'} films`
            : (liveBulk.dealKind === 'franchise_bulk')
              ? `${state.franchises.find(f => f.id === liveBulk.franchiseId)?.name || 'Franchise'} — full bulk license`
              : `${liveBulk.movieIds.length}-title catalog pack`
        ) : ''}
        subtitle={liveBulk ? `${liveBulk.years}-year license` : ''}
        currentPriceB={liveBulk?.priceB || 0}
        fairValueB={liveBulk ? (
          (liveBulk.dealKind || 'catalog') === 'future_releases'
            ? quoteFutureReleasesValueB(liveBulk.fromStudioId === state.player.id ? liveBulk.toStudioId : liveBulk.fromStudioId, liveBulk.futureMovieCount || 1, liveBulk.years)
            : (liveBulk.dealKind === 'franchise_bulk' && liveBulk.franchiseId)
              ? quoteFranchiseBulkValueB(liveBulk.franchiseId, liveBulk.years)
              : quoteBulkCatalogValue(liveBulk.movieIds, liveBulk.years)
        ) : 0}
        playerSide={liveBulk ? sideOf(liveBulk) : 'buyer'}
        roundsLeft={liveBulk ? roundsLeft(liveBulk) : 0}
        message={liveBulk?.message}
        history={liveBulk?.history}
        onAccept={() => {
          if (!liveBulk) return;
          const r = acceptBulkCatalogOffer(liveBulk.id);
          if (r.error) { uiAlert('Failed', r.error); return; }
          uiAlert('Deal Closed ✓', `Settled at $${liveBulk.priceB.toFixed(2)}B / ${liveBulk.years}yr.`);
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

      {/* IP Inbound counter modal */}
      <Modal visible={!!ipCounterId} transparent animationType="slide" onRequestClose={() => setIpCounterId(null)}>
        <View style={s.ipModalBg}>
          <View style={s.ipModalCard}>
            <Text style={s.ipModalTitle}>Counter IP Offer</Text>
            <View style={s.ipNumRow}>
              <IPNumInput label="Fee ($M)" value={cFee} onChange={setCFee} testID="ip-c-fee" />
              <IPNumInput label="BO %" value={cBO} onChange={setCBO} testID="ip-c-bo" />
            </View>
            <View style={s.ipNumRow}>
              <IPNumInput label="Merch %" value={cMerch} onChange={setCMerch} testID="ip-c-merch" />
              <IPNumInput label="Years" value={cYears} onChange={setCYears} testID="ip-c-years" />
            </View>
            <View style={s.ipNumRow}>
              <IPNumInput label="Packs" value={cPacks} onChange={setCPacks} testID="ip-c-packs" />
              <View style={{ flex: 1 }} />
            </View>
            <View style={s.ipBtnRow}>
              <TouchableOpacity style={[s.ipToggle, cExcl && s.ipToggleOn]} onPress={() => setCExcl(v => !v)} testID="ip-c-excl">
                <Text style={[s.ipToggleTxt, cExcl && { color: T.cardDark }]}>Exclusive {cExcl ? '✓' : ''}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.ipToggle, cSub && s.ipToggleOn]} onPress={() => setCSub(v => !v)} testID="ip-c-sub">
                <Text style={[s.ipToggleTxt, cSub && { color: T.cardDark }]}>Sublicensable {cSub ? '✓' : ''}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.green, marginTop: 12 }]} onPress={() => {
              if (!ipCounterId) return;
              const r = counterIPOffer(ipCounterId, {
                feeM: parseFloat(cFee) || 0,
                boPercent: parseFloat(cBO) || 0,
                merchPercent: parseFloat(cMerch) || 0,
                years: parseInt(cYears, 10) || 0,
                packs: parseInt(cPacks, 10) || 0,
                exclusivity: cExcl,
                sublicensable: cSub,
              });
              if (r.error) uiAlert('Counter Failed', r.error); else setIpCounterId(null);
            }} testID="ip-c-submit">
              <Text style={s.ipBtnTxt}>SUBMIT COUNTER</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.card }]} onPress={() => setIpCounterId(null)}>
              <Text style={s.ipBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Outbound bid counter modal */}
      <Modal visible={!!bidCounterId} transparent animationType="slide" onRequestClose={() => setBidCounterId(null)}>
        <View style={s.ipModalBg}>
          <View style={s.ipModalCard}>
            <Text style={s.ipModalTitle}>Counter Bid</Text>
            <Text style={s.ipModalSub}>Push the agency for richer terms. Going too high may push them to walk away.</Text>
            <View style={s.ipNumRow}>
              <IPNumInput label="Upfront ($M)" value={bcFee} onChange={setBcFee} testID="bc-fee-o" />
              <IPNumInput label="Royalty %" value={bcRoy} onChange={setBcRoy} testID="bc-roy-o" />
            </View>
            <View style={s.ipNumRow}>
              <IPNumInput label="Years" value={bcYears} onChange={setBcYears} testID="bc-years-o" />
              <View style={{ flex: 1 }} />
            </View>
            <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.green, marginTop: 12 }]} onPress={() => {
              if (!bidCounterId) return;
              const r = counterOutboundBid(bidCounterId, {
                feeM: parseFloat(bcFee) || 0,
                royaltyPercent: parseFloat(bcRoy) || 0,
                years: parseInt(bcYears, 10) || 0,
              });
              if (r.error) uiAlert('Counter Failed', r.error); else setBidCounterId(null);
            }} testID="bc-submit-o">
              <Text style={s.ipBtnTxt}>SUBMIT COUNTER</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ipBtn, { backgroundColor: T.card }]} onPress={() => setBidCounterId(null)}>
              <Text style={s.ipBtnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

function IPNumInput({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: T.textDim, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={{ backgroundColor: T.cardDark, color: T.text, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2, borderColor: T.border, fontSize: 14, fontWeight: '800' }}
        testID={testID}
      />
    </View>
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
  // IP/outbound section additions
  ipTerms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, paddingHorizontal: 4 },
  ipTerm: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  ipTermVal: { color: T.text, fontWeight: '900' },
  ipBtnRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  ipBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: T.border },
  ipBtnTxt: { color: T.cardDark, fontWeight: '900', fontSize: 12 },
  ipModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  ipModalCard: { backgroundColor: '#4d5058', padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: T.border },
  ipModalTitle: { color: T.text, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  ipModalSub: { color: T.textDim, fontSize: 12, marginBottom: 12 },
  ipNumRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ipToggle: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: T.border, backgroundColor: T.cardDark },
  ipToggleOn: { backgroundColor: T.yellow, borderColor: T.yellow },
  ipToggleTxt: { color: T.text, fontWeight: '800', fontSize: 12 },
});
