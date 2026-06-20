import { defineStore } from 'pinia'
import { fetchAllMedia, titleToSlug, normalizeTitle } from '@/services/sheets.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import { collectionColor } from '@/utils/collectionColor.js'

const CACHE_KEY = 'library_collection'

export const useCollectionStore = defineStore('collection', {
  state: () => ({
    movies: [],
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
      state.movies.forEach(m => { if (m.genre) genres.add(m.genre) })
      return Array.from(genres).sort()
    },

    filteredMovies(state) {
      let result = [...state.movies]

      if (state.filters.search) {
        const q = state.filters.search.toLowerCase()
        result = result.filter(m => m.title.toLowerCase().includes(q))
      }

      if (state.filters.genre) {
        result = result.filter(m => m.genre === state.filters.genre)
      }

      if (state.filters.format) {
        if (state.filters.format === 'Steelbook') {
          result = result.filter(m => m.notes.some(n => n.toLowerCase().includes('steelbook')))
        } else {
          result = result.filter(m => m.formats.includes(state.filters.format))
        }
      }

      const dir = state.filters.sort === 'za' ? -1 : 1
      result.sort((a, b) => dir * a.sortKey.localeCompare(b.sortKey))
      return result
    },

    expandedMovies(state) {
      const tmdb = useTmdbStore()
      const result = []
      for (const movie of state.movies) {
        if (!movie.isCollection) {
          result.push(movie)
          continue
        }
        const allParts = tmdb.getCollectionParts(movie.id)
        const parts = movie.collectionPartLimit ? allParts.slice(0, movie.collectionPartLimit) : allParts
        if (!parts.length) {
          result.push(movie)
          continue
        }
        const color = collectionColor(movie.title)
        for (const part of parts) {
          result.push({
            id: `${movie.id}--${part.tmdbId}`,
            title: part.title,
            sortKey: normalizeTitle(part.title),
            formats: movie.formats,
            notes: movie.notes,
            genre: movie.genre,
            subGenre: movie.subGenre,
            isCollection: false,
            collectionId: movie.id,
            collectionName: movie.title,
            collectionColor: color,
            tmdbId: part.tmdbId,
            year: part.year
          })
        }
      }
      return result
    }
  },

  actions: {
    async loadCollection() {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        try {
          const { movies, lastSynced } = JSON.parse(cached)
          this.movies = movies
          this.lastSynced = lastSynced
          return
        } catch {}
      }
      await this.syncFromSheet()
    },

    async syncFromSheet() {
      this.loading = true
      this.error = null
      try {
        const movies = await fetchAllMedia()
        this.movies = movies
        this.lastSynced = Date.now()
        localStorage.setItem(CACHE_KEY, JSON.stringify({ movies, lastSynced: this.lastSynced }))
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
