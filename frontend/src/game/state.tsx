import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GameState, Talent, Gender, Movie } from './types';
import { newGame, simulateWeek as simWeek, simulateMultiple as simMulti, tickWeek, createMovie as createMov, launchPlayerStreamingService as launchSvc, updatePlayerStreamingService as updateSvc, deletePlayerStreamingService as deleteSvc, addMovieToStreaming as addToStream, setMovieTierAccess as setTierAcc, removeMovieFromStreaming as removeFromStream, hireTalent as hireT, fireTalent as fireT, calculateTalentExpectations, calculateAcceptance, licenseMovieToStreaming as licenseStream, negotiateMovieLicense as negLicense, renewLicense as renewLic, setMovieReleaseDate as setRelDate, holdMovie as holdMov, setMarketingAllocation as setMktAlloc, computeLicenseFee, acceptLicenseOffer as acceptLO, counterLicenseOffer as counterLO, rejectLicenseOffer as rejectLO, signNegotiatedContract as signNeg, placeFestivalBid as bidFest, signCinemaDeal as signCine, setMovieDescription as setMovDesc, signBulkLicenseDeal as signBLD, quoteBulkLicenseDeal as quoteBLD, signFranchiseBulkLicense as signFBL, quoteFranchiseBulkLicense as quoteFBL, proposeFranchiseTrade as propFr, acceptFranchiseOffer as accFr, counterFranchiseOffer as cntFr, rejectFranchiseOffer as rejFr, quoteFranchiseValue as qFr, proposeBulkCatalogLicense as propBC, acceptBulkCatalogOffer as accBC, counterBulkCatalogOffer as cntBC, rejectBulkCatalogOffer as rejBC, quoteBulkCatalogValue as qBC, quoteFutureReleasesValueB as qFut, quoteFranchiseBulkValueB as qFrBulk, acceptIPOffer as accIP, counterIPOffer as cntIP, rejectIPOffer as rejIP, quoteIPOffer as qIP, createOutboundIPListing as createOL, acceptOutboundBid as accOB, rejectOutboundBid as rejOB, counterOutboundBid as cntOB, LaunchStreamingArgs, HireTalentArgs, LicenseMovieArgs, BulkLicenseDealParams, FranchiseBulkLicenseParams } from './sim';
import { FranchiseOfferKind } from './types';
import { GENRES } from './data';

const STORAGE_KEY = 'mooncinema_save_v8';
const LEGACY_KEYS = ['mooncinema_save_v7', 'mooncinema_save_v6', 'mooncinema_save_v5'];

// Backfill granular skills for talents that pre-date Sprint 2 (only have flat `skill`).
function ensureGranularSkills(t: any): any {
  if (t.skills && t.genreSkills) return t;
  const skill = typeof t.skill === 'number' ? t.skill : 60;
  const jitter = (b: number, sp = 12) => Math.max(30, Math.min(100, Math.round(b + (Math.random() - 0.5) * 2 * sp)));
  const breakdown: any = { starPower: t.fame ?? 30 };
  if (t.role === 'director') {
    breakdown.directing = jitter(skill, 6);
    breakdown.leadership = jitter(skill);
    breakdown.pacing = jitter(skill);
    breakdown.style = jitter(skill);
  } else if (t.role === 'writer') {
    breakdown.plot = jitter(skill, 6);
    breakdown.dialogue = jitter(skill);
    breakdown.structure = jitter(skill);
    breakdown.originality = jitter(skill);
  } else {
    breakdown.acting = jitter(skill, 6);
    breakdown.range = jitter(skill);
    breakdown.presence = jitter(skill);
    breakdown.accents = jitter(skill);
  }
  // Genre skills: 2 strong + 2 weak (random)
  const list = GENRES.slice();
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  const strong = list.slice(0, 2); const weak = list.slice(2, 4);
  const gs: any = {};
  GENRES.forEach(g => { gs[g] = strong.includes(g) ? jitter(skill + 12, 5) : weak.includes(g) ? jitter(skill - 18, 5) : jitter(skill, 6); });
  return { ...t, skills: t.skills || breakdown, genreSkills: t.genreSkills || gs };
}

// Migrate older saves: rename gold→yellow, add gender/relationships/streamingServices if missing.
function migrate(raw: any): GameState {
  const s = raw as GameState;
  // Talents: gold→yellow + gender backfill + granular skills backfill + role collapse (legacy lead_/support_ → actor/actress)
  if (Array.isArray(s.talents)) {
    s.talents = s.talents.map((t: any) => {
      const ct = t.colorTrait === 'gold' ? 'yellow' : t.colorTrait;
      // Collapse legacy roles
      let role = t.role;
      if (role === 'lead_actor' || role === 'support_actor') role = 'actor';
      else if (role === 'lead_actress' || role === 'support_actress') role = 'actress';
      let gender: Gender = t.gender;
      if (!gender) {
        if (role === 'actor') gender = 'male';
        else if (role === 'actress') gender = 'female';
        else gender = Math.random() < 0.5 ? 'male' : 'female';
      }
      return ensureGranularSkills({ ...t, role, colorTrait: ct, gender });
    }) as Talent[];
  }
  if (Array.isArray((s as any).audience)) {
    (s as any).audience = (s as any).audience.map((a: any) => ({ ...a, preferredColor: a.preferredColor === 'gold' ? 'yellow' : a.preferredColor }));
  }
  if (!s.relationships) s.relationships = {};
  if (!Array.isArray(s.streamingServices)) s.streamingServices = [];
  // Movies: ensure releaseStrategy + inStreamingServiceIds present
  if (Array.isArray(s.movies)) {
    s.movies = s.movies.map((m: Movie) => ({
      ...m,
      releaseStrategy: m.releaseStrategy || 'theatrical',
      inStreamingServiceIds: m.inStreamingServiceIds || [],
    }));
  }
  return s;
}

type Ctx = {
  state: GameState | null;
  loading: boolean;
  startNewGame: (name: string, logoIdx: number) => Promise<void>;
  resetGame: () => Promise<void>;
  save: () => Promise<void>;
  setState: (s: GameState) => void;
  simulateWeek: () => void;
  simulateMultiple: (weeks: number) => void;
  createMovie: typeof createMov;
  launchStreamingService: (args: LaunchStreamingArgs) => { error?: string };
  updateStreamingService: (id: string, patch: Parameters<typeof updateSvc>[2]) => { error?: string };
  deleteStreamingService: (id: string) => { error?: string };
  addMovieToStreaming: (serviceId: string, movieId: string, tierIds?: string[]) => { error?: string };
  setMovieTierAccess: (serviceId: string, movieId: string, tierIds: string[]) => { error?: string };
  removeMovieFromStreaming: (serviceId: string, movieId: string) => void;
  hireTalent: (args: HireTalentArgs) => { error?: string; accepted?: boolean };
  fireTalent: (talentId: string) => { error?: string };
  licenseMovieToStreaming: (serviceId: string, args: LicenseMovieArgs) => { error?: string; fee?: number };
  negotiateMovieLicense: (serviceId: string, args: LicenseMovieArgs & { offeredFeeM: number }) => { error?: string; accepted?: boolean; counter?: { feeM: number; reason: string } };
  renewLicense: (serviceId: string, movieId: string, additionalYears: 1 | 3 | 5 | 10) => { error?: string; fee?: number };
  setMovieReleaseDate: (movieId: string, week: number, year: number) => { error?: string };
  holdMovie: (movieId: string) => { error?: string };
  setMarketingAllocation: (movieId: string, allocation: Record<string, number>) => { error?: string };
  acceptOffer: (offerId: string) => { error?: string };
  counterOffer: (offerId: string, counterFeeM: number) => { error?: string };
  rejectOffer: (offerId: string) => { error?: string };
  signNegotiated: (talentId: string, numMovies: number, upfront: number, boPercent: number) => { error?: string };
  placeFestivalBid: (festivalId: string, lotId: string, bidM: number) => { error?: string };
  signCinemaDeal: (chainId: string, years: number, openShare: number, lateShare: number) => { error?: string; counter?: { openShare: number; lateShare: number; years: number; reason: string } };
  setMovieDescription: (movieId: string, description: string) => { error?: string };
  signBulkLicenseDeal: (p: BulkLicenseDealParams) => { error?: string; feeM?: number };
  quoteBulkLicenseDeal: (p: BulkLicenseDealParams) => { feeM: number; error?: string };
  signFranchiseBulkLicense: (p: FranchiseBulkLicenseParams) => { error?: string; feeM?: number };
  quoteFranchiseBulkLicense: (p: FranchiseBulkLicenseParams) => { feeM: number; error?: string; movieCount?: number };
  // External IP licensing
  acceptIPOffer: (offerId: string) => { error?: string };
  counterIPOffer: (offerId: string, terms: { feeM?: number; boPercent?: number; merchPercent?: number; years?: number; packs?: number; exclusivity?: boolean; sublicensable?: boolean }) => { error?: string };
  rejectIPOffer: (offerId: string) => void;
  quoteIPOffer: (ipId: string, terms: { feeM: number; boPercent: number; merchPercent: number; years: number; packs: number; exclusivity: boolean; sublicensable: boolean }) => { feeM: number; error?: string };
  createOutboundIPListing: (args: { sourceFranchiseId?: string; sourceMovieId?: string; category: import('./types').IPCategory }) => { error?: string; listingId?: string };
  acceptOutboundBid: (bidId: string) => { error?: string };
  rejectOutboundBid: (bidId: string) => void;
  proposeFranchiseTrade: (args: { franchiseId: string; kind: FranchiseOfferKind; priceB: number }) => { error?: string; offerId?: string };
  acceptFranchiseOffer: (offerId: string) => { error?: string };
  counterFranchiseOffer: (offerId: string, newPriceB: number) => { error?: string };
  rejectFranchiseOffer: (offerId: string) => void;
  quoteFranchiseValue: (franchiseId: string) => number;
  proposeBulkCatalogLicense: (args: { toRivalStudioId: string; movieIds: string[]; priceB: number; years: number; serviceId: string; exclusivity?: boolean; dealKind?: 'catalog' | 'future_releases' | 'franchise_bulk'; franchiseId?: string; futureMovieCount?: number }) => { error?: string; offerId?: string };
  acceptBulkCatalogOffer: (offerId: string) => { error?: string };
  counterBulkCatalogOffer: (offerId: string, newPriceB: number) => { error?: string };
  rejectBulkCatalogOffer: (offerId: string) => void;
  quoteBulkCatalogValue: (movieIds: string[], years: number) => number;
  quoteFutureReleasesValueB: (rivalStudioId: string, movieCount: number, years: number) => number;
  quoteFranchiseBulkValueB: (franchiseId: string, years: number) => number;
  counterOutboundBid: (bidId: string, terms: { feeM?: number; royaltyPercent?: number; years?: number }) => { error?: string };
};

const GameCtx = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInner] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(STORAGE_KEY);
        // If v4 missing, attempt to migrate from a legacy save
        if (!raw) {
          for (const k of LEGACY_KEYS) {
            const legacy = await AsyncStorage.getItem(k);
            if (legacy) {
              try {
                const migrated = migrate(JSON.parse(legacy));
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                raw = JSON.stringify(migrated);
                break;
              } catch { /* ignore bad legacy */ }
            }
          }
        }
        if (raw) {
          setStateInner(migrate(JSON.parse(raw)));
        }
      } catch (e) {
        console.warn('load failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (s: GameState) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { console.warn('save failed', e); }
  }, []);

  const setState = useCallback((s: GameState) => {
    setStateInner(s);
    persist(s);
  }, [persist]);

  const startNewGame = useCallback(async (name: string, logoIdx: number) => {
    const fresh = newGame(name, logoIdx);
    setStateInner(fresh);
    await persist(fresh);
  }, [persist]);

  const resetGame = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setStateInner(null);
  }, []);

  const save = useCallback(async () => { if (state) await persist(state); }, [state, persist]);

  const simulateWeek = useCallback(() => {
    if (!state) return;
    const next = tickWeek(state);
    setStateInner(next);
    persist(next);
  }, [state, persist]);

  const simulateMultiple = useCallback((weeks: number) => {
    if (!state) return;
    const next = simMulti(state, weeks);
    setStateInner(next);
    persist(next);
  }, [state, persist]);

  const createMovie: typeof createMov = useCallback((s, args) => {
    const result = createMov(s, args);
    if (!result.error) {
      setStateInner(result.state);
      persist(result.state);
    }
    return result;
  }, [persist]);

  const launchStreamingService = useCallback((args: LaunchStreamingArgs) => {
    if (!state) return { error: 'No game.' };
    const r = launchSvc(state, args);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  const updateStreamingService = useCallback((id: string, patch: Parameters<typeof updateSvc>[2]) => {
    if (!state) return { error: 'No game.' };
    const r = updateSvc(state, id, patch);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  const deleteStreamingService = useCallback((id: string) => {
    if (!state) return { error: 'No game.' };
    const r = deleteSvc(state, id);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  const addMovieToStreaming = useCallback((serviceId: string, movieId: string, tierIds?: string[]) => {
    if (!state) return { error: 'No game.' };
    const r = addToStream(state, serviceId, movieId, tierIds);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  const setMovieTierAccess = useCallback((serviceId: string, movieId: string, tierIds: string[]) => {
    if (!state) return { error: 'No game.' };
    const r = setTierAcc(state, serviceId, movieId, tierIds);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  const removeMovieFromStreaming = useCallback((serviceId: string, movieId: string) => {
    if (!state) return;
    const r = removeFromStream(state, serviceId, movieId);
    setStateInner(r.state);
    persist(r.state);
  }, [state, persist]);

  const hireTalent = useCallback((args: HireTalentArgs) => {
    if (!state) return { error: 'No game.' };
    const r = hireT(state, args);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error, accepted: r.accepted };
  }, [state, persist]);

  const fireTalent = useCallback((talentId: string) => {
    if (!state) return { error: 'No game.' };
    const r = fireT(state, talentId);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  const licenseMovieToStreaming = useCallback((serviceId: string, args: LicenseMovieArgs) => {
    if (!state) return { error: 'No game.' };
    const r = licenseStream(state, serviceId, args);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error, fee: r.fee };
  }, [state, persist]);

  const negotiateMovieLicense = useCallback((serviceId: string, args: LicenseMovieArgs & { offeredFeeM: number }) => {
    if (!state) return { error: 'No game.' };
    const r = negLicense(state, serviceId, args);
    if (r.accepted) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error, accepted: r.accepted, counter: r.counter };
  }, [state, persist]);

  const renewLicense = useCallback((serviceId: string, movieId: string, additionalYears: 1 | 3 | 5 | 10) => {
    if (!state) return { error: 'No game.' };
    const r = renewLic(state, serviceId, movieId, additionalYears);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error, fee: r.fee };
  }, [state, persist]);

  const setMovieReleaseDate = useCallback((movieId: string, week: number, year: number) => {
    if (!state) return { error: 'No game.' };
    const r = setRelDate(state, movieId, week, year);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  const holdMovie = useCallback((movieId: string) => {
    if (!state) return { error: 'No game.' };
    const r = holdMov(state, movieId);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  const setMarketingAllocation = useCallback((movieId: string, allocation: Record<string, number>) => {
    if (!state) return { error: 'No game.' };
    const r = setMktAlloc(state, movieId, allocation);
    if (!r.error) {
      setStateInner(r.state);
      persist(r.state);
    }
    return { error: r.error };
  }, [state, persist]);

  return (
    <GameCtx.Provider value={{
      state, loading, startNewGame, resetGame, save, setState, simulateWeek, simulateMultiple, createMovie,
      launchStreamingService, updateStreamingService, deleteStreamingService, addMovieToStreaming, setMovieTierAccess, removeMovieFromStreaming,
      hireTalent, fireTalent, licenseMovieToStreaming, negotiateMovieLicense, renewLicense, setMovieReleaseDate, holdMovie, setMarketingAllocation,
      acceptOffer: (offerId: string) => {
        if (!state) return { error: 'No game.' };
        const r = acceptLO(state, offerId);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      counterOffer: (offerId: string, fee: number) => {
        if (!state) return { error: 'No game.' };
        const r = counterLO(state, offerId, fee);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      rejectOffer: (offerId: string) => {
        if (!state) return { error: 'No game.' };
        const r = rejectLO(state, offerId);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      signNegotiated: (talentId: string, numMovies: number, upfront: number, boPercent: number) => {
        if (!state) return { error: 'No game.' };
        const r = signNeg(state, talentId, numMovies, upfront, boPercent);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      placeFestivalBid: (festivalId: string, lotId: string, bidM: number) => {
        if (!state) return { error: 'No game.' };
        const r = bidFest(state, festivalId, lotId, bidM);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      signCinemaDeal: (chainId: string, years: number, openShare: number, lateShare: number) => {
        if (!state) return { error: 'No game.' };
        const r = signCine(state, chainId, years, openShare, lateShare);
        if (!r.error && !r.counter) { setStateInner(r.state); persist(r.state); }
        else if (r.counter) { setStateInner(r.state); persist(r.state); } // newsLog updated even on counter
        return { error: r.error, counter: r.counter };
      },
      setMovieDescription: (movieId: string, description: string) => {
        if (!state) return { error: 'No game.' };
        const r = setMovDesc(state, movieId, description);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      signBulkLicenseDeal: (p: BulkLicenseDealParams) => {
        if (!state) return { error: 'No game.' };
        const r = signBLD(state, p);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error, feeM: r.feeM };
      },
      quoteBulkLicenseDeal: (p: BulkLicenseDealParams) => {
        if (!state) return { feeM: 0, error: 'No game.' };
        return quoteBLD(state, p);
      },
      signFranchiseBulkLicense: (p: FranchiseBulkLicenseParams) => {
        if (!state) return { error: 'No game.' };
        const r = signFBL(state, p);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error, feeM: r.feeM };
      },
      quoteFranchiseBulkLicense: (p: FranchiseBulkLicenseParams) => {
        if (!state) return { feeM: 0, error: 'No game.' };
        return quoteFBL(state, p);
      },
      acceptIPOffer: (offerId: string) => {
        if (!state) return { error: 'No game.' };
        const r = accIP(state, offerId);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      counterIPOffer: (offerId, terms) => {
        if (!state) return { error: 'No game.' };
        const r = cntIP(state, offerId, terms);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      rejectIPOffer: (offerId: string) => {
        if (!state) return;
        const r = rejIP(state, offerId);
        setStateInner(r.state); persist(r.state);
      },
      quoteIPOffer: (ipId, terms) => {
        if (!state) return { feeM: 0, error: 'No game.' };
        return qIP(state, ipId, terms);
      },
      createOutboundIPListing: (args) => {
        if (!state) return { error: 'No game.' };
        const r = createOL(state, args);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error, listingId: r.listingId };
      },
      acceptOutboundBid: (bidId: string) => {
        if (!state) return { error: 'No game.' };
        const r = accOB(state, bidId);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      rejectOutboundBid: (bidId: string) => {
        if (!state) return;
        const r = rejOB(state, bidId);
        setStateInner(r.state); persist(r.state);
      },
      proposeFranchiseTrade: (args) => {
        if (!state) return { error: 'No game.' };
        const r = propFr(state, args);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error, offerId: r.offer?.id };
      },
      acceptFranchiseOffer: (offerId) => {
        if (!state) return { error: 'No game.' };
        const r = accFr(state, offerId);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      counterFranchiseOffer: (offerId, newPriceB) => {
        if (!state) return { error: 'No game.' };
        const r = cntFr(state, offerId, newPriceB);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      rejectFranchiseOffer: (offerId) => {
        if (!state) return;
        const r = rejFr(state, offerId);
        setStateInner(r.state); persist(r.state);
      },
      quoteFranchiseValue: (franchiseId) => state ? qFr(state, franchiseId) : 0,
      proposeBulkCatalogLicense: (args) => {
        if (!state) return { error: 'No game.' };
        const r = propBC(state, { ...args });
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error, offerId: r.offer?.id };
      },
      acceptBulkCatalogOffer: (offerId) => {
        if (!state) return { error: 'No game.' };
        const r = accBC(state, offerId);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      counterBulkCatalogOffer: (offerId, newPriceB) => {
        if (!state) return { error: 'No game.' };
        const r = cntBC(state, offerId, newPriceB);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
      rejectBulkCatalogOffer: (offerId) => {
        if (!state) return;
        const r = rejBC(state, offerId);
        setStateInner(r.state); persist(r.state);
      },
      quoteBulkCatalogValue: (movieIds, years) => state ? qBC(state, movieIds, years) : 0,
      quoteFutureReleasesValueB: (rivalStudioId, movieCount, years) => state ? qFut(state, rivalStudioId, movieCount, years) : 0,
      quoteFranchiseBulkValueB: (franchiseId, years) => state ? qFrBulk(state, franchiseId, years) : 0,
      counterOutboundBid: (bidId, terms) => {
        if (!state) return { error: 'No game.' };
        const r = cntOB(state, bidId, terms);
        if (!r.error) { setStateInner(r.state); persist(r.state); }
        return { error: r.error };
      },
    }}>
      {children}
    </GameCtx.Provider>
  );
}

export function useGame(): Ctx {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
