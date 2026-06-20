<template>
  <router-link :to="{ name: 'movie', params: { id: movie.id } }" class="row">
    <div class="row-poster">
      <img v-if="posterSrc" :src="posterSrc" :alt="movie.title" loading="lazy" />
      <div v-else class="row-placeholder"></div>
    </div>
    <div class="row-info">
      <span class="row-title">{{ movie.title }}</span>
      <span class="row-meta">
        <span v-if="tmdbData?.year">{{ tmdbData.year }}</span>
        <span v-if="movie.genre"> · {{ movie.genre }}</span>
      </span>
    </div>
    <div class="row-badges">
      <FormatBadge :formats="movie.formats" :notes="movie.notes" />
    </div>
    <div class="row-rating" v-if="tmdbData?.voteAverage">
      ★ {{ tmdbData.voteAverage.toFixed(1) }}
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { useTmdbStore } from '@/stores/tmdb.js'
import FormatBadge from './FormatBadge.vue'

const props = defineProps({
  movie: { type: Object, required: true }
})

const tmdb = useTmdbStore()
const tmdbData = computed(() => tmdb.getMovieData(props.movie.id))
const posterSrc = computed(() => tmdbData.value?.posterPath || null)
</script>

<style scoped>
.row {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 0; border-bottom: 1px solid var(--surface-2);
  color: inherit;
}
.row:hover { background: var(--surface-2); padding-left: 0.5rem; transition: all 0.1s; }
.row-poster { width: 36px; height: 54px; flex-shrink: 0; border-radius: 3px; overflow: hidden; background: var(--surface-2); }
.row-poster img { width: 100%; height: 100%; object-fit: cover; }
.row-placeholder { width: 100%; height: 100%; background: var(--surface-2); }
.row-info { flex: 1; min-width: 0; }
.row-title { display: block; font-size: 0.95rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-meta { display: block; font-size: 0.8rem; color: var(--text-2); margin-top: 2px; }
.row-badges { display: flex; gap: 4px; flex-shrink: 0; }
.row-rating { font-size: 0.85rem; color: var(--badge-4k); flex-shrink: 0; min-width: 48px; text-align: right; }
</style>
