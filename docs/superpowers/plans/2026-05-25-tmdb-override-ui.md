# TMDB Override UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick the correct TMDB match for a movie from the detail page, saving the correction permanently so it survives cache regeneration.

**Architecture:** New `public/tmdb-overrides.json` holds permanent slug→tmdbId corrections. The tmdb Pinia store gains `overrides` state loaded at `init()` from the JSON file and `localStorage`. A new `OverrideModal.vue` on `MovieDetailView` lets users search TMDB and apply a fix instantly; an export button downloads merged overrides as a file. `scripts/fetch-tmdb.mjs` reads overrides at startup and fetches by ID instead of searching for corrected movies.

**Tech Stack:** Vue 3 Composition API, Pinia, Vitest + jsdom, TMDB REST API v3

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/services/tmdb.js` | Add `searchMovies` (returns array) and `enrichById` (fetch by TMDB ID) |
| Modify | `src/services/__tests__/tmdb.test.js` | Tests for the two new service functions |
| Create | `public/tmdb-overrides.json` | Permanent slug→tmdbId map, committed to repo |
| Modify | `src/stores/tmdb.js` | Add `overrides` state, update `init()`, add `applyOverride`/`hasOverrides`/`exportOverrides` |
| Create | `src/stores/__tests__/tmdb.test.js` | Tests for new store actions/getters |
| Create | `src/components/OverrideModal.vue` | Search modal: debounced query, results list, pick, export button |
| Modify | `src/views/MovieDetailView.vue` | Add "Fix TMDB match" button + mount OverrideModal |
| Modify | `scripts/fetch-tmdb.mjs` | Read overrides, fetch by ID when a correction exists |

---

## Task 1: Add `searchMovies` and `enrichById` to the tmdb service (TDD)

**Files:**
- Modify: `src/services/tmdb.js`
- Modify: `src/services/__tests__/tmdb.test.js`

- [ ] **Step 1: Add failing tests**

  Append to `src/services/__tests__/tmdb.test.js` (after the existing `enrichMovie` describe block):

  ```js
  import { searchMovie, enrichMovie, searchMovies, enrichById } from '../tmdb.js'

  describe('searchMovies', () => {
    it('returns up to 8 results', async () => {
      const fakeResults = Array.from({ length: 10 }, (_, i) => ({
        id: i, title: `Movie ${i}`, release_date: '2000-01-01', poster_path: null
      }))
      mockFetch([{ results: fakeResults }])
      const found = await searchMovies('heat', 'fake-key')
      expect(found).toHaveLength(8)
      expect(found[0].id).toBe(0)
    })

    it('returns empty array when no results', async () => {
      mockFetch([{ results: [] }])
      expect(await searchMovies('xyz', 'fake-key')).toEqual([])
    })
  })

  describe('enrichById', () => {
    it('fetches movie data directly by TMDB ID without searching', async () => {
      mockFetch([
        {
          id: 949, poster_path: '/heat.jpg', backdrop_path: '/heat-bg.jpg',
          release_date: '1995-12-15', vote_average: 8.2,
          overview: 'A crime epic.', runtime: 170
        },
        {
          crew: [{ job: 'Director', name: 'Michael Mann' }],
          cast: [{ name: 'Al Pacino' }, { name: 'Robert De Niro' }]
        }
      ])
      const result = await enrichById(949, 'fake-key')
      expect(result.tmdbId).toBe(949)
      expect(result.director).toBe('Michael Mann')
      expect(result.runtime).toBe(170)
      expect(result.posterPath).toContain('/heat.jpg')
      expect(result.year).toBe(1995)
      expect(result.cast).toContain('Al Pacino')
    })
  })
  ```

  > Note: The existing `import` line at the top of the file only imports `searchMovie` and `enrichMovie`. Update it to also import `searchMovies` and `enrichById`.

- [ ] **Step 2: Run to confirm tests fail**

  ```
  npm test -- src/services/__tests__/tmdb.test.js
  ```

  Expected: FAIL — `searchMovies is not a function`, `enrichById is not a function`

- [ ] **Step 3: Implement both functions in `src/services/tmdb.js`**

  Append after the existing `enrichMovie` export:

  ```js
  export async function searchMovies(title, apiKey) {
    const url = `${BASE}/search/movie?query=${encodeURIComponent(title)}&page=1`
    const res = await fetch(url, { headers: authHeaders(apiKey) })
    if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`)
    const data = await res.json()
    return data.results.slice(0, 8)
  }

  export async function enrichById(tmdbId, apiKey) {
    const opts = { headers: authHeaders(apiKey) }
    const [details, credits] = await Promise.all([
      fetch(`${BASE}/movie/${tmdbId}`, opts).then(r => r.json()),
      fetch(`${BASE}/movie/${tmdbId}/credits`, opts).then(r => r.json())
    ])
    const director = credits.crew.find(p => p.job === 'Director')?.name || 'Unknown'
    const cast = credits.cast.slice(0, 5).map(p => p.name)
    return {
      tmdbId,
      posterPath: details.poster_path ? `${IMG_BASE}/w500${details.poster_path}` : null,
      backdropPath: details.backdrop_path ? `${IMG_BASE}/w1280${details.backdrop_path}` : null,
      year: details.release_date ? parseInt(details.release_date.slice(0, 4)) : null,
      runtime: details.runtime || null,
      voteAverage: details.vote_average || null,
      overview: details.overview || null,
      director,
      cast,
      enrichedAt: Date.now()
    }
  }
  ```

- [ ] **Step 4: Run tests to confirm pass**

  ```
  npm test -- src/services/__tests__/tmdb.test.js
  ```

  Expected: all tests PASS

- [ ] **Step 5: Commit**

  ```
  git add src/services/tmdb.js src/services/__tests__/tmdb.test.js
  git commit -m "feat: add searchMovies and enrichById to tmdb service"
  ```

---

## Task 2: Create `public/tmdb-overrides.json`

**Files:**
- Create: `public/tmdb-overrides.json`

- [ ] **Step 1: Create the file**

  Create `public/tmdb-overrides.json` with content:

  ```json
  {}
  ```

- [ ] **Step 2: Commit**

  ```
  git add public/tmdb-overrides.json
  git commit -m "feat: add empty tmdb-overrides.json"
  ```

---

## Task 3: Add `overrides` state and update `init()` in tmdb store (TDD)

**Files:**
- Create: `src/stores/__tests__/tmdb.test.js`
- Modify: `src/stores/tmdb.js`

- [ ] **Step 1: Create store test file with failing tests for `init()` override loading**

  Create `src/stores/__tests__/tmdb.test.js`:

  ```js
  import { describe, it, expect, vi, beforeEach } from 'vitest'
  import { setActivePinia, createPinia } from 'pinia'
  import { enrichById } from '@/services/tmdb.js'
  import { useTmdbStore } from '../tmdb.js'

  vi.mock('@/services/tmdb.js', () => ({
    enrichMovie: vi.fn(),
    enrichById: vi.fn(),
    searchMovies: vi.fn(),
  }))

  function stubFetch(urlMap) {
    vi.stubGlobal('fetch', vi.fn(url => {
      for (const [key, body] of Object.entries(urlMap)) {
        if (url.includes(key)) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
        }
      }
      return Promise.resolve({ ok: false })
    }))
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('tmdb store — init() override loading', () => {
    it('loads overrides from public/tmdb-overrides.json into this.overrides', async () => {
      stubFetch({ 'tmdb-overrides.json': { heat: 949 } })
      const store = useTmdbStore()
      await store.init()
      expect(store.overrides).toEqual({ heat: 949 })
    })

    it('loads overrides from localStorage into this.overrides', async () => {
      localStorage.setItem('library_tmdb_overrides', JSON.stringify({ 'the-fly': 4538 }))
      stubFetch({})
      const store = useTmdbStore()
      await store.init()
      expect(store.overrides['the-fly']).toBe(4538)
    })

    it('localStorage overrides win over JSON file on conflict', async () => {
      localStorage.setItem('library_tmdb_overrides', JSON.stringify({ heat: 999 }))
      stubFetch({ 'tmdb-overrides.json': { heat: 949 } })
      const store = useTmdbStore()
      await store.init()
      expect(store.overrides['heat']).toBe(999)
    })
  })
  ```

- [ ] **Step 2: Run to confirm tests fail**

  ```
  npm test -- src/stores/__tests__/tmdb.test.js
  ```

  Expected: FAIL — `store.overrides is undefined`

- [ ] **Step 3: Add `overrides` state and update `init()` in `src/stores/tmdb.js`**

  In the `state` object, add:
  ```js
  overrides: {}
  ```

  In `init()`, after the existing `awardsCache` fetch block, add:
  ```js
  // Load file-based overrides (lowest priority)
  try {
    const res = await fetch('/tmdb-overrides.json')
    if (res.ok) Object.assign(this.overrides, await res.json())
  } catch {}
  // Merge localStorage overrides on top (higher priority)
  try {
    const raw = localStorage.getItem('library_tmdb_overrides')
    if (raw) Object.assign(this.overrides, JSON.parse(raw))
  } catch {}
  ```

- [ ] **Step 4: Run tests to confirm pass**

  ```
  npm test -- src/stores/__tests__/tmdb.test.js
  ```

  Expected: all tests PASS

---

## Task 4: Add `applyOverride` action to tmdb store (TDD)

**Files:**
- Modify: `src/stores/__tests__/tmdb.test.js`
- Modify: `src/stores/tmdb.js`

- [ ] **Step 1: Add failing tests for `applyOverride`**

  Append to `src/stores/__tests__/tmdb.test.js`:

  ```js
  describe('tmdb store — applyOverride', () => {
    const fakeData = {
      tmdbId: 949, posterPath: '/p.jpg', backdropPath: null,
      year: 1995, runtime: 170, voteAverage: 8.2,
      overview: 'A crime epic.', director: 'Michael Mann',
      cast: ['Al Pacino'], enrichedAt: 1000
    }

    beforeEach(() => {
      enrichById.mockResolvedValue(fakeData)
      stubFetch({})
    })

    it('calls enrichById with the given tmdbId and stores result in cache', async () => {
      const store = useTmdbStore()
      store.apiKey = 'fake-key'
      await store.applyOverride('heat', 949)
      expect(enrichById).toHaveBeenCalledWith(949, 'fake-key')
      expect(store.cache['heat']).toEqual(fakeData)
    })

    it('saves the slug→tmdbId mapping to this.overrides', async () => {
      const store = useTmdbStore()
      store.apiKey = 'fake-key'
      await store.applyOverride('heat', 949)
      expect(store.overrides['heat']).toBe(949)
    })

    it('persists overrides and cache to localStorage', async () => {
      const store = useTmdbStore()
      store.apiKey = 'fake-key'
      await store.applyOverride('heat', 949)
      const savedOverrides = JSON.parse(localStorage.getItem('library_tmdb_overrides'))
      expect(savedOverrides['heat']).toBe(949)
      const savedCache = JSON.parse(localStorage.getItem('library_tmdb_cache'))
      expect(savedCache['heat']).toEqual(fakeData)
    })

    it('does nothing if enrichById returns null', async () => {
      enrichById.mockResolvedValue(null)
      const store = useTmdbStore()
      store.apiKey = 'fake-key'
      await store.applyOverride('heat', 999)
      expect(store.cache['heat']).toBeUndefined()
      expect(store.overrides['heat']).toBeUndefined()
    })
  })
  ```

- [ ] **Step 2: Run to confirm tests fail**

  ```
  npm test -- src/stores/__tests__/tmdb.test.js
  ```

  Expected: FAIL — `store.applyOverride is not a function`

- [ ] **Step 3: Add `applyOverride` to `src/stores/tmdb.js` actions**

  Add the import at the top of the file (update existing import line):
  ```js
  import { enrichMovie, enrichById } from '@/services/tmdb.js'
  ```

  Add action in the `actions` block:
  ```js
  async applyOverride(movieSlug, tmdbId) {
    const data = await enrichById(tmdbId, this.apiKey)
    if (!data) return
    this.cache[movieSlug] = data
    this._saveCache()
    this.overrides[movieSlug] = tmdbId
    localStorage.setItem('library_tmdb_overrides', JSON.stringify(this.overrides))
  },
  ```

- [ ] **Step 4: Run tests to confirm pass**

  ```
  npm test -- src/stores/__tests__/tmdb.test.js
  ```

  Expected: all tests PASS

---

## Task 5: Add `hasOverrides` getter and `exportOverrides` action (TDD)

**Files:**
- Modify: `src/stores/__tests__/tmdb.test.js`
- Modify: `src/stores/tmdb.js`

- [ ] **Step 1: Add failing tests**

  Append to `src/stores/__tests__/tmdb.test.js`:

  ```js
  describe('tmdb store — hasOverrides', () => {
    it('is false when overrides is empty', () => {
      const store = useTmdbStore()
      expect(store.hasOverrides).toBe(false)
    })

    it('is true after an override is applied', async () => {
      enrichById.mockResolvedValue({
        tmdbId: 949, posterPath: null, backdropPath: null,
        year: 1995, runtime: 170, voteAverage: 8.2,
        overview: '', director: 'Mann', cast: [], enrichedAt: 1
      })
      stubFetch({})
      const store = useTmdbStore()
      store.apiKey = 'fake-key'
      await store.applyOverride('heat', 949)
      expect(store.hasOverrides).toBe(true)
    })
  })

  describe('tmdb store — exportOverrides', () => {
    it('merges JSON file overrides with localStorage overrides, localStorage wins', async () => {
      stubFetch({ 'tmdb-overrides.json': { heat: 949, alien: 348 } })
      const store = useTmdbStore()
      store.overrides = { heat: 999 }

      let capturedContent = ''
      vi.spyOn(globalThis, 'Blob').mockImplementation(function(parts) {
        capturedContent = parts[0]
        return {}
      })
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
      vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
      vi.spyOn(document, 'createElement').mockReturnValue({ href: '', download: '', click: vi.fn() })

      await store.exportOverrides()
      expect(JSON.parse(capturedContent)).toEqual({ heat: 999, alien: 348 })
    })
  })
  ```

- [ ] **Step 2: Run to confirm tests fail**

  ```
  npm test -- src/stores/__tests__/tmdb.test.js
  ```

  Expected: FAIL — `store.hasOverrides is not a function` / `store.exportOverrides is not a function`

- [ ] **Step 3: Add getter and action to `src/stores/tmdb.js`**

  In the `getters` block, add:
  ```js
  hasOverrides: (state) => Object.keys(state.overrides).length > 0,
  ```

  In the `actions` block, add:
  ```js
  async exportOverrides() {
    let base = {}
    try {
      const res = await fetch('/tmdb-overrides.json')
      if (res.ok) base = await res.json()
    } catch {}
    const merged = { ...base, ...this.overrides }
    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tmdb-overrides.json'
    a.click()
    URL.revokeObjectURL(url)
  },
  ```

- [ ] **Step 4: Run all tests to confirm pass**

  ```
  npm test -- src/stores/__tests__/tmdb.test.js
  ```

  Expected: all tests PASS

- [ ] **Step 5: Run full test suite to check for regressions**

  ```
  npm test
  ```

  Expected: all tests PASS

- [ ] **Step 6: Commit**

  ```
  git add src/stores/tmdb.js src/stores/__tests__/tmdb.test.js
  git commit -m "feat: add overrides state, applyOverride, hasOverrides, exportOverrides to tmdb store"
  ```

---

## Task 6: Create `OverrideModal.vue`

**Files:**
- Create: `src/components/OverrideModal.vue`

- [ ] **Step 1: Create the component**

  Create `src/components/OverrideModal.vue`:

  ```vue
  <template>
    <div class="overlay" @click.self="$emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h2>Fix TMDB Match</h2>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>

        <input
          v-model="query"
          class="search-input"
          placeholder="Search TMDB..."
          @input="onInput"
        />

        <div v-if="searching" class="state-msg">Searching…</div>
        <div v-else-if="searchError" class="state-msg error">{{ searchError }}</div>
        <div v-else-if="searched && results.length === 0" class="state-msg">No results.</div>

        <ul v-else-if="results.length" class="results">
          <li v-for="r in results" :key="r.id" class="result-item" @click="pick(r)">
            <img
              v-if="r.poster_path"
              :src="`https://image.tmdb.org/t/p/w92${r.poster_path}`"
              class="result-poster"
              :alt="r.title"
            />
            <div v-else class="result-poster result-poster-empty"></div>
            <div class="result-info">
              <div class="result-title">{{ r.title }}</div>
              <div class="result-meta">{{ r.release_date?.slice(0, 4) }} · ID: {{ r.id }}</div>
            </div>
          </li>
        </ul>

        <div v-if="applying" class="state-msg">Applying…</div>
        <div v-if="applyError" class="state-msg error">{{ applyError }}</div>

        <div v-if="tmdb.hasOverrides" class="modal-footer">
          <button class="export-btn" @click="tmdb.exportOverrides()">Export overrides.json</button>
        </div>
      </div>
    </div>
  </template>

  <script setup>
  import { ref } from 'vue'
  import { useTmdbStore } from '@/stores/tmdb.js'
  import { searchMovies } from '@/services/tmdb.js'

  const props = defineProps({
    movie: { type: Object, required: true }
  })
  const emit = defineEmits(['close'])

  const tmdb = useTmdbStore()
  const query = ref(props.movie.title)
  const results = ref([])
  const searching = ref(false)
  const searched = ref(false)
  const searchError = ref('')
  const applying = ref(false)
  const applyError = ref('')
  let debounceTimer = null

  async function doSearch() {
    if (!query.value.trim()) { results.value = []; searched.value = false; return }
    searching.value = true
    searchError.value = ''
    try {
      results.value = await searchMovies(query.value.trim(), tmdb.apiKey)
      searched.value = true
    } catch (e) {
      searchError.value = e.message
      results.value = []
    } finally {
      searching.value = false
    }
  }

  function onInput() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(doSearch, 300)
  }

  async function pick(result) {
    applying.value = true
    applyError.value = ''
    try {
      await tmdb.applyOverride(props.movie.id, result.id)
      emit('close')
    } catch (e) {
      applyError.value = `Failed to apply: ${e.message}`
    } finally {
      applying.value = false
    }
  }

  doSearch()
  </script>

  <style scoped>
  .overlay {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0, 0, 0, 0.7);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem;
  }
  .modal {
    background: var(--surface); border-radius: var(--radius);
    width: 100%; max-width: 500px; max-height: 80vh;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.25rem 0.75rem;
  }
  .modal-header h2 {
    font-size: 1rem; font-weight: 600; color: var(--text);
  }
  .close-btn {
    background: none; border: none; color: var(--text-2);
    font-size: 1.4rem; line-height: 1; padding: 0 0.25rem;
  }
  .close-btn:hover { color: var(--text); }
  .search-input {
    margin: 0 1.25rem 0.75rem;
    background: var(--surface-2); border: 1px solid var(--text-3);
    border-radius: var(--radius); color: var(--text);
    padding: 0.5rem 0.75rem; font-size: 0.9rem;
  }
  .search-input:focus { outline: none; border-color: var(--accent); }
  .state-msg {
    padding: 1rem 1.25rem; color: var(--text-2); font-size: 0.875rem;
  }
  .state-msg.error { color: #e05555; }
  .results {
    list-style: none; padding: 0; margin: 0;
    overflow-y: auto; flex: 1;
  }
  .result-item {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.6rem 1.25rem; cursor: pointer;
  }
  .result-item:hover { background: var(--surface-2); }
  .result-poster {
    width: 40px; height: 60px; flex-shrink: 0;
    border-radius: 3px; object-fit: cover;
  }
  .result-poster-empty {
    background: var(--surface-2); border: 1px solid var(--text-3);
  }
  .result-title { font-size: 0.9rem; color: var(--text); }
  .result-meta { font-size: 0.75rem; color: var(--text-3); margin-top: 2px; }
  .modal-footer {
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--surface-2);
  }
  .export-btn {
    background: none; border: 1px solid var(--text-3);
    color: var(--text-2); border-radius: var(--radius);
    padding: 0.4rem 0.75rem; font-size: 0.8rem;
  }
  .export-btn:hover { border-color: var(--text-2); color: var(--text); }
  </style>
  ```

- [ ] **Step 2: Commit**

  ```
  git add src/components/OverrideModal.vue
  git commit -m "feat: add OverrideModal component for fixing TMDB matches"
  ```

---

## Task 7: Wire `OverrideModal` into `MovieDetailView.vue`

**Files:**
- Modify: `src/views/MovieDetailView.vue`

- [ ] **Step 1: Add the import and ref in `<script setup>`**

  After the existing imports in `<script setup>`, add:
  ```js
  import OverrideModal from '@/components/OverrideModal.vue'
  ```

  After the existing refs (`enriching`, `awardsExpanded`), add:
  ```js
  const showOverrideModal = ref(false)
  ```

- [ ] **Step 2: Add the button and modal to the template**

  In the template, after the closing `</section>` of the `v-if="enriching"` block (line 95) and before the closing `</div>` of `.sections`, add:

  ```html
  <div v-if="tmdb.hasApiKey && tmdbData" class="fix-match-row">
    <button class="fix-match-btn" @click="showOverrideModal = true">Fix TMDB match</button>
  </div>
  ```

  At the very end of the template root (after `<div v-else class="state-msg">Movie not found.</div>`), add:

  ```html
  <OverrideModal
    v-if="showOverrideModal && movie"
    :movie="movie"
    @close="showOverrideModal = false"
  />
  ```

- [ ] **Step 3: Add styles**

  Inside the `<style scoped>` block, add:

  ```css
  .fix-match-row { padding-top: 0.5rem; }
  .fix-match-btn {
    background: none; border: none; padding: 0;
    font-size: 0.75rem; color: var(--text-3); text-decoration: underline;
  }
  .fix-match-btn:hover { color: var(--text-2); }
  ```

- [ ] **Step 4: Run the app and test the flow manually**

  The dev server should already be running at http://localhost:5173.

  1. Open a movie detail page for a movie that has TMDB data loaded.
  2. Confirm "Fix TMDB match" link appears near the bottom of the details.
  3. Click it — modal opens with a pre-filled search and results appear.
  4. Click a result — modal closes, page refreshes with the new poster/data.
  5. Reopen modal — "Export overrides.json" button appears at the bottom.
  6. Click export — browser downloads `tmdb-overrides.json` containing the override.

- [ ] **Step 5: Commit**

  ```
  git add src/views/MovieDetailView.vue
  git commit -m "feat: add Fix TMDB match button and OverrideModal to movie detail page"
  ```

---

## Task 8: Update `scripts/fetch-tmdb.mjs` to use overrides

**Files:**
- Modify: `scripts/fetch-tmdb.mjs`

- [ ] **Step 1: Add inline `enrichById` function to the script**

  In `scripts/fetch-tmdb.mjs`, after the existing `enrichMovie` function, add:

  ```js
  async function enrichById(tmdbId, apiKey) {
    const opts = { headers: authHeaders(apiKey) }
    const [details, credits] = await Promise.all([
      fetch(`${BASE}/movie/${tmdbId}`, opts).then(r => r.json()),
      fetch(`${BASE}/movie/${tmdbId}/credits`, opts).then(r => r.json())
    ])
    return {
      tmdbId,
      posterPath: details.poster_path ? `${IMG_BASE}/w500${details.poster_path}` : null,
      backdropPath: details.backdrop_path ? `${IMG_BASE}/w1280${details.backdrop_path}` : null,
      year: details.release_date ? parseInt(details.release_date.slice(0, 4)) : null,
      runtime: details.runtime || null,
      voteAverage: details.vote_average || null,
      overview: details.overview || null,
      director: credits.crew.find(p => p.job === 'Director')?.name || 'Unknown',
      cast: credits.cast.slice(0, 5).map(p => p.name),
      enrichedAt: Date.now()
    }
  }
  ```

- [ ] **Step 2: Load overrides at the start of `main()`**

  In the `main()` function, after `loadEnv()` and after the existing cache loading block (the `if (existsSync(OUT))` block), add:

  ```js
  // Load overrides
  const OVERRIDES_PATH = resolve(ROOT, 'public', 'tmdb-overrides.json')
  let overrides = {}
  if (existsSync(OVERRIDES_PATH)) {
    try { overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8')) } catch {}
  }
  const overrideCount = Object.keys(overrides).length
  if (overrideCount > 0) console.log(`Loaded ${overrideCount} override(s) from tmdb-overrides.json`)
  ```

- [ ] **Step 3: Include overridden movies in the queue even if already cached**

  Find the existing queue line:
  ```js
  const queue = all.filter(m => !m.isCollection && !cache[m.id])
  ```

  Replace it with:
  ```js
  const queue = all.filter(m => !m.isCollection && (!cache[m.id] || overrides[m.id]))
  ```

- [ ] **Step 4: Use `enrichById` for overridden movies in the main loop**

  Find the existing try block inside the loop:
  ```js
  try {
    const data = await enrichMovie(movie.title, apiKey)
    if (data) {
      cache[movie.id] = data
      ok++
      console.log('✓')
    } else {
      skipped++
      console.log('— not found on TMDB')
    }
  } catch (e) {
    failed++
    console.log(`✗ ${e.message}`)
  }
  ```

  Replace it with:
  ```js
  try {
    const data = overrides[movie.id]
      ? await enrichById(overrides[movie.id], apiKey)
      : await enrichMovie(movie.title, apiKey)
    if (data) {
      cache[movie.id] = data
      ok++
      console.log(overrides[movie.id] ? '✓ (override)' : '✓')
    } else {
      skipped++
      console.log('— not found on TMDB')
    }
  } catch (e) {
    failed++
    console.log(`✗ ${e.message}`)
  }
  ```

- [ ] **Step 5: Commit**

  ```
  git add scripts/fetch-tmdb.mjs
  git commit -m "feat: fetch-tmdb script respects tmdb-overrides.json, fetches by ID for corrections"
  ```

---

## Done

The override system is fully wired. When a movie shows wrong data:

1. Open its detail page → click "Fix TMDB match"
2. Search for the correct film → click it
3. The page immediately updates
4. Click "Export overrides.json" in the modal → drop the file into `public/`
5. Next time you run `node scripts/fetch-tmdb.mjs`, the corrected movie is fetched by ID and stays correct forever
