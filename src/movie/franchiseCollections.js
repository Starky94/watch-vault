export function readCollectionsRoute(pathname, search = '') {
  const match = pathname.match(/^\/movies\/collections(?:\/(\d+))?\/?$/)
  if (!match) return null
  const params = new URLSearchParams(search)
  const parsed = Number(params.get('page'))
  const page = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
  const collectionId = match[1] ? Number(match[1]) : null
  if (collectionId !== null && (!Number.isSafeInteger(collectionId) || collectionId <= 0)) return null
  return { kind: 'collections', collectionId, page, query: params.get('q')?.trim() || '', sort: ['rating', 'completion'].includes(params.get('sort')) ? params.get('sort') : 'popularity', hideWatched: params.get('hideWatched') === 'true' }
}

export function sortCollectionParts(parts) {
  return [...parts].sort((a, b) => (a.release_date || '9999').localeCompare(b.release_date || '9999') || String(a.title || '').localeCompare(String(b.title || '')) || a.id - b.id)
}

export function formatCollectionMovieCount(collection, watchedMovieIds = null) {
  const count = Number(collection.movie_count)
  const label = `${count} movies`
  if (!watchedMovieIds) return label
  const watchedCount = (collection.movie_ids ?? []).filter((id) => watchedMovieIds.has(Number(id))).length
  const percentage = count > 0 ? Math.round(watchedCount / count * 100) : 0
  return `${label} · ${percentage}% watched`
}

export function buildCollectionsPath({ collectionId = null, page = 1, query = '', sort = 'popularity', hideWatched = false } = {}) {
  const params = new URLSearchParams({ page: String(page) })
  if (query.trim()) params.set('q', query.trim())
  if (sort === 'rating' || sort === 'completion') params.set('sort', sort)
  if (hideWatched) params.set('hideWatched', 'true')
  return `/movies/collections${collectionId ? `/${collectionId}` : ''}?${params}`
}

export function memberMovieRating(movie) {
  return typeof movie.vote_average === 'number' && Number.isFinite(movie.vote_average) && movie.vote_average > 0
    ? movie.vote_average : null
}

export function formatCollectionRating(value) {
  if (value === null || value === undefined || value === '') return 'Not rated'
  const rating = Number(value)
  return Number.isFinite(rating) ? `${rating.toFixed(1)}/10` : 'Not rated'
}

export function formatCollectionPopularity(value) {
  if (value === null || value === undefined || value === '') return 'N/A'
  const popularity = Number(value)
  return Number.isFinite(popularity) && popularity >= 0
    ? popularity.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : 'N/A'
}
