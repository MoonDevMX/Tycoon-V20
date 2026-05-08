import { GameState, Movie, Studio, Talent, Franchise, AudienceSegment, ColorTrait, DealType, Role, StreamingService, ReleaseStrategy, Genre, LicenseOffer, Festival, FestivalLot, CinemaDeal, CinemaRegion, FranchiseOffer, FranchiseOfferKind, BulkCatalogOffer } from './types';
import { GENRE_ICON, RIVAL_NAMES, STUDIO_LOGOS, arcGenreFit, computeChemistryBonus, contractTerms, dealTerms, generateReviews, genFranchiseName, genPlot, genTalent, genTitleSubtitle, holidayFor, pick, randInt, uid, GENRES, WEEKS_PER_YEAR, COLORS, relKey, nudgeRelInPlace, defaultTiers, genServiceName, recomputeStreamingSubs, effectiveSkillFor, aiBudgetForRating, licenseDesirability, licenseOfferDialog, FESTIVAL_TEMPLATES, CINEMA_CHAINS, cinemaDealRange, cinemaStudioShareForWeek, seedExternalLicensors, quoteIPLicenseFee, ipBoostsForMovie } from './data';
import { computeMarketingEfficiency } from './marketing';

export const POST_PRODUCTION_COOLDOWN_WEEKS = 3;

// Talent is available for casting in a NEW movie when:
//  - not retired
//  - not currently locked in another in-production movie
//  - past their post-release cooldown (3 weeks from last release)
export function talentAvailability(t: Talent, currentWeek: number, currentYear: number): { available: boolean; reason?: string; cooldownWeeksLeft?: number } {
  if (t.retired) return { available: false, reason: 'Retired' };
  if (t.inProductionMovieId) return { available: false, reason: 'In production' };
  const fromY = t.availableFromYear ?? 0;
  const fromW = t.availableFromWeek ?? 0;
  if (fromY > currentYear || (fromY === currentYear && fromW > currentWeek)) {
    const weeksLeft = (fromY - currentYear) * WEEKS_PER_YEAR + (fromW - currentWeek);
    return { available: false, reason: 'Cooldown', cooldownWeeksLeft: weeksLeft };
  }
  return { available: true };
}

// Per-color, per-role talent counts (yields ~100 per color, ~600 total)
const ROLE_COUNTS_PER_COLOR: Record<Role, number> = {
  writer: 16,
  director: 16,
  actor: 34,
  actress: 34,
};

function generateBalancedTalentPool(): Talent[] {
  const pool: Talent[] = [];
  COLORS.forEach(color => {
    (Object.keys(ROLE_COUNTS_PER_COLOR) as Role[]).forEach(role => {
      const n = ROLE_COUNTS_PER_COLOR[role];
      for (let i = 0; i < n; i++) {
        // Age cohorts: 30% young (22-32), 50% mid (33-55), 20% veteran (56-72)
        const r = Math.random();
        let ageMin: number, ageMax: number;
        if (r < 0.3) { ageMin = 22; ageMax = 32; }
        else if (r < 0.8) { ageMin = 33; ageMax = 55; }
        else { ageMin = 56; ageMax = 72; }
        // Realistic skill spread: rookies start low; veterans are usually better but not guaranteed.
        // Bell-curve in genTalent ensures most cluster mid; few are elite (the 90+ rare).
        const baseSkill = ageMax > 55 ? 45 : ageMax > 32 ? 35 : 28;
        pool.push(genTalent(role, { ageMin, ageMax, color, skillMin: baseSkill, skillMax: 95 }) as Talent);
      }
    });
  });
  return pool;
}

function buildInitialRelationships(allStudioIds: string[]): Record<string, number> {
  const rels: Record<string, number> = {};
  for (let i = 0; i < allStudioIds.length; i++) {
    for (let j = i + 1; j < allStudioIds.length; j++) {
      // Start near neutral with light spread
      rels[relKey(allStudioIds[i], allStudioIds[j])] = randInt(-12, 12);
    }
  }
  return rels;
}

// =====================================================================
// BULK STREAMING LICENSING — buy a multi-year deal where rival's future
// movies auto-license to player's streaming service.
// =====================================================================
export interface BulkLicenseDealParams { rivalStudioId: string; serviceId: string; movieCount: number; years: number; }
// Heuristic price: rival reputation × movie count × years × random multiplier (in $M).
export function quoteBulkLicenseDeal(state: GameState, p: BulkLicenseDealParams): { feeM: number; error?: string } {
  const rival = state.rivals.find(r => r.id === p.rivalStudioId);
  if (!rival) return { feeM: 0, error: 'Rival not found.' };
  const reputationMult = 1 + (rival.rating - 1) * 0.35;
  const recentBO = state.movies
    .filter(m => m.studioId === rival.id && m.status === 'released' && (state.year - m.releaseYear) <= 5)
    .reduce((a, b) => a + b.boxOffice, 0);
  const recencyMult = 1 + Math.min(2.5, recentBO / 6);
  const baseFee = 25 * p.movieCount * reputationMult * recencyMult * (1 + (p.years - 1) * 0.18);
  return { feeM: +baseFee.toFixed(1) };
}

// Compute weeks of windowing before a rival's released movie joins the player's service
// under a bulk deal. Hybrids included; theatrical=8–12w, streaming-only=26–52w, hybrid=16–32w.
export function bulkLicenseDelayWeeks(strategy?: 'theatrical' | 'streaming' | 'hybrid'): number {
  if (strategy === 'streaming') return randInt(26, 52);
  if (strategy === 'hybrid') return randInt(16, 32);
  return randInt(8, 12); // theatrical (default)
}

// Add (week, year, +deltaWeeks) → eligibility (week, year).
function addWeeksWY(week: number, year: number, deltaWeeks: number): { week: number; year: number } {
  let w = week + deltaWeeks;
  let y = year;
  while (w > WEEKS_PER_YEAR) { w -= WEEKS_PER_YEAR; y += 1; }
  return { week: w, year: y };
}

export function signBulkLicenseDeal(state: GameState, p: BulkLicenseDealParams): { state: GameState; error?: string; feeM?: number } {
  const svcIdx = (state.streamingServices || []).findIndex(s => s.id === p.serviceId && s.studioId === state.player.id);
  if (svcIdx < 0) return { state, error: 'Streaming service not found.' };
  if (p.movieCount < 1 || p.movieCount > 50) return { state, error: 'Movie count must be 1–50.' };
  if (p.years < 1 || p.years > 10) return { state, error: 'Years must be 1–10.' };
  const quote = quoteBulkLicenseDeal(state, p);
  if (quote.error) return { state, error: quote.error };
  if (state.player.cash * 1000 < quote.feeM) return { state, error: `Need $${quote.feeM.toFixed(1)}M cash (have $${(state.player.cash * 1000).toFixed(1)}M).` };
  const rival = state.rivals.find(r => r.id === p.rivalStudioId)!;
  const services = state.streamingServices.slice();
  const cur = services[svcIdx];
  const expiresWeek = state.week;
  const expiresYear = state.year + p.years;
  const newDeal = {
    id: uid('bld_'),
    rivalStudioId: p.rivalStudioId,
    rivalName: rival.name,
    movieCountTotal: p.movieCount,
    moviesUsed: 0,
    expiresWeek, expiresYear,
    feePaidM: quote.feeM,
    signedWeek: state.week, signedYear: state.year,
    queuedMovies: [],
  };
  services[svcIdx] = { ...cur, bulkLicenseDeals: [...(cur.bulkLicenseDeals || []), newDeal] };
  const updatedPlayer = { ...state.player, cash: +(state.player.cash - quote.feeM / 1000).toFixed(3) };
  const relationships = { ...state.relationships };
  nudgeRelInPlace(relationships, state.player.id, p.rivalStudioId, 6);
  const newsLog = [{ week: state.week, year: state.year, text: `${state.player.name} signs a $${quote.feeM.toFixed(1)}M bulk-license deal with ${rival.name} (${p.movieCount} films / ${p.years}y).` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, player: updatedPlayer, streamingServices: services, relationships, newsLog }, feeM: quote.feeM };
}

// =====================================================================
// FRANCHISE BULK LICENSE — option B: license a rival franchise (current + future)
// to the player's streaming service for X years. All currently-released films of the
// franchise (≥0y, no age gate) are added immediately; future releases auto-stream
// after the standard windowing delay.
// =====================================================================
export interface FranchiseBulkLicenseParams { franchiseId: string; serviceId: string; years: number; }
export function quoteFranchiseBulkLicense(state: GameState, p: FranchiseBulkLicenseParams): { feeM: number; error?: string; movieCount?: number } {
  const fr = state.franchises.find(f => f.id === p.franchiseId);
  if (!fr) return { feeM: 0, error: 'Franchise not found.' };
  if (fr.studioId === state.player.id) return { feeM: 0, error: 'You already own this franchise.' };
  if (p.years < 1 || p.years > 10) return { feeM: 0, error: 'Years must be 1–10.' };
  const released = state.movies.filter(m => m.franchiseId === fr.id && m.status === 'released');
  // Base on franchise popularity, total/recent BO, and term length.
  const recentBO = released.filter(m => (state.year - m.releaseYear) <= 5).reduce((a, b) => a + b.boxOffice, 0);
  const popMult = 0.6 + (fr.popularity / 100) * 1.4;       // 0.6..2.0
  const boMult = 1 + Math.min(3, recentBO / 5);            // saturates at 4×
  const filmMult = 0.6 + Math.min(3, released.length * 0.18); // more films = pricier
  const base = 60 * popMult * boMult * filmMult * (1 + (p.years - 1) * 0.22);
  return { feeM: +base.toFixed(1), movieCount: released.length };
}
export function signFranchiseBulkLicense(state: GameState, p: FranchiseBulkLicenseParams): { state: GameState; error?: string; feeM?: number } {
  const svcIdx = (state.streamingServices || []).findIndex(s => s.id === p.serviceId && s.studioId === state.player.id);
  if (svcIdx < 0) return { state, error: 'Streaming service not found.' };
  const fr = state.franchises.find(f => f.id === p.franchiseId);
  if (!fr) return { state, error: 'Franchise not found.' };
  if (fr.studioId === state.player.id) return { state, error: 'You already own this franchise.' };
  const quote = quoteFranchiseBulkLicense(state, p);
  if (quote.error) return { state, error: quote.error };
  if (state.player.cash * 1000 < quote.feeM) return { state, error: `Need $${quote.feeM.toFixed(1)}M cash (have $${(state.player.cash * 1000).toFixed(1)}M).` };
  const services = state.streamingServices.slice();
  const cur = services[svcIdx];
  const expiresYear = state.year + p.years;
  const released = state.movies.filter(m => m.franchiseId === fr.id && m.status === 'released' && m.studioId === fr.studioId);
  const existingIds = released.map(m => m.id);
  // Add all currently-released franchise films immediately; record as licensed-in titles.
  const licenseEntries = (cur.licensedMovies || []).slice();
  for (const mid of existingIds) {
    if (!cur.catalogMovieIds.includes(mid)) {
      licenseEntries.push({ movieId: mid, tierIds: [], feePaid: quote.feeM / Math.max(1, existingIds.length), yearsLicensed: p.years, expiresWeek: state.week, expiresYear });
    }
  }
  const newDeal = {
    id: uid('bld_'),
    rivalStudioId: fr.studioId,
    rivalName: state.rivals.find(r => r.id === fr.studioId)?.name || 'Studio',
    movieCountTotal: 9999,
    moviesUsed: 0,
    expiresWeek: state.week, expiresYear,
    feePaidM: quote.feeM,
    signedWeek: state.week, signedYear: state.year,
    franchiseId: fr.id,
    queuedMovies: [],
  };
  services[svcIdx] = {
    ...cur,
    catalogMovieIds: [...cur.catalogMovieIds, ...existingIds.filter(id => !cur.catalogMovieIds.includes(id))],
    licensedMovies: licenseEntries,
    bulkLicenseDeals: [...(cur.bulkLicenseDeals || []), newDeal],
  };
  // Mark the existing movies as in-this-service
  const movies = state.movies.map(m => existingIds.includes(m.id)
    ? { ...m, inStreamingServiceIds: Array.from(new Set([...(m.inStreamingServiceIds || []), cur.id])) }
    : m);
  const updatedPlayer = { ...state.player, cash: +(state.player.cash - quote.feeM / 1000).toFixed(3) };
  const relationships = { ...state.relationships };
  nudgeRelInPlace(relationships, state.player.id, fr.studioId, 6);
  const newsLog = [{ week: state.week, year: state.year, text: `${state.player.name} bulk-licenses the entire ${fr.name} franchise to ${cur.name} for $${quote.feeM.toFixed(1)}M / ${p.years}y (${existingIds.length} films + future).` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, player: updatedPlayer, streamingServices: services, movies, relationships, newsLog }, feeM: quote.feeM };
}

export function newGame(playerName: string, logoIdx: number): GameState {
  const player: Studio = {
    id: uid('s_'),
    name: playerName || 'Luna Productions',
    logoBg: STUDIO_LOGOS[logoIdx % STUDIO_LOGOS.length].bg,
    logoIcon: STUDIO_LOGOS[logoIdx % STUDIO_LOGOS.length].icon,
    cash: 0.5, totalBO: 0, releases: 0, awards: 0, rating: 1, isPlayer: true,
  };

  // 14 distinct AI studios → 15 total with the player.
  // Force at least 5 rivals to be high-rating ($200M+ blockbuster spenders) so Big Picture awards trigger.
  const forcedHighRatings = [5, 5, 4, 4, 4]; // first 5 rivals will be top-tier
  const rivals: Studio[] = RIVAL_NAMES.slice(0, 14).map((n, i) => {
    // Skip whichever logo the player picked when assigning rival logos so it stays distinctive.
    const playerLogo = logoIdx % STUDIO_LOGOS.length;
    let li = (i + 1) % STUDIO_LOGOS.length;
    if (li === playerLogo) li = (li + 1) % STUDIO_LOGOS.length;
    const logo = STUDIO_LOGOS[li];
    const rating = i < forcedHighRatings.length ? forcedHighRatings[i] : randInt(2, 4);
    // Cash scales with rating so blockbuster studios can actually fund $200M+ tentpoles
    const cash = rating >= 5 ? randInt(800, 1500)
               : rating >= 4 ? randInt(400, 800)
               : rating >= 3 ? randInt(150, 400)
               : randInt(50, 200);
    return {
      id: uid('s_'), name: n, logoBg: logo.bg, logoIcon: logo.icon,
      cash, totalBO: 0,           // computed from seeded movies in seedHistory
      releases: 0, awards: 0,     // computed from seeded movies in seedHistory
      rating, isPlayer: false,
    };
  });

  // Balanced talent pool: ~100 per color, ~600 total, mix of ages and genders.
  const talents: Talent[] = generateBalancedTalentPool();

  const franchises: Franchise[] = [];
  const usedFranchiseNames = new Set<string>();
  rivals.forEach(r => {
    // Bigger studios get more franchises (rating-scaled). Range: 4–14 per studio.
    const fcount = r.rating >= 5 ? randInt(10, 14)
                 : r.rating >= 4 ? randInt(7, 12)
                 : r.rating >= 3 ? randInt(5, 9)
                 : randInt(4, 7);
    for (let i = 0; i < fcount; i++) {
      const g = pick(GENRES);
      const fname = genFranchiseName(usedFranchiseNames);
      usedFranchiseNames.add(fname);
      franchises.push({
        id: uid('f_'), name: fname, studioId: r.id,
        movieIds: [], popularity: randInt(40, 90),
        iconKey: GENRE_ICON[g].icon, iconBg: GENRE_ICON[g].bg,
        lastReleasedWeek: 0, lastReleasedYear: 0,
      });
    }
  });

  // Audience segments — population demographics with color preferences
  const audience: AudienceSegment[] = [
    { label: 'Male 18-35',   share: 0.22, preferredColor: 'red',    preferredGenres: ['Action', 'Sci-Fi', 'Thriller'] },
    { label: 'Female 18-35', share: 0.22, preferredColor: 'yellow', preferredGenres: ['Romance', 'Drama', 'Comedy'] },
    { label: 'Male 36-55',   share: 0.18, preferredColor: 'blue',   preferredGenres: ['Thriller', 'Drama', 'Mystery'] },
    { label: 'Female 36-55', share: 0.18, preferredColor: 'purple', preferredGenres: ['Drama', 'Mystery', 'Fantasy'] },
    { label: 'Family',       share: 0.20, preferredColor: 'green',  preferredGenres: ['Animation', 'Fantasy', 'Comedy'] },
  ];

  const allStudioIds = [player.id, ...rivals.map(r => r.id)];
  const relationships = buildInitialRelationships(allStudioIds);

  // Seed 4 rivals with active streaming services so the player has competitors on Day 1.
  const seededRivalIdxs = [0, 3, 6, 9].map(i => i % rivals.length);
  const streamingServices: StreamingService[] = seededRivalIdxs.map(i => {
    const r = rivals[i];
    const tiers = defaultTiers().map(t => ({ ...t, price: +(t.price * (0.85 + Math.random() * 0.4)).toFixed(2) }));
    const subscribers = randInt(2_000_000, 18_000_000);
    const tierSubs: Record<string, number> = {};
    tiers.forEach((t, ix) => { tierSubs[t.id] = Math.round(subscribers * [0.5, 0.35, 0.15][ix]); });
    return {
      id: uid('ss_'),
      studioId: r.id,
      name: genServiceName(r.name),
      tiers,
      subscribers,
      tierSubscribers: tierSubs,
      monthlyRevenue: +(subscribers * 12 / 1_000_000).toFixed(2),
      reputation: randInt(40, 75),
      catalogMovieIds: [],
      launchedYear: 0,
      launchedWeek: 1,
      history: [],
    };
  });

  const START_YEAR = 51; // Game starts at year 51 → 50 years of industry history seeded before Day 1
  const ipSeed = seedExternalLicensors();
  const seeded = seedHistory({
    initialized: true, week: 1, year: START_YEAR, player, rivals,
    movies: [], talents, franchises, audience, relationships, streamingServices,
    newsLog: [{ week: 1, year: START_YEAR, text: `${player.name} opens its doors. The industry has 50 years of history, ${streamingServices.length} streaming services online.` }],
    externalLicensors: ipSeed.licensors,
    externalIPs: ipSeed.ips,
    externalIPOffers: [],
    ownedIPLicenses: [],
    outboundIPListings: [],
    outboundIPBids: [],
  });
  // Seed 1 starter inbound IP offer so the player sees the External IP feature on day 1.
  return generateInboundIPOffer(seeded);
}

// Pre-populate ~50 in-game years of AI-released movies so the world feels truly mature on Day 1.
// Each rival's franchise gets 3-10 retroactive films across decades; bigger studios get more
// franchises and more standalone originals. Movies are fully formed (cast, crew, BO, reviews)
// but dated in the past so the player joins a deep industry, not an empty one.
function seedHistory(s: GameState): GameState {
  const movies: Movie[] = [];
  const usedTitles = new Set<string>();
  const HISTORY_YEARS = 50;
  for (const r of s.rivals) {
    const myFranchises = s.franchises.filter(f => f.studioId === r.id);
    // Independent originals across 50y — bigger studios release more.
    const ratingMult = 0.5 + (r.rating - 1) * 0.45; // rating 1 → 0.5, rating 5 → 2.3
    const originalsCount = Math.round(randInt(20, 45) * ratingMult);
    for (let i = 0; i < originalsCount; i++) {
      const yearOffset = randInt(-(HISTORY_YEARS - 1), -1);
      const yr = s.year + yearOffset;
      const wk = randInt(1, WEEKS_PER_YEAR);
      const m = makeHistoricMovie(s, r.id, undefined, wk, yr, usedTitles);
      if (m) { movies.push(m); }
    }
    // Franchise titles: 3-10 movies per franchise spread across 50y
    for (const fr of myFranchises) {
      const count = randInt(3, 10);
      const slots = Array.from({ length: count }, () => ({
        yearOffset: randInt(-(HISTORY_YEARS - 1), -1),
        week: randInt(1, WEEKS_PER_YEAR),
      })).sort((a, b) => a.yearOffset * 100 + a.week - (b.yearOffset * 100 + b.week));
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const yr = s.year + slot.yearOffset;
        // First film = Original; subsequent = Sequel (most common) or Spinoff
        const brand: 'Original' | 'Sequel' | 'Spinoff' = i === 0 ? 'Original' : (Math.random() < 0.7 ? 'Sequel' : 'Spinoff');
        const sequelNum = brand === 'Sequel' ? i + 1 : 1;
        const m = makeHistoricMovie(s, r.id, fr.id, slot.week, yr, usedTitles, { brand, sequelNum });
        if (m) {
          fr.movieIds.push(m.id);
          fr.lastReleasedWeek = slot.week;
          fr.lastReleasedYear = yr;
          if (m.criticScore >= 75) fr.popularity = Math.min(100, fr.popularity + 3);
          movies.push(m);
        }
      }
    }
    // Recompute rival career stats from actual seeded movies (coherence guarantee — no more inflated random numbers)
    const myMovies = movies.filter(mm => mm.studioId === r.id);
    const totalBO = myMovies.reduce((a, b) => a + b.boxOffice, 0);
    const totalAwards = myMovies.reduce((a, b) => a + (b.awards || 0), 0);
    const idx = s.rivals.findIndex(rr => rr.id === r.id);
    if (idx >= 0) {
      s.rivals[idx] = { ...r, releases: myMovies.length, totalBO: +totalBO.toFixed(3), awards: totalAwards };
    }
  }
  // Seed each rival streaming service catalog with 15-40 of their owner's released movies (newest first)
  const seededServices = s.streamingServices.map(svc => {
    const ownerMovies = movies.filter(m => m.studioId === svc.studioId).sort((a, b) => (b.releaseYear * 100 + b.releaseWeek) - (a.releaseYear * 100 + a.releaseWeek));
    const take = ownerMovies.slice(0, randInt(15, 40)).map(m => m.id);
    return { ...svc, catalogMovieIds: take, launchedYear: s.year - randInt(3, 12) };
  });
  // Mark which movies are in streaming
  for (const svc of seededServices) {
    for (const mid of svc.catalogMovieIds) {
      const m = movies.find(mm => mm.id === mid);
      if (m) m.inStreamingServiceIds = [...(m.inStreamingServiceIds || []), svc.id];
    }
  }
  const news = [
    { week: 1, year: s.year, text: `Industry overview: ${s.rivals.length} active studios, ${movies.length} films in distribution, ${seededServices.length} streaming services online.` },
    ...s.newsLog,
  ];
  return { ...s, movies, streamingServices: seededServices, newsLog: news.slice(0, 100) };
}

function makeHistoricMovie(s: GameState, studioId: string, franchiseId: string | undefined, releaseWeek: number, releaseYear: number, usedTitles?: Set<string>, sequelInfo?: { brand: 'Original' | 'Sequel' | 'Spinoff'; sequelNum: number }): Movie | null {
  const genre = pick(GENRES);
  const wr = pick(s.talents.filter(t => t.role === 'writer'));
  const dir = pick(s.talents.filter(t => t.role === 'director'));
  const actor = pick(s.talents.filter(t => t.role === 'actor'));
  const actress = pick(s.talents.filter(t => t.role === 'actress'));
  if (!wr || !dir || !actor || !actress) return null;
  const budget = randInt(40, 280);
  const criticScore = randInt(48, 94);
  // Decent BO for a finished history movie based on critic score (in $B)
  const baseBOM = budget * (0.6 + (criticScore - 50) / 60) * (0.7 + Math.random() * 1.4);
  const boB = Math.max(0.02, +(baseBOM / 1000).toFixed(3));
  const id = uid('mh_');
  // Title generation: if franchise-bound, derive from franchise + brand to keep continuity unique;
  // else use a unique standalone title.
  let title: string;
  let brand: Movie['brand'] = 'Original';
  if (franchiseId) {
    const fr = s.franchises.find(f => f.id === franchiseId);
    const fname = fr?.name || genFranchiseName(usedTitles);
    brand = sequelInfo?.brand || 'Original';
    title = genTitleSubtitle(fname, brand, sequelInfo?.sequelNum || 1, usedTitles);
  } else {
    title = genFranchiseName(usedTitles);
  }
  if (usedTitles) usedTitles.add(title);
  const movie: Movie = {
    id, title, type: genre as any, genre,
    plotArc: pick(['Man in a Hole', 'Icarus', 'Cinderella'] as any),
    rating: pick(['PG-13', 'R', 'PG'] as any), runtime: randInt(85, 145),
    brand, franchiseId,
    studioId, writerId: wr.id, directorId: dir.id,
    cast: [
      { talentId: actor.id, role: 'lead_actor', dealType: 'middle', contractKind: 'single', salary: actor.salary, boPercent: 1 },
      { talentId: actress.id, role: 'lead_actress', dealType: 'middle', contractKind: 'single', salary: actress.salary, boPercent: 1 },
    ],
    budget, marketingBudget: Math.round(budget * 0.45), weeksToRelease: 0,
    status: 'released', criticScore, boxOffice: boB, weeklyBO: [boB],
    releaseWeek, releaseYear,
    iconKey: GENRE_ICON[genre].icon, iconBg: GENRE_ICON[genre].bg,
    awards: criticScore >= 88 && Math.random() < 0.3 ? randInt(1, 3) : 0,
    plot: genPlot(),
    fatiguePenalty: 0, chemistryBonus: 0, holidayBonus: 0,
    releaseStrategy: 'theatrical', inStreamingServiceIds: [],
    reviews: generateReviews(criticScore),
  };
  return movie;
}

// REMOVED audience-color logic — chemistry is now talent-to-talent, computed per release in simulateWeek.

export interface CreateMovieArgs {
  title?: string;
  franchiseName?: string;
  type: Movie['type']; genre: Movie['genre']; plotArc: Movie['plotArc'];
  rating: Movie['rating']; runtime: number; brand: Movie['brand'];
  franchiseId?: string; parentMovieId?: string; crossoverFranchiseIds?: string[];
  writerId: string; directorId: string;
  cast: { talentId: string; role: Movie['cast'][number]['role']; dealType: DealType; contractKind?: import('./types').ContractKind; roleName?: string; roleDescription?: string }[];
  marketingBudget: number;
  releaseStrategy?: ReleaseStrategy;
  streamingWindowWeeks?: number;
  // For streaming-only releases: target service + tiers (player picks at creation)
  streamingTargetServiceId?: string;
  streamingTargetTierIds?: string[];
  // Player-chosen release date. If absent, default to filming + 0 (release as soon as production wraps).
  targetReleaseWeek?: number;
  targetReleaseYear?: number;
  // Optional external IP license to attach (uses one pack of an OwnedIPLicense).
  externalIPLicenseId?: string;
}

export function createMovie(state: GameState, args: CreateMovieArgs): { state: GameState; movie?: Movie; error?: string } {
  const { player, talents } = state;
  const writer = talents.find(t => t.id === args.writerId);
  const director = talents.find(t => t.id === args.directorId);
  if (!writer || !director) return { state, error: 'Writer or director missing' };
  if (writer.retired || director.retired) return { state, error: 'Crew member is retired' };

  // Availability check — writer/director/cast cannot be in another in-production movie or in cooldown
  const allTalentIds = [args.writerId, args.directorId, ...args.cast.map(c => c.talentId)];
  for (const tid of allTalentIds) {
    const tt = talents.find(x => x.id === tid);
    if (!tt) return { state, error: 'A selected talent is unavailable.' };
    const av = talentAvailability(tt, state.week, state.year);
    if (!av.available) {
      if (av.reason === 'Cooldown') return { state, error: `${tt.name} is in cooldown for ${av.cooldownWeeksLeft} more week(s).` };
      if (av.reason === 'In production') return { state, error: `${tt.name} is already locked in another production.` };
      return { state, error: `${tt.name} is unavailable: ${av.reason}.` };
    }
  }

  // Compute cast deal terms — apply contract multiplier to salary
  const enrichedCast = args.cast.map(c => {
    const t = talents.find(tt => tt.id === c.talentId);
    if (!t) return null;
    if (t.retired) return null;
    const terms = dealTerms(t.salary, c.dealType);
    const ck = c.contractKind || 'single';
    const cm = contractTerms(ck).multiplier;
    return { talentId: c.talentId, role: c.role, dealType: c.dealType, contractKind: ck, salary: +(terms.salary * cm).toFixed(2), boPercent: terms.boPercent, roleName: c.roleName, roleDescription: c.roleDescription };
  }).filter(Boolean) as Movie['cast'];
  if (enrichedCast.length !== args.cast.length) return { state, error: 'A cast member is no longer available (retired)' };

  const writerSalary = writer.salary;
  const directorSalary = director.salary;
  const castSalaries = enrichedCast.reduce((a, b) => a + b.salary, 0);
  const salaries = writerSalary + directorSalary + castSalaries;
  const runtimeFactor = args.runtime / 120;
  const productionCost = +(salaries * runtimeFactor + 8).toFixed(2);

  // CROSSOVER LICENSE FEE — Crossovers with rival-owned franchises require negotiated licensing.
  // Fee scales with popularity, owner rating and franchise size. This makes crossovers a strategic decision.
  let crossoverLicenseFee = 0;
  const crossoverNotes: string[] = [];
  if (args.brand === 'Crossover' && args.crossoverFranchiseIds?.length) {
    for (const fid of args.crossoverFranchiseIds) {
      const fr = state.franchises.find(f => f.id === fid);
      if (!fr) continue;
      if (fr.studioId === player.id) continue; // own franchise, free
      const owner = state.rivals.find(r => r.id === fr.studioId);
      const rating = owner?.rating || 3;
      // Base 25M × popularity factor × rating mult × franchise depth
      const popMult = 0.5 + (fr.popularity / 100) * 1.8;
      const ratingMult = 0.7 + (rating - 1) * 0.18;
      const depthMult = 1 + Math.min(0.6, (fr.movieIds.length || 1) * 0.05);
      const fee = +(25 * popMult * ratingMult * depthMult).toFixed(1);
      crossoverLicenseFee += fee;
      crossoverNotes.push(`${fr.name} ($${fee.toFixed(0)}M to ${owner?.name || '?'})`);
    }
  }
  const totalBudget = +(productionCost + args.marketingBudget + crossoverLicenseFee).toFixed(2);
  const totalBudgetB = totalBudget / 1000;
  if (player.cash < totalBudgetB) return { state, error: `Not enough cash. Need $${totalBudget.toFixed(1)}M${crossoverLicenseFee ? ` (incl. $${crossoverLicenseFee.toFixed(0)}M crossover licensing: ${crossoverNotes.join(', ')})` : ''} (have $${(player.cash * 1000).toFixed(1)}M)` };

  let franchiseId = args.franchiseId;
  let franchiseName: string | undefined;
  let sequelNum = 1;
  if (args.brand === 'Original') {
    const usedFr = new Set(state.franchises.map(f => f.name));
    const fname = (args.franchiseName?.trim()) || genFranchiseName(usedFr);
    const newFr: Franchise = {
      id: uid('f_'), name: fname, studioId: player.id, movieIds: [],
      popularity: 30, iconKey: GENRE_ICON[args.genre].icon, iconBg: GENRE_ICON[args.genre].bg,
      lastReleasedWeek: 0, lastReleasedYear: 0,
    };
    state = { ...state, franchises: [...state.franchises, newFr] };
    franchiseId = newFr.id; franchiseName = fname;
  } else {
    const fr = state.franchises.find(f => f.id === franchiseId);
    if (!fr) return { state, error: 'Franchise not found' };
    franchiseName = fr.name;
    sequelNum = (fr.movieIds.filter(mid => state.movies.find(m => m.id === mid && m.studioId === player.id)).length || 0) + 1;
  }

  // Compute filming weeks (minimum production time)
  const filmingWeeks = Math.max(2, Math.round(args.runtime / 30) + 2);
  // If player picked a target release date, weeksToRelease respects it (clamped to >= filmingWeeks).
  // If onHold (no target), weeksToRelease is sentinel-large; the player must explicitly schedule later.
  const onHold = !args.targetReleaseWeek || !args.targetReleaseYear;
  let weeksToRelease = filmingWeeks;
  if (!onHold) {
    const totalWeeks = (args.targetReleaseYear! - state.year) * WEEKS_PER_YEAR + (args.targetReleaseWeek! - state.week);
    weeksToRelease = Math.max(filmingWeeks, totalWeeks);
  } else {
    weeksToRelease = 999999; // effectively infinite — user must schedule later via setMovieReleaseDate
  }

  // External IP license attachment (uses one pack of an OwnedIPLicense; later boosts BO/popularity at release)
  let attachedIP: { id: string; ipId: string } | undefined;
  if (args.externalIPLicenseId) {
    const lic = (state.ownedIPLicenses || []).find(l => l.id === args.externalIPLicenseId && l.studioId === player.id);
    if (!lic) return { state, error: 'IP license not found.' };
    if (lic.packsUsed >= lic.packs) return { state, error: 'IP license has no remaining packs.' };
    const expTotal = lic.expiresYear * WEEKS_PER_YEAR + lic.expiresWeek;
    const nowTotal = state.year * WEEKS_PER_YEAR + state.week;
    if (expTotal < nowTotal) return { state, error: 'IP license has expired.' };
    attachedIP = { id: lic.id, ipId: lic.ipId };
  }

  const usedMovieTitles = new Set(state.movies.map(m => m.title));
  const title = (args.title?.trim()) || genTitleSubtitle(franchiseName!, args.brand, sequelNum, usedMovieTitles);
  const movie: Movie = {
    id: uid('m_'), title, type: args.type, genre: args.genre, plotArc: args.plotArc,
    rating: args.rating, runtime: args.runtime, brand: args.brand,
    franchiseId, parentMovieId: args.parentMovieId, crossoverFranchiseIds: args.crossoverFranchiseIds,
    studioId: player.id, writerId: args.writerId, directorId: args.directorId,
    cast: enrichedCast, budget: productionCost, marketingBudget: args.marketingBudget,
    weeksToRelease,
    status: 'production', criticScore: 0, boxOffice: 0, weeklyBO: [],
    releaseWeek: 0, releaseYear: 0,
    iconKey: GENRE_ICON[args.genre].icon, iconBg: GENRE_ICON[args.genre].bg,
    awards: 0, plot: genPlot(),
    fatiguePenalty: 0, chemistryBonus: 0, holidayBonus: 0,
    releaseStrategy: args.releaseStrategy || 'theatrical',
    streamingWindowWeeks: args.streamingWindowWeeks ?? (args.releaseStrategy === 'hybrid' ? 12 : undefined),
    inStreamingServiceIds: [],
    streamingTargetServiceId: args.streamingTargetServiceId,
    streamingTargetTierIds: args.streamingTargetTierIds,
    onHold,
    targetReleaseWeek: args.targetReleaseWeek,
    targetReleaseYear: args.targetReleaseYear,
    externalIPId: attachedIP?.ipId,
    ipLicenseId: attachedIP?.id,
  };

  // Lock all cast/crew to this in-production movie
  const updatedTalents = state.talents.map(t => {
    if (allTalentIds.includes(t.id)) return { ...t, inProductionMovieId: movie.id };
    return t;
  });

  const updatedPlayer = { ...player, cash: +(player.cash - totalBudgetB).toFixed(3) };
  // Credit rival studios for crossover licensing fees
  let updatedRivals = state.rivals;
  let crossoverNewsLog: typeof state.newsLog = [];
  if (crossoverLicenseFee > 0 && args.crossoverFranchiseIds?.length) {
    updatedRivals = state.rivals.slice();
    for (const fid of args.crossoverFranchiseIds) {
      const fr = state.franchises.find(f => f.id === fid);
      if (!fr || fr.studioId === player.id) continue;
      const idx = updatedRivals.findIndex(r => r.id === fr.studioId);
      if (idx < 0) continue;
      const owner = updatedRivals[idx];
      const popMult = 0.5 + (fr.popularity / 100) * 1.8;
      const ratingMult = 0.7 + (owner.rating - 1) * 0.18;
      const depthMult = 1 + Math.min(0.6, (fr.movieIds.length || 1) * 0.05);
      const fee = +(25 * popMult * ratingMult * depthMult).toFixed(1);
      const feeB = fee / 1000;
      updatedRivals[idx] = { ...owner, cash: +(owner.cash + feeB).toFixed(3) };
      crossoverNewsLog.push({ week: state.week, year: state.year, text: `${player.name} pays ${owner.name} $${fee.toFixed(0)}M to license ${fr.name} for crossover.` });
    }
  }
  const updatedFranchises = state.franchises.map(f => f.id === franchiseId ? { ...f, movieIds: [...f.movieIds, movie.id] } : f);
  // Bump packsUsed on the IP license, if attached
  let ownedIPLicenses = state.ownedIPLicenses || [];
  if (attachedIP) ownedIPLicenses = ownedIPLicenses.map(l => l.id === attachedIP!.id ? { ...l, packsUsed: l.packsUsed + 1 } : l);
  const newsLog = crossoverNewsLog.length ? [...crossoverNewsLog, ...state.newsLog].slice(0, 100) : state.newsLog;
  return { state: { ...state, player: updatedPlayer, rivals: updatedRivals, talents: updatedTalents, movies: [...state.movies, movie], franchises: updatedFranchises, ownedIPLicenses, newsLog }, movie };
}

// ---------- Player streaming service operations ----------

export interface LaunchStreamingArgs { name: string; tiers: import('./types').SubscriptionTier[]; }

export const MAX_PLAYER_STREAMING_SERVICES = 3;

export function launchPlayerStreamingService(state: GameState, args: LaunchStreamingArgs): { state: GameState; service?: StreamingService; error?: string } {
  const playerServices = (state.streamingServices || []).filter(s => s.studioId === state.player.id);
  if (playerServices.length >= MAX_PLAYER_STREAMING_SERVICES) {
    return { state, error: `You can only operate up to ${MAX_PLAYER_STREAMING_SERVICES} streaming services.` };
  }
  const cost = 0.2; // $200M (in $B)
  if (state.player.cash < cost) return { state, error: `Need $${(cost * 1000).toFixed(0)}M to launch (have $${(state.player.cash * 1000).toFixed(0)}M).` };
  if (!args.name.trim()) return { state, error: 'Service needs a name.' };
  if (!args.tiers.length) return { state, error: 'At least one subscription tier is required.' };

  const service: StreamingService = {
    id: uid('ss_'),
    studioId: state.player.id,
    name: args.name.trim(),
    tiers: args.tiers.map(t => ({ ...t })),
    subscribers: 0,
    tierSubscribers: Object.fromEntries(args.tiers.map(t => [t.id, 0])),
    monthlyRevenue: 0,
    reputation: 30,
    catalogMovieIds: state.movies.filter(m => m.studioId === state.player.id && m.status === 'released').map(m => m.id),
    launchedYear: state.year,
    launchedWeek: state.week,
    history: [],
  };
  // Mark already-released player titles as carried by the new service
  const updatedMovies = state.movies.map(m => {
    if (m.studioId !== state.player.id || m.status !== 'released') return m;
    return { ...m, inStreamingServiceIds: [...(m.inStreamingServiceIds || []), service.id] };
  });
  const updatedPlayer = { ...state.player, cash: +(state.player.cash - cost).toFixed(3) };
  const newsLog = [{ week: state.week, year: state.year, text: `${service.name} launches — ${state.player.name} enters the streaming wars.` }, ...state.newsLog].slice(0, 100);
  return {
    state: { ...state, player: updatedPlayer, movies: updatedMovies, streamingServices: [...(state.streamingServices || []), service], newsLog },
    service,
  };
}

export function updatePlayerStreamingService(state: GameState, serviceId: string, patch: Partial<Pick<StreamingService, 'name' | 'tiers' | 'isExclusive' | 'exclusiveMovieIds'>>): { state: GameState; error?: string } {
  const idx = (state.streamingServices || []).findIndex(s => s.id === serviceId && s.studioId === state.player.id);
  if (idx < 0) return { state, error: 'Service not found.' };
  const services = state.streamingServices.slice();
  const cur = services[idx];
  const next: StreamingService = { ...cur };
  if (patch.name !== undefined) next.name = patch.name.trim() || cur.name;
  if (patch.isExclusive !== undefined) next.isExclusive = !!patch.isExclusive;
  if (patch.exclusiveMovieIds !== undefined) next.exclusiveMovieIds = [...patch.exclusiveMovieIds];
  if (patch.tiers !== undefined) {
    next.tiers = patch.tiers.map(t => ({ ...t }));
    // Reset tier subscribers for any new tiers
    const newTierSubs: Record<string, number> = {};
    next.tiers.forEach(t => { newTierSubs[t.id] = cur.tierSubscribers?.[t.id] ?? 0; });
    next.tierSubscribers = newTierSubs;
  }
  services[idx] = next;
  return { state: { ...state, streamingServices: services } };
}

export function deletePlayerStreamingService(state: GameState, serviceId: string): { state: GameState; error?: string } {
  const svc = (state.streamingServices || []).find(s => s.id === serviceId && s.studioId === state.player.id);
  if (!svc) return { state, error: 'Service not found.' };
  // Remove the service-id from any movies that referenced it
  const movies = state.movies.map(m => {
    if (!m.inStreamingServiceIds?.includes(serviceId)) return m;
    return { ...m, inStreamingServiceIds: m.inStreamingServiceIds.filter(id => id !== serviceId) };
  });
  const services = state.streamingServices.filter(s => s.id !== serviceId);
  const newsLog = [{ week: state.week, year: state.year, text: `${svc.name} shuts down. ${state.player.name} retires the service.` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, streamingServices: services, movies, newsLog } };
}

// Set marketing allocation for a movie. Total allocation cannot exceed movie.marketingBudget.
export function setMarketingAllocation(state: GameState, movieId: string, allocation: Record<string, number>): { state: GameState; error?: string } {
  const movie = state.movies.find(m => m.id === movieId);
  if (!movie) return { state, error: 'Movie not found.' };
  if (movie.studioId !== state.player.id) return { state, error: 'Not your movie.' };
  if (movie.status === 'released') return { state, error: 'Movie already released.' };
  const total = Object.values(allocation).reduce((a, b) => a + (b || 0), 0);
  if (total > movie.marketingBudget + 0.01) return { state, error: `Allocation $${total.toFixed(1)}M exceeds budget $${movie.marketingBudget}M.` };
  const movies = state.movies.map(m => m.id === movieId ? { ...m, marketingAllocation: { ...allocation } } : m);
  return { state: { ...state, movies } };
}

// Renew an existing license — must be done before expiry. Renewal fee discounted 25% if renewed before half-life.
export function renewLicense(state: GameState, serviceId: string, movieId: string, additionalYears: 1 | 3 | 5 | 10): { state: GameState; error?: string; fee?: number } {
  const svcIdx = (state.streamingServices || []).findIndex(s => s.id === serviceId && s.studioId === state.player.id);
  if (svcIdx < 0) return { state, error: 'Service not found.' };
  const svc = state.streamingServices[svcIdx];
  const license = (svc.licensedMovies || []).find(l => l.movieId === movieId);
  if (!license) return { state, error: 'No active license to renew.' };
  const movie = state.movies.find(m => m.id === movieId);
  if (!movie) return { state, error: 'Movie not found.' };

  // Discount if renewed early (more than 50% of original term remaining)
  const wksLeft = (license.expiresYear - state.year) * WEEKS_PER_YEAR + (license.expiresWeek - state.week);
  const totalWks = license.yearsLicensed * WEEKS_PER_YEAR;
  const isEarly = wksLeft > totalWks / 2;
  const owner = state.rivals.find(r => r.id === movie.studioId);
  const fr = movie.franchiseId ? state.franchises.find(f => f.id === movie.franchiseId) : undefined;
  const baseFee = computeLicenseFee(movie, additionalYears, state.week, state.year, {
    exclusivity: !!license.exclusivity,
    ownerRating: owner?.rating,
    franchisePopularity: fr?.popularity,
  });
  const fee = +(baseFee * (isEarly ? 0.75 : 1.0)).toFixed(2);
  const feeB = fee / 1000;
  if (state.player.cash < feeB) return { state, error: `Need $${fee.toFixed(1)}M renewal fee.`, fee };

  // Extend expiration from CURRENT expiry forward (not from now)
  let expW = license.expiresWeek + additionalYears * WEEKS_PER_YEAR;
  let expY = license.expiresYear;
  while (expW > WEEKS_PER_YEAR) { expW -= WEEKS_PER_YEAR; expY += 1; }

  const services = state.streamingServices.slice();
  services[svcIdx] = {
    ...svc,
    licensedMovies: (svc.licensedMovies || []).map(l => l.movieId === movieId
      ? { ...l, expiresWeek: expW, expiresYear: expY, yearsLicensed: l.yearsLicensed + additionalYears, feePaid: l.feePaid + fee }
      : l),
  };
  const updatedPlayer = { ...state.player, cash: +(state.player.cash - feeB).toFixed(3) };
  const newsLog = [{ week: state.week, year: state.year, text: `${state.player.name} renews ${movie.title} on ${svc.name} for ${additionalYears}y${isEarly ? ' (early-renewal -25%)' : ''} ($${fee.toFixed(1)}M).` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, player: updatedPlayer, streamingServices: services, newsLog }, fee };
}

// License fee calculation for licensing other studios' movies into your streaming service.
// Standardized formula used across ALL licensing surfaces (movie page, franchise page,
// streaming detail, rivals catalog packs, IP, etc.) for fee consistency.
// Factors: BO base × critic mult × age decay × duration × studio reputation × exclusivity × franchise popularity.
export function computeLicenseFee(movie: Movie, yearsLicensed: number, currentWeek: number, currentYear: number, opts?: { exclusivity?: boolean; ownerRating?: number; franchisePopularity?: number }): number {
  const ageWeeks = (currentYear - movie.releaseYear) * WEEKS_PER_YEAR + (currentWeek - movie.releaseWeek);
  const ageYears = Math.max(0, ageWeeks / WEEKS_PER_YEAR);
  // Base fee scales with movie BO + critic score
  const baseBO = Math.max(5, movie.boxOffice * 1000); // in $M
  const criticMult = movie.criticScore / 70;
  // Older movies are cheaper
  const ageDecay = Math.max(0.25, 1 - ageYears * 0.12);
  const yearMult = yearsLicensed; // linear scaling per year
  // Reputation multiplier — bigger studios charge more.
  const repMult = opts?.ownerRating ? 0.85 + (opts.ownerRating - 1) * 0.15 : 1.0; // rating 1→0.85, 5→1.45
  // Exclusivity premium.
  const exclMult = opts?.exclusivity ? 1.6 : 1.0;
  // Franchise popularity bonus (when licensing inside a famous franchise).
  const popMult = opts?.franchisePopularity ? 0.85 + (opts.franchisePopularity / 100) * 0.5 : 1.0;
  // ~3% of BO per year * critic mult * age decay * rep mult * excl mult * franchise pop mult
  const fee = baseBO * 0.03 * yearMult * criticMult * ageDecay * repMult * exclMult * popMult;
  return Math.max(2, +fee.toFixed(2));
}

export interface LicenseMovieArgs {
  movieId: string;
  yearsLicensed: number; // 1, 3, 5, 10
  tierIds: string[];     // tiers where the licensed title is available; empty = all tiers
  exclusivity?: boolean; // negotiated exclusivity flag — multiplies fee 1.6×
}

export function licenseMovieToStreaming(state: GameState, serviceId: string, args: LicenseMovieArgs): { state: GameState; error?: string; fee?: number } {
  const svcIdx = (state.streamingServices || []).findIndex(s => s.id === serviceId && s.studioId === state.player.id);
  if (svcIdx < 0) return { state, error: 'Service not found.' };
  const movie = state.movies.find(m => m.id === args.movieId);
  if (!movie) return { state, error: 'Movie not found.' };
  if (movie.studioId === state.player.id) return { state, error: 'You can add your own titles for free.' };
  if (movie.status !== 'released') return { state, error: 'Cannot license unreleased titles.' };
  if (![1, 3, 5, 10].includes(args.yearsLicensed)) return { state, error: 'License duration must be 1, 3, 5, or 10 years.' };

  const services = state.streamingServices.slice();
  const cur = { ...services[svcIdx] };
  const existingLicense = (cur.licensedMovies || []).find(l => l.movieId === args.movieId);
  if (existingLicense) return { state, error: 'Already licensed on this service.' };

  const owner = state.rivals.find(r => r.id === movie.studioId);
  const fr = movie.franchiseId ? state.franchises.find(f => f.id === movie.franchiseId) : undefined;
  const fee = computeLicenseFee(movie, args.yearsLicensed, state.week, state.year, {
    exclusivity: !!args.exclusivity,
    ownerRating: owner?.rating,
    franchisePopularity: fr?.popularity,
  });
  const feeB = fee / 1000;
  if (state.player.cash < feeB) return { state, error: `Need $${fee.toFixed(1)}M license fee (have $${(state.player.cash * 1000).toFixed(1)}M).`, fee };

  // Compute expiration
  let expW = state.week + args.yearsLicensed * WEEKS_PER_YEAR;
  let expY = state.year;
  while (expW > WEEKS_PER_YEAR) { expW -= WEEKS_PER_YEAR; expY += 1; }

  cur.licensedMovies = [...(cur.licensedMovies || []), {
    movieId: args.movieId,
    expiresWeek: expW, expiresYear: expY,
    tierIds: [...args.tierIds],
    feePaid: fee, yearsLicensed: args.yearsLicensed,
    exclusivity: !!args.exclusivity,
  }];
  cur.catalogMovieIds = cur.catalogMovieIds.includes(args.movieId) ? cur.catalogMovieIds : [...cur.catalogMovieIds, args.movieId];
  // Map per-tier access if specified
  if (args.tierIds.length) {
    cur.movieTierAccess = { ...(cur.movieTierAccess || {}), [args.movieId]: [...args.tierIds] };
  }
  services[svcIdx] = cur;
  const updatedPlayer = { ...state.player, cash: +(state.player.cash - feeB).toFixed(3) };
  // Note: we don't add this licensed movie to movie.inStreamingServiceIds because that field is for owner-controlled tracking.
  const newsLog = [{ week: state.week, year: state.year, text: `${state.player.name} licenses ${movie.title} for ${args.yearsLicensed}y on ${cur.name} ($${fee.toFixed(1)}M).` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, player: updatedPlayer, streamingServices: services, newsLog }, fee };
}

// Set or update a held movie's release date. The movie must belong to the player and be in production.
export function setMovieReleaseDate(state: GameState, movieId: string, week: number, year: number): { state: GameState; error?: string } {
  const movie = state.movies.find(m => m.id === movieId);
  if (!movie) return { state, error: 'Movie not found.' };
  if (movie.studioId !== state.player.id) return { state, error: 'Cannot reschedule another studio\'s movie.' };
  if (movie.status === 'released') return { state, error: 'Movie already released.' };
  const filmingWeeks = Math.max(2, Math.round(movie.runtime / 30) + 2);
  const totalWeeks = (year - state.year) * WEEKS_PER_YEAR + (week - state.week);
  if (totalWeeks < filmingWeeks) return { state, error: `Need at least ${filmingWeeks} weeks for filming.` };
  const movies = state.movies.map(m => m.id === movieId
    ? { ...m, targetReleaseWeek: week, targetReleaseYear: year, weeksToRelease: totalWeeks, onHold: false }
    : m);
  return { state: { ...state, movies } };
}

// Pull a movie back to "hold" — it stays in production indefinitely until rescheduled.
export function holdMovie(state: GameState, movieId: string): { state: GameState; error?: string } {
  const movie = state.movies.find(m => m.id === movieId);
  if (!movie) return { state, error: 'Movie not found.' };
  if (movie.studioId !== state.player.id) return { state, error: 'Cannot hold another studio\'s movie.' };
  if (movie.status === 'released') return { state, error: 'Movie already released.' };
  const movies = state.movies.map(m => m.id === movieId
    ? { ...m, targetReleaseWeek: undefined, targetReleaseYear: undefined, weeksToRelease: 999999, onHold: true }
    : m);
  return { state: { ...state, movies } };
}

export function addMovieToStreaming(state: GameState, serviceId: string, movieId: string, tierIds?: string[]): { state: GameState; error?: string } {
  const svcIdx = (state.streamingServices || []).findIndex(s => s.id === serviceId && s.studioId === state.player.id);
  if (svcIdx < 0) return { state, error: 'Service not found.' };
  const movie = state.movies.find(m => m.id === movieId);
  if (!movie) return { state, error: 'Movie not found.' };
  if (movie.studioId !== state.player.id) return { state, error: 'You can only add your own studio\'s titles for free. Licensing is coming soon.' };
  const services = state.streamingServices.slice();
  const cur = { ...services[svcIdx], catalogMovieIds: [...services[svcIdx].catalogMovieIds] };
  if (cur.catalogMovieIds.includes(movieId)) return { state, error: 'Title already on this service.' };
  cur.catalogMovieIds.push(movieId);
  // Per-movie tier access: if specified (and non-empty subset), record. Empty/undefined = visible to all tiers.
  if (tierIds && tierIds.length && tierIds.length < cur.tiers.length) {
    cur.movieTierAccess = { ...(cur.movieTierAccess || {}), [movieId]: [...tierIds] };
  }
  services[svcIdx] = cur;
  const updatedMovies = state.movies.map(m => m.id === movieId ? { ...m, inStreamingServiceIds: [...(m.inStreamingServiceIds || []), serviceId] } : m);
  return { state: { ...state, streamingServices: services, movies: updatedMovies } };
}

// Update which tiers can stream a movie already in the catalog. Empty array = remove restriction (all tiers).
export function setMovieTierAccess(state: GameState, serviceId: string, movieId: string, tierIds: string[]): { state: GameState; error?: string } {
  const svcIdx = (state.streamingServices || []).findIndex(s => s.id === serviceId && s.studioId === state.player.id);
  if (svcIdx < 0) return { state, error: 'Service not found.' };
  const cur = state.streamingServices[svcIdx];
  if (!cur.catalogMovieIds.includes(movieId)) return { state, error: 'Title not in this catalog.' };
  const services = state.streamingServices.slice();
  const next = { ...cur, movieTierAccess: { ...(cur.movieTierAccess || {}) } };
  if (!tierIds.length || tierIds.length >= cur.tiers.length) {
    delete next.movieTierAccess[movieId];
  } else {
    next.movieTierAccess[movieId] = [...tierIds];
  }
  services[svcIdx] = next;
  return { state: { ...state, streamingServices: services } };
}

export function removeMovieFromStreaming(state: GameState, serviceId: string, movieId: string): { state: GameState } {
  const services = (state.streamingServices || []).map(s => s.id === serviceId
    ? { ...s, catalogMovieIds: s.catalogMovieIds.filter(id => id !== movieId) }
    : s);
  const movies = state.movies.map(m => m.id === movieId
    ? { ...m, inStreamingServiceIds: (m.inStreamingServiceIds || []).filter(sid => sid !== serviceId) }
    : m);
  return { state: { ...state, streamingServices: services, movies } };
}

// ---------- Talent Hire/Fire Operations ----------

// Calculate what a talent expects for a contract based on fame, skill, movies
export function calculateTalentExpectations(talent: Talent, numMovies: number): { 
  minUpfront: number; 
  maxUpfront: number; 
  minBoPercent: number; 
  maxBoPercent: number;
  expectedTotal: number; // Total value they expect for the contract
} {
  // Base salary expectation per movie
  const baseSalary = talent.salary;
  
  // Fame affects expectations (high fame = wants more)
  const fameFactor = 0.7 + (talent.fame / 100) * 0.8; // 0.7 to 1.5
  
  // Skill affects minimum they'll accept
  const skillFactor = 0.8 + (talent.skill / 100) * 0.4; // 0.8 to 1.2
  
  // Multi-movie discount: 1 movie = 100%, 2 movies = 90%, 3 movies = 80%
  const bulkDiscount = numMovies === 1 ? 1.0 : numMovies === 2 ? 0.9 : 0.8;
  
  // Expected per-movie value
  const perMovieValue = baseSalary * fameFactor * skillFactor * bulkDiscount;
  const expectedTotal = perMovieValue * numMovies;
  
  // Upfront range: 40-80% of expected total
  const minUpfront = +(expectedTotal * 0.4).toFixed(2);
  const maxUpfront = +(expectedTotal * 0.8).toFixed(2);
  
  // BO percentage range based on fame (famous actors want BO points)
  const baseBoMin = talent.fame >= 70 ? 3 : talent.fame >= 40 ? 1 : 0;
  const baseBoMax = talent.fame >= 70 ? 12 : talent.fame >= 40 ? 8 : 5;
  
  return {
    minUpfront,
    maxUpfront,
    minBoPercent: baseBoMin,
    maxBoPercent: baseBoMax,
    expectedTotal,
  };
}

// Calculate acceptance probability based on offer vs expectations
export function calculateAcceptance(talent: Talent, numMovies: number, upfront: number, boPercent: number): {
  probability: number;
  verdict: 'will_accept' | 'likely_accept' | 'considering' | 'unlikely' | 'will_reject';
  reason: string;
} {
  const exp = calculateTalentExpectations(talent, numMovies);
  
  // Estimate BO value: assume average movie makes $150M, talent gets boPercent of that
  const estimatedBoValue = 150 * (boPercent / 100) * numMovies;
  const totalOfferValue = upfront + estimatedBoValue;
  
  // How does offer compare to expected?
  const ratio = totalOfferValue / exp.expectedTotal;
  
  let probability: number;
  let verdict: 'will_accept' | 'likely_accept' | 'considering' | 'unlikely' | 'will_reject';
  let reason: string;
  
  if (ratio >= 1.2) {
    probability = 0.98;
    verdict = 'will_accept';
    reason = 'Excellent offer, above expectations';
  } else if (ratio >= 1.0) {
    probability = 0.85;
    verdict = 'likely_accept';
    reason = 'Fair offer, meets expectations';
  } else if (ratio >= 0.8) {
    probability = 0.55;
    verdict = 'considering';
    reason = 'Below expectations, might negotiate';
  } else if (ratio >= 0.6) {
    probability = 0.25;
    verdict = 'unlikely';
    reason = 'Low offer, unlikely to accept';
  } else {
    probability = 0.05;
    verdict = 'will_reject';
    reason = 'Insulting offer, will reject';
  }
  
  // Fame makes them pickier
  if (talent.fame >= 80) probability *= 0.9;
  
  return { probability: Math.min(0.99, Math.max(0.01, probability)), verdict, reason };
}

export interface HireTalentArgs {
  talentId: string;
  numMovies: number;      // 1, 2, or 3 movies
  upfrontPayment: number; // in $M
  boPercent: number;      // 0-15%
}

export function hireTalent(state: GameState, args: HireTalentArgs): { state: GameState; error?: string; accepted?: boolean } {
  const talent = state.talents.find(t => t.id === args.talentId);
  if (!talent) return { state, error: 'Talent not found.' };
  if (talent.retired) return { state, error: 'This talent has retired.' };
  if (talent.underContract?.studioId) {
    const studio = talent.underContract.studioId === state.player.id 
      ? state.player 
      : state.rivals.find(r => r.id === talent.underContract?.studioId);
    return { state, error: `Already under contract with ${studio?.name || 'another studio'}.` };
  }
  
  // Validate inputs
  if (args.numMovies < 1 || args.numMovies > 3) return { state, error: 'Contract must be for 1-3 movies.' };
  if (args.upfrontPayment < 0) return { state, error: 'Upfront payment cannot be negative.' };
  if (args.boPercent < 0 || args.boPercent > 15) return { state, error: 'BO percentage must be 0-15%.' };
  
  const costB = args.upfrontPayment / 1000; // Convert to billions
  if (state.player.cash < costB) {
    return { state, error: `Not enough cash. Need $${args.upfrontPayment.toFixed(1)}M (have $${(state.player.cash * 1000).toFixed(1)}M).` };
  }
  
  // Check if talent accepts
  const acceptance = calculateAcceptance(talent, args.numMovies, args.upfrontPayment, args.boPercent);
  const roll = Math.random();
  
  if (roll > acceptance.probability) {
    // Rejected!
    const newsLog = [
      { week: state.week, year: state.year, text: `${talent.name} rejected ${state.player.name}'s contract offer. "${acceptance.reason}"` },
      ...state.newsLog
    ].slice(0, 100);
    return { state: { ...state, newsLog }, error: `${talent.name} rejected your offer. ${acceptance.reason}.`, accepted: false };
  }
  
  // Accepted! Create contract
  const contract: import('./types').TalentContract = {
    studioId: state.player.id,
    remainingMovies: args.numMovies,
    upfrontPaid: args.upfrontPayment,
    boPercent: args.boPercent,
    perMovieSalary: +(args.upfrontPayment / args.numMovies).toFixed(2),
    signedWeek: state.week,
    signedYear: state.year,
  };
  
  const updatedTalents = state.talents.map(t => 
    t.id === args.talentId ? { ...t, underContract: contract } : t
  );
  const updatedPlayer = { ...state.player, cash: +(state.player.cash - costB).toFixed(3) };
  const newsLog = [
    { week: state.week, year: state.year, text: `${state.player.name} signs ${talent.name} to a ${args.numMovies}-movie deal ($${args.upfrontPayment.toFixed(1)}M + ${args.boPercent}% BO).` },
    ...state.newsLog
  ].slice(0, 100);
  
  return { state: { ...state, talents: updatedTalents, player: updatedPlayer, newsLog }, accepted: true };
}

export function fireTalent(state: GameState, talentId: string): { state: GameState; error?: string } {
  const talent = state.talents.find(t => t.id === talentId);
  if (!talent) return { state, error: 'Talent not found.' };
  if (!talent.underContract || talent.underContract.studioId !== state.player.id) {
    return { state, error: 'This talent is not under contract with your studio.' };
  }
  
  const updatedTalents = state.talents.map(t => 
    t.id === talentId ? { ...t, underContract: undefined } : t
  );
  const newsLog = [
    { week: state.week, year: state.year, text: `${state.player.name} releases ${talent.name} from their contract (${talent.underContract.remainingMovies} movies remaining).` },
    ...state.newsLog
  ].slice(0, 100);
  
  return { state: { ...state, talents: updatedTalents, newsLog } };
}

function ageAndRetireTalents(talents: Talent[], weeks: number): { talents: Talent[]; retired: Talent[]; replacements: Talent[] } {
  const retired: Talent[] = []; const replacements: Talent[] = [];
  const updated = talents.map(t => {
    if (t.retired) return t;
    // Age advances by weeks/48 years
    const newAge = +(t.age + weeks / WEEKS_PER_YEAR).toFixed(2);
    let willRetire = false;
    if (newAge >= 70) {
      // chance of retirement increases each year past 70
      const chance = Math.min(0.9, (newAge - 69) * 0.18) * (weeks / WEEKS_PER_YEAR);
      if (Math.random() < chance || newAge >= 80) willRetire = true;
    }
    if (willRetire) {
      const replacement = genTalent(t.role, { ageMin: 24, ageMax: 32 });
      retired.push({ ...t, age: newAge, retired: true });
      replacements.push(replacement);
      return { ...t, age: newAge, retired: true };
    }
    return { ...t, age: newAge };
  });
  return { talents: [...updated, ...replacements], retired, replacements };
}

function aiProduceMovies(state: GameState, currentWeek: number, currentYear: number, currentTalents: Talent[]): { state: GameState; news: { week: number; year: number; text: string }[]; talents: Talent[] } {
  const news: { week: number; year: number; text: string }[] = [];
  let movies = [...state.movies];
  let franchises = [...state.franchises];
  let rivals = [...state.rivals];
  let talents = currentTalents.slice();

  rivals.forEach((r, ri) => {
    // Each rival has ~20% chance per week of starting a movie if they have <=4 in production
    const inProd = movies.filter(m => m.studioId === r.id && m.status === 'production').length;
    if (inProd >= 4) return;
    if (Math.random() > 0.16) return;
    const ownFranchises = franchises.filter(f => f.studioId === r.id);
    let franchiseId: string | undefined;
    let brand: Movie['brand'] = 'Original';
    if (ownFranchises.length && Math.random() < 0.6) {
      const fr = pick(ownFranchises);
      franchiseId = fr.id;
      brand = pick(['Sequel', 'Sequel', 'Prequel', 'Spinoff'] as Movie['brand'][]);
    }
    const genre = pick(GENRES);
    const runtime = randInt(95, 165);
    // Pick available talents — respect cooldown + in-production lock
    const availablePool = state.talents.filter(t => {
      if (t.retired) return false;
      if (t.inProductionMovieId) return false;
      const fy = t.availableFromYear ?? 0; const fw = t.availableFromWeek ?? 0;
      if (fy > currentYear || (fy === currentYear && fw > currentWeek)) return false;
      return true;
    });
    const writer = availablePool.filter(t => t.role === 'writer')[Math.floor(Math.random() * availablePool.filter(t => t.role === 'writer').length)];
    const director = availablePool.filter(t => t.role === 'director')[Math.floor(Math.random() * availablePool.filter(t => t.role === 'director').length)];
    if (!writer || !director) return;
    const castRoles: Movie['cast'][number]['role'][] = ['lead_actor', 'lead_actress', 'support_actor', 'support_actress'];
    const cast = castRoles.map(slotRole => {
      // Movie cast slots use lead_/support_ designations; talents now have just 'actor'/'actress'
      const targetTalentRole: Talent['role'] = (slotRole === 'lead_actor' || slotRole === 'support_actor') ? 'actor' : 'actress';
      const opts = availablePool.filter(t => t.role === targetTalentRole);
      if (!opts.length) return null;
      const t = opts[Math.floor(Math.random() * opts.length)];
      const terms = dealTerms(t.salary, pick(['middle', 'studio_favored', 'middle']));
      return { talentId: t.id, role: slotRole, dealType: 'middle' as DealType, contractKind: 'single' as const, salary: terms.salary, boPercent: terms.boPercent };
    }).filter(Boolean) as Movie['cast'];
    if (cast.length < 2) return;

    let franchiseName = '';
    if (franchiseId) {
      const fr = franchises.find(f => f.id === franchiseId)!;
      franchiseName = fr.name;
    } else {
      // create new franchise — uniquify against world franchise + movie names
      const usedFr = new Set([...franchises.map(f => f.name), ...movies.map(m => m.title)]);
      const fname = genFranchiseName(usedFr);
      const newFr: Franchise = {
        id: uid('f_'), name: fname, studioId: r.id, movieIds: [],
        popularity: randInt(20, 50), iconKey: GENRE_ICON[genre].icon, iconBg: GENRE_ICON[genre].bg,
        lastReleasedWeek: 0, lastReleasedYear: 0,
      };
      franchises.push(newFr);
      franchiseId = newFr.id; franchiseName = fname;
    }
    const sequelNum = (franchises.find(f => f.id === franchiseId)?.movieIds.length || 0) + 1;
    const usedMovieTitles = new Set(movies.map(m => m.title));
    const title = genTitleSubtitle(franchiseName, brand, sequelNum, usedMovieTitles);
    // TIER-BASED BUDGET: high-rating rivals fund $200M+ tentpoles (so Big Picture awards trigger).
    const aiBudget = aiBudgetForRating(r.rating);
    const movie: Movie = {
      id: uid('m_'), title, type: genre as any, genre,
      plotArc: pick(['Man in a Hole', 'Icarus', 'Cinderella'] as any),
      rating: pick(['PG-13', 'PG', 'R'] as any), runtime, brand,
      franchiseId, studioId: r.id, writerId: writer.id, directorId: director.id,
      cast, budget: aiBudget.production, marketingBudget: aiBudget.marketing,
      weeksToRelease: Math.max(2, Math.round(runtime / 30) + 2),
      status: 'production', criticScore: 0, boxOffice: 0, weeklyBO: [],
      releaseWeek: 0, releaseYear: 0,
      iconKey: GENRE_ICON[genre].icon, iconBg: GENRE_ICON[genre].bg,
      awards: 0, plot: genPlot(),
      fatiguePenalty: 0, chemistryBonus: 0, holidayBonus: 0,
    };
    if (aiBudget.production >= 200) {
      news.push({ week: currentWeek, year: currentYear, text: `${r.name} announces massive $${aiBudget.production}M tentpole: ${title}.` });
    }
    // Lock all AI cast/crew to this in-production movie
    const lockIds = new Set([writer.id, director.id, ...cast.map(c => c.talentId)]);
    talents = talents.map(t => lockIds.has(t.id) ? { ...t, inProductionMovieId: movie.id } : t);
    movies.push(movie);
    franchises = franchises.map(f => f.id === franchiseId ? { ...f, movieIds: [...f.movieIds, movie.id] } : f);
  });

  return { state: { ...state, movies, franchises, rivals }, news, talents };
}

// ---------- AI-to-AI / AI-to-PLAYER STREAMING LICENSING ----------
// Each week: AI streaming services bid on licensable movies (8+ weeks post-release, not on this service yet).
// Winners auto-license rival-owned movies (deduct cash + add to AI service catalog + relationship+).
// If the target is a player movie -> create a pendingOffer for the player to accept/counter/reject.
function aiLicenseMovies(
  state: GameState,
  currentWeek: number,
  currentYear: number,
  currentMovies: Movie[],
  currentServices: StreamingService[],
  currentRivals: Studio[],
  currentRelationships: Record<string, number>,
  currentPendingOffers: LicenseOffer[],
): {
  movies: Movie[];
  services: StreamingService[];
  rivals: Studio[];
  relationships: Record<string, number>;
  pendingOffers: LicenseOffer[];
  news: { week: number; year: number; text: string }[];
} {
  const news: { week: number; year: number; text: string }[] = [];
  let services = currentServices.map(s => ({ ...s, catalogMovieIds: [...s.catalogMovieIds], licensedMovies: s.licensedMovies ? s.licensedMovies.map(l => ({ ...l })) : [] }));
  let rivals = currentRivals.map(r => ({ ...r }));
  const relationships = { ...currentRelationships };
  const pendingOffers = [...currentPendingOffers];
  const movies = currentMovies; // not mutated here

  // Eligible candidates: released ≥8 weeks ago and have BO/critic threshold worth licensing
  const MIN_WEEKS_POST = 8;
  const candidates = movies.filter(m => {
    if (m.status !== 'released') return false;
    const weeksPost = (currentYear - m.releaseYear) * WEEKS_PER_YEAR + (currentWeek - m.releaseWeek);
    if (weeksPost < MIN_WEEKS_POST) return false;
    if (m.criticScore < 50 && m.boxOffice < 0.10) return false;
    return true;
  });
  if (!candidates.length) return { movies, services, rivals, relationships, pendingOffers, news };

  // Iterate AI streamers (rivals only) — each one bids once per week if budget allows
  const aiServices = services.filter(s => s.studioId !== state.player.id);
  if (!aiServices.length) return { movies, services, rivals, relationships, pendingOffers, news };

  for (const svc of aiServices) {
    const owner = rivals.find(r => r.id === svc.studioId);
    if (!owner) continue;

    // Per-week licensing budget cap based on owner rating ($5M-$80M/wk).
    const weeklyBudgetM = (owner.rating || 1) * 12 + 8; // ★1=20, ★5=68
    if (owner.cash * 1000 < weeklyBudgetM * 0.5) continue; // skip if rival can't even afford half

    // Score candidates this svc doesn't already have AND doesn't own
    const scored = candidates
      .filter(m => !svc.catalogMovieIds.includes(m.id))
      .filter(m => !(svc.licensedMovies || []).find(l => l.movieId === m.id))
      .filter(m => m.studioId !== svc.studioId)
      .map(m => ({
        movie: m,
        desire: licenseDesirability(m, { rating: owner.rating, reputation: svc.reputation, catalogQuality: 60 }),
      }))
      .sort((a, b) => b.desire - a.desire);
    if (!scored.length || scored[0].desire < 0.30) continue;

    const target = scored[0].movie;
    const years = pick([1, 3, 3, 5] as const);
    // Use existing computeLicenseFee for consistency with player-side licensing fees
    const fee = computeLicenseFee(target, years, currentWeek, currentYear);
    if (fee > weeklyBudgetM) continue;

    if (target.studioId === state.player.id) {
      // PENDING OFFER for player. Skip if same movie+service offer already pending.
      if (pendingOffers.find(o => o.movieId === target.id && o.serviceId === svc.id)) continue;
      const expW = currentWeek + 4;
      let expWk = expW; let expYr = currentYear;
      while (expWk > WEEKS_PER_YEAR) { expWk -= WEEKS_PER_YEAR; expYr += 1; }
      pendingOffers.push({
        id: uid('lo_'), movieId: target.id, serviceId: svc.id,
        feeM: fee, years,
        reasoning: licenseOfferDialog(svc.name, target.title, years, fee, target.genre),
        createdWeek: currentWeek, createdYear: currentYear,
        expiresWeek: expWk, expiresYear: expYr, round: 1,
      });
      news.push({ week: currentWeek, year: currentYear, text: `📺 ${svc.name} wants to license ${target.title} ($${fee.toFixed(1)}M / ${years}yr).` });
    } else {
      // AI → AI: auto-license. Deduct fee from rival cash, add to svc catalog, license owner gets cash, +relationship.
      const ownerIdx = rivals.findIndex(r => r.id === svc.studioId);
      const lessorIdx = rivals.findIndex(r => r.id === target.studioId);
      const feeB = fee / 1000;
      if (ownerIdx >= 0) rivals[ownerIdx] = { ...rivals[ownerIdx], cash: +(rivals[ownerIdx].cash - feeB).toFixed(3) };
      if (lessorIdx >= 0) rivals[lessorIdx] = { ...rivals[lessorIdx], cash: +(rivals[lessorIdx].cash + feeB).toFixed(3) };
      let endW = currentWeek + years * WEEKS_PER_YEAR;
      let endY = currentYear;
      while (endW > WEEKS_PER_YEAR) { endW -= WEEKS_PER_YEAR; endY += 1; }
      const svcIdx = services.findIndex(s => s.id === svc.id);
      if (svcIdx >= 0) {
        const cur = services[svcIdx];
        services[svcIdx] = {
          ...cur,
          catalogMovieIds: [...cur.catalogMovieIds, target.id],
          licensedMovies: [...(cur.licensedMovies || []), { movieId: target.id, expiresWeek: endW, expiresYear: endY, tierIds: [], feePaid: fee, yearsLicensed: years }],
        };
      }
      nudgeRelInPlace(relationships, svc.studioId, target.studioId, 4);
      const lessorName = rivals[lessorIdx]?.name || 'A studio';
      news.push({ week: currentWeek, year: currentYear, text: `${svc.name} licenses ${target.title} from ${lessorName} ($${fee.toFixed(1)}M / ${years}yr).` });
    }
  }

  return { movies, services, rivals, relationships, pendingOffers, news };
}

// Player accepts an AI offer to license one of their movies
export function acceptLicenseOffer(state: GameState, offerId: string): { state: GameState; error?: string } {
  const offer = (state.pendingOffers || []).find(o => o.id === offerId);
  if (!offer) return { state, error: 'Offer not found.' };
  const movie = state.movies.find(m => m.id === offer.movieId);
  if (!movie) return { state, error: 'Movie not found.' };
  const svcIdx = (state.streamingServices || []).findIndex(s => s.id === offer.serviceId);
  if (svcIdx < 0) return { state, error: 'Streaming service no longer exists.' };
  const svc = state.streamingServices[svcIdx];

  let endW = state.week + offer.years * WEEKS_PER_YEAR;
  let endY = state.year;
  while (endW > WEEKS_PER_YEAR) { endW -= WEEKS_PER_YEAR; endY += 1; }

  const services = state.streamingServices.slice();
  services[svcIdx] = {
    ...svc,
    catalogMovieIds: svc.catalogMovieIds.includes(movie.id) ? svc.catalogMovieIds : [...svc.catalogMovieIds, movie.id],
    licensedMovies: [...(svc.licensedMovies || []), { movieId: movie.id, expiresWeek: endW, expiresYear: endY, tierIds: [], feePaid: offer.feeM, yearsLicensed: offer.years }],
  };
  const updatedPlayer = { ...state.player, cash: +(state.player.cash + offer.feeM / 1000).toFixed(3) };
  const relationships = { ...(state.relationships || {}) };
  nudgeRelInPlace(relationships, state.player.id, svc.studioId, 6);
  const newsLog = [
    { week: state.week, year: state.year, text: `${state.player.name} licenses ${movie.title} to ${svc.name} ($${offer.feeM.toFixed(1)}M / ${offer.years}yr).` },
    ...state.newsLog,
  ].slice(0, 100);
  return { state: { ...state, player: updatedPlayer, streamingServices: services, pendingOffers: state.pendingOffers!.filter(o => o.id !== offerId), relationships, newsLog } };
}

// Player counters with a new fee. AI accepts (≤100% max), counters back (round 1, ≤115%), or walks away.
export function counterLicenseOffer(state: GameState, offerId: string, counterFeeM: number): { state: GameState; error?: string } {
  const offer = (state.pendingOffers || []).find(o => o.id === offerId);
  if (!offer) return { state, error: 'Offer not found.' };
  const movie = state.movies.find(m => m.id === offer.movieId);
  if (!movie) return { state, error: 'Movie not found.' };
  const svc = (state.streamingServices || []).find(s => s.id === offer.serviceId);
  if (!svc) return { state, error: 'Service no longer exists.' };
  const baseFee = computeLicenseFee(movie, offer.years, state.week, state.year);
  const maxWillingness = baseFee * 1.35;
  const ratio = counterFeeM / maxWillingness;

  if (ratio <= 1.0) {
    // AI accepts the counter
    let endW = state.week + offer.years * WEEKS_PER_YEAR;
    let endY = state.year;
    while (endW > WEEKS_PER_YEAR) { endW -= WEEKS_PER_YEAR; endY += 1; }
    const svcIdx = state.streamingServices.findIndex(s => s.id === svc.id);
    const services = state.streamingServices.slice();
    services[svcIdx] = {
      ...svc,
      catalogMovieIds: svc.catalogMovieIds.includes(movie.id) ? svc.catalogMovieIds : [...svc.catalogMovieIds, movie.id],
      licensedMovies: [...(svc.licensedMovies || []), { movieId: movie.id, expiresWeek: endW, expiresYear: endY, tierIds: [], feePaid: counterFeeM, yearsLicensed: offer.years }],
    };
    const updatedPlayer = { ...state.player, cash: +(state.player.cash + counterFeeM / 1000).toFixed(3) };
    const relationships = { ...(state.relationships || {}) };
    nudgeRelInPlace(relationships, state.player.id, svc.studioId, 4);
    const newsLog = [
      { week: state.week, year: state.year, text: `${svc.name} agrees: ${movie.title} for $${counterFeeM.toFixed(1)}M / ${offer.years}yr.` },
      ...state.newsLog,
    ].slice(0, 100);
    return { state: { ...state, player: updatedPlayer, streamingServices: services, pendingOffers: state.pendingOffers!.filter(o => o.id !== offerId), relationships, newsLog } };
  }
  if (ratio <= 1.15 && offer.round === 1) {
    // AI counters back at the midpoint (final offer)
    const midpoint = +Math.max(offer.feeM, (offer.feeM + counterFeeM) / 2 * 0.98).toFixed(1);
    const updated: LicenseOffer = {
      ...offer, feeM: midpoint, round: 2, playerCounterFeeM: counterFeeM,
      reasoning: `"${svc.name} counters: $${midpoint.toFixed(1)}M is our final offer."`,
    };
    const newsLog = [
      { week: state.week, year: state.year, text: `${svc.name} counters your ${movie.title} counter at $${midpoint.toFixed(1)}M (final).` },
      ...state.newsLog,
    ].slice(0, 100);
    return { state: { ...state, pendingOffers: state.pendingOffers!.map(o => o.id === offerId ? updated : o), newsLog } };
  }
  // Walk away
  const relationships = { ...(state.relationships || {}) };
  nudgeRelInPlace(relationships, state.player.id, svc.studioId, -4);
  const newsLog = [
    { week: state.week, year: state.year, text: `${svc.name} walks away from ${movie.title} — too pricey.` },
    ...state.newsLog,
  ].slice(0, 100);
  return { state: { ...state, pendingOffers: state.pendingOffers!.filter(o => o.id !== offerId), relationships, newsLog } };
}

export function rejectLicenseOffer(state: GameState, offerId: string): { state: GameState; error?: string } {
  const offer = (state.pendingOffers || []).find(o => o.id === offerId);
  if (!offer) return { state, error: 'Offer not found.' };
  const movie = state.movies.find(m => m.id === offer.movieId);
  const svc = (state.streamingServices || []).find(s => s.id === offer.serviceId);
  const newsLog = [
    { week: state.week, year: state.year, text: `${state.player.name} rejects ${svc?.name || 'a streamer'}'s offer for ${movie?.title || 'a title'}.` },
    ...state.newsLog,
  ].slice(0, 100);
  return { state: { ...state, pendingOffers: state.pendingOffers!.filter(o => o.id !== offerId), newsLog } };
}

// Sign a multi-picture contract that already passed the negotiation flow (no random acceptance roll).
export function signNegotiatedContract(state: GameState, talentId: string, numMovies: number, upfrontPayment: number, boPercent: number): { state: GameState; error?: string } { const talent = state.talents.find(t => t.id === talentId);
  if (!talent) return { state, error: 'Talent not found.' };
  if (talent.retired) return { state, error: 'This talent has retired.' };
  if (talent.underContract?.studioId) {
    const s = talent.underContract.studioId === state.player.id ? state.player : state.rivals.find(r => r.id === talent.underContract!.studioId);
    return { state, error: `Already under contract with ${s?.name || 'another studio'}.` };
  }
  const costB = upfrontPayment / 1000;
  if (state.player.cash < costB) return { state, error: `Not enough cash. Need $${upfrontPayment.toFixed(1)}M.` };
  const contract: import('./types').TalentContract = {
    studioId: state.player.id,
    remainingMovies: numMovies,
    upfrontPaid: upfrontPayment,
    boPercent,
    perMovieSalary: +(upfrontPayment / numMovies).toFixed(2),
    signedWeek: state.week,
    signedYear: state.year,
  };
  const updatedTalents = state.talents.map(t => t.id === talentId ? { ...t, underContract: contract } : t);
  const updatedPlayer = { ...state.player, cash: +(state.player.cash - costB).toFixed(3) };
  const newsLog = [
    { week: state.week, year: state.year, text: `${state.player.name} signs ${talent.name} after negotiation: ${numMovies}-movie deal ($${upfrontPayment.toFixed(1)}M + ${boPercent}% BO).` },
    ...state.newsLog,
  ].slice(0, 100);
  return { state: { ...state, talents: updatedTalents, player: updatedPlayer, newsLog } };
}


export function simulateWeek(state: GameState): GameState {
  let newWeek = state.week + 1;
  let newYear = state.year;
  if (newWeek > WEEKS_PER_YEAR) { newWeek = 1; newYear += 1; }

  const news: typeof state.newsLog = [];
  let movies = state.movies.map(m => ({ ...m, weeklyBO: [...m.weeklyBO] }));
  let player = { ...state.player };
  let franchises = state.franchises.map(f => ({ ...f }));
  let talents = state.talents.map(t => ({ ...t, growthLog: [...t.growthLog] }));
  const relationships: Record<string, number> = { ...(state.relationships || {}) };
  let streamingServices = (state.streamingServices || []).map(s => ({
    ...s,
    tiers: s.tiers.map(t => ({ ...t })),
    tierSubscribers: { ...(s.tierSubscribers || {}) },
    catalogMovieIds: [...(s.catalogMovieIds || [])],
    history: [...(s.history || [])],
  }));

  // Helper: add a movie to a specific service (with optional tier targeting). Returns true if added.
  const addToServiceById = (m: Movie, svcId: string, tierIds?: string[]) => {
    const svc = streamingServices.find(s => s.id === svcId);
    if (!svc) return false;
    if (!svc.catalogMovieIds.includes(m.id)) svc.catalogMovieIds.push(m.id);
    if (tierIds && tierIds.length) {
      svc.movieTierAccess = { ...(svc.movieTierAccess || {}), [m.id]: [...tierIds] };
    }
    m.inStreamingServiceIds = [...(m.inStreamingServiceIds || []), svc.id];
    return true;
  };
  // Helper: add a movie to the studio's first owned service catalog (no-op if no service / already present)
  const addToOwnService = (m: Movie) => {
    const svc = streamingServices.find(s => s.studioId === m.studioId);
    if (!svc) return;
    if (svc.catalogMovieIds.includes(m.id)) return;
    svc.catalogMovieIds.push(m.id);
    m.inStreamingServiceIds = [...(m.inStreamingServiceIds || []), svc.id];
  };

  const holiday = holidayFor(newWeek);

  movies.forEach(m => {
    if (m.status === 'production') {
      m.weeksToRelease -= 1;
      if (m.weeksToRelease <= 0) {
        const writer = talents.find(t => t.id === m.writerId)!;
        const director = talents.find(t => t.id === m.directorId)!;
        const castT = m.cast.map(c => talents.find(t => t.id === c.talentId)!).filter(Boolean);
        // GRANULAR SKILL — uses each talent's headline craft + genre fit (BOS-style)
        const writerEff = effectiveSkillFor(writer, m.genre);
        const directorEff = effectiveSkillFor(director, m.genre);
        const avgCastEff = castT.length ? castT.reduce((a, b) => a + effectiveSkillFor(b, m.genre), 0) / castT.length : 60;
        const avgCastFame = castT.length ? castT.reduce((a, b) => a + b.fame, 0) / castT.length : 30;
        const fit = arcGenreFit(m.plotArc, m.genre);
        const runtimeFit = m.runtime >= 90 && m.runtime <= 170 ? 1 : 0.85;
        const baseCritic = (writerEff * 0.32 + directorEff * 0.32 + avgCastEff * 0.36) * fit * runtimeFit;
        m.criticScore = Math.max(20, Math.min(100, Math.round(baseCritic + (Math.random() * 14 - 7))));

        // Cast Chemistry — talent-to-talent color matching across writer + director + cast
        const chemColors = [writer.colorTrait, director.colorTrait, ...castT.map(t => t.colorTrait)].filter(Boolean) as ColorTrait[];
        const chemBonus = computeChemistryBonus(chemColors);
        m.chemistryBonus = +(chemBonus * 100).toFixed(1);
        (m as any).colorBonus = m.chemistryBonus;

        // Release cooldown: clear inProductionMovieId for cast/crew + set 3-week cooldown.
        const involvedIds = new Set([m.writerId, m.directorId, ...m.cast.map(c => c.talentId)]);
        const cooldownEndWeek = newWeek + POST_PRODUCTION_COOLDOWN_WEEKS;
        let cdWeek = cooldownEndWeek; let cdYear = newYear;
        while (cdWeek > WEEKS_PER_YEAR) { cdWeek -= WEEKS_PER_YEAR; cdYear += 1; }
        talents.forEach(tt => {
          if (involvedIds.has(tt.id)) {
            tt.inProductionMovieId = undefined;
            tt.availableFromWeek = cdWeek;
            tt.availableFromYear = cdYear;
          }
        });

        // Franchise multipliers + fatigue
        const franchise = franchises.find(f => f.id === m.franchiseId);
        let franchiseMult = 1;
        if (franchise) {
          if (m.brand === 'Sequel') franchiseMult = 1 + (franchise.popularity / 100) * 0.7;
          if (m.brand === 'Prequel') franchiseMult = 1 + (franchise.popularity / 100) * 0.55;
          if (m.brand === 'Spinoff') franchiseMult = 1 + (franchise.popularity / 100) * 0.4;
          if (m.brand === 'Crossover') franchiseMult = 1 + (franchise.popularity / 100) * 0.85;
          // Fatigue: if franchise had a release within the past full year (48 weeks) and this is sequel/prequel
          if (m.brand !== 'Original' && franchise.lastReleasedYear > 0) {
            const weeksSince = (newYear - franchise.lastReleasedYear) * WEEKS_PER_YEAR + (newWeek - franchise.lastReleasedWeek);
            if (weeksSince < WEEKS_PER_YEAR) {
              const fatigue = 1 - (weeksSince / WEEKS_PER_YEAR);
              const penalty = 0.30 * fatigue;
              m.fatiguePenalty = +(penalty * 100).toFixed(1);
              franchiseMult *= (1 - penalty);
              m.criticScore = Math.max(15, Math.round(m.criticScore - 8 * fatigue));
            }
          }
        }
        if (m.crossoverFranchiseIds?.length) {
          m.crossoverFranchiseIds.forEach(fid => {
            const cf = franchises.find(f => f.id === fid);
            if (cf) franchiseMult += (cf.popularity / 100) * 0.35;
            // Relationship event — releasing studio collaborates with the franchise's owner
            if (cf && cf.studioId !== m.studioId) {
              const delta = m.criticScore >= 80 ? 8 : m.criticScore >= 65 ? 5 : m.criticScore >= 50 ? 2 : -3;
              nudgeRelInPlace(relationships, m.studioId, cf.studioId, delta);
            }
          });
        }
        // Holiday bonus
        let holidayMult = 1;
        if (holiday && (!holiday.genres || holiday.genres.includes(m.genre))) {
          holidayMult = holiday.mult;
          m.holidayBonus = +((holiday.mult - 1) * 100).toFixed(1);
        }
        const marketingMult = 0.55 + Math.min(2.2, m.marketingBudget / 25);
        const marketingEff = computeMarketingEfficiency(m.marketingAllocation, state.audience);
        const fameMult = 0.7 + (avgCastFame / 100) * 0.7;
        const criticMult = m.criticScore >= 90 ? 1.6 : m.criticScore >= 80 ? 1.3 : m.criticScore >= 70 ? 1.05 : m.criticScore >= 55 ? 0.8 : 0.5;
        // External IP attached → apply BO multiplier from licensed IP popularity.
        let ipMult = 1;
        if (m.externalIPId) {
          const ip = state.externalIPs?.find(i => i.id === m.externalIPId);
          if (ip) ipMult = ipBoostsForMovie(ip).boMult;
        }
        const isStreamingExclusive = m.releaseStrategy === 'streaming';
        const opening = isStreamingExclusive ? 0 : (40 + Math.random() * 30) * marketingMult * marketingEff * fameMult * criticMult * franchiseMult * fit * (1 + chemBonus) * holidayMult * ipMult;
        const openingB = +(opening / 1000).toFixed(4);
        m.weeklyBO.push(openingB);
        m.boxOffice = openingB;
        m.status = 'released';
        m.releaseWeek = newWeek; m.releaseYear = newYear;
        m.reviews = generateReviews(m.criticScore);
        // External IP licensor BO royalty: deduct % of opening from player's cash (recorded against player).
        if (m.externalIPId && m.studioId === player.id) {
          const lic = (state.ownedIPLicenses || []).find(l => l.id === m.ipLicenseId);
          if (lic && lic.boPercent > 0) {
            const royB = +(openingB * lic.boPercent / 100).toFixed(4);
            // Deduct from player cash
            const playerIdx = -1; // player handled in main loop
            // Apply later when we settle profits — simplest: reduce m.boxOffice for player's share calc later.
            // We'll just push a news note now; cash deduction happens lazily via news only.
            // To keep things simple AND truthful: deduct directly here.
            // (Cash field is on `player` object outside this map; we update via a side-effect.)
            // We'll mutate via state at the end of simulateWeek; but here we don't have direct reference.
            // Push a delta to a queue we drain after the loop.
            (state as any).__pendingIPRoyalties = ((state as any).__pendingIPRoyalties || 0) + royB;
            news.push({ week: newWeek, year: newYear, text: `📜 IP royalty owed on ${m.title}: $${(royB * 1000).toFixed(2)}M (${lic.boPercent}% to licensor).` });
          }
        }

        // Streaming-exclusive: auto-add to the player-chosen service+tiers (or studio's first service for AI).
        // Hybrid & Theatrical: NEVER auto-add. Player must license/add manually from streaming detail.
        if (m.releaseStrategy === 'streaming') {
          if (m.streamingTargetServiceId) {
            const ok = addToServiceById(m, m.streamingTargetServiceId, m.streamingTargetTierIds);
            if (!ok) addToOwnService(m); // fallback if target service was deleted
          } else {
            addToOwnService(m);
          }
        }

        // Studio gets BO minus cast BO percentages (zero on streaming-exclusives)
        const castCutFraction = m.cast.reduce((a, c) => a + (c.boPercent || 0), 0) / 100;
        const studioCut = openingB * (1 - castCutFraction);

        // Bulk license fulfillment: if a player's streaming service has an active deal with this rival, queue with windowing delay (auto-add later).
        if (m.studioId !== player.id) {
          const playerSvcs = streamingServices.filter(svc => svc.studioId === player.id);
          for (const svc of playerSvcs) {
            const svcIdx = streamingServices.findIndex(s => s.id === svc.id);
            // Match a count-based deal OR a franchise-bulk deal that matches this movie's franchise.
            const deal = (svc.bulkLicenseDeals || []).find(d => {
              if (d.rivalStudioId !== m.studioId) return false;
              const expTotal = d.expiresYear * WEEKS_PER_YEAR + d.expiresWeek;
              const nowTotal = newYear * WEEKS_PER_YEAR + newWeek;
              if (expTotal < nowTotal) return false;
              if (d.franchiseId) return m.franchiseId === d.franchiseId;
              if (d.moviesUsed >= d.movieCountTotal) return false;
              return true;
            });
            if (deal && !svc.catalogMovieIds.includes(m.id)) {
              const alreadyQueued = (deal.queuedMovies || []).some(q => q.movieId === m.id);
              if (alreadyQueued) break;
              const delay = bulkLicenseDelayWeeks(m.releaseStrategy);
              const elig = addWeeksWY(newWeek, newYear, delay);
              const updatedDeals = (svc.bulkLicenseDeals || []).map(d => d.id === deal.id
                ? { ...d, queuedMovies: [...(d.queuedMovies || []), { movieId: m.id, eligibleWeek: elig.week, eligibleYear: elig.year }] }
                : d);
              streamingServices[svcIdx] = { ...streamingServices[svcIdx], bulkLicenseDeals: updatedDeals };
              const remainingNote = deal.franchiseId ? '' : ` (${deal.movieCountTotal - deal.moviesUsed - (deal.queuedMovies?.length || 0) - 1} films left)`;
              news.push({ week: newWeek, year: newYear, text: `📥 Bulk deal: ${m.title} will join ${svc.name} in ~${delay}w${remainingNote}.` });
              break;
            }
          }
        }
        // Cast members earn the BO cut
        m.cast.forEach(c => {
          const t = talents.find(tt => tt.id === c.talentId);
          if (t && c.boPercent) {
            // talent doesn't accumulate cash but it impacts studio cut
          }
        });

        // Update studio (player or rival)
        if (m.studioId === player.id) {
          player = { ...player, releases: player.releases + 1, totalBO: +(player.totalBO + openingB).toFixed(3), cash: +(player.cash + studioCut).toFixed(3) };
        }

        if (franchise) {
          franchise.lastReleasedWeek = newWeek; franchise.lastReleasedYear = newYear;
          const popDelta = m.criticScore >= 80 ? 6 : m.criticScore >= 65 ? 3 : -2;
          franchise.popularity = Math.max(5, Math.min(100, franchise.popularity + popDelta));
        }

        // Talent dynamic evolution
        [writer, director, ...castT].forEach(t => {
          const idx = talents.findIndex(tt => tt.id === t.id);
          if (idx < 0) return;
          const tt = talents[idx];
          const newCount = tt.movies + 1;
          tt.reviewAvg = +(((tt.reviewAvg * tt.movies) + m.criticScore) / newCount).toFixed(1);
          tt.totalBO = +(tt.totalBO + openingB).toFixed(3);
          tt.movies = newCount;
          // Fame growth/decline
          const fameDelta = m.criticScore >= 85 ? 4 : m.criticScore >= 70 ? 2 : m.criticScore >= 55 ? 0 : -2;
          tt.fame = Math.max(5, Math.min(100, tt.fame + fameDelta));
          // Skill grows slowly with experience and big hits
          if (m.criticScore >= 80) tt.skill = Math.min(100, tt.skill + 1);
          // Salary recalibrates upward with fame, especially in franchises
          const inFranchiseBoost = m.brand !== 'Original' ? 1.05 : 1.0;
          const targetSalary = (tt.role === 'writer' ? 4 : tt.role === 'director' ? 7 : 6) + (tt.skill - 55) * 0.18 + (tt.fame - 10) * 0.14;
          tt.salary = +Math.max(tt.salary, targetSalary * inFranchiseBoost).toFixed(2);
          tt.growthLog.push(fameDelta);
          if (tt.growthLog.length > 6) tt.growthLog.shift();
        });

        const studioName = m.studioId === player.id ? player.name : (state.rivals.find(r => r.id === m.studioId)?.name || 'A studio');
        const tags = [];
        if (m.fatiguePenalty > 0) tags.push(`-${m.fatiguePenalty.toFixed(0)}% fatigue`);
        if (m.holidayBonus > 0) tags.push(`+${m.holidayBonus.toFixed(0)}% ${holiday?.name}`);
        if ((m.colorBonus || 0) > 5 || m.chemistryBonus > 5) tags.push(`+${(m.chemistryBonus || (m as any).colorBonus || 0).toFixed(0)}% chemistry`);
        news.push({ week: newWeek, year: newYear, text: `${studioName}: ${m.title} opens ${m.criticScore}/100, ${(openingB * 1000).toFixed(0)}M${tags.length ? ' (' + tags.join(', ') + ')' : ''}.` });
      }
    } else if (m.status === 'released') {
      const lastWk = m.weeklyBO[m.weeklyBO.length - 1] || 0;
      if (m.weeklyBO.length < 12 && lastWk > 0.001) {
        const decayed = +(lastWk * (0.42 + Math.random() * 0.18)).toFixed(4);
        m.weeklyBO.push(decayed);
        m.boxOffice = +(m.boxOffice + decayed).toFixed(4);
        const castCutFraction = m.cast.reduce((a, c) => a + (c.boPercent || 0), 0) / 100;
        const studioCut = decayed * (1 - castCutFraction);
        if (m.studioId === player.id) {
          player = { ...player, totalBO: +(player.totalBO + decayed).toFixed(3), cash: +(player.cash + studioCut).toFixed(3) };
        }
      }
      // Hybrid release: auto-add to the studio's primary streaming service after streamingWindowWeeks.
      if (m.releaseStrategy === 'hybrid') {
        const wksSinceRelease = m.weeklyBO.length;
        const window = m.streamingWindowWeeks ?? 12;
        if (wksSinceRelease >= window && !(m.inStreamingServiceIds && m.inStreamingServiceIds.length)) {
          // Pick the studio's first service from the world list
          const ownService = streamingServices.find(svc => svc.studioId === m.studioId);
          if (ownService) {
            const svcIdx = streamingServices.findIndex(s => s.id === ownService.id);
            if (svcIdx >= 0 && !streamingServices[svcIdx].catalogMovieIds.includes(m.id)) {
              streamingServices[svcIdx] = { ...streamingServices[svcIdx], catalogMovieIds: [...streamingServices[svcIdx].catalogMovieIds, m.id] };
              m.inStreamingServiceIds = [...(m.inStreamingServiceIds || []), ownService.id];
              if (m.studioId === player.id) {
                news.push({ week: newWeek, year: newYear, text: `📺 ${m.title} hits ${ownService.name} (hybrid window ended).` });
              }
            }
          }
        }
      }
    }
    // Bidding war: when a rival's released hit (≥$200M BO total) hasn't fired its bidding-war news yet, fire it now to alert the player.
    // This is a flavor/engagement event — the standard licensing flow remains unchanged.
    if (m.status === 'released' && !m.biddingWarFired && m.studioId !== player.id && m.boxOffice * 1000 >= 200) {
      const ownerName = state.rivals.find(r => r.id === m.studioId)?.name || 'A studio';
      news.push({
        week: newWeek, year: newYear,
        text: `🔥 BIDDING WAR — ${m.title} (${ownerName}, $${(m.boxOffice * 1000).toFixed(0)}M BO) is now available to license. Streaming wars heating up!`,
      });
      m.biddingWarFired = true;
    }
  });

  // Awards season (week 46): 4 award systems with 5 per-category awards each
  if (newWeek === 46) {
    const yearMovies = movies.filter(mm => mm.releaseYear === newYear && mm.status === 'released');
    const awardsLog = (state.awardsLog || []).slice();

    const runCeremony = (pool: Movie[], poolKey: 'ricardos' | 'bigpic' | 'indie' | 'guild', poolLabel: string, weight: number) => {
      if (pool.length === 0) return;
      // Compute nominees per category by category-specific score
      const sortDesc = <T,>(arr: T[], score: (x: T) => number) => [...arr].sort((a, b) => score(b) - score(a));

      // Best Picture: top 5 by criticScore
      const bpNoms = sortDesc(pool, m => m.criticScore).slice(0, 5)
        .map(m => ({ movieId: m.id, score: m.criticScore }));

      // Best Director: top 5 movies by (critic × director.skill)
      const dirNoms = sortDesc(pool, m => {
        const d = talents.find(t => t.id === m.directorId);
        return m.criticScore * ((d?.skill || 50) / 100);
      }).slice(0, 5).map(m => ({ movieId: m.id, talentId: m.directorId, score: m.criticScore }));

      // Best Writer: top 5 movies by (critic × writer.skill)
      const wrNoms = sortDesc(pool, m => {
        const w = talents.find(t => t.id === m.writerId);
        return m.criticScore * ((w?.skill || 50) / 100);
      }).slice(0, 5).map(m => ({ movieId: m.id, talentId: m.writerId, score: m.criticScore }));

      // Best Leading Actor: top 5 (movieId, leading cast talentId) by critic × talent.skill
      type ActPair = { movieId: string; talentId: string; score: number };
      const leadingPairs: ActPair[] = [];
      const supportingPairs: ActPair[] = [];
      pool.forEach(m => {
        m.cast.forEach(c => {
          const t = talents.find(tt => tt.id === c.talentId);
          if (!t) return;
          const score = m.criticScore * (t.skill / 100);
          if (c.role === 'lead_actor' || c.role === 'lead_actress') leadingPairs.push({ movieId: m.id, talentId: c.talentId, score });
          else supportingPairs.push({ movieId: m.id, talentId: c.talentId, score });
        });
      });
      const laNoms = sortDesc(leadingPairs, p => p.score).slice(0, 5);
      const saNoms = sortDesc(supportingPairs, p => p.score).slice(0, 5);

      const categories: import('./types').AwardCategory[] = ([
        { key: 'best_picture' as const, label: 'Best Picture', nominees: bpNoms as any, winnerIdx: 0 },
        { key: 'best_director' as const, label: 'Best Director', nominees: dirNoms as any, winnerIdx: 0 },
        { key: 'best_writer' as const, label: 'Best Writer', nominees: wrNoms as any, winnerIdx: 0 },
        { key: 'best_leading_actor' as const, label: 'Best Leading Performance', nominees: laNoms as any, winnerIdx: 0 },
        { key: 'best_supporting_actor' as const, label: 'Best Supporting Performance', nominees: saNoms as any, winnerIdx: 0 },
      ] as import('./types').AwardCategory[]).filter(c => c.nominees.length > 0);

      // Apply award bonuses
      categories.forEach(cat => {
        if (!cat.nominees.length) return;
        const winner: any = cat.nominees[0];
        const winnerMovie = movies.find(mm => mm.id === winner.movieId);
        if (!winnerMovie) return;
        const a = Math.max(1, Math.round(2 * weight));
        winnerMovie.awards += a;
        if (winnerMovie.studioId === player.id) player.awards += a;
        // Boost talent if applicable
        if (winner.talentId) {
          const tIdx = talents.findIndex(t => t.id === winner.talentId);
          if (tIdx >= 0) {
            talents[tIdx] = { ...talents[tIdx], fame: Math.min(100, talents[tIdx].fame + 5), salary: +(talents[tIdx].salary * 1.15).toFixed(2) };
          }
        }
        if (cat.key === 'best_picture') {
          news.push({ week: newWeek, year: newYear, text: `🏆 ${poolLabel}: ${winnerMovie.title} wins ${cat.label}.` });
        } else if (winner.talentId) {
          const t = talents.find(tt => tt.id === winner.talentId);
          if (t) news.push({ week: newWeek, year: newYear, text: `🏆 ${poolLabel}: ${t.name} wins ${cat.label} for ${winnerMovie.title}.` });
        }
      });

      awardsLog.push({ year: newYear, poolKey, poolLabel, categories });
    };

    runCeremony(yearMovies, 'ricardos', "Ricardo's Awards", 1);
    runCeremony(yearMovies.filter(mm => mm.budget >= 200), 'bigpic', 'Big Picture Awards', 1.2);
    runCeremony(yearMovies.filter(mm => mm.budget < 200), 'indie', 'Independent Awards', 0.9);
    runCeremony(yearMovies.filter(mm => mm.cast.some(c => c.boPercent >= 6)), 'guild', 'Creative Guild Awards', 0.8);

    (state as any).awardsLog = awardsLog; // mutable ref; persisted via return below
  }

  // Annual talent pool refresh (week 1 of new year): top up each color back to ~100 active talents,
  // and add a guaranteed mix of young/mid/veteran new faces across all roles.
  if (newWeek === 1 && state.year !== newYear) {
    const roles: Talent['role'][] = ['writer', 'director', 'actor', 'actress'];
    // Top up per color
    let added = 0;
    COLORS.forEach(color => {
      const active = talents.filter(t => !t.retired && t.colorTrait === color).length;
      const deficit = 100 - active;
      if (deficit > 0) {
        for (let i = 0; i < deficit; i++) {
          const role = pick(roles);
          const r = Math.random();
          const ageMin = r < 0.5 ? 22 : r < 0.85 ? 30 : 45;
          const ageMax = r < 0.5 ? 30 : r < 0.85 ? 45 : 60;
          talents.push(genTalent(role, { ageMin, ageMax, color }) as Talent);
          added++;
        }
      }
    });
    // Always add 1 prime young + 1 mid per role for fresh-blood feel
    roles.forEach(r => {
      talents.push(genTalent(r, { ageMin: 22, ageMax: 30 }) as Talent);
      talents.push(genTalent(r, { ageMin: 35, ageMax: 50 }) as Talent);
      added += 2;
    });
    news.push({ week: newWeek, year: newYear, text: `New season: ${added} fresh names enter the industry across all colors.` });
  }

  // Aging & retirement (1 week of aging per simulated week)
  const aged = ageAndRetireTalents(talents, 1);
  talents = aged.talents;
  aged.retired.forEach(t => news.push({ week: newWeek, year: newYear, text: `${t.name} retires after ${t.movies} films. A new face emerges.` }));

  // AI rivals attempt to start new productions
  const aiResult = aiProduceMovies({ ...state, movies, franchises, talents, player }, newWeek, newYear, talents);
  movies = aiResult.state.movies;
  franchises = aiResult.state.franchises;
  talents = aiResult.talents;
  let rivals = aiResult.state.rivals;

  // ---------- AI STREAMING LICENSING (every week) ----------
  let pendingOffers: LicenseOffer[] = [...(state.pendingOffers || [])];
  // Expire old offers (>4 weeks)
  pendingOffers = pendingOffers.filter(o => {
    const weeksOld = (newYear - o.createdYear) * WEEKS_PER_YEAR + (newWeek - o.createdWeek);
    return weeksOld <= 4;
  });
  const licResult = aiLicenseMovies(
    { ...state, movies, franchises, talents, player, rivals, week: newWeek, year: newYear, pendingOffers },
    newWeek, newYear,
    movies, streamingServices, rivals,
    relationships, pendingOffers,
  );
  movies = licResult.movies;
  streamingServices = licResult.services;
  rivals = licResult.rivals;
  pendingOffers = licResult.pendingOffers;
  Object.assign(relationships, licResult.relationships);
  licResult.news.forEach(n => news.push(n));

  // Update player rating
  const stars = player.totalBO >= 200 ? 5 : player.totalBO >= 80 ? 4 : player.totalBO >= 30 ? 3 : player.totalBO >= 8 ? 2 : 1;
  player.rating = stars;

  // ---------- Streaming services weekly tick ----------
  // 0a) Drain bulk-license deal queues: any movies past their windowing eligibility
  //     get added to the player's streaming service catalog (count toward moviesUsed
  //     unless the deal is franchise-based).
  streamingServices.forEach(svc => {
    if (svc.studioId !== player.id) return;
    if (!svc.bulkLicenseDeals?.length) return;
    const updatedDeals = svc.bulkLicenseDeals.map(d => {
      const queue = d.queuedMovies || [];
      if (!queue.length) return d;
      const ready: typeof queue = [];
      const remaining: typeof queue = [];
      const nowTotal = newYear * WEEKS_PER_YEAR + newWeek;
      queue.forEach(q => {
        const eligTotal = q.eligibleYear * WEEKS_PER_YEAR + q.eligibleWeek;
        if (eligTotal <= nowTotal) ready.push(q); else remaining.push(q);
      });
      if (!ready.length) return d;
      let used = d.moviesUsed;
      ready.forEach(r => {
        if (svc.catalogMovieIds.includes(r.movieId)) return;
        // For count-based deals, respect movieCountTotal cap.
        if (!d.franchiseId && used >= d.movieCountTotal) return;
        svc.catalogMovieIds.push(r.movieId);
        const mv = movies.find(mm => mm.id === r.movieId);
        if (mv) {
          mv.inStreamingServiceIds = Array.from(new Set([...(mv.inStreamingServiceIds || []), svc.id]));
          news.push({ week: newWeek, year: newYear, text: `📥 Bulk window closed: ${mv.title} now streaming on ${svc.name}.` });
        }
        if (!d.franchiseId) used += 1;
      });
      return { ...d, moviesUsed: used, queuedMovies: remaining };
    });
    svc.bulkLicenseDeals = updatedDeals;
  });

  // First: expire any licensed-in titles whose duration has passed
  streamingServices.forEach(svc => {
    if (!svc.licensedMovies?.length) return;
    const stillActive: typeof svc.licensedMovies = [];
    const expired: string[] = [];
    svc.licensedMovies.forEach(l => {
      if (l.expiresYear < newYear || (l.expiresYear === newYear && l.expiresWeek <= newWeek)) {
        expired.push(l.movieId);
      } else {
        stillActive.push(l);
      }
    });
    if (expired.length) {
      svc.licensedMovies = stillActive;
      // Remove expired licensed movies from catalog (only if they were not also owned)
      svc.catalogMovieIds = svc.catalogMovieIds.filter(mid => {
        if (!expired.includes(mid)) return true;
        const m = movies.find(mm => mm.id === mid);
        // keep only if owned by this service's studio
        return m?.studioId === svc.studioId;
      });
      if (svc.movieTierAccess) {
        const newAccess: Record<string, string[]> = {};
        Object.keys(svc.movieTierAccess).forEach(mid => {
          if (!expired.includes(mid)) newAccess[mid] = svc.movieTierAccess![mid];
        });
        svc.movieTierAccess = newAccess;
      }
      if (svc.studioId === player.id) {
        expired.forEach(mid => {
          const m = movies.find(mm => mm.id === mid);
          if (m) news.push({ week: newWeek, year: newYear, text: `License expired: ${m.title} removed from ${svc.name}.` });
        });
      }
    }
  });

  streamingServices.forEach(svc => {
    const owner = svc.studioId === player.id ? player : (state.rivals.find(r => r.id === svc.studioId) || null);
    const ownerRep = owner ? Math.min(100, Math.round((owner.rating || 1) * 12 + Math.min(60, owner.awards || 0) * 0.7)) : 50;
    const catalogMovies = movies.filter(mm => svc.catalogMovieIds.includes(mm.id));
    const catalogQuality = catalogMovies.length
      ? +(catalogMovies.reduce((a, b) => a + (b.criticScore || 60), 0) / catalogMovies.length).toFixed(1)
      : 55;
    const catalogSize = catalogMovies.length;
    // Count titles that are unique to THIS service (not present on any other streaming service).
    const exclusiveCount = catalogMovies.reduce((acc, m) => {
      const others = (m.inStreamingServiceIds || []).filter(sid => sid !== svc.id);
      return acc + (others.length === 0 ? 1 : 0);
    }, 0);
    const weeksRunning = (newYear - svc.launchedYear) * WEEKS_PER_YEAR + (newWeek - svc.launchedWeek);

    const out = recomputeStreamingSubs({
      service: svc,
      catalogQuality,
      catalogSize,
      studioReputation: ownerRep,
      population: 1,
      weeksRunning,
      exclusiveCount,
    });
    svc.subscribers = out.totalSubs;
    svc.tierSubscribers = out.tierSubs;
    svc.monthlyRevenue = out.monthlyRevenue;
    // Reputation now also factors exclusive content (capped at +15 for 25+ exclusives).
    const exclusiveRepBoost = Math.min(15, Math.round(exclusiveCount * 0.6));
    svc.reputation = Math.min(100, Math.max(20, Math.round(0.55 * catalogQuality + 0.35 * ownerRep + exclusiveRepBoost)));
    svc.history.push({ week: newWeek, year: newYear, subscribers: svc.subscribers, revenue: svc.monthlyRevenue });
    if (svc.history.length > 96) svc.history.shift();

    // Weekly cash inflow = monthlyRevenue / 4 (in $M → $B)
    const weeklyCashB = +(svc.monthlyRevenue / 4 / 1000).toFixed(4);
    if (svc.studioId === player.id) {
      player = { ...player, cash: +(player.cash + weeklyCashB).toFixed(3) };
    }
  });

  // ---------- Yearly genre BO tracking (for Trends page) ----------
  // Track genre BO of newly released movies this week
  const genreYearlyBO: Record<number, Partial<Record<Genre, number>>> = JSON.parse(JSON.stringify(state.genreYearlyBO || {}));
  movies.forEach(m => {
    if (m.status === 'released' && m.releaseYear === newYear && m.releaseWeek === newWeek) {
      if (!genreYearlyBO[newYear]) genreYearlyBO[newYear] = {};
      genreYearlyBO[newYear][m.genre] = (genreYearlyBO[newYear][m.genre] || 0) + m.boxOffice * 1000; // in $M
    }
  });

  // ---------- Audience evolution + yearly snapshot (week 1 of new year) ----------
  let audience = state.audience;
  const audienceYearlySnapshot: Record<number, { label: string; preferredGenres: Genre[]; preferredColor: ColorTrait }[]> = JSON.parse(JSON.stringify(state.audienceYearlySnapshot || {}));
  if (newWeek === 1 && state.year !== newYear) {
    // Snapshot last year's audience first
    audienceYearlySnapshot[state.year] = state.audience.map(a => ({ label: a.label, preferredGenres: [...a.preferredGenres], preferredColor: a.preferredColor }));
    // Compute top 3 genres of last year by BO
    const lastYearBO = state.genreYearlyBO?.[state.year] || {};
    const topGenres = Object.entries(lastYearBO).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 3).map(([g]) => g as Genre);
    if (topGenres.length) {
      // Each segment shifts: 60% chance to swap weakest preferred genre for a top hit-genre (if not already in their prefs)
      audience = state.audience.map(seg => {
        if (Math.random() < 0.6) {
          const candidate = topGenres.find(g => !seg.preferredGenres.includes(g));
          if (candidate && seg.preferredGenres.length > 0) {
            const newPrefs = [...seg.preferredGenres];
            newPrefs[newPrefs.length - 1] = candidate; // replace last
            return { ...seg, preferredGenres: newPrefs };
          }
        }
        return seg;
      });
      news.push({ week: newWeek, year: newYear, text: `📊 Audience trends shift: ${topGenres.join(', ')} dominated last year — preferences evolving.` });
    }
  }

  // Settle pending IP royalties accumulated during release loop (player-side only).
  const royB: number = (state as any).__pendingIPRoyalties || 0;
  if (royB > 0) {
    player = { ...player, cash: +(player.cash - royB).toFixed(3) };
    delete (state as any).__pendingIPRoyalties;
  }

  return {
    ...state, week: newWeek, year: newYear, player, rivals, movies, talents, franchises, relationships, streamingServices,
    audience,
    awardsLog: (state as any).awardsLog || state.awardsLog,
    genreYearlyBO,
    audienceYearlySnapshot,
    pendingOffers,
    festivals: state.festivals || [],
    cinemaDeals: state.cinemaDeals || [],
    newsLog: [...news, ...state.newsLog].slice(0, 100),
  };
}

export function simulateMultiple(state: GameState, weeks: number): GameState {
  let s = state;
  for (let i = 0; i < weeks; i++) {
    s = simulateWeek(s);
    s = spawnFestivalIfDue(s);
    s = aiFestivalTick(s);
    s = resolveFestivalLots(s);
    s = aiBackgroundTrades(s);
  }
  return s;
}

// Wrap simulateWeek so callers also tick festival spawn/resolve.
// Each tick, AI rivals may autonomously raise bids on any active festival lot (even without player bid).
// This ensures festivals are "alive" and not sitting at starting bid.
function aiFestivalTick(state: GameState): GameState {
  const fests = state.festivals || [];
  if (!fests.some(f => f.status === 'active')) return state;
  let rivals = state.rivals.slice();
  const updatedFests = fests.map(fest => {
    if (fest.status !== 'active') return fest;
    const lots = fest.lots.map(lot => {
      if (lot.sold) return lot;
      // Pool of rivals with cash and not already top bidder
      const candidates = rivals.filter(r => r.id !== lot.currentBidderStudioId && r.cash * 1000 > lot.currentBidM * 1.08);
      if (!candidates.length) return lot;
      // 55% chance each active lot gets a rival bid this week
      if (Math.random() > 0.55) return lot;
      const bidder = candidates[Math.floor(Math.random() * candidates.length)];
      const bumpPct = 1.06 + Math.random() * 0.12;
      const newBid = +(lot.currentBidM * bumpPct).toFixed(1);
      return {
        ...lot,
        currentBidM: newBid,
        currentBidderStudioId: bidder.id,
        bidLog: [...lot.bidLog, { studioId: bidder.id, amountM: newBid, week: state.week, year: state.year }],
      };
    });
    return { ...fest, lots };
  });
  return { ...state, festivals: updatedFests };
}

// =====================================================================
// FRANCHISE TRADING & BULK CATALOG LICENSING
// Pull-and-push negotiation: each side can counter up to `maxRounds` (3).
// When round >= maxRounds, the next action must be accept or reject.
// =====================================================================

// Fair-value estimator for a franchise (in $B).
export function quoteFranchiseValue(state: GameState, franchiseId: string): number {
  const fr = state.franchises.find(f => f.id === franchiseId);
  if (!fr) return 0;
  const movies = state.movies.filter(m => m.franchiseId === franchiseId);
  const totalBO = movies.reduce((a, b) => a + b.boxOffice, 0);
  const recentBO = movies.filter(m => (state.year - m.releaseYear) <= 5).reduce((a, b) => a + b.boxOffice, 0);
  // Fair value (B) = (0.5 × all-time BO) + (1.1 × last-5y BO) + (popularity / 40)
  const base = 0.5 * totalBO + 1.1 * recentBO + (fr.popularity / 40);
  return +Math.max(0.05, base).toFixed(2);
}

// Fair-value estimator for a bulk catalog pack (in $B).
export function quoteBulkCatalogValue(state: GameState, movieIds: string[], years: number): number {
  let total = 0;
  for (const id of movieIds) {
    const m = state.movies.find(mm => mm.id === id);
    if (!m) continue;
    // Per-film fee: 8% of BO for older titles, up to 15% for recent, × years scale.
    const age = Math.max(0, state.year - m.releaseYear);
    const rate = Math.max(0.05, 0.15 - age * 0.015);
    total += m.boxOffice * rate;
  }
  const yearsFactor = 1 + (years - 1) * 0.18;
  return +Math.max(0.02, total * yearsFactor).toFixed(3);
}

// AI evaluator: given an offer, decide accept / counter / reject.
// Returns decision + (if counter) the AI's new price. Used for both franchise and bulk catalog.
// `fairValue` is the AI's internal estimate; `priceB` is the current offer on the table.
function aiTradeResponse(fairValue: number, priceB: number, aiIsSeller: boolean, roundsUsedByAi: number, maxRounds: number): { action: 'accept' | 'counter' | 'reject'; newPriceB?: number } {
  // Ratio: how good is the offer from AI's perspective.
  // If AI sells at priceB, higher priceB = better. If AI buys at priceB, lower priceB = better.
  const ratio = aiIsSeller ? (priceB / fairValue) : (fairValue / priceB);
  if (ratio >= 1.05) return { action: 'accept' };          // within 5% above fair (sellers) or well-below fair (buyers)
  if (ratio < 0.6) {
    // Very unreasonable — reject outright (or hard-counter on first round)
    if (roundsUsedByAi >= maxRounds) return { action: 'reject' };
  }
  if (roundsUsedByAi >= maxRounds) {
    // Out of rounds: accept if within 15%, else reject.
    return ratio >= 0.85 ? { action: 'accept' } : { action: 'reject' };
  }
  // Counter: move ~60% of the way from the offer to fair value.
  const target = aiIsSeller ? Math.max(priceB, fairValue * 0.95) : Math.min(priceB, fairValue * 1.05);
  const newPrice = +(priceB + (target - priceB) * 0.6).toFixed(3);
  return { action: 'counter', newPriceB: Math.max(0.05, newPrice) };
}

// ----- Franchise trade lifecycle -----

export function proposeFranchiseTrade(state: GameState, args: { franchiseId: string; kind: FranchiseOfferKind; priceB: number }): { state: GameState; offer?: FranchiseOffer; error?: string } {
  const fr = state.franchises.find(f => f.id === args.franchiseId);
  if (!fr) return { state, error: 'Franchise not found.' };
  const playerId = state.player.id;
  // Buy: player wants to buy a rival-owned franchise. fromStudioId=player, toStudioId=owner.
  // Sell: player wants to sell own franchise. fromStudioId=player, toStudioId=a chosen AI buyer.
  let counterpartyId: string;
  if (args.kind === 'buy') {
    if (fr.studioId === playerId) return { state, error: "You already own this franchise." };
    counterpartyId = fr.studioId;
  } else {
    if (fr.studioId !== playerId) return { state, error: "That's not your franchise to sell." };
    // Pick highest-rated rival with cash >= priceB/2 (affordability filter)
    const affordable = state.rivals.filter(r => r.cash >= args.priceB * 0.5).sort((a, b) => b.rating - a.rating);
    if (!affordable.length) return { state, error: 'No rival has enough cash to consider this offer.' };
    counterpartyId = affordable[0].id;
  }
  const offer: FranchiseOffer = {
    id: uid('fo_'),
    kind: args.kind,
    franchiseId: args.franchiseId,
    fromStudioId: playerId,
    toStudioId: counterpartyId,
    priceB: +args.priceB.toFixed(3),
    round: 0, maxRounds: 3,
    lastActor: 'from',
    status: 'pending',
    createdWeek: state.week, createdYear: state.year,
    history: [{ actor: 'from', priceB: +args.priceB.toFixed(3), week: state.week, year: state.year }],
  };
  return resolveFranchiseAi({ ...state, franchiseOffers: [...(state.franchiseOffers || []), offer] }, offer.id);
}

// AI reviews offer immediately; may accept, counter, or reject. Returns updated state and (if countered) the offer.
function resolveFranchiseAi(state: GameState, offerId: string): { state: GameState; offer?: FranchiseOffer; error?: string } {
  const offers = (state.franchiseOffers || []).slice();
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx < 0) return { state };
  const offer = offers[idx];
  const fr = state.franchises.find(f => f.id === offer.franchiseId);
  if (!fr) return { state };
  const fair = quoteFranchiseValue(state, offer.franchiseId);
  const aiIsSeller = offer.kind === 'buy'; // player buying = AI selling
  // Rounds AI has used so far = count of 'to' actions in history
  const aiRounds = offer.history.filter(h => h.actor === 'to').length;
  const decision = aiTradeResponse(fair, offer.priceB, aiIsSeller, aiRounds, offer.maxRounds);
  if (decision.action === 'accept') return finalizeFranchiseTrade(state, offer.id);
  if (decision.action === 'reject') {
    offers[idx] = { ...offer, status: 'rejected', lastActor: 'to', message: 'Declined. Terms insufficient.' };
    const newsLog = [{ week: state.week, year: state.year, text: `${aiIsSeller ? 'Rival' : 'Buyer'} rejected ${state.player.name}'s ${offer.kind} offer on ${fr.name}.` }, ...state.newsLog].slice(0, 100);
    return { state: { ...state, franchiseOffers: offers, newsLog } };
  }
  // Counter
  const newPriceB = decision.newPriceB!;
  const countered: FranchiseOffer = {
    ...offer,
    priceB: newPriceB,
    round: offer.round + 1,
    lastActor: 'to',
    status: 'pending',
    history: [...offer.history, { actor: 'to', priceB: newPriceB, week: state.week, year: state.year }],
    message: `Counter: $${newPriceB.toFixed(2)}B.`,
  };
  offers[idx] = countered;
  return { state: { ...state, franchiseOffers: offers }, offer: countered };
}

// Player accepts the current offer (i.e. AI's most recent price).
export function acceptFranchiseOffer(state: GameState, offerId: string): { state: GameState; error?: string } {
  const offer = (state.franchiseOffers || []).find(o => o.id === offerId);
  if (!offer || offer.status !== 'pending') return { state, error: 'Offer not active.' };
  return finalizeFranchiseTrade(state, offerId);
}

export function counterFranchiseOffer(state: GameState, offerId: string, newPriceB: number): { state: GameState; offer?: FranchiseOffer; error?: string } {
  const offers = (state.franchiseOffers || []).slice();
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx < 0 || offers[idx].status !== 'pending') return { state, error: 'Offer not active.' };
  const cur = offers[idx];
  const playerRounds = cur.history.filter(h => (h.actor === 'from' && cur.fromStudioId === state.player.id) || (h.actor === 'to' && cur.toStudioId === state.player.id)).length;
  if (playerRounds >= cur.maxRounds) return { state, error: 'You have used all counter rounds. Accept or reject.' };
  // Determine which side the player is on.
  const playerIsFrom = cur.fromStudioId === state.player.id;
  const actor: 'from' | 'to' = playerIsFrom ? 'from' : 'to';
  const next: FranchiseOffer = {
    ...cur,
    priceB: +newPriceB.toFixed(3),
    round: cur.round + 1,
    lastActor: actor,
    status: 'pending',
    history: [...cur.history, { actor, priceB: +newPriceB.toFixed(3), week: state.week, year: state.year }],
  };
  offers[idx] = next;
  // AI responds
  return resolveFranchiseAi({ ...state, franchiseOffers: offers }, offerId) as any;
}

export function rejectFranchiseOffer(state: GameState, offerId: string): { state: GameState } {
  const offers = (state.franchiseOffers || []).slice();
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx < 0) return { state };
  offers[idx] = { ...offers[idx], status: 'rejected' };
  return { state: { ...state, franchiseOffers: offers } };
}

function finalizeFranchiseTrade(state: GameState, offerId: string): { state: GameState; error?: string } {
  const offers = (state.franchiseOffers || []).slice();
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx < 0) return { state, error: 'Offer missing.' };
  const o = offers[idx];
  const fr = state.franchises.find(f => f.id === o.franchiseId);
  if (!fr) return { state, error: 'Franchise missing.' };
  // Determine buyer/seller
  const buyerId = o.kind === 'buy' ? o.fromStudioId : o.toStudioId;
  const sellerId = o.kind === 'buy' ? o.toStudioId : o.fromStudioId;
  const priceB = o.priceB;
  // Verify buyer has cash
  const buyer = buyerId === state.player.id ? state.player : state.rivals.find(r => r.id === buyerId);
  if (!buyer || buyer.cash < priceB) {
    offers[idx] = { ...o, status: 'rejected', message: 'Buyer lacks cash.' };
    return { state: { ...state, franchiseOffers: offers } };
  }
  // Transfer cash
  let player = state.player;
  let rivals = state.rivals.slice();
  if (buyerId === state.player.id) player = { ...player, cash: +(player.cash - priceB).toFixed(3) };
  else { const i = rivals.findIndex(r => r.id === buyerId); if (i >= 0) rivals[i] = { ...rivals[i], cash: +(rivals[i].cash - priceB).toFixed(3) }; }
  if (sellerId === state.player.id) player = { ...player, cash: +(player.cash + priceB).toFixed(3) };
  else { const i = rivals.findIndex(r => r.id === sellerId); if (i >= 0) rivals[i] = { ...rivals[i], cash: +(rivals[i].cash + priceB).toFixed(3) }; }
  // Transfer franchise + all its movies to buyer
  const newFranchises = state.franchises.map(f => f.id === fr.id ? { ...f, studioId: buyerId } : f);
  const newMovies = state.movies.map(m => m.franchiseId === fr.id ? { ...m, studioId: buyerId } : m);
  // Relationship nudge: successful trade +4 both ways
  const relationships = { ...state.relationships };
  nudgeRelInPlace(relationships, buyerId, sellerId, 4);
  offers[idx] = { ...o, status: 'accepted', message: `Trade closed at $${priceB.toFixed(2)}B.` };
  const sellerName = sellerId === state.player.id ? state.player.name : state.rivals.find(r => r.id === sellerId)?.name || '—';
  const buyerName = buyerId === state.player.id ? state.player.name : state.rivals.find(r => r.id === buyerId)?.name || '—';
  const newsLog = [{ week: state.week, year: state.year, text: `🤝 ${sellerName} sells ${fr.name} to ${buyerName} for $${priceB.toFixed(2)}B.` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, player, rivals, franchises: newFranchises, movies: newMovies, relationships, franchiseOffers: offers, newsLog } };
}

// ----- Bulk catalog license lifecycle -----

export function proposeBulkCatalogLicense(state: GameState, args: { fromRivalStudioId?: string; toRivalStudioId?: string; movieIds: string[]; priceB: number; years: number; serviceId: string; exclusivity?: boolean }): { state: GameState; offer?: BulkCatalogOffer; error?: string } {
  if (args.movieIds.length === 0) return { state, error: 'Select at least 1 movie.' };
  if (args.years < 1 || args.years > 10) return { state, error: 'Years must be 1–10.' };
  const playerId = state.player.id;
  // Player is the buyer (always, for outgoing offers). Target owns the movies.
  const targetId = args.toRivalStudioId!;
  if (!targetId || targetId === playerId) return { state, error: 'Target rival required.' };
  // Validate movies belong to target
  const bad = args.movieIds.find(id => state.movies.find(m => m.id === id)?.studioId !== targetId);
  if (bad) return { state, error: 'Some selected movies are not owned by that studio.' };
  const offer: BulkCatalogOffer = {
    id: uid('bco_'),
    fromStudioId: playerId,
    toStudioId: targetId,
    movieIds: args.movieIds.slice(),
    priceB: +args.priceB.toFixed(3),
    years: args.years,
    serviceId: args.serviceId,
    exclusivity: !!args.exclusivity,
    round: 0, maxRounds: 3,
    lastActor: 'from',
    status: 'pending',
    createdWeek: state.week, createdYear: state.year,
    history: [{ actor: 'from', priceB: +args.priceB.toFixed(3), week: state.week, year: state.year }],
  };
  return resolveBulkCatalogAi({ ...state, bulkCatalogOffers: [...(state.bulkCatalogOffers || []), offer] }, offer.id);
}

function resolveBulkCatalogAi(state: GameState, offerId: string): { state: GameState; offer?: BulkCatalogOffer; error?: string } {
  const offers = (state.bulkCatalogOffers || []).slice();
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx < 0) return { state };
  const offer = offers[idx];
  const fair = quoteBulkCatalogValue(state, offer.movieIds, offer.years);
  const aiIsSeller = offer.fromStudioId === state.player.id; // player buying = AI selling
  const aiRounds = offer.history.filter(h => h.actor === 'to').length;
  const decision = aiTradeResponse(fair, offer.priceB, aiIsSeller, aiRounds, offer.maxRounds);
  if (decision.action === 'accept') return finalizeBulkCatalog(state, offer.id);
  if (decision.action === 'reject') {
    offers[idx] = { ...offer, status: 'rejected', lastActor: 'to', message: 'Price too low — passing.' };
    return { state: { ...state, bulkCatalogOffers: offers } };
  }
  const newPriceB = decision.newPriceB!;
  const countered: BulkCatalogOffer = {
    ...offer,
    priceB: newPriceB,
    round: offer.round + 1,
    lastActor: 'to',
    status: 'pending',
    history: [...offer.history, { actor: 'to', priceB: newPriceB, week: state.week, year: state.year }],
    message: `Counter: $${newPriceB.toFixed(2)}B.`,
  };
  offers[idx] = countered;
  return { state: { ...state, bulkCatalogOffers: offers }, offer: countered };
}

export function acceptBulkCatalogOffer(state: GameState, offerId: string): { state: GameState; error?: string } {
  return finalizeBulkCatalog(state, offerId);
}
export function counterBulkCatalogOffer(state: GameState, offerId: string, newPriceB: number): { state: GameState; offer?: BulkCatalogOffer; error?: string } {
  const offers = (state.bulkCatalogOffers || []).slice();
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx < 0 || offers[idx].status !== 'pending') return { state, error: 'Offer not active.' };
  const cur = offers[idx];
  const playerIsFrom = cur.fromStudioId === state.player.id;
  const actor: 'from' | 'to' = playerIsFrom ? 'from' : 'to';
  const playerRounds = cur.history.filter(h => h.actor === actor).length;
  if (playerRounds >= cur.maxRounds) return { state, error: 'Out of rounds. Accept or reject.' };
  const next: BulkCatalogOffer = {
    ...cur, priceB: +newPriceB.toFixed(3), round: cur.round + 1, lastActor: actor, status: 'pending',
    history: [...cur.history, { actor, priceB: +newPriceB.toFixed(3), week: state.week, year: state.year }],
  };
  offers[idx] = next;
  return resolveBulkCatalogAi({ ...state, bulkCatalogOffers: offers }, offerId) as any;
}
export function rejectBulkCatalogOffer(state: GameState, offerId: string): { state: GameState } {
  const offers = (state.bulkCatalogOffers || []).slice();
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx < 0) return { state };
  offers[idx] = { ...offers[idx], status: 'rejected' };
  return { state: { ...state, bulkCatalogOffers: offers } };
}

function finalizeBulkCatalog(state: GameState, offerId: string): { state: GameState; error?: string } {
  const offers = (state.bulkCatalogOffers || []).slice();
  const idx = offers.findIndex(o => o.id === offerId);
  if (idx < 0) return { state, error: 'Offer missing.' };
  const o = offers[idx];
  // Buyer = fromStudio (the party requesting the bundle). Seller = toStudio.
  const buyerId = o.fromStudioId, sellerId = o.toStudioId;
  const buyer = buyerId === state.player.id ? state.player : state.rivals.find(r => r.id === buyerId);
  if (!buyer || buyer.cash < o.priceB) {
    offers[idx] = { ...o, status: 'rejected', message: 'Buyer lacks cash.' };
    return { state: { ...state, bulkCatalogOffers: offers } };
  }
  let player = state.player;
  let rivals = state.rivals.slice();
  if (buyerId === state.player.id) player = { ...player, cash: +(player.cash - o.priceB).toFixed(3) };
  else { const i = rivals.findIndex(r => r.id === buyerId); if (i >= 0) rivals[i] = { ...rivals[i], cash: +(rivals[i].cash - o.priceB).toFixed(3) }; }
  if (sellerId === state.player.id) player = { ...player, cash: +(player.cash + o.priceB).toFixed(3) };
  else { const i = rivals.findIndex(r => r.id === sellerId); if (i >= 0) rivals[i] = { ...rivals[i], cash: +(rivals[i].cash + o.priceB).toFixed(3) }; }
  // Add movies to buyer's streaming service (if provided) as licensed titles.
  const services = state.streamingServices.slice();
  let movies = state.movies.slice();
  if (o.serviceId) {
    const svcIdx = services.findIndex(s => s.id === o.serviceId);
    if (svcIdx >= 0) {
      const svc = services[svcIdx];
      const expW = state.week, expY = state.year + o.years;
      const added = o.movieIds.filter(id => !svc.catalogMovieIds.includes(id));
      const licenseEntries = (svc.licensedMovies || []).slice();
      for (const mid of added) {
        licenseEntries.push({ movieId: mid, tierIds: [], feePaid: o.priceB * 1000 / added.length, yearsLicensed: o.years, expiresWeek: expW, expiresYear: expY });
      }
      services[svcIdx] = { ...svc, catalogMovieIds: [...svc.catalogMovieIds, ...added], licensedMovies: licenseEntries };
      // EXCLUSIVITY: strip these movie IDs from any OTHER streaming service's catalog/licensedMovies/exclusiveMovieIds
      if (o.exclusivity) {
        const idsSet = new Set(o.movieIds);
        for (let i = 0; i < services.length; i++) {
          if (i === svcIdx) continue;
          const other = services[i];
          const stripped = other.catalogMovieIds.filter(id => !idsSet.has(id));
          if (stripped.length !== other.catalogMovieIds.length) {
            services[i] = {
              ...other,
              catalogMovieIds: stripped,
              licensedMovies: (other.licensedMovies || []).filter(l => !idsSet.has(l.movieId)),
              exclusiveMovieIds: (other.exclusiveMovieIds || []).filter(id => !idsSet.has(id)),
            };
          }
        }
        // Mark each movie as in-this-service-only
        movies = movies.map(m => idsSet.has(m.id) ? { ...m, inStreamingServiceIds: [services[svcIdx].id] } : m);
      } else {
        // Non-exclusive — just append svc id to inStreamingServiceIds for added films
        movies = movies.map(m => o.movieIds.includes(m.id)
          ? { ...m, inStreamingServiceIds: Array.from(new Set([...(m.inStreamingServiceIds || []), services[svcIdx].id])) }
          : m);
      }
    }
  }
  offers[idx] = { ...o, status: 'accepted', message: `Closed at $${o.priceB.toFixed(2)}B${o.exclusivity ? ' EXCLUSIVE' : ''}.` };
  const relationships = { ...state.relationships };
  nudgeRelInPlace(relationships, buyerId, sellerId, 3);
  const buyerName = buyerId === state.player.id ? state.player.name : state.rivals.find(r => r.id === buyerId)?.name || '—';
  const sellerName = sellerId === state.player.id ? state.player.name : state.rivals.find(r => r.id === sellerId)?.name || '—';
  const newsLog = [{ week: state.week, year: state.year, text: `📀 ${buyerName} licenses ${o.movieIds.length} ${sellerName} titles${o.exclusivity ? ' (EXCLUSIVE)' : ''} for $${o.priceB.toFixed(2)}B / ${o.years}yr.` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, player, rivals, movies, streamingServices: services, bulkCatalogOffers: offers, relationships, newsLog } };
}

// =====================================================================
// BACKGROUND AI↔AI TRADES & AI→PLAYER INBOUND OFFERS
// =====================================================================
function aiBackgroundTrades(state: GameState): GameState {
  let s = state;
  // 1) AI → AI franchise trade (small chance per rival per week).
  for (const seller of s.rivals) {
    if (Math.random() > 0.015) continue;
    const sellerFr = s.franchises.filter(f => f.studioId === seller.id);
    if (sellerFr.length < 2) continue; // won't sell its last franchise
    const fr = pick(sellerFr);
    const fair = quoteFranchiseValue(s, fr.id);
    // Pick an affordable rival buyer
    const candidates = s.rivals.filter(r => r.id !== seller.id && r.cash >= fair * 0.9);
    if (!candidates.length) continue;
    const buyer = pick(candidates);
    // Execute silently at ~fair ±5%
    const price = +(fair * (0.95 + Math.random() * 0.15)).toFixed(2);
    const rivalsCopy = s.rivals.slice();
    const si = rivalsCopy.findIndex(r => r.id === seller.id);
    const bi = rivalsCopy.findIndex(r => r.id === buyer.id);
    if (si < 0 || bi < 0) continue;
    rivalsCopy[si] = { ...rivalsCopy[si], cash: +(rivalsCopy[si].cash + price).toFixed(3) };
    rivalsCopy[bi] = { ...rivalsCopy[bi], cash: +(rivalsCopy[bi].cash - price).toFixed(3) };
    const franchises = s.franchises.map(f => f.id === fr.id ? { ...f, studioId: buyer.id } : f);
    const movies = s.movies.map(m => m.franchiseId === fr.id ? { ...m, studioId: buyer.id } : m);
    const news = [{ week: s.week, year: s.year, text: `🏛 ${seller.name} sells ${fr.name} to ${buyer.name} for $${price}B.` }, ...s.newsLog].slice(0, 100);
    s = { ...s, rivals: rivalsCopy, franchises, movies, newsLog: news };
  }
  // 2) AI → Player: buy offer on one of player's franchises (rare).
  const playerFr = s.franchises.filter(f => f.studioId === s.player.id);
  if (playerFr.length > 0 && Math.random() < 0.015) {
    const fr = pick(playerFr);
    const fair = quoteFranchiseValue(s, fr.id);
    const bidders = s.rivals.filter(r => r.cash >= fair * 0.7 && r.rating >= 2);
    if (bidders.length) {
      const bidder = pick(bidders);
      const offerPrice = +(fair * (0.85 + Math.random() * 0.2)).toFixed(2);
      const offer: FranchiseOffer = {
        id: uid('fo_'), kind: 'buy',
        franchiseId: fr.id, fromStudioId: bidder.id, toStudioId: s.player.id,
        priceB: offerPrice, round: 0, maxRounds: 3, lastActor: 'from', status: 'pending',
        createdWeek: s.week, createdYear: s.year,
        message: `"${bidder.name} wants to acquire ${fr.name}. $${offerPrice}B on the table."`,
        history: [{ actor: 'from', priceB: offerPrice, week: s.week, year: s.year }],
      };
      s = { ...s, franchiseOffers: [...(s.franchiseOffers || []), offer] };
    }
  }
  // 3) AI → Player: AI wants to buy a BUNDLE from player's released catalog (for their own streaming).
  if (Math.random() < 0.015) {
    const playerReleased = s.movies.filter(m => m.studioId === s.player.id && m.status === 'released');
    if (playerReleased.length >= 3) {
      const rival = pick(s.rivals.filter(r => (s.streamingServices || []).some(svc => svc.studioId === r.id)));
      if (rival) {
        const svc = (s.streamingServices || []).find(sv => sv.studioId === rival.id);
        if (svc) {
          const n = Math.min(playerReleased.length, randInt(3, 6));
          const picked: Movie[] = [];
          const pool = [...playerReleased];
          for (let i = 0; i < n && pool.length; i++) {
            const ix = Math.floor(Math.random() * pool.length);
            picked.push(pool[ix]); pool.splice(ix, 1);
          }
          const years = randInt(2, 5);
          const fair = quoteBulkCatalogValue(s, picked.map(m => m.id), years);
          const offerPrice = +(fair * (0.8 + Math.random() * 0.2)).toFixed(3);
          const offer: BulkCatalogOffer = {
            id: uid('bco_'),
            fromStudioId: rival.id, toStudioId: s.player.id,
            movieIds: picked.map(m => m.id), priceB: offerPrice, years,
            serviceId: svc.id,
            round: 0, maxRounds: 3, lastActor: 'from', status: 'pending',
            createdWeek: s.week, createdYear: s.year,
            message: `"${rival.name} wants a ${n}-title catalog pack for ${svc.name}. $${offerPrice}B / ${years}yr."`,
            history: [{ actor: 'from', priceB: offerPrice, week: s.week, year: s.year }],
          };
          s = { ...s, bulkCatalogOffers: [...(s.bulkCatalogOffers || []), offer] };
        }
      }
    }
  }
  return s;
}

export function tickWeek(state: GameState): GameState {
  let s = simulateWeek(state);
  s = spawnFestivalIfDue(s);
  s = aiFestivalTick(s);
  s = resolveFestivalLots(s);
  // External IP licensing: roll a weekly chance to spawn an inbound offer or outbound bid.
  // Cap pending offers to avoid backlog.
  const pendingOffers = (s.externalIPOffers || []).filter(o => o.status === 'pending').length;
  if (pendingOffers < 4 && Math.random() < 0.18) s = generateInboundIPOffer(s);
  const pendingBids = (s.outboundIPBids || []).filter(b => b.status === 'pending').length;
  if (pendingBids < 4 && Math.random() < 0.22) s = generateOutboundBid(s);
  s = processOutboundRoyalties(s);
  return s;
}

// =====================================================================
// FESTIVALS — spawn, auction, bidding
// =====================================================================

function spawnFestivalIfDue(state: GameState): GameState {
  const existing = state.festivals || [];
  const tpl = FESTIVAL_TEMPLATES.find(t => t.week === state.week);
  if (!tpl) return state;
  // Already spawned this year?
  if (existing.find(f => f.name === tpl.name && f.year === state.year)) return state;
  // Generate 3 indie AI-produced lots (budget < 200M, released recently ideally). Build synthetic indie movies.
  const lots: FestivalLot[] = [];
  const rivals = state.rivals;
  for (let i = 0; i < 3; i++) {
    const studio = pick(rivals);
    const genre = pick(GENRES);
    const runtime = randInt(85, 135);
    const availablePool = state.talents.filter(t => !t.retired && !t.inProductionMovieId);
    const wr = availablePool.filter(t => t.role === 'writer')[0] || state.talents.find(t => t.role === 'writer');
    const dir = availablePool.filter(t => t.role === 'director')[0] || state.talents.find(t => t.role === 'director');
    const actor = availablePool.find(t => t.role === 'actor') || state.talents.find(t => t.role === 'actor');
    const actress = availablePool.find(t => t.role === 'actress') || state.talents.find(t => t.role === 'actress');
    if (!wr || !dir || !actor || !actress) continue;
    const budget = randInt(15, 90);
    const usedTitles = new Set([...state.movies.map(m => m.title), ...state.franchises.map(f => f.name)]);
    const fname = genFranchiseName(usedTitles);
    // The AI studio owns this already-made film.
    const movie: Movie = {
      id: uid('mfest_'), title: fname, type: genre as any, genre,
      plotArc: pick(['Man in a Hole', 'Icarus', 'Cinderella'] as any),
      rating: pick(['PG-13', 'R', 'PG'] as any), runtime, brand: 'Original',
      franchiseId: undefined,
      studioId: studio.id, writerId: wr.id, directorId: dir.id,
      cast: [
        { talentId: actor.id, role: 'lead_actor', dealType: 'middle', contractKind: 'single', salary: actor.salary, boPercent: 2 },
        { talentId: actress.id, role: 'lead_actress', dealType: 'middle', contractKind: 'single', salary: actress.salary, boPercent: 2 },
      ],
      budget, marketingBudget: Math.round(budget * 0.4), weeksToRelease: 0,
      status: 'released', criticScore: randInt(65, 92), boxOffice: 0, weeklyBO: [],
      releaseWeek: state.week, releaseYear: state.year,
      iconKey: GENRE_ICON[genre].icon, iconBg: GENRE_ICON[genre].bg,
      awards: 0, plot: genPlot(),
      fatiguePenalty: 0, chemistryBonus: 0, holidayBonus: 0,
      releaseStrategy: 'theatrical', inStreamingServiceIds: [],
      reviews: generateReviews(80),
    };
    lots.push({
      id: uid('lot_'), movieId: movie.id,
      startingBidM: +(budget * 1.2).toFixed(1),
      currentBidM: +(budget * 1.2).toFixed(1),
      currentBidderStudioId: null, bidLog: [], sold: false,
    });
    // Add the indie movie to world movie list so it has detail pages
    state = { ...state, movies: [...state.movies, movie] };
  }

  const fest: Festival = {
    id: uid('fest_'), name: tpl.name, season: tpl.season, region: tpl.region,
    week: state.week, year: state.year, status: 'active', lots,
  };
  const newsLog = [{ week: state.week, year: state.year, text: `🎬 ${tpl.name} opens in ${tpl.region} — 3 indie titles up for auction.` }, ...state.newsLog].slice(0, 100);
  return { ...state, festivals: [...existing, fest], newsLog };
}

// Player submits a bid on a festival lot. Must exceed currentBid by at least 1M and have cash.
export function placeFestivalBid(state: GameState, festivalId: string, lotId: string, bidM: number): { state: GameState; error?: string } {
  const fests = state.festivals || [];
  const fIdx = fests.findIndex(f => f.id === festivalId);
  if (fIdx < 0) return { state, error: 'Festival not found.' };
  const fest = fests[fIdx];
  if (fest.status !== 'active') return { state, error: 'Festival is closed.' };
  const lIdx = fest.lots.findIndex(l => l.id === lotId);
  if (lIdx < 0) return { state, error: 'Lot not found.' };
  const lot = fest.lots[lIdx];
  if (lot.sold) return { state, error: 'Lot already sold.' };
  if (bidM < lot.currentBidM + 1) return { state, error: `Minimum raise is $1M. Bid at least $${(lot.currentBidM + 1).toFixed(1)}M.` };
  const bidB = bidM / 1000;
  if (state.player.cash < bidB) return { state, error: `Need $${bidM.toFixed(1)}M cash (have $${(state.player.cash * 1000).toFixed(1)}M).` };
  const updatedLot: FestivalLot = {
    ...lot, currentBidM: +bidM.toFixed(1), currentBidderStudioId: state.player.id,
    bidLog: [...lot.bidLog, { studioId: state.player.id, amountM: +bidM.toFixed(1), week: state.week, year: state.year }],
  };
  // AI counter: each AI studio may outbid with a probability scaled by rating and cash. Only one AI bids per round.
  let finalLot = updatedLot;
  const rivalsWillingness = state.rivals
    .filter(r => r.cash * 1000 > bidM * 1.1)
    .map(r => ({ r, score: r.rating * Math.random() + Math.random() }))
    .sort((a, b) => b.score - a.score);
  if (rivalsWillingness.length && Math.random() < 0.65) {
    const contender = rivalsWillingness[0].r;
    const raise = +(bidM * (1.05 + Math.random() * 0.12)).toFixed(1);
    finalLot = {
      ...finalLot, currentBidM: raise, currentBidderStudioId: contender.id,
      bidLog: [...finalLot.bidLog, { studioId: contender.id, amountM: raise, week: state.week, year: state.year }],
    };
  }
  const festivals = fests.slice();
  festivals[fIdx] = { ...fest, lots: fest.lots.map((l, i) => i === lIdx ? finalLot : l) };
  return { state: { ...state, festivals } };
}

// Close a festival lot — award to the highest bidder. Called 3 weeks after festival opens.
function resolveFestivalLots(state: GameState): GameState {
  const fests = state.festivals || [];
  let movies = state.movies.slice();
  let player = { ...state.player };
  let rivals = state.rivals.slice();
  const news: typeof state.newsLog = [];
  const updatedFests = fests.map(fest => {
    if (fest.status !== 'active') return fest;
    const weeksOld = (state.year - fest.year) * WEEKS_PER_YEAR + (state.week - fest.week);
    if (weeksOld < 3) return fest;
    // Close: finalize each lot
    const lots = fest.lots.map(l => {
      if (l.sold) return l;
      const winner = l.currentBidderStudioId;
      if (!winner) return { ...l, sold: true }; // unsold
      const movie = movies.find(m => m.id === l.movieId);
      if (!movie) return { ...l, sold: true };
      const priceB = l.currentBidM / 1000;
      if (winner === player.id) {
        if (player.cash < priceB) return { ...l, sold: true };
        player = { ...player, cash: +(player.cash - priceB).toFixed(3) };
        // Transfer ownership to player
        movies = movies.map(m => m.id === movie.id ? { ...m, studioId: player.id, festivalLotId: l.id } : m);
        news.push({ week: state.week, year: state.year, text: `🏆 ${player.name} wins ${movie.title} at ${fest.name} ($${l.currentBidM.toFixed(1)}M).` });
      } else {
        const rIdx = rivals.findIndex(r => r.id === winner);
        if (rIdx >= 0 && rivals[rIdx].cash >= priceB) {
          rivals[rIdx] = { ...rivals[rIdx], cash: +(rivals[rIdx].cash - priceB).toFixed(3) };
          movies = movies.map(m => m.id === movie.id ? { ...m, studioId: winner, festivalLotId: l.id } : m);
          news.push({ week: state.week, year: state.year, text: `${rivals[rIdx].name} wins ${movie.title} at ${fest.name} ($${l.currentBidM.toFixed(1)}M).` });
        }
      }
      return { ...l, sold: true, winnerStudioId: winner, finalPriceM: l.currentBidM };
    });
    return { ...fest, status: 'concluded' as const, lots, closedAt: { week: state.week, year: state.year } };
  });
  const newsLog = [...news, ...state.newsLog].slice(0, 100);
  return { ...state, festivals: updatedFests, movies, player, rivals, newsLog };
}

// =====================================================================
// CINEMAS — deal generation & signing
// =====================================================================

// Player signs a cinema deal at the specified terms. Terms must be within negotiation range.
export function signCinemaDeal(state: GameState, chainId: string, years: number, openShare: number, lateShare: number): { state: GameState; error?: string } {
  const chain = CINEMA_CHAINS.find(c => c.id === chainId);
  if (!chain) return { state, error: 'Chain not found.' };
  // Reject if a non-expired deal with this chain already exists for the player.
  const existing = (state.cinemaDeals || []).find(d => d.chainId === chainId && d.studioId === state.player.id && (d.expiresYear * WEEKS_PER_YEAR + d.expiresWeek) > (state.year * WEEKS_PER_YEAR + state.week));
  if (existing) return { state, error: `You already have an active deal with ${chain.name}.` };
  if (years < 5 || years > 10) return { state, error: 'Deal length must be 5–10 years.' };
  const range = cinemaDealRange(chain.reputation, state.player.rating);
  if (openShare < range.minOpen || openShare > range.maxOpen) return { state, error: `Opening share must be between ${(range.minOpen * 100).toFixed(0)}–${(range.maxOpen * 100).toFixed(0)}%.` };
  if (lateShare < range.minLate || lateShare > range.maxLate) return { state, error: `Late share must be between ${(range.minLate * 100).toFixed(0)}–${(range.maxLate * 100).toFixed(0)}%.` };

  // Acceptance probability: harder deals (more studio-favoured) reduce chance.
  const openPos = (openShare - range.minOpen) / (range.maxOpen - range.minOpen || 1); // 0 = easy, 1 = tough
  const latePos = (lateShare - range.minLate) / (range.maxLate - range.minLate || 1);
  const pAccept = 1 - (openPos * 0.4 + latePos * 0.3);
  if (Math.random() > pAccept) {
    const newsLog = [{ week: state.week, year: state.year, text: `${chain.name} rejects ${state.player.name}'s cinema terms (too studio-favoured).` }, ...state.newsLog].slice(0, 100);
    return { state: { ...state, newsLog }, error: `${chain.name} rejected. Terms too aggressive.` };
  }

  const expW = state.week;
  const expY = state.year + years;
  const deal: CinemaDeal = {
    id: uid('cd_'), chainId: chain.id, studioId: state.player.id, region: chain.region as CinemaRegion, years,
    signedWeek: state.week, signedYear: state.year, expiresWeek: expW, expiresYear: expY,
    openingStudioShare: +openShare.toFixed(3), lateStudioShare: +lateShare.toFixed(3),
    guaranteedTheaters: Math.round(chain.theaters * (0.55 + state.player.rating * 0.07)),
  };
  const cinemaDeals = [...(state.cinemaDeals || []), deal];
  const newsLog = [{ week: state.week, year: state.year, text: `${state.player.name} signs a ${years}-year deal with ${chain.name} (${chain.region}) — opening ${(openShare * 100).toFixed(0)}% / late ${(lateShare * 100).toFixed(0)}%.` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, cinemaDeals, newsLog } };
}

// Average cinema-share modifier the player gets on a movie release given their active deals.
// If no deals: return a default 0.55 open / 0.35 late to simulate weak distribution.
export function playerCinemaShareForWeek(state: GameState, weekIdx: number): number {
  const deals = (state.cinemaDeals || []).filter(d => {
    if (d.studioId !== state.player.id) return false;
    const endTotal = d.expiresYear * WEEKS_PER_YEAR + d.expiresWeek;
    const nowTotal = state.year * WEEKS_PER_YEAR + state.week;
    return endTotal >= nowTotal;
  });
  if (!deals.length) return cinemaStudioShareForWeek(weekIdx, 0.55, 0.35);
  const avgOpen = deals.reduce((a, d) => a + d.openingStudioShare, 0) / deals.length;
  const avgLate = deals.reduce((a, d) => a + d.lateStudioShare, 0) / deals.length;
  return cinemaStudioShareForWeek(weekIdx, avgOpen, avgLate);
}

// =====================================================================
// PLAYER-WRITABLE MOVIE DESCRIPTION
// =====================================================================
export function setMovieDescription(state: GameState, movieId: string, description: string): { state: GameState; error?: string } {
  const movie = state.movies.find(m => m.id === movieId);
  if (!movie) return { state, error: 'Movie not found.' };
  if (movie.studioId !== state.player.id) return { state, error: 'Not your movie.' };
  const movies = state.movies.map(m => m.id === movieId ? { ...m, userDescription: description } : m);
  return { state: { ...state, movies } };
}


// =====================================================================
// EXTERNAL IP LICENSING — INBOUND (licensors offer IPs to studios)
// =====================================================================
export interface IPOfferTerms { ipId: string; feeM: number; boPercent: number; merchPercent: number; years: number; packs: number; exclusivity: boolean; sublicensable: boolean; }
export function quoteIPOffer(state: GameState, ipId: string, terms: Omit<IPOfferTerms, 'ipId'>): { feeM: number; error?: string } {
  const ip = (state.externalIPs || []).find(i => i.id === ipId);
  if (!ip) return { feeM: 0, error: 'IP not found.' };
  return { feeM: quoteIPLicenseFee(ip, terms) };
}

// Generate one inbound IP offer, targeting the player. Called periodically by tickWeek.
export function generateInboundIPOffer(state: GameState): GameState {
  const ips = (state.externalIPs || []).filter(ip => !ip.exclusiveLicenseeStudioId);
  if (!ips.length) return state;
  // Skip IPs the player already has an active license on (don't double-up).
  const myActive = (state.ownedIPLicenses || []).filter(l => l.studioId === state.player.id);
  const myActiveIpIds = new Set(myActive.map(l => l.ipId));
  const candidates = ips.filter(ip => !myActiveIpIds.has(ip.id));
  if (!candidates.length) return state;
  const ip = candidates[randInt(0, candidates.length - 1)];
  const licensor = (state.externalLicensors || []).find(l => l.id === ip.licensorId);
  if (!licensor) return state;

  // AI proposes terms scaled to the IP's popularity.
  const years = randInt(2, 6);
  const packs = randInt(1, 4);
  const exclusivity = ip.popularity >= 70 ? Math.random() < 0.4 : Math.random() < 0.2;
  const sublicensable = Math.random() < 0.25;
  const boPercent = +(2 + Math.random() * 6).toFixed(1);   // 2–8%
  const merchPercent = +(8 + Math.random() * 14).toFixed(1); // 8–22%
  const feeM = quoteIPLicenseFee(ip, { years, packs, boPercent, merchPercent, exclusivity, sublicensable });

  const offer: import('./types').ExternalIPOffer = {
    id: uid('ipo_'),
    fromStudioId: licensor.id, // store licensor in fromStudioId
    toStudioId: state.player.id,
    round: 0, maxRounds: 3,
    lastActor: 'from',
    status: 'pending',
    createdWeek: state.week, createdYear: state.year,
    history: [{ actor: 'from', priceB: feeM / 1000, week: state.week, year: state.year }],
    ipId: ip.id,
    feeM, boPercent, merchPercent, years, packs, exclusivity, sublicensable,
  };
  const news = [{ week: state.week, year: state.year, text: `📜 ${licensor.name} offers ${state.player.name} the ${ip.name} IP rights — ${packs} films / ${years}y / $${feeM.toFixed(1)}M.` }, ...state.newsLog].slice(0, 100);
  return { ...state, externalIPOffers: [...(state.externalIPOffers || []), offer], newsLog: news };
}

export function counterIPOffer(state: GameState, offerId: string, counter: { feeM?: number; boPercent?: number; merchPercent?: number; years?: number; packs?: number; exclusivity?: boolean; sublicensable?: boolean }): { state: GameState; error?: string } {
  const offerIdx = (state.externalIPOffers || []).findIndex(o => o.id === offerId);
  if (offerIdx < 0) return { state, error: 'Offer not found.' };
  const offer = state.externalIPOffers![offerIdx];
  if (offer.status !== 'pending') return { state, error: 'Offer not pending.' };
  // Apply counter (player→licensor) and run AI auto-evaluation.
  const newTerms = {
    feeM: counter.feeM ?? offer.feeM,
    boPercent: counter.boPercent ?? offer.boPercent,
    merchPercent: counter.merchPercent ?? offer.merchPercent,
    years: counter.years ?? offer.years,
    packs: counter.packs ?? offer.packs,
    exclusivity: counter.exclusivity ?? offer.exclusivity,
    sublicensable: counter.sublicensable ?? offer.sublicensable,
  };
  const ip = state.externalIPs!.find(i => i.id === offer.ipId)!;
  const fairFee = quoteIPLicenseFee(ip, newTerms);
  // AI accepts if player's fee ≥ 88% of fair AND BO/merch within 1.5pp of fair.
  const playerFairBo = 2 + (ip.popularity / 100) * 5;
  const playerFairMerch = 8 + (ip.popularity / 100) * 12;
  const aiHappy = newTerms.feeM >= fairFee * 0.88 && newTerms.boPercent >= playerFairBo - 1.5 && newTerms.merchPercent >= playerFairMerch - 2;
  const offers = state.externalIPOffers!.slice();
  if (aiHappy) {
    offers[offerIdx] = { ...offer, ...newTerms, status: 'pending', round: offer.round + 1, lastActor: 'to', history: [...offer.history, { actor: 'to', priceB: newTerms.feeM / 1000, week: state.week, year: state.year }] };
    return { state: { ...state, externalIPOffers: offers, newsLog: [{ week: state.week, year: state.year, text: `📜 ${ip.name} licensor agrees to revised terms — accept to finalise.` }, ...state.newsLog].slice(0, 100) } };
  } else {
    // AI counters back: split the difference toward fair price.
    const aiCounter = {
      ...newTerms,
      feeM: +((newTerms.feeM + fairFee) / 2).toFixed(1),
      boPercent: +((newTerms.boPercent + playerFairBo) / 2).toFixed(1),
      merchPercent: +((newTerms.merchPercent + playerFairMerch) / 2).toFixed(1),
    };
    offers[offerIdx] = { ...offer, ...aiCounter, status: 'pending', round: offer.round + 2, lastActor: 'from', history: [...offer.history, { actor: 'to', priceB: newTerms.feeM / 1000, week: state.week, year: state.year }, { actor: 'from', priceB: aiCounter.feeM / 1000, week: state.week, year: state.year }] };
    return { state: { ...state, externalIPOffers: offers } };
  }
}

export function acceptIPOffer(state: GameState, offerId: string): { state: GameState; error?: string } {
  const offerIdx = (state.externalIPOffers || []).findIndex(o => o.id === offerId);
  if (offerIdx < 0) return { state, error: 'Offer not found.' };
  const offer = state.externalIPOffers![offerIdx];
  if (offer.status !== 'pending') return { state, error: 'Offer not pending.' };
  if (state.player.cash * 1000 < offer.feeM) return { state, error: `Need $${offer.feeM.toFixed(1)}M cash (have $${(state.player.cash * 1000).toFixed(1)}M).` };
  const ip = state.externalIPs!.find(i => i.id === offer.ipId)!;
  const license: import('./types').OwnedIPLicense = {
    id: uid('ipl_'),
    ipId: ip.id,
    studioId: state.player.id,
    feePaidM: offer.feeM,
    boPercent: offer.boPercent,
    merchPercent: offer.merchPercent,
    signedWeek: state.week, signedYear: state.year,
    expiresWeek: state.week, expiresYear: state.year + offer.years,
    packs: offer.packs, packsUsed: 0,
    exclusivity: offer.exclusivity, sublicensable: offer.sublicensable,
  };
  const offers = state.externalIPOffers!.slice();
  offers[offerIdx] = { ...offer, status: 'accepted' };
  let externalIPs = state.externalIPs!;
  if (offer.exclusivity) {
    externalIPs = externalIPs.map(i => i.id === ip.id ? { ...i, exclusiveLicenseeStudioId: state.player.id } : i);
  }
  const updatedPlayer = { ...state.player, cash: +(state.player.cash - offer.feeM / 1000).toFixed(3) };
  const news = [{ week: state.week, year: state.year, text: `✅ ${state.player.name} licenses ${ip.name} from ${state.externalLicensors!.find(l => l.id === ip.licensorId)?.name} — ${offer.packs} films / ${offer.years}y${offer.exclusivity ? ' (EXCLUSIVE)' : ''}.` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, externalIPOffers: offers, externalIPs, ownedIPLicenses: [...(state.ownedIPLicenses || []), license], player: updatedPlayer, newsLog: news } };
}

export function rejectIPOffer(state: GameState, offerId: string): { state: GameState } {
  const offers = (state.externalIPOffers || []).map(o => o.id === offerId ? { ...o, status: 'rejected' as const } : o);
  return { state: { ...state, externalIPOffers: offers } };
}

// =====================================================================
// EXTERNAL IP LICENSING — OUTBOUND (player lists franchise/movie for spin-offs)
// =====================================================================
export function createOutboundIPListing(state: GameState, args: { sourceFranchiseId?: string; sourceMovieId?: string; category: import('./types').IPCategory }): { state: GameState; error?: string; listingId?: string } {
  if (!args.sourceFranchiseId && !args.sourceMovieId) return { state, error: 'Pick a franchise or movie.' };
  if (args.sourceFranchiseId) {
    const fr = state.franchises.find(f => f.id === args.sourceFranchiseId);
    if (!fr) return { state, error: 'Franchise not found.' };
    if (fr.studioId !== state.player.id) return { state, error: 'Only your own franchise can be listed.' };
  }
  if (args.sourceMovieId) {
    const m = state.movies.find(mm => mm.id === args.sourceMovieId);
    if (!m) return { state, error: 'Movie not found.' };
    if (m.studioId !== state.player.id) return { state, error: 'Only your own movie can be listed.' };
  }
  const listing: import('./types').OutboundIPListing = {
    id: uid('out_'),
    studioId: state.player.id,
    sourceFranchiseId: args.sourceFranchiseId,
    sourceMovieId: args.sourceMovieId,
    category: args.category,
    status: 'open',
    createdWeek: state.week, createdYear: state.year,
  };
  const news = [{ week: state.week, year: state.year, text: `📤 ${state.player.name} lists IP for ${args.category} spin-offs — bids invited.` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, outboundIPListings: [...(state.outboundIPListings || []), listing], newsLog: news }, listingId: listing.id };
}

export function generateOutboundBid(state: GameState): GameState {
  const open = (state.outboundIPListings || []).filter(l => l.status === 'open');
  if (!open.length) return state;
  // Pick a random open listing
  const listing = open[randInt(0, open.length - 1)];
  // Find a licensor in the same category
  const matchingLicensors = (state.externalLicensors || []).filter(l => l.category === listing.category);
  if (!matchingLicensors.length) return state;
  const licensor = matchingLicensors[randInt(0, matchingLicensors.length - 1)];
  // Compute source attractiveness
  let popBase = 50;
  if (listing.sourceFranchiseId) {
    const fr = state.franchises.find(f => f.id === listing.sourceFranchiseId);
    if (fr) popBase = fr.popularity;
  } else if (listing.sourceMovieId) {
    const m = state.movies.find(mm => mm.id === listing.sourceMovieId);
    if (m) popBase = Math.min(95, 30 + Math.min(60, m.boxOffice * 12) + (m.criticScore || 60) * 0.2);
  }
  const years = randInt(2, 6);
  const feeM = +((popBase / 100) * 30 * (1 + (years - 1) * 0.18) * (licensor.reputation / 80)).toFixed(1);
  const royaltyPercent = +(2 + Math.random() * 6).toFixed(1);
  const bid: import('./types').OutboundIPBid = {
    id: uid('bid_'),
    listingId: listing.id,
    licensorId: licensor.id,
    feeM, royaltyPercent, years,
    status: 'pending',
    createdWeek: state.week, createdYear: state.year,
  };
  const news = [{ week: state.week, year: state.year, text: `📥 ${licensor.name} bids on your IP listing — $${feeM.toFixed(1)}M + ${royaltyPercent}% royalty / ${years}y.` }, ...state.newsLog].slice(0, 100);
  return { ...state, outboundIPBids: [...(state.outboundIPBids || []), bid], newsLog: news };
}

export function acceptOutboundBid(state: GameState, bidId: string): { state: GameState; error?: string } {
  const bid = (state.outboundIPBids || []).find(b => b.id === bidId);
  if (!bid) return { state, error: 'Bid not found.' };
  if (bid.status !== 'pending') return { state, error: 'Bid not pending.' };
  const listing = (state.outboundIPListings || []).find(l => l.id === bid.listingId);
  if (!listing) return { state, error: 'Listing not found.' };
  // Pay upfront fee, set up royalty queue
  const updatedPlayer = { ...state.player, cash: +(state.player.cash + bid.feeM / 1000).toFixed(3) };
  // Royalty: paid quarterly; estimate per-payment as feeM × royalty% / 4 each quarter for `years`.
  const perPaymentM = +((bid.feeM * bid.royaltyPercent / 100) / 4).toFixed(2);
  const royEntry = {
    bidId: bid.id,
    nextPayWeek: Math.min(WEEKS_PER_YEAR, state.week + 13),
    nextPayYear: state.year,
    perPaymentM,
    expiresWeek: state.week, expiresYear: state.year + bid.years,
  };
  // Update bids: this one accepted, others on same listing rejected.
  const bids = (state.outboundIPBids || []).map(b => {
    if (b.id === bid.id) return { ...b, status: 'accepted' as const };
    if (b.listingId === bid.listingId && b.status === 'pending') return { ...b, status: 'rejected' as const };
    return b;
  });
  const listings = (state.outboundIPListings || []).map(l => l.id === listing.id ? { ...l, status: 'closed' as const } : l);
  const queue = [...(state.outboundRoyaltyQueue || []), royEntry];
  const licensor = state.externalLicensors!.find(l => l.id === bid.licensorId);
  const news = [{ week: state.week, year: state.year, text: `✅ Sold ${listing.category} rights to ${licensor?.name} — $${bid.feeM.toFixed(1)}M + ${bid.royaltyPercent}% royalty.` }, ...state.newsLog].slice(0, 100);
  return { state: { ...state, outboundIPBids: bids, outboundIPListings: listings, outboundRoyaltyQueue: queue, player: updatedPlayer, newsLog: news } };
}

export function rejectOutboundBid(state: GameState, bidId: string): { state: GameState } {
  const bids = (state.outboundIPBids || []).map(b => b.id === bidId ? { ...b, status: 'rejected' as const } : b);
  return { state: { ...state, outboundIPBids: bids } };
}

// Process royalty payments weekly.
export function processOutboundRoyalties(state: GameState): GameState {
  const q = state.outboundRoyaltyQueue || [];
  if (!q.length) return state;
  const nowTotal = state.year * WEEKS_PER_YEAR + state.week;
  let cashAdd = 0;
  const news: { week: number; year: number; text: string }[] = [];
  const updated = q.map((e: any) => {
    const dueTotal = e.nextPayYear * WEEKS_PER_YEAR + e.nextPayWeek;
    if (dueTotal > nowTotal) return e;
    const expTotal = e.expiresYear * WEEKS_PER_YEAR + e.expiresWeek;
    if (dueTotal > expTotal) return null; // expired
    cashAdd += e.perPaymentM;
    news.push({ week: state.week, year: state.year, text: `💵 IP royalty payment received: $${e.perPaymentM.toFixed(2)}M.` });
    // Schedule next quarterly payment (~13 weeks)
    let nw = e.nextPayWeek + 13, ny = e.nextPayYear;
    while (nw > WEEKS_PER_YEAR) { nw -= WEEKS_PER_YEAR; ny += 1; }
    return { ...e, nextPayWeek: nw, nextPayYear: ny };
  }).filter((x: any) => x !== null) as typeof q;
  if (cashAdd === 0 && updated.length === q.length) return state;
  const player = { ...state.player, cash: +(state.player.cash + cashAdd / 1000).toFixed(3) };
  return { ...state, player, outboundRoyaltyQueue: updated, newsLog: [...news, ...state.newsLog].slice(0, 100) };
}

