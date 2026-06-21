import { google } from 'googleapis'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import http from 'http'
import { Readable } from 'stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PORT = 3334

// Load .env.local manually (no dotenv dependency needed)
const envPath = resolve(ROOT, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID
if (!SHEET_ID) { console.error('GOOGLE_SHEET_ID is not set in .env.local'); process.exit(1) }
const CREDENTIALS_PATH = resolve(ROOT, 'google-credentials.json')
const TOKEN_PATH       = resolve(ROOT, 'google-token.json')

function titleToSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')
}

function colLetter(i) {
  let r = ''
  for (; i >= 0; i = Math.floor(i / 26) - 1)
    r = String.fromCharCode((i % 26) + 65) + r
  return r
}

const REDIRECT_PORT = 3335  // separate from Vite (5173) and main API (3334)

let cachedAuth = null

async function initAuth() {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error('google-credentials.json not found.')
  }
  const raw = JSON.parse(readFileSync(CREDENTIALS_PATH))
  const { client_id, client_secret } = raw.installed || raw.web
  const redirectUri = `http://localhost:${REDIRECT_PORT}`
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirectUri)

  // Auto-save refreshed tokens
  oauth2.on('tokens', tokens => {
    const existing = existsSync(TOKEN_PATH) ? JSON.parse(readFileSync(TOKEN_PATH)) : {}
    writeFileSync(TOKEN_PATH, JSON.stringify({ ...existing, ...tokens }))
  })

  if (existsSync(TOKEN_PATH)) {
    oauth2.setCredentials(JSON.parse(readFileSync(TOKEN_PATH)))
    try {
      await oauth2.getAccessToken()
      cachedAuth = oauth2
      return
    } catch (e) {
      if (!e.message.includes('invalid_grant')) throw e
      console.warn('[api-server] Token invalid, starting re-auth flow…')
    }
  }

  // Re-auth: print URL, catch code via temporary HTTP server
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
    prompt: 'consent'
  })
  console.log('\n*** ACTION REQUIRED — open this URL in your browser ***\n')
  console.log(authUrl + '\n')

  const code = await new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const url = new URL(req.url, redirectUri)
      const code = url.searchParams.get('code')
      res.end(code ? '<h1>Authorized! You can close this tab.</h1>' : '<h1>No code.</h1>')
      srv.close()
      code ? resolve(code) : reject(new Error('No code in OAuth callback'))
    })
    srv.listen(REDIRECT_PORT, () => console.log(`[api-server] Waiting for OAuth callback on port ${REDIRECT_PORT}…`))
    srv.on('error', reject)
  })

  const { tokens } = await oauth2.getToken(code)
  oauth2.setCredentials(tokens)
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens))
  console.log('[api-server] Token saved.\n')
  cachedAuth = oauth2
}

function getAuth() {
  if (!cachedAuth) throw new Error('Auth not initialized')
  return cachedAuth
}

async function writeReviewToSheet(sheets, sheetTitle, movieId, rating, review) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetTitle}'!A:Z`,
  })
  const rows = data.values || []
  if (rows.length < 2) return false

  const headers = rows[0]

  let ratingCol = headers.findIndex(h => h.trim().toLowerCase() === 'rating')
  let reviewCol = headers.findIndex(h => h.trim().toLowerCase() === 'review')

  const batchData = []

  // Add headers if missing
  if (ratingCol === -1) {
    ratingCol = headers.length
    batchData.push({ range: `'${sheetTitle}'!${colLetter(ratingCol)}1`, values: [['Rating']] })
  }
  if (reviewCol === -1) {
    reviewCol = Math.max(headers.length, ratingCol + 1)
    batchData.push({ range: `'${sheetTitle}'!${colLetter(reviewCol)}1`, values: [['Review']] })
  }

  // Find the movie row
  let found = false
  for (let i = 1; i < rows.length; i++) {
    const filmName = (rows[i][1] || '').replace(/^"|"$/g, '').trim()
    if (!filmName) continue
    if (titleToSlug(filmName) === movieId) {
      const rowNum = i + 1
      batchData.push({ range: `'${sheetTitle}'!${colLetter(ratingCol)}${rowNum}`, values: [[rating]] })
      batchData.push({ range: `'${sheetTitle}'!${colLetter(reviewCol)}${rowNum}`, values: [[review]] })
      found = true
      break
    }
  }

  if (batchData.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: { valueInputOption: 'RAW', data: batchData },
    })
  }

  return found
}

const OVERRIDES_PATH = resolve(ROOT, 'public', 'tmdb-overrides.json')
const OVERRIDES_SHEET = 'TMDB Overrides'
const TMDB_DATA_SHEET = 'TMDB Data'

const TMDB_DATA_HEADERS = [
  'Slug', 'Title', 'Year', 'Runtime', 'TMDB_Rating', 'Vote_Count',
  'Tagline', 'Genres', 'Original_Title', 'IMDB_ID', 'Budget', 'Revenue',
  'Director', 'Writers', 'Producers', 'Cast', 'Languages', 'Countries', 'Studios',
  'Poster_URL', 'Backdrop_URL', 'TMDB_ID', 'Enriched_At'
]

async function ensureTmdbDataSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const exists = meta.data.sheets.some(s => s.properties.title === TMDB_DATA_SHEET)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: { requests: [{ addSheet: { properties: { title: TMDB_DATA_SHEET } } }] }
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${TMDB_DATA_SHEET}'!A1`,
      valueInputOption: 'RAW',
      resource: { values: [TMDB_DATA_HEADERS] }
    })
  }
}

async function handleTmdbData(body) {
  const { movieId, title, data } = body
  if (!movieId || !data) throw new Error('movieId and data required')

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureTmdbDataSheet(sheets)

  const row = [
    movieId,
    title || '',
    data.year || '',
    data.runtime || '',
    data.voteAverage || '',
    data.voteCount || '',
    data.tagline || '',
    (data.genres || []).join(', '),
    data.originalTitle || '',
    data.imdbId || '',
    data.budget || '',
    data.revenue || '',
    data.director || '',
    (data.writers || []).join(', '),
    (data.producers || []).join(', '),
    (data.cast || []).join(', '),
    (data.languages || []).join(', '),
    (data.productionCountries || []).join(', '),
    (data.productionCompanies || []).join(', '),
    data.posterPath ? `=IMAGE("${data.posterPath}")` : '',
    data.backdropPath ? `=IMAGE("${data.backdropPath}")` : '',
    data.tmdbId || '',
    data.enrichedAt ? new Date(data.enrichedAt).toISOString() : '',
  ]

  // Find existing row for this slug or append
  const { data: sheetData } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${TMDB_DATA_SHEET}'!A:A`,
  })
  const slugs = (sheetData.values || []).map(r => r[0])
  let rowNum = slugs.indexOf(movieId)
  rowNum = rowNum > 0 ? rowNum + 1 : slugs.length + 1

  const endCol = colLetter(TMDB_DATA_HEADERS.length - 1)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${TMDB_DATA_SHEET}'!A${rowNum}:${endCol}${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [row] }
  })

  return { ok: true, movieId }
}

async function ensureOverridesSheet(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const exists = meta.data.sheets.some(s => s.properties.title === OVERRIDES_SHEET)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: { requests: [{ addSheet: { properties: { title: OVERRIDES_SHEET } } }] }
    })
    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${OVERRIDES_SHEET}'!A1:B1`,
      valueInputOption: 'RAW',
      resource: { values: [['Slug', 'TMDB_ID']] }
    })
  }
}

async function handleOverride(body) {
  const { movieId, tmdbId } = body
  if (!movieId || !tmdbId) throw new Error('movieId and tmdbId required')

  // Update public/tmdb-overrides.json
  let current = {}
  try { current = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8')) } catch {}
  current[movieId] = tmdbId
  writeFileSync(OVERRIDES_PATH, JSON.stringify(current, null, 2))

  // Sync to Google Sheet
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await ensureOverridesSheet(sheets)

  // Read existing rows to find or append
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${OVERRIDES_SHEET}'!A:B`,
  })
  const rows = data.values || []
  let rowNum = null
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === movieId) { rowNum = i + 1; break }
  }
  if (!rowNum) rowNum = rows.length + 1

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${OVERRIDES_SHEET}'!A${rowNum}:B${rowNum}`,
    valueInputOption: 'RAW',
    resource: { values: [[movieId, tmdbId]] }
  })

  return { ok: true, movieId, tmdbId }
}

async function handleReview(body) {
  const { movieId, title, rating, review } = body
  if (!movieId) throw new Error('movieId required')

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const allSheets = meta.data.sheets.map(s => ({ id: s.properties.sheetId, title: s.properties.title }))

  let found = false
  for (const sheet of allSheets) {
    const ok = await writeReviewToSheet(sheets, sheet.title, movieId, rating ?? '', review ?? '')
    if (ok) found = true
  }

  return { ok: true, found, movieId }
}

async function main() {
  await initAuth()

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    if (req.method === 'POST' && req.url === '/api/override') {
      let body = ''
      req.on('data', c => body += c)
      req.on('end', async () => {
        try {
          const data = JSON.parse(body)
          const result = await handleOverride(data)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[api-server]', e.message)
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end(e.message)
        }
      })
      return
    }

    if (req.method === 'POST' && req.url === '/api/tmdb-data') {
      let body = ''
      req.on('data', c => body += c)
      req.on('end', async () => {
        try {
          const data = JSON.parse(body)
          const result = await handleTmdbData(data)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[api-server]', e.message)
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end(e.message)
        }
      })
      return
    }

    if (req.method === 'POST' && req.url === '/api/review') {
      let body = ''
      req.on('data', c => body += c)
      req.on('end', async () => {
        try {
          const data = JSON.parse(body)
          const result = await handleReview(data)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[api-server]', e.message)
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end(e.message)
        }
      })
      return
    }

    res.writeHead(404); res.end('Not found')
  })

  server.listen(PORT, () => console.log(`[api-server] listening on http://localhost:${PORT}`))
}

main().catch(e => { console.error('[api-server] fatal:', e.message); process.exit(1) })
