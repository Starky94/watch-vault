import {
  fetchAiringTodayTvShowsPage,
  fetchOnTheAirTvShowsPage,
  fetchPopularTvShowsPage,
  fetchTvDetails,
  fetchTvCredits,
  fetchTvGenres,
  fetchTvRecommendations,
  fetchTvSeason,
  fetchTvVideos,
} from './tmdbClient.js'
import { ensureMoviesTable, ensureTvDetailTables, listKnownTvGenreIds, replaceTvDetailRelations, upsertTvGenres, upsertTvShows } from './database.js'

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
  await ensureTvDetailTables(pool)

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

  const [creditsPayload, videosPayload, recommendationsPayload] = await Promise.all([
    fetchTvCredits(fetchImpl, { token, baseUrl, tvShowId }),
    fetchTvVideos(fetchImpl, { token, baseUrl, tvShowId }),
    fetchTvRecommendations(fetchImpl, { token, baseUrl, tvShowId }),
  ])
  const seasons = await Promise.all(
    (Array.isArray(detailPayload?.seasons) ? detailPayload.seasons : [])
      .filter((season) => Number.isInteger(season?.season_number) && season.season_number > 0)
      .map(async (season) => normalizeTvSeason(await fetchTvSeason(fetchImpl, { token, baseUrl, tvShowId, seasonNumber: season.season_number })))
  )
  await replaceTvDetailRelations(pool, tvShowId, {
    seasons,
    credits: normalizeTvCredits(creditsPayload),
    trailers: normalizeTvVideos(videosPayload),
    recommendations: normalizeTvRecommendations(recommendationsPayload),
  })

  return {
    ...normalizedTvShow,
    detailPayload: sanitizedDetailPayload,
  }
}

function normalizeTvSeason(payload) {
  return {
    tmdbId: payload?.id ?? null,
    seasonNumber: payload?.season_number,
    name: payload?.name,
    overview: payload?.overview ?? null,
    airDate: payload?.air_date ?? null,
    posterPath: payload?.poster_path ?? null,
    episodeCount: Array.isArray(payload?.episodes) ? payload.episodes.length : payload?.episode_count ?? 0,
    rawPayload: payload ?? {},
    episodes: (Array.isArray(payload?.episodes) ? payload.episodes : []).map((episode) => ({
      tmdbId: episode?.id ?? null,
      episodeNumber: episode?.episode_number,
      name: episode?.name,
      overview: episode?.overview ?? null,
      airDate: episode?.air_date ?? null,
      runtimeMinutes: episode?.runtime ?? null,
      stillPath: episode?.still_path ?? null,
      rawPayload: episode ?? {},
    })),
  }
}

function normalizeTvCredits(payload) {
  const cast = Array.isArray(payload?.cast) ? payload.cast.slice(0, 10) : []
  const crew = Array.isArray(payload?.crew) ? payload.crew.filter((credit) => ['Creator', 'Executive Producer'].includes(credit?.job)).slice(0, 3) : []
  return [...cast.map((credit, index) => ({ tmdbPersonId: credit.id, name: credit.name, profilePath: credit.profile_path, characterName: credit.character, billingOrder: credit.order ?? index, creditType: 'actor' })), ...crew.map((credit) => ({ tmdbPersonId: credit.id, name: credit.name, profilePath: credit.profile_path, department: credit.department, job: credit.job, creditType: 'crew' }))]
}

function normalizeTvVideos(payload) {
  return (Array.isArray(payload?.results) ? payload.results : [])
    .filter((video) => video?.site === 'YouTube' && video?.key)
    .map((video) => ({ provider: video.site, key: video.key, name: video.name || 'Trailer', site: video.site, type: video.type, official: Boolean(video.official) }))
}

function normalizeTvRecommendations(payload) {
  return (Array.isArray(payload?.results) ? payload.results : []).slice(0, 10).map((show, index) => ({ tmdbId: show.id, name: show.name || 'Untitled', firstAirDate: show.first_air_date ?? null, posterPath: show.poster_path ?? null, voteAverage: show.vote_average ?? null, displayOrder: index, rawPayload: show }))
}
