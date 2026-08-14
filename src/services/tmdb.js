const BASE = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p'

function authHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` }
}

export async function searchMovie(title, apiKey) {
  const url = `${BASE}/search/movie?query=${encodeURIComponent(title)}&page=1`
  const res = await fetch(url, { headers: authHeaders(apiKey) })
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`)
  const data = await res.json()
  return data.results[0] || null
}

export async function enrichMovie(title, apiKey) {
  const match = await searchMovie(title, apiKey)
  if (!match) return null

  const opts = { headers: authHeaders(apiKey) }
  const [details, credits] = await Promise.all([
    fetch(`${BASE}/movie/${match.id}`, opts).then(r => r.json()),
    fetch(`${BASE}/movie/${match.id}/credits`, opts).then(r => r.json())
  ])

  const director = credits.crew.find(p => p.job === 'Director')?.name || 'Unknown'
  const cast = credits.cast.slice(0, 5).map(p => p.name)
  const writers = [...new Set(
    credits.crew
      .filter(p => ['Screenplay', 'Story', 'Writer'].includes(p.job))
      .map(p => p.name)
  )]
  const producers = [...new Set(
    credits.crew.filter(p => p.job === 'Producer').map(p => p.name)
  )]

  return {
    tmdbId: match.id,
    posterPath: match.poster_path ? `${IMG_BASE}/w500${match.poster_path}` : null,
    backdropPath: match.backdrop_path ? `${IMG_BASE}/w1280${match.backdrop_path}` : null,
    year: match.release_date ? parseInt(match.release_date.slice(0, 4)) : null,
    runtime: details.runtime || null,
    voteAverage: match.vote_average || null,
    voteCount: details.vote_count || null,
    overview: match.overview || null,
    tagline: details.tagline || null,
    genres: details.genres?.map(g => g.name).filter(Boolean) || [],
    originalTitle: details.original_title !== match.title ? details.original_title : null,
    imdbId: details.imdb_id || null,
    budget: details.budget || null,
    revenue: details.revenue || null,
    languages: details.spoken_languages?.map(l => l.english_name).filter(Boolean) || [],
    productionCompanies: details.production_companies?.map(c => c.name).filter(Boolean) || [],
    productionCountries: details.production_countries?.map(c => c.name).filter(Boolean) || [],
    director,
    writers,
    producers,
    cast,
    enrichedAt: Date.now()
  }
}

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
    fetch(`${BASE}/movie/${tmdbId}`, opts).then(r => { if (!r.ok) throw new Error(`TMDB ${r.status}`); return r.json() }),
    fetch(`${BASE}/movie/${tmdbId}/credits`, opts).then(r => { if (!r.ok) throw new Error(`TMDB credits ${r.status}`); return r.json() })
  ])
  const director = credits.crew.find(p => p.job === 'Director')?.name || 'Unknown'
  const cast = credits.cast.slice(0, 5).map(p => p.name)
  const writers = [...new Set(
    credits.crew
      .filter(p => ['Screenplay', 'Story', 'Writer'].includes(p.job))
      .map(p => p.name)
  )]
  const producers = [...new Set(
    credits.crew.filter(p => p.job === 'Producer').map(p => p.name)
  )]

  return {
    tmdbId,
    posterPath: details.poster_path ? `${IMG_BASE}/w500${details.poster_path}` : null,
    backdropPath: details.backdrop_path ? `${IMG_BASE}/w1280${details.backdrop_path}` : null,
    year: details.release_date ? parseInt(details.release_date.slice(0, 4)) : null,
    runtime: details.runtime || null,
    voteAverage: details.vote_average || null,
    voteCount: details.vote_count || null,
    overview: details.overview || null,
    tagline: details.tagline || null,
    genres: details.genres?.map(g => g.name).filter(Boolean) || [],
    originalTitle: details.original_title !== details.title ? details.original_title : null,
    imdbId: details.imdb_id || null,
    budget: details.budget || null,
    revenue: details.revenue || null,
    languages: details.spoken_languages?.map(l => l.english_name).filter(Boolean) || [],
    productionCompanies: details.production_companies?.map(c => c.name).filter(Boolean) || [],
    productionCountries: details.production_countries?.map(c => c.name).filter(Boolean) || [],
    director,
    writers,
    producers,
    cast,
    enrichedAt: Date.now()
  }
}

export async function searchTvShows(title, apiKey) {
  const url = `${BASE}/search/tv?query=${encodeURIComponent(title)}&page=1`
  const res = await fetch(url, { headers: authHeaders(apiKey) })
  if (!res.ok) throw new Error(`TMDB TV search failed: ${res.status}`)
  const data = await res.json()
  return (data.results || []).slice(0, 8)
}

export async function enrichTvById(tvId, apiKey) {
  const opts = { headers: authHeaders(apiKey) }
  const [details, credits] = await Promise.all([
    fetch(`${BASE}/tv/${tvId}`, opts).then(r => {
      if (!r.ok) throw new Error(`TMDB ${r.status}`)
      return r.json()
    }),
    fetch(`${BASE}/tv/${tvId}/aggregate_credits`, opts).then(r => (r.ok ? r.json() : null))
  ])

  return {
    tmdbId: details.id,
    mediaType: 'tv',
    posterPath: details.poster_path ? `${IMG_BASE}/w500${details.poster_path}` : null,
    backdropPath: details.backdrop_path ? `${IMG_BASE}/w1280${details.backdrop_path}` : null,
    year: details.first_air_date ? parseInt(details.first_air_date.slice(0, 4)) : null,
    lastAirYear: details.last_air_date ? parseInt(details.last_air_date.slice(0, 4)) : null,
    status: details.status || null,
    numberOfSeasons: details.number_of_seasons || null,
    numberOfEpisodes: details.number_of_episodes || null,
    runtime: details.episode_run_time?.[0] || null,
    voteAverage: details.vote_average || null,
    voteCount: details.vote_count || null,
    overview: details.overview || null,
    tagline: details.tagline || null,
    genres: details.genres?.map(g => g.name).filter(Boolean) || [],
    originalTitle: details.original_name !== details.name ? details.original_name : null,
    networks: details.networks?.map(n => n.name).filter(Boolean) || [],
    createdBy: details.created_by?.map(c => c.name).filter(Boolean) || [],
    cast: (credits?.cast || []).slice(0, 5).map(p => p.name),
    languages: details.spoken_languages?.map(l => l.english_name).filter(Boolean) || [],
    productionCompanies: details.production_companies?.map(c => c.name).filter(Boolean) || [],
    productionCountries: details.production_countries?.map(c => c.name).filter(Boolean) || [],
    seasons: (details.seasons || [])
      .filter(s => s.season_number > 0)
      .map(s => ({
        seasonNumber: s.season_number,
        name: s.name,
        posterPath: s.poster_path ? `${IMG_BASE}/w500${s.poster_path}` : null,
        year: s.air_date ? parseInt(s.air_date.slice(0, 4)) : null,
        episodeCount: s.episode_count || null,
        overview: s.overview || null
      })),
    enrichedAt: Date.now()
  }
}

export async function enrichTvShow(title, apiKey) {
  const results = await searchTvShows(title, apiKey)
  if (!results.length) return null
  return enrichTvById(results[0].id, apiKey)
}

export async function searchCollections(title, apiKey) {
  const url = `${BASE}/search/collection?query=${encodeURIComponent(title)}&page=1`
  const res = await fetch(url, { headers: authHeaders(apiKey) })
  if (!res.ok) throw new Error(`TMDB collection search failed: ${res.status}`)
  const data = await res.json()
  return (data.results || []).slice(0, 8)
}

export async function searchCollection(title, apiKey) {
  const url = `${BASE}/search/collection?query=${encodeURIComponent(title)}&page=1`
  const res = await fetch(url, { headers: authHeaders(apiKey) })
  if (!res.ok) throw new Error(`TMDB collection search failed: ${res.status}`)
  const data = await res.json()
  if (!data.results?.length) return null
  const lower = title.toLowerCase()
  return data.results.find(r => r.name.toLowerCase() === lower) || data.results[0]
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
      .sort((a, b) => {
        if (a.year === null) return 1
        if (b.year === null) return -1
        return a.year - b.year
      })
  }
}
