import { fetchMovieDetails, fetchMovieGenres, fetchNowPlayingMoviesPage, fetchPopularMoviesPage } from './tmdbClient.js'
import { ensureMoviesTable, listKnownGenreIds, upsertGenres, upsertMovies } from './database.js'

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
    runtimeMinutes: null,
    certification: null,
    detailPayload: null,
    rawPayload: movie,
    importRank: index + 1,
  }
}

function normalizeGenre(genre) {
  return {
    tmdbGenreId: genre.id,
    name: genre.name,
  }
}

function extractCertification(detailPayload) {
  const releaseDateResults = detailPayload?.release_dates?.results

  if (!Array.isArray(releaseDateResults)) {
    return null
  }

  const usRelease = releaseDateResults.find((entry) => entry?.iso_3166_1 === 'US')
  const fallbackRelease = releaseDateResults.find((entry) =>
    Array.isArray(entry?.release_dates) && entry.release_dates.some((release) => release?.certification)
  )
  const selectedRelease = usRelease ?? fallbackRelease

  if (!selectedRelease || !Array.isArray(selectedRelease.release_dates)) {
    return null
  }

  const match = selectedRelease.release_dates.find((release) => release?.certification)
  return match?.certification || null
}

export async function syncMissingGenres(pool, fetchImpl, options, movies) {
  const genreIds = [...new Set(movies.flatMap((movie) => movie.genreIds))]
  const knownGenreIds = await listKnownGenreIds(pool, genreIds)
  const missingGenreIds = genreIds.filter((genreId) => !knownGenreIds.has(genreId))

  if (missingGenreIds.length === 0) {
    return
  }

  const payload = await fetchMovieGenres(fetchImpl, options)
  const genres = Array.isArray(payload.genres) ? payload.genres.map(normalizeGenre) : []
  const missingGenres = genres.filter((genre) => missingGenreIds.includes(genre.tmdbGenreId))

  await upsertGenres(pool, missingGenres)
}

export async function enrichMoviesWithDetails(fetchImpl, options, movies) {
  const enrichedMovies = []

  for (const movie of movies) {
    const detailPayload = await fetchMovieDetails(fetchImpl, {
      ...options,
      movieId: movie.tmdbId,
    })

    enrichedMovies.push({
      ...movie,
      runtimeMinutes: detailPayload?.runtime ?? null,
      certification: extractCertification(detailPayload),
      detailPayload,
    })
  }

  return enrichedMovies
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

function isWithinLast30Days(releaseDate, now = new Date()) {
  if (!releaseDate) {
    return false
  }

  const parsedReleaseDate = new Date(`${releaseDate}T00:00:00.000Z`)

  if (Number.isNaN(parsedReleaseDate.getTime())) {
    return false
  }

  const threshold = new Date(now)
  threshold.setUTCHours(0, 0, 0, 0)
  threshold.setUTCDate(threshold.getUTCDate() - 30)

  return parsedReleaseDate >= threshold
}

export async function collectNowPlayingMovies(fetchImpl, options) {
  const { token, baseUrl, count = 30, now = new Date() } = options
  const collected = []
  const seenIds = new Set()
  let page = 1

  while (collected.length < count) {
    const payload = await fetchNowPlayingMoviesPage(fetchImpl, {
      token,
      page,
      baseUrl,
    })

    const results = Array.isArray(payload.results) ? payload.results : []

    for (const movie of results) {
      if (seenIds.has(movie.id) || !isWithinLast30Days(movie.release_date, now)) {
        continue
      }

      seenIds.add(movie.id)
      collected.push(movie)

      if (collected.length === count) {
        break
      }
    }

    if (results.length === 0 || page >= (payload.total_pages ?? page)) {
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
  await syncMissingGenres(
    pool,
    fetchImpl,
    {
      token,
      baseUrl,
    },
    movies
  )
  const enrichedMovies = await enrichMoviesWithDetails(
    fetchImpl,
    {
      token,
      baseUrl,
    },
    movies
  )
  const importSummary = await upsertMovies(pool, enrichedMovies)

  return {
    fetchedCount: enrichedMovies.length,
    insertedCount: importSummary.insertedCount,
    updatedCount: importSummary.updatedCount,
    movies: enrichedMovies,
  }
}

export async function importNowPlayingMovies(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, count = 30, now = new Date() } = options
  const movies = await collectNowPlayingMovies(fetchImpl, {
    token,
    baseUrl,
    count,
    now,
  })

  await ensureMoviesTable(pool)
  await syncMissingGenres(
    pool,
    fetchImpl,
    {
      token,
      baseUrl,
    },
    movies
  )
  const enrichedMovies = await enrichMoviesWithDetails(
    fetchImpl,
    {
      token,
      baseUrl,
    },
    movies
  )
  const importSummary = await upsertMovies(pool, enrichedMovies)

  return {
    fetchedCount: enrichedMovies.length,
    insertedCount: importSummary.insertedCount,
    updatedCount: importSummary.updatedCount,
    movies: enrichedMovies,
  }
}
