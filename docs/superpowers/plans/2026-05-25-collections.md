# Collections / Trilogies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `isCollection` Sheet rows into individual film cards in the grid using TMDB's collection API, with a colored stripe + label visually grouping them, siblings kept adjacent, and an "In this Collection" rail on each film's detail page.

**Architecture:** `tmdbStore` gains a `collections` state map and `fetchCollection` action that calls TMDB `/search/collection` then `/collection/{id}`. `collectionStore` gains an `expandedMovies` getter that replaces `isCollection` rows with virtual film entries (one per part). `CollectionView` uses `expandedMovies`, triggers collection fetches on mount, and groups siblings together in sort. `MovieDetailView` resolves movies from `expandedMovies` and shows a horizontal sibling rail via a new `CollectionRail` component.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Pinia (options store), Vitest + jsdom, TMDB REST API v3 (`/search/collection`, `/collection/{id}`)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/utils/collectionColor.js` | Deterministic accent color from collection name |
| Create | `src/utils/__tests__/collectionColor.test.js` | Tests for collectionColor |
| Modify | `src/services/tmdb.js` | Add `searchCollection`, `fetchCollectionById` exports |
| Modify | `src/services/__tests__/tmdb.test.js` | Tests for the two new service functions |
| Modify | `src/stores/tmdb.js` | Add `collections` state, getters, `fetchCollection`, `fetchForMovieById` |
| Modify | `src/stores/__tests__/tmdb.test.js` | Tests for new store additions |
| Modify | `src/stores/collection.js` | Add `expandedMovies` getter |
| Modify | `src/stores/__tests__/collection.test.js` | Tests for `expandedMovies` |
| Modify | `src/components/MovieCard.vue` | Colored stripe + collection name label for collection films |
| Modify | `src/views/CollectionView.vue` | Use `expandedMovies`, trigger fetches on mount, group-aware sort |
| Create | `src/components/CollectionRail.vue` | Horizontal sibling film poster row |
| Modify | `src/views/MovieDetailView.vue` | Resolve from `expandedMovies`, lazy-fetch by TMDB ID, show rail |

---

### Task 1: collectionColor utility and TMDB collection service functions

**Files:**
- Create: `src/utils/collectionColor.js`
- Create: `src/utils/__tests__/collectionColor.test.js`
- Modify: `src/services/tmdb.js` (append 2 exports)
- Modify: `src/services/__tests__/tmdb.test.js` (append tests)

- [ ] **Step 1: Write failing tests for collectionColor**

Create `src/utils/__tests__/collectionColor.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { collectionColor } from '../collectionColor.js'

describe('collectionColor', () => {
  it('returns a hex color string', () => {
    expect(collectionColor('Lord of the Rings Trilogy')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('returns the same color for the same name', () => {
    expect(collectionColor('Indiana Jones')).toBe(collectionColor('Indiana Jones'))
  })

  it('handles empty string without throwing', () => {
    expect(collectionColor('')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/utils/__tests__/collectionColor.test.js
```

Expected: FAIL — cannot find module `../collectionColor.js`.

- [ ] **Step 3: Create `src/utils/collectionColor.js`**

```js
const COLLECTION_COLORS = ['#5b8dd9','#e8734a','#7bc67e','#c97fd4','#e8c84a','#4ac4d4','#d45a5a','#8a7bd4']

export function collectionColor(name) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  return COLLECTION_COLORS[Math.abs(hash) % COLLECTION_COLORS.length]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/utils/__tests__/collectionColor.test.js
```

Expected: PASS (3 tests).

- [ ] **Step 5: Write failing tests for the two new TMDB service functions**

Append to `src/services/__tests__/tmdb.test.js` (after existing tests):

```js
import { searchCollection, fetchCollectionById } from '../tmdb.js'

describe('searchCollection', () => {
  it('returns the first TMDB collection result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: 119, name: 'Lord of the Rings Collection' }] })
    }))
    const result = await searchCollection('Lord of the Rings Trilogy', 'test-key')
    expect(result).toEqual({ id: 119, name: 'Lord of the Rings Collection' })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('search/collection'),
      expect.objectContaining({ headers: { Authorization: 'Bearer test-key' } })
    )
  })

  it('returns null when results are empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] })
    }))
    expect(await searchCollection('nothing', 'key')).toBeNull()
  })

  it('throws on non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(searchCollection('test', 'bad')).rejects.toThrow('401')
  })
})

describe('fetchCollectionById', () => {
  it('returns parts sorted by year with mapped fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 119,
        name: 'Lord of the Rings Collection',
        parts: [
          { id: 122, title: 'The Return of the King', poster_path: '/c.jpg', release_date: '2003-12-17' },
          { id: 120, title: 'The Fellowship of the Ring', poster_path: '/a.jpg', release_date: '2001-12-19' },
          { id: 121, title: 'The Two Towers', poster_path: '/b.jpg', release_date: '2002-12-18' }
        ]
      })
    }))
    const result = await fetchCollectionById(119, 'test-key')
    expect(result.tmdbCollectionId).toBe(119)
    expect(result.name).toBe('Lord of the Rings Collection')
    expect(result.parts).toHaveLength(3)
    expect(result.parts[0].tmdbId).toBe(120)
    expect(result.parts[1].tmdbId).toBe(121)
    expect(result.parts[2].tmdbId).toBe(122)
    expect(result.parts[0].posterPath).toBe('https://image.tmdb.org/t/p/w500/a.jpg')
    expect(result.parts[0].year).toBe(2001)
  })

  it('handles null poster_path', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        name: 'Test',
        parts: [{ id: 2, title: 'Film', poster_path: null, release_date: '2020-01-01' }]
      })
    }))
    const result = await fetchCollectionById(1, 'key')
    expect(result.parts[0].posterPath).toBeNull()
  })

  it('throws on non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(fetchCollectionById(999, 'key')).rejects.toThrow('404')
  })
})
```

- [ ] **Step 6: Run service tests to verify they fail**

```
npx vitest run src/services/__tests__/tmdb.test.js
```

Expected: 6 new tests FAIL — `searchCollection` and `fetchCollectionById` are not exported.

- [ ] **Step 7: Append `searchCollection` and `fetchCollectionById` to `src/services/tmdb.js`**

Append after the existing `enrichById` function:

```js
export async function searchCollection(title, apiKey) {
  const url = `${BASE}/search/collection?query=${encodeURIComponent(title)}&page=1`
  const res = await fetch(url, { headers: authHeaders(apiKey) })
  if (!res.ok) throw new Error(`TMDB collection search failed: ${res.status}`)
  const data = await res.json()
  return data.results[0] || null
}

export async function fetchCollectionById(collectionId, apiKey) {
  const res = await fetch(`${BASE}/collection/${collectionId}`, { headers: authHeaders(apiKey) })
  if (!res.ok) throw new Error(`TMDB collection fetch failed: ${res.status}`)
  const data = await res.json()
  return {
    tmdbCollectionId: data.id,
    name: data.name,
    parts: data.parts
      .map(p => ({
        tmdbId: p.id,
        title: p.title,
        posterPath: p.poster_path ? `${IMG_BASE}/w500${p.poster_path}` : null,
        year: p.release_date ? parseInt(p.release_date.slice(0, 4)) : null
      }))
      .sort((a, b) => (a.year || 9999) - (b.year || 9999))
  }
}
```

- [ ] **Step 8: Run all service tests to verify they pass**

```
npx vitest run src/services/__tests__/tmdb.test.js
```

Expected: all tests PASS (existing 8 + new 6 = 14 tests).

- [ ] **Step 9: Commit**

```bash
git add src/utils/collectionColor.js src/utils/__tests__/collectionColor.test.js src/services/tmdb.js src/services/__tests__/tmdb.test.js
git commit -m "feat: add collectionColor utility and TMDB collection service functions"
```

---

### Task 2: TMDB store — collections state, getters, and actions

**Files:**
- Modify: `src/stores/tmdb.js`
- Modify: `src/stores/__tests__/tmdb.test.js`

Context: `src/stores/__tests__/tmdb.test.js` has a `vi.mock('@/services/tmdb.js', ...)` at the top that mocks `enrichMovie`, `enrichById`, `searchMovies`. You must extend it to also mock `searchCollection` and `fetchCollectionById`.

- [ ] **Step 1: Write failing tests**

At the top of `src/stores/__tests__/tmdb.test.js`, update the mock and import lines:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { enrichById, searchCollection, fetchCollectionById } from '@/services/tmdb.js'
import { useTmdbStore } from '../tmdb.js'

vi.mock('@/services/tmdb.js', () => ({
  enrichMovie: vi.fn(),
  enrichById: vi.fn(),
  searchMovies: vi.fn(),
  searchCollection: vi.fn(),
  fetchCollectionById: vi.fn(),
}))
```

Then append after the existing test blocks:

```js
describe('tmdb store — fetchCollection', () => {
  beforeEach(() => {
    searchCollection.mockReset()
    fetchCollectionById.mockReset()
    stubFetch({})
  })

  it('fetches and stores collection parts in this.collections', async () => {
    searchCollection.mockResolvedValue({ id: 119 })
    fetchCollectionById.mockResolvedValue({
      tmdbCollectionId: 119,
      name: 'LotR Collection',
      parts: [{ tmdbId: 120, title: 'Fellowship', posterPath: null, year: 2001 }]
    })
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    await store.fetchCollection({ id: 'lord-of-the-rings-trilogy', title: 'Lord of the Rings Trilogy' })
    expect(store.collections['lord-of-the-rings-trilogy']).toMatchObject({
      tmdbCollectionId: 119,
      parts: [expect.objectContaining({ tmdbId: 120 })]
    })
    const saved = JSON.parse(localStorage.getItem('library_tmdb_collections'))
    expect(saved['lord-of-the-rings-trilogy']).toMatchObject({ tmdbCollectionId: 119 })
  })

  it('does nothing when collection is already loaded', async () => {
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    store.collections['already-loaded'] = { tmdbCollectionId: 1, name: 'X', parts: [] }
    await store.fetchCollection({ id: 'already-loaded', title: 'Already Loaded' })
    expect(searchCollection).not.toHaveBeenCalled()
  })

  it('does nothing without apiKey', async () => {
    const store = useTmdbStore()
    store.apiKey = ''
    await store.fetchCollection({ id: 'test', title: 'Test' })
    expect(searchCollection).not.toHaveBeenCalled()
  })

  it('does nothing when TMDB search returns null', async () => {
    searchCollection.mockResolvedValue(null)
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    await store.fetchCollection({ id: 'unknown', title: 'Unknown' })
    expect(store.collections['unknown']).toBeUndefined()
  })
})

describe('tmdb store — fetchForMovieById', () => {
  beforeEach(() => {
    enrichById.mockReset()
    stubFetch({})
  })

  it('calls enrichById and stores result in cache', async () => {
    enrichById.mockResolvedValue({ tmdbId: 120, posterPath: '/p.jpg', year: 2001, runtime: 178, voteAverage: 8.9, overview: '', director: 'Jackson', cast: [], backdropPath: null, enrichedAt: 1 })
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    await store.fetchForMovieById({ id: 'fellowship-of-the-ring', tmdbId: 120 })
    expect(enrichById).toHaveBeenCalledWith(120, 'test-key')
    expect(store.cache['fellowship-of-the-ring']).toMatchObject({ tmdbId: 120, year: 2001 })
  })

  it('does nothing when id is already in cache', async () => {
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    store.cache['fellowship-of-the-ring'] = { tmdbId: 120 }
    await store.fetchForMovieById({ id: 'fellowship-of-the-ring', tmdbId: 120 })
    expect(enrichById).not.toHaveBeenCalled()
  })

  it('does nothing when tmdbId is falsy', async () => {
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    await store.fetchForMovieById({ id: 'some-film', tmdbId: null })
    expect(enrichById).not.toHaveBeenCalled()
  })
})

describe('tmdb store — getCollectionParts', () => {
  it('returns parts array for a known collection', () => {
    const store = useTmdbStore()
    store.collections['lotr'] = { tmdbCollectionId: 119, name: 'LotR', parts: [{ tmdbId: 120, title: 'Fellowship', posterPath: null, year: 2001 }] }
    expect(store.getCollectionParts('lotr')).toEqual([{ tmdbId: 120, title: 'Fellowship', posterPath: null, year: 2001 }])
  })

  it('returns empty array for unknown collection', () => {
    const store = useTmdbStore()
    expect(store.getCollectionParts('not-a-collection')).toEqual([])
  })
})

describe('tmdb store — init loads collections from localStorage', () => {
  it('populates this.collections from library_tmdb_collections', async () => {
    localStorage.setItem('library_tmdb_collections', JSON.stringify({
      'lotr': { tmdbCollectionId: 119, name: 'LotR', parts: [] }
    }))
    stubFetch({})
    const store = useTmdbStore()
    await store.init()
    expect(store.collections['lotr']).toMatchObject({ tmdbCollectionId: 119 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/stores/__tests__/tmdb.test.js
```

Expected: new tests FAIL — `store.collections` is undefined, `store.fetchCollection` is not a function, etc.

- [ ] **Step 3: Update `src/stores/tmdb.js`**

**3a. Update import line** (first line of file):

```js
import { enrichMovie, enrichById, searchCollection, fetchCollectionById } from '@/services/tmdb.js'
```

**3b. Add `collections` to state:**

```js
state: () => ({
  apiKey: localStorage.getItem(API_KEY_STORAGE) || '',
  cache: {},
  awardsCache: {},
  overrides: {},
  collections: {},
  enriching: false,
  enrichProgress: { current: 0, total: 0 },
  _cancelEnrich: false
}),
```

**3c. Add two new getters** (after `hasOverrides`):

```js
getCollectionParts: (state) => (slug) => state.collections[slug]?.parts ?? [],
getCollectionData: (state) => (slug) => state.collections[slug] ?? null,
```

**3d. Add loading of `library_tmdb_collections` in `init()`** (after the existing overrides loading block):

```js
// Load collections (TMDB collection parts for isCollection rows)
try {
  const raw = localStorage.getItem('library_tmdb_collections')
  if (raw) this.collections = JSON.parse(raw)
} catch {}
```

**3e. Add `fetchCollection` action** (after the `exportOverrides` action):

```js
async fetchCollection(movie) {
  if (this.collections[movie.id] || !this.apiKey) return
  try {
    const match = await searchCollection(movie.title, this.apiKey)
    if (!match) return
    const data = await fetchCollectionById(match.id, this.apiKey)
    this.collections[movie.id] = data
    localStorage.setItem('library_tmdb_collections', JSON.stringify(this.collections))
  } catch {
    // silently skip failed collection fetches
  }
},
```

**3f. Add `fetchForMovieById` action** (after `fetchCollection`):

```js
async fetchForMovieById(movie) {
  if (this.cache[movie.id] || !this.apiKey || !movie.tmdbId) return
  try {
    const data = await enrichById(movie.tmdbId, this.apiKey)
    if (data) {
      this.cache[movie.id] = data
      this._saveCache()
    }
  } catch {
    // silently skip
  }
},
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/stores/__tests__/tmdb.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/tmdb.js src/stores/__tests__/tmdb.test.js
git commit -m "feat: add collections state, fetchCollection, and fetchForMovieById to tmdb store"
```

---

### Task 3: Collection store — expandedMovies getter

**Files:**
- Modify: `src/stores/collection.js`
- Modify: `src/stores/__tests__/collection.test.js`

Context: `expandedMovies` replaces each `isCollection` row with virtual film entries from `tmdbStore.getCollectionParts`. It calls `useTmdbStore()` inside the getter — this is valid Pinia cross-store access. Tests must call `setActivePinia(createPinia())` and set up both stores before asserting.

- [ ] **Step 1: Write failing tests**

Append to `src/stores/__tests__/collection.test.js`:

```js
import { useTmdbStore } from '../tmdb.js'

// The vi.mock at the top of the file is needed because collection.js imports tmdb.js
// which imports from @/services/tmdb.js. Add this mock at the very top of the file:
// vi.mock('@/services/tmdb.js', () => ({
//   enrichMovie: vi.fn(), enrichById: vi.fn(), searchMovies: vi.fn(),
//   searchCollection: vi.fn(), fetchCollectionById: vi.fn(),
// }))

describe('expandedMovies', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('passes regular movies through unchanged', () => {
    const store = useCollectionStore()
    store.movies = [{
      id: 'heat', title: 'Heat', sortKey: 'heat',
      genre: 'Action', subGenre: '', formats: ['4K'], notes: [], isCollection: false
    }]
    expect(store.expandedMovies).toHaveLength(1)
    expect(store.expandedMovies[0].id).toBe('heat')
    expect(store.expandedMovies[0].isCollection).toBe(false)
  })

  it('expands an isCollection row into one virtual entry per TMDB part', () => {
    const tmdb = useTmdbStore()
    tmdb.collections['lord-of-the-rings-trilogy'] = {
      tmdbCollectionId: 119,
      name: 'Lord of the Rings Collection',
      parts: [
        { tmdbId: 120, title: 'The Fellowship of the Ring', posterPath: null, year: 2001 },
        { tmdbId: 121, title: 'The Two Towers', posterPath: null, year: 2002 },
        { tmdbId: 122, title: 'The Return of the King', posterPath: null, year: 2003 }
      ]
    }
    const store = useCollectionStore()
    store.movies = [{
      id: 'lord-of-the-rings-trilogy',
      title: 'Lord of the Rings Trilogy',
      sortKey: 'lord of the rings trilogy',
      genre: 'Fantasy', subGenre: '',
      formats: ['4K'], notes: [],
      isCollection: true
    }]

    const expanded = store.expandedMovies
    expect(expanded).toHaveLength(3)
    expect(expanded[0].title).toBe('The Fellowship of the Ring')
    expect(expanded[0].id).toBe('the-fellowship-of-the-ring')
    expect(expanded[0].collectionId).toBe('lord-of-the-rings-trilogy')
    expect(expanded[0].collectionName).toBe('Lord of the Rings Trilogy')
    expect(expanded[0].formats).toEqual(['4K'])
    expect(expanded[0].notes).toEqual([])
    expect(expanded[0].genre).toBe('Fantasy')
    expect(expanded[0].tmdbId).toBe(120)
    expect(expanded[0].isCollection).toBe(false)
    expect(expanded[0].year).toBe(2001)
    expect(expanded[0].collectionColor).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('shows original collection row as placeholder when parts are not yet loaded', () => {
    const store = useCollectionStore()
    store.movies = [{
      id: 'indiana-jones-collection',
      title: 'Indiana Jones Collection',
      sortKey: 'indiana jones collection',
      genre: 'Action', subGenre: '',
      formats: ['Blu-ray'], notes: [],
      isCollection: true
    }]
    expect(store.expandedMovies).toHaveLength(1)
    expect(store.expandedMovies[0].id).toBe('indiana-jones-collection')
    expect(store.expandedMovies[0].isCollection).toBe(true)
  })

  it('all virtual films from the same collection share the same collectionColor', () => {
    const tmdb = useTmdbStore()
    tmdb.collections['test-col'] = {
      tmdbCollectionId: 1,
      name: 'Test Collection',
      parts: [
        { tmdbId: 1, title: 'Film One', posterPath: null, year: 2020 },
        { tmdbId: 2, title: 'Film Two', posterPath: null, year: 2021 }
      ]
    }
    const store = useCollectionStore()
    store.movies = [{
      id: 'test-col', title: 'Test Collection', sortKey: 'test collection',
      genre: 'Action', subGenre: '', formats: ['4K'], notes: [], isCollection: true
    }]
    const colors = store.expandedMovies.map(m => m.collectionColor)
    expect(colors[0]).toBe(colors[1])
  })
})
```

Note: the `collection.test.js` file will also need `vi.mock('@/services/tmdb.js', ...)` at the top because `collection.js` now imports `tmdb.js` which imports from the service. Add this as the first line after imports:

```js
vi.mock('@/services/tmdb.js', () => ({
  enrichMovie: vi.fn(),
  enrichById: vi.fn(),
  searchMovies: vi.fn(),
  searchCollection: vi.fn(),
  fetchCollectionById: vi.fn(),
}))
```

- [ ] **Step 2: Run failing tests**

```
npx vitest run src/stores/__tests__/collection.test.js
```

Expected: new tests FAIL — `store.expandedMovies` is undefined.

- [ ] **Step 3: Update `src/stores/collection.js`**

**3a. Add imports at top of file:**

```js
import { defineStore } from 'pinia'
import { fetchAllMedia, titleToSlug } from '@/services/sheets.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import { collectionColor } from '@/utils/collectionColor.js'
```

**3b. Add `expandedMovies` getter** (after `filteredMovies`):

```js
expandedMovies(state) {
  const tmdb = useTmdbStore()
  const result = []
  for (const movie of state.movies) {
    if (!movie.isCollection) {
      result.push(movie)
      continue
    }
    const parts = tmdb.getCollectionParts(movie.id)
    if (!parts.length) {
      result.push(movie)
      continue
    }
    const color = collectionColor(movie.title)
    for (const part of parts) {
      result.push({
        id: titleToSlug(part.title),
        title: part.title,
        sortKey: part.title.toLowerCase().trim().replace(/^(the |a |an )/, '').trim(),
        formats: movie.formats,
        notes: movie.notes,
        genre: movie.genre,
        subGenre: movie.subGenre,
        isCollection: false,
        collectionId: movie.id,
        collectionName: movie.title,
        collectionColor: color,
        tmdbId: part.tmdbId,
        year: part.year
      })
    }
  }
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/stores/__tests__/collection.test.js
```

Expected: all tests PASS (existing 6 + new 4 = 10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/collection.js src/stores/__tests__/collection.test.js
git commit -m "feat: add expandedMovies getter to collection store"
```

---

### Task 4: MovieCard — collection stripe and label

**Files:**
- Modify: `src/components/MovieCard.vue`

No automated test — verified visually in Task 5. `movie.collectionId`, `movie.collectionName`, and `movie.collectionColor` are already on virtual film objects from `expandedMovies`.

- [ ] **Step 1: Replace `src/components/MovieCard.vue` with the updated version**

```vue
<template>
  <router-link :to="{ name: 'movie', params: { id: movie.id } }" class="card">
    <div class="card-poster">
      <img v-if="posterSrc" :src="posterSrc" :alt="movie.title" loading="lazy" />
      <div v-else class="card-placeholder">
        <span>{{ movie.title }}</span>
      </div>
      <div
        v-if="movie.collectionId"
        class="collection-stripe"
        :style="{ background: movie.collectionColor }"
      ></div>
      <div v-if="movie.collectionId" class="collection-label">
        <span>{{ shortCollectionName }}</span>
      </div>
      <div class="card-badges">
        <FormatBadge :formats="movie.formats" :notes="movie.notes" />
      </div>
    </div>
    <div class="card-title">{{ movie.title }}</div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { useTmdbStore } from '@/stores/tmdb.js'
import FormatBadge from './FormatBadge.vue'

const props = defineProps({
  movie: { type: Object, required: true }
})

const tmdb = useTmdbStore()
const tmdbData = computed(() => tmdb.getMovieData(props.movie.id))
const posterSrc = computed(() => tmdbData.value?.posterPath || null)
const shortCollectionName = computed(() => {
  const name = props.movie.collectionName || ''
  return name.length > 16 ? name.slice(0, 14) + '…' : name
})
</script>

<style scoped>
.card { display: block; color: inherit; min-width: 0; }
.card:hover .card-poster { transform: scale(1.03); }
.card-poster {
  position: relative; aspect-ratio: 2/3;
  border-radius: var(--radius); overflow: hidden;
  background: var(--surface-2);
  transition: transform 0.2s ease;
}
.card-poster img { width: 100%; height: 100%; object-fit: cover; }
.card-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 0.75rem; text-align: center;
  font-size: 0.8rem; color: var(--text-2); line-height: 1.3;
}
.collection-stripe {
  position: absolute; top: 0; left: 0; right: 0; height: 4px; z-index: 1;
}
.collection-label {
  position: absolute; top: 7px; left: 0; right: 0;
  display: flex; justify-content: center; z-index: 1;
}
.collection-label span {
  background: rgba(0,0,0,0.72);
  color: #f5f5f5; font-size: 7px;
  padding: 2px 5px; border-radius: 3px;
  font-weight: 500; letter-spacing: 0.3px;
  white-space: nowrap; max-width: 90%; overflow: hidden; text-overflow: ellipsis;
}
.card-badges {
  position: absolute; bottom: 6px; right: 6px;
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
}
.card-title {
  margin-top: 0.4rem; font-size: 0.8rem;
  color: var(--text-2); line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MovieCard.vue
git commit -m "feat: add collection stripe and label to MovieCard"
```

---

### Task 5: CollectionView — expandedMovies, fetch trigger, grouping sort

**Files:**
- Modify: `src/views/CollectionView.vue`

Context: `CollectionView` currently uses `collection.filteredMovies` as the base for `displayMovies`. We replace that with `collection.expandedMovies` and inline the same filter logic. We also trigger `tmdb.fetchCollection` for each `isCollection` movie on mount. The A-Z/Z-A sort uses an `effectiveSortKey` helper so all films from the same collection sort as a block (stable sort preserves the chronological order within the block that `expandedMovies` already provides).

- [ ] **Step 1: Replace the `<script setup>` block of `src/views/CollectionView.vue`**

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCollectionStore } from '@/stores/collection.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import FilterBar from '@/components/FilterBar.vue'
import MovieCard from '@/components/MovieCard.vue'
import MovieRow from '@/components/MovieRow.vue'

const collection = useCollectionStore()
const tmdb = useTmdbStore()
const viewMode = ref('grid')
const searchQuery = ref('')
const runtimeFilter = ref('')
const oscarFilter = ref('')

onMounted(() => {
  for (const movie of collection.movies) {
    if (movie.isCollection) tmdb.fetchCollection(movie)
  }
})

function effectiveSortKey(movie) {
  if (movie.collectionId) {
    return movie.collectionName.toLowerCase().trim().replace(/^(the |a |an )/, '').trim()
  }
  return movie.sortKey
}

const displayMovies = computed(() => {
  const filters = collection.filters
  let movies = collection.expandedMovies

  if (filters.search) {
    const q = filters.search.toLowerCase()
    movies = movies.filter(m => m.title.toLowerCase().includes(q))
  }

  if (filters.genre) {
    movies = movies.filter(m => m.genre === filters.genre)
  }

  if (filters.format) {
    if (filters.format === 'Steelbook') {
      movies = movies.filter(m => m.notes.some(n => n.toLowerCase().includes('steelbook')))
    } else {
      movies = movies.filter(m => m.formats.includes(filters.format))
    }
  }

  if (runtimeFilter.value) {
    movies = movies.filter(m => {
      const rt = tmdb.cache[m.id]?.runtime
      if (!rt) return false
      if (runtimeFilter.value === 'short')  return rt < 90
      if (runtimeFilter.value === 'medium') return rt >= 90 && rt <= 120
      if (runtimeFilter.value === 'long')   return rt > 120
      return true
    })
  }

  if (oscarFilter.value) {
    movies = movies.filter(m => {
      const o = tmdb.awardsCache[m.id]
      if (!o) return false
      if (oscarFilter.value === 'winner')    return o.wins > 0
      if (oscarFilter.value === 'nominated') return o.nominations > 0
      return true
    })
  }

  const sort = filters.sort
  if (sort === 'az' || sort === 'za') {
    const dir = sort === 'za' ? -1 : 1
    movies = [...movies].sort((a, b) => dir * effectiveSortKey(a).localeCompare(effectiveSortKey(b)))
  } else if (sort === 'runtime-asc' || sort === 'runtime-desc') {
    const dir = sort === 'runtime-asc' ? 1 : -1
    movies = [...movies].sort((a, b) => {
      const ra = tmdb.cache[a.id]?.runtime
      const rb = tmdb.cache[b.id]?.runtime
      if (ra == null && rb == null) return 0
      if (ra == null) return 1
      if (rb == null) return -1
      return dir * (ra - rb)
    })
  } else if (sort === 'oscars-wins' || sort === 'oscars-noms') {
    const field = sort === 'oscars-wins' ? 'wins' : 'nominations'
    movies = [...movies].sort((a, b) => {
      const oa = tmdb.awardsCache[a.id]?.[field] ?? -1
      const ob = tmdb.awardsCache[b.id]?.[field] ?? -1
      return ob - oa
    })
  }

  return movies
})
</script>
```

The template remains identical — no changes needed. `MovieCard` now reads `movie.collectionColor` etc. directly from the movie object.

- [ ] **Step 2: Run all tests to confirm nothing is broken**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/views/CollectionView.vue
git commit -m "feat: use expandedMovies in CollectionView with collection grouping sort"
```

---

### Task 6: CollectionRail component and MovieDetailView "In this Collection" section

**Files:**
- Create: `src/components/CollectionRail.vue`
- Modify: `src/views/MovieDetailView.vue`

Context: `MovieDetailView` currently resolves the movie via `collection.movies.find(...)`. Virtual film IDs (e.g. `"fellowship-of-the-ring"`) are not in `collection.movies`, so this must change to `collection.expandedMovies.find(...)`. The `onMounted` hook must call `tmdb.fetchForMovieById(movie)` for virtual films (they have `movie.tmdbId` set) instead of the existing `enrich()` which calls `enrichMovie` by title.

- [ ] **Step 1: Create `src/components/CollectionRail.vue`**

```vue
<template>
  <div class="rail">
    <router-link
      v-for="film in siblings"
      :key="film.id"
      :to="{ name: 'movie', params: { id: film.id } }"
      class="rail-item"
      :class="{ current: film.id === currentId }"
    >
      <div class="rail-poster">
        <img v-if="posterFor(film)" :src="posterFor(film)" :alt="film.title" loading="lazy" />
        <div v-else class="rail-placeholder">{{ film.title }}</div>
      </div>
      <div class="rail-title">{{ film.title }}</div>
    </router-link>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTmdbStore } from '@/stores/tmdb.js'
import { useCollectionStore } from '@/stores/collection.js'

const props = defineProps({
  collectionId: { type: String, required: true },
  currentId: { type: String, required: true }
})

const tmdb = useTmdbStore()
const collection = useCollectionStore()

const siblings = computed(() =>
  collection.expandedMovies.filter(m => m.collectionId === props.collectionId)
)

function posterFor(film) {
  return tmdb.getMovieData(film.id)?.posterPath || null
}
</script>

<style scoped>
.rail {
  display: flex; gap: 0.75rem; overflow-x: auto;
  padding-bottom: 0.5rem;
}
.rail::-webkit-scrollbar { height: 4px; }
.rail::-webkit-scrollbar-track { background: var(--surface); }
.rail::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 2px; }
.rail-item {
  display: block; flex-shrink: 0; width: 80px; color: inherit;
  border-radius: var(--radius);
}
.rail-item.current {
  opacity: 0.5;
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.rail-poster {
  aspect-ratio: 2/3; border-radius: var(--radius);
  overflow: hidden; background: var(--surface-2);
}
.rail-poster img { width: 100%; height: 100%; object-fit: cover; }
.rail-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 0.4rem; text-align: center;
  font-size: 0.65rem; color: var(--text-2); line-height: 1.3;
}
.rail-title {
  margin-top: 0.3rem; font-size: 0.7rem; color: var(--text-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
</style>
```

- [ ] **Step 2: Update `src/views/MovieDetailView.vue`**

**2a. Add import** (after existing imports):

```js
import CollectionRail from '@/components/CollectionRail.vue'
```

**2b. Change the `movie` computed** from `collection.movies` to `collection.expandedMovies`:

```js
const movie = computed(() => collection.expandedMovies.find(m => m.id === route.params.id))
```

**2c. Replace the `onMounted` hook:**

```js
onMounted(async () => {
  if (!movie.value) return
  if (movie.value.tmdbId && !tmdbData.value) {
    enriching.value = true
    await tmdb.fetchForMovieById(movie.value)
    enriching.value = false
  } else if (!movie.value.isCollection && !movie.value.tmdbId && !tmdbData.value) {
    await enrich()
  }
})
```

**2d. Add "In this Collection" section to the template** — insert it between the Details section and the Your Copy section (between the `.details-grid` section and the `.your-copy` section):

```html
<section v-if="movie.collectionId" class="collection-rail-section">
  <h2>In this Collection</h2>
  <CollectionRail :collectionId="movie.collectionId" :currentId="movie.id" />
</section>
```

**2e. Add style** (in `<style scoped>`):

```css
.collection-rail-section { display: flex; flex-direction: column; gap: 0.75rem; }
```

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/CollectionRail.vue src/views/MovieDetailView.vue
git commit -m "feat: add CollectionRail and In this Collection section to MovieDetailView"
```

---

## Manual Verification

After all tasks complete, verify end-to-end:

1. Ensure your Google Sheet has at least one collection row whose title contains "trilogy", "collection", "anthology", "saga", or "box set" (e.g. `"Lord of the Rings Trilogy"` with genre `Fantasy` and format `4K`).
2. Run `npm run dev` — open the app at `http://localhost:5173`.
3. On the `CollectionView` grid: after a moment, the collection row should expand into 3 individual film cards, each with a blue stripe and truncated collection name label.
4. The 3 cards should appear adjacent in the grid (A-Z sort groups them together).
5. Click any film card — the detail page should show that film's TMDB data (may take a moment to load) and an "In this Collection" rail below the Details section.
6. The current film in the rail should be dimmed. Click a sibling film in the rail — it should navigate to that film's detail page.
7. Verify format badges (4K etc.) still appear on all collection film cards.
8. Verify search: searching "fellowship" should show only the Fellowship card (not all three LOTR films). Searching "lord of the rings" shows all three (title substring match against individual film titles).
