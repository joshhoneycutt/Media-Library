import { defineStore } from 'pinia'
import { fetchAllShows } from '@/services/shows.js'

const CACHE_KEY = 'library_shows'
// Bump when the grouping logic in services/shows.js changes shape, so cached
// results are re-parsed instead of silently going stale.
const CACHE_VERSION = 2

export const useShowsStore = defineStore('shows', {
  state: () => ({
    shows: [],
    loading: false,
    error: null,
    lastSynced: null,
    filters: {
      genre: '',
      format: '',
      search: '',
      sort: 'az'
    }
  }),

  getters: {
    allGenres(state) {
      const genres = new Set()
      state.shows.forEach(s => { if (s.genre) genres.add(s.genre) })
      return Array.from(genres).sort()
    },

    getShow: (state) => (id) => state.shows.find(s => s.id === id) || null,

    totalSeasons(state) {
      return state.shows.reduce((n, s) => n + s.seasonCount, 0)
    }
  },

  actions: {
    async loadShows() {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        try {
          const { shows, lastSynced, version } = JSON.parse(cached)
          if (version === CACHE_VERSION && Array.isArray(shows)) {
            this.shows = shows
            this.lastSynced = lastSynced
            return
          }
        } catch {}
      }
      await this.syncFromSheet()
    },

    async syncFromSheet() {
      this.loading = true
      this.error = null
      try {
        const shows = await fetchAllShows()
        this.shows = shows
        this.lastSynced = Date.now()
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          shows,
          lastSynced: this.lastSynced,
          version: CACHE_VERSION
        }))
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },

    setFilter(key, value) {
      this.filters[key] = value
    }
  }
})
