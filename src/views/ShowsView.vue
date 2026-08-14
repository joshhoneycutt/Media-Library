<template>
  <div class="collection">
    <div class="search-bar">
      <input
        v-model="searchQuery"
        @input="shows.setFilter('search', searchQuery)"
        @search="shows.setFilter('search', searchQuery)"
        type="search"
        placeholder="Search your shows..."
        class="search-input"
      />
    </div>

    <div class="filters">
      <div class="filter-group">
        <select :value="shows.filters.genre" @change="shows.setFilter('genre', $event.target.value)">
          <option value="">All genres</option>
          <option v-for="g in shows.allGenres" :key="g" :value="g">{{ g }}</option>
        </select>
        <div class="format-btns">
          <button
            v-for="f in formats"
            :key="f"
            :class="{ active: (f === 'All' ? '' : f) === shows.filters.format }"
            @click="shows.setFilter('format', f === 'All' ? '' : f)"
          >{{ f }}</button>
        </div>
        <select :value="shows.filters.sort" @change="shows.setFilter('sort', $event.target.value)">
          <option value="az">A → Z</option>
          <option value="za">Z → A</option>
          <option value="seasons-desc">Most seasons</option>
          <option value="seasons-asc">Fewest seasons</option>
        </select>
      </div>
      <span class="count">{{ displayShows.length }} shows · {{ seasonTotal }} seasons</span>
    </div>

    <div v-if="shows.loading" class="state-msg">Loading shows...</div>
    <div v-else-if="shows.error" class="state-msg error">{{ shows.error }}</div>
    <div v-else-if="displayShows.length === 0" class="state-msg">No shows match your filters.</div>

    <div v-else class="grid">
      <ShowCard v-for="show in displayShows" :key="show.id" :show="show" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useShowsStore } from '@/stores/shows.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import ShowCard from '@/components/ShowCard.vue'

const shows = useShowsStore()
const tmdb = useTmdbStore()
const searchQuery = ref('')
const formats = ['All', '4K', 'Blu-ray', 'DVD']

// Enrich in the background once the list lands.
watch(() => shows.shows, (list) => {
  if (list.length && tmdb.hasApiKey) tmdb.enrichAllShows(list)
}, { immediate: true })

const displayShows = computed(() => {
  const filters = shows.filters
  let list = shows.shows

  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter(s => {
      if (s.title.toLowerCase().includes(q)) return true
      if (s.genre?.toLowerCase().includes(q)) return true
      if (s.subGenre?.toLowerCase().includes(q)) return true
      if (s.seasons.some(se => se.title.toLowerCase().includes(q))) return true
      const td = tmdb.tvCache[s.id]
      if (!td) return false
      if (td.overview?.toLowerCase().includes(q)) return true
      if (td.cast?.some(c => c.toLowerCase().includes(q))) return true
      if (td.genres?.some(g => g.toLowerCase().includes(q))) return true
      if (td.networks?.some(n => n.toLowerCase().includes(q))) return true
      if (td.createdBy?.some(c => c.toLowerCase().includes(q))) return true
      return false
    })
  }

  if (filters.genre) list = list.filter(s => s.genre === filters.genre)
  if (filters.format) list = list.filter(s => s.formats.includes(filters.format))

  const sort = filters.sort
  if (sort === 'seasons-desc' || sort === 'seasons-asc') {
    const dir = sort === 'seasons-desc' ? -1 : 1
    list = [...list].sort((a, b) => dir * (a.seasonCount - b.seasonCount) || a.sortKey.localeCompare(b.sortKey))
  } else {
    const dir = sort === 'za' ? -1 : 1
    list = [...list].sort((a, b) => dir * a.sortKey.localeCompare(b.sortKey))
  }

  return list
})

const seasonTotal = computed(() => displayShows.value.reduce((n, s) => n + s.seasonCount, 0))
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

.filters {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; flex-wrap: wrap; padding: 0 1.5rem 0.5rem;
}
.filter-group { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.filters select {
  background: var(--surface-2); border: 1px solid var(--text-3);
  color: var(--text); border-radius: var(--radius);
  padding: 0.4rem 0.6rem; font-size: 0.85rem;
}
.format-btns { display: flex; gap: 0.25rem; }
.format-btns button {
  background: var(--surface-2); border: 1px solid var(--text-3);
  color: var(--text-2); border-radius: var(--radius);
  padding: 0.35rem 0.75rem; font-size: 0.8rem;
}
.format-btns button.active { border-color: var(--accent); color: var(--text); }
.count { font-size: 0.8rem; color: var(--text-3); }

.state-msg { padding: 3rem; text-align: center; color: var(--text-2); }
.state-msg.error { color: var(--accent); }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
}

@media (max-width: 600px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
