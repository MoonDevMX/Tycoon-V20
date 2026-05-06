import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useGame } from '../../src/game/state';
import { T } from '../../src/ui/theme';
import { TopBar, NeonStat, SectionHeader } from '../../src/ui/components';
import { TIER_PERIOD_LABEL, effectiveMonthlyPrice } from '../../src/game/data';
import { computeLicenseFee } from '../../src/game/sim';
import { SubscriptionTier, TierPeriod } from '../../src/game/types';

const PERIOD_OPTS: { key: TierPeriod; label: string }[] = [
  { key: 'monthly', label: 'Mo' },
  { key: 'quarterly', label: '3-Mo' },
  { key: 'biannual', label: '6-Mo' },
  { key: 'yearly', label: 'Yr' },
];

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}
function fmtSubs(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}

export default function StreamingDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, updateStreamingService, deleteStreamingService, addMovieToStreaming, removeMovieFromStreaming, licenseMovieToStreaming, renewLicense } = useGame();
  const [editingService, setEditingService] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIsExclusive, setDraftIsExclusive] = useState(false);
  const [draftTiers, setDraftTiers] = useState<SubscriptionTier[]>([]);
  const [draftExclusiveMovies, setDraftExclusiveMovies] = useState<string[]>([]);
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [showLicensePicker, setShowLicensePicker] = useState(false);
  const [licenseMovieId, setLicenseMovieId] = useState<string | null>(null);
  const [licenseYears, setLicenseYears] = useState<1 | 3 | 5 | 10>(3);
  const [licenseTierIds, setLicenseTierIds] = useState<string[]>([]);

  const svc = useMemo(() => state ? (state.streamingServices || []).find(s => s.id === id) : null, [state, id]);
  const studio = useMemo(() => state && svc ? [state.player, ...state.rivals].find(st => st.id === svc.studioId) : null, [state, svc]);
  const isMine = !!state && !!svc && svc.studioId === state.player.id;

  const catalogMovies = useMemo(() => {
    if (!state || !svc) return [];
    return svc.catalogMovieIds.map(mid => state.movies.find(m => m.id === mid)).filter(Boolean) as any[];
  }, [state, svc]);

  const playerOwnUnstreamedReleased = useMemo(() => {
    if (!state || !svc || !isMine) return [];
    return state.movies.filter(m =>
      m.studioId === state.player.id &&
      m.status === 'released' &&
      !svc.catalogMovieIds.includes(m.id),
    );
  }, [state, svc, isMine]);

  // External titles available to license — released movies from OTHER studios not already licensed/in catalog
  const externalLicensableMovies = useMemo(() => {
    if (!state || !svc || !isMine) return [];
    return state.movies.filter(m =>
      m.studioId !== state.player.id &&
      m.status === 'released' &&
      !svc.catalogMovieIds.includes(m.id),
    ).sort((a, b) => b.boxOffice - a.boxOffice);
  }, [state, svc, isMine]);

  if (!state || !svc || !studio) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <TopBar title="Streaming Service" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
        <Text style={s.empty}>Service not found.</Text>
      </SafeAreaView>
    );
  }

  const startEdit = () => {
    setDraftName(svc.name);
    setDraftIsExclusive(!!svc.isExclusive);
    setDraftTiers(svc.tiers.map(t => ({ ...t })));
    setDraftExclusiveMovies([...(svc.exclusiveMovieIds || [])]);
    setEditingService(true);
  };
  const saveEdit = () => {
    if (!draftTiers.length) { notify('Tiers required', 'Service must have at least one tier.'); return; }
    if (!draftName.trim()) { notify('Name required', 'Service must have a name.'); return; }
    const r = updateStreamingService(svc.id, {
      name: draftName.trim(),
      tiers: draftTiers,
      isExclusive: draftIsExclusive,
      exclusiveMovieIds: draftExclusiveMovies,
    });
    if (r.error) { notify('Update failed', r.error); return; }
    setEditingService(false);
  };
  const cancelEdit = () => { setEditingService(false); };

  const handleDeleteService = () => {
    const confirmDelete = () => {
      const r = deleteStreamingService(svc.id);
      if (r.error) notify('Cannot delete', r.error);
      else router.replace('/streaming');
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${svc.name}"? This cannot be undone. All ${svc.subscribers.toLocaleString()} subscribers will be lost.`)) confirmDelete();
    } else {
      Alert.alert('Delete service?', `"${svc.name}" will be removed permanently. ${svc.subscribers.toLocaleString()} subscribers will be lost.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  const updateDraft = (idx: number, patch: Partial<SubscriptionTier>) => {
    setDraftTiers(t => t.map((x, i) => i === idx ? { ...x, ...patch } : x));
  };
  const removeDraftTier = (idx: number) => setDraftTiers(t => t.filter((_, i) => i !== idx));
  const addDraftTier = () => {
    if (draftTiers.length >= 4) return;
    setDraftTiers(t => [...t, {
      id: 'tier_' + Math.random().toString(36).slice(2, 9),
      name: 'New Tier', period: 'monthly', price: 12.99, screens: 2, users: 2, isExclusive: false,
    }]);
  };
  const toggleMovieExclusive = (movieId: string) => {
    setDraftExclusiveMovies(prev => prev.includes(movieId) ? prev.filter(x => x !== movieId) : [...prev, movieId]);
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title={isMine ? 'My Streaming' : 'Streaming Service'} onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.header}>
          <View style={[s.logo, { backgroundColor: studio.logoBg }]}>
            <MaterialCommunityIcons name="play-circle" size={36} color={T.yellow} />
          </View>
          <View style={{ flex: 1, paddingLeft: 12 }}>
            {editingService ? (
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                style={[s.input, { fontWeight: '900', fontSize: 20, marginBottom: 4 }]}
                placeholder="Service name"
                placeholderTextColor={T.textMute}
                testID="edit-service-name"
              />
            ) : (
              <Text style={s.svcName}>{svc.name}</Text>
            )}
            <Text style={s.svcSub}>by {studio.name}</Text>
            {isMine && <Text style={[s.youTag, { marginTop: 4 }]}>YOUR SERVICE</Text>}
          </View>
          {isMine && !editingService && (
            <View style={{ gap: 6 }}>
              <TouchableOpacity onPress={startEdit} style={s.iconBtn} testID="edit-service-btn">
                <MaterialCommunityIcons name="pencil" size={20} color={T.cyan} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteService} style={[s.iconBtn, { borderColor: T.orange }]} testID="delete-service-btn">
                <MaterialCommunityIcons name="trash-can-outline" size={20} color={T.orange} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {editingService && (
          <View style={s.editSection}>
            <Text style={s.helpText}>Tip: descriptive tier names + clear pricing attract more subscribers.</Text>
          </View>
        )}

        <View style={s.statRow}>
          <NeonStat label="SUBSCRIBERS" value={fmtSubs(svc.subscribers)} color={T.cyan} />
          <NeonStat label="REV/MONTH" value={`${svc.monthlyRevenue.toFixed(2)}M`} color={T.green} />
          <NeonStat label="REPUTATION" value={`${svc.reputation}`} color={T.yellow} />
        </View>
        <View style={s.statRow}>
          <NeonStat label="CATALOG" value={svc.catalogMovieIds.length} color={T.magenta} />
          <NeonStat label="TIERS" value={svc.tiers.length} color={T.pink} />
        </View>

        <SectionHeader title={editingService ? 'Edit Tiers' : `Subscription Tiers · ${svc.tiers.length}`} />
        {(editingService ? draftTiers : svc.tiers).map((t, idx) => (
          <View key={t.id} style={s.tierCard}>
            {editingService ? (
              <>
                <View style={s.tierHeader}>
                  <TextInput
                    value={t.name}
                    onChangeText={v => updateDraft(idx, { name: v })}
                    style={[s.input, { flex: 1, fontWeight: '900', fontSize: 14 }]}
                    placeholder="Tier name"
                    placeholderTextColor={T.textMute}
                    testID={`edit-tier-name-${idx}`}
                  />
                  {draftTiers.length > 1 && (
                    <TouchableOpacity onPress={() => removeDraftTier(idx)} testID={`edit-tier-del-${idx}`}>
                      <MaterialCommunityIcons name="close-circle" size={26} color={T.orange} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={s.periodRow}>
                  {PERIOD_OPTS.map(p => (
                    <TouchableOpacity
                      key={p.key}
                      onPress={() => updateDraft(idx, { period: p.key })}
                      style={[s.periodChip, t.period === p.key && { backgroundColor: T.cyan, borderColor: T.cyan }]}
                    >
                      <Text style={[s.periodTxt, t.period === p.key && { color: T.cardDark }]}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={s.numRow}>
                  <NumField label="Price" value={t.price} step={1} min={1} max={500}
                    onChange={v => updateDraft(idx, { price: +v.toFixed(2) })} />
                  <NumField label="Screens" value={t.screens} step={1} min={1} max={10}
                    onChange={v => updateDraft(idx, { screens: Math.round(v) })} />
                  <NumField label="Profiles" value={t.users} step={1} min={1} max={10}
                    onChange={v => updateDraft(idx, { users: Math.round(v) })} />
                </View>
                <TouchableOpacity
                  style={[s.exclChip, t.isExclusive && { backgroundColor: T.yellow + '33', borderColor: T.yellow }]}
                  onPress={() => updateDraft(idx, { isExclusive: !t.isExclusive })}
                  testID={`edit-tier-exclusive-${idx}`}
                >
                  <MaterialCommunityIcons name={t.isExclusive ? 'lock' : 'lock-open-variant-outline'} size={14} color={t.isExclusive ? T.yellow : T.textDim} />
                  <Text style={s.exclTxt}>{t.isExclusive ? 'Premium-only tier (locks higher-tier movies away from cheaper tiers)' : 'Open tier — sees full catalog'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View>
                <View style={s.tierHeader}>
                  <Text style={s.tierName}>{t.name}{t.isExclusive ? ' 🔒' : ''}</Text>
                  <Text style={s.tierPrice}>${t.price.toFixed(2)} / {TIER_PERIOD_LABEL[t.period]}</Text>
                </View>
                <Text style={s.tierMeta}>{t.screens} screen{t.screens !== 1 ? 's' : ''} · {t.users} profile{t.users !== 1 ? 's' : ''} · ≈ ${effectiveMonthlyPrice(t).toFixed(2)}/mo · {fmtSubs(svc.tierSubscribers?.[t.id] || 0)} subs</Text>
              </View>
            )}
          </View>
        ))}

        {editingService && (
          <View style={{ paddingHorizontal: 8, gap: 8 }}>
            {draftTiers.length < 4 && (
              <TouchableOpacity style={s.addTier} onPress={addDraftTier} testID="add-edit-tier">
                <MaterialCommunityIcons name="plus-circle" size={18} color={T.green} />
                <Text style={s.addTierTxt}>Add Tier</Text>
              </TouchableOpacity>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: T.cardDark, borderColor: T.border, flex: 1 }]} onPress={cancelEdit} testID="cancel-edit">
                <Text style={[s.actionTxt, { color: T.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: T.green, flex: 1 }]} onPress={saveEdit} testID="save-tiers">
                <Text style={[s.actionTxt, { color: T.cardDark }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <SectionHeader title={`Catalog · ${catalogMovies.length}`} />
        {isMine && playerOwnUnstreamedReleased.length > 0 && (
          <TouchableOpacity style={s.editBtn} onPress={() => setShowAddCatalog(v => !v)} testID="toggle-add-catalog">
            <MaterialCommunityIcons name={showAddCatalog ? 'close' : 'plus-circle'} size={16} color={T.green} />
            <Text style={[s.editBtnTxt, { color: T.green }]}>
              {showAddCatalog ? 'Done' : `Add From My Released Titles (${playerOwnUnstreamedReleased.length})`}
            </Text>
          </TouchableOpacity>
        )}
        {showAddCatalog && playerOwnUnstreamedReleased.map(m => (
          <View key={m.id} style={s.movieRow}>
            <View style={[s.movieIcon, { backgroundColor: m.iconBg }]}>
              <MaterialCommunityIcons name={m.iconKey as any} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, paddingHorizontal: 8 }}>
              <Text style={s.movieTitle} numberOfLines={1}>{m.title}</Text>
              <Text style={s.movieSub}>Y{m.releaseYear} · {m.brand} · Critic {m.criticScore}</Text>
            </View>
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => {
                const r = addMovieToStreaming(svc.id, m.id);
                if (r.error) notify('Cannot add', r.error);
              }}
              testID={`add-catalog-${m.id}`}
            >
              <MaterialCommunityIcons name="plus" size={18} color={T.cardDark} />
              <Text style={s.addBtnTxt}>Add</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* License External Titles section */}
        {isMine && (
          <>
            <SectionHeader title={`License External Titles · ${(svc.licensedMovies || []).length} active`} />
            {(svc.licensedMovies || []).length > 0 && (
              <View style={s.licensedSummary}>
                {(svc.licensedMovies || []).map(l => {
                  const m = state.movies.find(mm => mm.id === l.movieId);
                  if (!m) return null;
                  const wksLeft = (l.expiresYear - state.year) * 48 + (l.expiresWeek - state.week);
                  const totalWks = l.yearsLicensed * 48;
                  const isEarly = wksLeft > totalWks / 2;
                  return (
                    <View key={l.movieId} style={s.licensedRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.licensedTitle} numberOfLines={1}>{m.title}</Text>
                        <Text style={s.licensedExp}>{wksLeft}w left · {l.tierIds.length || 'all'} tiers · paid ${l.feePaid.toFixed(1)}M</Text>
                      </View>
                      <TouchableOpacity
                        style={[s.renewBtn, isEarly && { backgroundColor: T.green }]}
                        onPress={() => {
                          const r = renewLicense(svc.id, l.movieId, 3);
                          if (r.error) notify('Cannot renew', r.error);
                          else notify('Renewed', `${m.title} extended +3y${isEarly ? ' (-25% early)' : ''}.`);
                        }}
                        testID={`renew-${l.movieId}`}>
                        <MaterialCommunityIcons name="autorenew" size={14} color={T.cardDark} />
                        <Text style={s.renewBtnTxt}>+3y{isEarly ? ' -25%' : ''}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
            <TouchableOpacity style={s.editBtn} onPress={() => setShowLicensePicker(v => !v)} testID="toggle-license-picker">
              <MaterialCommunityIcons name={showLicensePicker ? 'close' : 'cash-multiple'} size={16} color={T.yellow} />
              <Text style={[s.editBtnTxt, { color: T.yellow }]}>
                {showLicensePicker ? 'Done' : `Browse ${externalLicensableMovies.length} licensable titles →`}
              </Text>
            </TouchableOpacity>
            {showLicensePicker && externalLicensableMovies.slice(0, 30).map(m => {
              const owner = state.rivals.find(r => r.id === m.studioId);
              const fee1 = computeLicenseFee(m, 1, state.week, state.year);
              const fee3 = computeLicenseFee(m, 3, state.week, state.year);
              return (
                <View key={m.id} style={s.movieRow}>
                  <View style={[s.movieIcon, { backgroundColor: m.iconBg }]}>
                    <MaterialCommunityIcons name={m.iconKey as any} size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 8 }}>
                    <Text style={s.movieTitle} numberOfLines={1}>{m.title}</Text>
                    <Text style={s.movieSub}>{owner?.name} · {m.brand} · Critic {m.criticScore} · ${(m.boxOffice * 1000).toFixed(0)}M BO</Text>
                    <Text style={[s.movieSub, { color: T.yellow }]}>1y: ${fee1.toFixed(1)}M · 3y: ${fee3.toFixed(1)}M</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.addBtn, { backgroundColor: T.yellow }]}
                    onPress={() => {
                      setLicenseMovieId(m.id);
                      setLicenseYears(3);
                      setLicenseTierIds(svc.tiers.map(t => t.id));
                    }}
                    testID={`license-${m.id}`}>
                    <MaterialCommunityIcons name="cash" size={16} color={T.cardDark} />
                    <Text style={s.addBtnTxt}>License</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {catalogMovies.length === 0 ? (
          <Text style={s.empty}>No titles in catalog yet.</Text>
        ) : catalogMovies.map(m => {
          const isExcl = (editingService ? draftExclusiveMovies : (svc.exclusiveMovieIds || [])).includes(m.id);
          return (
            <TouchableOpacity key={m.id} style={s.movieRow} onPress={() => router.push(`/movie/${m.id}`)}>
              <View style={[s.movieIcon, { backgroundColor: m.iconBg }]}>
                <MaterialCommunityIcons name={m.iconKey as any} size={18} color="#fff" />
              </View>
              <View style={{ flex: 1, paddingHorizontal: 8 }}>
                <Text style={s.movieTitle} numberOfLines={1}>{m.title}{isExcl ? ' ★' : ''}</Text>
                <Text style={s.movieSub}>Y{m.releaseYear} · {m.brand} · Critic {m.criticScore}</Text>
              </View>
              {isMine && editingService && (
                <TouchableOpacity onPress={() => toggleMovieExclusive(m.id)} style={[s.iconBtn, { borderColor: isExcl ? T.yellow : T.border }]} testID={`excl-movie-${m.id}`}>
                  <MaterialCommunityIcons name={isExcl ? 'star' : 'star-outline'} size={16} color={T.yellow} />
                </TouchableOpacity>
              )}
              {isMine && !editingService && (
                <TouchableOpacity
                  onPress={() => removeMovieFromStreaming(svc.id, m.id)}
                  style={s.removeBtn}
                  testID={`remove-catalog-${m.id}`}
                >
                  <MaterialCommunityIcons name="close" size={18} color={T.orange} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* License confirmation modal */}
      {licenseMovieId && (() => {
        const m = state.movies.find(mm => mm.id === licenseMovieId);
        if (!m) return null;
        const fee = computeLicenseFee(m, licenseYears, state.week, state.year);
        return (
          <View style={s.modalBg}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>License "{m.title}"</Text>
              <Text style={s.modalSub}>From {state.rivals.find(r => r.id === m.studioId)?.name}</Text>
              <Text style={s.modalLabel}>Duration</Text>
              <View style={s.tierToggleRow}>
                {[1, 3, 5, 10].map(y => (
                  <TouchableOpacity key={y}
                    style={[s.tierToggle, licenseYears === y && { backgroundColor: T.cyan, borderColor: T.cyan }]}
                    onPress={() => setLicenseYears(y as any)}>
                    <Text style={[s.tierToggleT, licenseYears === y && { color: T.cardDark }]}>{y}y</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.modalLabel}>Tiers (empty = all)</Text>
              <View style={s.tierToggleRow}>
                {svc.tiers.map(t => {
                  const active = licenseTierIds.includes(t.id);
                  return (
                    <TouchableOpacity key={t.id}
                      style={[s.tierToggle, active && { backgroundColor: T.yellow, borderColor: T.yellow }]}
                      onPress={() => setLicenseTierIds(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}>
                      <Text style={[s.tierToggleT, active && { color: T.cardDark }]}>{t.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[s.modalLabel, { color: T.green, fontSize: 18, marginTop: 12 }]}>
                Fee: ${fee.toFixed(2)}M
              </Text>
              <Text style={s.modalSub}>Cash: ${(state.player.cash * 1000).toFixed(0)}M</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: T.card, flex: 1 }]} onPress={() => setLicenseMovieId(null)}>
                  <Text style={[s.actionTxt, { color: T.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: T.green, flex: 1 }]}
                  onPress={() => {
                    const r = licenseMovieToStreaming(svc.id, { movieId: licenseMovieId!, yearsLicensed: licenseYears, tierIds: licenseTierIds });
                    if (r.error) notify('Cannot license', r.error);
                    else {
                      notify('Licensed!', `${m.title} added for ${licenseYears} years.`);
                      setLicenseMovieId(null);
                    }
                  }}>
                  <Text style={[s.actionTxt, { color: T.cardDark }]}>Sign Deal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })()}
    </SafeAreaView>
  );
}

function NumField({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={s.numField}>
      <Text style={s.numLabel}>{label}</Text>
      <View style={s.numCtl}>
        <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={s.numBtn}>
          <Text style={s.numBtnTxt}>−</Text>
        </TouchableOpacity>
        <Text style={s.numVal}>{label === 'Price' ? value.toFixed(2) : value.toString()}</Text>
        <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={s.numBtn}>
          <Text style={s.numBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', backgroundColor: T.cardDark, padding: 12, alignItems: 'center' },
  logo: { width: 70, height: 70, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.border },
  svcName: { color: T.text, fontSize: 22, fontWeight: '900' },
  svcSub: { color: T.textDim, fontSize: 13, marginTop: 2 },
  youTag: { color: T.cardDark, backgroundColor: T.cyan, fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, alignSelf: 'flex-start' },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', padding: 8, gap: 6, flexWrap: 'wrap' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnTxt: { color: T.cyan, fontWeight: '800', fontSize: 12 },
  tierCard: { backgroundColor: T.cardDark, marginHorizontal: 8, marginBottom: 6, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: T.border },
  tierHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  tierName: { color: T.text, fontWeight: '900', fontSize: 16 },
  tierPrice: { color: T.green, fontWeight: '900', fontSize: 14 },
  tierMeta: { color: T.textDim, fontSize: 12, marginTop: 4 },
  input: { backgroundColor: T.card, borderWidth: 1.5, borderColor: T.border, color: T.text, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontSize: 13 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  periodChip: { backgroundColor: T.card, borderWidth: 1.5, borderColor: T.border, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  periodTxt: { color: T.text, fontWeight: '800', fontSize: 11 },
  numRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  numField: { flex: 1 },
  numLabel: { color: T.textDim, fontSize: 10, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  numCtl: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: 8, borderWidth: 1, borderColor: T.border, justifyContent: 'space-between', paddingHorizontal: 4 },
  numBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  numBtnTxt: { color: T.cyan, fontSize: 18, fontWeight: '900' },
  numVal: { color: T.text, fontWeight: '900', fontSize: 13 },
  addTier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: T.green, borderStyle: 'dashed' as any },
  addTierTxt: { color: T.green, fontWeight: '900', fontSize: 13 },
  actionBtn: { padding: 12, borderRadius: 10, borderWidth: 2, borderColor: T.border, alignItems: 'center' },
  actionTxt: { fontWeight: '900', fontSize: 14 },
  movieRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardDark, padding: 8, marginHorizontal: 8, marginBottom: 4, borderRadius: 8, borderWidth: 1, borderColor: T.border, gap: 8 },
  movieIcon: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  movieTitle: { color: T.text, fontWeight: '800', fontSize: 14 },
  movieSub: { color: T.textDim, fontSize: 11 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.green, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 2 },
  addBtnTxt: { color: T.cardDark, fontWeight: '900', fontSize: 12 },
  removeBtn: { padding: 4 },
  empty: { color: T.textMute, padding: 16, fontStyle: 'italic', textAlign: 'center' },
  iconBtn: { padding: 6, borderRadius: 8, borderWidth: 2, borderColor: T.cyan, backgroundColor: T.card },
  editSection: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  exclChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: T.border },
  exclTxt: { color: T.text, fontSize: 11, fontWeight: '700' },
  helpText: { color: T.textDim, fontSize: 11, fontStyle: 'italic', paddingHorizontal: 4 },
  licensedSummary: { paddingHorizontal: 8, gap: 4 },
  licensedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: T.card, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: T.yellow, gap: 6 },
  licensedTitle: { color: T.text, fontWeight: '800', fontSize: 12 },
  licensedExp: { color: T.yellow, fontSize: 10, fontWeight: '700', marginTop: 2 },
  renewBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cyan, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, gap: 3 },
  renewBtnTxt: { color: T.cardDark, fontWeight: '900', fontSize: 10 },
  modalBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: T.cardDark, padding: 16, borderRadius: 14, width: '100%', maxWidth: 380, borderWidth: 2, borderColor: T.border },
  modalTitle: { color: T.text, fontWeight: '900', fontSize: 18, marginBottom: 4 },
  modalSub: { color: T.textDim, fontSize: 12 },
  modalLabel: { color: T.textDim, fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  tierToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tierToggle: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: T.card, borderWidth: 2, borderColor: T.border },
  tierToggleT: { color: T.text, fontWeight: '800', fontSize: 12 },
});
