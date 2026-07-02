import express from 'express'
import { loadConfig } from './config.js'
import {
  countMovies,
  ensureMoviesTable,
  getMovieByTmdbId,
  listMovies,
  listRecentlyReleasedMovies,
  listTopRatedMovies,
  listUpcomingMovies,
} from './database.js'
import { adminJobs, findAdminJob, listAdminJobs } from './adminJobs.js'

const seededUser = {
  username: 'florind',
  password: 'test',
  fullName: 'Florin Druta',
}

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

    if (username !== seededUser.username || password !== seededUser.password) {
      response.status(401).json({
        error: 'Invalid username or password',
      })
      return
    }

    response.json({
      user: {
        username: seededUser.username,
        fullName: seededUser.fullName,
      },
    })
  })

  app.get('/api/admin/overview', async (_request, response, next) => {
    try {
      response.json({
        crons: listAdminJobs(jobs),
        totals: {
          movies: await countMovies(pool),
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

  app.get('/api/movies', async (_request, response, next) => {
    try {
      const movies = await listMovies(pool)
      response.json({
        count: movies.length,
        movies,
        featuredMovie: mapFeaturedMovie(movies[0] ?? null),
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies/recently-released', async (_request, response, next) => {
    try {
      const requestedLimit = Number.parseInt(_request.query.limit, 10)
      const movies = await listRecentlyReleasedMovies(pool, {
        limit: Number.isInteger(requestedLimit) ? requestedLimit : 10,
      })
      response.json({
        count: movies.length,
        movies,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies/top-rated', async (_request, response, next) => {
    try {
      const requestedLimit = Number.parseInt(_request.query.limit, 10)
      const movies = await listTopRatedMovies(pool, {
        limit: Number.isInteger(requestedLimit) ? requestedLimit : 10,
      })
      response.json({
        count: movies.length,
        movies,
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/movies/upcoming', async (_request, response, next) => {
    try {
      const requestedLimit = Number.parseInt(_request.query.limit, 10)
      const movies = await listUpcomingMovies(pool, {
        limit: Number.isInteger(requestedLimit) ? requestedLimit : 10,
      })
      response.json({
        count: movies.length,
        movies,
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

      response.json({
        movie: mapMovieDetail(movie),
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

function mapMovieDetail(movie) {
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
