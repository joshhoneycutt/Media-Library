import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '..')
const TMDB_PATH = resolve(ROOT, 'public', 'tmdb-cache.json')
const OUT       = resolve(ROOT, 'public', 'awards-cache.json')

const SPARQL_URL = 'https://query.wikidata.org/sparql'
const BATCH_SIZE = 40  // IDs per SPARQL query

// --- env ---
function loadEnv() {
  const p = resolve(ROOT, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const k = line.slice(0, eq).trim(), v = line.slice(eq + 1).trim()
    if (k && !process.env[k]) process.env[k] = v
  }
}

// --- TMDB: get IMDb IDs for all cached movies ---
async function fetchImdbIds(tmdbIds, apiKey) {
  const results = {}
  const chunks = []
  for (let i = 0; i < tmdbIds.length; i += 20) chunks.push(tmdbIds.slice(i, i + 20))

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async ({ slug, tmdbId }) => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        )
        if (!res.ok) return
        const data = await res.json()
        if (data.imdb_id) results[slug] = data.imdb_id
      } catch {}
    }))
    await new Promise(r => setTimeout(r, 250))
  }
  return results  // { slug -> imdbId }
}

const stripPrefix = l => l.replace(/^Academy Award for /i, '').replace(/^Academy Award /i, '').trim()

// --- Wikidata SPARQL: Oscar category names by IMDb ID ---
async function queryOscars(imdbIds) {
  const values = imdbIds.map(id => `"${id}"`).join(' ')
  const query = `
SELECT ?imdbId
       (GROUP_CONCAT(DISTINCT ?winLabel; separator="|") AS ?winsStr)
       (GROUP_CONCAT(DISTINCT ?nomLabel; separator="|") AS ?nomsStr)
WHERE {
  VALUES ?imdbId { ${values} }
  ?film wdt:P345 ?imdbId.
  {
    ?film p:P166 ?winStmt.
    ?winStmt ps:P166 ?win.
    ?win wdt:P31 wd:Q19020.
    ?win rdfs:label ?winLabel.
    FILTER(LANG(?winLabel) = "en")
  } UNION {
    ?film p:P1411 ?nomStmt.
    ?nomStmt ps:P1411 ?nom.
    ?nom wdt:P31 wd:Q19020.
    ?nom rdfs:label ?nomLabel.
    FILTER(LANG(?nomLabel) = "en")
  }
}
GROUP BY ?imdbId
`
  const res = await fetch(`${SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`, {
    headers: { 'User-Agent': 'TheLibraryApp/1.0', Accept: 'application/sparql-results+json' }
  })
  if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.results.bindings
}

// --- main ---
async function main() {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    console.error('Error: TMDB_API_KEY not set in .env.local')
    process.exit(1)
  }

  const tmdbCache   = existsSync(TMDB_PATH) ? JSON.parse(readFileSync(TMDB_PATH)) : {}
  const awardsCache = existsSync(OUT) ? JSON.parse(readFileSync(OUT)) : {}

  // Find movies that still need processing
  const toFetch = Object.entries(tmdbCache)
    .filter(([slug, d]) => d?.tmdbId && !(slug in awardsCache))
    .map(([slug, d]) => ({ slug, tmdbId: d.tmdbId }))

  const total = Object.keys(tmdbCache).length
  console.log(`Collection: ${total}  |  Already cached: ${total - toFetch.length}  |  To fetch: ${toFetch.length}\n`)
  if (!toFetch.length) { console.log('Nothing to do.'); return }

  // Step 1: get IMDb IDs from TMDB
  console.log('Fetching IMDb IDs from TMDB...')
  const slugToImdb = await fetchImdbIds(toFetch, apiKey)
  const withImdb = toFetch.filter(({ slug }) => slugToImdb[slug])
  console.log(`Got IMDb IDs for ${withImdb.length}/${toFetch.length} movies\n`)

  // Mark movies without IMDb IDs as done (no Oscar data available)
  for (const { slug } of toFetch) {
    if (!slugToImdb[slug]) awardsCache[slug] = null
  }

  // Step 2: query Wikidata in batches for Oscar data
  const imdbSlugs = withImdb.map(({ slug }) => ({ slug, imdbId: slugToImdb[slug] }))
  let withOscars = 0

  for (let i = 0; i < imdbSlugs.length; i += BATCH_SIZE) {
    const batch = imdbSlugs.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(imdbSlugs.length / BATCH_SIZE)
    process.stdout.write(`Wikidata batch ${batchNum}/${totalBatches}... `)

    // Mark all as checked (null = no Oscars) before overwriting with found data
    for (const { slug } of batch) awardsCache[slug] = null

    try {
      const rows = await queryOscars(batch.map(b => b.imdbId))
      const imdbToSlug = Object.fromEntries(batch.map(({ slug, imdbId }) => [imdbId, slug]))

      for (const row of rows) {
        const slug = imdbToSlug[row.imdbId.value]
        if (!slug) continue
        const wonCategories = (row.winsStr?.value || '').split('|').filter(Boolean).map(stripPrefix)
        const nomCategories = (row.nomsStr?.value || '').split('|').filter(Boolean).map(stripPrefix)
        if (!wonCategories.length && !nomCategories.length) continue
        awardsCache[slug] = {
          wins: wonCategories.length,
          nominations: wonCategories.length + nomCategories.length,
          wonCategories,
          nomCategories,
        }
        withOscars++
      }
      console.log(`${rows.length} with Oscar data`)
    } catch (e) {
      console.log(`error: ${e.message}`)
    }

    writeFileSync(OUT, JSON.stringify(awardsCache, null, 2))
    if (i + BATCH_SIZE < imdbSlugs.length) await new Promise(r => setTimeout(r, 1500))
  }

  writeFileSync(OUT, JSON.stringify(awardsCache, null, 2))
  console.log(`\nDone. ${withOscars} movies with Oscar data found.`)
  console.log(`Saved → ${OUT}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
