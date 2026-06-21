<template>
  <div class="collection">
    <div class="search-bar">
      <input
        v-model="searchQuery"
        @input="collection.setFilter('search', searchQuery)"
        @search="collection.setFilter('search', searchQuery)"
        type="search"
        placeholder="Search your collection..."
        class="search-input"
      />
    </div>

    <FilterBar
      :genres="collection.allGenres"
      :count="displayMovies.length"
      :viewMode="viewMode"
      @update:genre="collection.setFilter('genre', $event)"
      @update:format="collection.setFilter('format', $event)"
      @update:sort="collection.setFilter('sort', $event)"
      @update:runtime="runtimeFilter = $event"
      @update:oscar="oscarFilter = $event"
      @update:viewMode="viewMode = $event"
    />

    <div v-if="collection.loading" class="state-msg">Loading collection...</div>
    <div v-else-if="collection.error" class="state-msg error">{{ collection.error }}</div>
    <div v-else-if="displayMovies.length === 0" class="state-msg">No movies match your filters.</div>

    <div v-else-if="viewMode === 'grid'" class="grid">
      <MovieCard
        v-for="movie in displayMovies"
        :key="movie.id"
        :movie="movie"
      />
    </div>

    <div v-else class="list">
      <MovieRow
        v-for="movie in displayMovies"
        :key="movie.id"
        :movie="movie"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useCollectionStore } from '@/stores/collection.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import FilterBar from '@/components/FilterBar.vue'
import MovieCard from '@/components/MovieCard.vue'
import MovieRow from '@/components/MovieRow.vue'

const collection = useCollectionStore()
const tmdb = useTmdbStore()
const viewMode = ref('grid')
const searchQuery = ref('')
const runtimeFilter = ref('')
const oscarFilter = ref('')

watch(() => collection.movies, (movies) => {
  for (const movie of movies) {
    if (movie.isCollection) tmdb.fetchCollection(movie)
  }
}, { immediate: true })

function effectiveSortKey(movie) {
  if (movie.collectionId) {
    return movie.collectionName.toLowerCase().trim().replace(/^(the |a |an )/, '').trim()
  }
  return movie.sortKey
}

const displayMovies = computed(() => {
  const filters = collection.filters
  let movies = collection.expandedMovies

  if (filters.search) {
    const q = filters.search.toLowerCase()
    movies = movies.filter(m => {
      if (m.title.toLowerCase().includes(q)) return true
      const td = tmdb.cache[m.id]
      if (!td) return false
      if (td.director?.toLowerCase().includes(q)) return true
      if (td.cast?.some(c => c.toLowerCase().includes(q))) return true
      if (td.overview?.toLowerCase().includes(q)) return true
      if (td.languages?.some(l => l.toLowerCase().includes(q))) return true
      if (td.productionCompanies?.some(c => c.toLowerCase().includes(q))) return true
      if (td.productionCountries?.some(c => c.toLowerCase().includes(q))) return true
      if (td.genres?.some(g => g.toLowerCase().includes(q))) return true
      if (td.writers?.some(w => w.toLowerCase().includes(q))) return true
      return false
    })
  }

  if (filters.genre) {
    movies = movies.filter(m => m.genre === filters.genre)
  }

  if (filters.format) {
    if (filters.format === 'Steelbook') {
      movies = movies.filter(m => m.notes.some(n => n.toLowerCase().includes('steelbook')))
    } else {
      movies = movies.filter(m => m.formats.includes(filters.format))
    }
  }

  if (runtimeFilter.value) {
    movies = movies.filter(m => {
      const rt = tmdb.cache[m.id]?.runtime
      if (!rt) return false
      if (runtimeFilter.value === 'short')  return rt < 90
      if (runtimeFilter.value === 'medium') return rt >= 90 && rt <= 120
      if (runtimeFilter.value === 'long')   return rt > 120
      return true
    })
  }

  if (oscarFilter.value) {
    movies = movies.filter(m => {
      const o = tmdb.awardsCache[m.id]
      if (!o) return false
      if (oscarFilter.value === 'winner')    return o.wins > 0
      if (oscarFilter.value === 'nominated') return o.nominations > 0
      return true
    })
  }

  const sort = filters.sort
  if (sort === 'az' || sort === 'za') {
    const dir = sort === 'za' ? -1 : 1
    movies = [...movies].sort((a, b) => {
      const primary = dir * effectiveSortKey(a).localeCompare(effectiveSortKey(b))
      if (primary !== 0) return primary
      return (a.year || 0) - (b.year || 0)
    })
  } else if (sort === 'runtime-asc' || sort === 'runtime-desc') {
    const dir = sort === 'runtime-asc' ? 1 : -1
    movies = [...movies].sort((a, b) => {
      const ra = tmdb.cache[a.id]?.runtime
      const rb = tmdb.cache[b.id]?.runtime
      if (ra == null && rb == null) return 0
      if (ra == null) return 1
      if (rb == null) return -1
      return dir * (ra - rb)
    })
  } else if (sort === 'oscars-wins' || sort === 'oscars-noms') {
    const field = sort === 'oscars-wins' ? 'wins' : 'nominations'
    movies = [...movies].sort((a, b) => {
      const oa = tmdb.awardsCache[a.id]?.[field] ?? -1
      const ob = tmdb.awardsCache[b.id]?.[field] ?? -1
      return ob - oa
    })
  }

  return movies
})
</script>

<style scoped>
.collection { padding-bottom: 3rem; }

.search-bar { padding: 1rem 1.5rem; }
.search-input {
  width: 100%; max-width: 480px;
  padding: 0.65rem 1rem;
  background: var(--surface); border: 1px solid var(--text-3);
  border-radius: var(--radius); color: var(--text); font-size: 0.95rem;
}
.search-input:focus { outline: 2px solid var(--accent); border-color: transparent; }

.state-msg { padding: 3rem; text-align: center; color: var(--text-2); }
.state-msg.error { color: var(--accent); }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
}

.list { padding: 0 1.5rem; }

@media (max-width: 600px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
