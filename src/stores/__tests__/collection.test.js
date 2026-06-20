import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCollectionStore } from '../collection.js'
import { useTmdbStore } from '../tmdb.js'

vi.mock('@/services/tmdb.js', () => ({
  enrichMovie: vi.fn(),
  enrichById: vi.fn(),
  searchMovies: vi.fn(),
  searchCollection: vi.fn(),
  fetchCollectionById: vi.fn(),
}))

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('useCollectionStore filters', () => {
  it('returns all movies when no filters set', () => {
    const store = useCollectionStore()
    store.movies = [
      { id: 'the-matrix', title: 'The Matrix', sortKey: 'matrix', genre: 'Sci-Fi', subGenre: 'Action', formats: ['4K'], notes: [], isCollection: false },
      { id: 'aliens', title: 'Aliens', sortKey: 'aliens', genre: 'Horror', subGenre: 'Sci-Fi', formats: ['Blu-ray'], notes: [], isCollection: false }
    ]
    expect(store.filteredMovies).toHaveLength(2)
  })

  it('filters by genre', () => {
    const store = useCollectionStore()
    store.movies = [
      { id: 'the-matrix', title: 'The Matrix', sortKey: 'matrix', genre: 'Sci-Fi', subGenre: '', formats: ['4K'], notes: [], isCollection: false },
      { id: 'aliens', title: 'Aliens', sortKey: 'aliens', genre: 'Horror', subGenre: '', formats: ['Blu-ray'], notes: [], isCollection: false }
    ]
    store.setFilter('genre', 'Sci-Fi')
    expect(store.filteredMovies).toHaveLength(1)
    expect(store.filteredMovies[0].title).toBe('The Matrix')
  })

  it('filters by format', () => {
    const store = useCollectionStore()
    store.movies = [
      { id: 'the-matrix', title: 'The Matrix', sortKey: 'matrix', genre: 'Sci-Fi', subGenre: '', formats: ['4K'], notes: [], isCollection: false },
      { id: 'aliens', title: 'Aliens', sortKey: 'aliens', genre: 'Horror', subGenre: '', formats: ['Blu-ray'], notes: [], isCollection: false }
    ]
    store.setFilter('format', '4K')
    expect(store.filteredMovies).toHaveLength(1)
    expect(store.filteredMovies[0].title).toBe('The Matrix')
  })

  it('filters by Steelbook in notes', () => {
    const store = useCollectionStore()
    store.movies = [
      { id: 'coraline', title: 'Coraline', sortKey: 'coraline', genre: 'Horror', subGenre: '', formats: ['4K'], notes: ['Steelbook'], isCollection: false },
      { id: 'aliens', title: 'Aliens', sortKey: 'aliens', genre: 'Horror', subGenre: '', formats: ['4K'], notes: [], isCollection: false }
    ]
    store.setFilter('format', 'Steelbook')
    expect(store.filteredMovies).toHaveLength(1)
    expect(store.filteredMovies[0].title).toBe('Coraline')
  })

  it('filters by search query (case insensitive)', () => {
    const store = useCollectionStore()
    store.movies = [
      { id: 'the-matrix', title: 'The Matrix', sortKey: 'matrix', genre: 'Sci-Fi', subGenre: '', formats: ['4K'], notes: [], isCollection: false },
      { id: 'aliens', title: 'Aliens', sortKey: 'aliens', genre: 'Horror', subGenre: '', formats: ['Blu-ray'], notes: [], isCollection: false }
    ]
    store.setFilter('search', 'mat')
    expect(store.filteredMovies).toHaveLength(1)
    expect(store.filteredMovies[0].title).toBe('The Matrix')
  })

  it('sorts A-Z by sortKey', () => {
    const store = useCollectionStore()
    store.movies = [
      { id: 'aliens', title: 'Aliens', sortKey: 'aliens', genre: 'Horror', subGenre: '', formats: [], notes: [], isCollection: false },
      { id: 'the-matrix', title: 'The Matrix', sortKey: 'matrix', genre: 'Sci-Fi', subGenre: '', formats: [], notes: [], isCollection: false }
    ]
    store.setFilter('sort', 'az')
    expect(store.filteredMovies[0].id).toBe('aliens')
    expect(store.filteredMovies[1].id).toBe('the-matrix')
  })

  it('exposes allGenres as sorted unique list', () => {
    const store = useCollectionStore()
    store.movies = [
      { id: 'a', title: 'A', sortKey: 'a', genre: 'Sci-Fi', subGenre: '', formats: [], notes: [], isCollection: false },
      { id: 'b', title: 'B', sortKey: 'b', genre: 'Horror', subGenre: '', formats: [], notes: [], isCollection: false },
      { id: 'c', title: 'C', sortKey: 'c', genre: 'Sci-Fi', subGenre: '', formats: [], notes: [], isCollection: false }
    ]
    expect(store.allGenres).toEqual(['Horror', 'Sci-Fi'])
  })
})

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
    expect(expanded[0].id).toBe('lord-of-the-rings-trilogy--120')
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
