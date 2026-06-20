<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Fix TMDB Match</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <input
        v-model="query"
        class="search-input"
        placeholder="Search TMDB..."
        @input="onInput"
      />

      <div v-if="searching" class="state-msg">Searching…</div>
      <div v-else-if="searchError" class="state-msg error">{{ searchError }}</div>
      <div v-else-if="searched && results.length === 0" class="state-msg">No results.</div>

      <ul v-else-if="results.length" class="results">
        <li v-for="r in results" :key="r.id" class="result-item" @click="pick(r)">
          <img
            v-if="r.poster_path"
            :src="`https://image.tmdb.org/t/p/w92${r.poster_path}`"
            class="result-poster"
            :alt="r.title"
          />
          <div v-else class="result-poster result-poster-empty"></div>
          <div class="result-info">
            <div class="result-title">{{ r.title }}</div>
            <div class="result-meta">{{ r.release_date?.slice(0, 4) }} · ID: {{ r.id }}</div>
          </div>
        </li>
      </ul>

      <div v-if="applying" class="state-msg">Applying…</div>
      <div v-if="applyError" class="state-msg error">{{ applyError }}</div>

      <div v-if="tmdb.hasOverrides" class="modal-footer">
        <button class="export-btn" @click="tmdb.exportOverrides()">Export overrides.json</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'
import { useTmdbStore } from '@/stores/tmdb.js'
import { searchMovies } from '@/services/tmdb.js'

const props = defineProps({
  movie: { type: Object, required: true }
})
const emit = defineEmits(['close'])

const tmdb = useTmdbStore()
const query = ref(props.movie.title)
const results = ref([])
const searching = ref(false)
const searched = ref(false)
const searchError = ref('')
const applying = ref(false)
const applyError = ref('')
let debounceTimer = null

onUnmounted(() => clearTimeout(debounceTimer))

async function doSearch() {
  if (!query.value.trim() || !tmdb.apiKey) { results.value = []; searched.value = false; return }
  searching.value = true
  searchError.value = ''
  try {
    results.value = await searchMovies(query.value.trim(), tmdb.apiKey)
    searched.value = true
  } catch (e) {
    searchError.value = e.message
    results.value = []
  } finally {
    searching.value = false
  }
}

function onInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doSearch, 300)
}

async function pick(result) {
  applying.value = true
  applyError.value = ''
  try {
    await tmdb.applyOverride(props.movie.id, result.id)
    emit('close')
  } catch (e) {
    applyError.value = `Failed to apply: ${e.message}`
  } finally {
    applying.value = false
  }
}

doSearch()
</script>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.7);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.modal {
  background: var(--surface); border-radius: var(--radius);
  width: 100%; max-width: 500px; max-height: 80vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
}
.modal-header h2 {
  font-size: 1rem; font-weight: 600; color: var(--text);
}
.close-btn {
  background: none; border: none; color: var(--text-2);
  font-size: 1.4rem; line-height: 1; padding: 0 0.25rem;
}
.close-btn:hover { color: var(--text); }
.search-input {
  margin: 0 1.25rem 0.75rem;
  background: var(--surface-2); border: 1px solid var(--text-3);
  border-radius: var(--radius); color: var(--text);
  padding: 0.5rem 0.75rem; font-size: 0.9rem;
}
.search-input:focus { outline: none; border-color: var(--accent); }
.state-msg {
  padding: 1rem 1.25rem; color: var(--text-2); font-size: 0.875rem;
}
.state-msg.error { color: #e05555; }
.results {
  list-style: none; padding: 0; margin: 0;
  overflow-y: auto; flex: 1;
}
.result-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 1.25rem; cursor: pointer;
}
.result-item:hover { background: var(--surface-2); }
.result-poster {
  width: 40px; height: 60px; flex-shrink: 0;
  border-radius: 3px; object-fit: cover;
}
.result-poster-empty {
  background: var(--surface-2); border: 1px solid var(--text-3);
}
.result-title { font-size: 0.9rem; color: var(--text); }
.result-meta { font-size: 0.75rem; color: var(--text-3); margin-top: 2px; }
.modal-footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--surface-2);
}
.export-btn {
  background: none; border: 1px solid var(--text-3);
  color: var(--text-2); border-radius: var(--radius);
  padding: 0.4rem 0.75rem; font-size: 0.8rem;
}
.export-btn:hover { border-color: var(--text-2); color: var(--text); }
</style>
