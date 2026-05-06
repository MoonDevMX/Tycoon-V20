# Moon Cinema Tycoon (BetaTycoon V15)

## Source
- GitHub: https://github.com/MoonDevMX/BetaTycoon.git
- Branch: V15
- Imported into /app on Feb 2026

## App Summary
Offline film-studio tycoon game built with Expo Router + React Native. Players run a studio, create movies, hire talent, build franchises, manage cinema releases, streaming deals, festivals, awards, and marketing.

## Architecture
- **Frontend**: Expo Router (file-based routing) under `/app/frontend/app/`
  - Core screens: index (home), setup, dashboard, movies, create-movie, talent, cinemas, streaming, franchises, marketing, negotiate, festivals, awards, trends, rivals, studio-stats, offers, calendar
  - Game logic in `/app/frontend/src/game/` (state.tsx, sim.ts, data.ts, types.ts, draft.tsx, marketing.ts)
  - UI components in `/app/frontend/src/ui/`
- **Persistence**: AsyncStorage (key: `mooncinema_save_v8`) — fully offline, no network calls
- **Backend**: Default FastAPI starter (unused by the game; kept for Emergent platform compatibility)

## Run/Preview
- Expo dev server on port 3000 (tunnel via Emergent preview URL)
- No API keys or credentials required
- Works offline — all game data persisted locally in the browser/device

## Protected Files Preserved During Import
- `/app/frontend/.env`, `/app/backend/.env`
- `/app/.emergent/`, `/app/.git/`
- `/app/frontend/metro.config.js` (identical to repo version)
