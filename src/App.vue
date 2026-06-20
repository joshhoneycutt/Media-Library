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

    <div v-if="theme === 'blockbuster'" class="popcorn-bg" aria-hidden="true"></div>

    <router-view />

    <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
      <aside class="settings-panel">
        <h2>Settings</h2>

        <section>
          <h3>Theme</h3>
          <div class="theme-options">
            <button
              v-for="t in themes"
              :key="t.id"
              class="theme-btn"
              :class="{ active: theme === t.id }"
              :data-theme-preview="t.id"
              @click="setTheme(t.id)"
            >{{ t.label }}</button>
          </div>
        </section>

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

const themes = [
  { id: 'red', label: 'Red' },
  { id: 'blockbuster', label: 'Blockbuster' },
]
const theme = ref(localStorage.getItem('theme') || 'red')
function setTheme(id) {
  theme.value = id
  localStorage.setItem('theme', id)
  document.documentElement.setAttribute('data-theme', id)
}

onMounted(async () => {
  document.documentElement.setAttribute('data-theme', theme.value)
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
  background: var(--nav-bg); border-bottom: 1px solid var(--nav-border);
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

.popcorn-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Ctext x='10' y='60' font-size='36' opacity='0.07' transform='rotate(-10 10 60)'%3E%F0%9F%8D%BF%3C/text%3E%3Ctext x='130' y='40' font-size='28' opacity='0.05' transform='rotate(15 130 40)'%3E%F0%9F%8D%BF%3C/text%3E%3Ctext x='70' y='150' font-size='32' opacity='0.06' transform='rotate(5 70 150)'%3E%F0%9F%8D%BF%3C/text%3E%3Ctext x='170' y='170' font-size='24' opacity='0.07' transform='rotate(-20 170 170)'%3E%F0%9F%8D%BF%3C/text%3E%3Ctext x='30' y='220' font-size='20' opacity='0.05' transform='rotate(12 30 220)'%3E%F0%9F%8D%BF%3C/text%3E%3Ctext x='180' y='110' font-size='30' opacity='0.04' transform='rotate(-5 180 110)'%3E%F0%9F%8D%BF%3C/text%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 240px 240px;
}

.theme-options { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.theme-btn {
  padding: 0.4rem 1rem; border-radius: var(--radius);
  font-size: 0.85rem; font-weight: 600; border: 2px solid var(--text-3);
  background: var(--surface-2) !important; color: var(--text-2) !important;
  transition: border-color 0.15s, color 0.15s;
}
.theme-btn:hover { border-color: var(--text-2); color: var(--text) !important; }
.theme-btn.active { border-color: var(--accent); color: var(--text) !important; }
</style>
