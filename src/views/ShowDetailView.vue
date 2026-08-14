<template>
  <div class="detail" v-if="show">
    <div class="hero" :style="heroStyle">
      <div class="hero-gradient"></div>
      <div class="hero-content">
        <img v-if="tvData?.posterPath" :src="tvData.posterPath" class="hero-poster" :alt="show.title" />
        <div v-else class="hero-poster hero-poster-placeholder">{{ show.title }}</div>
        <div class="hero-meta">
          <h1>{{ show.title }}</h1>
          <div class="hero-stats">
            <span v-if="airRange">{{ airRange }}</span>
            <span v-if="tvData?.numberOfSeasons"> · {{ tvData.numberOfSeasons }} seasons</span>
            <span v-if="tvData?.voteAverage" class="rating"> · ★ {{ tvData.voteAverage.toFixed(1) }}</span>
          </div>
          <div class="hero-genres">
            <span v-if="show.genre" class="genre-tag">{{ show.genre }}</span>
            <span v-if="show.subGenre" class="genre-tag">{{ show.subGenre }}</span>
            <span class="genre-tag owned">{{ ownedLabel }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="body">
      <button class="back-btn" @click="$router.back()">← Back</button>

      <div class="sections">
        <section v-if="tvData?.overview">
          <h2>Overview</h2>
          <p>{{ tvData.overview }}</p>
        </section>

        <section class="your-seasons">
          <h2>Your Seasons</h2>
          <div v-for="season in show.seasons" :key="season.id" class="season-row">
            <img
              v-if="posterFor(season)"
              :src="posterFor(season)"
              class="season-poster"
              :alt="season.label"
              loading="lazy"
            />
            <div v-else class="season-poster season-poster-empty"></div>

            <div class="season-main">
              <div class="season-head">
                <span class="season-label">{{ season.label }}</span>
                <FormatBadge :formats="season.formats" :notes="season.notes" />
                <span v-if="season.coversAllSeasons" class="covers-note">covers every season</span>
              </div>
              <div class="season-rate">
                <StarRating
                  :modelValue="stateFor(season.id).rating"
                  @update:modelValue="rate(season, $event)"
                />
                <button class="link-btn" @click="toggle(season.id)">
                  {{ stateFor(season.id).expanded ? 'Hide review' : (stateFor(season.id).review ? 'Edit review' : '+ Review') }}
                </button>
                <span v-if="stateFor(season.id).status === 'saving'" class="save-status">Saving…</span>
                <span v-else-if="stateFor(season.id).status === 'saved'" class="save-status ok">Saved ✓</span>
                <span v-else-if="stateFor(season.id).status === 'error'" class="save-status err">{{ stateFor(season.id).error }}</span>
              </div>

              <div v-if="stateFor(season.id).expanded" class="season-review">
                <textarea
                  v-model="stateFor(season.id).review"
                  class="review-textarea"
                  placeholder="Write your thoughts…"
                  rows="3"
                ></textarea>
                <button class="save-btn" @click="saveReview(season)">Save to Sheet</button>
              </div>
            </div>
          </div>
        </section>

        <section v-if="tvData" class="details-grid">
          <h2>Details</h2>
          <div v-if="tvData.tagline" class="copy-row tagline-row">
            <span class="tagline-text">{{ tvData.tagline }}</span>
          </div>
          <div v-if="tvData.createdBy?.length" class="copy-row">
            <span class="copy-label">Created by</span>
            <span>{{ tvData.createdBy.join(', ') }}</span>
          </div>
          <div v-if="tvData.networks?.length" class="copy-row">
            <span class="copy-label">Network</span>
            <span>{{ tvData.networks.join(', ') }}</span>
          </div>
          <div v-if="tvData.status" class="copy-row">
            <span class="copy-label">Status</span>
            <span>{{ tvData.status }}</span>
          </div>
          <div v-if="tvData.numberOfEpisodes" class="copy-row">
            <span class="copy-label">Episodes</span>
            <span>{{ tvData.numberOfEpisodes }}</span>
          </div>
          <div v-if="tvData.runtime" class="copy-row">
            <span class="copy-label">Episode length</span>
            <span>{{ tvData.runtime }}m</span>
          </div>
          <div v-if="tvData.genres?.length" class="copy-row">
            <span class="copy-label">Genres</span>
            <span>{{ tvData.genres.join(', ') }}</span>
          </div>
          <div v-if="tvData.cast?.length" class="copy-row">
            <span class="copy-label">Cast</span>
            <span>{{ tvData.cast.join(', ') }}</span>
          </div>
          <div v-if="tvData.languages?.length" class="copy-row">
            <span class="copy-label">Language</span>
            <span>{{ tvData.languages.join(', ') }}</span>
          </div>
          <div v-if="tvData.productionCountries?.length" class="copy-row">
            <span class="copy-label">Countries</span>
            <span>{{ tvData.productionCountries.join(', ') }}</span>
          </div>
          <div v-if="tvData.productionCompanies?.length" class="copy-row">
            <span class="copy-label">Studios</span>
            <span>{{ tvData.productionCompanies.join(', ') }}</span>
          </div>
        </section>

        <section v-if="!tvData && !enriching">
          <div class="not-found" v-if="tmdb.hasApiKey">
            <span>TMDB data not loaded.</span>
            <div class="not-found-actions">
              <button @click="enrich">Fetch from TMDB</button>
              <button @click="openSearch">Search manually</button>
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
          <button class="fix-match-btn" @click="openSearch">
            {{ tvData ? 'Fix TMDB match' : 'Search TMDB manually' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="state-msg">Show not found.</div>

  <div v-if="showSearch" class="overlay" @click.self="showSearch = false">
    <div class="modal">
      <div class="modal-header">
        <h2>Match “{{ show?.title }}”</h2>
        <button class="close-btn" @click="showSearch = false">×</button>
      </div>
      <input
        v-model="query"
        class="search-input"
        placeholder="Search TMDB shows…"
        @input="onQueryInput"
      />
      <div v-if="searching" class="state-msg-modal">Searching…</div>
      <div v-else-if="searchError" class="state-msg-modal error">{{ searchError }}</div>
      <div v-else-if="searched && results.length === 0" class="state-msg-modal">No results.</div>
      <ul v-else-if="results.length" class="results">
        <li v-for="r in results" :key="r.id" class="result-item" @click="pick(r)">
          <img v-if="r.poster_path" :src="`https://image.tmdb.org/t/p/w92${r.poster_path}`" class="result-poster" :alt="r.name" />
          <div v-else class="result-poster result-poster-empty"></div>
          <div class="result-info">
            <div class="result-title">{{ r.name }}</div>
            <div class="result-meta">{{ r.first_air_date?.slice(0, 4) || '—' }} · ID {{ r.id }}</div>
          </div>
        </li>
      </ul>
      <div v-if="applied" class="state-msg-modal ok">Match saved ✓</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useShowsStore } from '@/stores/shows.js'
import { useTmdbStore } from '@/stores/tmdb.js'
import FormatBadge from '@/components/FormatBadge.vue'
import StarRating from '@/components/StarRating.vue'
import { getReview, saveReviewLocally, syncReviewToSheet } from '@/services/review.js'
import { searchTvShows } from '@/services/tmdb.js'

const route = useRoute()
const shows = useShowsStore()
const tmdb = useTmdbStore()

const enriching = ref(false)
const showSearch = ref(false)
const query = ref('')
const results = ref([])
const searching = ref(false)
const searched = ref(false)
const searchError = ref('')
const applied = ref(false)
let debounce = null

const show = computed(() => shows.getShow(route.params.id))
const tvData = computed(() => tmdb.getShowData(route.params.id))

const seasonState = reactive({})

function stateFor(seasonId) {
  if (!seasonState[seasonId]) {
    const saved = getReview(seasonId)
    seasonState[seasonId] = {
      rating: saved.rating,
      review: saved.review,
      expanded: false,
      status: '',
      error: ''
    }
  }
  return seasonState[seasonId]
}

function toggle(seasonId) {
  const s = stateFor(seasonId)
  s.expanded = !s.expanded
}

async function push(season, state) {
  state.status = 'saving'
  state.error = ''
  saveReviewLocally(season.id, { rating: state.rating, review: state.review })
  try {
    await syncReviewToSheet(season.id, season.categoryName, {
      rating: state.rating,
      review: state.review
    })
    state.status = 'saved'
    setTimeout(() => { if (state.status === 'saved') state.status = '' }, 2000)
  } catch (e) {
    state.status = 'error'
    state.error = e.message
  }
}

function rate(season, value) {
  const state = stateFor(season.id)
  state.rating = value
  push(season, state)
}

function saveReview(season) {
  push(season, stateFor(season.id))
}

const airRange = computed(() => {
  const d = tvData.value
  if (!d?.year) return ''
  if (d.lastAirYear && d.lastAirYear !== d.year) return `${d.year}–${d.lastAirYear}`
  return String(d.year)
})

const ownedLabel = computed(() => {
  const s = show.value
  if (!s) return ''
  if (s.hasCompleteSeries) return 'Complete Series owned'
  if (s.ownedSeasons > 1) return `${s.ownedSeasons} seasons owned`
  return s.seasonCount === 1 ? '1 owned' : `${s.seasonCount} owned`
})

function posterFor(season) {
  const num = season.seasons?.[0]
  if (num == null) return tvData.value?.posterPath || null
  const match = tvData.value?.seasons?.find(s => s.seasonNumber === num)
  return match?.posterPath || tvData.value?.posterPath || null
}

const heroStyle = computed(() =>
  tvData.value?.backdropPath ? { backgroundImage: `url(${tvData.value.backdropPath})` } : {}
)

async function enrich() {
  if (!show.value) return
  enriching.value = true
  await tmdb.fetchForShow(show.value)
  enriching.value = false
}

function openSearch() {
  showSearch.value = true
  applied.value = false
  if (!query.value) {
    query.value = show.value?.title || ''
    runSearch()
  }
}

async function runSearch() {
  if (!query.value.trim() || !tmdb.apiKey) {
    results.value = []
    searched.value = false
    return
  }
  searching.value = true
  searchError.value = ''
  try {
    results.value = await searchTvShows(query.value.trim(), tmdb.apiKey)
    searched.value = true
  } catch (e) {
    searchError.value = e.message
  } finally {
    searching.value = false
  }
}

function onQueryInput() {
  clearTimeout(debounce)
  debounce = setTimeout(runSearch, 300)
}

async function pick(result) {
  try {
    await tmdb.applyTvOverride(route.params.id, result.id)
    applied.value = true
    setTimeout(() => { showSearch.value = false; applied.value = false }, 800)
  } catch (e) {
    searchError.value = `Failed: ${e.message}`
  }
}

watch(() => route.params.id, async () => {
  query.value = ''
  results.value = []
  searched.value = false
  for (const key of Object.keys(seasonState)) delete seasonState[key]
  if (!show.value || !tmdb.hasApiKey || tvData.value) return
  await enrich()
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
.genre-tag.owned { background: rgba(255,255,255,0.05); color: var(--text-3); }

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

.your-seasons { display: flex; flex-direction: column; gap: 0.25rem; }
.season-row {
  display: flex; gap: 0.85rem; align-items: flex-start;
  padding: 0.7rem 0; border-bottom: 1px solid var(--surface-2);
}
.season-row:last-child { border-bottom: none; }
.season-poster {
  width: 46px; aspect-ratio: 2/3; flex-shrink: 0;
  border-radius: 3px; object-fit: cover; background: var(--surface-2);
}
.season-poster-empty { border: 1px solid var(--surface-2); }
.season-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.season-head { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.season-label { font-size: 0.95rem; color: var(--text); }
.covers-note { font-size: 0.7rem; color: var(--text-3); font-style: italic; }
.season-rate { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.link-btn {
  background: none; border: none; padding: 0;
  font-size: 0.75rem; color: var(--text-3); text-decoration: underline;
}
.link-btn:hover { color: var(--text-2); }
.season-review { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
.review-textarea {
  width: 100%; padding: 0.55rem 0.7rem;
  background: var(--surface-2); border: 1px solid var(--text-3);
  border-radius: var(--radius); color: var(--text);
  font: inherit; font-size: 0.875rem; line-height: 1.6;
  resize: vertical;
}
.review-textarea:focus { outline: none; border-color: var(--accent); }
.save-btn {
  background: var(--accent); color: #fff; border: none;
  padding: 0.35rem 0.9rem; border-radius: var(--radius);
  font-size: 0.8rem; font-weight: 600;
}
.save-btn:hover { background: var(--accent-hover); }
.save-status { font-size: 0.75rem; color: var(--text-3); }
.save-status.ok { color: #2ecc9a; }
.save-status.err { color: #e74c3c; }

.copy-row { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; }
.copy-label { font-size: 0.8rem; color: var(--text-3); width: 110px; flex-shrink: 0; }
.tagline-row { padding: 0.1rem 0 0.4rem; }
.tagline-text { font-style: italic; color: var(--text-2); font-size: 0.95rem; }

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
  .copy-label { width: 90px; }
}
</style>
