import { describe, it, expect } from 'vitest'
import {
  normalizeFormat,
  normalizeTitle,
  titleToSlug,
  parseCSV,
  parseDvdCSV,
  groupByTitle,
  isCollection
} from '../sheets.js'

describe('normalizeFormat', () => {
  it('normalizes 4k variants to 4K', () => {
    expect(normalizeFormat('4k')).toEqual(['4K'])
    expect(normalizeFormat('4K')).toEqual(['4K'])
    expect(normalizeFormat('4k ')).toEqual(['4K'])
  })
  it('normalizes Blu-Ray variants to Blu-ray', () => {
    expect(normalizeFormat('Blu-Ray')).toEqual(['Blu-ray'])
    expect(normalizeFormat('Blu-Rau')).toEqual(['Blu-ray'])
    expect(normalizeFormat('Blu-Rays')).toEqual(['Blu-ray'])
  })
  it('splits combined formats', () => {
    expect(normalizeFormat('4K/Blu-Ray')).toEqual(['4K', 'Blu-ray'])
  })
  it('returns empty array for empty input', () => {
    expect(normalizeFormat('')).toEqual([])
    expect(normalizeFormat(null)).toEqual([])
  })
  it('normalizes dvd variants to DVD', () => {
    expect(normalizeFormat('dvd')).toEqual(['DVD'])
    expect(normalizeFormat('DVD')).toEqual(['DVD'])
  })
})

describe('normalizeTitle', () => {
  it('strips leading articles', () => {
    expect(normalizeTitle('The Matrix')).toBe('matrix')
    expect(normalizeTitle('A Beautiful Mind')).toBe('beautiful mind')
    expect(normalizeTitle('An Officer')).toBe('officer')
  })
  it('lowercases and trims', () => {
    expect(normalizeTitle('  ALIEN  ')).toBe('alien')
  })
})

describe('titleToSlug', () => {
  it('converts title to URL-safe slug', () => {
    expect(titleToSlug('The Matrix')).toBe('the-matrix')
    expect(titleToSlug("I, Tonya")).toBe('i-tonya')
  })
})

describe('isCollection', () => {
  it('detects collection items', () => {
    expect(isCollection('Saw 8 film collection')).toBe(true)
    expect(isCollection('Back to the Future Trilogy')).toBe(true)
    expect(isCollection('Alien: Anthology')).toBe(true)
    expect(isCollection('The Matrix')).toBe(false)
  })
})

describe('parseCSV', () => {
  it('parses header row and data rows', () => {
    const csv = `Film Sort Name,Film Name,Genere,Sub Genere,Disk Type,Notes,
Matrix,The Matrix,Sci-Fi,Action,4K,,`
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      filmSortName: 'Matrix',
      filmName: 'The Matrix',
      genre: 'Sci-Fi',
      subGenre: 'Action',
      diskType: '4K',
      notes: ''
    })
  })
  it('handles quoted fields with commas', () => {
    const csv = `Film Sort Name,Film Name,Genere,Sub Genere,Disk Type,Notes,
"I, Tonya","I, Tonya",Drama,Comedy,Blu-Ray,,`
    const rows = parseCSV(csv)
    expect(rows[0].filmName).toBe('I, Tonya')
  })
  it('filters out rows with no film name', () => {
    const csv = `Film Sort Name,Film Name,Genere,Sub Genere,Disk Type,Notes,
,,,,,,`
    expect(parseCSV(csv)).toHaveLength(0)
  })
  it('handles Windows line endings (\\r\\n)', () => {
    const csv = "Film Sort Name,Film Name,Genere,Sub Genere,Disk Type,Notes,\r\nMatrix,The Matrix,Sci-Fi,Action,4K,,\r\n"
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].diskType).toBe('4K')
    expect(rows[0].filmName).toBe('The Matrix')
  })
})

describe('parseDvdCSV', () => {
  it('always sets diskType to DVD regardless of screen type column', () => {
    const csv = `Sorted Film Name,Film Name,Genere,Sub Genere,Screen Type,Notes,
Matrix,The Matrix,Sci-Fi,Action,Wide Sceen,,`
    const rows = parseDvdCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].diskType).toBe('DVD')
    expect(rows[0].filmName).toBe('The Matrix')
    expect(rows[0].genre).toBe('Sci-Fi')
  })
  it('filters out rows with no film name', () => {
    const csv = `Sorted Film Name,Film Name,Genere,Sub Genere,Screen Type,Notes,
,,,,,,`
    expect(parseDvdCSV(csv)).toHaveLength(0)
  })
  it('merges with movie rows via groupByTitle to combine formats', () => {
    const movieRows = [
      { filmSortName: 'Die Hard 1', filmName: 'Die Hard', genre: 'Action', subGenre: '', diskType: 'Blu-Ray', notes: '' }
    ]
    const dvdRows = [
      { filmSortName: 'Die Hard 1', filmName: 'Die Hard', genre: 'Action', subGenre: '', diskType: 'DVD', notes: '' }
    ]
    const movies = groupByTitle([...movieRows, ...dvdRows])
    expect(movies).toHaveLength(1)
    expect(movies[0].formats).toContain('Blu-ray')
    expect(movies[0].formats).toContain('DVD')
  })
})

describe('groupByTitle', () => {
  it('merges duplicate titles into one entry with multiple formats', () => {
    const rows = [
      { filmSortName: 'Die Hard 1', filmName: 'Die Hard', genre: 'Action', subGenre: 'Thriller', diskType: 'Blu-Ray', notes: '' },
      { filmSortName: 'Die Hard 1', filmName: 'Die Hard', genre: 'Action', subGenre: 'Thriller', diskType: '4K', notes: '' }
    ]
    const movies = groupByTitle(rows)
    expect(movies).toHaveLength(1)
    expect(movies[0].formats).toContain('4K')
    expect(movies[0].formats).toContain('Blu-ray')
  })
  it('captures notes from rows', () => {
    const rows = [
      { filmSortName: 'Coraline', filmName: 'Coraline', genre: 'Thriller', subGenre: 'Horror', diskType: '4K', notes: 'Steelbook' }
    ]
    const movies = groupByTitle(rows)
    expect(movies[0].notes).toContain('Steelbook')
  })
  it('marks collection items', () => {
    const rows = [
      { filmSortName: 'Saw 8', filmName: 'Saw 8 film collection', genre: 'Horror', subGenre: '', diskType: 'Blu-Ray', notes: '' }
    ]
    expect(groupByTitle(rows)[0].isCollection).toBe(true)
  })
})
