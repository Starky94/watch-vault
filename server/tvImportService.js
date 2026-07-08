import {
  fetchAiringTodayTvShowsPage,
  fetchOnTheAirTvShowsPage,
  fetchPopularTvShowsPage,
  fetchTvDetails,
  fetchTvGenres,
} from './tmdbClient.js'
import { ensureMoviesTable, listKnownTvGenreIds, upsertTvGenres, upsertTvShows } from './database.js'

export function normalizeTvShow(show, index) {
  return {
    tmdbId: show.id,
    name: show.name || 'Untitled',
    originalName: show.original_name || null,
    overview: show.overview || null,
    firstAirDate: show.first_air_date || null,
    originalLanguage: show.original_language || null,
    posterPath: show.poster_path || null,
    backdropPath: show.backdrop_path || null,
    popularity: show.popularity ?? null,
    voteAverage: show.vote_average ?? null,
    voteCount: show.vote_count ?? null,
    genreIds: Array.isArray(show.genre_ids) ? show.genre_ids : [],
    detailPayload: null,
    rawPayload: show,
    importRank: index + 1,
  }
}

function normalizeTvGenre(genre) {
  return {
    tmdbGenreId: genre.id,
    name: genre.name,
  }
}

function normalizeDetailedTvShow(detailPayload, importRank = 1) {
  const genres = Array.isArray(detailPayload?.genres) ? detailPayload.genres : []

  return {
    tmdbId: detailPayload?.id,
    name: detailPayload?.name || 'Untitled',
    originalName: detailPayload?.original_name || null,
    overview: detailPayload?.overview || null,
    firstAirDate: detailPayload?.first_air_date || null,
    originalLanguage: detailPayload?.original_language || null,
    posterPath: detailPayload?.poster_path || null,
    backdropPath: detailPayload?.backdrop_path || null,
    popularity: detailPayload?.popularity ?? null,
    voteAverage: detailPayload?.vote_average ?? null,
    voteCount: detailPayload?.vote_count ?? null,
    genreIds: genres.map((genre) => genre?.id).filter((genreId) => Number.isInteger(genreId)),
    detailPayload: null,
    rawPayload: detailPayload ?? {},
    importRank,
  }
}

function sanitizeTvDetailPayload(detailPayload) {
  if (!detailPayload || typeof detailPayload !== 'object') {
    return detailPayload ?? null
  }

  return {
    ...detailPayload,
  }
}

function isWithinLast30Days(firstAirDate, now = new Date()) {
  if (!firstAirDate) {
    return false
  }

  const parsedFirstAirDate = new Date(`${firstAirDate}T00:00:00.000Z`)

  if (Number.isNaN(parsedFirstAirDate.getTime())) {
    return false
  }

  const threshold = new Date(now)
  threshold.setUTCHours(0, 0, 0, 0)
  threshold.setUTCDate(threshold.getUTCDate() - 30)

  return parsedFirstAirDate >= threshold
}

function isWithinNext30Days(firstAirDate, now = new Date()) {
  if (!firstAirDate) {
    return false
  }

  const parsedFirstAirDate = new Date(`${firstAirDate}T00:00:00.000Z`)

  if (Number.isNaN(parsedFirstAirDate.getTime())) {
    return false
  }

  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 30)

  return parsedFirstAirDate > start && parsedFirstAirDate <= end
}

export async function syncMissingTvGenres(pool, fetchImpl, options, tvShows) {
  const genreIds = [...new Set(tvShows.flatMap((tvShow) => tvShow.genreIds))]
  const knownGenreIds = await listKnownTvGenreIds(pool, genreIds)
  const missingGenreIds = genreIds.filter((genreId) => !knownGenreIds.has(genreId))

  if (missingGenreIds.length === 0) {
    return
  }

  const payload = await fetchTvGenres(fetchImpl, options)
  const genres = Array.isArray(payload.genres) ? payload.genres.map(normalizeTvGenre) : []
  const missingGenres = genres.filter((genre) => missingGenreIds.includes(genre.tmdbGenreId))

  await upsertTvGenres(pool, missingGenres)
}

export async function enrichTvShowsWithDetails(fetchImpl, options, tvShows) {
  const enrichedTvShows = []

  for (const tvShow of tvShows) {
    const detailPayload = await fetchTvDetails(fetchImpl, {
      ...options,
      tvShowId: tvShow.tmdbId,
    })
    const sanitizedDetailPayload = sanitizeTvDetailPayload(detailPayload)

    enrichedTvShows.push({
      ...tvShow,
      detailPayload: sanitizedDetailPayload,
    })
  }

  return enrichedTvShows
}

export async function collectPopularTvShows(fetchImpl, options) {
  const { token, baseUrl, count = 30 } = options
  const collected = []
  const seenIds = new Set()
  let page = 1

  while (collected.length < count && page <= 2) {
    const payload = await fetchPopularTvShowsPage(fetchImpl, {
      token,
      page,
      baseUrl,
    })

    const results = Array.isArray(payload.results) ? payload.results : []

    for (const tvShow of results) {
      if (seenIds.has(tvShow.id)) {
        continue
      }

      seenIds.add(tvShow.id)
      collected.push(tvShow)

      if (collected.length === count) {
        break
      }
    }

    if (results.length === 0) {
      break
    }

    page += 1
  }

  return collected.slice(0, count).map((tvShow, index) => normalizeTvShow(tvShow, index))
}

export async function collectAiringTodayTvShows(fetchImpl, options) {
  const { token, baseUrl, count = 30, now = new Date() } = options
  const collected = []
  const seenIds = new Set()
  let page = 1

  while (collected.length < count) {
    const payload = await fetchAiringTodayTvShowsPage(fetchImpl, {
      token,
      page,
      baseUrl,
    })

    const results = Array.isArray(payload.results) ? payload.results : []

    for (const tvShow of results) {
      if (seenIds.has(tvShow.id) || !isWithinLast30Days(tvShow.first_air_date, now)) {
        continue
      }

      seenIds.add(tvShow.id)
      collected.push(tvShow)

      if (collected.length === count) {
        break
      }
    }

    if (results.length === 0 || page >= (payload.total_pages ?? page)) {
      break
    }

    page += 1
  }

  return collected.slice(0, count).map((tvShow, index) => normalizeTvShow(tvShow, index))
}

export async function collectOnTheAirTvShows(fetchImpl, options) {
  const { token, baseUrl, count = 30, now = new Date() } = options
  const collected = []
  const seenIds = new Set()
  let page = 1

  while (collected.length < count) {
    const payload = await fetchOnTheAirTvShowsPage(fetchImpl, {
      token,
      page,
      baseUrl,
    })

    const results = Array.isArray(payload.results) ? payload.results : []

    for (const tvShow of results) {
      if (seenIds.has(tvShow.id) || !isWithinNext30Days(tvShow.first_air_date, now)) {
        continue
      }

      seenIds.add(tvShow.id)
      collected.push(tvShow)
    }

    if (results.length === 0 || page >= (payload.total_pages ?? page)) {
      break
    }

    page += 1
  }

  collected.sort((left, right) => {
    const leftDate = left.first_air_date ?? ''
    const rightDate = right.first_air_date ?? ''

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate)
    }

    return left.id - right.id
  })

  return collected.slice(0, count).map((tvShow, index) => normalizeTvShow(tvShow, index))
}

export async function importPopularTvShows(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, count = 30 } = options
  const tvShows = await collectPopularTvShows(fetchImpl, {
    token,
    baseUrl,
    count,
  })

  if (tvShows.length !== count) {
    throw new Error(`Expected ${count} TV shows from TMDB, received ${tvShows.length}`)
  }

  await ensureMoviesTable(pool)
  await syncMissingTvGenres(pool, fetchImpl, { token, baseUrl }, tvShows)
  const enrichedTvShows = await enrichTvShowsWithDetails(fetchImpl, { token, baseUrl }, tvShows)
  const importSummary = await upsertTvShows(pool, enrichedTvShows)

  return {
    fetchedCount: enrichedTvShows.length,
    insertedCount: importSummary.insertedCount,
    updatedCount: importSummary.updatedCount,
    tvShows: enrichedTvShows,
  }
}

export async function importAiringTodayTvShows(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, count = 30, now = new Date() } = options
  const tvShows = await collectAiringTodayTvShows(fetchImpl, {
    token,
    baseUrl,
    count,
    now,
  })

  await ensureMoviesTable(pool)
  await syncMissingTvGenres(pool, fetchImpl, { token, baseUrl }, tvShows)
  const enrichedTvShows = await enrichTvShowsWithDetails(fetchImpl, { token, baseUrl }, tvShows)
  const importSummary = await upsertTvShows(pool, enrichedTvShows)

  return {
    fetchedCount: enrichedTvShows.length,
    insertedCount: importSummary.insertedCount,
    updatedCount: importSummary.updatedCount,
    tvShows: enrichedTvShows,
  }
}

export async function importOnTheAirTvShows(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, count = 30, now = new Date() } = options
  const tvShows = await collectOnTheAirTvShows(fetchImpl, {
    token,
    baseUrl,
    count,
    now,
  })

  await ensureMoviesTable(pool)
  await syncMissingTvGenres(pool, fetchImpl, { token, baseUrl }, tvShows)
  const enrichedTvShows = await enrichTvShowsWithDetails(fetchImpl, { token, baseUrl }, tvShows)
  const importSummary = await upsertTvShows(pool, enrichedTvShows)

  return {
    fetchedCount: enrichedTvShows.length,
    insertedCount: importSummary.insertedCount,
    updatedCount: importSummary.updatedCount,
    tvShows: enrichedTvShows,
  }
}

export async function hydrateTvShowByTmdbId(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, tvShowId, importRank = 1 } = options

  await ensureMoviesTable(pool)

  const detailPayload = await fetchTvDetails(fetchImpl, {
    token,
    baseUrl,
    tvShowId,
  })
  const sanitizedDetailPayload = sanitizeTvDetailPayload(detailPayload)
  const normalizedTvShow = normalizeDetailedTvShow(sanitizedDetailPayload, importRank)

  await syncMissingTvGenres(pool, fetchImpl, { token, baseUrl }, [normalizedTvShow])
  await upsertTvShows(pool, [
    {
      ...normalizedTvShow,
      detailPayload: sanitizedDetailPayload,
    },
  ])

  return {
    ...normalizedTvShow,
    detailPayload: sanitizedDetailPayload,
  }
}
