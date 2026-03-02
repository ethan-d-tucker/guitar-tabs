# Guitar Tabs

React Native + Expo app for managing guitar chord sheets and tablature. Cross-platform: iOS, Android, Web.

## Tech Stack
- React Native 0.81.5, Expo ~54.0.0, Expo Router ~6.0.23 (file-based routing)
- TypeScript (strict mode)
- SQLite (native) / localStorage (web) dual storage backend
- chord-transposer for transposition, cheerio for HTML scraping

## Project Structure
```
app/                  # Expo Router pages
  _layout.tsx         # Root navigation layout
  index.tsx           # Home — song list + PDF export
  add-song.tsx        # Add song modal (URL import or manual paste)
  song/[id].tsx       # Song detail — view, transpose, export, delete
src/
  components/         # SongCard, SongPreview, TransposeControls
  constants/theme.ts  # Colors, spacing, typography tokens
  db/songs.ts         # All DB operations (SQLite + localStorage)
  models/Song.ts      # TypeScript interfaces (Song, ScrapedSong, etc.)
  services/           # scraper.ts, transpose.ts, pdf-generator.ts, pdf-styles.ts
  utils/              # chord-parser.ts, url-validator.ts
```

## Commands
- `npm start` — Expo dev server
- `npm run web` — Web dev
- `npm run ios` / `npm run android` — Native dev

## Key Conventions
- Strict TypeScript throughout; no implicit any
- Platform branching via `Platform.OS` checks (e.g., SQLite on native, localStorage on web)
- Web scraping uses CORS proxy (api.allorigins.win) on web platform
- Songs stored with raw `[ch]`/`[tab]` markup in rawContent, parsed at render time by chord-parser.ts
- Transposition stored as integer offset per song (transposeOffset field)
- Theme tokens defined in src/constants/theme.ts — use these instead of hardcoded values
- File-based routing via Expo Router in app/ directory

## Expo Go Compatibility
- Do NOT use the new `expo-file-system` API (`File`, `Paths` from `expo-file-system`). It causes native module conflicts ("item with same name already exists" at SyncFunctionDefinition). Use temp URIs from `expo-print` directly instead.
- Avoid `expo-file-system` imports entirely when possible — share files directly from temp URIs returned by other Expo APIs.
