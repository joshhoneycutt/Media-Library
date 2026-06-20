<template>
  <div class="rail" v-if="siblings.length >= 2">
    <div
      v-for="sibling in siblings"
      :key="sibling.id"
      class="rail-item"
      :class="{ current: sibling.id === currentId }"
      @click="sibling.id !== currentId && $router.push(`/movie/${sibling.id}`)"
    >
      <div class="rail-poster">
        <img v-if="posterPath(sibling)" :src="posterPath(sibling)" :alt="sibling.title" />
        <div v-else class="rail-poster-placeholder">{{ sibling.title }}</div>
      </div>
      <div class="rail-title">{{ sibling.title }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCollectionStore } from '@/stores/collection.js'
import { useTmdbStore } from '@/stores/tmdb.js'

const props = defineProps({
  collectionId: {
    type: String,
    required: true
  },
  currentId: {
    type: String,
    required: true
  }
})

const collection = useCollectionStore()
const tmdb = useTmdbStore()

const siblings = computed(() =>
  collection.expandedMovies.filter(m => m.collectionId === props.collectionId)
)

function posterPath(sibling) {
  return tmdb.getMovieData(sibling.id)?.posterPath ?? null
}
</script>

<style scoped>
.rail {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.rail-item {
  flex-shrink: 0;
  width: 80px;
  cursor: pointer;
}

.rail-item.current {
  cursor: default;
}

.rail-poster {
  width: 80px;
  aspect-ratio: 2/3;
  border-radius: var(--radius, 6px);
  overflow: hidden;
  background: var(--surface-2);
}

.rail-item.current .rail-poster {
  opacity: 0.5;
  outline: 2px solid var(--accent);
}

.rail-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rail-poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: var(--text-3);
  text-align: center;
  padding: 4px;
}

.rail-title {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 80px;
}
</style>
