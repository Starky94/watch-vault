import express from 'express'
import { loadConfig } from './config.js'
import {
  addMovieToWatchlistForUser,
  addBookToWatchlistForUser,
  addBookToReadForUser,
  addMovieToWatchedForUser,
  countActors,
  countBooks,
  countMovies,
  countStoredDataBytes,
  countTvShows,
  getBookByGoogleBooksId,
  getAuthorById,
  getBookCommunityRating,
  ensureFavoriteActorsTable,
  ensureAchievementTables,
  ensureTvDetailTables,
  ensureMoviesTable,
  ensureBooksTable,
  evaluateAchievementsForUser,
  evaluateBookAchievementsForUser,
  getAchievementsForUser,
  getBookAchievementsForUser,
  findUserByCredentials,
  findUserByUsername,
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
  getTvLibraryForUser,
  getTvDetailForUser,
  getTvStatsForUser,
  getTvShowByTmdbId,
  getMovieByTmdbId,
  listCoStarsForPerson,
  listFavoriteActorsForUser,
  listFavoriteAuthorsForUser,
  listAuthorsForBook,
  listBooksForAuthor,
  listGenres,
  listMovieSummariesByTmdbIds,
  searchActors,
  searchBooks,
  searchMovies,
  searchTvShows,
  listWatchlistMoviesForUser,
  listWatchlistBooksForUser,
  listReadBooksForUser,
  listCalendarEventsForUser,
  listWatchedMoviesByGenreForUser,
  listWatchedMoviesForUser,
  listMovies,
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
import { fetchMovieReviews, fetchMovieVideos, fetchPersonCombinedCredits, fetchPersonDetails, fetchTvReviews, searchMovies as searchTmdbMovies, searchTvShows as searchTmdbTvShows } from './tmdbClient.js'
import { hydrateMovieByTmdbId } from './movieImportService.js'
import { hydrateTvShowByTmdbId } from './tvImportService.js'
import { normalizeBook, sanitizeBookDescription } from './bookImportService.js'
import { fetchBookById, fetchRelatedBooksByCategory, searchBooksByTitle } from './googleBooksClient.js'

const bookReadingFormats = new Set(['physical', 'ebook', 'audiobook'])

function sanitizeStoredBookDescription(book) {
  return book ? { ...book, description: sanitizeBookDescription(book.description) } : book
}

export async function createApp(pool, options = {}) {
  const {
    jobs = adminJobs,
    hydrateMovie = hydrateMovieByTmdbId,
    hydrateTvShow = hydrateTvShowByTmdbId,
    loadRuntimeConfig = () =>
      loadConfig({
        requireDatabase: false,
        requireTmdbToken: true,
      }),
  } = options

  await ensureMoviesTable(pool)
  await ensureBooksTable(pool)
  await ensureTvDetailTables(pool)
  await ensureAchievementTables(pool)

  const app = express()
  app.use(express.json())

  app.get('/api/health', async (_request, response) => {
    response.json({ ok: true })
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
      const [movies, shows, actors, books] = await Promise.all([
        searchMovies(pool, query),
        searchTvShows(pool, query),
        searchActors(pool, query),
        searchBooks(pool, query),
      ])

      response.json({ query, movies, shows, actors, books })
    } catch (error) {
      next(error)
    }
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

      const [movies, books] = await Promise.all([
        listWatchlistMoviesForUser(pool, user.username),
        listWatchlistBooksForUser(pool, user.username),
      ])

      response.json({
        count: movies.length + books.length,
        movies: movies.map(mapWatchlistMovie),
        books: books.map(mapWatchlistBook),
      })
    } catch (error) {
      next(error)
    }
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

      const result = await addMovieToWatchlistForUser(pool, {
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

      const result = await addMovieToWatchedForUser(pool, {
        username: user.username,
        movieId,
        watchService: request.body?.watchService,
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
    if (kind !== 'watchlist' || !Number.isInteger(showId)) return response.status(400).json({ error: 'Only TV watchlist updates are supported' })
    try {
      const user = await getAuthenticatedUser(pool, request)
      if (!user) return response.status(401).json({ error: 'Authentication required' })
      const period = readStatsPeriod(request, response)
      if (!period) return
      const result = await toggleTvLibraryItemForUser(pool, { username: user.username, showId, kind })
      if (result.status === 'missing_show') return response.status(404).json({ error: `TV show ${showId} was not found in the local database` })
      const [library, stats, watchlistShows] = await Promise.all([
        getTvLibraryForUser(pool, user.username),
        getTvStatsForUser(pool, user.username, period),
        listTvWatchlistShowsForUser(pool, user.username),
      ])
      const newlyUnlockedAchievements = result.added && await recordAchievementEventForUser(pool, { username: user.username, eventType: 'tv_watchlist_added', mediaType: 'tv', entityId: result.entityId, baselineKind: 'tv_watchlist' }) ? await evaluateAchievementsForUser(pool, user.username) : []
      response.json({ added: result.added, watchedIds: library.watchedIds, watchlistIds: library.watchlistIds, watchlistShows: watchlistShows.map(mapWatchlistTvShow), stats: mapTvStats(stats), newlyUnlockedAchievements })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/admin/overview', async (_request, response, next) => {
    try {
      response.json({
        crons: listAdminJobs(jobs),
        totals: {
          actors: await countActors(pool),
          books: await countBooks(pool),
          movies: await countMovies(pool),
          storedDataBytes: await countStoredDataBytes(pool),
          tvShows: await countTvShows(pool),
        },
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/admin/jobs/:jobKey/run', async (request, response, next) => {
    const job = findAdminJob(request.params.jobKey, jobs)

    if (!job) {
      response.status(404).json({
        error: `Unknown admin job: ${request.params.jobKey}`,
      })
      return
    }

    try {
      const config = loadRuntimeConfig()
      const result = await job.run(pool, job.source === 'google-books'
        ? { apiKey: config.googleBooksApiKey, baseUrl: config.googleBooksBaseUrl }
        : { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, count: 30 })

      response.json({
        job: job.key,
        fetchedCount: result.fetchedCount ?? 0,
        insertedCount: result.insertedCount ?? 0,
        updatedCount: result.updatedCount ?? 0,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies', async (request, response, next) => {
    try {
      const pagination = readPaginationQuery(request, { defaultLimit: 30 })
      const genre = typeof request.query.genre === 'string' ? request.query.genre.trim() : ''
      const movies = await listMovies(pool, {
        genre,
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
      const movies = await listRecentlyReleasedMovies(pool, {
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
      const movies = await listTopRatedMovies(pool, {
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
      const movies = await listUpcomingMovies(pool, {
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
        movie: mapMovieDetail(movie, reviews, communityRating),
      })
    } catch (error) {
      next(error)
    }
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

      const [movieSummaries, coStars] = await Promise.all([
        listMovieSummariesByTmdbIds(pool, collectCreditMovieIds(creditsPayload)),
        listCoStarsForPerson(pool, personId),
      ])

      response.json(
        mapPersonDetailPayload({
          person: personPayload,
          credits: creditsPayload,
          movieSummaries,
          coStars,
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

function mapMovieDetail(movie, reviews = [], communityRating = null) {
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

function collectCreditMovieIds(credits) {
  return [
    ...(Array.isArray(credits?.cast) ? credits.cast : []),
    ...(Array.isArray(credits?.crew) ? credits.crew : []),
  ]
    .filter((entry) => entry?.media_type === 'movie' && Number.isInteger(entry?.id))
    .map((entry) => entry.id)
}

function mapPersonDetailPayload({ person, credits, movieSummaries, coStars }) {
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
    knownFor: buildKnownForCredits(movieCredits, movieSummaryById),
    filmography: buildFilmography(movieCredits, movieSummaryById),
    coStars: Array.isArray(coStars)
      ? coStars.map((entry) => ({
          id: entry.tmdb_person_id,
          name: entry.name,
          profileUrl: resolveProfilePath(entry.profile_path),
          sharedCredits: entry.shared_credits,
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

function buildKnownForCredits(movieCredits, movieSummaryById) {
  const seen = new Set()

  return movieCredits
    .filter((entry) => !seen.has(entry.id) && (seen.add(entry.id), true))
    .sort((left, right) => {
      const leftPopularity = typeof left.popularity === 'number' ? left.popularity : -1
      const rightPopularity = typeof right.popularity === 'number' ? right.popularity : -1

      return rightPopularity - leftPopularity
    })
    .slice(0, 5)
    .map((entry) => mapCreditToMovieCard(entry, movieSummaryById))
}

function buildFilmography(movieCredits, movieSummaryById) {
  const seen = new Set()

  return movieCredits
    .filter((entry) => !seen.has(entry.id) && (seen.add(entry.id), true))
    .sort((left, right) => {
      const leftDate = Date.parse(left.release_date || '') || 0
      const rightDate = Date.parse(right.release_date || '') || 0

      return rightDate - leftDate
    })
    .map((entry) => {
      const summary = movieSummaryById.get(Number(entry.id))

      return {
        id: entry.id,
        mediaType: 'movie',
        title: summary?.title || entry.title || 'Untitled',
        year: formatMovieYear(summary?.release_date || entry.release_date || null),
        role: entry.character || entry.job || 'Credit',
        rating: summary?.vote_average ? formatScore(summary.vote_average) : formatScore(entry.vote_average),
        posterUrl: resolvePosterPath(summary?.poster_path || entry.poster_path || null),
      }
    })
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
  const summary = movieSummaryById.get(Number(entry.id))

  return {
    id: entry.id,
    mediaType: 'movie',
    title: summary?.title || entry.title || 'Untitled',
    year: formatMovieYear(summary?.release_date || entry.release_date || null),
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
    watchlistedAt: movie.watchlisted_at ?? null,
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
  }
}

function mapContinueWatchingTvShow(show) {
  const watchedEpisodeCount = Number(show.watched_episode_count) || 0
  const airedEpisodeCount = Number(show.aired_episode_count) || 0

  return {
    id: show.tmdb_id,
    title: show.name,
    posterUrl: resolvePosterPath(show.poster_path),
    backdropUrl: resolveBackdropPath(show.backdrop_path),
    watchedEpisodeCount,
    airedEpisodeCount,
    progress: airedEpisodeCount > 0 ? Math.round((watchedEpisodeCount / airedEpisodeCount) * 100) : 0,
    latestWatchedEpisodeLabel: `S${show.latest_watched_season_number} E${show.latest_watched_episode_number}`,
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
