import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { listMovies, listRecentlyReleasedMovies } from '../database.js'

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
