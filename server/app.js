import express from 'express'
import { loadConfig } from './config.js'
import {
  addMovieToWatchlistForUser,
  addNewsArticleLikeForUser,
  addNewsArticleSaveForUser,
  addMovieReleaseReminderForUser,
  addBookToWatchlistForUser,
  addBookToReadForUser,
  addMovieToWatchedForUser,
  countActors,
  countBooks,
  countGames,
  countMovies,
  countNewsArticles,
  countStoredDataBytes,
  countTvShows,
  getBookByGoogleBooksId,
  getAuthorById,
  getBookCommunityRating,
  ensureFavoriteActorsTable,
  ensureMovieKeywordTables,
  ensureAchievementTables,
  ensureNewsTables,
  ensureTvDetailTables,
  ensureMoviesTable,
  ensureBooksTable,
  evaluateAchievementsForUser,
  evaluateBookAchievementsForUser,
  getAchievementsForUser,
  getBookAchievementsForUser,
  findUserByCredentials,
  findUserByUsername,
  ensureSiteThemePreferencesTable,
  ensureAdminJobExecutionsTable,
  ensureRssSourcesTable,
  getActiveSiteTheme,
  getAdminJobLastExecutions,
  listRssSources,
  recordAdminJobExecution,
  updateRssSourceEnabled,
  saveActiveSiteTheme,
  ensureUserSectionPreferencesTable,
  getUserEnabledSections,
  saveUserEnabledSections,
  ensureFilelistTables,
  getFilelistCredentialStatus,
  getFilelistCredentials,
  saveFilelistCredentials,
  deleteFilelistCredentials,
  ensureIgdbCredentialsTable,
  ensureGamesTable,
  ensureGameTrackingTables,
  getGameTimeToBeat,
  getGameTrackingForUser,
  getGameActivityForUser,
  upsertGameTrackingForUser,
  addGameSessionForUser,
  getGameAchievementsForUser,
  evaluateGameAchievementsForUser,
  getIgdbCredentials,
  getIgdbCredentialStatus,
  saveIgdbCredentials,
  deleteIgdbCredentials,
  reserveFilelistRequest,
  listWatchTogetherUsers,
  listWatchTogetherWatchedMovieIdsForUser,
  getWatchTogetherStateForUser,
  getWatchTogetherStatsForUser,
  createWatchTogetherPartnerRequest,
  respondToWatchTogetherPartnerRequest,
  resetWatchTogetherPartnerForUser,
  addWatchTogetherItemForUser,
  removeWatchTogetherItemForUser,
  proposeWatchTogetherItemForUser,
  respondToWatchTogetherPickForUser,
  clearWatchTogetherSelectionForUser,
  isSelectedWatchTogetherMovieForUser,
  confirmWatchTogetherMovieForUser,
  confirmWatchTogetherEpisodeForUser,
  getWatchTogetherAchievementsForUser,
  evaluateWatchTogetherAchievementsForUser,
  saveWatchTogetherSessionForUser,
  getMovieStatsForUser,
  getBookStatsForUser,
  getStatsInsightsForUser,
  getMovieCommunityRating,
  getPersonFilmographyPersonalStates,
  getPersonHistoryForUser,
  getTvLibraryForUser,
  getTvDetailForUser,
  getTvStatsForUser,
  getTvShowByTmdbId,
  getFilelistTvEpisodeTargetForUser,
  getMovieByTmdbId,
  hasMovieReleaseReminderForUser,
  listCoStarsForPerson,
  listFavoriteActorsForUser,
  listFavoriteAuthorsForUser,
  listAuthorsForBook,
  listBooksForAuthor,
  listGenres,
  listMovieSummariesByTmdbIds,
  listNewsArticles,
  listNewsFilterOptions,
  removeNewsArticleLikeForUser,
  removeNewsArticleSaveForUser,
  searchActors,
  searchBooks,
  searchGames,
  searchMovies,
  searchTvShows,
  listWatchlistMoviesForUser,
  listWatchlistBooksForUser,
  setWatchlistPriorityForUser,
  listReadBooksForUser,
  listCalendarEventsForUser,
  listWatchedMoviesByGenreForUser,
  listWatchedMoviesForUser,
  listMovies,
  listPopularGames,
  listRecentlyReleasedGames,
  listUpcomingGames,
  listPlayedGamesForUser,
  listSimilarGames,
  getGameByIgdbId,
  getGameCommunityRating,
  getGamePersonalState,
  addGameToPlayedForUser,
  removeGameFromPlayedForUser,
  upsertGameRatingForUser,
  upsertGameTimeToBeat,
  listMovieKeywordSuggestions,
  listDiscoverExcludedTmdbIdsForUser,
  listBooks,
  listRecentlyReleasedMovies,
  listRecentlyAiredTvShows,
  listLatestEpisodeTvShows,
  listAlertsForUser,
  countUnreadAlertsForUser,
  markAlertsReadForUser,
  recordAchievementEventForUser,
  recordBookAchievementEventForUser,
  removeMovieFromWatchedForUser,
  removeMovieFromWatchlistForUser,
  removeMovieReleaseReminderForUser,
  removeBookFromWatchlistForUser,
  removeBookFromReadForUser,
  listSimilarMovies,
  listTopRatedTvShows,
  listTopRatedMovies,
  listTvShows,
  listContinueWatchingTvShowsForUser,
  listWatchedTvEpisodesForUser,
  listTvWatchlistShowsForUser,
  syncPersonProfile,
  updateUserPassword,
  upsertMovieRatingForUser,
  upsertTvEpisodeRatingForUser,
  toggleTvLibraryItemForUser,
  updateTvEpisodeWatchStateForUser,
  listUpcomingTvShows,
  listUpcomingMovies,
  toggleFavoriteActorForUser,
  toggleFavoriteAuthorForUser,
  updateUserAlertTimezone,
  upsertBooks,
  upsertBookRatingForUser,
} from './database.js'
import { adminJobs, findAdminJob, listAdminJobs } from './adminJobs.js'
import { discoverMoviesByKeyword, discoverTitles, fetchMovieReviews, fetchMovieVideos, fetchPersonCombinedCredits, fetchPersonDetails, fetchTvReviews, searchMovieKeywords, searchMovies as searchTmdbMovies, searchPeople, searchTvShows as searchTmdbTvShows } from './tmdbClient.js'
import { hydrateMovieByTmdbId } from './movieImportService.js'
import { hydrateGameByIgdbId } from './gameImportService.js'
import { hydrateTvShowByTmdbId } from './tvImportService.js'
import { normalizeBook, sanitizeBookDescription } from './bookImportService.js'
import { fetchBookById, fetchRelatedBooksByCategory, searchBooksByTitle } from './googleBooksClient.js'
import { buildFilelistSearchUrl, buildFilelistTvEpisodeQuery, decryptFilelistValue, encryptFilelistValue, mapFilelistResults } from './filelist.js'
import { fetchIgdbAccessToken, igdbRequest } from './igdbClient.js'
import { getSeasonalTheme, isAvailableTheme } from '../shared/themes.js'
import { entertainmentNewsSourceKeys } from './rssSources.js'

const bookReadingFormats = new Set(['physical', 'ebook', 'audiobook'])
const gameStatuses = new Set(['played', 'backlog', 'playing', 'dropped', 'completed'])
const gameDifficulties = new Set(['easy', 'normal', 'hard', 'highest'])
const gameModes = new Set(['solo', 'coop', 'versus'])
const gameLocations = new Set(['local', 'online'])
const gameMetadataKeys = new Set(['detective', 'narrative_adventure', 'builder', 'tactics', 'roguelike_run', 'indie', 'all_genres', 'no_assists', 'no_damage_boss', 'one_life', 'all_platform_trophies', 'platinum', 'all_collectibles', 'all_side_quests', 'all_optional_objectives', 'secret_ending', 'returned_from_abandoned', 'second_chance', 'oldest_library_game', 'coop', 'four_player_completion', 'local_coop', 'outside_comfort_zone', 'random_pick', 'recommendation', 'full_saga', 'console_generations', 'side_content_majority', 'no_main_progress_10h', 'strategy_session_4h', 'customization', 'map_complete', 'bad_ending', 'good_ending', 'credits', 'completion_after_50_deaths', 'comeback_90_days', 'touch_grass', 'two_am_boss', 'random_three_streak', 'plot_twist', 'five_starts_before_completion', 'rerated_up', 'completed_initially_low', 'wishlist_high_rating', 'no_guide', 'birthday'])
const gameMetadataNumberKeys = new Set(['ending_count', 'death_count', 'screenshot_count', 'character_sidequests', 'guide_interactions', 'developer_countries'])

function normalizeGameMetadata(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const tags = source.tags && typeof source.tags === 'object' && !Array.isArray(source.tags) ? source.tags : source
  const normalizedTags = {}
  for (const key of gameMetadataKeys) if (tags[key] === true) normalizedTags[key] = true
  for (const key of gameMetadataNumberKeys) if (Number.isInteger(tags[key]) && tags[key] >= 0 && tags[key] <= 100000) normalizedTags[key] = tags[key]
  const moods = Array.isArray(source.moods) ? [...new Set(source.moods.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim().slice(0, 40)))].slice(0, 20) : []
  return { tags: normalizedTags, ...(moods.length ? { moods } : {}) }
}

function parseGameTrackingPayload(body = {}) {
  const status = typeof body.status === 'string' ? body.status : 'played'
  if (!gameStatuses.has(status)) return null
  const parseDate = (value) => value === null || value === undefined || value === '' ? null : Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : undefined
  const libraryAddedAt = parseDate(body.libraryAddedAt); const startedAt = parseDate(body.startedAt); let completedAt = parseDate(body.completedAt)
  if ([libraryAddedAt, startedAt, completedAt].includes(undefined)) return null
  if (status === 'completed' && !completedAt) completedAt = new Date().toISOString()
  const integer = (value, minimum, maximum) => value === null || value === undefined || value === '' ? null : Number.isInteger(value) && value >= minimum && value <= maximum ? value : undefined
  const completionPercent = integer(body.completionPercent, 0, 100); const playtimeMinutes = integer(body.playtimeMinutes, 0, 10000000); const difficultyRating = integer(body.difficultyRating, 1, 5)
  if ([completionPercent, playtimeMinutes, difficultyRating].includes(undefined)) return null
  const platform = typeof body.platform === 'string' && body.platform.trim() ? body.platform.trim().slice(0, 80) : null
  const difficulty = typeof body.difficulty === 'string' && body.difficulty.trim() ? body.difficulty.trim().toLowerCase() : null
  if (difficulty && !gameDifficulties.has(difficulty)) return null
  const review = typeof body.review === 'string' ? body.review.trim().slice(0, 10000) : null
  return { status, libraryAddedAt, startedAt, completedAt, platform, difficulty, difficultyRating, completionPercent, playtimeMinutes, review, metadata: normalizeGameMetadata(body.metadata) }
}

function parseGameSessionPayload(body = {}) {
  const durationMinutes = Number(body.durationMinutes); const mode = typeof body.mode === 'string' ? body.mode : 'solo'; const location = body.location === null || body.location === undefined || body.location === '' ? null : body.location
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10080 || !gameModes.has(mode) || (location && !gameLocations.has(location))) return null
  const occurredAt = body.occurredAt === undefined || body.occurredAt === null || body.occurredAt === '' ? new Date().toISOString() : Number.isFinite(new Date(body.occurredAt).getTime()) ? new Date(body.occurredAt).toISOString() : null
  if (!occurredAt) return null
  return { occurredAt, durationMinutes, mode, location, coplayer: typeof body.coplayer === 'string' && body.coplayer.trim() ? body.coplayer.trim().slice(0, 80) : null, metadata: normalizeGameMetadata(body.metadata) }
}

function sanitizeStoredBookDescription(book) {
  return book ? { ...book, description: sanitizeBookDescription(book.description) } : book
}

export async function createApp(pool, options = {}) {
  const {
    jobs = adminJobs,
    hydrateMovie = hydrateMovieByTmdbId,
    hydrateGame = hydrateGameByIgdbId,
    hydrateTvShow = hydrateTvShowByTmdbId,
    fetchImpl = fetch,
    loadRuntimeConfig = () =>
      loadConfig({
        requireDatabase: false,
        requireTmdbToken: true,
      }),
  } = options

  async function hydrateMissingMovie(movieId) {
    const config = loadRuntimeConfig()
    await hydrateMovie(pool, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, movieId, importRank: 1 })
  }

  async function hydrateMissingTvShow(showId) {
    const config = loadRuntimeConfig()
    await hydrateTvShow(pool, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, tvShowId: showId, importRank: 1 })
  }

  async function hydrateMissingGame(gameId) {
    await ensureIgdbCredentialsTable(pool)
    const credentials = await getIgdbCredentials(pool)
    if (!credentials) return null
    const config = loadRuntimeConfig()
    return hydrateGame(pool, {
      fetchImpl,
      clientId: decryptFilelistValue(credentials.encrypted_client_id, config.filelistEncryptionKey),
      clientSecret: decryptFilelistValue(credentials.encrypted_private_key, config.filelistEncryptionKey),
      baseUrl: config.igdbBaseUrl,
      tokenUrl: config.twitchTokenUrl,
      gameId,
      importRank: 1,
    })
  }

  async function getGameTimeToBeatWithFallback(gameId) {
    try {
      const cached = await getGameTimeToBeat(pool, gameId)
      if (cached) return mapGameTimeToBeat(cached)

      await ensureIgdbCredentialsTable(pool)
      const credentials = await getIgdbCredentials(pool)
      if (!credentials) return null

      const config = loadRuntimeConfig()
      const clientId = decryptFilelistValue(credentials.encrypted_client_id, config.filelistEncryptionKey)
      const clientSecret = decryptFilelistValue(credentials.encrypted_private_key, config.filelistEncryptionKey)
      const accessToken = await fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl: config.twitchTokenUrl })
      const values = await igdbRequest(fetchImpl, {
        clientId,
        accessToken,
        baseUrl: config.igdbBaseUrl,
        path: 'game_time_to_beats',
        body: `fields game_id,hastily,normally,completely; where game_id = ${gameId}; limit 1;`,
      })
      const value = Array.isArray(values) ? values.find((entry) => Number(entry?.game_id) === gameId) : null
      if (!value) return null
      const saved = await upsertGameTimeToBeat(pool, {
        gameId,
        hastily: normalizeGameTimeToBeatSeconds(value.hastily),
        normally: normalizeGameTimeToBeatSeconds(value.normally),
        completely: normalizeGameTimeToBeatSeconds(value.completely),
      })
      return mapGameTimeToBeat(saved ?? value)
    } catch {
      return null
    }
  }

  await ensureMoviesTable(pool)
  await ensureNewsTables(pool)
  await ensureMovieKeywordTables(pool)
  await ensureBooksTable(pool)
  await ensureGamesTable(pool)
  await ensureTvDetailTables(pool)
  await ensureAchievementTables(pool)
  await ensureSiteThemePreferencesTable(pool)
  await ensureAdminJobExecutionsTable(pool)
  await ensureRssSourcesTable(pool)
  await ensureUserSectionPreferencesTable(pool)

  const app = express()
  app.use(express.json())

  app.get('/api/health', async (_request, response) => {
    response.json({ ok: true })
  })

  app.get('/api/theme', async (_request, response, next) => {
    try {
      response.json({ activeTheme: await getActiveSiteTheme(pool) })
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/admin/theme', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const activeTheme = request.body?.activeTheme
      if (!isAvailableTheme(activeTheme)) {
        return response.status(400).json({ error: 'The selected theme is not available.' })
      }
      response.json({ activeTheme: await saveActiveSiteTheme(pool, { activeTheme, updatedByUserId: user.id }) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/achievements', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const [achievements, watchTogetherAchievements] = await Promise.all([getAchievementsForUser(pool, user.username), getWatchTogetherAchievementsForUser(pool, user.username)])
      response.json({ count: achievements.length + watchTogetherAchievements.length, achievements: [...achievements, ...watchTogetherAchievements] })
    } catch (error) { next(error) }
  })

  app.get('/api/book-achievements', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const achievements = await getBookAchievementsForUser(pool, user.username)
      response.json({ count: achievements.length, achievements })
    } catch (error) { next(error) }
  })

  app.get('/api/genres', async (_request, response, next) => {
    try {
      const genres = await listGenres(pool)

      response.json({
        count: genres.length,
        genres: genres.map((genre) => ({
          id: genre.tmdb_genre_id,
          name: genre.name,
          movieCount: genre.movie_count,
        })),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/search', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''

    if (!query) {
      response.status(400).json({ error: 'q is required' })
      return
    }

    try {
      const [movies, shows, actors, books, games] = await Promise.all([
        searchMovies(pool, query),
        searchTvShows(pool, query),
        searchActors(pool, query),
        searchBooks(pool, query),
        searchGames(pool, query),
      ])

      response.json({ query, movies, shows, actors, books, games })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/search/suggestions', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''
    if (query.length < 2) return response.status(400).json({ error: 'q must be at least 2 characters' })

    try {
      const [movies, shows, books, people] = await Promise.all([
        searchMovies(pool, query, 4),
        searchTvShows(pool, query, 4),
        searchBooks(pool, query, 4),
        searchActors(pool, query, 4),
      ])
      const titles = [
        ...movies.map(mapMovieSearchSuggestion),
        ...shows.map(mapTvSearchSuggestion),
        ...books.map(mapBookSearchSuggestion),
      ].sort((left, right) => right.popularity - left.popularity || left.label.localeCompare(right.label)).slice(0, 8)
      response.json({ query, titles, people: people.map(mapPersonSearchSuggestion) })
    } catch (error) { next(error) }
  })

  app.get('/api/search/popular', async (_request, response, next) => {
    try {
      const [movies, shows] = await Promise.all([listMovies(pool, { limit: 5 }), listTvShows(pool, { limit: 5 })])
      const titles = [...movies.map(mapMovieSearchSuggestion), ...shows.map(mapTvSearchSuggestion)]
        .sort((left, right) => right.popularity - left.popularity || left.label.localeCompare(right.label))
        .slice(0, 8)
      response.json({ titles })
    } catch (error) { next(error) }
  })

  app.get('/api/search/alternatives', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''
    if (query.length < 2) return response.status(400).json({ error: 'q must be at least 2 characters' })
    try {
      const [movies, shows, books, people] = await Promise.all([
        pool.query('SELECT title AS label FROM movies WHERE title IS NOT NULL ORDER BY popularity DESC NULLS LAST, title ASC LIMIT 200'),
        pool.query('SELECT name AS label FROM tv_shows WHERE name IS NOT NULL ORDER BY popularity DESC NULLS LAST, name ASC LIMIT 200'),
        pool.query('SELECT title AS label FROM books WHERE title IS NOT NULL ORDER BY import_rank ASC, title ASC LIMIT 200'),
        pool.query('SELECT name AS label FROM cast_members WHERE name IS NOT NULL ORDER BY popularity DESC NULLS LAST, name ASC LIMIT 200'),
      ])
      const labels = [...movies.rows, ...shows.rows, ...books.rows, ...people.rows].map((row) => row.label).filter(Boolean)
      response.json({ query, alternatives: findSearchAlternatives(query, labels) })
    } catch (error) { next(error) }
  })

  app.get('/api/search/tmdb', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''

    if (!query) {
      response.status(400).json({ error: 'q is required' })
      return
    }

    try {
      const config = loadRuntimeConfig()
      const [moviePayload, tvPayload] = await Promise.all([
        searchTmdbMovies(fetch, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, query }),
        searchTmdbTvShows(fetch, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, query }),
      ])

      response.json({
        query,
        movies: (Array.isArray(moviePayload?.results) ? moviePayload.results : []).slice(0, 20).map(mapTmdbMovieSearchResult),
        shows: (Array.isArray(tvPayload?.results) ? tvPayload.results : []).slice(0, 20).map(mapTmdbTvSearchResult),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/seasonal-movies', async (_request, response, next) => {
    try {
      const activeTheme = await getActiveSiteTheme(pool)
      const theme = getSeasonalTheme(activeTheme)
      const keyword = theme?.tmdbKeyword

      if (!keyword) {
        return response.status(404).json({ error: 'No seasonal movie collection is active.' })
      }

      const config = loadRuntimeConfig()
      const keywordPayload = await searchMovieKeywords(fetch, {
        token: config.tmdbBearerToken,
        baseUrl: config.tmdbBaseUrl,
        query: keyword,
      })
      const keywordId = (Array.isArray(keywordPayload?.results) ? keywordPayload.results : [])
        .find((item) => Number.isInteger(item?.id) && String(item?.name || '').trim().toLocaleLowerCase() === keyword.toLocaleLowerCase())?.id

      if (!keywordId) {
        return response.status(404).json({ error: `TMDB does not have a matching keyword for ${theme.name}.` })
      }

      const moviesPayload = await discoverMoviesByKeyword(fetch, {
        token: config.tmdbBearerToken,
        baseUrl: config.tmdbBaseUrl,
        keywordId,
      })
      const includedIds = new Set()
      const movies = []
      for (const movie of Array.isArray(moviesPayload?.results) ? moviesPayload.results : []) {
        if (!Number.isInteger(movie?.id) || includedIds.has(movie.id)) continue
        includedIds.add(movie.id)
        movies.push(mapTmdbMovieSearchResult(movie))
        if (movies.length === 20) break
      }

      response.json({
        theme: { key: theme.key, name: theme.name, emoji: theme.emoji },
        movies,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/search/igdb', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''
    if (!query) return response.status(400).json({ error: 'q is required' })

    try {
      await ensureIgdbCredentialsTable(pool)
      const credentials = await getIgdbCredentials(pool)
      if (!credentials) return response.status(409).json({ error: 'IGDB credentials have not been configured in Admin settings.' })

      const config = loadRuntimeConfig()
      const clientId = decryptFilelistValue(credentials.encrypted_client_id, config.filelistEncryptionKey)
      const clientSecret = decryptFilelistValue(credentials.encrypted_private_key, config.filelistEncryptionKey)
      const accessToken = await fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl: config.twitchTokenUrl })
      const escapedQuery = query.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      const games = await igdbRequest(fetchImpl, {
        clientId,
        accessToken,
        baseUrl: config.igdbBaseUrl,
        path: 'games',
        body: `search "${escapedQuery}"; fields id,name,summary,first_release_date,rating,aggregated_rating,cover.image_id; limit 20;`,
      })
      response.json({ query, games: (Array.isArray(games) ? games : []).slice(0, 20).map(mapIgdbGameSearchResult) })
    } catch (error) { next(error) }
  })

  app.get('/api/discover/actors', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''
    if (!query) return response.status(400).json({ error: 'q is required' })

    try {
      const config = loadRuntimeConfig()
      const payload = await searchPeople(fetch, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, query })
      response.json({ query, actors: (Array.isArray(payload?.results) ? payload.results : []).filter((person) => Number.isInteger(person?.id)).slice(0, 10).map(mapTmdbPersonSuggestion) })
    } catch (error) { next(error) }
  })

  app.get('/api/discover/keywords', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''
    if (!query) return response.status(400).json({ error: 'q is required' })

    try {
      const keywords = await listMovieKeywordSuggestions(pool, query)
      response.json({ query, keywords: keywords.map(mapStoredKeywordSuggestion) })
    } catch (error) { next(error) }
  })

  app.get('/api/discover', async (request, response, next) => {
    const mediaType = request.query.type === 'tv' ? 'tv' : request.query.type === 'movie' ? 'movie' : null
    const runtime = request.query.runtime === 'short' || request.query.runtime === 'long' ? request.query.runtime : null
    const actorId = parseOptionalDiscoverId(request.query.actorId)
    const keywordIds = parseDiscoverKeywordIds(request.query.keywordIds)

    if (!mediaType) return response.status(400).json({ error: 'type must be movie or tv' })
    if (!runtime) return response.status(400).json({ error: 'runtime must be short or long' })
    if (request.query.actorId !== undefined && actorId === null) return response.status(400).json({ error: 'actorId must be a positive integer' })
    if (keywordIds === null) return response.status(400).json({ error: 'keywordIds must contain up to three positive integer IDs' })

    try {
      const user = await getAuthenticatedUser(pool, request)
      const excludedIds = user ? await listDiscoverExcludedTmdbIdsForUser(pool, user.username, mediaType) : new Set()
      const config = loadRuntimeConfig()
      const mapper = mediaType === 'movie' ? mapTmdbMovieSearchResult : mapTmdbTvSearchResult
      const results = []
      const includedIds = new Set()

      for (let page = 1; page <= 3 && results.length < 10; page += 1) {
        const payload = await discoverTitles(fetch, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, mediaType, runtime, actorId, keywordIds, page })
        const pageResults = Array.isArray(payload?.results) ? payload.results : []
        for (const item of pageResults) {
          if (!Number.isInteger(item?.id) || excludedIds.has(item.id) || includedIds.has(item.id)) continue
          includedIds.add(item.id)
          results.push(mapper(item))
          if (results.length === 10) break
        }
        if (!pageResults.length || page >= Number(payload?.total_pages ?? 1)) break
      }
      response.json({ type: mediaType, results })
    } catch (error) { next(error) }
  })

  app.get('/api/search/books', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''
    if (!query) return response.status(400).json({ error: 'q is required' })

    try {
      const config = loadRuntimeConfig()
      if (!config.googleBooksApiKey) throw new Error('Missing required environment variable: GOOGLE_BOOKS_API_KEY')
      const payload = await searchBooksByTitle(fetch, {
        apiKey: config.googleBooksApiKey,
        baseUrl: config.googleBooksBaseUrl,
        query,
        maxResults: 20,
      })
      const books = (Array.isArray(payload?.items) ? payload.items : [])
        .filter((volume) => volume?.id)
        .slice(0, 20)
        .map((volume, index) => normalizeBook(volume, index + 1))
      response.json({ query, books })
    } catch (error) { next(error) }
  })

  app.post('/api/auth/login', async (request, response) => {
    const username = typeof request.body?.username === 'string' ? request.body.username.trim() : ''
    const password = typeof request.body?.password === 'string' ? request.body.password : ''

    const user = await findUserByCredentials(pool, { username, password })

    if (!user) {
      response.status(401).json({
        error: 'Invalid username or password',
      })
      return
    }

    response.json({
      user: {
        username: user.username,
        fullName: user.full_name,
      },
    })
  })

  app.post('/api/auth/change-password', async (request, response, next) => {
    const currentPassword = typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : ''
    const newPassword = typeof request.body?.newPassword === 'string' ? request.body.newPassword : ''
    const confirmPasswordProvided = typeof request.body?.confirmPassword === 'string'
    const confirmPassword = confirmPasswordProvided ? request.body.confirmPassword : ''

    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      if (!currentPassword) {
        response.status(400).json({
          error: 'Current password is required',
        })
        return
      }

      if (!newPassword.trim()) {
        response.status(400).json({
          error: 'New password is required',
        })
        return
      }

      if (newPassword === currentPassword) {
        response.status(400).json({
          error: 'New password must be different from your current password',
        })
        return
      }

      if (confirmPasswordProvided && confirmPassword !== newPassword) {
        response.status(400).json({
          error: 'New password confirmation does not match',
        })
        return
      }

      const updatedUser = await updateUserPassword(pool, {
        username: user.username,
        currentPassword,
        newPassword,
      })

      if (!updatedUser) {
        response.status(401).json({
          error: 'Current password is incorrect',
        })
        return
      }

      response.status(200).json({
        message: 'Password changed successfully',
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/watch-together', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const [state, users] = await Promise.all([
        getWatchTogetherStateForUser(pool, user.username),
        listWatchTogetherUsers(pool, user.username),
      ])
      response.json({
        partner: state.partner ? mapWatchTogetherUser(state.partner) : null,
        pendingRequest: state.pendingRequest ? { id: state.pendingRequest.id, direction: state.pendingRequest.direction, user: mapWatchTogetherUser(state.pendingRequest.user) } : null,
        users: users.map(mapWatchTogetherUser),
        items: state.items.map(mapWatchTogetherItem),
        watchedMovies: state.watchedMovies.map(mapWatchedTogetherMovie),
        watchedEpisodes: state.watchedEpisodes.map(mapWatchedTogetherEpisode),
        inProgressShows: state.inProgressShows.map(mapWatchTogetherInProgressShow),
      })
    } catch (error) { next(error) }
  })

  app.get('/api/watch-together/achievements', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const achievements = await getWatchTogetherAchievementsForUser(pool, user.username)
      response.json({ count: achievements.length, achievements })
    } catch (error) { next(error) }
  })

  app.get('/api/watch-together/stats', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const timeZone = readStatsTimeZone(request, response)
      if (!timeZone) return
      const stats = await getWatchTogetherStatsForUser(pool, user.username, { timeZone })
      if (stats.status === 'no_pair') return response.status(409).json({ error: 'No active partner connection' })
      response.json(mapWatchTogetherStats(stats))
    } catch (error) { next(error) }
  })

  app.post('/api/watch-together/sessions', async (request, response, next) => {
    const mediaType = request.body?.mediaType
    const mediaId = Number.parseInt(request.body?.mediaId, 10)
    const episodeId = request.body?.episodeId === null || request.body?.episodeId === undefined ? null : Number.parseInt(request.body.episodeId, 10)
    const achievementIds = Array.isArray(request.body?.achievementIds) ? request.body.achievementIds.filter((id) => typeof id === 'string') : []
    const details = request.body?.details && typeof request.body.details === 'object' && !Array.isArray(request.body.details) ? request.body.details : {}
    if (!['movie', 'tv'].includes(mediaType) || !Number.isInteger(mediaId) || (mediaType === 'tv' && !Number.isInteger(episodeId))) return response.status(400).json({ error: 'A completed shared movie or episode is required' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await saveWatchTogetherSessionForUser(pool, { username: user.username, mediaType, mediaId, episodeId, achievementIds, details })
      if (result.status === 'no_pair') return response.status(409).json({ error: 'No active partner connection' })
      if (result.status === 'missing_history') return response.status(409).json({ error: 'Session details can only be logged for a completed shared title' })
      response.json({ saved: true, newlyUnlockedAchievements: result.newlyUnlockedAchievements })
    } catch (error) { next(error) }
  })

  app.post('/api/watch-together/requests', async (request, response, next) => {
    const partnerUsername = typeof request.body?.username === 'string' ? request.body.username.trim() : ''
    if (!partnerUsername) return response.status(400).json({ error: 'username is required' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      if (partnerUsername === user.username) return response.status(400).json({ error: 'You cannot select yourself as a partner' })
      const result = await createWatchTogetherPartnerRequest(pool, { username: user.username, partnerUsername })
      if (result.status === 'same_user') return response.status(400).json({ error: 'You cannot select yourself as a partner' })
      if (result.status === 'missing_partner') return response.status(404).json({ error: 'Selected user was not found' })
      if (result.status === 'already_paired') return response.status(409).json({ error: 'Both users must be unpaired before sending a request' })
      if (result.status === 'pending_request') return response.status(409).json({ error: 'One of these users already has a pending Watch Together request' })
      if (result.status !== 'ok') return response.status(401).json({ error: 'Authentication required' })
      response.status(201).json({ pendingRequest: { id: result.request.id, direction: result.request.direction, user: mapWatchTogetherUser(result.request.user) } })
    } catch (error) { next(error) }
  })

  app.post('/api/watch-together/requests/:requestId/respond', async (request, response, next) => {
    const requestId = Number.parseInt(request.params.requestId, 10)
    const decision = request.body?.decision
    if (!Number.isInteger(requestId) || !['accept', 'deny'].includes(decision)) return response.status(400).json({ error: 'A valid request and decision are required' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await respondToWatchTogetherPartnerRequest(pool, { username: user.username, requestId, decision })
      if (result.status === 'missing_request') return response.status(404).json({ error: 'Watch Together request was not found' })
      if (result.status === 'not_pending') return response.status(409).json({ error: 'This Watch Together request has already been handled' })
      if (result.status === 'already_paired') return response.status(409).json({ error: 'One of these users is already paired' })
      response.json({ status: result.status })
    } catch (error) { next(error) }
  })

  app.delete('/api/watch-together/partner', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await resetWatchTogetherPartnerForUser(pool, user.username)
      if (result.status === 'no_pair') return response.status(409).json({ error: 'No active partner connection' })
      response.json({ reset: true })
    } catch (error) { next(error) }
  })

  app.get('/api/watch-together/search', async (request, response, next) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : ''
    const mediaType = typeof request.query.type === 'string' ? request.query.type.trim() : 'all'
    if (!query) return response.status(400).json({ error: 'q is required' })
    if (!['all', 'movie', 'tv'].includes(mediaType)) return response.status(400).json({ error: 'type must be all, movie, or tv' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const [movies, shows] = await Promise.all([
        mediaType === 'tv' ? [] : searchMovies(pool, query, 20),
        mediaType === 'movie' ? [] : searchTvShows(pool, query, 20),
      ])
      const watchedMovieIds = await listWatchTogetherWatchedMovieIdsForUser(pool, { username: user.username, movieIds: movies.map((movie) => Number(movie.tmdb_id)) })
      response.json({ items: [...movies.filter((movie) => !watchedMovieIds.has(Number(movie.tmdb_id))).map(mapWatchTogetherMovie), ...shows.map(mapWatchTogetherTvShow)] })
    } catch (error) { next(error) }
  })

  app.post('/api/watch-together/items', async (request, response, next) => {
    const mediaType = request.body?.mediaType
    const mediaId = Number.parseInt(request.body?.mediaId, 10)
    if (!['movie', 'tv'].includes(mediaType) || !Number.isInteger(mediaId)) return response.status(400).json({ error: 'mediaType and mediaId are required' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      if (mediaType === 'tv') {
        const show = await getTvShowByTmdbId(pool, mediaId)
        if (!show) return response.status(404).json({ error: 'Title was not found' })
        if (!show.detail_hydrated_at) {
          const config = loadRuntimeConfig()
          await hydrateTvShow(pool, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, tvShowId: mediaId, importRank: show.import_rank ?? 1 })
        }
      }
      const result = await addWatchTogetherItemForUser(pool, { username: user.username, mediaType, mediaId })
      if (result.status === 'no_pair') return response.status(409).json({ error: 'Choose a partner before adding titles' })
      if (result.status === 'missing_media') return response.status(404).json({ error: 'Title was not found' })
      if (result.status === 'already_watched') return response.status(409).json({ error: 'This movie has already been watched by you or your partner.' })
      if (result.status === 'progress_mismatch') return response.status(409).json({ error: `Progress must match before sharing an episode. @${result.behindUsername} is behind on this show.` })
      if (result.status === 'no_next_episode') return response.status(409).json({ error: 'This show has no unwatched aired episode available to add.' })
      response.json({ added: result.added })
    } catch (error) { next(error) }
  })

  app.post('/api/watch-together/episodes/:episodeId/watched', async (request, response, next) => {
    const episodeId = Number.parseInt(request.params.episodeId, 10)
    if (!Number.isInteger(episodeId)) return response.status(400).json({ error: 'episodeId must be valid' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await confirmWatchTogetherEpisodeForUser(pool, { username: user.username, episodeId, watchService: request.body?.watchService })
      if (result.status === 'no_pair') return response.status(409).json({ error: 'No active partner connection' })
      if (result.status === 'not_selected') return response.status(409).json({ error: 'Only the accepted shared episode can be marked watched together' })
      if (result.status === 'already_watched') return response.status(409).json({ error: 'You already watched this episode independently. Remove it and add the show again to choose the new next episode.' })
      if (result.updatedCount > 0) await recordAchievementEventForUser(pool, { username: user.username, eventType: 'tv_episode_watched', mediaType: 'tv', entityId: episodeId, baselineKind: 'tv_episode_watch' })
      if (result.newlyCompletedShowId) await recordAchievementEventForUser(pool, { username: user.username, eventType: 'tv_show_completed', mediaType: 'tv', entityId: result.newlyCompletedShowId, baselineKind: 'tv_show' })
      const newlyUnlockedAchievements = result.updatedCount > 0 || result.newlyCompletedShowId ? await evaluateAchievementsForUser(pool, user.username) : []
      const newlyUnlockedWatchTogetherAchievements = result.status === 'completed' ? await evaluateWatchTogetherAchievementsForUser(pool, user.username) : []
      response.json({ watchTogether: result, newlyUnlockedAchievements: [...newlyUnlockedAchievements, ...newlyUnlockedWatchTogetherAchievements] })
    } catch (error) { next(error) }
  })

  app.delete('/api/watch-together/items/:mediaType/:mediaId', async (request, response, next) => {
    const mediaType = request.params.mediaType
    const mediaId = Number.parseInt(request.params.mediaId, 10)
    if (!['movie', 'tv'].includes(mediaType) || !Number.isInteger(mediaId)) return response.status(400).json({ error: 'Invalid title' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await removeWatchTogetherItemForUser(pool, { username: user.username, mediaType, mediaId })
      if (result.status === 'no_pair') return response.status(409).json({ error: 'No active partner connection' })
      if (result.status === 'active_pick') return response.status(409).json({ error: 'Clear or resolve this Tonight’s pick before removing it' })
      response.json({ removed: result.removed })
    } catch (error) { next(error) }
  })

  app.put('/api/watch-together/selection', async (request, response, next) => {
    const mediaType = request.body?.mediaType
    const mediaId = Number.parseInt(request.body?.mediaId, 10)
    if (!['movie', 'tv'].includes(mediaType) || !Number.isInteger(mediaId)) return response.status(400).json({ error: 'mediaType and mediaId are required' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await proposeWatchTogetherItemForUser(pool, { username: user.username, mediaType, mediaId })
      if (result.status === 'no_pair') return response.status(409).json({ error: 'No active partner connection' })
      if (result.status === 'missing_item') return response.status(404).json({ error: 'Title is not in this shared shortlist' })
      if (result.status === 'active_pick') return response.status(409).json({ error: 'Resolve the current Tonight’s pick before proposing another title' })
      response.json({ proposed: true })
    } catch (error) { next(error) }
  })

  app.post('/api/watch-together/selection/:mediaType/:mediaId/respond', async (request, response, next) => {
    const mediaType = request.params.mediaType
    const mediaId = Number.parseInt(request.params.mediaId, 10)
    const decision = request.body?.decision
    if (!['movie', 'tv'].includes(mediaType) || !Number.isInteger(mediaId) || !['accept', 'deny'].includes(decision)) return response.status(400).json({ error: 'A valid title and decision are required' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await respondToWatchTogetherPickForUser(pool, { username: user.username, mediaType, mediaId, decision })
      if (result.status === 'no_pair') return response.status(409).json({ error: 'No active partner connection' })
      if (result.status === 'missing_proposal') return response.status(404).json({ error: 'This pick proposal is no longer available' })
      if (result.status === 'proposer_cannot_vote') return response.status(403).json({ error: 'Only your partner can vote on this proposal' })
      response.json({ status: result.status })
    } catch (error) { next(error) }
  })

  app.delete('/api/watch-together/selection', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await clearWatchTogetherSelectionForUser(pool, user.username)
      if (result.status === 'no_pair') return response.status(409).json({ error: 'No active partner connection' })
      if (result.status === 'no_active_pick') return response.status(404).json({ error: 'There is no active Tonight’s pick' })
      if (result.status === 'not_proposer') return response.status(403).json({ error: 'Only the proposer can cancel a pending pick' })
      response.json({ cleared: true })
    } catch (error) { next(error) }
  })

  app.get('/api/watchlist', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const [movies, books, tvShows] = await Promise.all([
        listWatchlistMoviesForUser(pool, user.username),
        listWatchlistBooksForUser(pool, user.username),
        listTvWatchlistShowsForUser(pool, user.username),
      ])

      response.json({
        count: movies.length + books.length + tvShows.length,
        movies: movies.map(mapWatchlistMovie),
        books: books.map(mapWatchlistBook),
        tvShows: tvShows.map(mapWatchlistTvShow),
      })
    } catch (error) {
      next(error)
    }
  })

  app.patch('/api/watchlist/priority', async (request, response, next) => {
    const mediaType = typeof request.body?.mediaType === 'string' ? request.body.mediaType.trim() : ''
    const mediaId = request.body?.mediaId === undefined || request.body?.mediaId === null ? '' : String(request.body.mediaId).trim()
    const topSlot = Object.hasOwn(request.body ?? {}, 'topSlot') ? request.body.topSlot : undefined
    const queuePosition = Object.hasOwn(request.body ?? {}, 'queuePosition') ? request.body.queuePosition : undefined
    if (!mediaId || (!['movie', 'tv', 'book'].includes(mediaType)) || (topSlot === undefined && queuePosition === undefined)) return response.status(400).json({ error: 'mediaType, mediaId, and a priority change are required' })
    if (topSlot !== undefined && topSlot !== null && !Number.isInteger(topSlot)) return response.status(400).json({ error: 'topSlot must be 1, 2, 3, or null' })
    if (queuePosition !== undefined && queuePosition !== null && !Number.isInteger(queuePosition)) return response.status(400).json({ error: 'queuePosition must be a positive integer or null' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await setWatchlistPriorityForUser(pool, { username: user.username, mediaType, mediaId, topSlot, queuePosition })
      if (result.status === 'missing_watchlist_item') return response.status(404).json({ error: 'This title is no longer in your watchlist.' })
      if (result.status === 'invalid_top_slot' || result.status === 'invalid_queue_position' || result.status === 'invalid_media_type') return response.status(400).json({ error: 'Invalid priority value.' })
      response.json(result)
    } catch (error) { next(error) }
  })

  app.get('/api/alerts', async (request, response, next) => {
    const timezone = typeof request.query.timeZone === 'string' ? request.query.timeZone.trim() : ''
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })

      if (isValidIanaTimezone(timezone)) {
        await updateUserAlertTimezone(pool, { username: user.username, timezone })
      }

      const [alerts, unreadCount] = await Promise.all([
        listAlertsForUser(pool, user.username),
        countUnreadAlertsForUser(pool, user.username),
      ])
      response.json({ count: alerts.length, unreadCount, alerts: alerts.map(mapAlert) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/alerts/read', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const markedReadCount = await markAlertsReadForUser(pool, user.username)
      response.json({ markedReadCount, unreadCount: 0 })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/calendar', async (request, response, next) => {
    const month = typeof request.query.month === 'string' ? request.query.month.trim() : ''
    const mediaType = typeof request.query.mediaType === 'string' ? request.query.mediaType.trim() : 'all'
    const today = typeof request.query.today === 'string' ? request.query.today.trim() : formatIsoDate(new Date())

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      response.status(400).json({ error: 'month must use YYYY-MM format' })
      return
    }
    if (!['all', 'movie', 'tv'].includes(mediaType)) {
      response.status(400).json({ error: 'mediaType must be all, movie, or tv' })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      response.status(400).json({ error: 'today must use YYYY-MM-DD format' })
      return
    }

    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })

      const monthStart = `${month}-01`
      const monthEnd = addMonthsToIsoMonth(month, 1)
      const upcomingEnd = addDaysToIsoDate(today, 7)
      const [events, upcoming] = await Promise.all([
        listCalendarEventsForUser(pool, user.username, { startDate: monthStart, endDate: monthEnd, mediaType }),
        listCalendarEventsForUser(pool, user.username, { startDate: today, endDate: upcomingEnd, mediaType }),
      ])

      response.json({
        month,
        mediaType,
        events: events.map(mapCalendarEvent),
        upcoming: upcoming.map(mapCalendarEvent),
        upcomingCount: upcoming.length,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/favorite-actors', async (request, response, next) => {
    try {
      await ensureFavoriteActorsTable(pool)
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })

      const actors = await listFavoriteActorsForUser(pool, user.username)
      response.json({ count: actors.length, actors: actors.map(mapFavoriteActor) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/favorite-authors', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const authors = await listFavoriteAuthorsForUser(pool, user.username)
      response.json({ count: authors.length, authors: authors.map(mapFavoriteAuthor) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/favorite-authors/:authorId', async (request, response, next) => {
    const authorId = Number.parseInt(request.params.authorId, 10)
    if (!Number.isInteger(authorId)) return response.status(400).json({ error: `Invalid author id: ${request.params.authorId}` })

    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await toggleFavoriteAuthorForUser(pool, { username: user.username, authorId })
      if (result.status === 'missing_author') return response.status(404).json({ error: `Author ${authorId} was not found in the local database` })
      if (result.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      if (result.status === 'limit_reached') return response.status(409).json({ error: `You can favorite up to ${result.limit} authors.` })
      response.json({ favorited: result.favorited })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/favorite-actors/:personId', async (request, response, next) => {
    const personId = Number.parseInt(request.params.personId, 10)
    if (!Number.isInteger(personId)) return response.status(400).json({ error: `Invalid person id: ${request.params.personId}` })

    try {
      await ensureFavoriteActorsTable(pool)
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })

      const result = await toggleFavoriteActorForUser(pool, { username: user.username, personId })
      if (result.status === 'missing_actor') return response.status(404).json({ error: `Actor ${personId} was not found in the local database` })
      if (result.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })

      response.json({ favorited: result.favorited })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/watchlist', async (request, response, next) => {
    const movieId = Number.parseInt(request.body?.movieId, 10)

    if (!Number.isInteger(movieId)) {
      response.status(400).json({
        error: 'movieId must be a valid integer',
      })
      return
    }

    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      let result = await addMovieToWatchlistForUser(pool, {
        username: user.username,
        movieId,
      })

      if (result.status === 'missing_movie') {
        await hydrateMissingMovie(movieId)
        result = await addMovieToWatchlistForUser(pool, { username: user.username, movieId })
      }

      if (result.status === 'missing_movie') return response.status(404).json({ error: `Movie ${movieId} could not be loaded from TMDB` })

      if (result.status === 'missing_user') {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      if (result.status === 'limit_reached') {
        response.status(409).json({
          error: `You can save up to ${result.limit} movies in your watchlist.`,
        })
        return
      }

      const movies = await listWatchlistMoviesForUser(pool, user.username)
      const savedMovie = movies.find((movie) => Number(movie.tmdb_id) === movieId) ?? null
      const newlyUnlockedAchievements = result.added && await recordAchievementEventForUser(pool, { username: user.username, eventType: 'movie_watchlist_added', mediaType: 'movie', entityId: result.entityId, baselineKind: 'movie_watchlist' }) ? await evaluateAchievementsForUser(pool, user.username) : []

      response.status(200).json({
        movie: savedMovie ? mapWatchlistMovie(savedMovie) : null,
        newlyUnlockedAchievements,
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/watchlist/books', async (request, response, next) => {
    const bookId = typeof request.body?.bookId === 'string' ? request.body.bookId.trim() : ''
    if (!bookId) return response.status(400).json({ error: 'bookId is required' })

    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await addBookToWatchlistForUser(pool, { username: user.username, bookId })
      if (result.status === 'missing_book') return response.status(404).json({ error: `Book ${bookId} was not found in the local database` })
      if (result.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      if (result.status === 'limit_reached') return response.status(409).json({ error: `You can save up to ${result.limit} books in your watchlist.` })

      const books = await listWatchlistBooksForUser(pool, user.username)
      const savedBook = books.find((book) => book.google_books_id === bookId) ?? null
      const newlyUnlockedBookAchievements = result.added && Number.isInteger(result.entityId) && await recordBookAchievementEventForUser(pool, { username: user.username, eventType: 'watchlisted', bookId: result.entityId }) ? await evaluateBookAchievementsForUser(pool, user.username) : []
      response.status(200).json({ book: savedBook ? mapWatchlistBook(savedBook) : null, newlyUnlockedBookAchievements })
    } catch (error) { next(error) }
  })

  app.delete('/api/watchlist/books/:bookId', async (request, response, next) => {
    const bookId = String(request.params.bookId || '').trim()
    if (!bookId) return response.status(400).json({ error: 'bookId is required' })

    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await removeBookFromWatchlistForUser(pool, { username: user.username, bookId })
      if (result.status === 'missing_book') return response.status(404).json({ error: `Book ${bookId} was not found in the local database` })
      if (result.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      response.status(200).json({ removed: result.removed })
    } catch (error) { next(error) }
  })

  app.get('/api/read/books', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const books = await listReadBooksForUser(pool, user.username)
      response.json({ count: books.length, books: books.map(mapReadBook) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/read/books', async (request, response, next) => {
    const bookId = typeof request.body?.bookId === 'string' ? request.body.bookId.trim() : ''
    const readingFormat = typeof request.body?.readingFormat === 'string' ? request.body.readingFormat.trim().toLowerCase() : ''
    const completionMetadata = sanitizeBookCompletionMetadata(request.body?.completionMetadata)
    if (!bookId) return response.status(400).json({ error: 'bookId is required' })
    if (!bookReadingFormats.has(readingFormat)) return response.status(400).json({ error: 'readingFormat must be physical, ebook, or audiobook' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await addBookToReadForUser(pool, { username: user.username, bookId, readingFormat, completionMetadata })
      if (result.status === 'missing_book') return response.status(404).json({ error: `Book ${bookId} was not found in the local database` })
      if (result.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      const books = await listReadBooksForUser(pool, user.username)
      const savedBook = books.find((book) => book.google_books_id === bookId) ?? null
      const newlyUnlockedBookAchievements = Number.isInteger(result.entityId) ? await evaluateBookAchievementsForUser(pool, user.username) : []
      response.status(200).json({ book: savedBook ? mapReadBook(savedBook) : null, removedFromWatchlist: result.removedFromWatchlist, newlyUnlockedBookAchievements })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/read/books/:bookId', async (request, response, next) => {
    const bookId = String(request.params.bookId || '').trim()
    if (!bookId) return response.status(400).json({ error: 'bookId is required' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await removeBookFromReadForUser(pool, { username: user.username, bookId })
      if (result.status === 'missing_book') return response.status(404).json({ error: `Book ${bookId} was not found in the local database` })
      if (result.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      response.status(200).json({ removed: result.removed })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/watchlist/:movieId', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)

    if (!Number.isInteger(movieId)) {
      response.status(400).json({
        error: `Invalid movie id: ${request.params.movieId}`,
      })
      return
    }

    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const result = await removeMovieFromWatchlistForUser(pool, {
        username: user.username,
        movieId,
      })

      if (result.status === 'missing_movie') {
        response.status(404).json({
          error: `Movie ${movieId} was not found in the local database`,
        })
        return
      }

      if (result.status === 'missing_user') {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      response.status(200).json({
        removed: result.removed,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/watched/by-genre', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const genre = typeof request.query.genre === 'string' ? request.query.genre.trim() : ''
      if (!genre) {
        response.status(400).json({ error: 'genre is required' })
        return
      }

      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const movies = await listWatchedMoviesByGenreForUser(pool, user.username, {
        genre,
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedMovies = movies.slice(0, pagination.limit)

      response.json({
        count: pagedMovies.length,
        movies: pagedMovies.map(mapWatchedMovie),
        pagination: buildPaginationPayload(pagination, movies.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/watched', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const period = readStatsPeriod(request, response)
      if (!period) return
      const [movies, stats] = await Promise.all([
        listWatchedMoviesForUser(pool, user.username),
        getMovieStatsForUser(pool, user.username, period),
      ])

      response.json({
        count: movies.length,
        movies: movies.map(mapWatchedMovie),
        stats: mapMovieStats(stats),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/stats/insights', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })

      const period = readStatsPeriod(request, response)
      if (!period) return
      const timeZone = readStatsTimeZone(request, response)
      if (!timeZone) return

      await ensureTvDetailTables(pool)
      response.json(await getStatsInsightsForUser(pool, user.username, { period, timeZone }))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/stats/books', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const period = readStatsPeriod(request, response)
      if (!period) return
      response.json(await getBookStatsForUser(pool, user.username, period))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/watched', async (request, response, next) => {
    const movieId = Number.parseInt(request.body?.movieId, 10)

    if (!Number.isInteger(movieId)) {
      response.status(400).json({
        error: 'movieId must be a valid integer',
      })
      return
    }

    try {
      const period = readStatsPeriod(request, response)
      if (!period) return
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      if (request.body?.watchTogether === true && !await isSelectedWatchTogetherMovieForUser(pool, { username: user.username, movieId })) {
        return response.status(409).json({ error: 'Only the accepted Tonight’s pick can be marked watched together' })
      }

      let result = await addMovieToWatchedForUser(pool, {
        username: user.username,
        movieId,
        watchService: request.body?.watchService,
      })

      if (result.status === 'missing_movie') {
        await hydrateMissingMovie(movieId)
        result = await addMovieToWatchedForUser(pool, { username: user.username, movieId, watchService: request.body?.watchService })
      }

      if (result.status === 'missing_movie') return response.status(404).json({ error: `Movie ${movieId} could not be loaded from TMDB` })

      if (result.status === 'missing_user') {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const watchTogether = request.body?.watchTogether === true
        ? await confirmWatchTogetherMovieForUser(pool, { username: user.username, movieId })
        : { status: 'not_requested' }
      const [movies, stats] = await Promise.all([
        listWatchedMoviesForUser(pool, user.username),
        getMovieStatsForUser(pool, user.username, period),
      ])
      const watchedMovie = movies.find((movie) => Number(movie.tmdb_id) === movieId) ?? null
      const newlyUnlockedAchievements = result.added && await recordAchievementEventForUser(pool, { username: user.username, eventType: 'movie_watched', mediaType: 'movie', entityId: result.entityId, baselineKind: 'movie_watch', metadata: { fromWatchlist: result.removedFromWatchlist } }) ? await evaluateAchievementsForUser(pool, user.username) : []

      const newlyUnlockedWatchTogetherAchievements = watchTogether.status === 'completed' ? await evaluateWatchTogetherAchievementsForUser(pool, user.username) : []
      response.status(200).json({
        movie: watchedMovie ? mapWatchedMovie(watchedMovie) : null,
        removedFromWatchlist: result.removedFromWatchlist,
        watchTogether,
        stats: mapMovieStats(stats),
        newlyUnlockedAchievements: [...newlyUnlockedAchievements, ...newlyUnlockedWatchTogetherAchievements],
      })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/watched/:movieId', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)

    if (!Number.isInteger(movieId)) {
      response.status(400).json({
        error: `Invalid movie id: ${request.params.movieId}`,
      })
      return
    }

    try {
      const period = readStatsPeriod(request, response)
      if (!period) return
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const result = await removeMovieFromWatchedForUser(pool, {
        username: user.username,
        movieId,
      })

      if (result.status === 'missing_movie') {
        response.status(404).json({
          error: `Movie ${movieId} was not found in the local database`,
        })
        return
      }

      if (result.status === 'missing_user') {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const stats = await getMovieStatsForUser(pool, user.username, period)

      response.status(200).json({
        removed: result.removed,
        stats: mapMovieStats(stats),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv/library', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const period = readStatsPeriod(request, response)
      if (!period) return
      const [library, stats, watchlistShows, continueWatchingShows] = await Promise.all([
        getTvLibraryForUser(pool, user.username),
        getTvStatsForUser(pool, user.username, period),
        listTvWatchlistShowsForUser(pool, user.username),
        listContinueWatchingTvShowsForUser(pool, user.username, { limit: 5 }),
      ])
      response.json({ watchedIds: library.watchedIds, watchlistIds: library.watchlistIds, watchlistShows: watchlistShows.map(mapWatchlistTvShow), continueWatchingShows: continueWatchingShows.map(mapContinueWatchingTvShow), stats: mapTvStats(stats) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv/continue-watching', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })

      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const shows = await listContinueWatchingTvShowsForUser(pool, user.username, {
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedShows = shows.slice(0, pagination.limit)

      response.json({
        count: pagedShows.length,
        shows: pagedShows.map(mapContinueWatchingTvShow),
        pagination: buildPaginationPayload(pagination, shows.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv/watched-history', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })

      await ensureTvDetailTables(pool)
      const episodes = await listWatchedTvEpisodesForUser(pool, user.username)
      response.json({ count: episodes.length, episodes: episodes.map(mapWatchedTvEpisode) })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/tv/library/:kind', async (request, response, next) => {
    const kind = request.params.kind
    const showId = Number.parseInt(request.body?.showId, 10)
    if (!['watchlist', 'watched'].includes(kind) || !Number.isInteger(showId)) return response.status(400).json({ error: 'TV library updates must target watchlist or watched' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const period = readStatsPeriod(request, response)
      if (!period) return
      let result = await toggleTvLibraryItemForUser(pool, { username: user.username, showId, kind })
      if (result.status === 'missing_show') {
        await hydrateMissingTvShow(showId)
        result = await toggleTvLibraryItemForUser(pool, { username: user.username, showId, kind })
      }
      if (result.status === 'missing_show') return response.status(404).json({ error: `TV show ${showId} could not be loaded from TMDB` })
      const [library, stats, watchlistShows] = await Promise.all([
        getTvLibraryForUser(pool, user.username),
        getTvStatsForUser(pool, user.username, period),
        listTvWatchlistShowsForUser(pool, user.username),
      ])
      const newlyUnlockedAchievements = result.added && kind === 'watchlist' && await recordAchievementEventForUser(pool, { username: user.username, eventType: 'tv_watchlist_added', mediaType: 'tv', entityId: result.entityId, baselineKind: 'tv_watchlist' }) ? await evaluateAchievementsForUser(pool, user.username) : []
      response.json({ added: result.added, watchedIds: library.watchedIds, watchlistIds: library.watchlistIds, watchlistShows: watchlistShows.map(mapWatchlistTvShow), stats: mapTvStats(stats), newlyUnlockedAchievements })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/admin/overview', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      await ensureFilelistTables(pool)
      await ensureIgdbCredentialsTable(pool)
      await ensureRssSourcesTable(pool)
      const [credential, enabledSections, igdbCredential, lastExecutions, rssSources] = await Promise.all([
        getFilelistCredentialStatus(pool, user.id),
        getUserEnabledSections(pool, user.id),
        getIgdbCredentialStatus(pool),
        getAdminJobLastExecutions(pool, jobs.map((job) => job.key)),
        listRssSources(pool),
      ])
      response.json({
        crons: listAdminJobs(jobs, lastExecutions),
        totals: {
          actors: await countActors(pool),
          books: await countBooks(pool),
          games: await countGames(pool),
          movies: await countMovies(pool),
          newsArticles: await countNewsArticles(pool),
          storedDataBytes: await countStoredDataBytes(pool),
          tvShows: await countTvShows(pool),
        },
        filelist: { configured: Boolean(credential), updatedAt: credential?.updated_at ?? null },
        igdb: { configured: Boolean(igdbCredential), updatedAt: igdbCredential?.updated_at ?? null },
        rssSources: rssSources.map((source) => ({ key: source.source_key, name: source.name, url: source.url, enabled: Boolean(source.enabled), updatedAt: source.updated_at })),
        sections: { enabled: enabledSections },
      })
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/admin/rss-sources/:sourceKey', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const { sourceKey } = request.params
      const { enabled } = request.body ?? {}
      if (!entertainmentNewsSourceKeys.has(sourceKey)) return response.status(404).json({ error: `Unknown RSS source: ${sourceKey}` })
      if (typeof enabled !== 'boolean') return response.status(400).json({ error: 'enabled must be a boolean.' })
      await ensureRssSourcesTable(pool)
      const source = await updateRssSourceEnabled(pool, { sourceKey, enabled })
      if (!source) return response.status(404).json({ error: `Unknown RSS source: ${sourceKey}` })
      response.json({ key: source.source_key, name: source.name, url: source.url, enabled: Boolean(source.enabled), updatedAt: source.updated_at })
    } catch (error) { next(error) }
  })

  app.get('/api/news', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 20 })
      const filters = readNewsFilters(request)
      if (filters.error) return response.status(400).json({ error: filters.error })
      const user = await getAuthenticatedUser(pool, request)
      const savedOnly = request.query.saved === 'true'
      if (savedOnly && !user) return response.status(401).json({ error: 'Authentication required' })
      const articles = await listNewsArticles(pool, { limit: pagination.limit + 1, page: pagination.page, userId: user?.id ?? null, savedOnly, ...filters })
      const pagedArticles = articles.slice(0, pagination.limit)
      response.json({
        count: pagedArticles.length,
        articles: pagedArticles.map((article) => ({
          id: Number(article.id),
          title: decodeHtmlEntities(article.title),
          link: article.link,
          publishedAt: article.published_at,
          photoUrl: article.photo_url,
          description: decodeHtmlEntities(article.description),
          likeCount: Number(article.like_count) || 0,
          likedByCurrentUser: Boolean(article.liked_by_current_user),
          savedByCurrentUser: Boolean(article.saved_by_current_user),
          actors: Array.isArray(article.actors) ? article.actors.map((actor) => ({ id: Number(actor.id), name: actor.name })) : [],
          movies: Array.isArray(article.movies) ? article.movies.map((movie) => ({ id: Number(movie.id), name: movie.name })) : [],
          shows: Array.isArray(article.shows) ? article.shows.map((show) => ({ id: Number(show.id), name: show.name })) : [],
        })),
        pagination: buildPaginationPayload(pagination, articles.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/news/:articleId/like', async (request, response, next) => {
    const articleId = Number.parseInt(request.params.articleId, 10)
    if (!Number.isInteger(articleId) || articleId <= 0) return response.status(400).json({ error: `Invalid article id: ${request.params.articleId}` })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await addNewsArticleLikeForUser(pool, { articleId, userId: user.id })
      if (result.status === 'missing_article') return response.status(404).json({ error: `Article ${articleId} was not found` })
      response.json({ likeCount: result.likeCount, likedByCurrentUser: result.likedByCurrentUser })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/news/:articleId/like', async (request, response, next) => {
    const articleId = Number.parseInt(request.params.articleId, 10)
    if (!Number.isInteger(articleId) || articleId <= 0) return response.status(400).json({ error: `Invalid article id: ${request.params.articleId}` })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await removeNewsArticleLikeForUser(pool, { articleId, userId: user.id })
      if (result.status === 'missing_article') return response.status(404).json({ error: `Article ${articleId} was not found` })
      response.json({ likeCount: result.likeCount, likedByCurrentUser: result.likedByCurrentUser })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/news/:articleId/save', async (request, response, next) => {
    const articleId = Number.parseInt(request.params.articleId, 10)
    if (!Number.isInteger(articleId) || articleId <= 0) return response.status(400).json({ error: `Invalid article id: ${request.params.articleId}` })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await addNewsArticleSaveForUser(pool, { articleId, userId: user.id })
      if (result.status === 'missing_article') return response.status(404).json({ error: `Article ${articleId} was not found` })
      response.json({ savedByCurrentUser: result.savedByCurrentUser })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/news/:articleId/save', async (request, response, next) => {
    const articleId = Number.parseInt(request.params.articleId, 10)
    if (!Number.isInteger(articleId) || articleId <= 0) return response.status(400).json({ error: `Invalid article id: ${request.params.articleId}` })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await removeNewsArticleSaveForUser(pool, { articleId, userId: user.id })
      if (result.status === 'missing_article') return response.status(404).json({ error: `Article ${articleId} was not found` })
      response.json({ savedByCurrentUser: result.savedByCurrentUser })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/news/filters', async (request, response, next) => {
    try {
      const filters = readNewsFilters(request)
      if (filters.error) return response.status(400).json({ error: filters.error })
      const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 120) : ''
      const options = await listNewsFilterOptions(pool, { query, ...filters })
      response.json({
        actors: options.actors.map((actor) => ({ id: Number(actor.id), name: actor.name })),
        titles: options.titles.map((title) => ({ kind: title.kind, id: Number(title.id), name: title.name })),
        selected: options.selected,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/preferences/sections', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      response.json({ enabled: await getUserEnabledSections(pool, user.id) })
    } catch (error) { next(error) }
  })

  app.put('/api/admin/preferences/sections', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const enabledSections = request.body?.enabledSections
      if (!Array.isArray(enabledSections) || enabledSections.some((section) => typeof section !== 'string' || !['movies', 'tv', 'books', 'games', 'calendar'].includes(section))) {
        return response.status(400).json({ error: 'Enabled sections must contain only movies, tv, books, games, and calendar.' })
      }
      response.json({ enabled: await saveUserEnabledSections(pool, { userId: user.id, enabledSections }) })
    } catch (error) { next(error) }
  })

  app.put('/api/admin/filelist', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const username = typeof request.body?.username === 'string' ? request.body.username.trim() : ''
      const passkey = typeof request.body?.passkey === 'string' ? request.body.passkey.trim() : ''
      if (!username || !passkey) return response.status(400).json({ error: 'Filelist username and passkey are required.' })
      const config = loadRuntimeConfig()
      await ensureFilelistTables(pool)
      await saveFilelistCredentials(pool, {
        userId: user.id,
        encryptedUsername: encryptFilelistValue(username, config.filelistEncryptionKey),
        encryptedPasskey: encryptFilelistValue(passkey, config.filelistEncryptionKey),
      })
      response.json({ configured: true })
    } catch (error) { next(error) }
  })

  app.delete('/api/admin/filelist', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      await ensureFilelistTables(pool)
      await deleteFilelistCredentials(pool, user.id)
      response.json({ configured: false })
    } catch (error) { next(error) }
  })

  app.put('/api/admin/igdb', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const clientId = typeof request.body?.clientId === 'string' ? request.body.clientId.trim() : ''
      const privateKey = typeof request.body?.privateKey === 'string' ? request.body.privateKey.trim() : ''
      if (!clientId || !privateKey) return response.status(400).json({ error: 'IGDB client ID and private key are required.' })
      const config = loadRuntimeConfig()
      await ensureIgdbCredentialsTable(pool)
      await saveIgdbCredentials(pool, {
        encryptedClientId: encryptFilelistValue(clientId, config.filelistEncryptionKey),
        encryptedPrivateKey: encryptFilelistValue(privateKey, config.filelistEncryptionKey),
      })
      response.json({ configured: true })
    } catch (error) { next(error) }
  })

  app.delete('/api/admin/igdb', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      await ensureIgdbCredentialsTable(pool)
      await deleteIgdbCredentials(pool)
      response.json({ configured: false })
    } catch (error) { next(error) }
  })

  app.post('/api/admin/jobs/:jobKey/run', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
    } catch (error) {
      next(error)
      return
    }
    const job = findAdminJob(request.params.jobKey, jobs)

    if (!job) {
      response.status(404).json({
        error: `Unknown admin job: ${request.params.jobKey}`,
      })
      return
    }

    try {
      let options
      if (job.source === 'theme-scheduler') {
        const schedulerConfig = loadConfig({ requireDatabase: false, requireTmdbToken: false })
        options = { timeZone: schedulerConfig.themeSchedulerTimeZone }
      } else if (job.source === 'rss') {
        options = {}
      } else {
        const config = loadRuntimeConfig()
        if (job.source === 'google-books') {
          options = { apiKey: config.googleBooksApiKey, baseUrl: config.googleBooksBaseUrl }
        } else if (job.source === 'igdb') {
          await ensureIgdbCredentialsTable(pool)
          const credentials = await getIgdbCredentials(pool)
          if (!credentials) return response.status(400).json({ error: 'IGDB credentials have not been configured in Admin settings.' })
          options = {
            clientId: decryptFilelistValue(credentials.encrypted_client_id, config.filelistEncryptionKey),
            clientSecret: decryptFilelistValue(credentials.encrypted_private_key, config.filelistEncryptionKey),
            baseUrl: config.igdbBaseUrl,
            tokenUrl: config.twitchTokenUrl,
            count: 30,
          }
        } else {
          options = { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, count: 30 }
        }
      }
      const result = await job.run(pool, options)
      const lastExecutedAt = await recordAdminJobExecution(pool, job.key)

      response.json({
        job: job.key,
        fetchedCount: result.fetchedCount ?? 0,
        insertedCount: result.insertedCount ?? 0,
        updatedCount: result.updatedCount ?? 0,
        lastExecutedAt,
        ...(job.source === 'rss' ? { activeSourceCount: result.activeSourceCount ?? 0 } : {}),
        ...(job.source === 'theme-scheduler' ? {
          activeTheme: result.activeTheme,
          previousTheme: result.previousTheme,
          changed: result.changed,
          timeZone: result.timeZone,
        } : {}),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const genre = typeof request.query.genre === 'string' ? request.query.genre.trim() : ''
      const hideWatched = request.query.hideWatched === 'true'
      const user = hideWatched ? await getAuthenticatedUser(pool, request) : null
      if (hideWatched && !user) return response.status(401).json({ error: 'Authentication required' })
      const movies = await listMovies(pool, {
        genre,
        excludeWatchedForUsername: user?.username,
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedMovies = movies.slice(0, pagination.limit)

      response.json({
        count: pagedMovies.length,
        movies: pagedMovies,
        featuredMovie: mapFeaturedMovie(pagedMovies[0] ?? null),
        pagination: buildPaginationPayload(pagination, movies.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/games', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const games = await listPopularGames(pool, { limit: pagination.limit + 1, page: pagination.page })
      const pagedGames = games.slice(0, pagination.limit)
      response.json({
        count: pagedGames.length,
        games: pagedGames,
        pagination: buildPaginationPayload(pagination, games.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/games/recently-released', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const games = await listRecentlyReleasedGames(pool, { limit: pagination.limit + 1, page: pagination.page })
      const pagedGames = games.slice(0, pagination.limit)
      response.json({
        count: pagedGames.length,
        games: pagedGames,
        pagination: buildPaginationPayload(pagination, games.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/games/upcoming', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const games = await listUpcomingGames(pool, { limit: pagination.limit + 1, page: pagination.page })
      const pagedGames = games.slice(0, pagination.limit)
      response.json({
        count: pagedGames.length,
        games: pagedGames,
        pagination: buildPaginationPayload(pagination, games.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/games/played', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const games = await listPlayedGamesForUser(pool, user.username)
      response.json({ count: games.length, games: games.map(mapPlayedGame) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/games/activity', async (request, response, next) => {
    try {
      await ensureGameTrackingTables(pool)
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      response.json(await getGameActivityForUser(pool, user.username))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/game-achievements', async (request, response, next) => {
    try {
      await ensureGameTrackingTables(pool)
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const achievements = await getGameAchievementsForUser(pool, user.username)
      response.json({ count: achievements.length, achievements })
    } catch (error) { next(error) }
  })

  app.get('/api/games/:gameId/tracking', async (request, response, next) => {
    const gameId = Number.parseInt(request.params.gameId, 10)
    if (!Number.isInteger(gameId)) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })
    try {
      await ensureGameTrackingTables(pool)
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const tracking = await getGameTrackingForUser(pool, { username: user.username, gameId })
      response.json({ tracking: mapGameTracking(tracking) })
    } catch (error) { next(error) }
  })

  app.put('/api/games/:gameId/tracking', async (request, response, next) => {
    const gameId = Number.parseInt(request.params.gameId, 10); const tracking = parseGameTrackingPayload(request.body)
    if (!Number.isInteger(gameId)) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })
    if (!tracking) return response.status(400).json({ error: 'Invalid game tracking details.' })
    try {
      await ensureGameTrackingTables(pool)
      if (!await getGameByIgdbId(pool, gameId)) return response.status(404).json({ error: `Game ${gameId} was not found in the local database` })
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const saved = await upsertGameTrackingForUser(pool, { username: user.username, gameId, tracking })
      if (saved.status !== 'ok') return response.status(401).json({ error: 'Authentication required' })
      const newlyUnlockedAchievements = await evaluateGameAchievementsForUser(pool, user.username)
      response.json({ tracking: mapGameTracking(saved.tracking), newlyUnlockedAchievements })
    } catch (error) { next(error) }
  })

  app.post('/api/games/:gameId/sessions', async (request, response, next) => {
    const gameId = Number.parseInt(request.params.gameId, 10); const session = parseGameSessionPayload(request.body)
    if (!Number.isInteger(gameId)) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })
    if (!session) return response.status(400).json({ error: 'Invalid game session details.' })
    try {
      await ensureGameTrackingTables(pool)
      if (!await getGameByIgdbId(pool, gameId)) return response.status(404).json({ error: `Game ${gameId} was not found in the local database` })
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const saved = await addGameSessionForUser(pool, { username: user.username, gameId, session })
      if (saved.status !== 'ok') return response.status(401).json({ error: 'Authentication required' })
      const newlyUnlockedAchievements = await evaluateGameAchievementsForUser(pool, user.username)
      response.status(201).json({ sessionId: saved.id, newlyUnlockedAchievements })
    } catch (error) { next(error) }
  })

  app.get('/api/games/:gameId', async (request, response, next) => {
    const gameId = Number.parseInt(request.params.gameId, 10)
    if (!Number.isInteger(gameId)) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })
    try {
      await ensureGameTrackingTables(pool)
      let game = await getGameByIgdbId(pool, gameId)
      if (!game) {
        await hydrateMissingGame(gameId)
        game = await getGameByIgdbId(pool, gameId)
      }
      if (!game) return response.status(404).json({ error: `Game ${gameId} was not found in the local database` })
      const user = await getAuthenticatedUser(pool, request)
      const [communityRating, personal, timeToBeat, tracking] = await Promise.all([
        getGameCommunityRating(pool, { gameId, username: user?.username ?? null }),
        getGamePersonalState(pool, { gameId, username: user?.username ?? null }),
        getGameTimeToBeatWithFallback(gameId),
        user ? getGameTrackingForUser(pool, { username: user.username, gameId }) : Promise.resolve(null),
      ])
      response.json({ game: mapGameDetail(game, communityRating, personal, timeToBeat, tracking) })
    } catch (error) { next(error) }
  })

  app.get('/api/games/:gameId/trailer', async (request, response, next) => {
    const gameId = Number(request.params.gameId)
    if (!Number.isInteger(gameId) || gameId < 1) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })

    try {
      await ensureIgdbCredentialsTable(pool)
      const credentials = await getIgdbCredentials(pool)
      if (!credentials) return response.status(409).json({ error: 'IGDB credentials have not been configured in Admin settings.' })

      const config = loadRuntimeConfig()
      const clientId = decryptFilelistValue(credentials.encrypted_client_id, config.filelistEncryptionKey)
      const clientSecret = decryptFilelistValue(credentials.encrypted_private_key, config.filelistEncryptionKey)
      const accessToken = await fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl: config.twitchTokenUrl })
      const videos = await igdbRequest(fetchImpl, {
        clientId,
        accessToken,
        baseUrl: config.igdbBaseUrl,
        path: 'game_videos',
        body: `fields name,video_id; where game = ${gameId}; limit 10;`,
      })
      const trailer = selectPlayableGameTrailer(videos)
      if (!trailer) return response.status(404).json({ error: 'No playable YouTube trailer is available for this game.' })

      response.json({ trailer })
    } catch (error) { next(error) }
  })

  app.get('/api/games/:gameId/similar', async (request, response, next) => {
    const gameId = Number.parseInt(request.params.gameId, 10)
    if (!Number.isInteger(gameId)) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })
    try {
      let game = await getGameByIgdbId(pool, gameId)
      if (!game) {
        await hydrateMissingGame(gameId)
        game = await getGameByIgdbId(pool, gameId)
      }
      if (!game) return response.status(404).json({ error: `Game ${gameId} was not found in the local database` })

      let games = []
      let source = 'local'
      try {
        await ensureIgdbCredentialsTable(pool)
        const credentials = await getIgdbCredentials(pool)
        if (credentials) {
          const config = loadRuntimeConfig()
          const clientId = decryptFilelistValue(credentials.encrypted_client_id, config.filelistEncryptionKey)
          const clientSecret = decryptFilelistValue(credentials.encrypted_private_key, config.filelistEncryptionKey)
          const accessToken = await fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl: config.twitchTokenUrl })
          const requestIgdb = (path, body) => igdbRequest(fetchImpl, { clientId, accessToken, baseUrl: config.igdbBaseUrl, path, body })
          const sourceGames = await requestIgdb('games', `fields similar_games; where id = ${gameId}; limit 1;`)
          const relatedIds = [...new Set((sourceGames[0]?.similar_games || []).map(Number).filter(Number.isInteger).filter((id) => id !== gameId))].slice(0, 10)
          if (relatedIds.length) {
            const relatedGames = await requestIgdb('games', `fields id,name,cover.image_id,first_release_date,rating,aggregated_rating,genres.name; where id = (${relatedIds.join(',')}); limit ${relatedIds.length};`)
            const byId = new Map(relatedGames.map((relatedGame) => [Number(relatedGame.id), mapIgdbGameRecommendation(relatedGame)]))
            games = relatedIds.map((id) => byId.get(id)).filter(Boolean).slice(0, 10)
            if (games.length) source = 'igdb'
          }
        }
      } catch {
        games = []
      }

      if (!games.length) {
        games = (await listSimilarGames(pool, { gameId, genres: Array.isArray(game.genres) ? game.genres : [], limit: 10 })).map(mapLocalGameRecommendation)
      }
      response.json({ count: games.length, source, games })
    } catch (error) { next(error) }
  })

  app.post('/api/games/:gameId/played', async (request, response, next) => {
    const gameId = Number.parseInt(request.params.gameId, 10)
    if (!Number.isInteger(gameId)) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })
    try {
      await ensureGameTrackingTables(pool)
      if (!await getGameByIgdbId(pool, gameId)) return response.status(404).json({ error: `Game ${gameId} was not found in the local database` })
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await addGameToPlayedForUser(pool, { username: user.username, gameId })
      if (result.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      response.status(200).json({ played: true, playedAt: result.createdAt })
    } catch (error) { next(error) }
  })

  app.delete('/api/games/:gameId/played', async (request, response, next) => {
    const gameId = Number.parseInt(request.params.gameId, 10)
    if (!Number.isInteger(gameId)) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })
    try {
      if (!await getGameByIgdbId(pool, gameId)) return response.status(404).json({ error: `Game ${gameId} was not found in the local database` })
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await removeGameFromPlayedForUser(pool, { username: user.username, gameId })
      if (result.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      response.json({ played: false })
    } catch (error) { next(error) }
  })

  app.put('/api/games/:gameId/rating', async (request, response, next) => {
    const gameId = Number.parseInt(request.params.gameId, 10)
    const score = typeof request.body?.score === 'number' ? request.body.score : Number.NaN
    if (!Number.isInteger(gameId)) return response.status(400).json({ error: `Invalid game id: ${request.params.gameId}` })
    if (!isValidMovieRating(score)) return response.status(400).json({ error: 'score must be between 1 and 5 in 0.5 increments' })
    try {
      if (!await getGameByIgdbId(pool, gameId)) return response.status(404).json({ error: `Game ${gameId} was not found in the local database` })
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const saved = await upsertGameRatingForUser(pool, { username: user.username, gameId, score })
      if (saved.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      const communityRating = await getGameCommunityRating(pool, { gameId, username: user.username })
      const newlyUnlockedAchievements = await evaluateGameAchievementsForUser(pool, user.username)
      response.json({ communityRating: mapCommunityRating(communityRating), newlyUnlockedAchievements })
    } catch (error) { next(error) }
  })

  app.get('/api/books', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const books = await listBooks(pool, { limit: pagination.limit + 1, page: pagination.page })
      const pagedBooks = books.slice(0, pagination.limit)
      response.json({ count: pagedBooks.length, books: pagedBooks.map(sanitizeStoredBookDescription), pagination: buildPaginationPayload(pagination, books.length > pagination.limit) })
    } catch (error) { next(error) }
  })

  app.get('/api/books/:bookId', async (request, response, next) => {
    try {
      const book = await getBookByGoogleBooksId(pool, request.params.bookId)
      if (!book) return response.status(404).json({ error: `Book ${request.params.bookId} was not found in the local database` })
      const user = await getAuthenticatedUser(pool, request)
      const [communityRating, authors] = await Promise.all([
        getBookCommunityRating(pool, { bookId: request.params.bookId, username: user?.username ?? null }),
        listAuthorsForBook(pool, request.params.bookId),
      ])
      response.json({
        book: {
          ...sanitizeStoredBookDescription(book),
          ...(authors.length > 0 ? { authors: authors.map((author) => author.name), authorProfiles: authors.map((author) => ({ id: author.id, name: author.name })) } : {}),
          communityRating: mapCommunityRating(communityRating),
        },
      })
    } catch (error) { next(error) }
  })

  app.get('/api/authors/:authorId', async (request, response, next) => {
    const authorId = Number.parseInt(request.params.authorId, 10)
    if (!Number.isInteger(authorId)) return response.status(400).json({ error: `Invalid author id: ${request.params.authorId}` })
    try {
      const author = await getAuthorById(pool, authorId)
      if (!author) return response.status(404).json({ error: `Author ${authorId} was not found in the local database` })
      const books = await listBooksForAuthor(pool, authorId)
      response.json({ author: { id: author.id, name: author.name }, count: books.length, books: books.map(sanitizeStoredBookDescription) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/books/:bookId/related', async (request, response, next) => {
    const bookId = String(request.params.bookId || '').trim()
    if (!bookId) return response.status(400).json({ error: 'bookId is required' })

    try {
      const book = await getBookByGoogleBooksId(pool, bookId)
      if (!book) return response.status(404).json({ error: `Book ${bookId} was not found in the local database` })

      const category = Array.isArray(book.categories) ? book.categories.find(Boolean) : null
      if (!category) return response.json({ count: 0, books: [] })

      const config = loadRuntimeConfig()
      if (!config.googleBooksApiKey) throw new Error('Missing required environment variable: GOOGLE_BOOKS_API_KEY')
      const payload = await fetchRelatedBooksByCategory(fetch, {
        apiKey: config.googleBooksApiKey,
        baseUrl: config.googleBooksBaseUrl,
        category,
        maxResults: 11,
      })
      const books = (Array.isArray(payload?.items) ? payload.items : [])
        .filter((volume) => volume?.id && String(volume.id) !== bookId)
        .slice(0, 10)
        .map((volume, index) => normalizeBook(volume, index + 1))

      response.json({ count: books.length, books })
    } catch (error) { next(error) }
  })

  app.put('/api/books/:bookId/rating', async (request, response, next) => {
    const bookId = String(request.params.bookId || '').trim()
    const score = typeof request.body?.score === 'number' ? request.body.score : Number.NaN
    if (!bookId) return response.status(400).json({ error: 'bookId is required' })
    if (!isValidMovieRating(score)) return response.status(400).json({ error: 'score must be between 1 and 5 in 0.5 increments' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const savedRating = await upsertBookRatingForUser(pool, { username: user.username, bookId, score })
      if (savedRating.status === 'missing_book') return response.status(404).json({ error: `Book ${bookId} was not found in the local database` })
      if (savedRating.status === 'missing_user') return response.status(401).json({ error: 'Authentication required' })
      const communityRating = await getBookCommunityRating(pool, { bookId, username: user.username })
      if (Number.isInteger(savedRating.entityId)) await recordBookAchievementEventForUser(pool, { username: user.username, eventType: 'rated', bookId: savedRating.entityId, metadata: { score } })
      const newlyUnlockedBookAchievements = Number.isInteger(savedRating.entityId) ? await evaluateBookAchievementsForUser(pool, user.username) : []
      response.json({ communityRating: mapCommunityRating(communityRating), ...(Number.isInteger(savedRating.entityId) ? { newlyUnlockedBookAchievements } : {}) })
    } catch (error) { next(error) }
  })

  app.post('/api/books/:bookId', async (request, response, next) => {
    const bookId = String(request.params.bookId || '').trim()
    if (!bookId) return response.status(400).json({ error: 'bookId is required' })

    try {
      const config = loadRuntimeConfig()
      if (!config.googleBooksApiKey) throw new Error('Missing required environment variable: GOOGLE_BOOKS_API_KEY')
      const volume = await fetchBookById(fetch, {
        apiKey: config.googleBooksApiKey,
        baseUrl: config.googleBooksBaseUrl,
        bookId,
      })
      if (!volume?.id) return response.status(404).json({ error: `Book ${bookId} was not found in Google Books` })
      await upsertBooks(pool, [normalizeBook(volume, 0)])
      const book = await getBookByGoogleBooksId(pool, String(volume.id))
      response.status(201).json({ book: sanitizeStoredBookDescription(book) })
    } catch (error) { next(error) }
  })

  app.get('/api/movies/recently-released', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const hideWatched = request.query.hideWatched === 'true'
      const user = hideWatched ? await getAuthenticatedUser(pool, request) : null
      if (hideWatched && !user) return response.status(401).json({ error: 'Authentication required' })
      const movies = await listRecentlyReleasedMovies(pool, {
        excludeWatchedForUsername: user?.username,
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedMovies = movies.slice(0, pagination.limit)
      response.json({
        count: pagedMovies.length,
        movies: pagedMovies,
        pagination: buildPaginationPayload(pagination, movies.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies/top-rated', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const hideWatched = request.query.hideWatched === 'true'
      const user = hideWatched ? await getAuthenticatedUser(pool, request) : null
      if (hideWatched && !user) return response.status(401).json({ error: 'Authentication required' })
      const movies = await listTopRatedMovies(pool, {
        excludeWatchedForUsername: user?.username,
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedMovies = movies.slice(0, pagination.limit)
      response.json({
        count: pagedMovies.length,
        movies: pagedMovies,
        pagination: buildPaginationPayload(pagination, movies.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies/upcoming', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const hideWatched = request.query.hideWatched === 'true'
      const user = hideWatched ? await getAuthenticatedUser(pool, request) : null
      if (hideWatched && !user) return response.status(401).json({ error: 'Authentication required' })
      const movies = await listUpcomingMovies(pool, {
        excludeWatchedForUsername: user?.username,
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedMovies = movies.slice(0, pagination.limit)
      response.json({
        count: pagedMovies.length,
        movies: pagedMovies,
        pagination: buildPaginationPayload(pagination, movies.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const shows = await listTvShows(pool, {
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedShows = shows.slice(0, pagination.limit)

      response.json({
        count: pagedShows.length,
        shows: pagedShows,
        featuredShow: mapFeaturedTvShow(pagedShows[0] ?? null),
        pagination: buildPaginationPayload(pagination, shows.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv/recently-released', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const shows = await listRecentlyAiredTvShows(pool, {
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedShows = shows.slice(0, pagination.limit)

      response.json({
        count: pagedShows.length,
        shows: pagedShows,
        pagination: buildPaginationPayload(pagination, shows.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv/latest-episodes', async (_request, response, next) => {
    try {
      const shows = await listLatestEpisodeTvShows(pool)
      response.json({ count: shows.length, shows: shows.map(mapLatestEpisodeTvShow) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv/top-rated', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const shows = await listTopRatedTvShows(pool, {
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedShows = shows.slice(0, pagination.limit)

      response.json({
        count: pagedShows.length,
        shows: pagedShows,
        pagination: buildPaginationPayload(pagination, shows.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv/upcoming', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const shows = await listUpcomingTvShows(pool, {
        limit: pagination.limit + 1,
        page: pagination.page,
      })
      const pagedShows = shows.slice(0, pagination.limit)

      response.json({
        count: pagedShows.length,
        shows: pagedShows,
        pagination: buildPaginationPayload(pagination, shows.length > pagination.limit),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/tv/:showId/reviews', async (request, response, next) => {
    const showId = Number.parseInt(request.params.showId, 10)
    if (!Number.isInteger(showId)) return response.status(400).json({ error: `Invalid TV show id: ${request.params.showId}` })
    try {
      const config = loadRuntimeConfig()
      const payload = await fetchTvReviews(fetch, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, tvShowId: showId })
      response.json({ reviews: (Array.isArray(payload?.results) ? payload.results : []).map(mapTvReview) })
    } catch (error) { next(error) }
  })

  app.get('/api/tv/:showId', async (request, response, next) => {
    const showId = Number.parseInt(request.params.showId, 10)
    if (!Number.isInteger(showId)) return response.status(400).json({ error: `Invalid TV show id: ${request.params.showId}` })
    try {
      await ensureTvDetailTables(pool)
      let show = await getTvShowByTmdbId(pool, showId)
      if (!show?.detail_hydrated_at) {
        const config = loadRuntimeConfig()
        await hydrateTvShow(pool, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, tvShowId: showId, importRank: show?.import_rank ?? 1 })
      }
      const user = await getAuthenticatedUser(pool, request)
      const detail = await getTvDetailForUser(pool, { showId, username: user?.username ?? null })
      if (!detail) return response.status(404).json({ error: `TV show ${showId} was not found` })
      response.json({ show: mapTvDetail(detail) })
    } catch (error) { next(error) }
  })

  app.get('/api/tv/:showId/filelist', async (request, response, next) => {
    const showId = Number.parseInt(request.params.showId, 10)
    if (!Number.isInteger(showId)) return response.status(400).json({ error: `Invalid TV show id: ${request.params.showId}` })

    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      await ensureFilelistTables(pool)
      const storedCredentials = await getFilelistCredentials(pool, user.id)
      if (!storedCredentials) return response.status(409).json({ error: 'Set up your Filelist username and passkey in Admin before searching.' })

      const target = await getFilelistTvEpisodeTargetForUser(pool, { showId, username: user.username })
      if (target.status === 'missing_show') return response.status(404).json({ error: `TV show ${showId} was not found in the local database` })
      if (target.status === 'caught_up') return response.status(409).json({ error: 'You are caught up on all aired episodes, so there is no episode to search.' })
      if (target.status === 'missing_initial_episode') return response.status(409).json({ error: 'Season 1 episode 1 is not available for this show yet.' })

      const usage = await reserveFilelistRequest(pool, user.id)
      if (!usage.allowed) return response.status(429).json({ error: `Filelist limit reached. Wait ${usage.minutesUntilReset} minutes until the next reset.`, minutesUntilReset: usage.minutesUntilReset, resetAt: usage.resetAt })

      const config = loadRuntimeConfig()
      const url = buildFilelistSearchUrl({
        username: decryptFilelistValue(storedCredentials.encrypted_username, config.filelistEncryptionKey),
        passkey: decryptFilelistValue(storedCredentials.encrypted_passkey, config.filelistEncryptionKey),
        query: buildFilelistTvEpisodeQuery(target.show.name, target.episode.seasonNumber, target.episode.episodeNumber),
      })
      const upstream = await fetchImpl(url)
      const payload = await upstream.json().catch(() => null)
      if (!upstream.ok) throw new Error(`Filelist search failed with status ${upstream.status}`)
      response.json({
        query: target.show.name,
        episode: { seasonNumber: target.episode.seasonNumber, episodeNumber: target.episode.episodeNumber, name: target.episode.name },
        results: mapFilelistResults(payload),
        usage: { count: usage.count, limit: 150, resetAt: usage.resetAt },
      })
    } catch (error) { next(error) }
  })

  app.post('/api/tv/episodes/:kind', async (request, response, next) => {
    if (request.params.kind !== 'watched') return response.status(400).json({ error: 'Only watched episode updates are supported' })
    const showId = Number.parseInt(request.body?.showId, 10)
    const episodeId = Number.parseInt(request.body?.episodeId, 10)
    const seasonId = Number.parseInt(request.body?.seasonId, 10)
    const action = request.body?.action
    const episodeActions = new Set(['mark_episode', 'unmark_episode', 'mark_through_episode'])
    if (!Number.isInteger(showId) || typeof action !== 'string' || (!episodeActions.has(action) && action !== 'mark_season')) return response.status(400).json({ error: 'showId and action must be valid' })
    if (episodeActions.has(action) && !Number.isInteger(episodeId)) return response.status(400).json({ error: 'episodeId must be valid for this action' })
    if (action === 'mark_season' && !Number.isInteger(seasonId)) return response.status(400).json({ error: 'seasonId must be valid when marking a season' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await updateTvEpisodeWatchStateForUser(pool, { username: user.username, showId, action, episodeId, seasonId, watchService: request.body?.watchService })
      if (result.status !== 'ok') return response.status(404).json({ error: action === 'mark_season' ? 'Season was not found' : 'Episode was not found' })
      const inserted = action !== 'unmark_episode' && result.updatedCount > 0
      if (inserted && Number.isInteger(episodeId)) await recordAchievementEventForUser(pool, { username: user.username, eventType: 'tv_episode_watched', mediaType: 'tv', entityId: episodeId, baselineKind: 'tv_episode_watch' })
      const didComplete = result.newlyCompletedShowId && await recordAchievementEventForUser(pool, { username: user.username, eventType: 'tv_show_completed', mediaType: 'tv', entityId: result.newlyCompletedShowId, baselineKind: 'tv_show' })
      const newlyUnlockedAchievements = (inserted || didComplete) ? await evaluateAchievementsForUser(pool, user.username) : []
      const detail = await getTvDetailForUser(pool, { showId, username: user.username })
      response.json({ updatedCount: result.updatedCount, show: mapTvDetail(detail), newlyUnlockedAchievements })
    } catch (error) { next(error) }
  })

  app.put('/api/tv/episodes/:episodeId/rating', async (request, response, next) => {
    const episodeId = Number.parseInt(request.params.episodeId, 10)
    const score = Number(request.body?.score)
    if (!Number.isInteger(episodeId)) return response.status(400).json({ error: `Invalid episode id: ${request.params.episodeId}` })
    if (!isValidMovieRating(score)) return response.status(400).json({ error: 'score must be between 1 and 5 in 0.5 increments' })
    try {
      await ensureTvDetailTables(pool)
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const savedRating = await upsertTvEpisodeRatingForUser(pool, { username: user.username, episodeId, score })
      if (savedRating.status !== 'ok') return response.status(404).json({ error: 'Episode was not found' })
      const result = await pool.query('SELECT tv_shows.tmdb_id FROM tv_episodes JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id JOIN tv_shows ON tv_shows.id = tv_seasons.tv_show_id WHERE tv_episodes.id = $1 LIMIT 1', [episodeId])
      const showId = result.rows[0]?.tmdb_id
      const detail = Number.isInteger(showId) ? await getTvDetailForUser(pool, { showId, username: user.username }) : null
      const newlyUnlockedAchievements = savedRating.entityId && await recordAchievementEventForUser(pool, { username: user.username, eventType: 'tv_rated', mediaType: 'tv', entityId: savedRating.entityId, baselineKind: 'tv_episode_rating', metadata: { score } }) ? await evaluateAchievementsForUser(pool, user.username) : []
      response.json({ score: savedRating.score, show: detail ? mapTvDetail(detail) : null, newlyUnlockedAchievements })
    } catch (error) { next(error) }
  })

  app.get('/api/movies/:movieId', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)

    if (!Number.isInteger(movieId)) {
      response.status(400).json({
        error: `Invalid movie id: ${request.params.movieId}`,
      })
      return
    }

    try {
      let movie = await getMovieByTmdbId(pool, movieId)

      if (shouldHydrateMovieDetail(movie)) {
        const config = loadRuntimeConfig()

        await hydrateMovie(pool, {
          token: config.tmdbBearerToken,
          baseUrl: config.tmdbBaseUrl,
          movieId,
          importRank: Number.isInteger(movie?.import_rank) ? movie.import_rank : 1,
        })

        movie = await getMovieByTmdbId(pool, movieId)
      }

      if (!movie) {
        response.status(404).json({
          error: `Movie ${movieId} could not be loaded from TMDB or the local database`,
        })
        return
      }

      const reviews = await loadMovieReviews(movieId, loadRuntimeConfig)
      const user = await getAuthenticatedUser(pool, request)
      const hasReleaseReminder = user
        ? await hasMovieReleaseReminderForUser(pool, { username: user.username, movieId })
        : false
      const communityRating = user
        ? await getMovieCommunityRating(pool, { movieId, username: user.username })
        : {
            status: 'ok',
            average: movie.community_rating_average === null || movie.community_rating_average === undefined
              ? null
              : Number(movie.community_rating_average),
            voteCount: Number(movie.community_rating_vote_count ?? 0),
            yourScore: null,
          }

      response.json({
        movie: mapMovieDetail(movie, reviews, communityRating, hasReleaseReminder),
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/movies/:movieId/release-reminder', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)
    if (!Number.isInteger(movieId)) return response.status(400).json({ error: `Invalid movie id: ${request.params.movieId}` })

    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const result = await addMovieReleaseReminderForUser(pool, { username: user.username, movieId })
      if (result.status !== 'added') {
        const hasReleaseReminder = await hasMovieReleaseReminderForUser(pool, { username: user.username, movieId })
        if (!hasReleaseReminder) return response.status(409).json({ error: 'Only upcoming movies can be added to release reminders.' })
      }
      response.status(201).json({ hasReleaseReminder: true })
    } catch (error) {
      next(error)
    }
  })

  app.delete('/api/movies/:movieId/release-reminder', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)
    if (!Number.isInteger(movieId)) return response.status(400).json({ error: `Invalid movie id: ${request.params.movieId}` })

    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      await removeMovieReleaseReminderForUser(pool, { username: user.username, movieId })
      response.json({ hasReleaseReminder: false })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies/:movieId/filelist', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)
    if (!Number.isInteger(movieId)) return response.status(400).json({ error: `Invalid movie id: ${request.params.movieId}` })

    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      await ensureFilelistTables(pool)
      const storedCredentials = await getFilelistCredentials(pool, user.id)
      if (!storedCredentials) return response.status(409).json({ error: 'Set up your Filelist username and passkey in Admin before searching.' })
      const movie = await getMovieByTmdbId(pool, movieId)
      if (!movie) return response.status(404).json({ error: `Movie ${movieId} was not found in the local database` })

      const usage = await reserveFilelistRequest(pool, user.id)
      if (!usage.allowed) return response.status(429).json({ error: `Filelist limit reached. Wait ${usage.minutesUntilReset} minutes until the next reset.`, minutesUntilReset: usage.minutesUntilReset, resetAt: usage.resetAt })

      const config = loadRuntimeConfig()
      const url = buildFilelistSearchUrl({
        username: decryptFilelistValue(storedCredentials.encrypted_username, config.filelistEncryptionKey),
        passkey: decryptFilelistValue(storedCredentials.encrypted_passkey, config.filelistEncryptionKey),
        query: movie.title,
      })
      const upstream = await fetchImpl(url)
      const payload = await upstream.json().catch(() => null)
      if (!upstream.ok) throw new Error(`Filelist search failed with status ${upstream.status}`)
      response.json({ query: movie.title, results: mapFilelistResults(payload), usage: { count: usage.count, limit: 150, resetAt: usage.resetAt } })
    } catch (error) { next(error) }
  })

  app.get('/api/movies/:movieId/trailer', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)

    if (!Number.isInteger(movieId)) {
      response.status(400).json({ error: `Invalid movie id: ${request.params.movieId}` })
      return
    }

    try {
      const config = loadRuntimeConfig()
      const payload = await fetchMovieVideos(fetch, {
        token: config.tmdbBearerToken,
        baseUrl: config.tmdbBaseUrl,
        movieId,
      })
      const trailer = selectPlayableMovieTrailer(payload?.results)

      if (!trailer) {
        response.status(404).json({ error: 'No playable YouTube trailer is available for this movie.' })
        return
      }

      response.json({ trailer })
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/movies/:movieId/rating', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)
    const score = typeof request.body?.score === 'number' ? request.body.score : Number.NaN

    if (!Number.isInteger(movieId)) {
      response.status(400).json({ error: `Invalid movie id: ${request.params.movieId}` })
      return
    }

    if (!isValidMovieRating(score)) {
      response.status(400).json({ error: 'score must be between 1 and 5 in 0.5 increments' })
      return
    }

    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({ error: 'Authentication required' })
        return
      }

      const savedRating = await upsertMovieRatingForUser(pool, { username: user.username, movieId, score })

      if (savedRating.status === 'missing_movie') {
        response.status(404).json({ error: `Movie ${movieId} was not found in the local database` })
        return
      }

      if (savedRating.status === 'missing_user') {
        response.status(401).json({ error: 'Authentication required' })
        return
      }

      const communityRating = await getMovieCommunityRating(pool, { movieId, username: user.username })
      const newlyUnlockedAchievements = savedRating.entityId && await recordAchievementEventForUser(pool, { username: user.username, eventType: 'movie_rated', mediaType: 'movie', entityId: savedRating.entityId, baselineKind: 'movie_rating', metadata: { score } }) ? await evaluateAchievementsForUser(pool, user.username) : []
      response.json({ communityRating: mapCommunityRating(communityRating), newlyUnlockedAchievements })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies/:movieId/similar', async (request, response, next) => {
    const movieId = Number.parseInt(request.params.movieId, 10)

    if (!Number.isInteger(movieId)) {
      response.status(400).json({
        error: `Invalid movie id: ${request.params.movieId}`,
      })
      return
    }

    try {
      const movie = await getMovieByTmdbId(pool, movieId)

      if (!movie) {
        response.status(404).json({
          error: `Movie ${movieId} was not found in the local database`,
        })
        return
      }

      const movies = await listSimilarMovies(pool, movieId)

      response.json({
        count: movies.length,
        movies,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/people/:personId', async (request, response, next) => {
    const personId = Number.parseInt(request.params.personId, 10)

    if (!Number.isInteger(personId)) {
      response.status(400).json({
        error: `Invalid person id: ${request.params.personId}`,
      })
      return
    }

    try {
      const config = loadRuntimeConfig()
      const [personPayload, creditsPayload] = await Promise.all([
        fetchPersonDetails(fetch, {
          token: config.tmdbBearerToken,
          baseUrl: config.tmdbBaseUrl,
          personId,
        }),
        fetchPersonCombinedCredits(fetch, {
          token: config.tmdbBearerToken,
          baseUrl: config.tmdbBaseUrl,
          personId,
        }),
      ])

      const normalizedProfile = normalizePersonProfile(personPayload, creditsPayload)
      await syncPersonProfile(pool, normalizedProfile)

      const user = await getAuthenticatedUser(pool, request)
      const movieCreditIds = collectCreditIds(creditsPayload, 'movie')
      const tvCreditIds = collectCreditIds(creditsPayload, 'tv')
      const [movieSummaries, coStars, personalStates, personalHistory] = await Promise.all([
        listMovieSummariesByTmdbIds(pool, movieCreditIds),
        listCoStarsForPerson(pool, personId),
        user ? getPersonFilmographyPersonalStates(pool, { username: user.username, movieIds: movieCreditIds, tvIds: tvCreditIds }) : Promise.resolve({ movies: new Map(), tv: new Map() }),
        user ? getPersonHistoryForUser(pool, { username: user.username, movieIds: movieCreditIds, tvIds: tvCreditIds }) : Promise.resolve(null),
      ])

      response.json(
        mapPersonDetailPayload({
          person: personPayload,
          credits: creditsPayload,
          movieSummaries,
          coStars,
          personalStates,
          personalHistory,
        })
      )
    } catch (error) {
      next(error)
    }
  })

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      error: error.message || 'Unexpected server error',
    })
  })

  return app
}

function mapFeaturedMovie(movie) {
  if (!movie) {
    return null
  }

  return {
    id: movie.tmdb_id,
    title: movie.title,
    year: formatMovieYear(movie.release_date),
    genres: Array.isArray(movie.genre_names) ? movie.genre_names : [],
    rating: movie.certification || 'NR',
    runtime: formatRuntime(movie.runtime_minutes),
    score: formatScore(movie.vote_average),
    audience: formatVoteCount(movie.vote_count),
    summary: movie.overview || 'Overview not available yet.',
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
  }
}

function mapTmdbMovieSearchResult(movie) {
  return {
    id: movie?.id,
    title: movie?.title || 'Untitled',
    year: formatMovieYear(movie?.release_date),
    rating: formatSearchCardRating(movie?.vote_average),
    meta: movie?.release_date ? 'Movie' : 'Release TBA',
    releaseDate: movie?.release_date || null,
    posterUrl: resolvePosterPath(movie?.poster_path),
    theme: 'theme-catalog',
  }
}

function mapIgdbGameSearchResult(game) {
  const coverImageId = typeof game?.cover?.image_id === 'string' ? game.cover.image_id : null
  const rating = Number.isFinite(game?.rating) ? game.rating : Number.isFinite(game?.aggregated_rating) ? game.aggregated_rating : null
  return {
    id: Number(game?.id),
    title: typeof game?.name === 'string' && game.name.trim() ? game.name.trim() : 'Untitled',
    summary: typeof game?.summary === 'string' ? game.summary : 'Description not available yet.',
    coverUrl: coverImageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverImageId}.jpg` : null,
    rating: rating === null ? 'N/A' : rating.toFixed(1),
    playersLabel: '',
    meta: Number.isFinite(game?.first_release_date) ? `Released ${new Date(game.first_release_date * 1000).getUTCFullYear()}` : 'Release date unavailable',
  }
}

function mapMovieSearchSuggestion(movie) {
  return {
    kind: 'movie', id: movie.tmdb_id, label: movie.title || 'Untitled', meta: movie.release_date ? `Movie · ${formatMovieYear(movie.release_date)}` : 'Movie', imageUrl: resolvePosterPath(movie.poster_path), popularity: Number(movie.popularity) || 0,
  }
}

function mapTvSearchSuggestion(show) {
  return {
    kind: 'tv', id: show.tmdb_id, label: show.name || 'Untitled', meta: show.first_air_date ? `TV · ${formatMovieYear(show.first_air_date)}` : 'TV Series', imageUrl: resolvePosterPath(show.poster_path), popularity: Number(show.popularity) || 0,
  }
}

function mapBookSearchSuggestion(book) {
  return {
    kind: 'book', id: book.google_books_id, label: book.title || 'Untitled', meta: Array.isArray(book.authors) && book.authors.length ? `Book · ${book.authors.join(', ')}` : 'Book', imageUrl: book.cover_image_url || null, popularity: 0,
  }
}

function mapPersonSearchSuggestion(person) {
  return {
    kind: 'person', id: person.tmdb_person_id, label: person.name || 'Unknown performer', meta: person.known_for_department || 'Person', imageUrl: resolvePosterPath(person.profile_path), popularity: Number(person.popularity) || 0,
  }
}

function findSearchAlternatives(query, labels) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []
  const maximumDistance = Math.max(2, Math.floor(normalizedQuery.length * 0.45))
  return [...new Set(labels.map((label) => String(label).trim()).filter(Boolean))]
    .map((label) => ({ label, distance: Math.min(...[normalizeSearchText(label), ...String(label).split(/\s+/).map(normalizeSearchText)].filter(Boolean).map((candidate) => levenshteinDistance(normalizedQuery, candidate))) }))
    .filter((item) => item.distance <= maximumDistance)
    .sort((left, right) => left.distance - right.distance || left.label.localeCompare(right.label))
    .slice(0, 4)
    .map((item) => item.label)
}

function normalizeSearchText(value) {
  return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_value, index) => index)
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0]
    previous[0] = row
    for (let column = 1; column <= right.length; column += 1) {
      const current = previous[column]
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (left[row - 1] === right[column - 1] ? 0 : 1))
      diagonal = current
    }
  }
  return previous[right.length]
}

function mapTmdbTvSearchResult(show) {
  return {
    id: show?.id,
    title: show?.name || 'Untitled',
    year: formatMovieYear(show?.first_air_date),
    rating: formatSearchCardRating(show?.vote_average),
    meta: 'TV Series',
    seasonMeta: 'TV Series',
    genreLabel: 'Genre TBA',
    maturityRating: 'TV Series',
    audience: formatVoteCount(show?.vote_count),
    description: show?.overview || 'Overview not available yet.',
    posterUrl: resolvePosterPath(show?.poster_path),
    backdropUrl: resolveBackdropPath(show?.backdrop_path),
    theme: 'theme-catalog',
  }
}

function mapTmdbPersonSuggestion(person) {
  return {
    id: person.id,
    name: person.name || 'Unknown performer',
    profileUrl: resolveProfilePath(person.profile_path),
    knownFor: Array.isArray(person.known_for) ? person.known_for.map((title) => title.title || title.name).filter(Boolean).slice(0, 2) : [],
  }
}

function mapStoredKeywordSuggestion(keyword) {
  return { id: keyword.tmdb_keyword_id, name: keyword.name || 'Unnamed keyword' }
}

function parseOptionalDiscoverId(value) {
  if (value === undefined || value === '') return undefined
  const id = Number.parseInt(String(value), 10)
  return Number.isInteger(id) && id > 0 && String(id) === String(value) ? id : null
}

function parseDiscoverKeywordIds(value) {
  if (value === undefined || value === '') return []
  const values = String(value).split(',')
  if (!values.length || values.length > 3 || values.some((item) => !item)) return null
  const ids = values.map((item) => parseOptionalDiscoverId(item))
  return ids.every((id) => typeof id === 'number') && new Set(ids).size === ids.length ? ids : null
}

function mapFeaturedTvShow(show) {
  if (!show) {
    return null
  }

  const details = show.detail_payload ?? {}
  const episodeRuntime = Array.isArray(details.episode_run_time) ? details.episode_run_time.find((value) => typeof value === 'number' && value > 0) : null

  return {
    id: show.tmdb_id,
    title: show.name,
    year: formatMovieYear(show.first_air_date),
    genres: Array.isArray(show.genre_names) ? show.genre_names : [],
    rating: readTvMaturityRating(details),
    runtime: formatTvRuntime(episodeRuntime),
    score: formatScore(show.vote_average),
    audience: formatVoteCount(show.vote_count),
    summary: show.overview || 'Overview not available yet.',
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    episodesLabel: formatEpisodeCountLabel(details),
  }
}

function mapTvDetail(detail) {
  const { show, seasons, credits, recommendations, trailers, communityRating, yourEpisodeRating } = detail
  const payload = show.detail_payload ?? {}
  return {
    id: show.tmdb_id,
    title: show.name,
    overview: show.overview || 'Overview not available yet.',
    firstAirDate: show.first_air_date,
    genres: show.genre_names ?? [],
    maturityRating: readTvMaturityRating(payload),
    voteAverage: formatScore(show.vote_average),
    voteCount: formatVoteCount(show.vote_count),
    posterPath: show.poster_path,
    backdropPath: show.backdrop_path,
    status: payload.status || 'Unknown',
    network: Array.isArray(payload.networks) ? payload.networks[0]?.name ?? null : null,
    creators: Array.isArray(payload.created_by) ? payload.created_by.map((person) => person.name).filter(Boolean) : [],
    languages: Array.isArray(payload.spoken_languages) ? payload.spoken_languages.map((language) => language.english_name || language.name).filter(Boolean) : [],
    trailers: trailers.map((trailer) => ({ provider: trailer.provider, key: trailer.video_key, name: trailer.name })),
    communityRating: { average: typeof communityRating?.average === 'number' ? communityRating.average : null, voteCount: Number(communityRating?.voteCount ?? 0) },
    yourEpisodeRating: { average: typeof yourEpisodeRating?.average === 'number' ? yourEpisodeRating.average : null, ratingCount: Number(yourEpisodeRating?.ratingCount ?? 0) },
    seasons: seasons.filter((season) => Number(season.season_number) > 0).map((season) => ({
      id: season.id, seasonNumber: season.season_number, name: season.name, overview: season.overview, airDate: season.air_date, posterPath: season.poster_path,
      episodes: (season.episodes ?? []).map((episode) => ({ id: episode.id, tmdbId: episode.tmdb_id, episodeNumber: episode.episode_number, name: episode.name, overview: episode.overview, airDate: episode.air_date, runtimeMinutes: episode.runtime_minutes, stillPath: episode.still_path, isAired: Boolean(episode.is_aired), watched: Boolean(episode.watched), yourScore: episode.your_score === null || episode.your_score === undefined ? null : Number(episode.your_score) })),
    })),
    credits: credits.map((credit) => ({ id: credit.tmdb_person_id, name: credit.name, profilePath: credit.profile_path, role: credit.character_name || credit.job || credit.credit_type })),
    recommendations: recommendations.map((item) => ({ id: item.recommended_tmdb_id, title: item.name, firstAirDate: item.first_air_date, posterPath: item.poster_path, rating: formatScore(item.vote_average) })),
  }
}

function mapTvReview(review) {
  return {
    id: review?.id,
    author: review?.author || 'WatchVault member',
    rating: typeof review?.author_details?.rating === 'number' ? review.author_details.rating : null,
    copy: review?.content || '',
    date: review?.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently',
  }
}

function shouldHydrateMovieDetail(movie) {
  if (!movie) {
    return true
  }

  const hasStoredCredits = Boolean(movie.director) || (Array.isArray(movie.cast) && movie.cast.length > 0)

  return !movie.detail_payload || !movie.runtime_minutes || !movie.certification || !hasStoredCredits
}

async function loadMovieReviews(movieId, loadRuntimeConfig) {
  try {
    const config = loadRuntimeConfig()
    const payload = await fetchMovieReviews(fetch, {
      token: config.tmdbBearerToken,
      baseUrl: config.tmdbBaseUrl,
      movieId,
    })

    return Array.isArray(payload?.results) ? payload.results.map(mapMovieReview).filter(Boolean) : []
  } catch {
    return []
  }
}

function selectPlayableMovieTrailer(videos) {
  if (!Array.isArray(videos)) {
    return null
  }

  const youtubeTrailers = videos.filter((video) => (
    video?.site === 'YouTube' &&
    video?.type === 'Trailer' &&
    typeof video.key === 'string' &&
    video.key.trim()
  ))
  const selected = youtubeTrailers.find((video) => video.official === true) ?? youtubeTrailers[0]

  if (!selected) {
    return null
  }

  return {
    provider: 'YouTube',
    key: selected.key,
    name: typeof selected.name === 'string' && selected.name.trim() ? selected.name : 'Movie trailer',
  }
}

function selectPlayableGameTrailer(videos) {
  if (!Array.isArray(videos)) return null
  const selected = videos.find((video) => typeof video?.video_id === 'string' && video.video_id.trim())
  if (!selected) return null
  return {
    provider: 'YouTube',
    key: selected.video_id.trim(),
    name: typeof selected.name === 'string' && selected.name.trim() ? selected.name.trim() : 'Game trailer',
  }
}

function mapMovieDetail(movie, reviews = [], communityRating = null, hasReleaseReminder = false) {
  return {
    id: movie.tmdb_id,
    title: movie.title,
    year: formatMovieYear(movie.release_date),
    overview: movie.overview || 'Overview not available yet.',
    genres: Array.isArray(movie.genre_names) ? movie.genre_names : [],
    certification: movie.certification || 'NR',
    runtime: formatRuntime(movie.runtime_minutes),
    score: formatScore(movie.vote_average),
    audience: formatVoteCount(movie.vote_count),
    originalLanguage: movie.original_language || 'Unknown',
    releaseDate: movie.release_date || null,
    availability: readMovieAvailability(movie.detail_payload),
    hasReleaseReminder,
    posterUrl: resolvePosterPath(movie.poster_path),
    backdropUrl: resolveBackdropPath(movie.backdrop_path),
    director: movie.director
      ? {
          id: movie.director.id,
          name: movie.director.name,
          profileUrl: resolveProfilePath(movie.director.profile_path),
        }
      : null,
    cast: Array.isArray(movie.cast)
      ? movie.cast.map((castMember) => ({
          id: castMember.id,
          name: castMember.name,
          role: castMember.character_name || 'Role TBA',
          profileUrl: resolveProfilePath(castMember.profile_path),
          order: castMember.billing_order,
        }))
      : [],
    reviews: Array.isArray(reviews) ? reviews : [],
    communityRating: mapCommunityRating(communityRating),
  }
}

function mapCommunityRating(communityRating) {
  return {
    average: typeof communityRating?.average === 'number' ? communityRating.average : null,
    voteCount: Number.isInteger(communityRating?.voteCount) ? communityRating.voteCount : 0,
    yourScore: typeof communityRating?.yourScore === 'number' ? communityRating.yourScore : null,
  }
}

function normalizeGameTimeToBeatSeconds(value) {
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : null
}

function mapGameTimeToBeat(timeToBeat) {
  if (!timeToBeat) return null
  return {
    mainStory: normalizeGameTimeToBeatSeconds(timeToBeat.hastily),
    mainAndExtras: normalizeGameTimeToBeatSeconds(timeToBeat.normally),
    completionist: normalizeGameTimeToBeatSeconds(timeToBeat.completely),
  }
}

function mapGameTracking(tracking) {
  if (!tracking) return null
  return {
    status: tracking.status, libraryAddedAt: tracking.library_added_at ?? tracking.libraryAddedAt ?? null,
    startedAt: tracking.started_at ?? tracking.startedAt ?? null, completedAt: tracking.completed_at ?? tracking.completedAt ?? null,
    platform: tracking.platform ?? null, difficulty: tracking.difficulty ?? null,
    difficultyRating: tracking.difficulty_rating ?? tracking.difficultyRating ?? null,
    completionPercent: tracking.completion_percent ?? tracking.completionPercent ?? null,
    playtimeMinutes: Number(tracking.playtime_minutes ?? tracking.playtimeMinutes ?? 0), review: tracking.review ?? null,
    metadata: tracking.completion_metadata ?? tracking.metadata ?? { tags: {} },
  }
}

function mapGameDetail(game, communityRating, personal, timeToBeat = null, tracking = null) {
  return {
    id: Number(game.igdb_id),
    title: game.title || 'Untitled',
    summary: game.summary || 'Description not available yet.',
    coverUrl: game.cover_image_url || null,
    releaseDate: game.release_date || null,
    rating: game.rating === null || game.rating === undefined ? null : Number(game.rating),
    ratingCount: Number(game.rating_count ?? 0),
    aggregatedRating: game.aggregated_rating === null || game.aggregated_rating === undefined ? null : Number(game.aggregated_rating),
    aggregatedRatingCount: Number(game.aggregated_rating_count ?? 0),
    steamPeakPlayers: game.steam_peak_players === null || game.steam_peak_players === undefined ? null : Number(game.steam_peak_players),
    platforms: Array.isArray(game.platforms) ? game.platforms : [],
    genres: Array.isArray(game.genres) ? game.genres : [],
    igdbUrl: game.igdb_url || null,
    timeToBeat,
    communityRating: mapCommunityRating(communityRating),
    played: Boolean(personal?.played),
    ...(tracking ? { tracking: mapGameTracking(tracking) } : {}),
  }
}

function mapPlayedGame(game) {
  return {
    id: Number(game.igdb_id),
    title: game.title || 'Untitled',
    coverUrl: game.cover_image_url || null,
    releaseDate: game.release_date || null,
    rating: game.rating === null || game.rating === undefined
      ? (game.aggregated_rating === null || game.aggregated_rating === undefined ? null : Number(game.aggregated_rating))
      : Number(game.rating),
    steamPeakPlayers: game.steam_peak_players === null || game.steam_peak_players === undefined ? null : Number(game.steam_peak_players),
    playedAt: game.played_at || null,
  }
}

function mapLocalGameRecommendation(game) {
  return {
    id: Number(game.igdb_id),
    title: game.title || 'Untitled',
    coverUrl: game.cover_image_url || null,
    releaseDate: game.release_date || null,
    rating: game.rating === null || game.rating === undefined ? (game.aggregated_rating === null || game.aggregated_rating === undefined ? null : Number(game.aggregated_rating)) : Number(game.rating),
    genres: Array.isArray(game.genres) ? game.genres : [],
  }
}

function mapIgdbGameRecommendation(game) {
  const coverImageId = typeof game?.cover?.image_id === 'string' ? game.cover.image_id : null
  return {
    id: Number(game.id),
    title: typeof game.name === 'string' && game.name.trim() ? game.name.trim() : 'Untitled',
    coverUrl: coverImageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverImageId}.jpg` : null,
    releaseDate: Number.isFinite(game.first_release_date) ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null,
    rating: Number.isFinite(game.rating) ? game.rating : Number.isFinite(game.aggregated_rating) ? game.aggregated_rating : null,
    genres: Array.isArray(game.genres) ? game.genres.map((genre) => genre?.name).filter(Boolean) : [],
  }
}

function isValidMovieRating(score) {
  return Number.isFinite(score) && score >= 1 && score <= 5 && Number.isInteger(score * 2)
}

function mapMovieStats(stats) {
  return {
    moviesWatched: stats?.moviesWatched ?? 0,
    timeWatchedMinutes: stats?.timeWatchedMinutes ?? 0,
    watchlistCount: stats?.watchlistCount ?? 0,
    averageRating: stats?.averageRating ?? null,
  }
}

function mapTvStats(stats) {
  return {
    showsWatched: stats?.showsWatched ?? 0,
    episodesWatched: stats?.episodesWatched ?? 0,
    timeWatchedMinutes: stats?.timeWatchedMinutes ?? 0,
    watchlistCount: stats?.watchlistCount ?? 0,
  }
}

function readStatsPeriod(request, response) {
  const period = request.query?.period ?? 'month'
  if (['week', 'month', 'year'].includes(period)) return period
  response.status(400).json({ error: 'period must be one of: week, month, year' })
  return null
}

function readStatsTimeZone(request, response) {
  const timeZone = typeof request.query?.timeZone === 'string' && request.query.timeZone.trim() ? request.query.timeZone.trim() : 'UTC'

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
    return timeZone
  } catch {
    response.status(400).json({ error: 'timeZone must be a valid IANA timezone' })
    return null
  }
}

function normalizePersonProfile(person, credits) {
  return {
    tmdbPersonId: person.id,
    name: person.name,
    profilePath: person.profile_path || null,
    biography: person.biography || null,
    birthday: person.birthday || null,
    deathday: person.deathday || null,
    placeOfBirth: person.place_of_birth || null,
    knownForDepartment: person.known_for_department || null,
    popularity: typeof person.popularity === 'number' ? person.popularity : null,
    homepage: person.homepage || null,
    imdbId: person.imdb_id || null,
    detailPayload: person,
    creditsPayload: credits,
    lastSyncedAt: new Date().toISOString(),
  }
}

function collectCreditIds(credits, mediaType) {
  return [...new Set([
    ...(Array.isArray(credits?.cast) ? credits.cast : []),
    ...(Array.isArray(credits?.crew) ? credits.crew : []),
  ]
    .filter((entry) => entry?.media_type === mediaType && Number.isInteger(entry?.id))
    .map((entry) => entry.id))]
}

function mapPersonDetailPayload({ person, credits, movieSummaries, coStars, personalStates = { movies: new Map(), tv: new Map() }, personalHistory = null }) {
  const movieSummaryById = new Map(movieSummaries.map((movie) => [Number(movie.tmdb_id), movie]))
  const combinedCredits = [
    ...(Array.isArray(credits?.cast) ? credits.cast : []),
    ...(Array.isArray(credits?.crew) ? credits.crew : []),
  ]
  const movieCredits = combinedCredits.filter((entry) => entry?.media_type === 'movie' && Number.isInteger(entry?.id))
  const roles = Array.from(
    new Set(
      movieCredits
        .map((entry) => entry.character || entry.job || entry.known_for_department || entry.department)
        .filter(Boolean)
        .slice(0, 4)
    )
  )

  const filmography = buildFilmography(combinedCredits, movieSummaryById, personalStates)
  const nextRecommendation = personalHistory
    ? [...filmography]
        .filter((item) => !item.personal.watched && item.releaseDate && item.releaseDate <= new Date().toISOString().slice(0, 10))
        .sort((left, right) => (right.popularity ?? -1) - (left.popularity ?? -1) || (right.voteAverage ?? -1) - (left.voteAverage ?? -1))[0] ?? null
    : null

  return {
    person: {
      id: person.id,
      name: person.name,
      biography: person.biography || '',
      profileUrl: resolveProfilePath(person.profile_path),
      knownForDepartment: person.known_for_department || 'Performer',
      birthday: person.birthday || null,
      deathday: person.deathday || null,
      ageLabel: formatPersonAge(person.birthday, person.deathday),
      placeOfBirth: person.place_of_birth || 'Unknown',
      popularity: formatPopularity(person.popularity),
      roles,
      heroBackdropUrl: resolveBackdropFromCredits(movieCredits, movieSummaryById),
    },
    knownFor: buildKnownForCredits(combinedCredits, movieSummaryById),
    filmography,
    personalHistory: personalHistory ? { ...personalHistory, nextRecommendation } : null,
    coStars: Array.isArray(coStars)
      ? coStars.map((entry) => ({
          id: entry.tmdb_person_id,
          name: entry.name,
          profileUrl: resolveProfilePath(entry.profile_path),
          sharedCredits: entry.shared_credits,
          sharedTitles: Array.isArray(entry.shared_titles) ? entry.shared_titles : [],
        }))
      : [],
    facts: buildPersonFacts(person, movieCredits),
  }
}

function readPaginationQuery(request, { defaultLimit = 30 } = {}) {
  const requestedLimit = Number.parseInt(request.query.limit, 10)
  const requestedPage = Number.parseInt(request.query.page, 10)

  return {
    limit: Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : defaultLimit,
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  }
}

function readNewsFilters(request) {
  const parse = (key) => {
    const value = request.query[key]
    if (value === undefined || value === '') return null
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return Number.NaN
    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : Number.NaN
  }
  const actorId = parse('actor')
  const movieId = parse('movie')
  const showId = parse('show')
  if ([actorId, movieId, showId].some(Number.isNaN)) return { error: 'News filters must be positive integer IDs' }
  if (movieId && showId) return { error: 'Choose either a movie or a show filter' }
  return { actorId, movieId, showId }
}

function decodeHtmlEntities(value) {
  const namedEntities = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' }
  return String(value || '').replace(/&(#(?:x[0-9a-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity) => {
    if (entity[0] !== '#') return namedEntities[entity.toLocaleLowerCase()] ?? match
    const hexadecimal = entity[1]?.toLocaleLowerCase() === 'x'
    const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10)
    try {
      return Number.isInteger(codePoint) ? String.fromCodePoint(codePoint) : match
    } catch {
      return match
    }
  })
}

function buildPaginationPayload(pagination, hasNextPage) {
  return {
    page: pagination.page,
    pageSize: pagination.limit,
    hasNextPage,
    hasPreviousPage: pagination.page > 1,
  }
}

function mapMovieReview(review) {
  if (!review?.id || !review?.author || !review?.content) {
    return null
  }

  return {
    id: review.id,
    author: review.author,
    rating: formatReviewRating(review.author_details?.rating),
    date: formatReviewDate(review.updated_at || review.created_at),
    copy: review.content.trim(),
    url: typeof review.url === 'string' && review.url ? review.url : null,
  }
}

function formatMovieYear(releaseDate) {
  if (!releaseDate) {
    return 'Release TBA'
  }

  return String(releaseDate).slice(0, 4)
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function addMonthsToIsoMonth(month, amount) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function addDaysToIsoDate(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatIsoDate(date)
}

function formatRuntime(runtimeMinutes) {
  if (typeof runtimeMinutes !== 'number' || runtimeMinutes <= 0) {
    return 'Runtime TBA'
  }

  const hours = Math.floor(runtimeMinutes / 60)
  const minutes = runtimeMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

function readMovieStreamingService(detailPayload) {
  const providerResults = detailPayload?.['watch/providers']?.results

  if (!providerResults || typeof providerResults !== 'object') {
    return 'Streaming TBA'
  }

  const preferredRegion = providerResults.RO || providerResults.US || Object.values(providerResults)[0]
  const providers = preferredRegion?.flatrate

  if (!Array.isArray(providers) || !providers.length) {
    return 'Streaming TBA'
  }

  return providers.map((provider) => provider?.provider_name).filter(Boolean).slice(0, 2).join(' · ') || 'Streaming TBA'
}

export function readMovieAvailability(detailPayload) {
  const providerResults = detailPayload?.['watch/providers']?.results
  if (!providerResults || typeof providerResults !== 'object') return 'Availability TBA'

  const preferredRegion = providerResults.RO || providerResults.US || Object.values(providerResults)[0]
  const providerNames = (providers) => Array.isArray(providers) ? providers.map((provider) => provider?.provider_name).filter(Boolean).slice(0, 2) : []
  const streamingProviders = providerNames(preferredRegion?.flatrate)
  if (streamingProviders.length) return streamingProviders.join(' · ')

  const rentalProviders = providerNames(preferredRegion?.rent)
  if (rentalProviders.length) return `Rent on ${rentalProviders.join(' · ')}`

  const purchaseProviders = providerNames(preferredRegion?.buy)
  if (purchaseProviders.length) return `Buy on ${purchaseProviders.join(' · ')}`

  return 'Availability TBA'
}

function formatTvRuntime(runtimeMinutes) {
  if (typeof runtimeMinutes !== 'number' || Number.isNaN(runtimeMinutes) || runtimeMinutes <= 0) {
    return 'Runtime TBA'
  }

  return `${runtimeMinutes}m episodes`
}

function formatEpisodeCountLabel(details) {
  const { episodeCount, seasonCount } = getRegularTvCounts(details)

  if (episodeCount && episodeCount > 0) {
    return `${episodeCount} Episode${episodeCount === 1 ? '' : 's'}`
  }

  if (seasonCount && seasonCount > 0) {
    return `${seasonCount} Season${seasonCount === 1 ? '' : 's'}`
  }

  return 'Episodes TBA'
}

function getRegularTvCounts(details) {
  const seasons = Array.isArray(details?.seasons) ? details.seasons.filter((season) => Number(season?.season_number) > 0) : []
  if (!Array.isArray(details?.seasons)) {
    return {
      episodeCount: typeof details?.number_of_episodes === 'number' ? details.number_of_episodes : null,
      seasonCount: typeof details?.number_of_seasons === 'number' ? details.number_of_seasons : null,
    }
  }
  if (!seasons.length) return { episodeCount: null, seasonCount: null }
  const episodeCounts = seasons.map((season) => Number(season?.episode_count))
  return {
    episodeCount: episodeCounts.every(Number.isFinite) ? episodeCounts.reduce((total, count) => total + count, 0) : null,
    seasonCount: seasons.length,
  }
}

function readTvMaturityRating(details) {
  const contentRatings = Array.isArray(details?.content_ratings?.results) ? details.content_ratings.results : []
  const usRating = contentRatings.find((entry) => entry?.iso_3166_1 === 'US' && typeof entry?.rating === 'string' && entry.rating.trim())

  return usRating?.rating?.trim() || 'TV Series'
}

function formatScore(voteAverage) {
  if (typeof voteAverage !== 'number') {
    return 'N/A'
  }

  return `${voteAverage.toFixed(1)}/10`
}

function formatSearchCardRating(voteAverage) {
  return typeof voteAverage === 'number' ? voteAverage.toFixed(1) : 'N/A'
}

function formatVoteCount(voteCount) {
  if (typeof voteCount !== 'number') {
    return 'No votes'
  }

  if (voteCount >= 1000) {
    return `${(voteCount / 1000).toFixed(1)}k votes`
  }

  return `${voteCount} votes`
}

function formatReviewRating(rating) {
  if (typeof rating !== 'number') {
    return null
  }

  return `${rating.toFixed(1)}/10`
}

function formatReviewDate(value) {
  if (!value) {
    return 'Date unavailable'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Date unavailable'
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatPersonAge(birthday, deathday) {
  if (!birthday) {
    return 'Unknown'
  }

  const birthDate = new Date(birthday)
  const endDate = deathday ? new Date(deathday) : new Date()

  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 'Unknown'
  }

  let age = endDate.getUTCFullYear() - birthDate.getUTCFullYear()
  const hasHadBirthday =
    endDate.getUTCMonth() > birthDate.getUTCMonth() ||
    (endDate.getUTCMonth() === birthDate.getUTCMonth() && endDate.getUTCDate() >= birthDate.getUTCDate())

  if (!hasHadBirthday) {
    age -= 1
  }

  return age > 0 ? String(age) : 'Unknown'
}

function formatPopularity(value) {
  if (typeof value !== 'number') {
    return 'N/A'
  }

  return `${Math.round(value)}%`
}

function buildKnownForCredits(credits, movieSummaryById) {
  const seen = new Set()

  const candidates = credits
    .filter((entry) => ['movie', 'tv'].includes(entry?.media_type) && Number.isInteger(entry?.id))
    .filter((entry) => {
      const key = `${entry.media_type}:${entry.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((left, right) => {
      const leftPopularity = typeof left.popularity === 'number' ? left.popularity : -1
      const rightPopularity = typeof right.popularity === 'number' ? right.popularity : -1

      return rightPopularity - leftPopularity
    })
  const selected = candidates.slice(0, 5)
  const keyFor = (entry) => `${entry.media_type}:${entry.id}`
  const highestRated = [...candidates].sort((left, right) => (Number(right.vote_average) || -1) - (Number(left.vote_average) || -1))[0]
  const earliestActing = [...candidates]
    .filter((entry) => entry.character || entry.department === 'Acting')
    .sort((left, right) => (Date.parse(left.release_date || left.first_air_date || '') || Number.MAX_SAFE_INTEGER) - (Date.parse(right.release_date || right.first_air_date || '') || Number.MAX_SAFE_INTEGER))[0]

  return selected.map((entry, index) => {
    const key = keyFor(entry)
    const reason = index === 0 ? 'Most popular'
      : highestRated && key === keyFor(highestRated) ? 'Highest rated'
        : earliestActing && key === keyFor(earliestActing) ? 'Early career role'
          : 'Popular credit'
    return { ...mapCreditToMovieCard(entry, movieSummaryById), knownForReason: reason }
  })
}

function buildFilmography(credits, movieSummaryById, personalStates) {
  const titles = new Map()

  for (const entry of credits) {
    if (!['movie', 'tv'].includes(entry?.media_type) || !Number.isInteger(entry?.id)) continue
    const key = `${entry.media_type}:${entry.id}`
    const current = titles.get(key) ?? { ...entry, roles: [], creditCategories: new Set() }
    const role = entry.character || entry.job || 'Credit'
    if (!current.roles.includes(role)) current.roles.push(role)
    const category = getCreditCategory(entry)
    if (category) current.creditCategories.add(category)
    titles.set(key, current)
  }

  return [...titles.values()]
    .map((entry) => {
      const isMovie = entry.media_type === 'movie'
      const summary = isMovie ? movieSummaryById.get(Number(entry.id)) : null
      const releaseDate = summary?.release_date || entry.release_date || entry.first_air_date || null
      const voteAverage = Number(summary?.vote_average ?? entry.vote_average)
      const personal = (isMovie ? personalStates.movies : personalStates.tv).get(Number(entry.id)) ?? { watchlisted: false, watched: false, yourScore: null, ratingCount: 0 }
      const year = formatMovieYear(releaseDate)
      const numericYear = /^\d{4}$/.test(year) ? Number(year) : null

      return {
        id: entry.id,
        mediaType: entry.media_type,
        title: summary?.title || entry.title || entry.name || 'Untitled',
        year,
        releaseDate,
        decade: numericYear === null ? null : `${Math.floor(numericYear / 10) * 10}s`,
        roles: entry.roles,
        role: entry.roles.join(' · '),
        creditCategories: [...entry.creditCategories],
        popularity: Number.isFinite(Number(entry.popularity)) ? Number(entry.popularity) : null,
        voteAverage: Number.isFinite(voteAverage) && voteAverage > 0 ? voteAverage : null,
        rating: Number.isFinite(voteAverage) && voteAverage > 0 ? formatScore(voteAverage) : 'N/A',
        posterUrl: resolvePosterPath(summary?.poster_path || entry.poster_path || null),
        personal,
      }
    })
    .sort((left, right) => (Date.parse(right.releaseDate || '') || 0) - (Date.parse(left.releaseDate || '') || 0) || left.title.localeCompare(right.title))
}

function getCreditCategory(entry) {
  if (entry.character || entry.department === 'Acting') return 'acting'
  if (entry.department === 'Directing') return 'directing'
  if (entry.department === 'Production') return 'producing'
  return null
}

function buildPersonFacts(person, movieCredits) {
  const departments = new Set(movieCredits.map((entry) => entry.department || entry.known_for_department).filter(Boolean))

  return [
    { label: 'Birthdate', value: person.birthday || 'Unknown' },
    { label: 'Birthplace', value: person.place_of_birth || 'Unknown' },
    { label: 'Known For', value: person.known_for_department || 'Unknown' },
    { label: 'Credits', value: String(movieCredits.length) },
    { label: 'Departments', value: departments.size > 0 ? [...departments].slice(0, 2).join(', ') : 'Unknown' },
    { label: 'Popularity', value: formatPopularity(person.popularity) },
  ]
}

function resolveBackdropFromCredits(movieCredits, movieSummaryById) {
  const creditWithBackdrop = movieCredits.find((entry) => {
    const summary = movieSummaryById.get(Number(entry.id))
    return Boolean(summary?.backdrop_path || entry.backdrop_path)
  })

  if (!creditWithBackdrop) {
    return null
  }

  const summary = movieSummaryById.get(Number(creditWithBackdrop.id))
  return resolveBackdropPath(summary?.backdrop_path || creditWithBackdrop.backdrop_path || null)
}

function mapCreditToMovieCard(entry, movieSummaryById) {
  const isMovie = entry.media_type === 'movie'
  const summary = isMovie ? movieSummaryById.get(Number(entry.id)) : null

  return {
    id: entry.id,
    mediaType: isMovie ? 'movie' : 'tv',
    title: summary?.title || entry.title || entry.name || 'Untitled',
    year: formatMovieYear(summary?.release_date || entry.release_date || entry.first_air_date || null),
    meta: entry.character || entry.job || 'Credit',
    posterUrl: resolvePosterPath(summary?.poster_path || entry.poster_path || null),
    backdropUrl: resolveBackdropPath(summary?.backdrop_path || entry.backdrop_path || null),
    rating: summary?.vote_average ? formatScore(summary.vote_average) : formatScore(entry.vote_average),
  }
}

function resolvePosterPath(posterPath) {
  if (!posterPath) {
    return null
  }

  return `https://image.tmdb.org/t/p/w500${posterPath}`
}

function resolveBackdropPath(backdropPath) {
  if (!backdropPath) {
    return null
  }

  return `https://image.tmdb.org/t/p/w1280${backdropPath}`
}

function resolveProfilePath(profilePath) {
  if (!profilePath) {
    return null
  }

  return `https://image.tmdb.org/t/p/w185${profilePath}`
}

async function getAuthenticatedUser(pool, request) {
  const usernameHeader = request.get('x-watchvault-username')
  const username = typeof usernameHeader === 'string' ? usernameHeader.trim() : ''

  if (!username) {
    return null
  }

  return findUserByUsername(pool, username)
}

function mapWatchlistMovie(movie) {
  return {
    id: movie.tmdb_id,
    title: movie.title,
    year: formatMovieYear(movie.release_date),
    meta: Array.isArray(movie.genre_names) && movie.genre_names.length > 0 ? movie.genre_names.join(', ') : 'Genre TBA',
    rating: typeof movie.vote_average === 'number' ? movie.vote_average : 0,
    type: 'Movies',
    posterUrl: resolvePosterPath(movie.poster_path),
    backdropUrl: resolveBackdropPath(movie.backdrop_path),
    runtime: formatRuntime(movie.runtime_minutes),
    streamingService: readMovieStreamingService(movie.detail_payload),
    watchlistedAt: movie.watchlisted_at ?? null,
    ...Object.hasOwn(movie, 'top_slot') ? { releaseDate: movie.release_date ?? null, runtimeMinutes: Number.isInteger(movie.runtime_minutes) ? movie.runtime_minutes : null, topSlot: movie.top_slot === null ? null : Number(movie.top_slot), queuePosition: movie.queue_position === null ? null : Number(movie.queue_position), hasReleaseReminder: Boolean(movie.has_release_reminder) } : {},
  }
}

function mapWatchTogetherUser(user) {
  return { username: user.username, fullName: user.full_name }
}

function mapWatchTogetherMovie(movie) {
  return {
    mediaType: 'movie',
    id: Number(movie.tmdb_id),
    title: movie.title,
    year: formatMovieYear(movie.release_date),
    rating: typeof movie.vote_average === 'number' ? movie.vote_average : 0,
    posterUrl: resolvePosterPath(movie.poster_path),
    backdropUrl: resolveBackdropPath(movie.backdrop_path),
  }
}

function mapWatchTogetherTvShow(show) {
  return {
    mediaType: 'tv',
    id: Number(show.tmdb_id),
    title: show.name,
    year: formatMovieYear(show.first_air_date),
    rating: typeof show.vote_average === 'number' ? show.vote_average : 0,
    posterUrl: resolvePosterPath(show.poster_path),
    backdropUrl: resolveBackdropPath(show.backdrop_path),
  }
}

function mapWatchTogetherItem(item) {
  return item.media_type === 'tv'
    ? {
        mediaType: 'tv', id: Number(item.media_id), title: item.show_name,
        year: formatMovieYear(item.first_air_date), rating: typeof item.show_vote_average === 'number' ? item.show_vote_average : 0,
        posterUrl: resolvePosterPath(item.show_poster_path), backdropUrl: resolveBackdropPath(item.show_backdrop_path),
        episodeId: item.tv_episode_id === null || item.tv_episode_id === undefined ? null : Number(item.tv_episode_id),
        episodeTitle: item.episode_name || 'Episode', seasonNumber: Number(item.season_number) || 0, episodeNumber: Number(item.episode_number) || 0,
        selected: Boolean(item.is_selected), pickVoteStatus: item.pick_vote_status || null, pickProposedAt: item.pick_proposed_at ?? null, addedAt: item.created_at, confirmedByCurrentUser: Boolean(item.confirmed_by_current_user), confirmedByPartner: Boolean(item.confirmed_by_partner),
      }
    : {
        mediaType: 'movie', id: Number(item.media_id), title: item.title,
        year: formatMovieYear(item.release_date), rating: typeof item.vote_average === 'number' ? item.vote_average : 0,
        posterUrl: resolvePosterPath(item.poster_path), backdropUrl: resolveBackdropPath(item.backdrop_path),
        selected: Boolean(item.is_selected), pickVoteStatus: item.pick_vote_status || null, pickProposedAt: item.pick_proposed_at ?? null, addedAt: item.created_at, confirmedByCurrentUser: Boolean(item.confirmed_by_current_user), confirmedByPartner: Boolean(item.confirmed_by_partner),
      }
}

function mapWatchedTogetherMovie(movie) {
  return {
    mediaType: 'movie', id: Number(movie.tmdb_id), title: movie.title,
    year: formatMovieYear(movie.release_date), rating: typeof movie.vote_average === 'number' ? movie.vote_average : 0,
    posterUrl: resolvePosterPath(movie.poster_path), backdropUrl: resolveBackdropPath(movie.backdrop_path),
    watchedTogetherAt: movie.watched_together_at,
    sessionDetails: movie.session_details || null,
    sessionAchievementIds: Array.isArray(movie.session_achievement_ids) ? movie.session_achievement_ids : [],
  }
}

function mapWatchedTogetherEpisode(episode) {
  return {
    mediaType: 'tv', id: Number(episode.show_id), title: episode.show_name,
    posterUrl: resolvePosterPath(episode.show_poster_path), episodeId: Number(episode.episode_id),
    episodeTitle: episode.episode_name || 'Episode', seasonNumber: Number(episode.season_number), episodeNumber: Number(episode.episode_number),
    watchedTogetherAt: episode.watched_together_at,
    sessionDetails: episode.session_details || null,
    sessionAchievementIds: Array.isArray(episode.session_achievement_ids) ? episode.session_achievement_ids : [],
  }
}

function mapWatchTogetherInProgressShow(show) {
  return {
    id: Number(show.show_id), title: show.show_name, posterUrl: resolvePosterPath(show.show_poster_path),
    watchedEpisodeCount: Number(show.watched_episode_count), latestEpisodeTitle: show.latest_episode_name || 'Episode',
    latestSeasonNumber: Number(show.latest_season_number), latestEpisodeNumber: Number(show.latest_episode_number),
    lastWatchedTogetherAt: show.last_watched_together_at,
  }
}

function mapWatchTogetherStats(stats) {
  const mapDashboard = (dashboard) => ({
    ...dashboard,
    topRated: dashboard.topRated.map(mapItem),
    recentHistory: dashboard.recentHistory.map(mapItem),
    actors: dashboard.actors.map((actor) => ({ ...actor, profileUrl: resolvePosterPath(actor.profilePath), profilePath: undefined })),
  })
  const mapItem = (item) => ({ ...item, posterUrl: resolvePosterPath(item.posterPath), posterPath: undefined })
  return { movies: mapDashboard(stats.movies), shows: mapDashboard(stats.shows) }
}

function mapWatchlistBook(book) {
  return {
    id: book.google_books_id,
    title: book.title,
    year: book.published_date ? String(book.published_date).slice(0, 4) : 'Publication TBA',
    meta: Array.isArray(book.authors) && book.authors.length > 0 ? book.authors.join(', ') : 'Author TBA',
    categoriesLabel: Array.isArray(book.categories) && book.categories.length > 0 ? book.categories.join(', ') : 'Category TBA',
    type: 'Books',
    posterUrl: book.cover_image_url || null,
    watchlistedAt: book.watchlisted_at ?? null,
    ...Object.hasOwn(book, 'top_slot') ? { releaseDate: book.published_date ?? null, pageCount: Number.isInteger(book.page_count) ? book.page_count : null, topSlot: book.top_slot === null ? null : Number(book.top_slot), queuePosition: book.queue_position === null ? null : Number(book.queue_position) } : {},
  }
}

function mapReadBook(book) {
  return {
    ...mapWatchlistBook(book),
    readAt: book.read_at ?? null,
    readingFormat: book.reading_format ?? 'physical',
    completionMetadata: book.completion_metadata && typeof book.completion_metadata === 'object' && !Array.isArray(book.completion_metadata) ? book.completion_metadata : {},
  }
}

function mapAlert(alert) {
  return {
    id: Number(alert.id),
    kind: alert.kind,
    title: alert.title,
    message: alert.message,
    createdAt: alert.created_at,
    readAt: alert.read_at,
    movieId: alert.movie_tmdb_id === null || alert.movie_tmdb_id === undefined ? null : Number(alert.movie_tmdb_id),
    showId: alert.tv_show_tmdb_id === null || alert.tv_show_tmdb_id === undefined ? null : Number(alert.tv_show_tmdb_id),
    watchTogetherRequestId: alert.watch_together_request_id === null || alert.watch_together_request_id === undefined ? null : Number(alert.watch_together_request_id),
    watchTogetherRequestStatus: alert.watch_together_request_status || null,
  }
}

function isValidIanaTimezone(timezone) {
  if (!timezone || timezone.length > 100) return false
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

function mapCalendarEvent(event) {
  const seasonNumber = event.season_number === null || event.season_number === undefined ? null : Number(event.season_number)
  const episodeNumber = event.episode_number === null || event.episode_number === undefined ? null : Number(event.episode_number)
  const episodeLabel = Number.isInteger(seasonNumber) && Number.isInteger(episodeNumber)
    ? `S${seasonNumber} E${episodeNumber}`
    : null

  return {
    date: event.event_date,
    mediaType: event.media_type === 'tv' ? 'tv' : 'movie',
    mediaId: Number(event.media_id),
    episodeId: event.episode_id === null || event.episode_id === undefined ? null : Number(event.episode_id),
    title: event.title,
    episodeTitle: event.episode_title || null,
    seasonNumber,
    episodeNumber,
    episodeLabel,
    posterUrl: resolvePosterPath(event.poster_path),
    backdropUrl: resolveBackdropPath(event.still_path || event.backdrop_path),
  }
}

function mapFavoriteActor(actor) {
  return {
    id: actor.tmdb_person_id,
    name: actor.name,
    profileUrl: resolveProfilePath(actor.profile_path),
    role: actor.known_for_department || 'Actor',
    popularity: typeof actor.popularity === 'number' ? actor.popularity : 0,
    favoritedAt: actor.favorited_at ?? null,
  }
}

function mapFavoriteAuthor(author) {
  return {
    id: author.id,
    name: author.name,
    favoritedAt: author.favorited_at ?? null,
  }
}

function mapWatchlistTvShow(show) {
  return {
    id: show.tmdb_id,
    title: show.name,
    year: formatMovieYear(show.first_air_date),
    meta: Array.isArray(show.genre_names) && show.genre_names.length > 0 ? show.genre_names.join(', ') : 'Genre TBA',
    rating: typeof show.vote_average === 'number' ? show.vote_average : 0,
    type: 'TV Shows',
    posterUrl: resolvePosterPath(show.poster_path),
    backdropUrl: resolveBackdropPath(show.backdrop_path),
    watchlistedAt: show.watchlisted_at ?? null,
    ...Object.hasOwn(show, 'top_slot') ? { releaseDate: show.first_air_date ?? null, runtimeMinutes: Number.isInteger(show.runtime_minutes) ? show.runtime_minutes : null, streamingService: show.network || 'Streaming TBA', nextEpisodeDate: show.next_episode_date ?? null, nextEpisodeName: show.next_episode_name || null, topSlot: show.top_slot === null ? null : Number(show.top_slot), queuePosition: show.queue_position === null ? null : Number(show.queue_position) } : {},
  }
}

function mapContinueWatchingTvShow(show) {
  const watchedEpisodeCount = Number(show.watched_episode_count) || 0
  const airedEpisodeCount = Number(show.aired_episode_count) || 0
  const details = show.detail_payload ?? {}
  const detailEpisodeRuntime = Array.isArray(details.episode_run_time) ? details.episode_run_time.find((value) => typeof value === 'number' && value > 0) : null
  const episodeRuntime = Number(show.next_episode_runtime_minutes) || detailEpisodeRuntime || Number(show.remaining_episode_runtime_minutes) || null
  const network = Array.isArray(details.networks) ? details.networks.find((item) => item?.name)?.name : null
  const nextSeasonNumber = Number(show.next_season_number)
  const nextEpisodeNumber = Number(show.next_episode_number)
  const nextEpisodeLabel = Number.isInteger(nextSeasonNumber) && Number.isInteger(nextEpisodeNumber)
    ? `S${nextSeasonNumber} E${nextEpisodeNumber}`
    : 'Next episode'

  return {
    id: show.tmdb_id,
    title: show.name,
    posterUrl: resolvePosterPath(show.poster_path),
    backdropUrl: resolveBackdropPath(show.backdrop_path),
    watchedEpisodeCount,
    airedEpisodeCount,
    progress: airedEpisodeCount > 0 ? Math.round((watchedEpisodeCount / airedEpisodeCount) * 100) : 0,
    latestWatchedEpisodeLabel: `S${show.latest_watched_season_number} E${show.latest_watched_episode_number}`,
    nextEpisodeLabel,
    nextEpisodeTitle: show.next_episode_name || 'Next episode',
    runtime: formatTvRuntime(episodeRuntime),
    streamingService: network || 'Streaming TBA',
    lastWatchedAt: show.last_watched_at ?? null,
  }
}

function mapWatchedTvEpisode(episode) {
  return {
    showId: Number(episode.show_id),
    showTitle: episode.show_name,
    showPosterUrl: resolvePosterPath(episode.show_poster_path),
    episodeId: Number(episode.episode_id),
    episodeTitle: episode.episode_name || `Episode ${episode.episode_number}`,
    seasonNumber: Number(episode.season_number),
    episodeNumber: Number(episode.episode_number),
    watchedAt: episode.watched_at ?? null,
  }
}

function sanitizeBookCompletionMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const allowed = new Set(['favorite', 'translated', 'newAuthor', 'seriesStarted', 'seriesFinished', 'classic', 'library', 'recommended', 'plotTwist', 'madeCry', 'madeLaugh', 'fictionalCrush', 'foundFamily', 'villainFavorite', 'enemiesToLovers', 'slowBurn', 'cozy', 'vacation', 'coverEnjoyed', 'coverRegretted', 'hyped', 'dnf', 'moodRead', 'adaptationWatched', 'bookWasBetter', 'adaptationWon', 'mapUsed', 'trickyNames', 'slumpEscape'])
  const metadata = {}
  for (const key of allowed) if (value[key] === true) metadata[key] = true
  if (Array.isArray(value.tropes)) metadata.tropes = [...new Set(value.tropes.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim().slice(0, 60)))].slice(0, 10)
  return metadata
}

function mapLatestEpisodeTvShow(show) {
  return {
    id: show.tmdb_id,
    title: show.name,
    posterUrl: resolvePosterPath(show.poster_path),
    backdropUrl: resolveBackdropPath(show.backdrop_path),
    popularity: typeof show.popularity === 'number' ? show.popularity : 0,
    latestEpisode: {
      seasonNumber: show.season_number,
      episodeNumber: show.episode_number,
      title: show.episode_name || `Episode ${show.episode_number}`,
      airDate: show.air_date,
    },
  }
}

function mapWatchedMovie(movie) {
  return {
    id: movie.tmdb_id,
    title: movie.title,
    year: formatMovieYear(movie.release_date),
    meta: Array.isArray(movie.genre_names) && movie.genre_names.length > 0 ? movie.genre_names.join(', ') : 'Genre TBA',
    rating: typeof movie.vote_average === 'number' ? movie.vote_average : 0,
    type: 'Movies',
    posterUrl: resolvePosterPath(movie.poster_path),
    backdropUrl: resolveBackdropPath(movie.backdrop_path),
    watchedAt: movie.watched_at ?? null,
    runtimeMinutes: typeof movie.runtime_minutes === 'number' ? movie.runtime_minutes : 0,
  }
}
