import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { countMovies, listMovies, listRecentlyReleasedMovies, listTopRatedMovies, listUpcomingMovies } from '../database.js'

test('listMovies requests the top 30 titles ordered by popularity descending', async () => {
  let executedSql = ''
  const pool = {
    async query(sql) {
      executedSql = sql
      return { rows: [] }
    },
  }

  const movies = await listMovies(pool)

  assert.deepEqual(movies, [])
  assert.match(executedSql, /ORDER BY popularity DESC NULLS LAST, tmdb_id ASC/i)
  assert.match(executedSql, /LIMIT 30/i)
})

test('listRecentlyReleasedMovies requests the latest 10 non-future titles ordered by release date descending', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }

  const movies = await listRecentlyReleasedMovies(pool)

  assert.deepEqual(movies, [])
  assert.match(executedSql, /WHERE movies\.release_date IS NOT NULL/i)
  assert.match(executedSql, /movies\.release_date <= CURRENT_DATE/i)
  assert.match(executedSql, /ORDER BY movies\.release_date DESC, movies\.tmdb_id ASC/i)
  assert.match(executedSql, /LIMIT \$1/i)
  assert.deepEqual(executedParams, [10])
})

test('listRecentlyReleasedMovies caps the limit at 30', async () => {
  let executedParams = []
  const pool = {
    async query(_sql, params) {
      executedParams = params
      return { rows: [] }
    },
  }

  await listRecentlyReleasedMovies(pool, { limit: 50 })

  assert.deepEqual(executedParams, [30])
})

test('listTopRatedMovies requests the top 10 released titles ordered by score descending', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }

  const movies = await listTopRatedMovies(pool)

  assert.deepEqual(movies, [])
  assert.match(executedSql, /WHERE movies\.release_date IS NOT NULL/i)
  assert.match(executedSql, /movies\.release_date <= CURRENT_DATE/i)
  assert.match(executedSql, /ORDER BY movies\.vote_average DESC NULLS LAST, movies\.vote_count DESC NULLS LAST, movies\.tmdb_id ASC/i)
  assert.match(executedSql, /LIMIT \$1/i)
  assert.deepEqual(executedParams, [10])
})

test('listTopRatedMovies caps the limit at 30', async () => {
  let executedParams = []
  const pool = {
    async query(_sql, params) {
      executedParams = params
      return { rows: [] }
    },
  }

  await listTopRatedMovies(pool, { limit: 50 })

  assert.deepEqual(executedParams, [30])
})

test('countMovies returns the stored movie total', async () => {
  let executedSql = ''
  const pool = {
    async query(sql) {
      executedSql = sql
      return {
        rows: [{ movie_count: 42 }],
      }
    },
  }

  const total = await countMovies(pool)

  assert.equal(total, 42)
  assert.match(executedSql, /SELECT COUNT\(\*\)::INTEGER AS movie_count/i)
})

test('listUpcomingMovies requests future titles in the next 30 days ordered by release date ascending', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }

  const movies = await listUpcomingMovies(pool)

  assert.deepEqual(movies, [])
  assert.match(executedSql, /WHERE movies\.release_date IS NOT NULL/i)
  assert.match(executedSql, /movies\.release_date > CURRENT_DATE/i)
  assert.match(executedSql, /movies\.release_date <= CURRENT_DATE \+ INTERVAL '30 days'/i)
  assert.match(executedSql, /ORDER BY movies\.release_date ASC, movies\.tmdb_id ASC/i)
  assert.match(executedSql, /LIMIT \$1/i)
  assert.deepEqual(executedParams, [10])
})

test('listUpcomingMovies caps the limit at 30', async () => {
  let executedParams = []
  const pool = {
    async query(_sql, params) {
      executedParams = params
      return { rows: [] }
    },
  }

  await listUpcomingMovies(pool, { limit: 50 })

  assert.deepEqual(executedParams, [30])
})

test('GET /api/movies returns the popular movies payload from the local DB', async () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    tmdb_id: index + 1,
    title: `Movie ${index + 1}`,
    original_title: `Movie ${index + 1}`,
    overview: null,
    release_date: `2024-01-${String((index % 28) + 1).padStart(2, '0')}`,
    original_language: 'en',
    poster_path: null,
    backdrop_path: null,
    popularity: 100 - index,
    vote_average: 8.5 - index * 0.1,
    vote_count: 1000 + index,
    adult: false,
    video: false,
    genre_ids: [],
    genre_names: ['Adventure', 'Sci-Fi'],
    runtime_minutes: 166,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('FROM movies')) {
        return { rows }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.count, 30)
    assert.equal(payload.movies.length, 30)
    assert.equal(payload.movies[0].popularity > payload.movies[1].popularity, true)
    assert.equal(payload.movies[28].popularity > payload.movies[29].popularity, true)
    assert.deepEqual(payload.movies[0].genre_names, ['Adventure', 'Sci-Fi'])
    assert.equal(payload.featuredMovie.title, 'Movie 1')
    assert.equal(payload.featuredMovie.rating, 'PG-13')
    assert.equal(payload.featuredMovie.runtime, '2h 46m')
    assert.equal(payload.featuredMovie.audience, '1.0k votes')
    assert.deepEqual(payload.featuredMovie.genres, ['Adventure', 'Sci-Fi'])
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies/:movieId returns a mapped movie detail payload from the local DB', async () => {
  const row = {
    tmdb_id: 42,
    title: 'Dune: Part Two',
    original_title: 'Dune: Part Two',
    overview: 'Paul Atreides unites with the Fremen and seeks revenge against the conspirators who destroyed his family.',
    release_date: '2024-03-01',
    original_language: 'en',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    popularity: 99.9,
    vote_average: 8.7,
    vote_count: 2150,
    adult: false,
    video: false,
    genre_ids: [],
    genre_names: ['Adventure', 'Sci-Fi'],
    runtime_minutes: 166,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }

  const pool = {
    async query(sql, params) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        assert.deepEqual(params, [42])
        return { rows: [row] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/42`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload.movie, {
      id: 42,
      title: 'Dune: Part Two',
      year: '2024',
      overview: 'Paul Atreides unites with the Fremen and seeks revenge against the conspirators who destroyed his family.',
      genres: ['Adventure', 'Sci-Fi'],
      certification: 'PG-13',
      runtime: '2h 46m',
      score: '8.7/10',
      audience: '2.1k votes',
      originalLanguage: 'en',
      releaseDate: '2024-03-01',
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies/:movieId returns 404 when the movie is missing', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/404`)
    const payload = await response.json()

    assert.equal(response.status, 404)
    assert.equal(payload.error, 'Movie 404 was not found in the local database')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/admin/overview returns the configured jobs and total movie count', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('SELECT COUNT(*)::INTEGER AS movie_count')) {
        return { rows: [{ movie_count: 125 }] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/overview`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.totals.movies, 125)
    assert.deepEqual(payload.crons, [
      {
        key: 'popular',
        name: 'Popular Movies Import',
        execution: 'Interval-based loop',
        frequency: 'Every 10 minutes',
      },
      {
        key: 'now-playing',
        name: 'Now Playing Import',
        execution: 'Interval-based loop',
        frequency: 'Every 24 hours',
      },
      {
        key: 'upcoming',
        name: 'Upcoming Import',
        execution: 'Interval-based loop',
        frequency: 'Every 24 hours',
      },
    ])
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/admin/jobs/:jobKey/run dispatches the selected job and returns the summary', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const invocations = []
  const app = await createApp(pool, {
    jobs: [
      {
        key: 'popular',
        name: 'Popular Movies Import',
        execution: 'Interval-based loop',
        frequency: 'Every 10 minutes',
        async run(receivedPool, options) {
          invocations.push({ receivedPool, options })
          return {
            fetchedCount: 30,
            insertedCount: 8,
            updatedCount: 22,
          }
        },
      },
    ],
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/jobs/popular/run`, {
      method: 'POST',
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      job: 'popular',
      fetchedCount: 30,
      insertedCount: 8,
      updatedCount: 22,
    })
    assert.deepEqual(invocations, [
      {
        receivedPool: pool,
        options: {
          token: 'token',
          baseUrl: 'https://example.test',
          count: 30,
        },
      },
    ])
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/admin/jobs/:jobKey/run returns 404 for unknown jobs', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    jobs: [],
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/jobs/popular/run`, {
      method: 'POST',
    })
    const payload = await response.json()

    assert.equal(response.status, 404)
    assert.equal(payload.error, 'Unknown admin job: popular')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/admin/jobs/:jobKey/run returns 500 when runtime config is missing', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    jobs: [
      {
        key: 'popular',
        name: 'Popular Movies Import',
        execution: 'Interval-based loop',
        frequency: 'Every 10 minutes',
        async run() {
          throw new Error('This should not be reached')
        },
      },
    ],
    loadRuntimeConfig() {
      throw new Error('Missing required environment variable: TMDB_BEARER_TOKEN')
    },
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/jobs/popular/run`, {
      method: 'POST',
    })
    const payload = await response.json()

    assert.equal(response.status, 500)
    assert.equal(payload.error, 'Missing required environment variable: TMDB_BEARER_TOKEN')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/admin/jobs/:jobKey/run returns 500 when the job fails', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    jobs: [
      {
        key: 'popular',
        name: 'Popular Movies Import',
        execution: 'Interval-based loop',
        frequency: 'Every 10 minutes',
        async run() {
          throw new Error('TMDB import failed')
        },
      },
    ],
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/jobs/popular/run`, {
      method: 'POST',
    })
    const payload = await response.json()

    assert.equal(response.status, 500)
    assert.equal(payload.error, 'TMDB import failed')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies returns a safe empty featured payload when no movies exist', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('FROM movies')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.movies, [])
    assert.equal(payload.featuredMovie, null)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies/recently-released returns the latest released movies payload from the local DB', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 1,
    title: `Recent Movie ${index + 1}`,
    original_title: `Recent Movie ${index + 1}`,
    overview: null,
    release_date: `2026-07-${String(10 - index).padStart(2, '0')}`,
    original_language: 'en',
    poster_path: null,
    backdrop_path: null,
    popularity: 100 - index,
    vote_average: 8.5 - index * 0.1,
    vote_count: 1000 + index,
    adult: false,
    video: false,
    genre_ids: [],
    genre_names: ['Adventure', 'Sci-Fi'],
    runtime_minutes: 166,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  let recentQueryCount = 0
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY movies.release_date DESC')) {
        recentQueryCount += 1
        return { rows }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/recently-released`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(recentQueryCount, 1)
    assert.equal(payload.count, 10)
    assert.equal(payload.movies.length, 10)
    assert.equal(payload.movies[0].title, 'Recent Movie 1')
    assert.equal(payload.movies[9].title, 'Recent Movie 10')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies/recently-released forwards a requested limit', async () => {
  const capturedParams = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY movies.release_date DESC')) {
        capturedParams.push(params)
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/recently-released?limit=30`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[30]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.movies, [])
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies/upcoming returns the upcoming movies payload from the local DB', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 1,
    title: `Upcoming Movie ${index + 1}`,
    original_title: `Upcoming Movie ${index + 1}`,
    overview: null,
    release_date: `2026-07-${String(index + 3).padStart(2, '0')}`,
    original_language: 'en',
    poster_path: null,
    backdrop_path: null,
    popularity: 100 - index,
    vote_average: 8.5 - index * 0.1,
    vote_count: 1000 + index,
    adult: false,
    video: false,
    genre_ids: [],
    genre_names: ['Adventure', 'Sci-Fi'],
    runtime_minutes: 166,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  let upcomingQueryCount = 0
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY movies.release_date ASC')) {
        upcomingQueryCount += 1
        return { rows }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/upcoming`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(upcomingQueryCount, 1)
    assert.equal(payload.count, 10)
    assert.equal(payload.movies.length, 10)
    assert.equal(payload.movies[0].title, 'Upcoming Movie 1')
    assert.equal(payload.movies[9].title, 'Upcoming Movie 10')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies/top-rated returns the top-rated released movies payload from the local DB', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 1,
    title: `Top Rated Movie ${index + 1}`,
    original_title: `Top Rated Movie ${index + 1}`,
    overview: null,
    release_date: `2026-06-${String(30 - index).padStart(2, '0')}`,
    original_language: 'en',
    poster_path: null,
    backdrop_path: null,
    popularity: 100 - index,
    vote_average: 9.5 - index * 0.1,
    vote_count: 2000 - index * 10,
    adult: false,
    video: false,
    genre_ids: [],
    genre_names: ['Adventure', 'Sci-Fi'],
    runtime_minutes: 166,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  let topRatedQueryCount = 0
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY movies.vote_average DESC')) {
        topRatedQueryCount += 1
        return { rows }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/top-rated`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(topRatedQueryCount, 1)
    assert.equal(payload.count, 10)
    assert.equal(payload.movies.length, 10)
    assert.equal(payload.movies[0].title, 'Top Rated Movie 1')
    assert.equal(payload.movies[9].title, 'Top Rated Movie 10')
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies/top-rated forwards a requested limit', async () => {
  const capturedParams = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY movies.vote_average DESC')) {
        capturedParams.push(params)
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/top-rated?limit=30`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[30]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.movies, [])
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('GET /api/movies/upcoming forwards a requested limit', async () => {
  const capturedParams = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY movies.release_date ASC')) {
        capturedParams.push(params)
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/upcoming?limit=30`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[30]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.movies, [])
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/auth/login returns the seeded user for valid credentials', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: 'florind',
        password: 'test',
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      user: {
        username: 'florind',
        fullName: 'Florin Druta',
      },
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/auth/login returns 401 for an unknown username', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: 'someone-else',
        password: 'test',
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.deepEqual(payload, {
      error: 'Invalid username or password',
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})

test('POST /api/auth/login returns 401 for a wrong password', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        username: 'florind',
        password: 'wrong-password',
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.deepEqual(payload, {
      error: 'Invalid username or password',
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
})
