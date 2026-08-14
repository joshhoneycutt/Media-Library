<template>
  <router-link :to="{ name: 'show', params: { id: show.id } }" class="card">
    <div class="card-poster">
      <img v-if="posterSrc" :src="posterSrc" :alt="show.title" loading="lazy" />
      <div v-else class="card-placeholder">
        <span>{{ show.title }}</span>
      </div>
      <div class="card-badges">
        <FormatBadge :formats="show.formats" :notes="show.notes" />
      </div>
    </div>
    <div class="card-title">{{ show.title }}</div>
    <div class="card-sub">{{ seasonLabel }}</div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { useTmdbStore } from '@/stores/tmdb.js'
import FormatBadge from './FormatBadge.vue'

const props = defineProps({
  show: { type: Object, required: true }
})

const tmdb = useTmdbStore()
const posterSrc = computed(() => tmdb.getShowData(props.show.id)?.posterPath || null)

const seasonLabel = computed(() => {
  const { hasCompleteSeries, ownedSeasons, seasons, title } = props.show
  if (hasCompleteSeries) return 'Complete Series'
  if (ownedSeasons > 1) return `${ownedSeasons} seasons`
  if (seasons.length === 1) {
    // A row with no season marker falls back to its own title — no point
    // repeating the show name underneath itself.
    const label = seasons[0].label
    if (label && !label.toLowerCase().startsWith(title.toLowerCase())) return label
    return '1 season'
  }
  return `${seasons.length} seasons`
})
</script>

<style scoped>
.card { display: block; color: inherit; min-width: 0; }
.card:hover .card-poster { transform: scale(1.03); }
.card-poster {
  position: relative; aspect-ratio: 2/3;
  border-radius: var(--radius); overflow: hidden;
  background: var(--surface-2);
  transition: transform 0.2s ease;
}
.card-poster img { width: 100%; height: 100%; object-fit: cover; }
.card-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  padding: 0.75rem; text-align: center;
  font-size: 0.8rem; color: var(--text-2); line-height: 1.3;
}
.card-badges {
  position: absolute; bottom: 6px; right: 6px;
  display: flex; flex-direction: column; align-items: flex-end; gap: 3px;
}
.card-title {
  margin-top: 0.4rem; font-size: 0.8rem;
  color: var(--text-2); line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.card-sub {
  font-size: 0.7rem; color: var(--text-3); margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
</style>
