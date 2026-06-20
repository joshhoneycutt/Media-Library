# Collections / Trilogies — Design Spec
_2026-05-25_

## Problem

The Google Sheet may have rows that represent a physical box set or trilogy (e.g. "Lord of the Rings Trilogy"). These rows should appear in the grid as individual film cards — one per film — while the Sheet entry stays as a single row. Films from the same collection must be visually grouped and kept adjacent in the grid.

## Goal

Expand `isCollection` Sheet rows into individual film cards at runtime, using TMDB's collection API for film data, with no changes to the Google Sheet.

---

## Architecture & Data Flow

### Collection expansion — store level

1. `collectionStore` parses the Sheet as normal. `isCollection: true` rows remain in `movies`.
2. `collectionStore` exposes a new computed property `expandedMovies`:
   - For each regular movie: pass through unchanged.
   - For each `isCollection: true` movie: replace it with an array of virtual film entries (one per TMDB collection part). If TMDB collection data is not yet loaded, render the original collection row as a single placeholder card.
3. `CollectionView` and `MovieDetailView` use `expandedMovies` instead of `movies`.
4. `tmdbStore` gains a new `collections` state map and `fetchCollection(movie)` action (see below).

### Virtual film shape

```js
{
  id: "fellowship-of-the-ring",          // slugified film title
  title: "The Fellowship of the Ring",
  formats: ["4K"],                        // inherited from parent row
  notes: [],                              // inherited from parent row
  genre: "Fantasy",                       // inherited from parent row
  subGenre: "",                           // inherited from parent row
  isCollection: false,
  collectionId: "lord-of-the-rings-trilogy",  // parent row's id
  collectionName: "Lord of the Rings Trilogy",
  collectionColor: "#5b8dd9",             // deterministic from collection name
  tmdbId: 120,                            // TMDB film ID from collection parts
}
```

### TMDB store changes

**New state:**
```js
collections: {}
// shape: { [collectionSlug]: { tmdbCollectionId, name, parts: [{ tmdbId, title, posterPath, year }] } }
```

**New action `fetchCollection(movie)`:**
1. Search TMDB: `GET /search/collection?query={movie.title}` — take `results[0]`
2. Fetch parts: `GET /collection/{collection_id}` → `{ id, name, parts: [{ id, title, poster_path, release_date }] }`
3. Map parts to `{ tmdbId, title, posterPath, year }` sorted by `release_date` ascending
4. Store under `this.collections[movie.id]`
5. Persist to `localStorage('library_tmdb_collections')`

**Modified `fetchForMovie(movie)`:**
- If `movie.isCollection`: call `fetchCollection(movie)` instead of existing enrichment logic

**Modified `init()`:**
- After loading TMDB cache from localStorage, also load `library_tmdb_collections` into `this.collections`

**New getter `getCollectionParts(collectionSlug)`:**
- Returns `this.collections[collectionSlug]?.parts ?? []`

**New getter `getCollectionData(collectionSlug)`:**
- Returns `this.collections[collectionSlug] ?? null`

### Individual film TMDB data

Full film data (runtime, director, cast, overview, backdrop) is fetched lazily. When `MovieDetailView` mounts for a virtual film (identified by `movie.tmdbId` being set and `movie.isCollection === false` with a `collectionId`), it calls `tmdb.fetchForMovieById(movie)` — a new action that calls `enrichById(movie.tmdbId, apiKey)` and stores the result under `movie.id` in `this.cache`.

**New action `fetchForMovieById(movie)`:**
- Calls `enrichById(movie.tmdbId, this.apiKey)`
- Stores result in `this.cache[movie.id]`
- Calls `_saveCache()`

### Collection color

A deterministic function maps a collection name string to one of 8 fixed accent colors:
```js
const COLLECTION_COLORS = ['#5b8dd9','#e8734a','#7bc67e','#c97fd4','#e8c84a','#4ac4d4','#d45a5a','#8a7bd4']
function collectionColor(name) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  return COLLECTION_COLORS[Math.abs(hash) % COLLECTION_COLORS.length]
}
```

Defined once in `src/utils/collectionColor.js`, imported by the store and components.

---

## Components & Changes

### Modified: `src/stores/collection.js`

- Add computed `expandedMovies`: flattens `isCollection` rows using `tmdbStore.getCollectionParts`
- Virtual film entries built from parts + parent row data + `collectionColor()`
- `onMounted` in `CollectionView` triggers `tmdb.fetchCollection` for each `isCollection` movie

### Modified: `src/stores/tmdb.js`

- Add `collections: {}` state
- Add `fetchCollection(movie)` action
- Add `fetchForMovieById(movie)` action
- Add `getCollectionParts(slug)` getter
- Add `getCollectionData(slug)` getter
- Modify `fetchForMovie(movie)`: route collections to `fetchCollection`
- Modify `init()`: load `library_tmdb_collections` from localStorage

### New: `src/utils/collectionColor.js`

- Exports `collectionColor(name)` function

### Modified: `src/components/MovieCard.vue`

- Accept optional `collectionId`, `collectionName`, `collectionColor` props (passed through from parent)
- If `collectionId` present:
  - Render a 4px solid stripe at the very top of the poster using `collectionColor`
  - Render a small pill label (collection name, truncated to ~12 chars + ellipsis) just below the stripe

### Modified: `src/views/CollectionView.vue`

- Use `collectionStore.expandedMovies` instead of `collectionStore.movies`
- On mounted: for each `isCollection` movie in raw `movies`, call `tmdb.fetchCollection(movie)` if not already loaded
- Sort: primary key = `collectionId ?? ''`, secondary key = existing sort field. This keeps siblings adjacent while respecting the user's chosen sort for the overall list. Regular movies sort among themselves normally; collection groups sort as a block by the group's first film's sort value.

### Modified: `src/views/MovieDetailView.vue`

- Use `collectionStore.expandedMovies` to resolve the movie by route param id
- On mounted: if `movie.tmdbId` and no cached TMDB data, call `tmdb.fetchForMovieById(movie)`
- Add "In this Collection" section (rendered if `movie.collectionId`):
  - Section heading: collection name
  - Horizontal scrolling row of sibling poster cards (~80px wide, 2:3 ratio)
  - Each sibling card: poster image (or placeholder), film title below
  - Current film visually distinguished: 60% opacity + outline ring
  - Clicking a sibling navigates to that film's detail route

---

## Error Handling

- **Collection search returns no results**: keep the original `isCollection` row as a single card; show a placeholder poster with the collection title
- **Individual film TMDB fetch fails**: show poster placeholder on detail page; rest of page still renders with collection info
- **`library_tmdb_collections` corrupted in localStorage**: catch parse error, treat as empty, re-fetch on next load

---

## Out of Scope

- Manually specifying which films are in a collection (TMDB is the source of truth)
- Partial collections (user owns 3 of 5 films — all TMDB parts are shown)
- Override support for collection TMDB ID (separate feature)
- Editing collection membership from the UI
