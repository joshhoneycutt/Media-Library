import { normalizeFormat, titleToSlug, parseFields } from './sheets.js'

// "The Complete First Season"
const ORDINAL_WORDS = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12
}

// "Northwind Season One"
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12
}

const ordinalGroup = Object.keys(ORDINAL_WORDS).join('|')
const numberGroup = Object.keys(NUMBER_WORDS).join('|')

// "The Complete First Season" and the bare "The First Season" both appear in
// the Show Name column; Category Name uses plain "Season 1".
const RE_COMPLETE_ORDINAL = new RegExp(`\\b(?:the\\s+)?(?:complete\\s+)?(${ordinalGroup})\\s+seasons?\\b`, 'i')
const RE_COMPLETE_SERIES = /\b(?:the\s+)?(?:complete|entire|full)\s+series\b/i
const RE_FINAL_SEASON = /\b(?:the\s+)?final\s+seasons?\b/i
const RE_SEASON_RANGE = /\bseasons?\s+(\d+)\s*[-–—]\s*(\d+)\b/i
const RE_SEASON_WORD = new RegExp(`\\bseasons?\\s+(${numberGroup})\\b`, 'i')
const RE_SEASON_NUM = /\bseasons?\s+(\d+)\b/i

function tidy(str) {
  return str
    .replace(/\s+/g, ' ')
    .replace(/[\s:,–—-]+$/, '')
    .trim()
}

function seasonRange(a, b) {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const seasons = []
  for (let i = lo; i <= hi; i++) seasons.push(i)
  return { seasons, label: `Seasons ${lo}–${hi}` }
}

// Ordered by specificity: an earlier pattern wins when two matches overlap.
const PATTERNS = [
  { re: RE_COMPLETE_ORDINAL, read: m => {
    const n = ORDINAL_WORDS[m[1].toLowerCase()]
    return { seasons: [n], label: `Season ${n}` }
  } },
  { re: RE_COMPLETE_SERIES, read: () => ({ seasons: null, label: 'Complete Series' }) },
  { re: RE_FINAL_SEASON, read: () => ({ seasons: null, label: 'Final Season' }) },
  { re: RE_SEASON_RANGE, read: m => seasonRange(+m[1], +m[2]) },
  { re: RE_SEASON_WORD, read: m => {
    const n = NUMBER_WORDS[m[1].toLowerCase()]
    return { seasons: [n], label: `Season ${n}` }
  } },
  { re: RE_SEASON_NUM, read: m => ({ seasons: [+m[1]], label: `Season ${+m[1]}` }) }
]

function findMarkers(name) {
  const hits = []
  PATTERNS.forEach(({ re, read }, priority) => {
    const g = new RegExp(re.source, 'gi')
    let m
    while ((m = g.exec(name)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, priority, ...read(m) })
      if (m.index === g.lastIndex) g.lastIndex++
    }
  })
  hits.sort((a, b) => a.start - b.start || a.priority - b.priority)
  const kept = []
  for (const hit of hits) {
    if (kept.some(k => hit.start < k.end && k.start < hit.end)) continue
    kept.push(hit)
  }
  return kept
}

/**
 * Pull season information out of a row title.
 * Returns the season numbers covered (null when the row is the whole show),
 * a display label, and the title with every season marker removed.
 *
 * Some Category Names carry a sort-order prefix that repeats a season marker,
 * e.g. "Northwind 9 Season 9 Offshoot Season 1". The right-most
 * marker is the one that identifies the disc.
 */
export function parseSeasonInfo(name) {
  if (!name) return { seasons: null, label: null, rest: '' }

  const markers = findMarkers(name)
  if (!markers.length) return { seasons: null, label: null, rest: name }

  const primary = markers[markers.length - 1]
  let rest = ''
  let cursor = 0
  for (const marker of markers) {
    rest += name.slice(cursor, marker.start) + ' '
    cursor = marker.end
  }
  rest += name.slice(cursor)

  return { seasons: primary.seasons, label: primary.label, rest }
}

/** Strip the season portion so "Northwind Season 3" becomes "Northwind". */
export function stripSeason(name) {
  const { rest } = parseSeasonInfo(name)
  let out = tidy(rest)
  // Sort-order hacks leave a stray index behind ("Northwind 1 Season 1",
  // "Northwind 9"). Drop a lone trailing number as long as
  // real words remain — the leading \s means a title that is only a number
  // ("24") is never matched in the first place.
  const trailing = out.match(/\s(\d{1,2})$/)
  if (trailing) {
    const head = tidy(out.slice(0, trailing.index))
    if (head && !/^\d+$/.test(head)) out = head
  }
  return out
}

/** Grouping key: case/article/punctuation insensitive so "Harbor" == "The Harbor". */
export function showKey(title) {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * The two TV tabs differ: "Television Bluray + 4K" has a Notes column before
 * Rating/Review, "Television DVD" does not.
 */
export function parseTvCSV(text, { hasNotes = true } = {}) {
  const rows = []
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const f = parseFields(line).map(v => v.replace(/^"|"$/g, '').trim())
    const categoryName = f[0] || ''
    const showName = f[1] || ''
    if (!categoryName && !showName) continue
    rows.push({
      categoryName: categoryName || showName,
      showName: showName || categoryName,
      genre: f[2] || '',
      subGenre: f[3] || '',
      diskType: f[4] || '',
      notes: hasNotes ? (f[5] || '') : ''
    })
  }
  return rows
}

/** Collapse per-season rows into one entry per show. */
export function groupByShow(rows) {
  const map = new Map()
  const titleVotes = new Map()

  for (const row of rows) {
    const catTitle = stripSeason(row.categoryName)
    const key = showKey(catTitle)
    if (!key) continue

    // Category Name is the more reliable marker, but fall back to Show Name —
    // "Northwind" / "Northwind Full Series" only labels the season on the
    // Show Name side.
    const info = parseSeasonInfo(row.categoryName)
    const showInfo = parseSeasonInfo(row.showName)
    const seasons = info.seasons ?? showInfo.seasons
    const label = info.label || showInfo.label || tidy(row.showName)
    const formats = normalizeFormat(row.diskType)

    let show = map.get(key)
    if (!show) {
      show = {
        id: titleToSlug(catTitle),
        title: catTitle,
        sortKey: key,
        genre: row.genre,
        subGenre: row.subGenre,
        formats: [],
        notes: [],
        seasons: []
      }
      map.set(key, show)
      titleVotes.set(key, new Map())
    }

    // Show Name is the marketing title and varies per row ("The Fourth
    // Season", a subtitled revival), while Category Name is consistent.
    // Only prefer Show Name when every row of the show agrees on it — that
    // recovers nicer titles like "The Harbor" without letting one row rename
    // a whole series.
    const candidate = stripSeason(row.showName) || catTitle
    const votes = titleVotes.get(key)
    votes.set(candidate, (votes.get(candidate) || 0) + 1)

    if (!show.genre && row.genre) show.genre = row.genre
    if (!show.subGenre && row.subGenre) show.subGenre = row.subGenre
    for (const f of formats) if (!show.formats.includes(f)) show.formats.push(f)
    if (row.notes && !show.notes.includes(row.notes)) show.notes.push(row.notes)

    show.seasons.push({
      id: titleToSlug(row.categoryName),
      categoryName: row.categoryName,
      title: row.showName,
      label,
      seasons,
      sortNum: seasons?.[0] ?? Number.MAX_SAFE_INTEGER,
      formats,
      notes: row.notes ? [row.notes] : []
    })
  }

  for (const [key, show] of map) {
    const candidates = [...titleVotes.get(key).keys()]
    if (candidates.length === 1 && candidates[0]) show.title = candidates[0]

    // A complete-series set contains every season, so owning one means owning
    // each individual season in that format too — a "The Complete Series"
    // box on 4K makes every season of that show available on 4K.
    const boxFormats = []
    for (const season of show.seasons) {
      if (season.seasons !== null || season.label !== 'Complete Series') continue
      season.coversAllSeasons = true
      for (const f of season.formats) if (!boxFormats.includes(f)) boxFormats.push(f)
    }
    show.hasCompleteSeries = show.seasons.some(s => s.coversAllSeasons)
    for (const season of show.seasons) {
      if (season.coversAllSeasons) continue
      for (const f of boxFormats) if (!season.formats.includes(f)) season.formats.push(f)
    }

    // Distinct season numbers owned, so a "Seasons 1-3" set counts as three.
    const owned = new Set()
    for (const season of show.seasons) {
      for (const n of season.seasons || []) owned.add(n)
    }
    show.ownedSeasons = owned.size

    // Whole-series sets sort first; they cover everything below them.
    show.seasons.sort((a, b) =>
      (b.coversAllSeasons ? 1 : 0) - (a.coversAllSeasons ? 1 : 0) ||
      a.sortNum - b.sortNum ||
      a.label.localeCompare(b.label)
    )
    show.seasonCount = show.seasons.length
  }

  return Array.from(map.values())
}

export async function fetchAllShows() {
  const [bluText, dvdText] = await Promise.all([
    fetch('/api/sheet/tv').then(r => {
      if (!r.ok) throw new Error(`TV sheet fetch failed: ${r.status}`)
      return r.text()
    }),
    fetch('/api/sheet/tv-dvd').then(r => {
      if (!r.ok) throw new Error(`TV DVD sheet fetch failed: ${r.status}`)
      return r.text()
    })
  ])
  return groupByShow([
    ...parseTvCSV(bluText, { hasNotes: true }),
    ...parseTvCSV(dvdText, { hasNotes: false })
  ])
}
