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
  index.tsx           # Home — song list, setlist dropdown, PDF export
  add-song.tsx        # Add song (search UG, URL import, or manual paste)
  song/[id].tsx       # Song detail — view, transpose, export, delete, manage setlists
src/
  components/         # SongCard, SongPreview, TransposeControls, SearchResultCard,
                      # SetlistDropdown, SetlistNameModal, SetlistManager
  constants/theme.ts  # Colors, spacing, typography tokens
  db/
    songs.ts          # All DB operations (songs + setlists, SQLite + localStorage)
    native-db.ts      # Base file for tsc resolution (re-exports native-db.native)
    native-db.native.ts  # SQLite init + schema (songs, setlists, setlist_songs tables)
    native-db.web.ts     # Web stub (throws — web uses localStorage)
  models/Song.ts      # TypeScript interfaces (Song, ScrapedSong, SearchResult, Setlist, etc.)
  services/           # scraper.ts, search.ts, transpose.ts, pdf-generator.ts, pdf-styles.ts
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

## UG Scraping Notes
- UG embeds page data in `<div class="js-store" data-content="...">` JSON blob
- Tab pages: data at `store.store.page.data.tab_view` / `store.store.page.data.tab`
- Search pages: data at `store.store.page.data.results` — requires **desktop** User-Agent (mobile site loads results client-side and the js-store has no data)
- `fetchUGPage()` in scraper.ts accepts `{ desktop: true }` option for this
- Search results grouped by artist+title in UI; user picks a version before previewing

## Planned Features
Features to implement (one at a time, in order):

1. **Chord Diagrams** (next up)
   - Tap any chord in song view → full-screen modal with fingering diagram
   - Show multiple voicings for each chord
   - Visual fretboard with finger positions

2. **PDF Customization Suite**
   - Font size, column layout (1 vs 2), page size (Letter/A4)
   - Toggle cover page / table of contents
   - Custom title, song selection checkboxes
   - Chord color, margin controls

3. **Auto-scroll & Performance Mode**
   - Hands-free scrolling at configurable speed
   - Tap to pause/resume
   - Setlist playthrough (next/prev song navigation)

## Completed Features
- Multi-setlist support (many-to-many songs↔setlists, dropdown on home screen)
- In-app UG search with grouped results + version picker
- Custom app icon (guitar photo)
