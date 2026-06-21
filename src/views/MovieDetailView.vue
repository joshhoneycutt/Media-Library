<template>
  <div class="detail" v-if="movie">
    <div class="hero" :style="heroStyle">
      <div class="hero-gradient"></div>
      <div class="hero-content">
        <img v-if="tmdbData?.posterPath" :src="tmdbData.posterPath" class="hero-poster" :alt="movie.title" />
        <div v-else class="hero-poster hero-poster-placeholder">{{ movie.title }}</div>
        <div class="hero-meta">
          <h1>{{ movie.title }}</h1>
          <div class="hero-stats">
            <span v-if="tmdbData?.year">{{ tmdbData.year }}</span>
            <span v-if="tmdbData?.runtime"> · {{ formatRuntime(tmdbData.runtime) }}</span>
            <span v-if="tmdbData?.voteAverage" class="rating"> · ★ {{ tmdbData.voteAverage.toFixed(1) }}</span>
          </div>
          <div class="hero-genres">
            <span v-if="movie.genre" class="genre-tag">{{ movie.genre }}</span>
            <span v-if="movie.subGenre" class="genre-tag">{{ movie.subGenre }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="body">
      <button class="back-btn" @click="$router.back()">← Back</button>

      <div class="sections">
        <section v-if="tmdbData?.overview">
          <h2>Overview</h2>
          <p>{{ tmdbData.overview }}</p>
        </section>

        <section v-if="oscarData">
          <h2>Academy Awards</h2>
          <div class="oscar-row">
            <span class="oscar-summary" :class="{ winner: oscarData.wins > 0 }">{{ oscarLabel }}</span>
            <button
              v-if="oscarData.wonCategories?.length || oscarData.nomCategories?.length"
              class="expand-btn"
              @click="awardsExpanded = !awardsExpanded"
              :title="awardsExpanded ? 'Collapse' : 'See categories'"
            >{{ awardsExpanded ? '−' : '+' }}</button>
          </div>
          <div v-if="awardsExpanded" class="awards-detail">
            <div v-if="oscarData.wonCategories?.length" class="awards-group">
              <span class="awards-group-label">Won</span>
              <span class="awards-categories">{{ oscarData.wonCategories.join(' · ') }}</span>
            </div>
            <div v-if="oscarData.nomCategories?.length" class="awards-group">
              <span class="awards-group-label">Nominated</span>
              <span class="awards-categories">{{ oscarData.nomCategories.join(' · ') }}</span>
            </div>
          </div>
        </section>

        <section v-if="tmdbData" class="details-grid">
          <h2>Details</h2>
          <div v-if="tmdbData.tagline" class="copy-row tagline-row">
            <span class="tagline-text">{{ tmdbData.tagline }}</span>
          </div>
          <div v-if="tmdbData.originalTitle" class="copy-row">
            <span class="copy-label">Original Title</span>
            <span>{{ tmdbData.originalTitle }}</span>
          </div>
          <div v-if="tmdbData.genres?.length" class="copy-row">
            <span class="copy-label">Genres</span>
            <span>{{ tmdbData.genres.join(', ') }}</span>
          </div>
          <div v-if="tmdbData.runtime" class="copy-row">
            <span class="copy-label">Runtime</span>
            <span>{{ formatRuntime(tmdbData.runtime) }}</span>
          </div>
          <div v-if="tmdbData.voteAverage" class="copy-row">
            <span class="copy-label">TMDB Rating</span>
            <span>★ {{ tmdbData.voteAverage.toFixed(1) }}{{ tmdbData.voteCount ? ` (${tmdbData.voteCount.toLocaleString()} votes)` : '' }}</span>
          </div>
          <div v-if="tmdbData.director" class="copy-row">
            <span class="copy-label">Director</span>
            <span>{{ tmdbData.director }}</span>
          </div>
          <div v-if="tmdbData.writers?.length" class="copy-row">
            <span class="copy-label">Writers</span>
            <span>{{ tmdbData.writers.join(', ') }}</span>
          </div>
          <div v-if="tmdbData.producers?.length" class="copy-row">
            <span class="copy-label">Producers</span>
            <span>{{ tmdbData.producers.join(', ') }}</span>
          </div>
          <div v-if="tmdbData.cast?.length" class="copy-row">
            <span class="copy-label">Cast</span>
            <span>{{ tmdbData.cast.join(', ') }}</span>
          </div>
          <div v-if="tmdbData.languages?.length" class="copy-row">
            <span class="copy-label">Language</span>
            <span>{{ tmdbData.languages.join(', ') }}</span>
          </div>
          <div v-if="tmdbData.productionCountries?.length" class="copy-row">
            <span class="copy-label">Countries</span>
            <span>{{ tmdbData.productionCountries.join(', ') }}</span>
          </div>
          <div v-if="tmdbData.productionCompanies?.length" class="copy-row">
            <span class="copy-label">Studios</span>
            <span>{{ tmdbData.productionCompanies.join(', ') }}</span>
          </div>
          <div v-if="tmdbData.budget" class="copy-row">
            <span class="copy-label">Budget</span>
            <span>{{ formatMoney(tmdbData.budget) }}</span>
          </div>
          <div v-if="tmdbData.revenue" class="copy-row">
            <span class="copy-label">Box Office</span>
            <span>{{ formatMoney(tmdbData.revenue) }}</span>
          </div>
          <div v-if="tmdbData.imdbId" class="copy-row">
            <span class="copy-label">IMDb</span>
            <a :href="`https://www.imdb.com/title/${tmdbData.imdbId}`" target="_blank" rel="noopener" class="imdb-link">{{ tmdbData.imdbId }}</a>
          </div>
        </section>

        <section v-if="collectionSiblings.length >= 2" class="in-collection-section">
          <h2>In this Collection</h2>
          <CollectionRail :collectionId="movie.collectionId" :currentId="movie.id" />
        </section>

        <section class="your-review">
          <h2>Your Review</h2>
          <div class="review-rating-row">
            <StarRating v-model="localRating" :showValue="true" />
            <span v-if="localRating === 0" class="no-rating">No rating</span>
          </div>
          <textarea
            v-model="localReview"
            class="review-textarea"
            placeholder="Write your thoughts…"
            rows="4"
          ></textarea>
          <div class="review-actions">
            <button class="save-btn" @click="saveReview" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save to Sheet' }}
            </button>
            <span v-if="saveStatus === 'saved'" class="save-status ok">Saved ✓</span>
            <span v-if="saveStatus === 'error'" class="save-status err">{{ saveError }}</span>
          </div>
        </section>

        <section class="your-copy">
          <h2>Your Copy</h2>
          <div class="copy-row">
            <span class="copy-label">Format</span>
            <span><FormatBadge :formats="movie.formats" :notes="[]" /></span>
          </div>
          <div v-if="movie.notes.length" class="copy-row">
            <span class="copy-label">Edition</span>
            <span><FormatBadge :formats="[]" :notes="movie.notes" /></span>
          </div>
          <div v-if="movie.isCollection" class="copy-row">
            <span class="copy-label">Type</span>
            <span class="collection-tag">Collection / Box Set</span>
          </div>
        </section>

        <section v-if="!tmdbData && !enriching">
          <div class="not-found" v-if="tmdb.hasApiKey">
            <span>TMDB data not loaded.</span>
            <div class="not-found-actions">
              <button @click="enrich">Fetch from TMDB</button>
              <button @click="showOverrideModal = true">Search manually</button>
            </div>
          </div>
          <p class="not-found" v-else>
            No TMDB data. Add a TMDB API key in Settings to load it.
          </p>
        </section>
        <section v-if="enriching">
          <p class="not-found">Fetching from TMDB...</p>
        </section>
        <div v-if="tmdb.hasApiKey" class="fix-match-row">
          <button class="fix-match-btn" @click="showOverrideModal = true">{{ tmdbData ? 'Fix TMDB match' : 'Search TMDB manually' }}</button>
          <button v-if="sourceCollection" class="fix-match-btn" @click="showCollectionModal = true">Fix collection match</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="state-msg">Movie not found.</div>
  <OverrideModal
    v-if="showOverrideModal && movie"
    :movie="movie"
    @close="showOverrideModal = false"
  />

  <!-- Collection picker modal -->
  <div v-if="showCollectionModal" class="overlay" @click.self="showCollectionModal = false">
    <div class="modal">
      <div class="modal-header">
        <h2>Fix Collection Match</h2>
        <button class="close-btn" @click="showCollectionModal = false">×</button>
      </div>
      <input
        v-model="collectionQuery"
        class="search-input"
        placeholder="Search TMDB collections…"
        @input="onCollectionInput"
      />
      <div v-if="collectionSearching" class="state-msg-modal">Searching…</div>
      <div v-else-if="collectionError" class="state-msg-modal error">{{ collectionError }}</div>
      <div v-else-if="collectionSearched && collectionResults.length === 0" class="state-msg-modal">No results.</div>
      <ul v-else-if="collectionResults.length" class="results">
        <li v-for="r in collectionResults" :key="r.id" class="result-item" @click="pickCollection(r)">
          <img v-if="r.poster_path" :src="`https://image.tmdb.org/t/p/w92${r.poster_path}`" class="result-poster" :alt="r.name" />
          <div v-else class="result-poster result-poster-empty"></div>
          <div class="result-info">
            <div class="result-title">{{ r.name }}</div>
            <div class="result-meta">ID: {{ r.id }}</div>
          </div>
        </li>
      </ul>
      <div v-if="collectionApplying" class="state-msg-modal">Applying…</div>
      <div v-if="collectionApplied" class="state-msg-modal ok">Collection updated ✓</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCollectionStore } from '@/stores/collection.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import FormatBadge from '@/components/FormatBadge.vue'
import OverrideModal from '@/components/OverrideModal.vue'
import CollectionRail from '@/components/CollectionRail.vue'
import StarRating from '@/components/StarRating.vue'
import { getReview, saveReviewLocally, syncReviewToSheet } from '@/services/review.js'
import { searchCollections } from '@/services/tmdb.js'

const route = useRoute()
const collection = useCollectionStore()
const tmdb = useTmdbStore()

const enriching = ref(false)
const awardsExpanded = ref(false)
const showOverrideModal = ref(false)
const showCollectionModal = ref(false)
const collectionQuery = ref('')
const collectionResults = ref([])
const collectionSearching = ref(false)
const collectionSearched = ref(false)
const collectionError = ref('')
const collectionApplying = ref(false)
const collectionApplied = ref(false)
let collectionDebounce = null

// The source collection movie (if this film was expanded from a box set)
const sourceCollection = computed(() =>
  movie.value?.collectionId
    ? collection.movies.find(m => m.id === movie.value.collectionId)
    : null
)

async function doCollectionSearch() {
  if (!collectionQuery.value.trim() || !tmdb.apiKey) { collectionResults.value = []; collectionSearched.value = false; return }
  collectionSearching.value = true
  collectionError.value = ''
  try {
    collectionResults.value = await searchCollections(collectionQuery.value.trim(), tmdb.apiKey)
    collectionSearched.value = true
  } catch (e) {
    collectionError.value = e.message
  } finally {
    collectionSearching.value = false
  }
}

function onCollectionInput() {
  clearTimeout(collectionDebounce)
  collectionDebounce = setTimeout(doCollectionSearch, 300)
}

async function pickCollection(result) {
  if (!sourceCollection.value) return
  collectionApplying.value = true
  try {
    await tmdb.applyCollectionOverride(sourceCollection.value.id, result.id)
    collectionApplied.value = true
    setTimeout(() => { showCollectionModal.value = false; collectionApplied.value = false }, 800)
  } catch (e) {
    collectionError.value = `Failed: ${e.message}`
  } finally {
    collectionApplying.value = false
  }
}

const localRating = ref(0)
const localReview = ref('')
const saving = ref(false)
const saveStatus = ref('')
const saveError = ref('')

function loadReview(id) {
  const r = getReview(id)
  localRating.value = r.rating
  localReview.value = r.review
  saveStatus.value = ''
}

async function saveReview() {
  const id = route.params.id
  const data = { rating: localRating.value, review: localReview.value }
  saveReviewLocally(id, data)
  saving.value = true
  saveStatus.value = ''
  saveError.value = ''
  try {
    await syncReviewToSheet(id, movie.value?.title ?? id, data)
    saveStatus.value = 'saved'
  } catch (e) {
    saveStatus.value = 'error'
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

const movie = computed(() => collection.expandedMovies.find(m => m.id === route.params.id))
const collectionSiblings = computed(() => {
  if (!movie.value?.collectionId) return []
  return collection.expandedMovies.filter(m => m.collectionId === movie.value.collectionId)
})
const tmdbData = computed(() => tmdb.getMovieData(route.params.id))
const oscarData = computed(() => tmdb.getOscarData(route.params.id))

const oscarLabel = computed(() => {
  const d = oscarData.value
  if (!d) return ''
  if (d.wins > 0 && d.nominations > d.wins)
    return `Won ${d.wins} of ${d.nominations} Oscar nominations`
  if (d.wins > 0)
    return `Won ${d.wins} Oscar${d.wins !== 1 ? 's' : ''}`
  return `Nominated for ${d.nominations} Oscar${d.nominations !== 1 ? 's' : ''}`
})

const heroStyle = computed(() =>
  tmdbData.value?.backdropPath
    ? { backgroundImage: `url(${tmdbData.value.backdropPath})` }
    : {}
)

function formatMoney(amount) {
  if (!amount) return null
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

function formatRuntime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

async function enrich() {
  if (!movie.value) return
  enriching.value = true
  await tmdb.fetchForMovie(movie.value)
  enriching.value = false
}

watch(() => route.params.id, async (id) => {
  if (id) loadReview(id)
  if (!movie.value || !tmdb.hasApiKey) return
  if (movie.value.tmdbId && !tmdbData.value) {
    enriching.value = true
    await tmdb.fetchForMovieById(movie.value)
    enriching.value = false
  } else if (!movie.value.isCollection && !movie.value.tmdbId && !tmdbData.value) {
    await enrich()
  }
  // Patch missing extended fields for already-cached entries
  if (tmdbData.value && (!tmdbData.value.genres || !tmdbData.value.writers || !tmdbData.value.productionCountries)) {
    await tmdb.patchDetails(route.params.id)
  }
}, { immediate: true })
</script>

<style scoped>
.hero {
  min-height: 360px; background: var(--surface);
  background-size: cover; background-position: center top;
  position: relative;
}
.hero-gradient {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(13,13,13,0.95) 100%);
}
.hero-content {
  position: relative; z-index: 1;
  display: flex; align-items: flex-end; gap: 2rem;
  padding: 2rem 2rem 1.5rem; min-height: 360px;
}
.hero-poster {
  width: 140px; flex-shrink: 0;
  border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,0.6);
}
.hero-poster-placeholder {
  width: 140px; height: 210px; flex-shrink: 0;
  background: var(--surface-2); border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; text-align: center; font-size: 0.85rem; color: var(--text-2);
}
.hero-meta h1 { font-size: 2rem; line-height: 1.2; margin-bottom: 0.4rem; }
.hero-stats { font-size: 0.95rem; color: var(--text-2); margin-bottom: 0.5rem; }
.rating { color: var(--badge-4k); }
.hero-genres { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.genre-tag {
  padding: 3px 10px; border-radius: 20px;
  background: rgba(255,255,255,0.1); font-size: 0.8rem; color: var(--text-2);
}

.body { padding: 1.5rem 2rem 3rem; }
.back-btn {
  background: none; border: none; color: var(--text-2);
  font-size: 0.9rem; padding: 0; margin-bottom: 2rem;
}
.back-btn:hover { color: var(--text); }

.sections { max-width: 720px; display: flex; flex-direction: column; gap: 1.75rem; }
.sections section h2 {
  font-size: 0.75rem; text-transform: uppercase;
  letter-spacing: 1.5px; color: var(--text-3); margin-bottom: 0.5rem;
}
.sections section p { color: var(--text-2); line-height: 1.7; }

.your-review { display: flex; flex-direction: column; gap: 0.75rem; }
.review-rating-row { display: flex; align-items: center; gap: 0.75rem; }
.no-rating { font-size: 0.85rem; color: var(--text-3); }
.review-textarea {
  width: 100%; padding: 0.65rem 0.75rem;
  background: var(--surface-2); border: 1px solid var(--text-3);
  border-radius: var(--radius); color: var(--text);
  font: inherit; font-size: 0.9rem; line-height: 1.6;
  resize: vertical; min-height: 90px;
  transition: border-color 0.15s;
}
.review-textarea:focus { outline: none; border-color: var(--accent); }
.review-actions { display: flex; align-items: center; gap: 1rem; }
.save-btn {
  background: var(--accent); color: #fff; border: none;
  padding: 0.45rem 1.1rem; border-radius: var(--radius);
  font-size: 0.875rem; font-weight: 600;
  transition: background 0.15s;
}
.save-btn:hover:not(:disabled) { background: var(--accent-hover); }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.save-status { font-size: 0.85rem; }
.save-status.ok  { color: #2ecc9a; }
.save-status.err { color: #e74c3c; }

.your-copy { display: flex; flex-direction: column; gap: 0.6rem; }
.copy-row { display: flex; align-items: center; gap: 1rem; }
.copy-label { font-size: 0.8rem; color: var(--text-3); width: 70px; flex-shrink: 0; }
.collection-tag { font-size: 0.8rem; color: var(--text-2); }

.oscar-row { display: flex; align-items: center; gap: 0.75rem; }
.oscar-summary { font-size: 0.95rem; color: var(--text-2); }
.oscar-summary.winner { color: #f5c518; font-weight: 600; }
.expand-btn {
  background: var(--surface-2); border: 1px solid var(--text-3);
  color: var(--text-2); width: 24px; height: 24px;
  border-radius: 50%; font-size: 1rem; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.expand-btn:hover { border-color: var(--text-2); color: var(--text); }
.awards-detail { margin-top: 0.6rem; display: flex; flex-direction: column; gap: 0.4rem; }
.awards-group { display: flex; gap: 0.6rem; font-size: 0.875rem; line-height: 1.6; }
.awards-group-label { color: var(--text-3); flex-shrink: 0; min-width: 72px; }
.awards-categories { color: var(--text-2); }

.tagline-row { padding: 0.1rem 0 0.4rem; }
.tagline-text { font-style: italic; color: var(--text-2); font-size: 0.95rem; }
.imdb-link { color: #f5c518; text-decoration: none; font-size: 0.875rem; }
.imdb-link:hover { text-decoration: underline; }

.not-found { color: var(--text-3); font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.6rem; }
.not-found-actions { display: flex; gap: 0.75rem; }
.not-found button {
  background: none; border: none; color: var(--accent);
  text-decoration: underline; font-size: inherit; padding: 0;
}
.not-found button:hover { color: var(--accent-hover); }

.state-msg { padding: 3rem; text-align: center; color: var(--text-2); }

.fix-match-row { padding-top: 0.5rem; display: flex; gap: 1rem; }
.fix-match-btn {
  background: none; border: none; padding: 0;
  font-size: 0.75rem; color: var(--text-3); text-decoration: underline;
}
.fix-match-btn:hover { color: var(--text-2); }

.overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.modal {
  background: var(--surface); border-radius: var(--radius-lg);
  width: 100%; max-width: 500px; max-height: 80vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
}
.modal-header h2 { font-size: 1rem; font-weight: 600; }
.close-btn {
  background: none; border: none; color: var(--text-2);
  font-size: 1.4rem; line-height: 1; padding: 0 0.25rem;
}
.close-btn:hover { color: var(--text); }
.search-input {
  margin: 0 1.25rem 0.75rem;
  background: var(--surface-2); border: 1px solid var(--text-3);
  border-radius: var(--radius); color: var(--text);
  padding: 0.5rem 0.75rem; font-size: 0.9rem; width: calc(100% - 2.5rem);
}
.search-input:focus { outline: none; border-color: var(--accent); }
.state-msg-modal { padding: 1rem 1.25rem; color: var(--text-2); font-size: 0.875rem; }
.state-msg-modal.error { color: #e05555; }
.state-msg-modal.ok { color: #2ecc9a; }
.results { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; }
.result-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 1.25rem; cursor: pointer;
}
.result-item:hover { background: var(--surface-2); }
.result-poster { width: 40px; height: 60px; flex-shrink: 0; border-radius: 3px; object-fit: cover; }
.result-poster-empty { background: var(--surface-2); border: 1px solid var(--text-3); }
.result-title { font-size: 0.9rem; color: var(--text); }
.result-meta { font-size: 0.75rem; color: var(--text-3); margin-top: 2px; }

@media (max-width: 600px) {
  .hero-content { flex-direction: column; align-items: flex-start; padding: 1rem; }
  .hero-poster { width: 100px; }
  .hero-meta h1 { font-size: 1.4rem; }
  .body { padding: 1rem 1rem 3rem; }
}
</style>
