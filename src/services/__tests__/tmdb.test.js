import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchMovie, enrichMovie, searchMovies, enrichById, searchCollection, fetchCollectionById } from '../tmdb.js'

const mockFetch = (responses) => {
  let call = 0
  vi.stubGlobal('fetch', vi.fn(() => {
    const res = responses[call++]
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(res)
    })
  }))
}

beforeEach(() => { vi.restoreAllMocks() })

describe('searchMovie', () => {
  it('returns first result from TMDB search', async () => {
    mockFetch([{ results: [{ id: 603, title: 'The Matrix', vote_average: 8.7, release_date: '1999-03-31', poster_path: '/abc.jpg', backdrop_path: '/def.jpg', overview: 'A hacker...' }] }])
    const result = await searchMovie('The Matrix', 'fake-key')
    expect(result.id).toBe(603)
    expect(result.title).toBe('The Matrix')
  })

  it('returns null when no results', async () => {
    mockFetch([{ results: [] }])
    const result = await searchMovie('Nonexistent Film', 'fake-key')
    expect(result).toBeNull()
  })
})

describe('enrichMovie', () => {
  it('returns enriched object with director and cast', async () => {
    mockFetch([
      { results: [{ id: 603, title: 'The Matrix', vote_average: 8.7, release_date: '1999-03-31', poster_path: '/abc.jpg', backdrop_path: '/def.jpg', overview: 'A hacker...' }] },
      { runtime: 136 },
      { crew: [{ job: 'Director', name: 'Lana Wachowski' }], cast: [{ name: 'Keanu Reeves' }, { name: 'Laurence Fishburne' }] }
    ])
    const result = await enrichMovie('The Matrix', 'fake-key')
    expect(result.tmdbId).toBe(603)
    expect(result.director).toBe('Lana Wachowski')
    expect(result.cast).toContain('Keanu Reeves')
    expect(result.runtime).toBe(136)
    expect(result.posterPath).toContain('/abc.jpg')
  })

  it('returns null when movie not found', async () => {
    mockFetch([{ results: [] }])
    const result = await enrichMovie('Unknown', 'fake-key')
    expect(result).toBeNull()
  })
})

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

  it('throws a meaningful error when TMDB returns non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(enrichById(949, 'fake-key')).rejects.toThrow('TMDB 401')
  })
})

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
