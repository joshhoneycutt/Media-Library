import { createRouter, createWebHashHistory } from 'vue-router'
import CollectionView from '@/views/CollectionView.vue'
import MovieDetailView from '@/views/MovieDetailView.vue'
import SetupView from '@/views/SetupView.vue'

const routes = [
  { path: '/', name: 'collection', component: CollectionView },
  { path: '/movie/:id', name: 'movie', component: MovieDetailView },
  { path: '/setup', name: 'setup', component: SetupView }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const hasKey = !!localStorage.getItem('library_tmdb_key')
  if (!hasKey && to.name !== 'setup') return { name: 'setup' }
})

export default router
