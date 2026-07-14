import {
  fetchMovieCredits,
  fetchMovieDetails,
  fetchMovieGenres,
  fetchNowPlayingMoviesPage,
  fetchPopularMoviesPage,
  fetchUpcomingMoviesPage,
} from './tmdbClient.js'
import {
  ensureMoviesTable,
  listKnownGenreIds,
  listMoviesForCreditsBackfill,
  replaceMovieCredits,
  upsertGenres,
  upsertMovies,
} from './database.js'
import { createFavoriteActorAlertsForNewMovies } from './alertService.js'

const CAST_LIMIT = 10

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

function normalizeDetailedMovie(detailPayload, importRank = 1) {
  const genres = Array.isArray(detailPayload?.genres) ? detailPayload.genres : []

  return {
    tmdbId: detailPayload?.id,
    title: detailPayload?.title || 'Untitled',
    originalTitle: detailPayload?.original_title || null,
    overview: detailPayload?.overview || null,
    releaseDate: detailPayload?.release_date || null,
    originalLanguage: detailPayload?.original_language || null,
    posterPath: detailPayload?.poster_path || null,
    backdropPath: detailPayload?.backdrop_path || null,
    popularity: detailPayload?.popularity ?? null,
    voteAverage: detailPayload?.vote_average ?? null,
    voteCount: detailPayload?.vote_count ?? null,
    adult: Boolean(detailPayload?.adult),
    video: Boolean(detailPayload?.video),
    genreIds: genres.map((genre) => genre?.id).filter((genreId) => Number.isInteger(genreId)),
    runtimeMinutes: null,
    certification: null,
    detailPayload: null,
    rawPayload: detailPayload ?? {},
    importRank,
  }
}

function sanitizeReleaseDates(releaseDatesPayload) {
  if (!releaseDatesPayload || typeof releaseDatesPayload !== 'object') {
    return releaseDatesPayload ?? null
  }

  const releaseDateResults = Array.isArray(releaseDatesPayload.results) ? releaseDatesPayload.results : []
  const usRelease = releaseDateResults.find((entry) => entry?.iso_3166_1 === 'US')

  return {
    ...releaseDatesPayload,
    results: usRelease ? [usRelease] : [],
  }
}

function sanitizeMovieDetailPayload(detailPayload) {
  if (!detailPayload || typeof detailPayload !== 'object') {
    return detailPayload ?? null
  }

  return {
    ...detailPayload,
    release_dates: sanitizeReleaseDates(detailPayload.release_dates),
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

function normalizeMovieCredits(creditsPayload) {
  const director = Array.isArray(creditsPayload?.crew)
    ? creditsPayload.crew.find((person) => person?.job === 'Director' && person?.id && person?.name)
    : null

  const cast = Array.isArray(creditsPayload?.cast)
    ? [...creditsPayload.cast]
        .filter((person) => person?.id && person?.name)
        .sort((left, right) => {
          const leftOrder = Number.isInteger(left?.order) ? left.order : Number.MAX_SAFE_INTEGER
          const rightOrder = Number.isInteger(right?.order) ? right.order : Number.MAX_SAFE_INTEGER

          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder
          }

          return String(left.name).localeCompare(String(right.name))
        })
        .slice(0, CAST_LIMIT)
    : []

  return {
    director: director
      ? {
          tmdbPersonId: director.id,
          name: director.name,
          profilePath: director.profile_path || null,
          department: director.department || null,
          job: director.job || null,
        }
      : null,
    cast: cast.map((person) => ({
      tmdbPersonId: person.id,
      name: person.name,
      profilePath: person.profile_path || null,
      characterName: person.character || null,
      billingOrder: Number.isInteger(person.order) ? person.order : null,
      department: person.known_for_department || null,
      job: null,
    })),
  }
}

async function fetchNormalizedMovieCredits(fetchImpl, options) {
  try {
    const creditsPayload = await fetchMovieCredits(fetchImpl, options)
    return normalizeMovieCredits(creditsPayload)
  } catch {
    return {
      director: null,
      cast: [],
    }
  }
}

async function fetchNormalizedMovieCreditsStrict(fetchImpl, options) {
  const creditsPayload = await fetchMovieCredits(fetchImpl, options)
  return normalizeMovieCredits(creditsPayload)
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
    const detailOptions = {
      ...options,
      movieId: movie.tmdbId,
    }
    const detailPayload = await fetchMovieDetails(fetchImpl, detailOptions)
    const sanitizedDetailPayload = sanitizeMovieDetailPayload(detailPayload)
    const credits = await fetchNormalizedMovieCredits(fetchImpl, detailOptions)

    enrichedMovies.push({
      ...movie,
      runtimeMinutes: sanitizedDetailPayload?.runtime ?? null,
      certification: extractCertification(sanitizedDetailPayload),
      detailPayload: sanitizedDetailPayload,
      credits,
    })
  }

  return enrichedMovies
}

export async function hydrateMovieByTmdbId(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, movieId, importRank = 1 } = options

  await ensureMoviesTable(pool)

  const detailPayload = await fetchMovieDetails(fetchImpl, {
    token,
    baseUrl,
    movieId,
  })
  const sanitizedDetailPayload = sanitizeMovieDetailPayload(detailPayload)
  const credits = await fetchNormalizedMovieCreditsStrict(fetchImpl, {
    token,
    baseUrl,
    movieId,
  })

  const normalizedMovie = normalizeDetailedMovie(sanitizedDetailPayload, importRank)
  const hydratedMovie = {
    ...normalizedMovie,
    runtimeMinutes: sanitizedDetailPayload?.runtime ?? null,
    certification: extractCertification(sanitizedDetailPayload),
    detailPayload: sanitizedDetailPayload,
    credits,
  }

  await syncMissingGenres(
    pool,
    fetchImpl,
    {
      token,
      baseUrl,
    },
    [hydratedMovie]
  )
  const importSummary = await upsertMovies(pool, [hydratedMovie])
  await createFavoriteActorAlertsForNewMovies(pool, importSummary.insertedMovieIds)

  return hydratedMovie
}

export async function backfillMovieCredits(pool, options) {
  const { fetchImpl = fetch, token, baseUrl } = options
  await ensureMoviesTable(pool)

  const movies = await listMoviesForCreditsBackfill(pool)
  let processedCount = 0
  let insertedCount = 0
  let updatedCount = 0
  let failedCount = 0

  for (const movie of movies) {
    processedCount += 1

    try {
      const creditsPayload = await fetchMovieCredits(fetchImpl, {
        token,
        baseUrl,
        movieId: movie.tmdb_id,
      })
      const result = await replaceMovieCredits(pool, movie.tmdb_id, normalizeMovieCredits(creditsPayload))

      if (result) {
        insertedCount += result.insertedCastMembersCount ?? 0
        updatedCount += 1
      }
    } catch {
      failedCount += 1
    }
  }

  return {
    processedCount,
    insertedCount,
    updatedCount,
    failedCount,
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

function isWithinNext30Days(releaseDate, now = new Date()) {
  if (!releaseDate) {
    return false
  }

  const parsedReleaseDate = new Date(`${releaseDate}T00:00:00.000Z`)

  if (Number.isNaN(parsedReleaseDate.getTime())) {
    return false
  }

  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 30)

  return parsedReleaseDate > start && parsedReleaseDate <= end
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

export async function collectUpcomingMovies(fetchImpl, options) {
  const { token, baseUrl, count = 30, now = new Date() } = options
  const collected = []
  const seenIds = new Set()
  let page = 1

  while (collected.length < count) {
    const payload = await fetchUpcomingMoviesPage(fetchImpl, {
      token,
      page,
      baseUrl,
    })

    const results = Array.isArray(payload.results) ? payload.results : []

    for (const movie of results) {
      if (seenIds.has(movie.id) || !isWithinNext30Days(movie.release_date, now)) {
        continue
      }

      seenIds.add(movie.id)
      collected.push(movie)
    }

    if (results.length === 0 || page >= (payload.total_pages ?? page)) {
      break
    }

    page += 1
  }

  collected.sort((left, right) => {
    const leftDate = left.release_date ?? ''
    const rightDate = right.release_date ?? ''

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate)
    }

    return left.id - right.id
  })

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
  await createFavoriteActorAlertsForNewMovies(pool, importSummary.insertedMovieIds)

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
  await createFavoriteActorAlertsForNewMovies(pool, importSummary.insertedMovieIds)

  return {
    fetchedCount: enrichedMovies.length,
    insertedCount: importSummary.insertedCount,
    updatedCount: importSummary.updatedCount,
    movies: enrichedMovies,
  }
}

export async function importUpcomingMovies(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, count = 30, now = new Date() } = options
  const movies = await collectUpcomingMovies(fetchImpl, {
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
  await createFavoriteActorAlertsForNewMovies(pool, importSummary.insertedMovieIds)

  return {
    fetchedCount: enrichedMovies.length,
    insertedCount: importSummary.insertedCount,
    updatedCount: importSummary.updatedCount,
    movies: enrichedMovies,
  }
}
