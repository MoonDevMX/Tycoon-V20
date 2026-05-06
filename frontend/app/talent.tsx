import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ScrollView, Modal, Platform, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../src/game/state';
import { useMovieDraft } from '../src/game/draft';
import { T } from '../src/ui/theme';
import { TopBar, Avatar } from '../src/ui/components';
import { ColorTrait, Gender, Talent, Role } from '../src/game/types';
import { COLORS, COLOR_HEX, COLOR_LABEL, effectiveSkillFor } from '../src/game/data';
import { calculateTalentExpectations, calculateAcceptance, talentAvailability } from '../src/game/sim';

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

type RoleFilter = 'all' | 'writer' | 'director' | 'actor' | 'actress';
type AgeBand = 'any' | 'young' | 'mid' | 'veteran';
type StarBand = 'any' | 'top' | 'mid' | 'rising';
type StatusBand = 'any' | 'available' | 'cooldown' | 'in_production' | 'mine' | 'free_agent';
type SortKey = 'skill' | 'fame' | 'salary' | 'age';

const ROLE_OPTS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'All Roles' },
  { key: 'writer', label: 'Writers' },
  { key: 'director', label: 'Directors' },
  { key: 'actor', label: 'Actors' },
  { key: 'actress', label: 'Actresses' },
];
const STATUS_OPTS: { key: StatusBand; label: string }[] = [
  { key: 'any', label: 'Any Status' },
  { key: 'available', label: 'Available' },
  { key: 'free_agent', label: 'Free Agent' },
  { key: 'mine', label: 'My Roster' },
  { key: 'cooldown', label: 'On Cooldown' },
  { key: 'in_production', label: 'Filming' },
];
const GENDER_OPTS: { key: 'any' | Gender; label: string }[] = [
  { key: 'any', label: 'Any Gender' },
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];
const AGE_OPTS: { key: AgeBand; label: string }[] = [
  { key: 'any', label: 'Any Age' },
  { key: 'young', label: '22-35' },
  { key: 'mid', label: '36-55' },
  { key: 'veteran', label: '56+' },
];
const STAR_OPTS: { key: StarBand; label: string }[] = [
  { key: 'any', label: 'Any Star Power' },
  { key: 'top', label: 'A-List 70+' },
  { key: 'mid', label: 'Mid 40-69' },
  { key: 'rising', label: 'Rising <40' },
];
const SORT_OPTS: { key: SortKey; label: string }[] = [
  { key: 'skill', label: 'Skill ↓' },
  { key: 'fame', label: 'Fame ↓' },
  { key: 'salary', label: 'Salary ↓' },
  { key: 'age', label: 'Age ↑' },
];

function matchRole(t: { role: string }, key: RoleFilter): boolean {
  if (key === 'all') return true;
  return t.role === key;
}

function prettyRole(r: string) {
  if (r === 'writer') return 'Writer';
  if (r === 'director') return 'Director';
  if (r === 'actor') return 'Actor';
  if (r === 'actress') return 'Actress';
  return r;
}

export default function TalentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ selectMode?: string; castIdx?: string; genre?: string }>();
  const { state, hireTalent, fireTalent } = useGame();
  const { draft, setDraft } = useMovieDraft();

  // Selection mode: when arriving from /create-movie, talent DB acts as a picker.
  // Possible values: 'writer' | 'director' | 'cast'. castIdx specifies which cast slot.
  const selectMode = (params.selectMode as 'writer' | 'director' | 'cast' | undefined) || undefined;
  const castIdx = params.castIdx ? parseInt(params.castIdx as string, 10) : undefined;
  const genreFilter = (params.genre as string) || draft.genre;

  // Auto-set role filter based on selectMode
  const initialRole: RoleFilter = selectMode === 'writer' ? 'writer' : selectMode === 'director' ? 'director' : 'all';
  const [role, setRole] = useState<RoleFilter>(initialRole);
  const [gender, setGender] = useState<'any' | Gender>('any');
  const [color, setColor] = useState<'any' | ColorTrait>('any');
  const [ageBand, setAgeBand] = useState<AgeBand>('any');
  const [starBand, setStarBand] = useState<StarBand>('any');
  const [status, setStatus] = useState<StatusBand>('any');
  const [sortKey, setSortKey] = useState<SortKey>(selectMode ? 'fame' : 'skill');
  const [search, setSearch] = useState('');

  // Hire modal state
  const [hireModal, setHireModal] = useState<Talent | null>(null);
  const [numMovies, setNumMovies] = useState(2);
  const [upfrontInput, setUpfrontInput] = useState('');
  const [boPercentInput, setBoPercentInput] = useState('');

  // Initialize inputs when modal opens
  useEffect(() => {
    if (hireModal) {
      const exp = calculateTalentExpectations(hireModal, numMovies);
      setUpfrontInput(exp.minUpfront.toFixed(1));
      setBoPercentInput(exp.minBoPercent.toString());
    }
  }, [hireModal, numMovies]);

  const data = useMemo(() => {
    if (!state) return [];
    let arr = state.talents.filter(t => !t.retired);

    // If in selection mode, force role filter and exclude unavailable talents
    if (selectMode) {
      if (selectMode === 'writer') arr = arr.filter(t => t.role === 'writer');
      else if (selectMode === 'director') arr = arr.filter(t => t.role === 'director');
      else if (selectMode === 'cast') arr = arr.filter(t => t.role === 'actor' || t.role === 'actress');
      // Hide retired + in-production + others' contracts (your roster + free agents OK)
      arr = arr.filter(t => {
        const av = talentAvailability(t, state.week, state.year);
        if (!av.available) return false;
        if (t.underContract && t.underContract.studioId !== state.player.id) return false;
        return true;
      });
      // Cast: filter out talents already chosen in OTHER cast slots (prevents duplicates within the same movie)
      if (selectMode === 'cast' && typeof castIdx === 'number') {
        const usedIds = new Set(draft.cast.map((c, i) => i !== castIdx ? c.talentId : undefined).filter(Boolean) as string[]);
        // Also exclude writer/director already picked (no double-dipping crew↔cast)
        if (draft.writerId) usedIds.add(draft.writerId);
        if (draft.directorId) usedIds.add(draft.directorId);
        arr = arr.filter(t => !usedIds.has(t.id));
      }
      if (selectMode === 'writer' || selectMode === 'director') {
        const usedIds = new Set<string>();
        if (selectMode !== 'writer' && draft.writerId) usedIds.add(draft.writerId);
        if (selectMode !== 'director' && draft.directorId) usedIds.add(draft.directorId);
        draft.cast.forEach(c => { if (c.talentId) usedIds.add(c.talentId); });
        arr = arr.filter(t => !usedIds.has(t.id));
      }
    } else {
      arr = arr.filter(t => matchRole(t, role));
    }
    if (gender !== 'any') arr = arr.filter(t => t.gender === gender);
    if (color !== 'any') arr = arr.filter(t => t.colorTrait === color);
    if (ageBand !== 'any') {
      if (ageBand === 'young') arr = arr.filter(t => t.age >= 22 && t.age <= 35);
      else if (ageBand === 'mid') arr = arr.filter(t => t.age >= 36 && t.age <= 55);
      else arr = arr.filter(t => t.age >= 56);
    }
    if (starBand !== 'any') {
      if (starBand === 'top') arr = arr.filter(t => t.fame >= 70);
      else if (starBand === 'mid') arr = arr.filter(t => t.fame >= 40 && t.fame < 70);
      else arr = arr.filter(t => t.fame < 40);
    }
    if (status !== 'any' && !selectMode) {
      arr = arr.filter(t => {
        const av = talentAvailability(t, state.week, state.year);
        const isMine = t.underContract?.studioId === state.player.id;
        if (status === 'available') return av.available && !t.underContract;
        if (status === 'free_agent') return !t.underContract;
        if (status === 'mine') return isMine;
        if (status === 'cooldown') return av.reason === 'Cooldown';
        if (status === 'in_production') return !!t.inProductionMovieId;
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      arr = arr.filter(t => t.name.toLowerCase().includes(q));
    }
    
    // Sort: HIRED FIRST (your roster) — esp. critical in selection mode
    arr = [...arr].sort((a, b) => {
      const aHired = a.underContract?.studioId === state.player.id ? 1 : 0;
      const bHired = b.underContract?.studioId === state.player.id ? 1 : 0;
      if (bHired !== aHired) return bHired - aHired; // Hired first

      if (selectMode) {
        // In selection mode, sort by genre-fit (effective skill for current draft genre)
        const ea = effectiveSkillFor(a, genreFilter);
        const eb = effectiveSkillFor(b, genreFilter);
        if (eb !== ea) return eb - ea;
      }

      if (sortKey === 'skill') return b.skill - a.skill;
      if (sortKey === 'fame') return b.fame - a.fame;
      if (sortKey === 'salary') return b.salary - a.salary;
      return a.age - b.age;
    });
    return arr;
  }, [state, role, gender, color, ageBand, starBand, status, sortKey, search, selectMode, genreFilter, draft.cast, draft.writerId, draft.directorId, castIdx]);

  if (!state) return null;

  const totalCount = state.talents.filter(t => !t.retired).length;
  const mySignedCount = state.talents.filter(t => t.underContract?.studioId === state.player.id).length;

  const upfront = parseFloat(upfrontInput) || 0;
  const boPercent = parseFloat(boPercentInput) || 0;
  const acceptance = hireModal ? calculateAcceptance(hireModal, numMovies, upfront, boPercent) : null;
  const expectations = hireModal ? calculateTalentExpectations(hireModal, numMovies) : null;

  const handleHire = () => {
    if (!hireModal) return;
    const r = hireTalent({ talentId: hireModal.id, numMovies, upfrontPayment: upfront, boPercent });
    if (r.error) {
      notify(r.accepted === false ? 'Offer Rejected' : 'Cannot Sign', r.error);
    } else {
      notify('Contract Signed!', `${hireModal.name} accepted your ${numMovies}-movie deal!`);
      setHireModal(null);
    }
  };

  const handleFire = (talent: Talent) => {
    const r = fireTalent(talent.id);
    if (r.error) {
      notify('Cannot Release', r.error);
    } else {
      notify('Contract Terminated', `${talent.name} has been released.`);
    }
  };

  const getContractStatus = (t: Talent) => {
    if (!t.underContract) return null;
    if (t.underContract.studioId === state.player.id) return 'mine';
    return 'other';
  };

  const verdictColor = (v: string) => {
    if (v === 'will_accept') return T.green;
    if (v === 'likely_accept') return '#8BC34A';
    if (v === 'considering') return T.yellow;
    if (v === 'unlikely') return T.orange;
    return '#E74C3C';
  };

  // Selection mode handler — picks talent for the active create-movie draft and routes back
  const handleSelect = (talent: Talent) => {
    if (selectMode === 'writer') {
      setDraft({ writerId: talent.id });
    } else if (selectMode === 'director') {
      setDraft({ directorId: talent.id });
    } else if (selectMode === 'cast' && typeof castIdx === 'number') {
      const nextCast = draft.cast.map((c, i) => i === castIdx ? { ...c, talentId: talent.id } : c);
      setDraft({ cast: nextCast });
    }
    router.replace('/create-movie');
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title={selectMode ? `Pick ${selectMode === 'cast' ? `Cast Slot ${(castIdx ?? 0) + 1}` : selectMode.charAt(0).toUpperCase() + selectMode.slice(1)} (${genreFilter})` : 'Talent Database'} onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Search by name…"
          placeholderTextColor={T.textDim}
          value={search}
          onChangeText={setSearch}
          testID="talent-search"
        />
        <Text style={s.count}>{data.length} / {totalCount}</Text>
      </View>

      {mySignedCount > 0 && (
        <View style={s.signedBanner}>
          <MaterialCommunityIcons name="account-check" size={18} color={T.green} />
          <Text style={s.signedText}>{mySignedCount} talent{mySignedCount > 1 ? 's' : ''} signed to your studio</Text>
        </View>
      )}

      <ScrollView style={s.filterStrip} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
        <FilterRow opts={ROLE_OPTS} value={role} onChange={setRole} testIdPrefix="role" />
        <FilterRow opts={GENDER_OPTS} value={gender} onChange={setGender} testIdPrefix="gender" />
        <ColorRow color={color} onChange={setColor} />
        <FilterRow opts={AGE_OPTS} value={ageBand} onChange={setAgeBand} testIdPrefix="age" />
        <FilterRow opts={STAR_OPTS} value={starBand} onChange={setStarBand} testIdPrefix="star" />
        <FilterRow opts={STATUS_OPTS} value={status} onChange={setStatus} testIdPrefix="status" accent={T.green} />
        <FilterRow opts={SORT_OPTS} value={sortKey} onChange={setSortKey} testIdPrefix="sort" accent={T.cyan} />
      </ScrollView>

      <FlatList
        data={data}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: 12 }}
        initialNumToRender={20}
        windowSize={12}
        removeClippedSubviews
        renderItem={({ item }) => {
          const contractStatus = getContractStatus(item);
          const av = talentAvailability(item, state.week, state.year);
          return (
            <View style={[s.row, contractStatus === 'mine' && s.rowMine, contractStatus === 'other' && s.rowOther]}>
              <TouchableOpacity style={s.rowMain} onPress={() => router.push(`/talent/${item.id}`)} testID={`talent-${item.id}`}>
                <Avatar skin={item.avatarColor} hair={item.hairColor} size={56} />
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                    <View style={[s.dot, { backgroundColor: COLOR_HEX[item.colorTrait] }]} />
                    {contractStatus === 'mine' && (
                      <View style={s.signedTag}>
                        <Text style={s.signedTagTxt}>{item.underContract?.remainingMovies} MOVIE{(item.underContract?.remainingMovies || 0) > 1 ? 'S' : ''}</Text>
                      </View>
                    )}
                    {contractStatus === 'other' && (
                      <View style={[s.signedTag, { backgroundColor: T.orange }]}>
                        <Text style={s.signedTagTxt}>TAKEN</Text>
                      </View>
                    )}
                    {item.inProductionMovieId && (
                      <View style={[s.signedTag, { backgroundColor: T.cyan }]}>
                        <Text style={s.signedTagTxt}>FILMING</Text>
                      </View>
                    )}
                    {av.reason === 'Cooldown' && (
                      <View style={[s.signedTag, { backgroundColor: T.yellow }]}>
                        <Text style={s.signedTagTxt}>COOLDOWN {av.cooldownWeeksLeft}W</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.sub}>{prettyRole(item.role)} · {item.gender === 'female' ? 'F' : 'M'} · Age {item.age}</Text>
                  <Text style={s.sub2}>Skill {item.skill} · Fame {item.fame}</Text>
                </View>
                <Text style={s.salary}>{item.salary.toFixed(1)}M</Text>
              </TouchableOpacity>
              <View style={s.actionBtns}>
                {selectMode ? (
                  <TouchableOpacity style={s.selectBtn} onPress={() => handleSelect(item)} testID={`select-${item.id}`}>
                    <MaterialCommunityIcons name="check-bold" size={18} color={T.cardDark} />
                    <Text style={s.selectBtnTxt}>SELECT</Text>
                  </TouchableOpacity>
                ) : contractStatus === 'mine' ? (
                  <TouchableOpacity style={s.fireBtn} onPress={() => handleFire(item)} testID={`fire-${item.id}`}>
                    <MaterialCommunityIcons name="account-off" size={20} color={T.orange} />
                  </TouchableOpacity>
                ) : contractStatus === 'other' ? null : (
                  <TouchableOpacity style={s.hireBtn} onPress={() => setHireModal(item)} testID={`hire-${item.id}`}>
                    <MaterialCommunityIcons name="account-plus" size={20} color={T.green} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={(
          <View style={{ padding: 24 }}>
            <Text style={{ color: T.textDim, textAlign: 'center' }}>No talents match these filters.</Text>
          </View>
        )}
      />

      {/* Hire Modal */}
      <Modal visible={!!hireModal} transparent animationType="fade" onRequestClose={() => setHireModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalBg}>
            <View style={s.modalCard}>
              {hireModal && expectations && acceptance && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <Avatar skin={hireModal.avatarColor} hair={hireModal.hairColor} size={72} />
                    <Text style={s.modalName}>{hireModal.name}</Text>
                    <Text style={s.modalSub}>{prettyRole(hireModal.role)} · Skill {hireModal.skill} · Fame {hireModal.fame}</Text>
                    <Text style={s.modalSub}>Base Salary: ${hireModal.salary.toFixed(1)}M/movie</Text>
                  </View>
                  
                  <Text style={s.modalLabel}>Contract Length (Movies)</Text>
                  <View style={s.movieRow}>
                    {[1, 2, 3].map(n => (
                      <TouchableOpacity 
                        key={n} 
                        style={[s.movieChip, numMovies === n && s.movieChipActive]} 
                        onPress={() => setNumMovies(n)}
                      >
                        <Text style={[s.movieTxt, numMovies === n && s.movieTxtActive]}>
                          {n} Movie{n > 1 ? 's' : ''}
                        </Text>
                        <Text style={[s.discountTxt, numMovies === n && { color: T.cardDark }]}>
                          {n === 1 ? 'Full price' : n === 2 ? '10% discount' : '20% discount'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={s.inputSection}>
                    <View style={s.inputRow}>
                      <View style={s.inputGroup}>
                        <Text style={s.inputLabel}>Upfront Payment ($M)</Text>
                        <TextInput
                          style={s.input}
                          value={upfrontInput}
                          onChangeText={setUpfrontInput}
                          keyboardType="decimal-pad"
                          placeholder="0.0"
                          placeholderTextColor={T.textMute}
                        />
                        <Text style={s.inputHint}>Range: ${expectations.minUpfront.toFixed(1)} - ${expectations.maxUpfront.toFixed(1)}M</Text>
                      </View>
                      <View style={s.inputGroup}>
                        <Text style={s.inputLabel}>Box Office % (0-15)</Text>
                        <TextInput
                          style={s.input}
                          value={boPercentInput}
                          onChangeText={setBoPercentInput}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={T.textMute}
                        />
                        <Text style={s.inputHint}>Expects: {expectations.minBoPercent}-{expectations.maxBoPercent}%</Text>
                      </View>
                    </View>
                  </View>

                  {/* Acceptance Indicator */}
                  <View style={[s.acceptanceBox, { borderColor: verdictColor(acceptance.verdict) }]}>
                    <View style={s.acceptanceHeader}>
                      <MaterialCommunityIcons 
                        name={acceptance.verdict === 'will_accept' || acceptance.verdict === 'likely_accept' ? 'thumb-up' : acceptance.verdict === 'considering' ? 'help-circle' : 'thumb-down'} 
                        size={24} 
                        color={verdictColor(acceptance.verdict)} 
                      />
                      <Text style={[s.acceptanceVerdict, { color: verdictColor(acceptance.verdict) }]}>
                        {acceptance.verdict.replace('_', ' ').toUpperCase()}
                      </Text>
                      <Text style={s.acceptanceProb}>{Math.round(acceptance.probability * 100)}%</Text>
                    </View>
                    <Text style={s.acceptanceReason}>{acceptance.reason}</Text>
                    <Text style={s.acceptanceTotal}>
                      Est. total value: ${(upfront + 150 * (boPercent / 100) * numMovies).toFixed(1)}M vs expected ${expectations.expectedTotal.toFixed(1)}M
                    </Text>
                  </View>

                  <View style={s.modalBtns}>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => setHireModal(null)}>
                      <Text style={s.cancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.confirmBtn, { opacity: upfront > 0 ? 1 : 0.5 }]} onPress={handleHire} disabled={upfront <= 0}>
                      <MaterialCommunityIcons name="handshake" size={18} color={T.cardDark} />
                      <Text style={s.confirmTxt}>Make Offer</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function FilterRow<K extends string>({ opts, value, onChange, testIdPrefix, accent }: { opts: { key: K; label: string }[]; value: K; onChange: (k: K) => void; testIdPrefix: string; accent?: string }) {
  const hi = accent || T.yellow;
  return (
    <FlatList
      horizontal
      data={opts}
      keyExtractor={o => o.key}
      contentContainerStyle={{ paddingHorizontal: 8, gap: 6, paddingVertical: 4 }}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onChange(item.key)}
          style={[s.chip, value === item.key && { backgroundColor: hi, borderColor: hi }]}
          testID={`${testIdPrefix}-${item.key}`}
        >
          <Text style={[s.chipT, value === item.key && { color: T.cardDark }]}>{item.label}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

function ColorRow({ color, onChange }: { color: 'any' | ColorTrait; onChange: (c: 'any' | ColorTrait) => void }) {
  const items: ('any' | ColorTrait)[] = ['any', ...COLORS];
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={c => c}
      contentContainerStyle={{ paddingHorizontal: 8, gap: 6, paddingVertical: 4 }}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item }) => {
        const active = color === item;
        const isAny = item === 'any';
        const bg = active ? (isAny ? T.yellow : COLOR_HEX[item as ColorTrait]) : T.cardDark;
        const border = active ? bg : T.border;
        return (
          <TouchableOpacity
            onPress={() => onChange(item)}
            style={[s.chip, { backgroundColor: bg, borderColor: border, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
            testID={`color-${item}`}
          >
            {!isAny && <View style={[s.dot, { backgroundColor: active ? T.cardDark : COLOR_HEX[item as ColorTrait] }]} />}
            <Text style={[s.chipT, active && { color: T.cardDark }]}>{isAny ? 'Any Color' : COLOR_LABEL[item as ColorTrait]}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, gap: 8 },
  search: { flex: 1, backgroundColor: T.cardDark, borderWidth: 2, borderColor: T.border, color: T.text, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, fontSize: 14 },
  count: { color: T.textDim, fontWeight: '700', fontSize: 12, minWidth: 56, textAlign: 'right' },
  filterStrip: { maxHeight: 180 },
  chip: { backgroundColor: T.cardDark, borderWidth: 2, borderColor: T.border, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  chipT: { color: T.text, fontWeight: '800', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 2, borderColor: T.border },
  rowMine: { borderColor: T.green, borderWidth: 2 },
  rowOther: { borderColor: T.orange, opacity: 0.7 },
  rowMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  name: { color: T.text, fontWeight: '800', fontSize: 15, flexShrink: 1 },
  sub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  sub2: { color: T.textDim, fontSize: 11, marginTop: 1 },
  salary: { color: T.green, fontWeight: '800' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  signedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.green + '22', paddingVertical: 6, gap: 6 },
  signedText: { color: T.green, fontWeight: '700', fontSize: 12 },
  signedTag: { backgroundColor: T.green, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  signedTagTxt: { color: T.cardDark, fontSize: 9, fontWeight: '900' },
  actionBtns: { paddingLeft: 8 },
  hireBtn: { backgroundColor: T.green + '33', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: T.green },
  fireBtn: { backgroundColor: T.orange + '33', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: T.orange },
  selectBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cyan, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: T.cyan },
  selectBtnTxt: { color: T.cardDark, fontWeight: '900', fontSize: 11 },
  // Modal styles
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: T.cardDark, padding: 16, borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '90%', borderWidth: 2, borderColor: T.border },
  modalName: { color: T.text, fontSize: 20, fontWeight: '900', marginTop: 8 },
  modalSub: { color: T.textDim, fontSize: 12, marginTop: 2 },
  modalLabel: { color: T.textDim, fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  movieRow: { flexDirection: 'row', gap: 8 },
  movieChip: { flex: 1, backgroundColor: T.card, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, borderWidth: 2, borderColor: T.border, alignItems: 'center' },
  movieChipActive: { backgroundColor: T.cyan, borderColor: T.cyan },
  movieTxt: { color: T.text, fontWeight: '900', fontSize: 14 },
  movieTxtActive: { color: T.cardDark },
  discountTxt: { color: T.textMute, fontSize: 10, marginTop: 2 },
  inputSection: { marginTop: 12 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { color: T.textDim, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  input: { backgroundColor: T.card, borderWidth: 2, borderColor: T.border, color: T.text, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  inputHint: { color: T.textMute, fontSize: 10, marginTop: 4, textAlign: 'center' },
  acceptanceBox: { marginTop: 14, padding: 12, borderRadius: 10, borderWidth: 2, backgroundColor: T.card },
  acceptanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  acceptanceVerdict: { fontWeight: '900', fontSize: 14, flex: 1 },
  acceptanceProb: { color: T.text, fontWeight: '900', fontSize: 18 },
  acceptanceReason: { color: T.textDim, fontSize: 12, marginTop: 4 },
  acceptanceTotal: { color: T.textMute, fontSize: 10, marginTop: 6 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, backgroundColor: T.card, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: T.border },
  cancelTxt: { color: T.text, fontWeight: '800' },
  confirmBtn: { flex: 1.5, backgroundColor: T.green, paddingVertical: 12, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  confirmTxt: { color: T.cardDark, fontWeight: '900' },
});
