import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT = resolve(ROOT, 'public', 'tmdb-cache.json')

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/10KfDZ5TpC34NemewyW9x6W9RKgp8L3qKVdnTA6eCbbs/gviz/tq?tqx=out:csv&gid=0'
const DVD_URL   = 'https://docs.google.com/spreadsheets/d/10KfDZ5TpC34NemewyW9x6W9RKgp8L3qKVdnTA6eCbbs/gviz/tq?tqx=out:csv&sheet=DVD'

const BASE     = 'https://api.themoviedb.org/3'
const IMG_BASE = 'https://image.tmdb.org/t/p'

// --- env loading ---
function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue
    const key = line.slice(0, eqIdx).trim()
    const val = line.slice(eqIdx + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
}

// --- CSV parsing (mirrors sheets.js) ---
const FORMAT_MAP = { '4k': '4K', 'blu-ray': 'Blu-ray', 'blu-rau': 'Blu-ray', 'blu-rays': 'Blu-ray', 'blu-ras': 'Blu-ray', dvd: 'DVD' }

function normalizeFormat(diskType) {
  if (!diskType) return []
  const trimmed = diskType.trim()
  if (trimmed.includes('/')) return trimmed.split('/').flatMap(normalizeFormat).filter(Boolean)
  return [FORMAT_MAP[trimmed.toLowerCase()] || trimmed]
}

function normalizeTitle(title) {
  return title.toLowerCase().trim().replace(/^(the |a |an )/, '').trim()
}

function titleToSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')
}

function isCollection(name) {
  const l = name.toLowerCase()
  return l.includes('collection') || l.includes('trilogy') || l.includes('anthology') || l.includes('saga') || l.includes('box set')
}

function parseFields(line) {
  const fields = []
  let inQuote = false, current = ''
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuote = !inQuote }
    else if (line[i] === ',' && !inQuote) { fields.push(current.trim()); current = '' }
    else { current += line[i] }
  }
  fields.push(current.trim())
  return fields
}

function parseCSV(text) {
  const rows = []
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const f = parseFields(line)
    const filmName = (f[1] || '').replace(/^"|"$/g, '').trim()
    if (!filmName) continue
    rows.push({ filmSortName: (f[0] || '').replace(/^"|"$/g, '').trim(), filmName, genre: (f[2] || '').replace(/^"|"$/g, '').trim(), subGenre: (f[3] || '').replace(/^"|"$/g, '').trim(), diskType: (f[4] || '').replace(/^"|"$/g, '').trim(), notes: (f[5] || '').replace(/^"|"$/g, '').trim() })
  }
  return rows
}

function parseDvdCSV(text) {
  const rows = []
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const f = parseFields(line)
    const filmName = (f[1] || '').replace(/^"|"$/g, '').trim()
    if (!filmName) continue
    rows.push({ filmSortName: (f[0] || '').replace(/^"|"$/g, '').trim(), filmName, genre: (f[2] || '').replace(/^"|"$/g, '').trim(), subGenre: (f[3] || '').replace(/^"|"$/g, '').trim(), diskType: 'DVD', notes: (f[5] || '').replace(/^"|"$/g, '').trim() })
  }
  return rows
}

function groupByTitle(rows) {
  const map = new Map()
  for (const row of rows) {
    const key = normalizeTitle(row.filmName)
    const formats = normalizeFormat(row.diskType)
    const notes = row.notes ? [row.notes] : []
    if (map.has(key)) {
      const existing = map.get(key)
      for (const f of formats) if (!existing.formats.includes(f)) existing.formats.push(f)
      for (const n of notes) if (n && !existing.notes.includes(n)) existing.notes.push(n)
    } else {
      map.set(key, { id: titleToSlug(row.filmName), title: row.filmName, sortKey: normalizeTitle(row.filmSortName || row.filmName), genre: row.genre, subGenre: row.subGenre, formats, notes, isCollection: isCollection(row.filmName) })
    }
  }
  return Array.from(map.values())
}

// --- TMDB ---
function authHeaders(key) { return { Authorization: `Bearer ${key}` } }

async function enrichMovie(title, apiKey) {
  const searchRes = await fetch(`${BASE}/search/movie?query=${encodeURIComponent(title)}&page=1`, { headers: authHeaders(apiKey) })
  if (!searchRes.ok) throw new Error(`TMDB search ${searchRes.status}`)
  const { results } = await searchRes.json()
  const match = results[0]
  if (!match) return null

  const opts = { headers: authHeaders(apiKey) }
  const [details, credits] = await Promise.all([
    fetch(`${BASE}/movie/${match.id}`, opts).then(r => r.json()),
    fetch(`${BASE}/movie/${match.id}/credits`, opts).then(r => r.json())
  ])

  return {
    tmdbId: match.id,
    posterPath: match.poster_path ? `${IMG_BASE}/w500${match.poster_path}` : null,
    backdropPath: match.backdrop_path ? `${IMG_BASE}/w1280${match.backdrop_path}` : null,
    year: match.release_date ? parseInt(match.release_date.slice(0, 4)) : null,
    runtime: details.runtime || null,
    voteAverage: match.vote_average || null,
    overview: match.overview || null,
    director: credits.crew.find(p => p.job === 'Director')?.name || 'Unknown',
    cast: credits.cast.slice(0, 5).map(p => p.name),
    enrichedAt: Date.now()
  }
}

async function enrichById(tmdbId, apiKey) {
  const opts = { headers: authHeaders(apiKey) }
  const [details, credits] = await Promise.all([
    fetch(`${BASE}/movie/${tmdbId}`, opts).then(r => { if (!r.ok) throw new Error(`TMDB ${r.status}`); return r.json() }),
    fetch(`${BASE}/movie/${tmdbId}/credits`, opts).then(r => { if (!r.ok) throw new Error(`TMDB credits ${r.status}`); return r.json() })
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

// --- main ---
async function main() {
  loadEnv()

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error([
      'Error: TMDB API key not found.',
      '',
      'Options:',
      '  1. Create .env.local in the project root:',
      '       TMDB_API_KEY=your_read_access_token',
      '  2. Or pass it inline:',
      '       TMDB_API_KEY=your_token node scripts/fetch-tmdb.mjs',
      '',
      'Get your key from: https://www.themoviedb.org/settings/api',
      '(use the "API Read Access Token", not the v3 key)'
    ].join('\n'))
    process.exit(1)
  }

  // Load existing cache (incremental — skip already-fetched movies)
  let cache = {}
  if (existsSync(OUT)) {
    try { cache = JSON.parse(readFileSync(OUT, 'utf-8')) } catch {}
  }

  // Load overrides
  const OVERRIDES_PATH = resolve(ROOT, 'public', 'tmdb-overrides.json')
  let overrides = {}
  if (existsSync(OVERRIDES_PATH)) {
    try { overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8')) }
    catch (e) { console.warn(`Warning: could not parse tmdb-overrides.json — ${e.message}. Overrides skipped.`) }
  }
  const overrideCount = Object.keys(overrides).length
  if (overrideCount > 0) console.log(`Loaded ${overrideCount} override(s) from tmdb-overrides.json`)

  console.log('Fetching collection from Google Sheets...')
  const [movieText, dvdText] = await Promise.all([
    fetch(SHEET_URL).then(r => { if (!r.ok) throw new Error(`Sheet ${r.status}`); return r.text() }),
    fetch(DVD_URL).then(r => { if (!r.ok) throw new Error(`DVD sheet ${r.status}`); return r.text() })
  ])

  const all = groupByTitle([...parseCSV(movieText), ...parseDvdCSV(dvdText)])
  const queue = all.filter(m => !m.isCollection && (!cache[m.id] || overrides[m.id]))

  console.log(`Collection: ${all.length} titles  |  Already cached: ${all.length - queue.length}  |  To fetch: ${queue.length}\n`)

  if (queue.length === 0) {
    console.log('Nothing to do — all movies already cached.')
    return
  }

  let ok = 0, skipped = 0, failed = 0

  for (let i = 0; i < queue.length; i++) {
    const movie = queue[i]
    const prefix = `[${i + 1}/${queue.length}] ${movie.title}`
    process.stdout.write(prefix.padEnd(55))
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

    // Save after every 10 movies so progress isn't lost on interruption
    if ((i + 1) % 10 === 0) writeFileSync(OUT, JSON.stringify(cache, null, 2))

    if (i < queue.length - 1) await new Promise(r => setTimeout(r, 300))
  }

  writeFileSync(OUT, JSON.stringify(cache, null, 2))
  console.log(`\nDone.  ok=${ok}  skipped=${skipped}  failed=${failed}`)
  console.log(`Saved ${Object.keys(cache).length} entries → ${OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
