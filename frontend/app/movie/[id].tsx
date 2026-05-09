import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useGame } from '../../src/game/state';
import { T } from '../../src/ui/theme';
import { TopBar, NeonStat, SectionHeader, Avatar, IconTile } from '../../src/ui/components';
import { uiAlert } from '../../src/ui/ui-alert';
import { NegotiationModal } from '../../src/ui/NegotiationModal';
import { Talent } from '../../src/game/types';
import { COLOR_HEX, monthOf, WEEKS_PER_YEAR } from '../../src/game/data';

export default function MovieDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, setMovieDescription, addMovieToStreaming, proposeFranchiseTrade, acceptFranchiseOffer, counterFranchiseOffer, rejectFranchiseOffer, quoteFranchiseValue, proposeBulkCatalogLicense, acceptBulkCatalogOffer, counterBulkCatalogOffer, rejectBulkCatalogOffer, quoteBulkCatalogValue } = useGame();
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [activeFranchiseOfferId, setActiveFranchiseOfferId] = useState<string | null>(null);
  const [activeMovieOfferId, setActiveMovieOfferId] = useState<string | null>(null);
  if (!state) return null;
  const m = state.movies.find(x => x.id === id);
  if (!m) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Not found</Text></View>;
  const writer = state.talents.find(t => t.id === m.writerId);
  const director = state.talents.find(t => t.id === m.directorId);
  const castWithTalent = m.cast.map(c => ({ ...c, t: state.talents.find(t => t.id === c.talentId)! })).filter(x => x.t);
  const franchise = state.franchises.find(f => f.id === m.franchiseId);
  const studio = m.studioId === state.player.id ? state.player : state.rivals.find(r => r.id === m.studioId);
  const isOwn = m.studioId === state.player.id;

  const totalBOM = m.boxOffice * 1000;
  const profit = totalBOM - m.budget - m.marketingBudget;
  const profitPct = ((profit / Math.max(1, m.budget + m.marketingBudget)) * 100);

  const createSequel = () => {
    if (m.status !== 'released') { uiAlert('Not yet released', 'Wait until this movie is released.'); return; }
    if (m.studioId !== state.player.id) { uiAlert('Not your movie', 'You can only sequelize your own films.'); return; }
    router.push({ pathname: '/create-movie', params: { brand: 'Sequel', franchiseId: m.franchiseId || '', parentId: m.id } });
  };

  const releaseMonth = m.releaseWeek > 0 ? monthOf(m.releaseWeek) : null;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Movie Database" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.headerRow}>
          <IconTile icon={m.iconKey} color={m.iconBg} size={120} />
          <View style={{ flex: 1, paddingLeft: 12 }}>
            <Text style={s.title} numberOfLines={2}>{m.title}</Text>
            <Text style={s.sub}>{releaseMonth ? `${releaseMonth.name} W${releaseMonth.weekInMonth}, Y${m.releaseYear}` : 'Pre-release'}</Text>
            <View style={s.statRow}>
              <NeonStat label="CRITIC" value={m.criticScore || '-'} color={T.cyan} testID="movie-critic" />
              <NeonStat label="BOX OFFICE" value={m.boxOffice >= 1 ? `${m.boxOffice.toFixed(2)} B` : `${(m.boxOffice * 1000).toFixed(0)} M`} color={T.green} testID="movie-bo" />
            </View>
            <View style={[s.statRow, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[s.studioPill, { borderColor: T.magenta }]}
                onPress={() => studio && studio.id !== state.player.id ? router.push(`/studio/${studio.id}`) : null}
                testID="movie-studio-link"
              >
                <Text style={[s.studioPillLabel, { color: T.magenta }]}>STUDIO</Text>
                <Text style={s.studioPillVal} numberOfLines={1}>{studio?.name || '—'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Modifier badges */}
        {(m.chemistryBonus > 0 || m.holidayBonus > 0 || m.fatiguePenalty > 0) ? (
          <View style={s.badgeRow}>
      {(m.colorBonus || 0) > 0 ? null : null}
            {(m.chemistryBonus || 0) > 0 ? <View style={[s.badge, { borderColor: T.green }]}><MaterialCommunityIcons name="account-multiple-check" size={14} color={T.green} /><Text style={[s.badgeT, { color: T.green }]}>+{(m.chemistryBonus || 0).toFixed(0)}% Cast Chemistry</Text></View> : null}
            {m.holidayBonus > 0 ? <View style={[s.badge, { borderColor: T.yellow }]}><MaterialCommunityIcons name="calendar-star" size={14} color={T.yellow} /><Text style={[s.badgeT, { color: T.yellow }]}>+{m.holidayBonus.toFixed(0)}% Holiday</Text></View> : null}
            {m.fatiguePenalty > 0 ? <View style={[s.badge, { borderColor: T.red }]}><MaterialCommunityIcons name="alert" size={14} color={T.red} /><Text style={[s.badgeT, { color: T.red }]}>-{m.fatiguePenalty.toFixed(0)}% Fatigue</Text></View> : null}
          </View>
        ) : null}

        <SectionHeader title="Information" />
        <View style={s.infoGrid}>
          <View style={s.infoBtn}><Text style={s.infoLabel}>PLOT</Text></View>
          <View style={s.infoBtn}><Text style={s.infoLabel}>TYPE</Text><Text style={s.infoVal}>{m.type}</Text></View>
          <View style={s.infoBtn}><Text style={s.infoLabel}>GENRE</Text><Text style={s.infoVal}>{m.genre}</Text></View>
        </View>
        <View style={[s.infoBtn, { margin: 8 }]}><Text style={s.infoLabel}>PLOT ARC</Text><Text style={s.infoVal}>{m.plotArc}</Text></View>
        <View style={s.infoGrid}>
          <View style={[s.infoBtn, { width: 110 }]}><Text style={s.infoLabel}>GENERAL</Text></View>
          <View style={s.infoBtn}><Text style={s.infoLabel}>RATING</Text><Text style={s.infoVal}>{m.rating}</Text></View>
          <View style={s.infoBtn}><Text style={s.infoLabel}>RUNTIME</Text><Text style={s.infoVal}>{m.runtime} min</Text></View>
        </View>
        <View style={s.infoGrid}>
          <View style={[s.infoBtn, { width: 110 }]}><Text style={s.infoLabel}>BRAND</Text></View>
          {franchise ? (
            <TouchableOpacity
              style={[s.infoBtn, { flex: 1 }]}
              onPress={() => router.push(`/franchise/${franchise.id}`)}
              testID="movie-franchise-link"
            >
              <Text style={[s.infoLabel, { color: T.green }]}>{m.brand === 'Original' ? 'NEW IP' : m.brand.toUpperCase()}</Text>
              <Text style={[s.infoVal, { color: T.cyan, textDecorationLine: 'underline' }]}>{franchise.name}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.infoBtn, { flex: 1 }]}>
              <Text style={[s.infoLabel, { color: T.green }]}>{m.brand === 'Original' ? 'NEW IP' : m.brand.toUpperCase()}</Text>
              <Text style={s.infoVal}>—</Text>
            </View>
          )}
        </View>
        {/* Quick Actions */}
        {(() => {
          const playerSvcs = (state.streamingServices || []).filter(svc => svc.studioId === state.player.id);
          const primarySvc = playerSvcs[0];
          const canQuickAdd = isOwn && m.status === 'released' && primarySvc && !primarySvc.catalogMovieIds.includes(m.id);
          const canLicenseCrossover = !isOwn && franchise;
          return (
            <View style={s.actRow}>
              {canLicenseCrossover ? (
                <TouchableOpacity
                  style={[s.actBtn, { borderColor: T.magenta }]}
                  onPress={() => router.push({ pathname: '/create-movie', params: { brand: 'Crossover', crossover: franchise!.id } })}
                  testID="movie-act-license-crossover"
                >
                  <MaterialCommunityIcons name="link-variant" size={18} color={T.magenta} />
                  <Text style={[s.actTxt, { color: T.magenta }]}>License Crossover</Text>
                </TouchableOpacity>
              ) : null}
              {/* Buy franchise (rival-owned movie that's in a franchise) */}
              {!isOwn && franchise ? (
                <TouchableOpacity
                  style={[s.actBtn, { borderColor: T.yellow }]}
                  onPress={() => {
                    const fair = quoteFranchiseValue(franchise.id);
                    const r = proposeFranchiseTrade({ franchiseId: franchise.id, kind: 'buy', priceB: +(fair * 0.9).toFixed(2) });
                    if (r.error) { uiAlert('Cannot Buy', r.error); return; }
                    if (r.offerId) setActiveFranchiseOfferId(r.offerId);
                  }}
                  testID="movie-act-buy-franchise"
                >
                  <MaterialCommunityIcons name="cash-fast" size={18} color={T.yellow} />
                  <Text style={[s.actTxt, { color: T.yellow }]}>Buy Franchise</Text>
                </TouchableOpacity>
              ) : null}
              {/* Sell franchise (own movie that's in a franchise) */}
              {isOwn && franchise ? (
                <TouchableOpacity
                  style={[s.actBtn, { borderColor: T.green }]}
                  onPress={() => {
                    const fair = quoteFranchiseValue(franchise.id);
                    const r = proposeFranchiseTrade({ franchiseId: franchise.id, kind: 'sell', priceB: +(fair * 1.1).toFixed(2) });
                    if (r.error) { uiAlert('Cannot Sell', r.error); return; }
                    if (r.offerId) setActiveFranchiseOfferId(r.offerId);
                  }}
                  testID="movie-act-sell-franchise"
                >
                  <MaterialCommunityIcons name="cash-multiple" size={18} color={T.green} />
                  <Text style={[s.actTxt, { color: T.green }]}>Sell Franchise</Text>
                </TouchableOpacity>
              ) : null}
              {canQuickAdd ? (
                <TouchableOpacity
                  style={[s.actBtn, { borderColor: T.green }]}
                  onPress={() => {
                    const r = addMovieToStreaming(primarySvc.id, m.id);
                    if (r.error) uiAlert('Cannot Add', r.error);
                    else uiAlert('Added ✓', `${m.title} is now on ${primarySvc.name}.`);
                  }}
                  testID="movie-act-add-streaming"
                >
                  <MaterialCommunityIcons name="play-circle-outline" size={18} color={T.green} />
                  <Text style={[s.actTxt, { color: T.green }]}>Add to {primarySvc.name}</Text>
                </TouchableOpacity>
              ) : null}
              {/* License this single movie for streaming (rival-owned, released) — same negotiation flow as bulk catalog */}
              {!isOwn && m.status === 'released' && primarySvc ? (
                <TouchableOpacity
                  style={[s.actBtn, { borderColor: T.yellow }]}
                  onPress={() => {
                    const fair = quoteBulkCatalogValue([m.id], 3);
                    const r = proposeBulkCatalogLicense({
                      toRivalStudioId: m.studioId,
                      movieIds: [m.id],
                      priceB: +(fair * 0.85).toFixed(3),
                      years: 3,
                      serviceId: primarySvc.id,
                    });
                    if (r.error) { uiAlert('Cannot License', r.error); return; }
                    if (r.offerId) setActiveMovieOfferId(r.offerId);
                  }}
                  testID="movie-act-license-streaming"
                >
                  <MaterialCommunityIcons name="cash" size={18} color={T.yellow} />
                  <Text style={[s.actTxt, { color: T.yellow }]}>License for Streaming</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })()}

        {m.crossoverFranchiseIds?.length ? (
          <View style={[s.infoBtn, { margin: 8, alignItems: 'flex-start' }]}>
            <Text style={[s.infoLabel, { color: T.magenta }]}>CROSSOVER</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {m.crossoverFranchiseIds.map(fid => {
                const cf = state.franchises.find(f => f.id === fid);
                if (!cf) return null;
                return (
                  <TouchableOpacity
                    key={fid}
                    onPress={() => router.push(`/franchise/${cf.id}`)}
                    testID={`movie-crossover-${cf.id}`}
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1.5, borderColor: T.magenta, borderRadius: 6, backgroundColor: T.cardDark }}
                  >
                    <Text style={{ color: T.magenta, fontWeight: '800', fontSize: 12 }}>{cf.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: 8 }}>
          {isOwn && editingDesc ? (
            <View>
              <TextInput
                value={descDraft}
                onChangeText={setDescDraft}
                multiline
                placeholder="Write your own description for this movie…"
                placeholderTextColor={T.textMute}
                style={s.descInput}
                maxLength={500}
                testID="movie-desc-input"
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TouchableOpacity style={s.descSaveBtn} onPress={() => { setMovieDescription(m.id, descDraft); setEditingDesc(false); }} testID="movie-desc-save">
                  <Text style={s.descSaveTxt}>SAVE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.descCancelBtn} onPress={() => setEditingDesc(false)}>
                  <Text style={s.descCancelTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={s.plot}>{m.userDescription || m.plot}</Text>
              {isOwn ? (
                <TouchableOpacity style={s.descEditBtn} onPress={() => { setDescDraft(m.userDescription || ''); setEditingDesc(true); }} testID="movie-desc-edit">
                  <MaterialCommunityIcons name="pencil" size={14} color={T.cyan} />
                  <Text style={s.descEditTxt}>{m.userDescription ? 'Edit your description' : 'Write your own description'}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>

        {m.status === 'released' && m.studioId === state.player.id ? (
          <TouchableOpacity style={s.sequelBtn} onPress={createSequel} testID="create-sequel-btn">
            <Text style={s.sequelTxt}>CREATE SEQUEL</Text>
          </TouchableOpacity>
        ) : m.status === 'production' ? (
          <View style={[s.sequelBtn, { backgroundColor: T.orange }]}>
            <Text style={s.sequelTxt}>IN PRODUCTION · {m.weeksToRelease}w</Text>
          </View>
        ) : null}

        {/* Budget vs Profit */}
        {m.status === 'released' ? (
          <>
            <SectionHeader title="Box Office Performance" />
            <View style={s.bopanel}>
              <View style={s.bopRow}>
                <Text style={s.bopLbl}>Budget</Text>
                <Text style={s.bopVal}>{m.budget.toFixed(1)} M</Text>
              </View>
              <View style={s.bopRow}>
                <Text style={s.bopLbl}>Marketing</Text>
                <Text style={s.bopVal}>{m.marketingBudget.toFixed(1)} M</Text>
              </View>
              <View style={s.bopRow}>
                <Text style={s.bopLbl}>Total Box Office</Text>
                <Text style={[s.bopVal, { color: T.green }]}>{totalBOM.toFixed(1)} M</Text>
              </View>
              <View style={[s.bopRow, { borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 4 }]}>
                <Text style={[s.bopLbl, { fontSize: 14 }]}>Profit</Text>
                <Text style={[s.bopVal, { color: profit >= 0 ? T.green : T.red, fontSize: 16 }]}>
                  {profit >= 0 ? '+' : ''}{profit.toFixed(1)} M ({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(0)}%)
                </Text>
              </View>
            </View>

            <SectionHeader title="Weekly Run" />
            <View style={s.weekChart}>
              {m.weeklyBO.map((wbo, i) => {
                const max = Math.max(...m.weeklyBO);
                const heightPct = max > 0 ? (wbo / max) * 100 : 0;
                return (
                  <View key={`wk-${i}`} style={s.barCol}>
                    <View style={s.barWrap}>
                      <View style={[s.bar, { height: `${heightPct}%`, backgroundColor: i === 0 ? T.green : T.cyan }]} />
                    </View>
                    <Text style={s.barLbl}>W{i + 1}</Text>
                    <Text style={s.barVal}>{(wbo * 1000).toFixed(0)}M</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {m.status === 'released' ? (
          <>
            <SectionHeader title="Streaming Availability" />
            <View style={s.bopanel}>
              {(() => {
                const services = (state.streamingServices || []).filter(svc => svc.catalogMovieIds.includes(m.id));
                if (!services.length) {
                  return <Text style={[s.bopLbl, { textAlign: 'center', paddingVertical: 8 }]}>Not on any streaming service.</Text>;
                }
                return services.map(svc => {
                  const owner = svc.studioId === state.player.id ? state.player : state.rivals.find(r => r.id === svc.studioId);
                  const lic = (svc.licensedMovies || []).find(l => l.movieId === m.id);
                  const isOwnerOriginal = svc.studioId === m.studioId;
                  // Streaming revenue attribution: split monthly revenue across catalog (this title's slice).
                  const titleSlice = svc.catalogMovieIds.length ? svc.monthlyRevenue / svc.catalogMovieIds.length : 0;
                  // Monthly replays estimate: subscribers × engagement factor by recency
                  const ageMonths = ((state.year - m.releaseYear) * 12 + Math.floor((state.week - m.releaseWeek) / 4));
                  const engagement = Math.max(0.05, 0.6 - ageMonths * 0.04);
                  const monthlyReplays = Math.round(svc.subscribers * engagement);
                  return (
                    <View key={svc.id} style={[s.bopRow, { flexDirection: 'column', alignItems: 'flex-start', borderTopWidth: 1, borderTopColor: T.border, paddingTop: 8, marginTop: 4 }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                        <Text style={[s.bopLbl, { fontWeight: '900', color: T.text }]}>{svc.name}</Text>
                        <Text style={[s.bopVal, { color: isOwnerOriginal ? T.green : T.cyan }]}>{isOwnerOriginal ? 'OWNED' : 'LICENSED'}</Text>
                      </View>
                      <Text style={s.bopLbl}>Studio: {owner?.name || '—'}</Text>
                      {lic ? (
                        <>
                          <Text style={s.bopLbl}>License Cost: ${lic.feePaid.toFixed(1)}M ({lic.yearsLicensed}y term)</Text>
                          <Text style={[s.bopLbl, { color: T.orange }]}>Expires: Wk {lic.expiresWeek}, Y{lic.expiresYear}</Text>
                        </>
                      ) : null}
                      <Text style={s.bopLbl}>Monthly Replays (est.): {monthlyReplays.toLocaleString()}</Text>
                      <Text style={s.bopLbl}>Monthly Streaming Revenue (attrib.): ${titleSlice.toFixed(2)}M</Text>
                    </View>
                  );
                });
              })()}
            </View>
          </>
        ) : null}
        {m.status === 'released' && m.reviews ? (
          <>
            <SectionHeader title="Reviews" />
            <View style={s.reviewsPanel}>
              {m.reviews.map((r, i) => (
                <View key={`${r.source}-${r.type}-${i}`} style={s.reviewRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.revSrc}>{r.source} <Text style={[s.revType, { color: r.type === 'critic' ? T.magenta : T.cyan }]}>· {r.type}</Text></Text>
                    <Text style={s.revQuote} numberOfLines={2}>"{r.quote}"</Text>
                  </View>
                  <Text style={s.revStars}>{'★'.repeat(Math.round(r.score))}{'☆'.repeat(5 - Math.round(r.score))}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {writer ? <><SectionHeader title="Writer" /><PersonRow t={writer} role="Writer" onPress={() => router.push(`/talent/${writer.id}`)} /></> : null}
        {director ? <><SectionHeader title="Director" /><PersonRow t={director} role="Director" onPress={() => router.push(`/talent/${director.id}`)} /></> : null}
        {castWithTalent.length > 0 ? <SectionHeader title="Cast" /> : null}
        {castWithTalent.map(c => (
          <PersonRow key={c.t.id} t={c.t} role={`${c.roleName ? '"' + c.roleName + '" · ' : ''}${prettyRole(c.role)} · ${c.dealType.replace('_', ' ')}`} onPress={() => router.push(`/talent/${c.t.id}`)} />
        ))}
      </ScrollView>

      {/* Franchise trade negotiation */}
      {(() => {
        const live = activeFranchiseOfferId ? (state.franchiseOffers || []).find(o => o.id === activeFranchiseOfferId && o.status === 'pending') : null;
        if (!live) return null;
        const playerActor: 'from' | 'to' = live.fromStudioId === state.player.id ? 'from' : 'to';
        const used = live.history.filter(h => h.actor === playerActor).length;
        const playerIsBuyer = (live.kind === 'buy' && live.fromStudioId === state.player.id) || (live.kind === 'sell' && live.toStudioId === state.player.id);
        const fr = state.franchises.find(f => f.id === live.franchiseId);
        return (
          <NegotiationModal
            visible={!!live}
            subjectTitle={fr?.name || '—'}
            subtitle={live.kind === 'buy' ? 'Buying franchise' : 'Selling franchise'}
            currentPriceB={live.priceB}
            fairValueB={quoteFranchiseValue(live.franchiseId)}
            playerSide={playerIsBuyer ? 'buyer' : 'seller'}
            roundsLeft={Math.max(0, live.maxRounds - used)}
            message={live.message}
            history={live.history}
            onAccept={() => {
              const r = acceptFranchiseOffer(live.id);
              if (r.error) { uiAlert('Failed', r.error); return; }
              uiAlert('Trade Closed ✓', `Settled at $${live.priceB.toFixed(2)}B.`);
              setActiveFranchiseOfferId(null);
            }}
            onCounter={(v: number) => {
              const r = counterFranchiseOffer(live.id, v);
              if (r.error) { uiAlert('Counter Failed', r.error); }
            }}
            onReject={() => { rejectFranchiseOffer(live.id); setActiveFranchiseOfferId(null); }}
            onClose={() => setActiveFranchiseOfferId(null)}
          />
        );
      })()}

      {/* Single-movie streaming license negotiation */}
      {(() => {
        const live = activeMovieOfferId ? (state.bulkCatalogOffers || []).find(o => o.id === activeMovieOfferId && o.status === 'pending') : null;
        if (!live) return null;
        const playerActor: 'from' | 'to' = live.fromStudioId === state.player.id ? 'from' : 'to';
        const used = live.history.filter(h => h.actor === playerActor).length;
        return (
          <NegotiationModal
            visible={!!live}
            subjectTitle={`License "${m.title}"`}
            subtitle={`${live.years}-year streaming license`}
            currentPriceB={live.priceB}
            fairValueB={quoteBulkCatalogValue(live.movieIds, live.years)}
            playerSide={live.fromStudioId === state.player.id ? 'buyer' : 'seller'}
            roundsLeft={Math.max(0, live.maxRounds - used)}
            message={live.message}
            history={live.history}
            onAccept={() => {
              const r = acceptBulkCatalogOffer(live.id);
              if (r.error) { uiAlert('Failed', r.error); return; }
              uiAlert('License Closed ✓', `Settled at $${live.priceB.toFixed(2)}B for ${live.years}yr.`);
              setActiveMovieOfferId(null);
            }}
            onCounter={(v: number) => {
              const r = counterBulkCatalogOffer(live.id, v);
              if (r.error) { uiAlert('Counter Failed', r.error); }
            }}
            onReject={() => { rejectBulkCatalogOffer(live.id); setActiveMovieOfferId(null); }}
            onClose={() => setActiveMovieOfferId(null)}
          />
        );
      })()}
    </SafeAreaView>
  );
}

function prettyRole(r: string) {
  return r.replace('lead_', 'Leading ').replace('support_', 'Supporting ').replace(/^\w/, c => c.toUpperCase()).replace('actor', 'Actor').replace('actress', 'Actress');
}

function PersonRow({ t, role, onPress }: { t: Talent; role: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.personRow} onPress={onPress} testID={`person-${t.id}`}>
      <Avatar skin={t.avatarColor} hair={t.hairColor} hairStyle={t.hairStyle} facialHair={t.facialHair} size={64} />
      <View style={{ flex: 1, paddingHorizontal: 10 }}>
        <Text style={s.personName} numberOfLines={1}>{t.name} <View style={[s.colorDot, { backgroundColor: COLOR_HEX[t.colorTrait] }]} /></Text>
        <Text style={s.personRole}>{role} · Age {Math.floor(t.age)}{t.retired ? ' · Retired' : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={s.miniRow}>
          <View style={s.miniBox}><Text style={s.miniLabel}>SKILL</Text><Text style={s.miniVal}>{t.skill}</Text></View>
          <View style={s.miniBox}><Text style={s.miniLabel}>FAME</Text><Text style={s.miniVal}>{t.fame}</Text></View>
        </View>
        <View style={s.miniRow}>
          <View style={s.miniBox}><Text style={s.miniLabel}>FILMS</Text><Text style={s.miniVal}>{t.movies}</Text></View>
          <View style={s.miniBox}><Text style={s.miniLabel}>B.O.</Text><Text style={s.miniVal}>{t.totalBO.toFixed(1)}B</Text></View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  headerRow: { flexDirection: 'row', backgroundColor: T.cardDark, padding: 12 },
  title: { color: T.text, fontSize: 20, fontWeight: '900' },
  sub: { color: T.textDim, fontSize: 13, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  studioPill: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: T.cardDark, alignItems: 'center', flex: 1 },
  studioPillLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  studioPillVal: { color: T.text, fontSize: 16, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.cardDark, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, borderWidth: 1.5 },
  badgeT: { fontSize: 11, fontWeight: '800' },
  infoGrid: { flexDirection: 'row', gap: 8, padding: 8 },
  infoBtn: { backgroundColor: T.card, borderRadius: 8, padding: 10, flex: 1, borderWidth: 2, borderColor: T.border, alignItems: 'center' },
  infoLabel: { color: T.text, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  infoVal: { color: T.textDim, fontSize: 13, marginTop: 2 },
  plot: { color: T.cardDark, fontSize: 13, fontStyle: 'italic', padding: 12, lineHeight: 18 },
  sequelBtn: { backgroundColor: T.cyan, marginHorizontal: 12, paddingVertical: 14, borderRadius: 8, alignItems: 'center', borderWidth: 2, borderColor: T.border },
  sequelTxt: { color: T.cardDark, fontWeight: '900', letterSpacing: 1 },
  bopanel: { backgroundColor: T.cardDark, marginHorizontal: 12, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: T.border },
  bopRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  bopLbl: { color: T.textDim, fontSize: 13 },
  bopVal: { color: T.text, fontWeight: '800', fontSize: 13 },
  weekChart: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: T.cardDark, marginHorizontal: 12, marginTop: 6, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: T.border, height: 160 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barWrap: { flex: 1, width: '70%', justifyContent: 'flex-end', marginBottom: 2 },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  barLbl: { color: T.textMute, fontSize: 9, marginTop: 2 },
  barVal: { color: T.text, fontSize: 9, fontWeight: '800' },
  reviewsPanel: { backgroundColor: T.cardDark, marginHorizontal: 12, marginTop: 6, padding: 8, borderRadius: 10, borderWidth: 2, borderColor: T.border },
  reviewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: T.border, gap: 8 },
  revSrc: { color: T.text, fontWeight: '800', fontSize: 12 },
  revType: { fontSize: 11, fontWeight: '700' },
  revQuote: { color: T.textDim, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  revStars: { color: T.yellow, fontSize: 14, letterSpacing: 1 },
  personRow: { flexDirection: 'row', backgroundColor: T.cardDark, padding: 10, borderBottomWidth: 1, borderBottomColor: T.border, alignItems: 'center' },
  personName: { color: T.text, fontSize: 16, fontWeight: '800' },
  personRole: { color: T.textDim, fontSize: 12, fontStyle: 'italic' },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  miniRow: { flexDirection: 'row', gap: 4, marginTop: 2 },
  miniBox: { backgroundColor: T.card, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  miniLabel: { color: T.textMute, fontSize: 9, fontWeight: '700' },
  miniVal: { color: T.text, fontSize: 11, fontWeight: '800' },
  descInput: { backgroundColor: T.cardDark, color: T.text, borderRadius: 8, padding: 10, borderWidth: 2, borderColor: T.cyan, minHeight: 80, fontSize: 13 },
  descSaveBtn: { backgroundColor: T.green, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  descSaveTxt: { color: T.cardDark, fontWeight: '900' },
  descCancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  descCancelTxt: { color: T.textDim, fontWeight: '700' },
  descEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingBottom: 8 },
  descEditTxt: { color: T.cyan, fontWeight: '700', fontSize: 11, fontStyle: 'italic' },
  actRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingTop: 8 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.cardDark, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2 },
  actTxt: { fontWeight: '900', fontSize: 11 },
});
