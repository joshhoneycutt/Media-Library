const FORMAT_MAP = {
  '4k': '4K',
  'blu-ray': 'Blu-ray',
  'blu-rau': 'Blu-ray',
  'blu-rays': 'Blu-ray',
  'blu-ras': 'Blu-ray',
  'dvd': 'DVD',
  'digital': 'Digital',
  'digital hd': 'Digital',
  'hd': 'Digital',
  'vudu': 'Digital',
  'itunes': 'Digital',
  'movies anywhere': 'Digital',
}

export function normalizeFormat(diskType) {
  if (!diskType) return []
  const trimmed = diskType.trim()
  if (trimmed.includes('/')) {
    return trimmed.split('/').flatMap(normalizeFormat).filter(Boolean)
  }
  const lower = trimmed.toLowerCase()
  return [FORMAT_MAP[lower] || trimmed]
}

export function normalizeTitle(title) {
  return title.toLowerCase().trim().replace(/^(the |a |an )/, '').trim()
}

export function titleToSlug(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function isCollection(filmName) {
  const lower = filmName.toLowerCase()
  return lower.includes('collection') ||
    lower.includes('trilogy') ||
    lower.includes('anthology') ||
    lower.includes('saga') ||
    lower.includes('box set') ||
    /\d+\s*[&,]\s*\d+/.test(lower)
}

const WORD_LIMITS = {
  'duology': 2, 'double': 2,
  'trilogy': 3, 'triple': 3,
  'quadrilogy': 4, 'tetralogy': 4, 'quadruple': 4,
  'pentalogy': 5, 'quintuple': 5,
  'hexalogy': 6, 'sextet': 6,
}

export function collectionPartLimit(filmName) {
  const lower = filmName.toLowerCase()
  for (const [word, limit] of Object.entries(WORD_LIMITS)) {
    if (lower.includes(word)) return limit
  }
  const match = filmName.match(/\d+(?:\s*[&,]\s*\d+)+/)
  if (!match) return null
  const nums = match[0].split(/[\s&,]+/).map(Number).filter(n => !isNaN(n))
  return Math.max(...nums)
}

function parseFields(line) {
  const fields = []
  let inQuote = false
  let current = ''
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuote = !inQuote }
    else if (line[i] === ',' && !inQuote) { fields.push(current.trim()); current = '' }
    else { current += line[i] }
  }
  fields.push(current.trim())
  return fields
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  const rows = []
  for (const line of lines.slice(1)) {
    const fields = parseFields(line)
    const filmName = (fields[1] || '').replace(/^"|"$/g, '').trim()
    if (!filmName) continue
    rows.push({
      filmSortName: (fields[0] || '').replace(/^"|"$/g, '').trim(),
      filmName,
      genre: (fields[2] || '').replace(/^"|"$/g, '').trim(),
      subGenre: (fields[3] || '').replace(/^"|"$/g, '').trim(),
      diskType: (fields[4] || '').replace(/^"|"$/g, '').trim(),
      notes: (fields[5] || '').replace(/^"|"$/g, '').trim()
    })
  }
  return rows
}

// The DVD sheet uses "Screen Type" in column 4 instead of "Disk Type".
// We ignore the screen type value and always record format as DVD.
export function parseDvdCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  const rows = []
  for (const line of lines.slice(1)) {
    const fields = parseFields(line)
    const filmName = (fields[1] || '').replace(/^"|"$/g, '').trim()
    if (!filmName) continue
    rows.push({
      filmSortName: (fields[0] || '').replace(/^"|"$/g, '').trim(),
      filmName,
      genre: (fields[2] || '').replace(/^"|"$/g, '').trim(),
      subGenre: (fields[3] || '').replace(/^"|"$/g, '').trim(),
      diskType: 'DVD',
      notes: (fields[5] || '').replace(/^"|"$/g, '').trim()
    })
  }
  return rows
}

export function groupByTitle(rows) {
  const map = new Map()
  for (const row of rows) {
    const key = normalizeTitle(row.filmName)
    const formats = normalizeFormat(row.diskType)
    const notes = row.notes ? [row.notes] : []

    if (map.has(key)) {
      const existing = map.get(key)
      for (const f of formats) {
        if (!existing.formats.includes(f)) existing.formats.push(f)
      }
      for (const n of notes) {
        if (n && !existing.notes.includes(n)) existing.notes.push(n)
      }
    } else {
      map.set(key, {
        id: titleToSlug(row.filmName),
        title: row.filmName,
        sortKey: normalizeTitle(row.filmSortName || row.filmName),
        genre: row.genre,
        subGenre: row.subGenre,
        formats,
        notes,
        isCollection: isCollection(row.filmName),
        collectionPartLimit: collectionPartLimit(row.filmName)
      })
    }
  }
  return Array.from(map.values())
}

export async function fetchAndParseSheet() {
  const res = await fetch('/api/sheet')
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)
  const text = await res.text()
  return groupByTitle(parseCSV(text))
}

export async function fetchAllMedia() {
  const [movieText, dvdText] = await Promise.all([
    fetch('/api/sheet').then(r => { if (!r.ok) throw new Error(`Sheet fetch failed: ${r.status}`); return r.text() }),
    fetch('/api/sheet/dvd').then(r => { if (!r.ok) throw new Error(`DVD sheet fetch failed: ${r.status}`); return r.text() })
  ])
  return groupByTitle([...parseCSV(movieText), ...parseDvdCSV(dvdText)])
}
