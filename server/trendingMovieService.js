import { fetchTrendingMedia } from './tmdbClient.js'

// Feed previews never enter the catalog. Detail navigation handles persistence.
export function createTrendingMovieFeed({ fetchImpl = fetch, loadRuntimeConfig, now = Date.now }) {
  let cached = null
  let expiresAt = 0
  let pending = null

  return async function loadTrendingMovies() {
    if (cached && now() < expiresAt) return cached
    if (pending) return pending

    pending = (async () => {
      const config = loadRuntimeConfig()
      const payload = await fetchTrendingMedia(fetchImpl, {
        token: config.tmdbBearerToken,
        baseUrl: config.tmdbBaseUrl,
        mediaType: 'movie',
        timeWindow: 'day',
      })
      if (!Array.isArray(payload?.results)) throw new Error('Invalid TMDB trending movie response')
      const movies = payload.results.map((movie) => ({
        tmdb_id: movie.id,
        title: movie.title,
        release_date: movie.release_date || null,
        poster_path: movie.poster_path || null,
        backdrop_path: movie.backdrop_path || null,
        vote_average: movie.vote_average ?? null,
        vote_count: movie.vote_count ?? null,
      }))
      cached = { movies }
      expiresAt = now() + 10 * 60 * 1000
      return cached
    })()

    try {
      return await pending
    } finally {
      pending = null
    }
  }
}
