# TMDB Override UI — Design Spec
_2026-05-25_

## Problem

TMDB enrichment searches by title and takes `results[0]`. For movies with common names, remakes, or ambiguous titles this returns the wrong movie — wrong poster, wrong year, wrong cast.

## Goal

Let the user pick the correct TMDB match from the movie detail page and make that correction permanent without touching the code.

---

## Architecture & Data Flow

### Override storage — three layers, highest priority wins

1. **`public/tmdb-overrides.json`** — permanent file in the repo. Maps slug → TMDB ID:
   ```json
   { "heat": 949, "the-fly": 4538 }
   ```
   Committed to git. Loaded at app startup by `tmdbStore.init()`. Also read by `scripts/fetch-tmdb.mjs` before searching — if an override exists the script fetches by ID directly instead of searching by title, so regenerating the cache never re-introduces the wrong match.

2. **`localStorage` (`library_tmdb_overrides`)** — where new overrides land immediately. Merged on top of the JSON file at startup.

3. **TMDB store cache** (`this.cache`) — unchanged shape. Overrides control which TMDB record gets written under a movie's slug key; the rest of the app is unaware of the override system.

### Fix flow (runtime)

```
User clicks "Fix TMDB match"
  → modal opens, search input pre-filled with movie title
  → user types / edits query → TMDB search results appear
  → user clicks correct result
  → store fetches full data for that TMDB ID
  → saves { slug → tmdbId } to localStorage overrides
  → updates this.cache[movie.id] in place
  → modal closes, MovieDetailView re-renders with correct data
```

### Making fixes permanent

```
User clicks "Export overrides"
  → merges public/tmdb-overrides.json entries + localStorage entries
  → downloads merged result as tmdb-overrides.json
  → user drops file into public/
  → next `node scripts/fetch-tmdb.mjs` run uses it
  → public/tmdb-cache.json regenerated correctly
```

---

## Components & Changes

### New: `OverrideModal.vue`
- Triggered by "Fix TMDB match" button on `MovieDetailView`
- Search input pre-filled with movie title, debounced search against TMDB (300ms after last keystroke), reusing `searchMovie` from `src/services/tmdb.js`
- Results list: poster thumbnail (50px), title, year, TMDB ID
- "Export overrides" button shown when `localStorage` overrides exist (non-empty)
- Closes on selection or clicking outside

### Modified: `MovieDetailView.vue`
- Add small "Fix TMDB match" button in metadata section (admin-looking, not prominent)
- Import and mount `OverrideModal`

### Modified: `src/stores/tmdb.js`
- `init()`: after loading `public/tmdb-overrides.json` and localStorage cache, also load `localStorage` overrides (`library_tmdb_overrides`) and store in `this.overrides`
- New action `applyOverride(movieSlug, tmdbId)`: fetches full TMDB data by ID using `this.apiKey`, writes to `this.cache[movieSlug]`, persists via the existing `library_tmdb_cache` localStorage mechanism (so the correct data survives page reload without re-fetching), saves slug→tmdbId to `this.overrides` and persists to `library_tmdb_overrides` localStorage
- New getter `hasOverrides`: true when `Object.keys(this.overrides).length > 0`
- New action `exportOverrides()`: fetches `public/tmdb-overrides.json`, merges with `this.overrides` (localStorage overrides win on conflict), triggers browser download of merged result

### Modified: `scripts/fetch-tmdb.mjs`
- At startup, attempt to read `public/tmdb-overrides.json`
- For each movie in the queue: if its slug is in overrides, fetch TMDB by ID directly; otherwise search by title as before

---

## Error Handling

- **No API key**: "Fix TMDB match" button hidden if `!tmdbStore.hasApiKey` (same guard as existing enrichment)
- **Search returns no results**: show "No results" state in modal
- **TMDB fetch fails**: show inline error in modal, override not saved
- **Export**: if `public/tmdb-overrides.json` fails to load (404), treat as empty and export localStorage overrides only

---

## Out of Scope

- Bulk override management UI (list/delete overrides)
- Syncing overrides back to the repo automatically (manual file drop is intentional)
- Override support for awards cache
