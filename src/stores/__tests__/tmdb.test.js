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

    // jsdom doesn't implement these — define them so vi.spyOn can wrap them
    if (!URL.createObjectURL) URL.createObjectURL = () => ''
    if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined

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

  it('seeds this.cache with poster data for each part that has a posterPath', async () => {
    searchCollection.mockResolvedValue({ id: 119 })
    fetchCollectionById.mockResolvedValue({
      tmdbCollectionId: 119,
      name: 'LotR Collection',
      parts: [
        { tmdbId: 120, title: 'Fellowship', posterPath: '/fellowship.jpg', year: 2001 },
        { tmdbId: 121, title: 'Two Towers', posterPath: '/twotowers.jpg', year: 2002 },
        { tmdbId: 122, title: 'Return', posterPath: null, year: 2003 }
      ]
    })
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    await store.fetchCollection({ id: 'lord-of-the-rings-trilogy', title: 'Lord of the Rings Trilogy' })
    expect(store.cache['lord-of-the-rings-trilogy--120']).toEqual({ posterPath: '/fellowship.jpg', year: 2001 })
    expect(store.cache['lord-of-the-rings-trilogy--121']).toEqual({ posterPath: '/twotowers.jpg', year: 2002 })
    // part with null posterPath should not be seeded
    expect(store.cache['lord-of-the-rings-trilogy--122']).toBeUndefined()
  })

  it('does not overwrite an existing cache entry for a virtual film', async () => {
    searchCollection.mockResolvedValue({ id: 119 })
    fetchCollectionById.mockResolvedValue({
      tmdbCollectionId: 119,
      name: 'LotR Collection',
      parts: [{ tmdbId: 120, title: 'Fellowship', posterPath: '/new.jpg', year: 2001 }]
    })
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    store.cache['lord-of-the-rings-trilogy--120'] = { posterPath: '/existing.jpg', year: 2001, runtime: 178 }
    await store.fetchCollection({ id: 'lord-of-the-rings-trilogy', title: 'Lord of the Rings Trilogy' })
    // existing full entry must not be replaced
    expect(store.cache['lord-of-the-rings-trilogy--120'].runtime).toBe(178)
    expect(store.cache['lord-of-the-rings-trilogy--120'].posterPath).toBe('/existing.jpg')
  })

  it('persists the seeded cache entries to localStorage', async () => {
    searchCollection.mockResolvedValue({ id: 119 })
    fetchCollectionById.mockResolvedValue({
      tmdbCollectionId: 119,
      name: 'LotR Collection',
      parts: [{ tmdbId: 120, title: 'Fellowship', posterPath: '/fellowship.jpg', year: 2001 }]
    })
    const store = useTmdbStore()
    store.apiKey = 'test-key'
    await store.fetchCollection({ id: 'lord-of-the-rings-trilogy', title: 'Lord of the Rings Trilogy' })
    const savedCache = JSON.parse(localStorage.getItem('library_tmdb_cache'))
    expect(savedCache['lord-of-the-rings-trilogy--120']).toEqual({ posterPath: '/fellowship.jpg', year: 2001 })
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

describe('tmdb store — getCollectionData', () => {
  it('returns the full collection object for a known slug', () => {
    const store = useTmdbStore()
    const col = { tmdbCollectionId: 119, name: 'LotR', parts: [] }
    store.collections['lotr'] = col
    expect(store.getCollectionData('lotr')).toEqual(col)
  })

  it('returns null for an unknown slug', () => {
    const store = useTmdbStore()
    expect(store.getCollectionData('not-a-collection')).toBeNull()
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
