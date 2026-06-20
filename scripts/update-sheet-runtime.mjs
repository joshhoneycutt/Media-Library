import { google } from 'googleapis'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import http from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const ENV_PATH = resolve(ROOT, '.env.local')
if (existsSync(ENV_PATH)) {
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
}
const SHEET_ID = process.env.GOOGLE_SHEET_ID
if (!SHEET_ID) { console.error('GOOGLE_SHEET_ID is not set in .env.local'); process.exit(1) }
const SCOPES          = ['https://www.googleapis.com/auth/spreadsheets']
const CREDENTIALS_PATH = resolve(ROOT, 'google-credentials.json')
const TOKEN_PATH       = resolve(ROOT, 'google-token.json')
const CACHE_PATH       = resolve(ROOT, 'public', 'tmdb-cache.json')
const REDIRECT_PORT    = 3333

function titleToSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-')
}

function colLetter(i) {
  let r = ''
  for (; i >= 0; i = Math.floor(i / 26) - 1)
    r = String.fromCharCode((i % 26) + 65) + r
  return r
}

// --- auth ---

async function getAuth() {
  if (!existsSync(CREDENTIALS_PATH)) {
    console.error([
      'google-credentials.json not found.',
      '',
      'Set it up in 3 steps:',
      '  1. Go to https://console.cloud.google.com',
      '  2. Create a project → Enable "Google Sheets API" → Credentials',
      '     → Create OAuth 2.0 Client ID (Desktop app) → Download JSON',
      '  3. Save the file as google-credentials.json in the project root',
    ].join('\n'))
    process.exit(1)
  }

  const raw = JSON.parse(readFileSync(CREDENTIALS_PATH))
  const { client_id, client_secret } = raw.installed || raw.web
  const redirectUri = `http://localhost:${REDIRECT_PORT}`
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirectUri)

  if (existsSync(TOKEN_PATH)) {
    oauth2.setCredentials(JSON.parse(readFileSync(TOKEN_PATH)))
    return oauth2
  }

  // First-time: open browser auth, catch code via local redirect
  const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES })

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, redirectUri)
      const code = url.searchParams.get('code')
      if (code) {
        res.end('<h1>Authorized! You can close this tab.</h1>')
        server.close()
        resolve(code)
      } else {
        res.end('<h1>No code found.</h1>')
        reject(new Error('No code in callback'))
      }
    })
    server.listen(REDIRECT_PORT, () => {
      console.log('\nOpen this URL in your browser to authorize:\n')
      console.log(authUrl + '\n')
      console.log('Waiting for authorization...')
    })
  })

  const { tokens } = await oauth2.getToken(code)
  oauth2.setCredentials(tokens)
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens))
  console.log('Token saved to google-token.json\n')
  return oauth2
}

// --- sheet update ---

async function updateSheet(sheets, sheetTitle) {
  const cache = JSON.parse(readFileSync(CACHE_PATH))

  // Read all current data
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${sheetTitle}'!A:Z`,
  })

  const rows = data.values || []
  if (rows.length < 2) { console.log(`  ${sheetTitle}: no data`); return }

  const headers = rows[0]
  let runtimeCol = headers.findIndex(h => h.trim().toLowerCase() === 'runtime')
  const isNew = runtimeCol === -1
  if (isNew) runtimeCol = headers.length

  const batchData = []

  if (isNew) {
    batchData.push({
      range: `'${sheetTitle}'!${colLetter(runtimeCol)}1`,
      values: [['Runtime']]
    })
  }

  let updated = 0, skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const filmName = (rows[i][1] || '').replace(/^"|"$/g, '').trim()
    if (!filmName) continue

    const slug = titleToSlug(filmName)
    const runtime = cache[slug]?.runtime

    if (runtime) {
      batchData.push({
        range: `'${sheetTitle}'!${colLetter(runtimeCol)}${i + 1}`,
        values: [[runtime]]
      })
      updated++
    } else {
      skipped++
    }
  }

  if (batchData.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: { valueInputOption: 'RAW', data: batchData },
    })
  }

  console.log(`  ${sheetTitle}: ${updated} rows updated, ${skipped} skipped (no TMDB data)`)
}

// --- main ---

async function main() {
  const auth = await getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // Resolve the tab name for gid=0
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const allSheets = meta.data.sheets.map(s => ({ id: s.properties.sheetId, title: s.properties.title }))

  const mainSheet = allSheets.find(s => s.id === 0)
  if (!mainSheet) { console.error('Could not find sheet with gid=0'); process.exit(1) }

  console.log(`Spreadsheet: ${meta.data.properties.title}`)
  console.log(`Sheets found: ${allSheets.map(s => s.title).join(', ')}\n`)

  console.log('Updating sheets with runtime data...')
  await updateSheet(sheets, mainSheet.title)

  const dvdSheet = allSheets.find(s => s.title.toLowerCase() === 'dvd')
  if (dvdSheet) await updateSheet(sheets, dvdSheet.title)

  console.log('\nDone.')
}

main().catch(e => { console.error(e.message); process.exit(1) })
