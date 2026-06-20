<template>
  <router-link :to="{ name: 'movie', params: { id: movie.id } }" class="card">
    <div class="card-poster">
      <img v-if="posterSrc" :src="posterSrc" :alt="movie.title" loading="lazy" />
      <div v-else class="card-placeholder">
        <span>{{ movie.title }}</span>
      </div>
      <template v-if="movie.collectionId">
        <div class="collection-stripe" :style="{ background: movie.collectionColor }"></div>
        <div class="collection-label">
          <span>{{ shortCollectionName }}</span>
        </div>
      </template>
      <div class="card-badges">
        <FormatBadge :formats="movie.formats" :notes="movie.notes" />
      </div>
    </div>
    <div class="card-title">{{ movie.title }}</div>
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
const shortCollectionName = computed(() => {
  const name = props.movie.collectionName || ''
  return name.length > 16 ? name.slice(0, 14) + '…' : name
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
.collection-stripe {
  position: absolute; top: 0; left: 0; right: 0; height: 4px; z-index: 1;
}
.collection-label {
  position: absolute; top: calc(4px + 3px); left: 0; right: 0;
  display: flex; justify-content: center; z-index: 1;
}
.collection-label span {
  background: rgba(0,0,0,0.72);
  color: #f5f5f5; font-size: 7px;
  padding: 2px 5px; border-radius: 3px;
  font-weight: 500; letter-spacing: 0.3px;
  white-space: nowrap; max-width: 90%; overflow: hidden; text-overflow: ellipsis;
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
</style>
