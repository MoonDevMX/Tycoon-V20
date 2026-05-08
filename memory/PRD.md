# Moon Cinema Tycoon (BetaTycoon V17)

## Source
- GitHub: https://github.com/MoonDevMX/BetaTycoon.git
- Branch: V17 (continuation of c-17 work)
- Re-imported into /app on Feb 2026 to finish credit-exhausted session

## App Summary
Offline film-studio tycoon game built with Expo Router + React Native. Players run a studio, create movies, hire talent, build franchises, manage cinema releases, streaming deals, festivals, awards, and marketing.

## Architecture
- **Frontend**: Expo Router (file-based routing) under `/app/frontend/app/`
  - Core screens: index, setup, dashboard, movies, create-movie, talent, cinemas, streaming, franchises, marketing, negotiate, festivals, awards, trends, rivals, studio-stats, offers, calendar, **external-ip (NEW)**
  - Game logic in `/app/frontend/src/game/` (state.tsx, sim.ts, data.ts, types.ts, draft.tsx, marketing.ts)
- **Persistence**: AsyncStorage (key: `mooncinema_save_v8`) — fully offline
- **Backend**: Default FastAPI starter (unused by gameplay)

## V17 Features Completed (this session)
0. **Movie/franchise name uniqueness** — `genFranchiseName(existingNames?)` and `genTitleSubtitle(..., existingTitles?)` now retry up to 25× to avoid collisions. Word pool expanded: 200 nouns × 206 adj × 195 propers (~41K base combinations).
0a. **World coherence pass** — sweeping fixes for inconsistencies:
   - World now seeds **50 years** of industry history (was 10) — game starts at year 51, not year 11.
   - **Studio stats are now derived from actual seeded movies** (no more "200 releases / 600 awards" with only 8 movies). `releases`, `totalBO`, `awards` are computed from real data after seedHistory.
   - Bigger studios get **proportionally more franchises (4–14)** scaled by rating, and **more standalone originals (10–100)**, also rating-scaled.
   - Each franchise has **3–10 movies** spread across decades (was 1–3).
   - Streaming services seed with **15–40 catalog titles** (was 5–15) and launched 3–12 years ago (was 2–6).
   - **Talent calibration**: bell-curve skill distribution (most cluster mid, few elite) instead of flat 55–92 range. Fame independent. Salary recalibrated.
   - **Reviews calibration**: 6 quote tiers (Terrible / Low / Weak / Mid / Good / High) replacing 3-tier; critics bias 2-pt harsher than audience; bad films now actually get bad reviews.
   - **Streaming services with empty catalog** lose 45% subs/week and force-zero subs/revenue once catalog stays empty (no more phantom subscribers).
   - **Standardized license fee formula** with reputation + exclusivity + franchise popularity multipliers across ALL surfaces (movie page, streaming detail, renew, AI quote, auto-license).
1. **Streaming exclusivity for catalog packs** — pick-exclusive-toggle ×1.6 fee.
2. **External IP Licensing inbound** — Accept / Counter / Reject with seeded starter offer.
3. **Sublicensing** — IP `sublicensable` flag in negotiation terms.
4. **Outbound IP Licensing** — list owned franchises for spin-off bids.
5. **Streaming tier fix** — 3 default tiers (Basic/Standard/Premium); per-movie tier-access picker for both add-to-catalog AND edit; license modal includes new exclusivity toggle (×1.6).
6. **Crossovers now require licensing** — when crossover involves a rival's franchise, player pays a dynamically-priced fee = 25M × popMult × ratingMult × depthMult to the franchise owner. Preview shown in create-movie summary; rival cash credited; news log entry generated.

## Known follow-ups (next iteration if requested)
- Multi-round counter UI with full price+exclusivity rounds spread across **bulk catalog packs** and **franchise quick-licenses** (currently only IP, streaming licenses and cinema deals have it).

## New / Updated Functions
- `addMovieToStreaming(state, serviceId, movieId, tierIds?)` — accepts optional tierIds for per-movie gating.
- `setMovieTierAccess(state, serviceId, movieId, tierIds[])` — update which tiers can stream an existing catalog movie. Empty array = all tiers.
- `acceptIPOffer / counterIPOffer / rejectIPOffer / quoteIPOffer` — inbound external IP negotiation.
- `createOutboundIPListing / acceptOutboundBid / rejectOutboundBid` — outbound sub-licensing.
- `proposeBulkCatalogLicense({..., exclusivity})` — exclusivity now negotiated and enforced at finalization.

## Run/Preview
- Expo dev server on port 3000 (tunnel via Emergent preview URL)
- No API keys required
- Works offline — all game data persisted locally

## Protected Files
- `/app/frontend/.env`, `/app/backend/.env` (recreated after re-import; gitignored upstream)
- `/app/.emergent/`, `/app/.git/`
- `/app/frontend/metro.config.js`
