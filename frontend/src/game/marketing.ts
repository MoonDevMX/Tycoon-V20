// Marketing channels — reach per age band (0..1 effectiveness), suggested min spend ($M).
// Reach values are weights used when computing marketing efficiency.
export type AgeBand = 'young' | 'adult' | 'mid' | 'senior'; // 18-29, 30-39, 40-59, 60+

export interface MarketingChannel {
  key: string;
  label: string;
  icon: string;     // MaterialCommunityIcons name
  reach: Record<AgeBand, number>; // 0..1 per age band
  costEfficiency: number; // 0..1 — how much $1M turns into reach (mass channels = lower; targeted = higher)
  desc: string;
}

export const MARKETING_CHANNELS: MarketingChannel[] = [
  { key: 'newspaper', label: 'Newspapers', icon: 'newspaper-variant', reach: { young: 0.05, adult: 0.30, mid: 0.70, senior: 0.85 }, costEfficiency: 0.55, desc: 'Cheap reach for older readers.' },
  { key: 'magazine', label: 'Magazines', icon: 'book-open-variant', reach: { young: 0.20, adult: 0.55, mid: 0.65, senior: 0.50 }, costEfficiency: 0.50, desc: 'Niche-targeted glossies.' },
  { key: 'network_tv', label: 'Network TV', icon: 'television-classic', reach: { young: 0.35, adult: 0.75, mid: 0.85, senior: 0.80 }, costEfficiency: 0.85, desc: 'Mass broadcast — high reach, high cost.' },
  { key: 'cable', label: 'Cable TV', icon: 'cable-data', reach: { young: 0.50, adult: 0.80, mid: 0.75, senior: 0.50 }, costEfficiency: 0.75, desc: 'Mid-range mass reach with younger skew.' },
  { key: 'own_streaming', label: 'Own Streaming', icon: 'play-circle', reach: { young: 0.85, adult: 0.85, mid: 0.55, senior: 0.20 }, costEfficiency: 1.10, desc: 'Free promo on your own streaming service (high efficiency).' },
  { key: 'trailers_tiny', label: 'Trailers · Tiny Theaters', icon: 'cinema', reach: { young: 0.40, adult: 0.45, mid: 0.30, senior: 0.20 }, costEfficiency: 0.90, desc: 'Local indie cinemas (cheap).' },
  { key: 'trailers_medium', label: 'Trailers · Mid Theaters', icon: 'cinema', reach: { young: 0.60, adult: 0.65, mid: 0.55, senior: 0.30 }, costEfficiency: 0.80, desc: 'Multiplexes nationwide.' },
  { key: 'trailers_big', label: 'Trailers · Big Theaters', icon: 'cinema', reach: { young: 0.85, adult: 0.80, mid: 0.65, senior: 0.40 }, costEfficiency: 0.70, desc: 'Mega-cinemas + AAA tentpoles.' },
  { key: 'billboards', label: 'Billboards', icon: 'sign-text', reach: { young: 0.55, adult: 0.65, mid: 0.65, senior: 0.55 }, costEfficiency: 0.60, desc: 'Highway + city centers.' },
  { key: 'radio', label: 'Radio', icon: 'radio', reach: { young: 0.30, adult: 0.55, mid: 0.70, senior: 0.65 }, costEfficiency: 0.65, desc: 'Drive-time mass reach.' },
  { key: 'internet', label: 'Internet & Social', icon: 'web', reach: { young: 0.95, adult: 0.85, mid: 0.50, senior: 0.20 }, costEfficiency: 1.20, desc: 'Targeted social/display (highest efficiency for young).' },
  { key: 'promotions', label: 'Promotions', icon: 'tag-multiple', reach: { young: 0.65, adult: 0.55, mid: 0.50, senior: 0.40 }, costEfficiency: 0.95, desc: 'Brand tie-ins, fast-food cups, retail giveaways.' },
];

// Map an audience segment label to age band weighting
export function ageWeightsForSegment(label: string): Record<AgeBand, number> {
  const lower = label.toLowerCase();
  if (lower.includes('18-35')) return { young: 0.7, adult: 0.3, mid: 0, senior: 0 };
  if (lower.includes('36-55')) return { young: 0, adult: 0.2, mid: 0.8, senior: 0 };
  if (lower.includes('55+') || lower.includes('senior') || lower.includes('60')) return { young: 0, adult: 0, mid: 0.2, senior: 0.8 };
  if (lower.includes('family')) return { young: 0.3, adult: 0.4, mid: 0.3, senior: 0 };
  return { young: 0.25, adult: 0.25, mid: 0.25, senior: 0.25 };
}

// Compute marketing efficiency multiplier (0.85..1.15 typical) for a movie's allocation
// vs the audience composition. Returns 1.0 when allocation is "average".
export function computeMarketingEfficiency(allocation: Record<string, number> | undefined, audience: { label: string; share: number }[]): number {
  if (!allocation) return 1.0;
  const totalSpend = Object.values(allocation).reduce((a, b) => a + b, 0);
  if (totalSpend <= 0) return 1.0;

  // Compute audience-wide age-band exposure achieved by allocation
  // Per channel: weighted-reach × $spent × efficiency (proxied as effective reach points).
  // Final efficiency = (weighted reach achieved per $1M) / 0.55 baseline; clamp 0.85..1.15.
  let achievedReach = 0;
  MARKETING_CHANNELS.forEach(ch => {
    const spent = allocation[ch.key] || 0;
    if (spent <= 0) return;
    // Audience-weighted reach for this channel
    let chReach = 0;
    audience.forEach(seg => {
      const w = ageWeightsForSegment(seg.label);
      const segReach = (w.young * ch.reach.young + w.adult * ch.reach.adult + w.mid * ch.reach.mid + w.senior * ch.reach.senior);
      chReach += seg.share * segReach;
    });
    achievedReach += chReach * spent * ch.costEfficiency;
  });
  // Normalise: average channel × average $ × audience = 0.55 reach per $1M ⇒ baseline = 0.55 * totalSpend
  const baseline = 0.55 * totalSpend;
  const ratio = baseline > 0 ? achievedReach / baseline : 1;
  return Math.max(0.85, Math.min(1.15, ratio));
}
