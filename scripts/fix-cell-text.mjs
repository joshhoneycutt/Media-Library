// One-off utility: literal find/replace across sheet cells.
//
//   node scripts/fix-cell-text.mjs "old=>new" ["old2=>new2" ...] [--tabs "A,B"] [--apply]
//
// Without --apply it is a dry run and prints the diff only. Restricting --tabs
// keeps the Sheets read quota (60/min/user) out of trouble.
import { google } from 'googleapis'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const envPath = resolve(ROOT, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...rest] = line.split('=')
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim()
  }
}

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const argv = process.argv.slice(2)
const apply = argv.includes('--apply')

const tabsIdx = argv.indexOf('--tabs')
const onlyTabs = tabsIdx !== -1 ? argv[tabsIdx + 1].split(',').map(s => s.trim()) : null

const pairs = argv
  .filter(a => a.includes('=>'))
  .map(a => {
    const [find, replace] = a.split('=>')
    return { find, replace }
  })

if (!SHEET_ID || !pairs.length) {
  console.error('usage: node scripts/fix-cell-text.mjs "old=>new" [--tabs "A,B"] [--apply]')
  process.exit(1)
}

function colLetter(i) {
  let r = ''
  for (; i >= 0; i = Math.floor(i / 26) - 1) r = String.fromCharCode((i % 26) + 65) + r
  return r
}

const raw = JSON.parse(readFileSync(resolve(ROOT, 'google-credentials.json')))
const { client_id, client_secret } = raw.installed || raw.web
const auth = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3335')
auth.setCredentials(JSON.parse(readFileSync(resolve(ROOT, 'google-token.json'))))
const sheets = google.sheets({ version: 'v4', auth })

let titles = onlyTabs
if (!titles) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  titles = meta.data.sheets.map(s => s.properties.title)
}

const edits = []
for (const title of titles) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${title}'!A:Z`
  })
  ;(data.values || []).forEach((row, r) => {
    row.forEach((cell, c) => {
      if (typeof cell !== 'string') return
      let after = cell
      for (const { find, replace } of pairs) {
        if (after.includes(find)) after = after.split(find).join(replace)
      }
      if (after === cell) return
      edits.push({
        range: `'${title}'!${colLetter(c)}${r + 1}`,
        where: `${title} ${colLetter(c)}${r + 1}`,
        before: cell,
        after
      })
    })
  })
}

if (!edits.length) {
  console.log('No matching cells found.')
  process.exit(0)
}

console.log(`${edits.length} cell(s) to change:\n`)
for (const e of edits) {
  console.log(`  ${e.where}`)
  console.log(`    - ${e.before}`)
  console.log(`    + ${e.after}`)
}

if (!apply) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply to write.')
  process.exit(0)
}

await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: SHEET_ID,
  resource: {
    valueInputOption: 'RAW',
    data: edits.map(e => ({ range: e.range, values: [[e.after]] }))
  }
})
console.log(`\nWrote ${edits.length} cell(s).`)
