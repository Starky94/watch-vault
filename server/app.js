import express from 'express'
import { loadConfig } from './config.js'
import {
  addMovieToWatchlistForUser,
  addMovieToWatchedForUser,
  countMovies,
  countStoredDataBytes,
  ensureMoviesTable,
  findUserByCredentials,
  findUserByUsername,
  getMovieStatsForUser,
  getMovieByTmdbId,
  listWatchlistMoviesForUser,
  listWatchedMoviesForUser,
  listMovies,
  listRecentlyReleasedMovies,
  removeMovieFromWatchedForUser,
  removeMovieFromWatchlistForUser,
  listSimilarMovies,
  listTopRatedMovies,
  updateUserPassword,
  listUpcomingMovies,
} from './database.js'
import { adminJobs, findAdminJob, listAdminJobs } from './adminJobs.js'
import { fetchMovieReviews } from './tmdbClient.js'

export async function createApp(pool, options = {}) {
  const {
    jobs = adminJobs,
    loadRuntimeConfig = () =>
      loadConfig({
        requireDatabase: false,
        requireTmdbToken: true,
      }),
  } = options

  await ensureMoviesTable(pool)

  const app = express()
  app.use(express.json())

  app.get('/api/health', async (_request, response) => {
    response.json({ ok: true })
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

  app.get('/api/watchlist', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const movies = await listWatchlistMoviesForUser(pool, user.username)

      response.json({
        count: movies.length,
        movies: movies.map(mapWatchlistMovie),
      })
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

      response.status(200).json({
        movie: savedMovie ? mapWatchlistMovie(savedMovie) : null,
      })
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

  app.get('/api/watched', async (request, response, next) => {
    try {
      const user = await getAuthenticatedUser(pool, request)

      if (!user) {
        response.status(401).json({
          error: 'Authentication required',
        })
        return
      }

      const [movies, stats] = await Promise.all([
        listWatchedMoviesForUser(pool, user.username),
        getMovieStatsForUser(pool, user.username),
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

  app.post('/api/watched', async (request, response, next) => {
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

      const result = await addMovieToWatchedForUser(pool, {
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

      const [movies, stats] = await Promise.all([
        listWatchedMoviesForUser(pool, user.username),
        getMovieStatsForUser(pool, user.username),
      ])
      const watchedMovie = movies.find((movie) => Number(movie.tmdb_id) === movieId) ?? null

      response.status(200).json({
        movie: watchedMovie ? mapWatchedMovie(watchedMovie) : null,
        removedFromWatchlist: result.removedFromWatchlist,
        stats: mapMovieStats(stats),
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

      const stats = await getMovieStatsForUser(pool, user.username)

      response.status(200).json({
        removed: result.removed,
        stats: mapMovieStats(stats),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/admin/overview', async (_request, response, next) => {
    try {
      response.json({
        crons: listAdminJobs(jobs),
        totals: {
          movies: await countMovies(pool),
          storedDataBytes: await countStoredDataBytes(pool),
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
      const result = await job.run(pool, {
        token: config.tmdbBearerToken,
        baseUrl: config.tmdbBaseUrl,
        count: 30,
      })

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
      const movies = await listMovies(pool, {
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

  app.get('/api/movies/:movieId', async (request, response, next) => {
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

      const reviews = await loadMovieReviews(movieId, loadRuntimeConfig)

      response.json({
        movie: mapMovieDetail(movie, reviews),
      })
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

function mapMovieDetail(movie, reviews = []) {
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
  }
}

function mapMovieStats(stats) {
  return {
    moviesWatched: stats?.moviesWatched ?? 0,
    timeWatchedMinutes: stats?.timeWatchedMinutes ?? 0,
    watchlistCount: stats?.watchlistCount ?? 0,
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

function formatScore(voteAverage) {
  if (typeof voteAverage !== 'number') {
    return 'N/A'
  }

  return `${voteAverage.toFixed(1)}/10`
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
