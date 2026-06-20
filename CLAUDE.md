# Media Library — Claude context

## Two-server architecture

This app requires two Node processes running simultaneously:

| Process | Command | Port | Purpose |
|---|---|---|---|
| Vite dev server | `npm run dev` | 5173 | Frontend (Vue 3) |
| API server | `npm run api` | 3334 | Google Sheets write-back |

Vite proxies `/api/review` → `http://localhost:3334` and `/api/sheet` → Google Sheets public CSV.

When helping with tasks, remind the user to run both servers if relevant.

## Key files

- `src/views/MovieDetailView.vue` — film detail page (rating, review, TMDB data, Oscar data)
- `src/views/CollectionView.vue` — main grid/list view with filters
- `src/App.vue` — nav, settings panel, theme switcher
- `src/assets/main.css` — CSS custom properties for all themes
- `src/components/StarRating.vue` — 0–5 half-star interactive rating
- `src/services/review.js` — read/write reviews (localStorage + sheet sync)
- `src/services/sheets.js` — CSV parsing and sheet fetch helpers
- `src/services/tmdb.js` — TMDB API calls
- `src/stores/collection.js` — Pinia store: movie list, filters, sync
- `src/stores/tmdb.js` — Pinia store: TMDB cache, enrichment
- `scripts/api-server.mjs` — Node HTTP server on port 3334; writes Rating/Review columns to sheet
- `scripts/fetch-tmdb.mjs` — CLI: enrich collection with TMDB metadata
- `scripts/update-sheet-runtime.mjs` — CLI: write runtime data back to sheet
- `vite.config.js` — proxy config, aliases

## Themes

Themes are applied via `data-theme` on `<html>` and persisted in `localStorage`.

| Theme | Key | Description |
|---|---|---|
| Red (default) | `red` | Dark background, red accent |
| Blockbuster | `blockbuster` | Navy blue background, yellow accent, popcorn background |

Add new themes by adding a CSS block in `main.css` and an entry in the `themes` array in `App.vue`.

## Google Sheets auth

- Credentials: `google-credentials.json` (OAuth 2.0 Desktop app, from Google Cloud Console)
- Token: `google-token.json` (auto-generated on first auth, auto-refreshed)
- Sheet ID: stored in `.env.local` as `GOOGLE_SHEET_ID` (not committed)
- If token is invalid, `npm run api` prints a re-auth URL and waits on port 3335

## Data flow

- **Reading collection**: Vite proxies `/api/sheet` → Google Sheets public CSV → `sheets.js` parses → `collection` store
- **Reading TMDB**: `tmdb` store fetches from TMDB API, caches in `localStorage` and `public/tmdb-cache.json`
- **Writing ratings/reviews**: `review.js` saves to `localStorage` immediately, then POSTs to `/api/review` → `api-server.mjs` → Google Sheets API
