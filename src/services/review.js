const KEY = 'library_reviews'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

function save(all) {
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function getReview(movieId) {
  return load()[movieId] || { rating: 0, review: '' }
}

export function saveReviewLocally(movieId, { rating, review }) {
  const all = load()
  all[movieId] = { rating, review, updatedAt: Date.now() }
  save(all)
}

export async function syncReviewToSheet(movieId, title, { rating, review }) {
  const res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ movieId, title, rating, review })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Server error ${res.status}`)
  }
}
