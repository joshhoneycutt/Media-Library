<template>
  <div class="filter-bar">
    <div class="filter-bar-left">
      <select v-model="localGenre" @change="emit('update:genre', localGenre)">
        <option value="">All Genres</option>
        <option v-for="g in genres" :key="g" :value="g">{{ g }}</option>
      </select>

      <div class="format-buttons">
        <button
          v-for="fmt in ['All', '4K', 'Blu-ray', 'DVD']"
          :key="fmt"
          :class="['fmt-btn', { active: (localFormat === '' && fmt === 'All') || localFormat === fmt }]"
          @click="setFormat(fmt)"
        >{{ fmt }}</button>
      </div>

      <select v-model="localSort" @change="emit('update:sort', localSort)">
        <option value="az">A → Z</option>
        <option value="za">Z → A</option>
        <option value="runtime-asc">Runtime (short first)</option>
        <option value="runtime-desc">Runtime (long first)</option>
        <option value="oscars-wins">Oscar Wins (most first)</option>
        <option value="oscars-noms">Oscar Nominations (most first)</option>
      </select>

      <div class="format-buttons">
        <button
          v-for="r in runtimeOptions"
          :key="r.value"
          :class="['fmt-btn', { active: localRuntime === r.value }]"
          @click="setRuntime(r.value)"
        >{{ r.label }}</button>
      </div>

      <div class="format-buttons">
        <button
          v-for="o in oscarOptions"
          :key="o.value"
          :class="['fmt-btn', { active: localOscar === o.value }]"
          @click="setOscar(o.value)"
        >{{ o.label }}</button>
      </div>
    </div>

    <div class="filter-bar-right">
      <span class="count">{{ count }} titles</span>
      <div class="view-toggle">
        <button :class="{ active: viewMode === 'grid' }" @click="emit('update:viewMode', 'grid')" title="Grid view">⊞</button>
        <button :class="{ active: viewMode === 'list' }" @click="emit('update:viewMode', 'list')" title="List view">≡</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  genres: { type: Array, default: () => [] },
  count: { type: Number, default: 0 },
  viewMode: { type: String, default: 'grid' }
})

const emit = defineEmits(['update:genre', 'update:format', 'update:sort', 'update:runtime', 'update:oscar', 'update:viewMode'])

const localGenre = ref('')
const localFormat = ref('')
const localSort = ref('az')
const localRuntime = ref('')
const localOscar = ref('')

const runtimeOptions = [
  { value: '', label: 'Any length' },
  { value: 'short', label: 'Short (<90m)' },
  { value: 'medium', label: 'Medium (90–120m)' },
  { value: 'long', label: 'Long (>120m)' },
]

function setFormat(fmt) {
  localFormat.value = fmt === 'All' ? '' : fmt
  emit('update:format', localFormat.value)
}

const oscarOptions = [
  { value: '', label: 'Any awards' },
  { value: 'winner', label: 'Oscar Winner' },
  { value: 'nominated', label: 'Nominated' },
]

function setRuntime(val) {
  localRuntime.value = val
  emit('update:runtime', val)
}

function setOscar(val) {
  localOscar.value = val
  emit('update:oscar', val)
}
</script>

<style scoped>
.filter-bar {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  background: var(--surface); border-bottom: 1px solid #222;
  position: sticky; top: 56px; z-index: 50;
}
.filter-bar-left { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.filter-bar-right { display: flex; align-items: center; gap: 1rem; }

select {
  background: var(--surface-2); border: 1px solid var(--text-3);
  color: var(--text); padding: 0.4rem 0.75rem;
  border-radius: var(--radius); font-size: 0.85rem;
}
select:focus { outline: 2px solid var(--accent); }

.format-buttons { display: flex; gap: 4px; }
.fmt-btn {
  padding: 0.35rem 0.75rem; border-radius: var(--radius);
  background: var(--surface-2); border: 1px solid var(--text-3);
  color: var(--text-2); font-size: 0.8rem; transition: all 0.15s;
}
.fmt-btn:hover { color: var(--text); border-color: var(--text-2); }
.fmt-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.count { font-size: 0.85rem; color: var(--text-3); }

.view-toggle { display: flex; gap: 4px; }
.view-toggle button {
  background: var(--surface-2); border: 1px solid var(--text-3);
  color: var(--text-2); padding: 0.3rem 0.5rem;
  border-radius: var(--radius); font-size: 1rem;
}
.view-toggle button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
