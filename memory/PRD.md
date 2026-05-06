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
1. **Streaming exclusivity for catalog packs** — when player proposes a bulk catalog license to a rival, an `EXCLUSIVE` toggle (`pick-exclusive-toggle` in rivals.tsx) sets `exclusivity` on the offer. On acceptance, those movies are stripped from any other streaming service catalog, and the fee is multiplied 1.6×.
2. **External IP Licensing (inbound)** — agencies (books, video games, toys, sports, comics, music) periodically pitch IP licenses with negotiable fee, BO%, merch%, term years, packs, exclusivity, and sublicensable flags. Player can ACCEPT / COUNTER / REJECT in `/external-ip` page (Inbound tab). Accepted licenses appear in the My Licenses tab and can be attached to a new movie at creation time for popularity / fame / BO boosts.
3. **Sublicensing flag** — IP offers carry a `sublicensable: boolean` term so studios can negotiate the right to sub-license to rivals.
4. **Outbound IP Licensing (sublicense own franchises)** — player lists owned franchises as IP for spin-off products (book / game / toy / sports / comic / music). External agencies bid with upfront + ongoing royalty %; royalties paid quarterly in `processOutboundRoyalties` during `simulateWeek`.
5. **Streaming tier fix** — three default tiers (Basic / Standard / Premium). Per-movie tier access is now editable from the catalog list:
    - When adding a player-owned movie to a service catalog, a tier-picker modal opens with quick-picks (All Tiers / Top-tier-only) plus modular toggles per tier.
    - Each catalog row shows a 📺 tier-access label and a `layers-edit` icon to re-edit at any time via the `setMovieTierAccess` action.
    - Licensed-in titles already supported tier selection at the license modal.

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
