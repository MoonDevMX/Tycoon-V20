import { Genre, MovieType, PlotArc, Rating, Role, ColorTrait, HairStyle, FacialHair, ContractKind, Talent, DealType, Gender, Relationship, SubscriptionTier, TierPeriod, StreamingService } from './types';

export const GENRES: Genre[] = ['Action', 'Drama', 'Comedy', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Animation', 'Fantasy', 'Mystery'];
export const TYPES: MovieType[] = GENRES;
export const PLOT_ARCS: PlotArc[] = ['Man in a Hole', 'Rags to Riches', 'Icarus', 'Cinderella', 'Oedipus', 'Riches to Rags'];
export const RATINGS: Rating[] = ['G', 'PG', 'PG-13', 'R'];

// Calendar: 48 weeks/year, 12 months × 4 weeks
export const WEEKS_PER_YEAR = 48;
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthOf(week: number): { name: string; weekInMonth: number; idx: number } {
  const idx = Math.min(11, Math.floor((week - 1) / 4));
  return { name: MONTH_NAMES[idx], weekInMonth: ((week - 1) % 4) + 1, idx };
}

// Holidays — 48-week calendar with seasonal genre bonuses (Winter / Spring / Summer / Fall)
export interface Holiday { week: number; name: string; mult: number; genres?: Genre[]; sizeAdvice: 'Small' | 'Medium' | 'Large'; season?: string; }
export const HOLIDAYS: Holiday[] = [
  { week: 4,  name: "President's Day", mult: 1.18, genres: ['Comedy', 'Drama'], sizeAdvice: 'Small', season: 'Winter' },
  { week: 8,  name: 'Valentines',      mult: 1.22, genres: ['Romance', 'Comedy', 'Drama'], sizeAdvice: 'Small', season: 'Winter' },
  { week: 13, name: 'Easter',          mult: 1.16, genres: ['Animation', 'Fantasy', 'Comedy', 'Romance'], sizeAdvice: 'Small', season: 'Spring' },
  { week: 21, name: 'Memorial Day',    mult: 1.30, genres: ['Romance', 'Drama'], sizeAdvice: 'Large', season: 'Spring' },
  { week: 26, name: 'Independence Day', mult: 1.40, genres: ['Action', 'Sci-Fi', 'Fantasy', 'Thriller'], sizeAdvice: 'Large', season: 'Summer' },
  { week: 32, name: 'Summer Peak',     mult: 1.28, genres: ['Action', 'Sci-Fi', 'Animation'], sizeAdvice: 'Large', season: 'Summer' },
  { week: 41, name: 'Halloween',       mult: 1.30, genres: ['Horror', 'Thriller', 'Mystery'], sizeAdvice: 'Medium', season: 'Fall' },
  { week: 44, name: 'Thanksgiving',    mult: 1.22, genres: ['Drama', 'Comedy', 'Animation'], sizeAdvice: 'Medium', season: 'Fall' },
  { week: 48, name: 'Christmas',       mult: 1.45, sizeAdvice: 'Large', season: 'Winter' },
];
export const SEASON_OF_WEEK = (week: number): string => {
  if (week <= 8) return 'Winter';
  if (week <= 20) return 'Spring';
  if (week <= 36) return 'Summer';
  if (week <= 44) return 'Fall';
  return 'Winter';
};
export const SEASON_GENRE_BONUS: Record<string, Genre[]> = {
  Winter: ['Comedy', 'Drama', 'Romance'],
  Spring: ['Romance', 'Drama', 'Comedy'],
  Summer: ['Action', 'Sci-Fi', 'Fantasy', 'Animation'],
  Fall:   ['Drama', 'Horror', 'Thriller', 'Mystery'],
};
export function holidayFor(week: number): Holiday | undefined { return HOLIDAYS.find(h => h.week === week); }
export function nextHolidays(week: number, year: number, count = 3): { h: Holiday; weeksAway: number }[] {
  const out: { h: Holiday; weeksAway: number }[] = [];
  let w = week, y = year;
  while (out.length < count) {
    for (const h of HOLIDAYS) {
      if (h.week >= w) {
        out.push({ h, weeksAway: (h.week - w) + (y - year) * WEEKS_PER_YEAR });
        if (out.length >= count) return out;
      }
    }
    w = 1; y += 1;
  }
  return out;
}

// Audience colors — population segments aligned with color traits
export const COLORS: ColorTrait[] = ['red', 'blue', 'yellow', 'purple', 'green', 'orange'];
export const COLOR_HEX: Record<string, string> = {
  red: '#E74C3C', blue: '#3498DB', yellow: '#F1C40F', purple: '#9B59B6', green: '#2ECC71', orange: '#E67E22',
  // Legacy alias — old saves may still carry 'gold'
  gold: '#F1C40F',
};
export const COLOR_LABEL: Record<string, string> = {
  red: 'Red', blue: 'Blue', yellow: 'Yellow', purple: 'Purple', green: 'Green', orange: 'Orange',
};
// Genre → preferred color mapping (audience resonance)
export const GENRE_COLOR_AFFINITY: Record<Genre, ColorTrait> = {
  Action: 'red', Drama: 'purple', Comedy: 'yellow', Horror: 'purple', 'Sci-Fi': 'blue',
  Romance: 'red', Thriller: 'blue', Animation: 'yellow', Fantasy: 'green', Mystery: 'blue',
};

// Iconography by genre
export const GENRE_ICON: Record<Genre, { icon: string; bg: string }> = {
  Action: { icon: 'fire', bg: '#E55A3C' },
  Drama: { icon: 'drama-masks', bg: '#F5A623' },
  Comedy: { icon: 'emoticon-happy', bg: '#F8E71C' },
  Horror: { icon: 'ghost', bg: '#4A2D5E' },
  'Sci-Fi': { icon: 'rocket', bg: '#3DB5E0' },
  Romance: { icon: 'heart', bg: '#E91E63' },
  Thriller: { icon: 'knife', bg: '#37474F' },
  Animation: { icon: 'palette', bg: '#9B59B6' },
  Fantasy: { icon: 'auto-fix', bg: '#8E44AD' },
  Mystery: { icon: 'magnify', bg: '#2C3E50' },
};

export function arcGenreFit(arc: PlotArc, genre: Genre): number {
  const ideals: Record<PlotArc, Genre[]> = {
    'Man in a Hole': ['Action', 'Drama', 'Thriller', 'Sci-Fi'],
    'Rags to Riches': ['Drama', 'Comedy', 'Animation'],
    'Icarus': ['Drama', 'Thriller', 'Action'],
    'Cinderella': ['Romance', 'Comedy', 'Animation', 'Fantasy'],
    'Oedipus': ['Mystery', 'Thriller', 'Horror', 'Drama'],
    'Riches to Rags': ['Drama', 'Thriller'],
  };
  return ideals[arc].includes(genre) ? 1.18 : 0.9;
}

const FIRST_NAMES_M = [
  // Anglo
  'Arthur', 'Jude', 'Al', 'Theo', 'Otis', 'Quinn', 'Cillian', 'Idris', 'Harlan', 'Hunter', 'Cole', 'Bodhi', 'Marcus', 'Ezra', 'Felix', 'Hugo', 'Jasper', 'Liam', 'Owen', 'Wesley', 'Xander', 'Caleb', 'Dante', 'Finn', 'Gabriel', 'Oliver', 'Henry', 'Wyatt', 'Rowan', 'Elias', 'James', 'Atlas', 'Knox', 'Phoenix', 'River', 'Sage', 'Ocean',
  // Spanish/Latin
  'Rafael', 'Diego', 'Mateo', 'Santiago', 'Emiliano', 'Joaquin', 'Octavio', 'Javier', 'Sebastian', 'Cristobal', 'Lucas', 'Andres', 'Tomas', 'Nicolas', 'Adrian', 'Hernan',
  // French
  'Émile', 'Antoine', 'Gaspard', 'Théo', 'Mathis', 'Pierre', 'Étienne', 'Lucien',
  // Italian
  'Lorenzo', 'Matteo', 'Dario', 'Alessio', 'Giovanni', 'Stefano', 'Ricardo',
  // Nordic
  'Soren', 'Magnus', 'Lars', 'Bjorn', 'Henrik', 'Erik', 'Anders',
  // Slavic
  'Nikolai', 'Dmitri', 'Aleksei', 'Tomasz', 'Pavel', 'Mikhail', 'Stanislav', 'Mateusz',
  // Middle Eastern / South Asian
  'Reza', 'Tariq', 'Omar', 'Kian', 'Farid', 'Hakeem', 'Jamil', 'Yusuf', 'Bashir',
  'Arjun', 'Rohan', 'Kabir', 'Ishaan', 'Vikram', 'Ravi', 'Aarav', 'Dev',
  // East Asian
  'Kai', 'Haruki', 'Jian', 'Ren', 'Hiroshi', 'Jun', 'Sunwoo', 'Chen', 'Daisuke', 'Tae', 'Kenji',
  // African
  'Kwame', 'Kofi', 'Sekou', 'Bahati', 'Adisa', 'Tariq', 'Olumide', 'Tafari', 'Babatunde',
  // Unisex/unique stage
  'Dax', 'Nico', 'Eli', 'Pedro', 'Zane', 'Yuri', 'Bo', 'Ash',
];
const FIRST_NAMES_F = [
  // Anglo
  'Misha', 'Caitlin', 'Jodie', 'Sienna', 'Aria', 'Mira', 'Lyra', 'Saoirse', 'Zendaya', 'Florence', 'Naomi', 'Greta', 'Anya', 'Ruth', 'Beatrix', 'Aaliyah', 'Juno', 'Marlowe', 'Vesper', 'Wren', 'Hazel', 'Olive', 'Selene', 'Talia', 'Uma', 'Vera', 'Willa', 'Harper', 'Skylar', 'Margot', 'Eleanor', 'Scarlett', 'Lily', 'Violet', 'Grace', 'Storm', 'Winter', 'Indigo',
  // Spanish/Latin
  'Camila', 'Sofia', 'Valentina', 'Isabella', 'Lucia', 'Paloma', 'Ximena', 'Renata', 'Alejandra', 'Esperanza', 'Mariana', 'Carolina', 'Daniela', 'Adriana', 'Rosa', 'Xiomara',
  // French
  'Léa', 'Camille', 'Mathilde', 'Céleste', 'Clémence', 'Maxime', 'Delphine', 'Élise', 'Margaux',
  // Italian
  'Alessia', 'Chiara', 'Giulia', 'Aurora', 'Bianca', 'Francesca', 'Martina',
  // Nordic
  'Astrid', 'Freya', 'Ingrid', 'Saga', 'Linnea', 'Sigrid', 'Elin', 'Ines',
  // Slavic
  'Milena', 'Anja', 'Natasha', 'Zara', 'Katarina', 'Olya', 'Marta',
  // Middle Eastern / South Asian
  'Yara', 'Leila', 'Farah', 'Amira', 'Nasrin', 'Soraya', 'Doutzen',
  'Priya', 'Anaya', 'Indira', 'Aisha', 'Nadia', 'Devika', 'Kira',
  // East Asian
  'Mei', 'Sakura', 'Yuki', 'Aiko', 'Minji', 'Hana', 'Akari', 'Lin',
  // African
  'Zola', 'Amara', 'Nala', 'Thandi', 'Folake', 'Aminata', 'Imani', 'Kemi',
  // Unique
  'Elara', 'Luna', 'Maya', 'Gemma', 'Jana', 'Vesper',
];
const LAST_NAMES = [
  // Anglo
  'Baquero', 'McDonald', 'Hartnett', 'Henrie', 'Voss', 'Aldridge', 'Vance', 'Bellamy', 'Thorne', 'Beckett', 'Halverson', 'Falk', 'Caspian', 'Forsythe', 'Harrington', 'Whitfield', 'Blackwood', 'Montgomery', 'Callahan', 'Ashford', 'Thornton', 'Wellington', 'Sinclair', 'Pennington', 'Hawthorne', 'Sterling',
  // Spanish/Latin
  'Castellanos', 'Cruz', 'Reyes', 'Mendoza', 'Montenegro', 'Delgado', 'Vega', 'Salazar', 'Bautista', 'Quintero', 'Figueroa', 'Soto', 'Navarro', 'Aguilar', 'Castañeda', 'Herrera', 'Jiménez', 'Sandoval',
  // French
  'Dubois', 'Devereux', 'Beaumont', 'Lavigne', 'Rousseau', 'Montclair', 'Lefèvre', 'Marchand', 'Charbonneau', 'Bellefonte',
  // Italian
  'Marchetti', 'Bianchi', 'Romano', 'Ferrari', 'Esposito', 'Moretti', 'Conti', 'Russo', 'Greco',
  // Nordic
  'Lindgren', 'Eklund', 'Halvorsen', 'Nordstrom', 'Lindqvist', 'Bergström', 'Holmberg', 'Dahl', 'Larsen',
  // Slavic
  'Petrov', 'Volkov', 'Kowalski', 'Novak', 'Tomić', 'Jovanović', 'Horvat', 'Kovačič', 'Sokolov',
  // Middle Eastern
  'Farahani', 'Ahmadi', 'Nazari', 'Khoury', 'Haddad', 'Mansour', 'El-Sayed', 'Rashidi', 'Ammar',
  // South Asian
  'Singh', 'Chakraborty', 'Joshi', 'Kapoor', 'Iyer', 'Khatri', 'Patel', 'Sharma', 'Mehta',
  // East Asian
  'Sato', 'Nakamura', 'Ozawa', 'Park', 'Kim', 'Chen', 'Wong', 'Tanaka', 'Yoshida', 'Hayashi', 'Nguyen', 'Tran',
  // African
  'Okonkwo', 'Adeyemi', 'Diallo', 'Mwangi', 'Okafor', 'Abiodun', 'Nyambura', 'Osei', 'Achebe',
  // Stage-name unique
  'Wintergrave', 'Silvermane', 'Stormrider', 'Hollowcrest', 'Blackthorn', 'Ratajkowski', 'Exarchopoulos',
  'Jordan', 'Katarina', 'Ratajkowski',
];
// Procedural portraits — pools mimicking Box Office Sim
export const HAIR_STYLES: HairStyle[] = ['short', 'long', 'curly', 'wavy', 'buzz', 'bun', 'bald'];
export const FACIAL_HAIR: FacialHair[] = ['none', 'mustache', 'goatee', 'beard', 'stubble'];
const HAIR = ['#3a2316', '#6b3a1f', '#c8923d', '#d65a2e', '#1a1a1a', '#8a8a8a', '#ffffff', '#a83a3a', '#5a3a8a'];
const SKIN = ['#f6c69b', '#e8b48a', '#c89070', '#a4744f', '#8e5a3c', '#6e4527', '#4d2f1a'];

export function pick<T>(arr: T[], rng: () => number = Math.random): T { return arr[Math.floor(rng() * arr.length)]; }
export function randInt(min: number, max: number, rng: () => number = Math.random): number { return Math.floor(rng() * (max - min + 1)) + min; }

let _idCounter = 1;
export function uid(prefix = ''): string { _idCounter += 1; return `${prefix}${Date.now().toString(36)}_${_idCounter}_${Math.floor(Math.random() * 1e6).toString(36)}`; }

export function genName(gender?: Gender): string {
  const first = gender === 'female'
    ? pick(FIRST_NAMES_F)
    : gender === 'male'
      ? pick(FIRST_NAMES_M)
      : pick(Math.random() < 0.5 ? FIRST_NAMES_M : FIRST_NAMES_F);
  return `${first} ${pick(LAST_NAMES)}`;
}

export function genTalent(role: Role, opts: { skillMin?: number; skillMax?: number; ageMin?: number; ageMax?: number; gender?: Gender; color?: ColorTrait } = {}) {
  const skill = randInt(opts.skillMin ?? 55, opts.skillMax ?? 92);
  const fame = randInt(10, 80);
  const base = role === 'writer' ? 4 : role === 'director' ? 7 : 6;
  const salary = +(base + (skill - 55) * 0.18 + (fame - 10) * 0.12 + Math.random() * 4).toFixed(2);
  const age = randInt(opts.ageMin ?? 24, opts.ageMax ?? 58);
  // Gender: actor=male, actress=female; writer/director = override or 50/50
  let gender: Gender;
  if (opts.gender) gender = opts.gender;
  else if (role === 'actor') gender = 'male';
  else if (role === 'actress') gender = 'female';
  else gender = Math.random() < 0.5 ? 'male' : 'female';
  // Facial hair only for males with a chance
  const facialHair: FacialHair = (gender === 'male' && Math.random() < 0.4)
    ? pick(FACIAL_HAIR.filter(f => f !== 'none'))
    : 'none';
  const colorTrait: ColorTrait = opts.color || (pick(COLORS) as ColorTrait);

  // Granular skills — each stat varies ±15 around the composite skill, clipped to 30..100
  const jitter = (base: number, spread = 15) => Math.max(30, Math.min(100, Math.round(base + (Math.random() - 0.5) * 2 * spread)));
  const skillBreakdown: any = { starPower: fame };
  if (role === 'director') {
    skillBreakdown.directing  = jitter(skill, 8);   // headline stat
    skillBreakdown.leadership = jitter(skill);
    skillBreakdown.pacing     = jitter(skill);
    skillBreakdown.style      = jitter(skill);
  } else if (role === 'writer') {
    skillBreakdown.plot        = jitter(skill, 8);
    skillBreakdown.dialogue    = jitter(skill);
    skillBreakdown.structure   = jitter(skill);
    skillBreakdown.originality = jitter(skill);
  } else {
    skillBreakdown.acting   = jitter(skill, 8);
    skillBreakdown.range    = jitter(skill);
    skillBreakdown.presence = jitter(skill);
    skillBreakdown.accents  = jitter(skill);
  }

  // Genre proficiencies — each talent has 2 strong genres and 2 weak ones, rest near skill
  const allGenres = GENRES.slice();
  // Shuffle
  for (let i = allGenres.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allGenres[i], allGenres[j]] = [allGenres[j], allGenres[i]];
  }
  const strong = allGenres.slice(0, 2);
  const weak = allGenres.slice(2, 4);
  const genreSkills: any = {};
  GENRES.forEach(g => {
    if (strong.includes(g)) genreSkills[g] = jitter(skill + 12, 6);
    else if (weak.includes(g)) genreSkills[g] = jitter(skill - 18, 6);
    else genreSkills[g] = jitter(skill, 8);
  });

  return {
    id: uid('t_'), name: genName(gender), role, skill, fame, salary,
    movies: 0, reviewAvg: 0, totalBO: 0,
    avatarColor: pick(SKIN), hairColor: pick(HAIR),
    hairStyle: pick(HAIR_STYLES), facialHair,
    age, retired: false,
    gender,
    colorTrait,
    growthLog: [] as number[],
    skills: skillBreakdown,
    genreSkills,
  };
}

// Helper: get the relevant skill score for a talent given the movie's genre.
// Returns a 0..100 number combining the talent's primary craft stat + their genre proficiency.
export function effectiveSkillFor(t: { role: string; skill: number; skills?: any; genreSkills?: any }, genre: string): number {
  // Headline craft stat (falls back to legacy `skill`)
  let craft = t.skill;
  if (t.skills) {
    if (t.role === 'director' && t.skills.directing) craft = t.skills.directing;
    else if (t.role === 'writer' && t.skills.plot) craft = t.skills.plot;
    else if (t.skills.acting) craft = t.skills.acting;
  }
  const genreFit = (t.genreSkills && t.genreSkills[genre]) ?? t.skill;
  // 60% craft, 40% genre fit — emphasises craft but punishes wrong-genre casting
  return +(craft * 0.6 + genreFit * 0.4).toFixed(1);
}

// Talent CHEMISTRY — talent-to-talent color matching (NOT audience). Higher matching pairs → bonus.
// Pool of talents (writer + director + cast) → count pairwise matching colors.
export function computeChemistryBonus(colors: ColorTrait[]): number {
  if (colors.length < 2) return 0;
  let pairs = 0; let matches = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      pairs += 1;
      if (colors[i] === colors[j]) matches += 1;
    }
  }
  const ratio = matches / pairs;          // 0..1
  return Math.min(0.40, ratio * 0.40);    // up to +40%
}

// NEGOTIATION: probability the talent accepts a given offer (0..1)
// Based on offer relative to talent's "expected" salary (their .salary baseline)
// Deal type also shifts expectation.
export function negotiationAcceptance(talentBaseSalary: number, offered: { salary: number; boPercent: number }, dealType: 'actor_favored' | 'middle' | 'studio_favored', talentFame: number): { accept: boolean; chance: number; reason: string } {
  const target = dealType === 'actor_favored' ? talentBaseSalary * 1.4 : dealType === 'studio_favored' ? talentBaseSalary * 0.7 : talentBaseSalary;
  const ratio = offered.salary / target;
  // Talents with high fame are pickier
  const pickiness = 0.5 + (talentFame / 200);
  let chance = ratio >= 1 ? 1 : Math.max(0, 1 - (1 - ratio) / pickiness);
  // BO % sweetens the deal
  chance += Math.min(0.2, (offered.boPercent || 0) * 0.025);
  chance = Math.min(1, chance);
  let reason = chance >= 0.85 ? 'Eager' : chance >= 0.6 ? 'Will accept' : chance >= 0.35 ? 'Considering' : chance >= 0.15 ? 'Reluctant' : 'Will reject';
  return { accept: chance >= 0.5, chance, reason };
}

// CONTRACT KINDS: cost multipliers and benefits
export interface ContractTerms { multiplier: number; description: string; }
export function contractTerms(kind: ContractKind): ContractTerms {
  if (kind === 'pack3')   return { multiplier: 2.6, description: '3-movie package — locks talent for 3 films, prepaid' };
  if (kind === 'hold5y')  return { multiplier: 4.5, description: '5-year exclusive — talent guaranteed available, +rehire fame' };
  return                  { multiplier: 1.0, description: 'Single picture — no future commitment' };
}

const TITLE_NOUNS = ['Strings', 'Echoes', 'Fragments', 'Shadows', 'Ashes', 'Tides', 'Embers', 'Whispers', 'Reckoning', 'Empire', 'Chronicle', 'Genesis', 'Revelation', 'Dawn', 'Twilight', 'Storm', 'Veil', 'Eclipse', 'Phoenix', 'Crown', 'Legacy', 'Pulse', 'Origin', 'Horizon', 'Apex', 'Inferno', 'Sanctum', 'Mirage', 'Riddle', 'Cipher', 'Monolith', 'Oracle', 'Labyrinth', 'Kingdom', 'Requiem', 'Abyss', 'Citadel', 'Dynasty', 'Paradise', 'Vanguard', 'Sovereign', 'Tempest', 'Relic', 'Paragon', 'Dominion', 'Exile', 'Chasm', 'Beacon', 'Anthem', 'Covenant', 'Prophecy', 'Sentinel', 'Omen', 'Vortex', 'Nemesis', 'Catalyst', 'Spectre', 'Aurora', 'Saga', 'Pact'];
const TITLE_ADJ = ['Hidden', 'Lost', 'Broken', 'Forgotten', 'Eternal', 'Silent', 'Distant', 'Crimson', 'Velvet', 'Wild', 'Sacred', 'Black', 'Final', 'Last', 'First', 'Fallen', 'Burning', 'Frozen', 'Savage', 'Gilded', 'Shattered', 'Ancient', 'Forbidden', 'Midnight', 'Scarlet', 'Obsidian', 'Emerald', 'Radiant', 'Hollow', 'Infinite', 'Celestial', 'Iron', 'Stormbound', 'Untamed', 'Northern', 'Severed', 'Unwritten'];
const TITLE_PROPER = ['Atypical', 'Strings Theory', 'Nightfall', 'Tomorrow', 'Vermillion', 'Halcyon', 'Phantom Hour', 'Solstice', 'Iron Bloom', 'The Coil', 'Riftwalker', 'Brass City', 'Moonglass', 'Seraphim', 'Paperback Ghosts', 'Low Orbit', 'Thornwood', 'The Collapsed Sky', 'Argent', 'Bluehour', 'The Amaranth Protocol', 'Copper Kingdom', 'Saltborn', 'The Luminous', 'Greylight', 'Ashfall', 'Sundown Mile', 'Marrowfield', 'Whetstone', 'Pale Horse'];

// Hero character names for franchises
export const CHARACTER_FIRSTS = ['Kade', 'Zara', 'Ronan', 'Viv', 'Orion', 'Lux', 'Atlas', 'Nyx', 'Sable', 'Kai', 'Juno', 'Reya', 'Cass', 'Rook', 'Nova', 'Vega', 'Knox', 'Briar', 'Cove', 'Phoenix', 'Indigo', 'Storm'];
export const CHARACTER_LASTS = ['Vale', 'Crow', 'Steele', 'Ash', 'Stone', 'Kane', 'Wolfe', 'Quinn', 'Fox', 'Rook', 'Storm', 'Hollow', 'North', 'Vane', 'Sterling', 'Blake', 'Rivers', 'Reign', 'Voss', 'Kestrel'];
export function genCharacterName(): string { return `${pick(CHARACTER_FIRSTS)} ${pick(CHARACTER_LASTS)}`; }

export function genFranchiseName(existingNames?: Set<string>): string {
  const tryOne = (): string => {
    if (Math.random() < 0.45) return pick(TITLE_PROPER);
    if (Math.random() < 0.5) return `${pick(TITLE_ADJ)} ${pick(TITLE_NOUNS)}`;
    return pick(TITLE_NOUNS);
  };
  if (!existingNames || !existingNames.size) return tryOne();
  const lower = (s: string) => s.toLowerCase();
  const taken = new Set([...existingNames].map(lower));
  for (let i = 0; i < 25; i++) {
    const name = tryOne();
    if (!taken.has(lower(name))) return name;
  }
  // Last-resort fallback: append a roman-numeral-style suffix to force uniqueness without sequel implication.
  const base = tryOne();
  const suffix = ['Reborn', 'Resurgence', 'Rising', 'Awakened', 'Returns', 'Reforged', 'Renewed', 'Revived'];
  for (const s of suffix) {
    const candidate = `${base} ${s}`;
    if (!taken.has(lower(candidate))) return candidate;
  }
  return `${base} ${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function genTitleSubtitle(franchiseName: string, brand: string, sequelNum: number, existingTitles?: Set<string>): string {
  if (brand === 'Original') return franchiseName;
  if (brand === 'Sequel') return `${franchiseName} ${sequelNum}`;
  if (brand === 'Prequel') return `${franchiseName}: Origins`;
  // Spinoff / Crossover use a random NOUN/ADJ — uniquify across the world.
  const taken = existingTitles ? new Set([...existingTitles].map(s => s.toLowerCase())) : null;
  for (let i = 0; i < 20; i++) {
    const candidate = brand === 'Spinoff'
      ? `${franchiseName}: ${pick(TITLE_NOUNS)}`
      : `${franchiseName}: ${pick(TITLE_ADJ)} Crossover`;
    if (!taken || !taken.has(candidate.toLowerCase())) return candidate;
  }
  return brand === 'Spinoff'
    ? `${franchiseName}: ${pick(TITLE_ADJ)} ${pick(TITLE_NOUNS)}`
    : `${franchiseName}: The ${pick(TITLE_NOUNS)} Crossover`;
}

const PLOT_TEMPLATES = [
  'When a {adj} {noun} threatens the world, an unlikely hero must rise from {adj2} obscurity.',
  'A {noun} hides a secret that could shatter the {adj} balance of power forever.',
  'Two rivals are forced to confront their {adj} past when a {noun} returns from oblivion.',
  'In a city ruled by {adj} {noun}s, one outcast dares to dream of something greater.',
  'A {adj} discovery sends a family on a journey through {noun} and memory.',
  'When the {noun} falls, only a {adj} stranger can restore the broken order.',
];
const PLOT_ADJ = ['ancient', 'forbidden', 'strange', 'desperate', 'shadowy', 'glittering', 'savage', 'tender'];

export function genPlot(): string {
  const t = pick(PLOT_TEMPLATES);
  return t.replace('{adj}', pick(PLOT_ADJ)).replace('{adj2}', pick(PLOT_ADJ)).replace('{noun}', pick(TITLE_NOUNS).toLowerCase());
}

export const STUDIO_LOGOS = [
  { bg: '#1B2C7A', icon: 'moon-waning-crescent' },
  { bg: '#7A1B3C', icon: 'star' },
  { bg: '#0F4C3A', icon: 'pine-tree' },
  { bg: '#5C2E91', icon: 'eye' },
  { bg: '#C77800', icon: 'fire' },
  { bg: '#0F3A66', icon: 'compass' },
  { bg: '#7A2E0F', icon: 'sword-cross' },
  { bg: '#2E5F8C', icon: 'lightning-bolt' },
  { bg: '#3A1B7A', icon: 'crown' },
  { bg: '#1B5A3A', icon: 'leaf-maple' },
  { bg: '#7A4F1B', icon: 'feather' },
  { bg: '#5A1B2C', icon: 'castle' },
  { bg: '#2C4F5A', icon: 'anchor' },
  { bg: '#5A5A1B', icon: 'diamond-stone' },
  { bg: '#1B5A5A', icon: 'flash' },
];

export const RIVAL_NAMES = [
  'Apex Studios', 'Citadel Pictures', 'Halcyon Films', 'Vermillion Studios',
  'Northstar Pictures', 'Obsidian Films', 'Solstice Studios', 'Meridian Pictures',
  'Atlas Cinema', 'Orion Films', 'Zenith Studios', 'Empire Pictures',
  'Pinnacle Films', 'Cosmos Studios',
  'Titan Pictures', 'Lantern Entertainment', 'Monolith Pictures', 'Skyline Studios',
  'Ironwood Entertainment', 'Paragon Films', 'Blackhorse Pictures', 'Cascade Studios',
  'Aurelia Pictures', 'Kestrel Studios', 'Nimbus Films', 'Crimson Crown Studios',
];

// ---------------- RELATIONSHIPS ----------------
// Pairwise studio relationship score, key = sorted ids joined.
// -100 = bitter rivals, 0 = neutral, +100 = close allies
export function relKey(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}
export function getRel(rels: Record<string, number> | undefined, a: string, b: string): number {
  if (!rels) return 0;
  return rels[relKey(a, b)] ?? 0;
}
export function relLabel(score: number): { label: Relationship; color: string; descriptor: string } {
  if (score >= 25) return { label: 'friend', color: '#2ECC71', descriptor: 'Friendship' };
  if (score <= -25) return { label: 'rival', color: '#E74C3C', descriptor: 'Rivalship' };
  return { label: 'neutral', color: '#F1C40F', descriptor: 'Neutralship' };
}
export function nudgeRelInPlace(rels: Record<string, number>, a: string, b: string, delta: number): number {
  const k = relKey(a, b);
  const next = Math.max(-100, Math.min(100, (rels[k] ?? 0) + delta));
  rels[k] = next;
  return next;
}

// Reviews — procedural 5-star + 6 sources (3 audience + 3 critic)
const AUDIENCE_SOURCES = ['CineCrowd', 'PopcornVote', 'StreamWatch'];
const CRITIC_SOURCES = ['The Reel', 'Lens & Frame', 'Backlot Daily'];
const QUOTES_HIGH = ['A staggering, generation-defining piece.', 'Electrifying performances throughout.', 'Pure cinematic magic.', 'Will be talked about for years.', 'A triumph in every frame.'];
const QUOTES_MID = ['Solid, if uneven in places.', 'Hits more often than it misses.', 'A workmanlike effort with bright spots.', 'Watchable, sometimes inspired.'];
const QUOTES_LOW = ['Misses the mark badly.', 'A disappointing slog.', 'Forgettable from the opening reel.', 'A waste of a strong premise.'];
export function generateReviews(criticScore: number): { source: string; type: 'audience' | 'critic'; score: number; quote: string }[] {
  const out: { source: string; type: 'audience' | 'critic'; score: number; quote: string }[] = [];
  for (const src of AUDIENCE_SOURCES) {
    const variance = (Math.random() - 0.5) * 20;
    const stars = Math.max(0.5, Math.min(5, +((criticScore + variance + 5) / 20).toFixed(1)));
    const quote = stars >= 4 ? pick(QUOTES_HIGH) : stars >= 2.5 ? pick(QUOTES_MID) : pick(QUOTES_LOW);
    out.push({ source: src, type: 'audience', score: stars, quote });
  }
  for (const src of CRITIC_SOURCES) {
    const variance = (Math.random() - 0.5) * 18;
    const stars = Math.max(0.5, Math.min(5, +((criticScore + variance) / 20).toFixed(1)));
    const quote = stars >= 4 ? pick(QUOTES_HIGH) : stars >= 2.5 ? pick(QUOTES_MID) : pick(QUOTES_LOW);
    out.push({ source: src, type: 'critic', score: stars, quote });
  }
  return out;
}

// Deal economics
export function dealTerms(baseSalary: number, type: 'actor_favored' | 'middle' | 'studio_favored'): { salary: number; boPercent: number } {
  if (type === 'actor_favored')   return { salary: +(baseSalary * 1.4).toFixed(2), boPercent: 6 };
  if (type === 'studio_favored')  return { salary: +(baseSalary * 0.7).toFixed(2), boPercent: 0 };
  return                          { salary: +baseSalary.toFixed(2), boPercent: 2.5 };
}


// ---------------- STREAMING SERVICES ----------------
// Subscription tier helpers and procedural service names.
export const TIER_PERIOD_MONTHS: Record<TierPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  yearly: 12,
};
export const TIER_PERIOD_LABEL: Record<TierPeriod, string> = {
  monthly: 'Monthly',
  quarterly: '3-Month',
  biannual: '6-Month',
  yearly: 'Yearly',
};

// Generate the player's three default starter tiers (editable on launch).
export function defaultTiers(): SubscriptionTier[] {
  return [
    { id: uid('tier_'), name: 'Basic',    period: 'monthly', price:  9.99, screens: 1, users: 1, isExclusive: false },
    { id: uid('tier_'), name: 'Standard', period: 'monthly', price: 14.99, screens: 2, users: 4, isExclusive: false },
    { id: uid('tier_'), name: 'Premium',  period: 'monthly', price: 19.99, screens: 4, users: 6, isExclusive: false },
  ];
}

// === Tier-level helpers (Basic ⊂ Standard ⊂ Premium) ===
// Convention: tiers are sorted by ascending price → index 0 = cheapest = Basic, last index = Premium.
// minLevel 0 = visible to all (Basic+Standard+Premium); 1 = Standard+Premium; 2 = Premium-only.
export function tiersAtOrAboveLevel(tiers: SubscriptionTier[], minLevel: number): string[] {
  const sorted = [...tiers].map((t, i) => ({ t, i })).sort((a, b) => a.t.price - b.t.price);
  return sorted.filter(x => x.i >= minLevel || sorted.findIndex(y => y.i === x.i) >= minLevel).map(x => x.t.id);
}
export function levelLabel(lvl: number): string {
  if (lvl <= 0) return 'Basic+';
  if (lvl === 1) return 'Standard+';
  return 'Premium-only';
}

// === EXTERNAL IP LICENSORS / IPs ===
const LICENSOR_TEMPLATES: { name: string; category: import('./types').IPCategory }[] = [
  { name: 'Mythos Publishing',   category: 'book' },
  { name: 'Apex Games',          category: 'video_game' },
  { name: 'Polaris Toys',        category: 'toy' },
  { name: 'Continental Sports',  category: 'sports' },
  { name: 'Vanguard Comics',     category: 'comic' },
  { name: 'Helios Records',      category: 'music' },
  { name: 'Northwind Books',     category: 'book' },
  { name: 'Crucible Studios',    category: 'video_game' },
];
const IP_NAME_POOL: Record<import('./types').IPCategory, string[]> = {
  book:        ['The Crimson Mage', 'Galaxy Riders', 'The Last Lighthouse', 'Iron Veil', 'Forbidden Atlas', 'The Silent Empress'],
  video_game:  ['Stardrift Saga', 'Throne of Embers', 'Voidcaller', 'Megaforge', 'Eclipse Protocol', 'Neon Phantom'],
  toy:         ['Mighty Mechs', 'Crystal Pony Brigade', 'Captain Comet', 'Plushverse', 'Block Knights'],
  sports:      ['Global Football League', 'Continental Basketball', 'Velocity Cup', 'The Iron Run', 'World Cricket Series'],
  comic:       ['Quantum Dawn', 'Crimson Strike', 'Nightowl', 'The Aether Five', 'Lunar Sentinel'],
  music:       ['The Vermillion Tour', 'Echoes of August', 'Sapphire Choir', 'The Last Encore'],
};
export function seedExternalLicensors(): { licensors: import('./types').ExternalLicensor[]; ips: import('./types').ExternalIP[] } {
  const licensors: import('./types').ExternalLicensor[] = LICENSOR_TEMPLATES.map(t => ({
    id: uid('lic_'), name: t.name, category: t.category, reputation: randInt(40, 90),
  }));
  const ips: import('./types').ExternalIP[] = [];
  licensors.forEach(l => {
    const pool = IP_NAME_POOL[l.category];
    const count = randInt(2, 4);
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
    picked.forEach(n => {
      ips.push({
        id: uid('ip_'),
        name: n,
        licensorId: l.id,
        category: l.category,
        popularity: Math.max(20, Math.min(95, l.reputation + randInt(-15, 20))),
      });
    });
  });
  return { licensors, ips };
}
export function quoteIPLicenseFee(ip: import('./types').ExternalIP, args: { years: number; packs: number; boPercent: number; merchPercent: number; exclusivity: boolean; sublicensable: boolean }): number {
  // Base: popularity × packs × years scaling, then discounts/premiums.
  const base = (ip.popularity / 100) * 60 * Math.max(1, args.packs) * (1 + (args.years - 1) * 0.18);
  // Lower upfront if licensor takes more BO/merch %.
  const royaltyDiscount = 1 - Math.min(0.55, args.boPercent / 30 + args.merchPercent / 60);
  const exclMult = args.exclusivity ? 1.65 : 1.0;
  const subMult = args.sublicensable ? 1.25 : 1.0;
  return +(base * royaltyDiscount * exclMult * subMult).toFixed(1);
}
export function ipBoostsForMovie(ip: import('./types').ExternalIP): { boMult: number; popularityBoost: number; fameBoost: number } {
  const p = ip.popularity / 100;
  return {
    boMult: 1 + 0.1 + p * 0.4,        // +10–50%
    popularityBoost: Math.round(8 + p * 18), // +8–26
    fameBoost: Math.round(2 + p * 5),        // +2–7
  };
}

const SERVICE_SUFFIX = ['+', ' Stream', ' Now', ' Play', ' Plus', ' One', ' Reel', ' Flix', ' On Demand', ' Channel'];
export function genServiceName(studioName: string): string {
  // Take the first word of the studio name + a streaming-y suffix
  const first = studioName.split(/\s+/)[0] || studioName;
  return first + pick(SERVICE_SUFFIX);
}

export function effectiveMonthlyPrice(t: SubscriptionTier): number {
  return t.price / TIER_PERIOD_MONTHS[t.period];
}

// Compute weekly subscriber growth for a service.
// Returns the new total subscriber count + per-tier breakdown.
// Per-tier catalog access: respects service.isExclusive, service.exclusiveMovieIds, and movieTierAccess.
export function recomputeStreamingSubs(args: {
  service: StreamingService;
  catalogQuality: number;   // 0..100 — average critic score of catalog
  catalogSize: number;      // count of titles
  studioReputation: number; // 0..100
  population: number;       // 0..1 normalised target audience reachable
  weeksRunning: number;
  exclusiveCount?: number;  // titles unique to this service (not on any other streaming svc)
}): { totalSubs: number; tierSubs: Record<string, number>; monthlyRevenue: number } {
  const { service, catalogQuality, catalogSize, studioReputation, weeksRunning, exclusiveCount = 0 } = args;
  if (!service.tiers.length) return { totalSubs: 0, tierSubs: {}, monthlyRevenue: 0 };

  // Compute per-tier accessible catalog count (for content gating)
  const topTierIdx = service.tiers.length - 1;
  const tierAccessibleCount: number[] = service.tiers.map((tier, ix) => {
    let count = 0;
    service.catalogMovieIds.forEach(mid => {
      // If a per-movie tierAccess map says specific tiers, respect it
      const explicit = service.movieTierAccess?.[mid];
      if (explicit && explicit.length) {
        if (explicit.includes(tier.id)) count++;
        return;
      }
      // Service-level exclusivity: only top tier sees catalog
      if (service.isExclusive && ix !== topTierIdx) return;
      // Movie-level exclusivity (gates non-top tiers)
      if (service.exclusiveMovieIds?.includes(mid) && ix !== topTierIdx) return;
      // Tier-level isExclusive: tier only carries movies where this tier is in their access list
      if (tier.isExclusive) {
        // Tier is "exclusive content gated" — sees only movies explicitly assigned to it
        return;
      }
      count++;
    });
    return count;
  });

  // Demand multiplier from catalog & reputation
  const sizeFactor = Math.min(1, catalogSize / 25);            // saturates around 25 titles
  const qualityFactor = Math.max(0, (catalogQuality - 40) / 60); // 0 below 40, 1 at 100
  const repFactor = Math.max(0, studioReputation / 100);
  // Exclusive content boost: rewards services with originals/non-shared catalog (cap at +0.18 demand for 30+ exclusives).
  const exclusiveFactor = Math.min(0.18, exclusiveCount * 0.006);
  const desirability = Math.min(1, 0.42 * sizeFactor + 0.32 * qualityFactor + 0.18 * repFactor + exclusiveFactor); // 0..1

  // Each tier's draw is inversely related to its effective monthly price AND scaled by its accessible catalog size.
  const baseDrawPerTier = service.tiers.map((t, ix) => {
    const effPrice = effectiveMonthlyPrice(t);
    const valueScore = Math.max(0.2, (1 / Math.max(2, effPrice)) * 30);  // cheap = high draw
    const benefitScore = Math.min(2, 0.5 + t.screens * 0.15 + t.users * 0.1);
    // Tier accessible content fraction: 0..1 (full catalog = 1)
    const accessFraction = catalogSize > 0 ? Math.min(1, tierAccessibleCount[ix] / Math.max(1, catalogSize)) : 0.5;
    // Fully-empty tier draws very few subs; full-catalog tier draws full
    const accessMult = 0.2 + 0.8 * accessFraction;
    return valueScore * benefitScore * accessMult;
  });
  const totalDraw = baseDrawPerTier.reduce((a, b) => a + b, 0) || 1;

  // World market is bounded — assume up to 80M households reachable per service ceiling
  const ceiling = 80_000_000;
  const targetTotal = Math.round(ceiling * desirability * (0.4 + Math.min(1, weeksRunning / 96) * 0.6));

  // Smooth toward target
  const current = service.subscribers || 0;
  const drift = (targetTotal - current) * 0.07; // ~7% per week toward target
  const churn = current * 0.012;                // 1.2% weekly churn
  const newTotal = Math.max(0, Math.round(current + drift - churn));

  const tierSubs: Record<string, number> = {};
  service.tiers.forEach((t, i) => {
    tierSubs[t.id] = Math.round(newTotal * (baseDrawPerTier[i] / totalDraw));
  });

  // Revenue: each tier contributes (subs × monthly-equivalent price)
  let monthlyRevenue = 0;
  service.tiers.forEach((t, i) => {
    const subs = tierSubs[t.id] || 0;
    monthlyRevenue += subs * effectiveMonthlyPrice(t);
  });
  // Convert to $M
  monthlyRevenue = +(monthlyRevenue / 1_000_000).toFixed(3);
  return { totalSubs: newTotal, tierSubs, monthlyRevenue };
}

export function streamingLaunchCost(): number {
  return 0.2; // $200M (in $B) one-time setup cost
}

// ---------------- AI BUDGET BY RATING ----------------
// Drives blockbuster spending for the $200M Big Picture awards
export function aiBudgetForRating(rating: number): { production: number; marketing: number } {
  if (rating >= 5) return { production: randInt(200, 320), marketing: randInt(120, 180) };
  if (rating >= 4) return { production: randInt(150, 240), marketing: randInt(80, 140) };
  if (rating >= 3) return { production: randInt(70, 140),  marketing: randInt(40, 80) };
  if (rating >= 2) return { production: randInt(35, 80),   marketing: randInt(20, 50) };
  return                  { production: randInt(15, 40),   marketing: randInt(10, 25) };
}

// ---------------- AI LICENSE BIDDING ----------------
// Score how desirable a movie is to an AI streaming service this week.
export function licenseDesirability(
  movie: { boxOffice: number; criticScore: number; genre: Genre; awards?: number; brand?: string },
  streamer: { rating?: number; reputation?: number; catalogQuality?: number }
): number {
  const boScore = Math.min(2.0, movie.boxOffice * 1.5);
  const critic = movie.criticScore / 100;
  const prestige = 1 + (movie.awards || 0) * 0.05;
  const franchiseBoost = movie.brand && movie.brand !== 'Original' ? 1.10 : 1.0;
  const repBoost = 0.8 + ((streamer.reputation || 50) / 100) * 0.4;
  const noise = 0.9 + Math.random() * 0.20;
  return boScore * critic * prestige * franchiseBoost * repBoost * noise;
}

// Scripted dialogue for AI offering to license a player's movie
export function licenseOfferDialog(streamerName: string, movieTitle: string, years: number, feeM: number, genre: Genre): string {
  const bank = [
    `"${streamerName} needs a flagship ${genre.toLowerCase()} title. ${years}-year exclusive for $${feeM.toFixed(1)}M."`,
    `"${movieTitle} would anchor our ${genre} catalog. We're offering $${feeM.toFixed(1)}M for ${years} years."`,
    `"Our subscribers keep asking for ${movieTitle}. ${years}yr exclusive, $${feeM.toFixed(1)}M. Take it or we move on."`,
    `"${streamerName} programming wants ${movieTitle}. $${feeM.toFixed(1)}M / ${years}yr — competitive market rate."`,
  ];
  return bank[Math.floor(Math.random() * bank.length)];
}

// ---------------- FESTIVALS ----------------
// One per season. Player can enter live ascending auction against AI for indie films (<$200M budget).
export interface FestivalTemplate { name: string; season: 'Winter' | 'Spring' | 'Summer' | 'Fall'; region: 'Europe' | 'North America' | 'Asia' | 'Latin America'; week: number; }
export const FESTIVAL_TEMPLATES: FestivalTemplate[] = [
  { name: 'Sundance-Style Fest', season: 'Winter', region: 'North America', week: 6 },
  { name: 'Cannes-Style Fest',   season: 'Spring', region: 'Europe',        week: 18 },
  { name: 'Tokyo-Style Fest',    season: 'Summer', region: 'Asia',          week: 30 },
  { name: 'São Paulo Fest',      season: 'Fall',   region: 'Latin America', week: 42 },
];

// ---------------- CINEMAS ----------------
export const CINEMA_REGIONS: ('North America' | 'Europe' | 'Latin America' | 'Asia' | 'Oceania' | 'Africa')[] = [
  'North America', 'Europe', 'Latin America', 'Asia', 'Oceania', 'Africa',
];
export const CINEMA_CHAINS: { id: string; name: string; region: 'North America' | 'Europe' | 'Latin America' | 'Asia' | 'Oceania' | 'Africa'; theaters: number; reputation: number }[] = [
  // NA
  { id: 'cc_regal_legacy',     name: 'Regal Legacy',      region: 'North America', theaters: 6800, reputation: 85 },
  { id: 'cc_americinemas',     name: 'AmeriCinemas',      region: 'North America', theaters: 4200, reputation: 72 },
  { id: 'cc_sunbelt',          name: 'Sunbelt Screens',   region: 'North America', theaters: 2400, reputation: 55 },
  // Europe
  { id: 'cc_europa',           name: 'Europa Movieplex',  region: 'Europe',        theaters: 5100, reputation: 80 },
  { id: 'cc_odeon_star',       name: 'Odeon-Star',        region: 'Europe',        theaters: 3300, reputation: 70 },
  { id: 'cc_nordic',           name: 'Nordic Screens',    region: 'Europe',        theaters: 1800, reputation: 58 },
  // LATAM
  { id: 'cc_cinepolis',        name: 'Cinépolis Sur',     region: 'Latin America', theaters: 4700, reputation: 78 },
  { id: 'cc_cinecolombia',     name: 'Cinecolombia Red',  region: 'Latin America', theaters: 2200, reputation: 65 },
  { id: 'cc_cineaustral',      name: 'CineAustral',       region: 'Latin America', theaters: 1400, reputation: 50 },
  // Asia
  { id: 'cc_wanda',            name: 'Wanda Giga Cinemas',region: 'Asia',          theaters: 9500, reputation: 88 },
  { id: 'cc_pvr',              name: 'PVR Global',        region: 'Asia',          theaters: 4800, reputation: 74 },
  { id: 'cc_sakura',           name: 'Sakura Screens',    region: 'Asia',          theaters: 2100, reputation: 60 },
  // Oceania
  { id: 'cc_anz',              name: 'ANZ Cinema Circuit',region: 'Oceania',       theaters: 1200, reputation: 70 },
  { id: 'cc_pacific_reel',     name: 'Pacific Reel',      region: 'Oceania',       theaters:  650, reputation: 55 },
  { id: 'cc_southern_light',   name: 'Southern Light',    region: 'Oceania',       theaters:  300, reputation: 40 },
  // Africa
  { id: 'cc_nollycinema',      name: 'Nollycinema Group', region: 'Africa',        theaters: 1400, reputation: 68 },
  { id: 'cc_sahara',           name: 'Sahara Screens',    region: 'Africa',        theaters:  800, reputation: 54 },
  { id: 'cc_east_rift',        name: 'East Rift Cinema',  region: 'Africa',        theaters:  400, reputation: 44 },
];

// Compute negotiation range for a cinema deal based on chain reputation and studio rating.
// Returns favourable (studio) and unfavourable (cinema) ends of opening-week BO share.
export function cinemaDealRange(chainReputation: number, studioRating: number): { minOpen: number; maxOpen: number; minLate: number; maxLate: number; minYears: number; maxYears: number } {
  // Star studio (rating 4-5) gets bigger opening share; small studio takes cinema-favoured splits
  const reputationGap = (studioRating * 15) - chainReputation; // positive = studio has leverage
  const baseOpen = 0.65 + reputationGap * 0.002; // roughly ±0.1 swing
  const baseLate = 0.40 + reputationGap * 0.002;
  return {
    minOpen: Math.max(0.55, +(baseOpen - 0.06).toFixed(2)),
    maxOpen: Math.min(0.82, +(baseOpen + 0.06).toFixed(2)),
    minLate: Math.max(0.28, +(baseLate - 0.08).toFixed(2)),
    maxLate: Math.min(0.55, +(baseLate + 0.05).toFixed(2)),
    minYears: 5, maxYears: 10,
  };
}

// Compute studio BO share for a movie's given week given its active deal set.
// Studio gets opening share on week 0..1, scales down linearly to lateShare by week 6+.
export function cinemaStudioShareForWeek(weekIdx: number, openShare: number, lateShare: number): number {
  if (weekIdx <= 0) return openShare;
  if (weekIdx >= 6) return lateShare;
  const t = weekIdx / 6;
  return +(openShare * (1 - t) + lateShare * t).toFixed(3);
}

// ---------------- NEGOTIATION COUNTER-OFFERS ----------------
export type NegotiationStyle = 'tough' | 'fair' | 'generous' | 'diva';
export function inferNegotiationStyle(t: { fame: number; reviewAvg: number }): NegotiationStyle {
  if (t.fame >= 70 && t.reviewAvg >= 75) return 'diva';
  if (t.fame >= 55) return 'tough';
  if (t.fame <= 25) return 'generous';
  return 'fair';
}

export interface NegotiationOutcome {
  kind: 'accept' | 'counter' | 'reject_offended';
  reason: string;                                                    // scripted dialogue
  counter?: { upfront: number; boPercent: number; numMovies: number };
}

// Multi-round counter-offer evaluator. Uses talent's expectations vs offer.
// Round-aware: round 1 strict (need 100% of EV); round ≥2 relaxed (92% of EV).
export function evaluateNegotiation(
  t: { name: string; fame: number; salary: number; reviewAvg: number; skill: number },
  offer: { upfront: number; boPercent: number; numMovies: number },
  expected: { expectedTotal: number; minUpfront: number; maxUpfront: number; minBoPercent: number; maxBoPercent: number },
  round: number,
): NegotiationOutcome {
  const style = inferNegotiationStyle(t);
  // Estimated BO value: assume average movie = $150M
  const estimatedBoValue = 150 * (offer.boPercent / 100) * offer.numMovies;
  const totalOfferValue = offer.upfront + estimatedBoValue;
  const ratio = totalOfferValue / Math.max(1, expected.expectedTotal);

  // Style adjustments
  const toughness = style === 'diva' ? 0.10 : style === 'tough' ? 0.05 : style === 'generous' ? -0.05 : 0;
  const acceptThreshold = (round <= 1 ? 1.0 : 0.92) + toughness;
  const rejectThreshold = 0.65 + toughness;

  if (ratio >= acceptThreshold) {
    return { kind: 'accept', reason: pickAcceptScript(t.name, offer, ratio) };
  }
  if (ratio < rejectThreshold) {
    return { kind: 'reject_offended', reason: pickRejectScript(t.name, expected.minUpfront, style) };
  }
  // Counter
  const counterUpfront = +(Math.max(offer.upfront, expected.minUpfront * (1 + Math.random() * 0.10)) * (1 - toughness * 0.4)).toFixed(2);
  const counterBO = +(Math.min(15, Math.max(offer.boPercent, expected.minBoPercent + (style === 'diva' ? 3 : 1)))).toFixed(1);
  const counter = { upfront: counterUpfront, boPercent: counterBO, numMovies: offer.numMovies };
  return { kind: 'counter', reason: pickCounterScript(t.name, offer, counter, style, expected.expectedTotal), counter };
}
function pickAcceptScript(name: string, o: { upfront: number; boPercent: number }, ratio: number): string {
  const fname = name.split(' ')[0];
  const bank = [
    `${fname}: "Deal. Let's make something great."`,
    `"$${o.upfront.toFixed(1)}M plus ${o.boPercent}% BO? That works."`,
    ratio > 1.20 ? `"You could've negotiated harder, but I'll take it."` : `"This feels fair. I'm in."`,
    `${fname}: "Send me the script. Where do I sign?"`,
  ];
  return bank[Math.floor(Math.random() * bank.length)];
}
function pickCounterScript(name: string, your: { upfront: number; boPercent: number }, c: { upfront: number; boPercent: number }, style: NegotiationStyle, exp: number): string {
  const fname = name.split(' ')[0];
  const bank: Record<NegotiationStyle, string[]> = {
    tough: [
      `${fname}: "I need at least $${c.upfront.toFixed(1)}M upfront plus ${c.boPercent}% BO. My recent average is $${exp.toFixed(1)}M total."`,
      `${fname} leans back: "Not quite. Bump it to $${c.upfront.toFixed(1)}M and we talk."`,
    ],
    diva: [
      `${fname}: "Darling, please. Stars don't get out of bed for under $${c.upfront.toFixed(1)}M."`,
      `"$${your.upfront.toFixed(1)}? My agent would laugh. Try $${c.upfront.toFixed(1)}M and ${c.boPercent}% BO."`,
    ],
    generous: [
      `${fname}: "Close. Bump it to $${c.upfront.toFixed(1)}M and we've got a deal."`,
      `"I like the project. Meet me at $${c.upfront.toFixed(1)}M upfront, the rest is fine."`,
    ],
    fair: [
      `${fname}: "I usually get $${exp.toFixed(1)}M total. How about $${c.upfront.toFixed(1)}M + ${c.boPercent}% BO?"`,
      `"Reasonable, but $${c.upfront.toFixed(1)}M upfront makes it worth it."`,
    ],
  };
  return bank[style][Math.floor(Math.random() * bank[style].length)];
}
function pickRejectScript(name: string, expectedMinUpfront: number, style: NegotiationStyle): string {
  const fname = name.split(' ')[0];
  const bank = [
    `${fname} slams the script down: "That's insulting. Don't call again for a while."`,
    `"${fname}'s agent won't touch anything below $${expectedMinUpfront.toFixed(1)}M. We're done."`,
    `${fname}: "I don't work for scale. Goodbye."`,
  ];
  if (style === 'diva') return `${fname}: "Are you serious? I want to forget this conversation ever happened."`;
  return bank[Math.floor(Math.random() * bank.length)];
}
