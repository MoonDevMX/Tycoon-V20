export type Role = 'writer' | 'director' | 'actor' | 'actress';
// Cast slot designation inside a Movie. Distinct from Talent.role which is now gender-collapsed.
// A 'lead_actor'/'support_actor' slot is filled by a Talent with role='actor';
// a 'lead_actress'/'support_actress' slot is filled by a Talent with role='actress'.
export type CastRole = 'lead_actor' | 'lead_actress' | 'support_actor' | 'support_actress';

export type MovieType = 'Action' | 'Drama' | 'Comedy' | 'Horror' | 'Sci-Fi' | 'Romance' | 'Thriller' | 'Animation' | 'Fantasy' | 'Mystery';
export type Genre = MovieType;
export type PlotArc = 'Man in a Hole' | 'Rags to Riches' | 'Icarus' | 'Cinderella' | 'Oedipus' | 'Riches to Rags';
export type Rating = 'G' | 'PG' | 'PG-13' | 'R';
export type Brand = 'Original' | 'Sequel' | 'Prequel' | 'Spinoff' | 'Crossover';
export type MovieStatus = 'production' | 'released';
export type ColorTrait = 'red' | 'blue' | 'yellow' | 'purple' | 'green' | 'orange';
export type Gender = 'male' | 'female';
export type Relationship = 'rival' | 'neutral' | 'friend';
export type DealType = 'actor_favored' | 'middle' | 'studio_favored';
export type ContractKind = 'single' | 'pack3' | 'hold5y';
export type HairStyle = 'short' | 'long' | 'curly' | 'wavy' | 'buzz' | 'bun' | 'bald';
export type FacialHair = 'none' | 'mustache' | 'goatee' | 'beard' | 'stubble';
export type ReleaseStrategy = 'theatrical' | 'streaming' | 'hybrid';
export type TierPeriod = 'monthly' | 'quarterly' | 'biannual' | 'yearly';

export interface SubscriptionTier {
  id: string;
  name: string;        // e.g. "Basic" / "Standard" / "Premium" / "Family"
  period: TierPeriod;
  price: number;       // $/period
  screens: number;     // simultaneous screens
  users: number;       // profiles allowed
  isExclusive: boolean;// when true, ONLY movies in `tierMovieIds[tier.id]` (or `exclusiveMovieIds`) are accessible to this tier; otherwise tier sees full catalog
}

export interface LicensedMovie {
  movieId: string;
  expiresWeek: number;
  expiresYear: number;
  tierIds: string[];   // tiers where this licensed title is available; if empty = all tiers
  feePaid: number;     // upfront license fee paid (in $M)
  yearsLicensed: number; // 1, 3, 5, 10
}

export interface StreamingService {
  id: string;
  studioId: string;
  name: string;
  tiers: SubscriptionTier[];
  subscribers: number;          // total active subs across tiers
  tierSubscribers: Record<string, number>; // tierId → sub count
  monthlyRevenue: number;       // last computed monthly run-rate ($M)
  reputation: number;           // 0..100
  catalogMovieIds: string[];    // movie ids included in this service
  launchedYear: number;
  launchedWeek: number;
  history: { week: number; year: number; subscribers: number; revenue: number }[];
  isExclusive?: boolean;        // service-level: when true, ALL catalog gated to top tier
  exclusiveMovieIds?: string[]; // movies in catalog that are gated to top tier(s) only
  // Per-movie tier access map: movieId → tierIds[] that can stream it. Default (missing) = all tiers.
  movieTierAccess?: Record<string, string[]>;
  // Licensed-in titles (from other studios) with expiration dates
  licensedMovies?: LicensedMovie[];
  // Bulk multi-year licensing deals — auto-license rival's future releases.
  bulkLicenseDeals?: BulkLicenseDeal[];
}

export interface BulkLicenseDeal {
  id: string;
  rivalStudioId: string;
  rivalName: string;
  movieCountTotal: number;
  moviesUsed: number;
  signedWeek: number;
  signedYear: number;
  expiresWeek: number;
  expiresYear: number;
  feePaidM: number;
  // OPTIONAL: if set, deal targets a specific franchise (all current + future films
  // of this franchise from the rival auto-license to player's service for the deal term).
  franchiseId?: string;
  // Films awaiting their windowed transfer to player's service after the rival has released them.
  // Each entry contains the eligibility week/year computed at release time based on releaseStrategy:
  //   - theatrical: +8–12 weeks after rival release
  //   - streaming  (rival-exclusive period): +26–52 weeks
  //   - hybrid: +16–32 weeks
  queuedMovies?: { movieId: string; eligibleWeek: number; eligibleYear: number }[];
}

export interface TalentContract {
  studioId: string;
  remainingMovies: number;     // 1, 2, or 3 movies left
  upfrontPaid: number;         // upfront payment in $M
  boPercent: number;           // box office percentage (0-15%)
  perMovieSalary: number;      // calculated per-movie rate
  signedWeek: number;
  signedYear: number;
}

export interface TalentSkillBreakdown {
  // Universal stats (all roles)
  starPower: number;        // 0..100 — was "fame" (alias retained at top-level for compat)
  // Director-only
  directing?: number;
  leadership?: number;
  pacing?: number;
  style?: number;
  // Actor/Actress
  acting?: number;
  range?: number;
  presence?: number;
  accents?: number;
  // Writer
  plot?: number;
  dialogue?: number;
  structure?: number;
  originality?: number;
}

export interface Talent {
  id: string;
  name: string;
  role: Role;
  skill: number;           // legacy composite — kept for back-compat; equals overall avg of skills
  fame: number;
  salary: number;
  movies: number;
  reviewAvg: number;
  totalBO: number;
  avatarColor: string;     // skin
  hairColor: string;
  hairStyle: HairStyle;
  facialHair: FacialHair;
  age: number;             // 22-78
  retired: boolean;
  gender: Gender;
  colorTrait: ColorTrait;  // chemistry with other talents sharing the same color
  growthLog: number[];     // recent fame deltas (last 6)
  underContract?: TalentContract;
  // Granular skills (BOS-style). All optional — back-compat for legacy saves.
  skills?: TalentSkillBreakdown;
  genreSkills?: Partial<Record<MovieType, number>>; // per-genre proficiency 0..100
  // Cooldown: talent unavailable for new productions until this week/year (auto-set 3w post-release)
  availableFromWeek?: number;
  availableFromYear?: number;
  // Lock: which in-production movie they're currently committed to (1 active production at a time)
  inProductionMovieId?: string;
}

export interface Franchise {
  id: string;
  name: string;
  studioId: string;
  movieIds: string[];
  popularity: number;
  iconKey: string;
  iconBg: string;
  lastReleasedWeek: number;
  lastReleasedYear: number;
}

export interface Movie {
  id: string;
  title: string;
  type: MovieType;
  genre: Genre;
  plotArc: PlotArc;
  rating: Rating;
  runtime: number;
  brand: Brand;
  franchiseId?: string;
  parentMovieId?: string;
  crossoverFranchiseIds?: string[];
  studioId: string;
  writerId: string;
  directorId: string;
  cast: { talentId: string; role: CastRole; dealType: DealType; contractKind: ContractKind; salary: number; boPercent: number; roleName?: string; roleDescription?: string }[];
  budget: number;
  marketingBudget: number;
  marketingAllocation?: Record<string, number>; // channelKey → $M allocated
  weeksToRelease: number;
  status: MovieStatus;
  criticScore: number;
  boxOffice: number;
  weeklyBO: number[];
  releaseWeek: number;
  releaseYear: number;
  iconKey: string;
  iconBg: string;
  awards: number;
  plot: string;
  reviews?: { source: string; type: 'audience' | 'critic'; score: number; quote: string }[];
  fatiguePenalty: number;   // -% applied at release (0 if none)
  chemistryBonus: number;   // +% applied at release (cast color chemistry)
  colorBonus?: number;      // legacy alias of chemistryBonus (kept for back-compat)
  holidayBonus: number;     // +% applied at release (0 if none)
  releaseStrategy?: ReleaseStrategy; // theatrical (default) | streaming (exclusive) | hybrid (theatre→streaming)
  streamingWindowWeeks?: number;     // for hybrid: weeks after theatrical release before adding to streaming
  inStreamingServiceIds?: string[];  // services currently carrying this title
  // For streaming-only releases: pre-selected service+tiers chosen at creation. Auto-applied at release.
  streamingTargetServiceId?: string;
  streamingTargetTierIds?: string[];
  // Whether the release date was set by the player (true) or in "hold" status (false → status='production' but weeksToRelease=Infinity).
  onHold?: boolean;
  // Bidding war flag — once a hit rival movie crosses the BO threshold, news event is fired only once.
  biddingWarFired?: boolean;
  // Target release date (the player picks this in create-movie). Auto-fallback to weeksToRelease if absent.
  targetReleaseWeek?: number;
  targetReleaseYear?: number;
  // Set by player in Movie Details → description editor (overrides procedural `plot` when present)
  userDescription?: string;
  // Festival lot reference — if this movie was sold at a festival, tie-back for UI.
  festivalLotId?: string;
}

export interface Studio {
  id: string;
  name: string;
  logoBg: string;
  logoIcon: string;
  cash: number;
  totalBO: number;
  releases: number;
  awards: number;
  rating: number;
  isPlayer: boolean;
}

export interface AudienceSegment {
  label: string;            // e.g. "Male 18-35"
  share: number;            // 0..1
  preferredColor: ColorTrait;
  preferredGenres: Genre[];
}

export interface GameState {
  initialized: boolean;
  week: number;             // 1..48
  year: number;
  player: Studio;
  rivals: Studio[];
  movies: Movie[];
  talents: Talent[];
  franchises: Franchise[];
  audience: AudienceSegment[];
  newsLog: { week: number; year: number; text: string }[];
  // Pairwise studio relationship score, key = relKey(idA, idB), -100 (rival) .. +100 (friend)
  relationships: Record<string, number>;
  // Streaming services launched by studios in the world
  streamingServices: StreamingService[];
  // Stored awards record per ceremony year — used by Awards page + Trends
  awardsLog?: AwardCeremony[];
  // Yearly genre BO totals — used by Trends page
  genreYearlyBO?: Record<number, Partial<Record<Genre, number>>>;
  // Yearly audience preferred genre snapshot — used by Trends page
  audienceYearlySnapshot?: Record<number, { label: string; preferredGenres: Genre[]; preferredColor: ColorTrait }[]>;
  // Pending license offers from AI streaming services (NEW)
  pendingOffers?: LicenseOffer[];
  // NEW: Franchise buy/sell trade offers (both directions). Pull-and-push rounds.
  franchiseOffers?: FranchiseOffer[];
  // NEW: Bulk catalog licensing offers (existing movies, pay once for N titles for M years).
  bulkCatalogOffers?: BulkCatalogOffer[];
  // Festivals scheduled / in progress / archived (NEW)
  festivals?: Festival[];
  // Cinema distribution deals per region (player-only tracked; AI implicit) (NEW)
  cinemaDeals?: CinemaDeal[];
}

// Shared negotiation primitive: every trade offer has a round counter so we can
// cap back-and-forth push-and-pull (default 3 rounds each side).
export interface BaseTradeOffer {
  id: string;
  fromStudioId: string;   // party that initiated the offer
  toStudioId: string;     // counterparty
  round: number;          // 0 = initial, +1 each counter
  maxRounds: number;      // default 3
  lastActor: 'from' | 'to';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdWeek: number;
  createdYear: number;
  message?: string;
  history: { actor: 'from' | 'to'; priceB: number; week: number; year: number }[];
}

export type FranchiseOfferKind = 'buy' | 'sell';
export interface FranchiseOffer extends BaseTradeOffer {
  kind: FranchiseOfferKind;    // 'buy' = fromStudioId wants to buy franchise from toStudioId; 'sell' = fromStudioId wants to sell franchise to toStudioId
  franchiseId: string;
  priceB: number;              // current offered price in $B
}

export interface BulkCatalogOffer extends BaseTradeOffer {
  movieIds: string[];          // the specific catalog titles bundled
  priceB: number;              // lump-sum fee in $B
  years: number;               // license term length
  serviceId?: string;          // destination streaming service (for player-outgoing and for AI-to-player offers: player's service)
}

// ---------------- FESTIVALS ----------------
export type FestivalSeason = 'Winter' | 'Spring' | 'Summer' | 'Fall';
export type FestivalStatus = 'upcoming' | 'active' | 'concluded';

export interface FestivalLot {
  id: string;
  // The AI-produced indie movie being auctioned. Stored fully (detached clone) so it survives studio ownership changes.
  movieId: string;
  // Reserve / opening bid in $M
  startingBidM: number;
  // Current highest bid in $M, and who bid it (studioId)
  currentBidM: number;
  currentBidderStudioId: string | null;
  // Bidding history (for UI)
  bidLog: { studioId: string; amountM: number; week: number; year: number }[];
  // Once sold, becomes true and transfers ownership; false until then.
  sold: boolean;
  // Winning studio (null if unsold)
  winnerStudioId?: string;
  finalPriceM?: number;
}

export interface Festival {
  id: string;
  name: string;             // "Cannes-Style", "Sundance-Style", etc
  season: FestivalSeason;
  region: 'Europe' | 'North America' | 'Asia' | 'Latin America';
  week: number;             // calendar week when festival opens
  year: number;
  status: FestivalStatus;
  lots: FestivalLot[];
  closedAt?: { week: number; year: number };
}

// ---------------- CINEMA DEALS ----------------
export type CinemaRegion = 'North America' | 'Europe' | 'Latin America' | 'Asia' | 'Oceania' | 'Africa';
export interface CinemaChain {
  id: string;
  name: string;
  region: CinemaRegion;
  theaters: number;         // total screens under this chain
  reputation: number;       // 0..100 — higher = tougher to negotiate, more BO access
}

export interface CinemaDeal {
  id: string;
  chainId: string;
  studioId: string;
  region: CinemaRegion;
  years: number;            // 5..10
  signedWeek: number;
  signedYear: number;
  expiresWeek: number;
  expiresYear: number;
  // Studio share in opening weeks (0.60..0.80) — decays over a movie's run
  openingStudioShare: number;
  // Studio share in late weeks (0.30..0.50)
  lateStudioShare: number;
  // Theater count guaranteed for releases
  guaranteedTheaters: number;
}

export interface AwardNomination {
  movieId: string;
  talentId?: string; // for cast/crew categories
  score: number;     // sort score
}

export interface AwardCategory {
  key: 'best_picture' | 'best_director' | 'best_writer' | 'best_leading_actor' | 'best_supporting_actor';
  label: string;
  nominees: AwardNomination[]; // up to 5
  winnerIdx: number;           // index 0..4
}

export interface AwardCeremony {
  year: number;
  poolKey: 'ricardos' | 'bigpic' | 'indie' | 'guild';
  poolLabel: string;
  categories: AwardCategory[];
}

// Pending license offer from an AI streaming service to license a PLAYER movie
export interface LicenseOffer {
  id: string;
  movieId: string;
  serviceId: string;       // the AI streaming service making the offer
  feeM: number;            // offered fee in $M
  years: number;           // 1, 3, 5, 10
  reasoning: string;       // scripted dialogue
  createdWeek: number;
  createdYear: number;
  expiresWeek: number;     // offer auto-expires after a few weeks
  expiresYear: number;
  round: number;           // 1 = initial offer, 2 = AI counter after player counter
  playerCounterFeeM?: number;
}
