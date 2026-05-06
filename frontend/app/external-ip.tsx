import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { T } from '../src/ui/theme';
import { TopBar, SectionHeader } from '../src/ui/components';
import { uiAlert } from '../src/ui/ui-alert';
import { IPCategory } from '../src/game/types';

const CAT_LABEL: Record<IPCategory, string> = {
  book: 'Book', video_game: 'Video Game', toy: 'Toy', sports: 'Sports', comic: 'Comic', music: 'Music',
};
const CAT_ICON: Record<IPCategory, string> = {
  book: 'book-open-variant', video_game: 'gamepad-variant', toy: 'teddy-bear', sports: 'basketball', comic: 'book-multiple', music: 'music-circle',
};

export default function ExternalIPPage() {
  const router = useRouter();
  const { state, acceptIPOffer, counterIPOffer, rejectIPOffer, createOutboundIPListing, acceptOutboundBid, rejectOutboundBid } = useGame();
  const [tab, setTab] = useState<'inbound' | 'outbound' | 'mine'>('inbound');
  const [counterId, setCounterId] = useState<string | null>(null);
  const [cFee, setCFee] = useState(''); const [cBO, setCBO] = useState(''); const [cMerch, setCMerch] = useState(''); const [cYears, setCYears] = useState(''); const [cPacks, setCPacks] = useState(''); const [cExcl, setCExcl] = useState(false); const [cSub, setCSub] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listFranchiseId, setListFranchiseId] = useState<string | null>(null);
  const [listCategory, setListCategory] = useState<IPCategory>('video_game');

  if (!state) return null;

  const inbound = (state.externalIPOffers || []).filter(o => o.status === 'pending');
  const myLicenses = (state.ownedIPLicenses || []).filter(l => l.studioId === state.player.id);
  const myListings = (state.outboundIPListings || []).filter(l => l.studioId === state.player.id);
  const myBids = (state.outboundIPBids || []).filter(b => b.status === 'pending' && myListings.some(l => l.id === b.listingId));
  const myFranchises = state.franchises.filter(f => f.studioId === state.player.id);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <TopBar title="External IP Licensing" onBack={() => router.back()} />
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === 'inbound' && s.tabActive]} onPress={() => setTab('inbound')} testID="tab-inbound">
          <Text style={[s.tabTxt, tab === 'inbound' && s.tabTxtActive]}>Inbound ({inbound.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'mine' && s.tabActive]} onPress={() => setTab('mine')} testID="tab-mine">
          <Text style={[s.tabTxt, tab === 'mine' && s.tabTxtActive]}>My Licenses ({myLicenses.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'outbound' && s.tabActive]} onPress={() => setTab('outbound')} testID="tab-outbound">
          <Text style={[s.tabTxt, tab === 'outbound' && s.tabTxtActive]}>Outbound ({myListings.filter(l => l.status === 'open').length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
        {tab === 'inbound' && (
          inbound.length === 0 ? (
            <Text style={s.empty}>No pending offers. Watch this space — agencies pitch periodically.</Text>
          ) : inbound.map(o => {
            const ip = state.externalIPs?.find(i => i.id === o.ipId);
            const lic = state.externalLicensors?.find(l => l.id === o.fromStudioId);
            if (!ip || !lic) return null;
            return (
              <View key={o.id} style={s.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <MaterialCommunityIcons name={CAT_ICON[ip.category] as any} size={22} color={T.cyan} />
                  <Text style={s.cardTitle}>  {ip.name}</Text>
                </View>
                <Text style={s.cardSub}>{lic.name} · {CAT_LABEL[ip.category]} · Pop {ip.popularity}/100</Text>
                <View style={s.terms}>
                  <Text style={s.term}>Fee: <Text style={s.termVal}>${o.feeM.toFixed(1)}M</Text></Text>
                  <Text style={s.term}>BO%: <Text style={s.termVal}>{o.boPercent}%</Text></Text>
                  <Text style={s.term}>Merch%: <Text style={s.termVal}>{o.merchPercent}%</Text></Text>
                  <Text style={s.term}>Term: <Text style={s.termVal}>{o.years}y</Text></Text>
                  <Text style={s.term}>Packs: <Text style={s.termVal}>{o.packs}</Text></Text>
                  {o.exclusivity ? <Text style={[s.term, { color: T.yellow }]}>EXCLUSIVE</Text> : null}
                  {o.sublicensable ? <Text style={[s.term, { color: T.magenta }]}>SUBLICENSABLE</Text> : null}
                </View>
                <View style={s.row}>
                  <TouchableOpacity style={[s.btn, { backgroundColor: T.green }]} onPress={() => {
                    const r = acceptIPOffer(o.id);
                    if (r.error) uiAlert('Cannot Accept', r.error);
                  }} testID={`accept-ip-${o.id}`}>
                    <Text style={s.btnTxt}>ACCEPT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: T.yellow }]} onPress={() => {
                    setCounterId(o.id); setCFee(String(o.feeM)); setCBO(String(o.boPercent)); setCMerch(String(o.merchPercent)); setCYears(String(o.years)); setCPacks(String(o.packs)); setCExcl(o.exclusivity); setCSub(o.sublicensable);
                  }} testID={`counter-ip-${o.id}`}>
                    <Text style={s.btnTxt}>COUNTER</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: T.red }]} onPress={() => rejectIPOffer(o.id)} testID={`reject-ip-${o.id}`}>
                    <Text style={s.btnTxt}>REJECT</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {tab === 'mine' && (
          myLicenses.length === 0 ? <Text style={s.empty}>No active IP licenses. Accept an inbound offer to start building hits.</Text> :
          myLicenses.map(l => {
            const ip = state.externalIPs?.find(i => i.id === l.ipId);
            if (!ip) return null;
            return (
              <View key={l.id} style={s.card}>
                <Text style={s.cardTitle}>{ip.name}</Text>
                <Text style={s.cardSub}>{CAT_LABEL[ip.category]} · Pop {ip.popularity}/100</Text>
                <View style={s.terms}>
                  <Text style={s.term}>Packs: <Text style={s.termVal}>{l.packsUsed}/{l.packs}</Text></Text>
                  <Text style={s.term}>BO Royalty: <Text style={s.termVal}>{l.boPercent}%</Text></Text>
                  <Text style={s.term}>Merch: <Text style={s.termVal}>{l.merchPercent}%</Text></Text>
                  <Text style={s.term}>Expires: <Text style={s.termVal}>W{l.expiresWeek} Y{l.expiresYear}</Text></Text>
                  {l.exclusivity ? <Text style={[s.term, { color: T.yellow }]}>EXCLUSIVE</Text> : null}
                </View>
                <Text style={s.cardFoot}>Attach this IP when creating a movie for popularity, fame & BO boosts.</Text>
              </View>
            );
          })
        )}

        {tab === 'outbound' && (
          <>
            <TouchableOpacity style={[s.btn, { backgroundColor: T.cyan, marginBottom: 12 }]} onPress={() => setListOpen(true)} testID="create-listing-btn">
              <MaterialCommunityIcons name="plus" size={18} color={T.cardDark} />
              <Text style={[s.btnTxt, { color: T.cardDark }]}>List Franchise for Spin-offs</Text>
            </TouchableOpacity>

            <SectionHeader title="Pending Bids" />
            {myBids.length === 0 ? <Text style={s.empty}>No pending bids yet — agencies bid periodically on open listings.</Text> :
              myBids.map(b => {
                const list = myListings.find(l => l.id === b.listingId);
                const fr = list?.sourceFranchiseId ? state.franchises.find(f => f.id === list.sourceFranchiseId) : null;
                const lic = state.externalLicensors?.find(l => l.id === b.licensorId);
                return (
                  <View key={b.id} style={s.card}>
                    <Text style={s.cardTitle}>{fr?.name || 'Listing'} → {CAT_LABEL[list!.category]}</Text>
                    <Text style={s.cardSub}>{lic?.name}</Text>
                    <View style={s.terms}>
                      <Text style={s.term}>Upfront: <Text style={s.termVal}>${b.feeM.toFixed(1)}M</Text></Text>
                      <Text style={s.term}>Royalty: <Text style={s.termVal}>{b.royaltyPercent}%</Text></Text>
                      <Text style={s.term}>Term: <Text style={s.termVal}>{b.years}y</Text></Text>
                    </View>
                    <View style={s.row}>
                      <TouchableOpacity style={[s.btn, { backgroundColor: T.green }]} onPress={() => {
                        const r = acceptOutboundBid(b.id);
                        if (r.error) uiAlert('Cannot Accept', r.error);
                      }} testID={`accept-bid-${b.id}`}>
                        <Text style={s.btnTxt}>ACCEPT</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.btn, { backgroundColor: T.red }]} onPress={() => rejectOutboundBid(b.id)} testID={`reject-bid-${b.id}`}>
                        <Text style={s.btnTxt}>REJECT</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

            <SectionHeader title="My Listings" />
            {myListings.length === 0 ? <Text style={s.empty}>No listings yet.</Text> :
              myListings.map(l => {
                const fr = l.sourceFranchiseId ? state.franchises.find(f => f.id === l.sourceFranchiseId) : null;
                return (
                  <View key={l.id} style={s.card}>
                    <Text style={s.cardTitle}>{fr?.name || 'Listing'} — {CAT_LABEL[l.category]}</Text>
                    <Text style={s.cardSub}>Status: {l.status.toUpperCase()} · Listed W{l.createdWeek}Y{l.createdYear}</Text>
                  </View>
                );
              })}
          </>
        )}
      </ScrollView>

      {/* Counter modal */}
      <Modal visible={!!counterId} transparent animationType="slide" onRequestClose={() => setCounterId(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Counter Offer</Text>
            <View style={s.numRow}>
              <NumInput label="Fee ($M)" value={cFee} onChange={setCFee} testID="c-fee" />
              <NumInput label="BO %" value={cBO} onChange={setCBO} testID="c-bo" />
            </View>
            <View style={s.numRow}>
              <NumInput label="Merch %" value={cMerch} onChange={setCMerch} testID="c-merch" />
              <NumInput label="Years" value={cYears} onChange={setCYears} testID="c-years" />
            </View>
            <View style={s.numRow}>
              <NumInput label="Packs" value={cPacks} onChange={setCPacks} testID="c-packs" />
              <View style={{ flex: 1 }} />
            </View>
            <View style={s.row}>
              <TouchableOpacity style={[s.toggle, cExcl && s.toggleOn]} onPress={() => setCExcl(v => !v)} testID="c-excl">
                <Text style={[s.toggleTxt, cExcl && { color: T.cardDark }]}>Exclusive {cExcl ? '✓' : ''}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.toggle, cSub && s.toggleOn]} onPress={() => setCSub(v => !v)} testID="c-sub">
                <Text style={[s.toggleTxt, cSub && { color: T.cardDark }]}>Sublicensable {cSub ? '✓' : ''}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.btn, { backgroundColor: T.green, marginTop: 12 }]} onPress={() => {
              if (!counterId) return;
              const r = counterIPOffer(counterId, {
                feeM: parseFloat(cFee) || 0,
                boPercent: parseFloat(cBO) || 0,
                merchPercent: parseFloat(cMerch) || 0,
                years: parseInt(cYears, 10) || 0,
                packs: parseInt(cPacks, 10) || 0,
                exclusivity: cExcl,
                sublicensable: cSub,
              });
              if (r.error) uiAlert('Counter Failed', r.error); else setCounterId(null);
            }} testID="submit-counter">
              <Text style={s.btnTxt}>SUBMIT COUNTER</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: T.card }]} onPress={() => setCounterId(null)}>
              <Text style={s.btnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* List franchise modal */}
      <Modal visible={listOpen} transparent animationType="slide" onRequestClose={() => setListOpen(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>List a Franchise</Text>
            <Text style={s.modalSub}>Pick a franchise + spin-off category. External agencies will bid.</Text>
            <Text style={s.fieldLbl}>FRANCHISE</Text>
            <ScrollView style={{ maxHeight: 180 }}>
              {myFranchises.length === 0 ? <Text style={s.empty}>You don't own any franchises yet.</Text> :
                myFranchises.map(f => (
                  <TouchableOpacity key={f.id} style={[s.frRow, listFranchiseId === f.id && { borderColor: T.cyan }]} onPress={() => setListFranchiseId(f.id)} testID={`list-fr-${f.id}`}>
                    <Text style={s.frTxt}>{f.name}</Text>
                    <Text style={s.frSub}>Pop {f.popularity}/100</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <Text style={s.fieldLbl}>SPIN-OFF CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              {(['book', 'video_game', 'toy', 'sports', 'comic', 'music'] as IPCategory[]).map(c => (
                <TouchableOpacity key={c} style={[s.chip, listCategory === c && { backgroundColor: T.cyan, borderColor: T.cyan }]} onPress={() => setListCategory(c)} testID={`list-cat-${c}`}>
                  <Text style={[s.chipTxt, listCategory === c && { color: T.cardDark }]}>{CAT_LABEL[c]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[s.btn, { backgroundColor: T.green, marginTop: 16 }]} onPress={() => {
              if (!listFranchiseId) { uiAlert('Pick a franchise', 'Select one first.'); return; }
              const r = createOutboundIPListing({ sourceFranchiseId: listFranchiseId, category: listCategory });
              if (r.error) uiAlert('Failed', r.error); else { setListOpen(false); setListFranchiseId(null); }
            }} testID="confirm-listing">
              <Text style={s.btnTxt}>LIST FRANCHISE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: T.card }]} onPress={() => setListOpen(false)}>
              <Text style={s.btnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function NumInput({ label, value, onChange, testID }: { label: string; value: string; onChange: (v: string) => void; testID: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.numLbl}>{label}</Text>
      <TextInput value={value} onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ''))} keyboardType="numeric" style={s.numInp} testID={testID} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  tabs: { flexDirection: 'row', backgroundColor: T.cardDark, borderBottomWidth: 2, borderColor: T.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { backgroundColor: T.card },
  tabTxt: { color: T.textDim, fontWeight: '700', fontSize: 12 },
  tabTxtActive: { color: T.cyan },
  empty: { color: T.textDim, textAlign: 'center', padding: 24, fontSize: 13 },
  card: { backgroundColor: T.card, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 2, borderColor: T.border },
  cardTitle: { color: T.text, fontWeight: '900', fontSize: 16 },
  cardSub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  cardFoot: { color: T.textDim, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  terms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 },
  term: { color: T.textDim, fontSize: 11, fontWeight: '700' },
  termVal: { color: T.text, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  btnTxt: { color: T.cardDark, fontWeight: '900', fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#4d5058', padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: T.border },
  modalTitle: { color: T.text, fontSize: 22, fontWeight: '900' },
  modalSub: { color: T.textDim, fontSize: 12, marginTop: 4, marginBottom: 8 },
  numRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  numLbl: { color: T.yellow, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  numInp: { backgroundColor: T.cardDark, color: T.text, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2, borderColor: T.border, marginTop: 4, fontSize: 16, fontWeight: '900' },
  fieldLbl: { color: T.yellow, marginTop: 14, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  frRow: { backgroundColor: T.cardDark, borderRadius: 8, borderWidth: 2, borderColor: T.border, padding: 10, marginTop: 6 },
  frTxt: { color: T.text, fontWeight: '900', fontSize: 14 },
  frSub: { color: T.textDim, fontSize: 11 },
  chip: { backgroundColor: T.cardDark, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: T.border, marginRight: 6 },
  chipTxt: { color: T.text, fontWeight: '800', fontSize: 12 },
  toggle: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2, borderColor: T.border, backgroundColor: T.cardDark, alignItems: 'center' },
  toggleOn: { backgroundColor: T.cyan, borderColor: T.cyan },
  toggleTxt: { color: T.text, fontWeight: '800', fontSize: 12 },
});
