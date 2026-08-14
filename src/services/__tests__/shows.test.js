import { describe, it, expect } from 'vitest'
import {
  parseSeasonInfo,
  stripSeason,
  showKey,
  parseTvCSV,
  groupByShow
} from '../shows.js'

describe('parseSeasonInfo', () => {
  it('reads a plain numbered season', () => {
    expect(parseSeasonInfo('Northwind Season 3')).toMatchObject({ seasons: [3], label: 'Season 3' })
  })
  it('reads a spelled-out season', () => {
    expect(parseSeasonInfo('Northwind Season Two')).toMatchObject({ seasons: [2] })
  })
  it('reads an ordinal season with and without "complete"', () => {
    expect(parseSeasonInfo('Northwind The Complete First Season')).toMatchObject({ seasons: [1] })
    expect(parseSeasonInfo('Northwind The Fourth Season')).toMatchObject({ seasons: [4] })
  })
  it('expands a season range', () => {
    expect(parseSeasonInfo('Northwind Season 1-3')).toMatchObject({
      seasons: [1, 2, 3],
      label: 'Seasons 1–3'
    })
  })
  it('recognises whole-series sets', () => {
    for (const name of ['Northwind The Complete Series', 'Northwind Entire Series', 'Northwind Full Series']) {
      expect(parseSeasonInfo(name)).toMatchObject({ seasons: null, label: 'Complete Series' })
    }
  })
  it('recognises an unnumbered final season', () => {
    expect(parseSeasonInfo('Northwind The Final Season')).toMatchObject({ label: 'Final Season' })
  })
  it('returns no season when the title has no marker', () => {
    expect(parseSeasonInfo('Northwind')).toMatchObject({ seasons: null, label: null })
  })
  it('does not treat "Season 9b" as season 9', () => {
    expect(parseSeasonInfo('Northwind Season 9b').seasons).toBeNull()
  })
  it('uses the right-most marker when a sort prefix repeats one', () => {
    // Rows sometimes carry a sort-order prefix that restates a season number
    // before the title that actually identifies the disc.
    expect(parseSeasonInfo('Northwind 9 Season 9 Offshoot Season 1'))
      .toMatchObject({ seasons: [1], label: 'Season 1' })
  })
})

describe('stripSeason', () => {
  it('removes the season portion', () => {
    expect(stripSeason('Northwind Season 3')).toBe('Northwind')
    expect(stripSeason('Northwind The Complete Series')).toBe('Northwind')
  })
  it('removes every marker, not just the first', () => {
    expect(stripSeason('Northwind 9 Season 9 Offshoot Season 1')).toBe('Northwind 9 Offshoot')
  })
  it('drops a trailing sort-order index', () => {
    expect(stripSeason('Harbor Lights 1 Season 1')).toBe('Harbor Lights')
    expect(stripSeason('Cascade 1 Season 1')).toBe('Cascade')
    expect(stripSeason('Northwind 9')).toBe('Northwind')
  })
  it('keeps numbers that are part of the title', () => {
    expect(stripSeason('Deep Field (2019) Season 1')).toBe('Deep Field (2019)')
    expect(stripSeason('24')).toBe('24')
  })
})

describe('showKey', () => {
  it('ignores articles, case and punctuation', () => {
    expect(showKey('The Harbor')).toBe(showKey('Harbor'))
    expect(showKey('Harbor Nine-Nine')).toBe('harbor nine nine')
  })
})

describe('parseTvCSV', () => {
  // The Blu-ray tab has a Notes column before Rating/Review; the DVD tab does not.
  const withNotes = [
    '"Category Name","Show Name","Genere","Sub Genere","Disk Type","Notes","Rating","Review"',
    '"Northwind Season 8","Northwind Season 8","Drama","","Blu-Ray","Steelbook","",""'
  ].join('\n')

  const withoutNotes = [
    '"Category Name","Show Name","Genere","Sub Genere","Disk Type","Rating","Review"',
    '"Northwind Season 1","Northwind Season 1","Drama","","DVD","",""'
  ].join('\n')

  it('reads the Notes column when the tab has one', () => {
    expect(parseTvCSV(withNotes, { hasNotes: true })[0]).toMatchObject({
      categoryName: 'Northwind Season 8',
      diskType: 'Blu-Ray',
      notes: 'Steelbook'
    })
  })

  it('does not mistake Rating for Notes when the tab has none', () => {
    expect(parseTvCSV(withoutNotes, { hasNotes: false })[0]).toMatchObject({
      categoryName: 'Northwind Season 1',
      diskType: 'DVD',
      notes: ''
    })
  })
})

describe('groupByShow', () => {
  const row = (categoryName, showName, diskType, genre = 'Drama') =>
    ({ categoryName, showName, genre, subGenre: '', diskType, notes: '' })

  it('collapses seasons into one show and merges formats across tabs', () => {
    const shows = groupByShow([
      row('Northwind Season 1', 'Northwind Season 1', 'DVD'),
      row('Northwind Season 2', 'Northwind Season 2', 'DVD'),
      row('Northwind Season 8', 'Northwind Season 8', 'Blu-Ray')
    ])
    expect(shows).toHaveLength(1)
    expect(shows[0]).toMatchObject({ id: 'northwind', title: 'Northwind', seasonCount: 3 })
    expect(shows[0].formats).toEqual(['DVD', 'Blu-ray'])
  })

  it('orders seasons numerically', () => {
    const shows = groupByShow([
      row('Northwind Season 3', 'Northwind Season 3', '4K'),
      row('Northwind Season 1', 'Northwind Season 1', '4K'),
      row('Northwind Season 2', 'Northwind Season 2', '4K')
    ])
    expect(shows[0].seasons.map(s => s.label)).toEqual(['Season 1', 'Season 2', 'Season 3'])
  })

  it('prefers the Show Name title when every row agrees', () => {
    const shows = groupByShow([
      row('Harbor Season 1', 'The Harbor Season 1', 'DVD'),
      row('Harbor Season 2', 'The Harbor Season 2', 'DVD')
    ])
    expect(shows[0].title).toBe('The Harbor')
  })

  it('falls back to Category Name when Show Name varies per row', () => {
    // Show Name is a marketing title and differs per release; a single
    // mis-entered row must not rename the whole series.
    const shows = groupByShow([
      row('Northwind Season 1', 'Northwind Season One', 'Blu-Ray'),
      row('Northwind Season 2', 'Northwind Season Two', 'Blu-Ray'),
      row('Northwind Season 5', 'Northwind The Reckoning', 'Blu-Ray')
    ])
    expect(shows[0].title).toBe('Northwind')
    expect(shows[0].seasonCount).toBe(3)
  })

  it('counts a season range as every season it covers', () => {
    const shows = groupByShow([
      row('Northwind Season 1-3', 'Northwind Season 1-3', '4K'),
      row('Northwind Season 4', 'Northwind Season 4', 'Blu-Ray')
    ])
    expect(shows[0].ownedSeasons).toBe(4)
  })

  it('spreads a complete-series set across every individual season', () => {
    // Owning the 4K complete series means every season is also owned on 4K.
    const shows = groupByShow([
      row('Northwind 1 Season 1', 'Northwind Season 1', 'Blu-Ray'),
      row('Northwind 2 Season 2', 'Northwind Season 2', 'Blu-Ray'),
      row('Northwind 9', 'Northwind: The Complete Series', '4K')
    ])
    expect(shows).toHaveLength(1)
    const show = shows[0]
    expect(show.hasCompleteSeries).toBe(true)
    expect(show.ownedSeasons).toBe(2)
    for (const season of show.seasons.filter(s => !s.coversAllSeasons)) {
      expect(season.formats).toEqual(expect.arrayContaining(['Blu-ray', '4K']))
    }
  })

  it('lists the complete-series set first', () => {
    const shows = groupByShow([
      row('Northwind Season 2', 'Northwind Season 2', 'DVD'),
      row('Northwind', 'Northwind The Complete Series', 'Blu-Ray'),
      row('Northwind Season 1', 'Northwind Season 1', 'DVD')
    ])
    expect(shows[0].seasons[0].coversAllSeasons).toBe(true)
  })

  it('reads the season label from Show Name when Category Name has none', () => {
    const shows = groupByShow([row('Northwind', 'Northwind Full Series', 'Blu-Ray')])
    expect(shows[0].seasons[0].label).toBe('Complete Series')
  })

  it('gives each season a stable id derived from its sheet row', () => {
    const shows = groupByShow([row('Northwind Season 1', 'Northwind Season 1', 'DVD')])
    expect(shows[0].seasons[0]).toMatchObject({
      id: 'northwind-season-1',
      categoryName: 'Northwind Season 1'
    })
  })
})
