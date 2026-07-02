import { fetchPopularMoviesPage } from './tmdbClient.js'
import { ensureMoviesTable, insertMovies } from './database.js'

export function normalizeMovie(movie, index) {
  return {
    tmdbId: movie.id,
    title: movie.title,
    originalTitle: movie.original_title || null,
    overview: movie.overview || null,
    releaseDate: movie.release_date || null,
    originalLanguage: movie.original_language || null,
    posterPath: movie.poster_path || null,
    backdropPath: movie.backdrop_path || null,
    popularity: movie.popularity ?? null,
    voteAverage: movie.vote_average ?? null,
    voteCount: movie.vote_count ?? null,
    adult: Boolean(movie.adult),
    video: Boolean(movie.video),
    genreIds: Array.isArray(movie.genre_ids) ? movie.genre_ids : [],
    rawPayload: movie,
    importRank: index + 1,
  }
}

export async function collectPopularMovies(fetchImpl, options) {
  const { token, baseUrl, count = 30 } = options
  const collected = []
  const seenIds = new Set()
  let page = 1

  while (collected.length < count && page <= 2) {
    const payload = await fetchPopularMoviesPage(fetchImpl, {
      token,
      page,
      baseUrl,
    })

    const results = Array.isArray(payload.results) ? payload.results : []

    for (const movie of results) {
      if (seenIds.has(movie.id)) {
        continue
      }

      seenIds.add(movie.id)
      collected.push(movie)

      if (collected.length === count) {
        break
      }
    }

    if (results.length === 0) {
      break
    }

    page += 1
  }

  return collected.slice(0, count).map((movie, index) => normalizeMovie(movie, index))
}

export async function importPopularMovies(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, count = 30 } = options
  const movies = await collectPopularMovies(fetchImpl, {
    token,
    baseUrl,
    count,
  })

  if (movies.length !== count) {
    throw new Error(`Expected ${count} movies from TMDB, received ${movies.length}`)
  }

  await ensureMoviesTable(pool)
  const importSummary = await insertMovies(pool, movies)

  return {
    fetchedCount: movies.length,
    insertedCount: importSummary.insertedCount,
    skippedCount: importSummary.skippedCount,
    movies,
  }
}
