import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../../src/game/state';
import { T } from '../../src/ui/theme';
import { TopBar, Avatar, NeonStat, SectionHeader } from '../../src/ui/components';
import { COLOR_HEX, GENRES } from '../../src/game/data';
import { calculateTalentExpectations, calculateAcceptance, talentAvailability } from '../../src/game/sim';

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

function prettyRole(r: string) {
  return r.replace('lead_', 'Leading ').replace('support_', 'Support ').replace('actor', 'Actor').replace('actress', 'Actress').replace('writer', 'Writer').replace('director', 'Director');
}

export default function TalentDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, hireTalent, fireTalent } = useGame();
  
  const [showHireModal, setShowHireModal] = useState(false);
  const [numMovies, setNumMovies] = useState(2);
  const [upfrontInput, setUpfrontInput] = useState('');
  const [boPercentInput, setBoPercentInput] = useState('');

  const t = state ? state.talents.find(x => x.id === id) : undefined;

  // Initialize inputs when modal opens — MUST be before any conditional return
  useEffect(() => {
    if (showHireModal && t) {
      const exp = calculateTalentExpectations(t, numMovies);
      setUpfrontInput(exp.minUpfront.toFixed(1));
      setBoPercentInput(exp.minBoPercent.toString());
    }
  }, [showHireModal, numMovies, t]);

  if (!state) return null;
  if (!t) return <View style={s.container}><Text style={{ color: T.text, padding: 20 }}>Talent not found</Text></View>;

  const movies = state.movies.filter(m => m.writerId === t.id || m.directorId === t.id || m.cast.some(c => c.talentId === t.id));
  const isMyContract = t.underContract?.studioId === state.player.id;
  const isTaken = t.underContract && !isMyContract;

  const upfront = parseFloat(upfrontInput) || 0;
  const boPercent = parseFloat(boPercentInput) || 0;
  const acceptance = calculateAcceptance(t, numMovies, upfront, boPercent);
  const expectations = calculateTalentExpectations(t, numMovies);

  const handleHire = () => {
    const r = hireTalent({ talentId: t.id, numMovies, upfrontPayment: upfront, boPercent });
    if (r.error) {
      notify(r.accepted === false ? 'Offer Rejected' : 'Cannot Sign', r.error);
    } else {
      notify('Contract Signed!', `${t.name} accepted your ${numMovies}-movie deal!`);
      setShowHireModal(false);
    }
  };

  const handleFire = () => {
    const r = fireTalent(t.id);
    if (r.error) {
      notify('Cannot Release', r.error);
    } else {
      notify('Contract Terminated', `${t.name} has been released.`);
    }
  };

  const verdictColor = (v: string) => {
    if (v === 'will_accept') return T.green;
    if (v === 'likely_accept') return '#8BC34A';
    if (v === 'considering') return T.yellow;
    if (v === 'unlikely') return T.orange;
    return '#E74C3C';
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Talent" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.header}>
          <Avatar skin={t.avatarColor} hair={t.hairColor} size={100} />
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.title}>{t.name}</Text>
              <View style={[s.colorDot, { backgroundColor: COLOR_HEX[t.colorTrait] }]} />
            </View>
            <Text style={s.sub}>{prettyRole(t.role)} · {t.gender === 'female' ? 'Female' : 'Male'} · Age {t.age}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <NeonStat label="SKILL" value={t.skill} color={T.cyan} />
              <NeonStat label="FAME" value={t.fame} color={T.pink} />
              <NeonStat label="SALARY" value={`${t.salary.toFixed(1)}M`} color={T.green} />
            </View>
          </View>
        </View>

        {/* Contract Status & Actions */}
        <View style={s.contractSection}>
          {isMyContract && t.underContract ? (
            <View style={s.contractCard}>
              <View style={s.contractHeader}>
                <MaterialCommunityIcons name="file-document-check" size={24} color={T.green} />
                <Text style={s.contractTitle}>Under Contract</Text>
              </View>
              <View style={s.contractStats}>
                <View style={s.contractStat}>
                  <Text style={s.contractStatValue}>{t.underContract.remainingMovies}</Text>
                  <Text style={s.contractStatLabel}>Movies Left</Text>
                </View>
                <View style={s.contractStat}>
                  <Text style={s.contractStatValue}>${t.underContract.upfrontPaid?.toFixed(1) || 0}M</Text>
                  <Text style={s.contractStatLabel}>Paid Upfront</Text>
                </View>
                <View style={s.contractStat}>
                  <Text style={s.contractStatValue}>{t.underContract.boPercent || 0}%</Text>
                  <Text style={s.contractStatLabel}>BO Share</Text>
                </View>
              </View>
              <TouchableOpacity style={s.releaseBtn} onPress={handleFire}>
                <MaterialCommunityIcons name="account-off" size={18} color={T.orange} />
                <Text style={s.releaseTxt}>Release from Contract</Text>
              </TouchableOpacity>
            </View>
          ) : isTaken ? (
            <View style={[s.contractCard, { borderColor: T.orange }]}>
              <View style={s.contractHeader}>
                <MaterialCommunityIcons name="lock" size={24} color={T.orange} />
                <Text style={[s.contractTitle, { color: T.orange }]}>Under Contract (Another Studio)</Text>
              </View>
              <Text style={s.takenText}>This talent is currently signed to another studio and unavailable.</Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={s.hireCard} onPress={() => setShowHireModal(true)}>
                <MaterialCommunityIcons name="account-plus" size={28} color={T.green} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.hireCta}>Quick Sign</Text>
                  <Text style={s.hireHint}>Make an offer with quick presets</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={T.textMute} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.hireCard, { borderColor: T.pink }]} onPress={() => router.push(`/negotiate/${t.id}`)} testID="negotiate-btn">
                <MaterialCommunityIcons name="handshake" size={28} color={T.pink} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.hireCta, { color: T.pink }]}>Negotiate Contract</Text>
                  <Text style={s.hireHint}>Pull-and-push: 3 rounds, sliders & counter-offers</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={T.textMute} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <SectionHeader title="Career Stats" />
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, flexWrap: 'wrap' }}>
          <NeonStat label="MOVIES" value={t.movies} color={T.cyan} />
          <NeonStat label="AVG REVIEW" value={t.reviewAvg ? t.reviewAvg.toFixed(0) : '-'} color={T.yellow} />
          <NeonStat label="TOTAL B.O." value={`${t.totalBO.toFixed(2)}B`} color={T.magenta} />
        </View>

        {/* Granular skills breakdown — BOS-style */}
        {t.skills ? (
          <View>
            <SectionHeader title="Skill Breakdown" />
            <View style={s.skillBlock}>
              {Object.entries(t.skills).map(([k, v]) => {
                if (typeof v !== 'number') return null;
                const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1');
                const color = v >= 85 ? T.green : v >= 65 ? T.cyan : v >= 50 ? T.yellow : T.orange;
                return (
                  <View key={k} style={s.skillRow}>
                    <Text style={s.skillLbl}>{label}</Text>
                    <View style={s.skillBarBg}>
                      <View style={[s.skillBarFg, { width: `${v}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[s.skillVal, { color }]}>{v}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Genre proficiencies */}
        {t.genreSkills ? (
          <View>
            <SectionHeader title="Genre Proficiencies" />
            <View style={s.skillBlock}>
              {GENRES.slice().sort((a, b) => ((t.genreSkills as any)?.[b] || 0) - ((t.genreSkills as any)?.[a] || 0)).map(g => {
                const v = (t.genreSkills as any)?.[g] || 0;
                const color = v >= 85 ? T.green : v >= 65 ? T.cyan : v >= 50 ? T.yellow : T.orange;
                return (
                  <View key={g} style={s.skillRow}>
                    <Text style={s.skillLbl}>{g}</Text>
                    <View style={s.skillBarBg}>
                      <View style={[s.skillBarFg, { width: `${v}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[s.skillVal, { color }]}>{v}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <SectionHeader title={`Filmography (${movies.length})`} />
        {movies.length === 0 ? (
          <Text style={s.empty}>No films yet.</Text>
        ) : movies.map(m => (
          <TouchableOpacity key={m.id} style={s.movieRow} onPress={() => router.push(`/movie/${m.id}`)}>
            <Text style={s.movieTitle}>{m.title}</Text>
            <Text style={s.movieSub}>{m.brand} · Y{m.releaseYear || '-'} · {m.criticScore || '-'}/100</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Hire Modal */}
      <Modal visible={showHireModal} transparent animationType="fade" onRequestClose={() => setShowHireModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalBg}>
            <View style={s.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={s.modalTitle}>Sign {t.name}</Text>
                <Text style={s.modalSub}>{prettyRole(t.role)} · Base Salary: ${t.salary.toFixed(1)}M/movie</Text>

                <Text style={s.modalLabel}>Contract Length</Text>
                <View style={s.movieRow2}>
                  {[1, 2, 3].map(n => (
                    <TouchableOpacity 
                      key={n} 
                      style={[s.movieChip, numMovies === n && s.movieChipActive]} 
                      onPress={() => setNumMovies(n)}
                    >
                      <Text style={[s.movieTxt, numMovies === n && s.movieTxtActive]}>{n} Movie{n > 1 ? 's' : ''}</Text>
                      <Text style={[s.discountTxt, numMovies === n && { color: T.cardDark }]}>
                        {n === 1 ? 'Full price' : n === 2 ? '10% off' : '20% off'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.inputRow}>
                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>Upfront ($M)</Text>
                    <TextInput
                      style={s.input}
                      value={upfrontInput}
                      onChangeText={setUpfrontInput}
                      keyboardType="decimal-pad"
                      placeholder="0.0"
                      placeholderTextColor={T.textMute}
                    />
                    <Text style={s.inputHint}>${expectations.minUpfront.toFixed(1)} - ${expectations.maxUpfront.toFixed(1)}M</Text>
                  </View>
                  <View style={s.inputGroup}>
                    <Text style={s.inputLabel}>BO % (0-15)</Text>
                    <TextInput
                      style={s.input}
                      value={boPercentInput}
                      onChangeText={setBoPercentInput}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={T.textMute}
                    />
                    <Text style={s.inputHint}>Expects {expectations.minBoPercent}-{expectations.maxBoPercent}%</Text>
                  </View>
                </View>

                <View style={[s.acceptanceBox, { borderColor: verdictColor(acceptance.verdict) }]}>
                  <View style={s.acceptanceHeader}>
                    <MaterialCommunityIcons 
                      name={acceptance.verdict.includes('accept') ? 'thumb-up' : acceptance.verdict === 'considering' ? 'help-circle' : 'thumb-down'} 
                      size={22} 
                      color={verdictColor(acceptance.verdict)} 
                    />
                    <Text style={[s.acceptanceVerdict, { color: verdictColor(acceptance.verdict) }]}>
                      {acceptance.verdict.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                    <Text style={s.acceptanceProb}>{Math.round(acceptance.probability * 100)}%</Text>
                  </View>
                  <Text style={s.acceptanceReason}>{acceptance.reason}</Text>
                </View>

                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setShowHireModal(false)}>
                    <Text style={s.cancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.confirmBtn, { opacity: upfront > 0 ? 1 : 0.5 }]} onPress={handleHire} disabled={upfront <= 0}>
                    <MaterialCommunityIcons name="handshake" size={18} color={T.cardDark} />
                    <Text style={s.confirmTxt}>Make Offer</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', backgroundColor: T.cardDark, padding: 16 },
  title: { color: T.text, fontSize: 24, fontWeight: '900' },
  sub: { color: T.textDim, fontSize: 14, marginTop: 4 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  contractSection: { padding: 12 },
  contractCard: { backgroundColor: T.cardDark, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: T.green },
  contractHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contractTitle: { color: T.green, fontSize: 16, fontWeight: '900' },
  contractStats: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  contractStat: { alignItems: 'center' },
  contractStatValue: { color: T.text, fontSize: 20, fontWeight: '900' },
  contractStatLabel: { color: T.textDim, fontSize: 11, marginTop: 2 },
  releaseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: T.orange },
  releaseTxt: { color: T.orange, fontWeight: '800' },
  takenText: { color: T.textDim, fontSize: 13, marginTop: 8 },
  hireCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: T.green },
  hireCta: { color: T.green, fontSize: 16, fontWeight: '900' },
  hireHint: { color: T.textDim, fontSize: 12, marginTop: 2 },
  empty: { color: T.textMute, padding: 16, fontStyle: 'italic' },
  movieRow: { backgroundColor: T.cardDark, padding: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  movieTitle: { color: T.text, fontWeight: '800', fontSize: 15 },
  movieSub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: T.cardDark, padding: 16, borderRadius: 16, width: '100%', maxWidth: 380, maxHeight: '85%', borderWidth: 2, borderColor: T.border },
  modalTitle: { color: T.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  modalSub: { color: T.textDim, fontSize: 12, textAlign: 'center', marginTop: 4 },
  modalLabel: { color: T.textDim, fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  movieRow2: { flexDirection: 'row', gap: 8 },
  movieChip: { flex: 1, backgroundColor: T.card, paddingVertical: 10, borderRadius: 8, borderWidth: 2, borderColor: T.border, alignItems: 'center' },
  movieChipActive: { backgroundColor: T.cyan, borderColor: T.cyan },
  movieTxt: { color: T.text, fontWeight: '900', fontSize: 14 },
  movieTxtActive: { color: T.cardDark },
  discountTxt: { color: T.textMute, fontSize: 10, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { color: T.textDim, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  input: { backgroundColor: T.card, borderWidth: 2, borderColor: T.border, color: T.text, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  inputHint: { color: T.textMute, fontSize: 10, marginTop: 4, textAlign: 'center' },
  acceptanceBox: { marginTop: 14, padding: 12, borderRadius: 10, borderWidth: 2, backgroundColor: T.card },
  acceptanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptanceVerdict: { fontWeight: '900', fontSize: 14, flex: 1 },
  acceptanceProb: { color: T.text, fontWeight: '900', fontSize: 18 },
  acceptanceReason: { color: T.textDim, fontSize: 12, marginTop: 4 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, backgroundColor: T.card, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: T.border },
  cancelTxt: { color: T.text, fontWeight: '800' },
  confirmBtn: { flex: 1.5, backgroundColor: T.green, paddingVertical: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  confirmTxt: { color: T.cardDark, fontWeight: '900' },
  skillBlock: { backgroundColor: T.cardDark, marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: T.border },
  skillRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  skillLbl: { color: T.text, fontSize: 12, fontWeight: '800', width: 90 },
  skillBarBg: { flex: 1, height: 8, backgroundColor: T.card, borderRadius: 4, overflow: 'hidden' },
  skillBarFg: { height: '100%', borderRadius: 4 },
  skillVal: { fontSize: 12, fontWeight: '900', width: 32, textAlign: 'right' },
});
