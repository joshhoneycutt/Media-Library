import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/stores/collection.js', () => ({
  useCollectionStore: vi.fn()
}))
vi.mock('@/stores/tmdb.js', () => ({
  useTmdbStore: vi.fn()
}))
// Mock child components to keep tests focused on MovieDetailView logic
vi.mock('@/components/FormatBadge.vue', () => ({
  default: { template: '<span />' }
}))
vi.mock('@/components/OverrideModal.vue', () => ({
  default: { template: '<div />' }
}))
vi.mock('@/components/CollectionRail.vue', () => ({
  default: { template: '<div class="collection-rail-stub" />' }
}))

import { useCollectionStore } from '@/stores/collection.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import MovieDetailView from '../MovieDetailView.vue'

function makeRouter(movieId = 'test-movie') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/movie/:id', component: MovieDetailView }
    ]
  })
  router.push(`/movie/${movieId}`)
  return router
}

function makeRegularMovie(overrides = {}) {
  return {
    id: 'test-movie',
    title: 'Test Movie',
    sortKey: 'test movie',
    genre: 'Action',
    subGenre: '',
    formats: ['4K'],
    notes: [],
    isCollection: false,
    collectionId: null,
    tmdbId: null,
    ...overrides
  }
}

function makeVirtualMovie(overrides = {}) {
  return {
    id: 'lotr--120',
    title: 'The Fellowship of the Ring',
    sortKey: 'fellowship of the ring',
    genre: 'Fantasy',
    subGenre: '',
    formats: ['4K'],
    notes: [],
    isCollection: false,
    collectionId: 'lotr',
    collectionName: 'Lord of the Rings Trilogy',
    collectionColor: '#5b8dd9',
    tmdbId: 120,
    year: 2001,
    ...overrides
  }
}

async function mountView(movie, tmdbCacheEntry = null, movieId = movie?.id, { hasApiKey = false, extraMovies = [] } = {}) {
  const fetchForMovieById = vi.fn().mockResolvedValue(undefined)
  const fetchForMovie = vi.fn().mockResolvedValue(undefined)
  const getMovieData = vi.fn().mockReturnValue(tmdbCacheEntry)
  const getOscarData = vi.fn().mockReturnValue(null)

  useCollectionStore.mockReturnValue({
    expandedMovies: movie ? [movie, ...extraMovies] : [...extraMovies]
  })
  useTmdbStore.mockReturnValue({
    hasApiKey,
    apiKey: hasApiKey ? 'fake-key' : '',
    cache: {},
    getMovieData,
    getOscarData,
    fetchForMovieById,
    fetchForMovie
  })

  const router = makeRouter(movieId)
  await router.isReady()

  const wrapper = mount(MovieDetailView, {
    global: { plugins: [router] }
  })

  await flushPromises()

  return { wrapper, fetchForMovieById, fetchForMovie, getMovieData }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('MovieDetailView fetch on route param watch', () => {
  it('calls fetchForMovieById when movie has tmdbId and no tmdbData', async () => {
    const movie = makeVirtualMovie()
    const { fetchForMovieById, fetchForMovie } = await mountView(movie, null, movie.id, { hasApiKey: true })
    expect(fetchForMovieById).toHaveBeenCalledWith(movie)
    expect(fetchForMovie).not.toHaveBeenCalled()
  })

  it('calls fetchForMovie when no tmdbId and no tmdbData and not a collection', async () => {
    const movie = makeRegularMovie()
    const { fetchForMovieById, fetchForMovie } = await mountView(movie, null, movie.id, { hasApiKey: true })
    expect(fetchForMovie).toHaveBeenCalledWith(movie)
    expect(fetchForMovieById).not.toHaveBeenCalled()
  })

  it('does not call fetch when tmdbData already exists', async () => {
    const movie = makeVirtualMovie()
    const existingData = { posterPath: '/poster.jpg', year: 2001 }
    const { fetchForMovieById, fetchForMovie } = await mountView(movie, existingData, movie.id, { hasApiKey: true })
    expect(fetchForMovieById).not.toHaveBeenCalled()
    expect(fetchForMovie).not.toHaveBeenCalled()
  })

  it('does not call fetchForMovie for a collection row with no tmdbId', async () => {
    const movie = makeRegularMovie({ isCollection: true, tmdbId: null })
    const { fetchForMovieById, fetchForMovie } = await mountView(movie, null, movie.id, { hasApiKey: true })
    expect(fetchForMovieById).not.toHaveBeenCalled()
    expect(fetchForMovie).not.toHaveBeenCalled()
  })

  it('does not call fetch when hasApiKey is false', async () => {
    const movie = makeVirtualMovie()
    const { fetchForMovieById, fetchForMovie } = await mountView(movie, null, movie.id, { hasApiKey: false })
    expect(fetchForMovieById).not.toHaveBeenCalled()
    expect(fetchForMovie).not.toHaveBeenCalled()
  })

  it('resolves movie from expandedMovies, not movies', async () => {
    // Only put the movie in expandedMovies — if the component fell back to a
    // movies array it would find nothing and show "Movie not found" instead.
    const movie = makeVirtualMovie()
    useCollectionStore.mockReturnValue({
      movies: [],
      expandedMovies: [movie]
    })
    useTmdbStore.mockReturnValue({
      hasApiKey: false,
      apiKey: '',
      cache: {},
      getMovieData: vi.fn().mockReturnValue(null),
      getOscarData: vi.fn().mockReturnValue(null),
      fetchForMovieById: vi.fn(),
      fetchForMovie: vi.fn()
    })
    const router = makeRouter(movie.id)
    await router.isReady()
    const wrapper = mount(MovieDetailView, { global: { plugins: [router] } })
    await flushPromises()
    // If .detail exists the movie was resolved from expandedMovies
    expect(wrapper.find('.detail').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Movie not found')
  })
})

describe('MovieDetailView template', () => {
  it('shows In this Collection section when movie has collectionId and 2+ siblings', async () => {
    const movie = makeVirtualMovie()
    const sibling = makeVirtualMovie({ id: 'lotr--121', title: 'The Two Towers', tmdbId: 121 })
    const { wrapper } = await mountView(movie, null, movie.id, { extraMovies: [sibling] })
    expect(wrapper.find('.in-collection-section').exists()).toBe(true)
  })

  it('does not show In this Collection section when only 1 sibling exists', async () => {
    // Only the movie itself has the collectionId — rail would be empty, section should hide
    const movie = makeVirtualMovie()
    const { wrapper } = await mountView(movie)
    expect(wrapper.find('.in-collection-section').exists()).toBe(false)
  })

  it('does not show In this Collection section for regular movies', async () => {
    const movie = makeRegularMovie()
    const { wrapper } = await mountView(movie)
    expect(wrapper.find('.in-collection-section').exists()).toBe(false)
  })

  it('shows Movie not found when movie id does not exist', async () => {
    useCollectionStore.mockReturnValue({ expandedMovies: [] })
    useTmdbStore.mockReturnValue({
      hasApiKey: false,
      apiKey: '',
      cache: {},
      getMovieData: vi.fn().mockReturnValue(null),
      getOscarData: vi.fn().mockReturnValue(null),
      fetchForMovieById: vi.fn(),
      fetchForMovie: vi.fn()
    })
    const router = makeRouter('nonexistent-id')
    await router.isReady()
    const wrapper = mount(MovieDetailView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Movie not found')
  })
})
