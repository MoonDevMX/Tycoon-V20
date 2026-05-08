import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, IconTile, NeonStat, SectionHeader } from '../src/ui/components';
import { uiAlert } from '../src/ui/ui-alert';
import { Festival, FestivalLot } from '../src/game/types';

export default function FestivalsScreen() {
  const router = useRouter();
  const { state, placeFestivalBid } = useGame();
  const [activeLot, setActiveLot] = useState<{ fest: Festival; lot: FestivalLot } | null>(null);
  const [bidVal, setBidVal] = useState('');

  if (!state) return null;
  const fests = state.festivals || [];
  const active = fests.filter(f => f.status === 'active');
  const concluded = fests.filter(f => f.status === 'concluded').slice(-6).reverse();

  const openBid = (fest: Festival, lot: FestivalLot) => {
    setActiveLot({ fest, lot });
    setBidVal((lot.currentBidM + 1).toFixed(1));
  };

  const submitBid = () => {
    if (!activeLot) return;
    const v = parseFloat(bidVal);
    if (isNaN(v) || v <= 0) { uiAlert('Invalid', 'Enter a positive bid in $M.'); return; }
    const r = placeFestivalBid(activeLot.fest.id, activeLot.lot.id, v);
    if (r.error) { uiAlert('Bid Failed', r.error); return; }
    const fest = (state.festivals || []).find(f => f.id === activeLot.fest.id);
    const lot = fest?.lots.find(l => l.id === activeLot.lot.id);
    const youHigh = lot?.currentBidderStudioId === state.player.id;
    uiAlert(
      'Bid Submitted',
      youHigh
        ? `You're the high bidder at $${lot?.currentBidM.toFixed(1)}M.`
        : `A rival countered with $${lot?.currentBidM.toFixed(1)}M. Bid again to stay in!`,
    );
    setActiveLot(null);
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Film Festivals" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {fests.length === 0 ? (
          <View style={s.empty}>
            <MaterialCommunityIcons name="filmstrip" size={64} color={T.textDim} />
            <Text style={s.emptyTxt}>No festivals yet — one opens each season (Wk 6, 18, 30, 42).</Text>
          </View>
        ) : null}

        {active.length > 0 ? <SectionHeader title="Live Festivals" /> : null}
        {active.map(fest => (
          <View key={fest.id} style={s.festCard} testID={`fest-${fest.id}`}>
            <View style={s.festHead}>
              <MaterialCommunityIcons name="movie-roll" size={28} color={T.yellow} />
              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <Text style={s.festName}>{fest.name}</Text>
                <Text style={s.festSub}>{fest.season} · {fest.region} · Opened Wk {fest.week}, Y{fest.year}</Text>
              </View>
              <View style={s.liveBadge}><Text style={s.liveTxt}>LIVE</Text></View>
            </View>
            {fest.lots.map(lot => {
              const movie = state.movies.find(m => m.id === lot.movieId);
              if (!movie) return null;
              const highBidder = lot.currentBidderStudioId === state.player.id ? 'YOU' : (state.rivals.find(r => r.id === lot.currentBidderStudioId)?.name || '—');
              return (
                <TouchableOpacity key={lot.id} style={s.lotRow} onPress={() => openBid(fest, lot)} testID={`lot-${lot.id}`}>
                  <IconTile icon={movie.iconKey} color={movie.iconBg} size={48} />
                  <View style={{ flex: 1, paddingHorizontal: 8 }}>
                    <Text style={s.lotTitle} numberOfLines={1}>{movie.title}</Text>
                    <Text style={s.lotSub}>{movie.genre} · {movie.criticScore}/100 · Budget ${movie.budget}M</Text>
                    <Text style={[s.lotBid, { color: lot.currentBidderStudioId === state.player.id ? T.green : T.yellow }]}>${lot.currentBidM.toFixed(1)}M · High: {highBidder}</Text>
                  </View>
                  <MaterialCommunityIcons name="gavel" size={22} color={T.cyan} />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {concluded.length > 0 ? <SectionHeader title="Recent Festivals" /> : null}
        {concluded.map(fest => (
          <View key={fest.id} style={[s.festCard, { opacity: 0.85 }]}>
            <View style={s.festHead}>
              <MaterialCommunityIcons name="check-decagram" size={24} color={T.green} />
              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <Text style={s.festName}>{fest.name}</Text>
                <Text style={s.festSub}>{fest.season} · {fest.region} · Closed Wk {fest.closedAt?.week}, Y{fest.closedAt?.year}</Text>
              </View>
            </View>
            {fest.lots.map(lot => {
              const movie = state.movies.find(m => m.id === lot.movieId);
              if (!movie) return null;
              const winnerName = lot.winnerStudioId === state.player.id ? 'YOU' : (state.rivals.find(r => r.id === lot.winnerStudioId)?.name || 'Unsold');
              return (
                <View key={lot.id} style={s.lotRow}>
                  <IconTile icon={movie.iconKey} color={movie.iconBg} size={40} />
                  <View style={{ flex: 1, paddingHorizontal: 8 }}>
                    <Text style={s.lotTitle} numberOfLines={1}>{movie.title}</Text>
                    <Text style={s.lotSub}>Won by: <Text style={{ color: lot.winnerStudioId === state.player.id ? T.green : T.text, fontWeight: '900' }}>{winnerName}</Text> · ${lot.finalPriceM?.toFixed(1) ?? '—'}M</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!activeLot} transparent animationType="slide" onRequestClose={() => setActiveLot(null)}>
        {activeLot ? (() => {
          const movie = state.movies.find(m => m.id === activeLot.lot.movieId);
          if (!movie) return <View />;
          const minBid = activeLot.lot.currentBidM + 1;
          return (
            <View style={s.modalBg}>
              <View style={s.modalCard}>
                <View style={{ alignItems: 'center' }}>
                  <IconTile icon={movie.iconKey} color={movie.iconBg} size={72} />
                  <Text style={s.modalTitle}>{movie.title}</Text>
                  <Text style={s.modalSub}>{activeLot.fest.name} · {movie.genre}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  <NeonStat label="HIGH BID" value={`$${activeLot.lot.currentBidM.toFixed(1)}M`} color={T.yellow} />
                  <NeonStat label="CRITIC" value={movie.criticScore} color={T.cyan} />
                  <NeonStat label="BUDGET" value={`${movie.budget}M`} color={T.green} />
                </View>
                <Text style={s.bidLabel}>YOUR BID ($M) — minimum ${minBid.toFixed(1)}M</Text>
                <View style={s.bidRow}>
                  <TextInput value={bidVal} onChangeText={setBidVal} keyboardType="numeric" style={s.bidInput} testID="festival-bid-input" />
                  <Text style={s.bidCurr}>M</Text>
                </View>
                <Text style={s.bidHint}>Cash on hand: ${(state.player.cash * 1000).toFixed(0)}M</Text>
                <TouchableOpacity style={s.bidSubmit} onPress={submitBid} testID="festival-bid-submit">
                  <MaterialCommunityIcons name="gavel" size={20} color={T.cardDark} />
                  <Text style={s.bidSubmitTxt}>PLACE BID</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.bidCancel} onPress={() => setActiveLot(null)}>
                  <Text style={s.bidCancelTxt}>Close</Text>
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
  empty: { alignItems: 'center', padding: 32 },
  emptyTxt: { color: T.textDim, fontSize: 13, marginTop: 12, textAlign: 'center' },
  festCard: { backgroundColor: T.cardDark, padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 2, borderColor: T.border },
  festHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  festName: { color: T.text, fontWeight: '900', fontSize: 16 },
  festSub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  liveBadge: { backgroundColor: T.red, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  liveTxt: { color: '#fff', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  lotRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, padding: 8, borderRadius: 6, marginTop: 6, borderWidth: 1, borderColor: T.border },
  lotTitle: { color: T.text, fontWeight: '800', fontSize: 14 },
  lotSub: { color: T.textDim, fontSize: 11, marginTop: 2 },
  lotBid: { fontWeight: '900', fontSize: 13, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#4d5058', padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: T.border },
  modalTitle: { color: T.text, fontSize: 22, fontWeight: '900', marginTop: 8 },
  modalSub: { color: T.cyan, fontSize: 13, fontWeight: '700' },
  bidLabel: { color: T.yellow, fontSize: 12, fontWeight: '900', marginTop: 14, letterSpacing: 1 },
  bidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bidInput: { flex: 1, backgroundColor: T.cardDark, color: T.text, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, borderWidth: 2, borderColor: T.border, fontSize: 18, fontWeight: '900' },
  bidCurr: { color: T.green, fontWeight: '900', fontSize: 18 },
  bidHint: { color: T.textDim, fontSize: 11, marginTop: 4 },
  bidSubmit: { flexDirection: 'row', backgroundColor: T.green, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 6, borderWidth: 2, borderColor: T.border },
  bidSubmitTxt: { color: T.cardDark, fontWeight: '900', fontSize: 15 },
  bidCancel: { paddingVertical: 12, alignItems: 'center' },
  bidCancelTxt: { color: T.textDim, fontWeight: '700' },
});
