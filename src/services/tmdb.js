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

  return {
    tmdbId: match.id,
    posterPath: match.poster_path ? `${IMG_BASE}/w500${match.poster_path}` : null,
    backdropPath: match.backdrop_path ? `${IMG_BASE}/w1280${match.backdrop_path}` : null,
    year: match.release_date ? parseInt(match.release_date.slice(0, 4)) : null,
    runtime: details.runtime || null,
    voteAverage: match.vote_average || null,
    overview: match.overview || null,
    director,
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
