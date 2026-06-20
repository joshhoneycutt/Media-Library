<template>
  <div id="app">
    <nav class="nav">
      <router-link to="/" class="nav-logo">THE LIBRARY</router-link>
      <div class="nav-tabs">
        <router-link to="/" class="nav-tab active-tab">Movies</router-link>
        <span class="nav-tab disabled">Games</span>
        <span class="nav-tab disabled">More</span>
      </div>
      <div class="nav-actions">
        <button class="icon-btn" title="Sync collection" @click="sync" :class="{ spinning: collection.loading }">⟳</button>
        <button class="icon-btn" title="Settings" @click="showSettings = !showSettings">⚙</button>
      </div>
    </nav>

    <router-view />

    <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
      <aside class="settings-panel">
        <h2>Settings</h2>

        <section>
          <h3>TMDB API Key</h3>
          <input v-model="newKey" type="text" placeholder="Paste new key to update" />
          <button @click="updateKey">Update Key</button>
        </section>

        <section>
          <h3>Collection</h3>
          <p>Last synced: {{ lastSyncedLabel }}</p>
          <button @click="sync">Sync from Google Sheets</button>
        </section>

        <section>
          <h3>Enrich with TMDB</h3>
          <p>{{ unenrichedCount }} movies not yet enriched.</p>
          <div v-if="tmdb.enriching">
            <progress :value="tmdb.enrichProgress.current" :max="tmdb.enrichProgress.total"></progress>
            <span>{{ tmdb.enrichProgress.current }} / {{ tmdb.enrichProgress.total }}</span>
            <button @click="tmdb.cancelEnrich()">Cancel</button>
          </div>
          <button v-else @click="enrichAll" :disabled="unenrichedCount === 0">Enrich Collection</button>
        </section>

        <section>
          <h3>Cache</h3>
          <button class="danger" @click="clearTmdbCache">Clear TMDB Cache</button>
          <button class="danger" style="margin-top:0.5rem" @click="clearCollections">Clear Collections Cache</button>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCollectionStore } from '@/stores/collection.js'
import { useTmdbStore } from '@/stores/tmdb.js'

const collection = useCollectionStore()
const tmdb = useTmdbStore()
const showSettings = ref(false)
const newKey = ref('')

onMounted(async () => {
  await tmdb.init()
  await collection.loadCollection()
})

const lastSyncedLabel = computed(() => {
  if (!collection.lastSynced) return 'Never'
  return new Date(collection.lastSynced).toLocaleString()
})

const unenrichedCount = computed(() =>
  collection.movies.filter(m => !tmdb.cache[m.id] && !m.isCollection).length
)

async function sync() {
  await collection.syncFromSheet()
  await tmdb.enrichAll(collection.movies)
}
function updateKey() { if (newKey.value.trim()) { tmdb.setApiKey(newKey.value); newKey.value = '' } }
function clearTmdbCache() { if (confirm('Clear all cached TMDB data?')) tmdb.clearCache() }
function clearCollections() { tmdb.clearCollections(); window.location.reload() }
function enrichAll() { tmdb.enrichAll(collection.movies) }
</script>

<style scoped>
.nav {
  display: flex; align-items: center; gap: 1rem;
  padding: 0 1.5rem; height: 56px;
  background: #111; border-bottom: 1px solid #222;
  position: sticky; top: 0; z-index: 100;
}
.nav-logo {
  font-size: 1.1rem; font-weight: 800;
  letter-spacing: 2px; color: var(--accent);
  flex-shrink: 0;
}
.nav-tabs { display: flex; gap: 0.25rem; flex: 1; justify-content: center; }
.nav-tab {
  padding: 0.4rem 1rem; border-radius: var(--radius);
  font-size: 0.9rem; color: var(--text-2); transition: color 0.15s;
}
.nav-tab:hover:not(.disabled) { color: var(--text); }
.active-tab { color: var(--text); font-weight: 600; }
.nav-tab.disabled { opacity: 0.35; cursor: not-allowed; }
.nav-actions { display: flex; gap: 0.5rem; }
.icon-btn {
  background: none; border: none; color: var(--text-2);
  font-size: 1.2rem; padding: 0.3rem 0.5rem;
  border-radius: var(--radius); transition: color 0.15s;
}
.icon-btn:hover { color: var(--text); }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.settings-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 200; display: flex; justify-content: flex-end;
}
.settings-panel {
  background: var(--surface); width: 340px; max-width: 100%;
  padding: 1.5rem; overflow-y: auto;
}
.settings-panel h2 { font-size: 1.2rem; margin-bottom: 1.5rem; }
.settings-panel section { margin-bottom: 2rem; }
.settings-panel h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-2); margin-bottom: 0.75rem; }
.settings-panel p { font-size: 0.9rem; color: var(--text-2); margin-bottom: 0.75rem; }
.settings-panel input {
  width: 100%; padding: 0.6rem 0.75rem;
  background: var(--surface-2); border: 1px solid var(--text-3);
  border-radius: var(--radius); color: var(--text);
  margin-bottom: 0.5rem;
}
.settings-panel button {
  background: var(--accent); color: #fff; border: none;
  padding: 0.5rem 1rem; border-radius: var(--radius);
  font-size: 0.9rem; font-weight: 600;
}
.settings-panel button:hover:not(:disabled) { background: var(--accent-hover); }
.settings-panel button:disabled { opacity: 0.4; cursor: not-allowed; }
.settings-panel button.danger { background: #333; }
.settings-panel button.danger:hover { background: #444; }
.settings-panel progress { width: 100%; margin-bottom: 0.5rem; }
.settings-panel span { font-size: 0.85rem; color: var(--text-2); margin-right: 1rem; }
</style>
