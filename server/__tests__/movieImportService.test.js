import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../config.js'
import { collectPopularMovies, importPopularMovies, normalizeMovie } from '../movieImportService.js'
import { insertMovies } from '../database.js'

test('loadConfig throws when DATABASE_URL is missing', () => {
  assert.throws(
    () => loadConfig({ env: {}, requireDatabase: true }),
    /Missing required environment variable: DATABASE_URL/
  )
})

test('loadConfig throws when TMDB_BEARER_TOKEN is required but missing', () => {
  assert.throws(
    () =>
      loadConfig({
        env: { DATABASE_URL: 'postgres://example' },
        requireDatabase: true,
        requireTmdbToken: true,
      }),
    /Missing required environment variable: TMDB_BEARER_TOKEN/
  )
})

test('normalizeMovie keeps mapped fields and import order', () => {
  const movie = normalizeMovie(
    {
      id: 42,
      title: 'Arrival',
      original_title: 'Arrival',
      overview: 'First contact.',
      release_date: '2016-11-11',
      original_language: 'en',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      popularity: 55.1,
      vote_average: 7.9,
      vote_count: 20000,
      adult: false,
      video: false,
      genre_ids: [18, 878],
    },
    4
  )

  assert.equal(movie.tmdbId, 42)
  assert.equal(movie.title, 'Arrival')
  assert.deepEqual(movie.genreIds, [18, 878])
  assert.equal(movie.importRank, 5)
})

test('collectPopularMovies fetches page 2 when page 1 has fewer than 30 movies', async () => {
  const pageOne = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    title: `Movie ${index + 1}`,
    genre_ids: [],
  }))

  const pageTwo = Array.from({ length: 20 }, (_, index) => ({
    id: index + 21,
    title: `Movie ${index + 21}`,
    genre_ids: [],
  }))

  const calls = []
  const fetchImpl = async (url) => {
    calls.push(String(url))
    const parsed = new URL(url)
    const page = parsed.searchParams.get('page')

    return {
      ok: true,
      async json() {
        return {
          results: page === '1' ? pageOne : pageTwo,
        }
      },
    }
  }

  const movies = await collectPopularMovies(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 30,
  })

  assert.equal(calls.length, 2)
  assert.equal(movies.length, 30)
  assert.equal(movies[0].tmdbId, 1)
  assert.equal(movies[29].tmdbId, 30)
})

test('collectPopularMovies skips duplicate tmdb ids across fetch pages', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url)
    const page = parsed.searchParams.get('page')

    return {
      ok: true,
      async json() {
        if (page === '1') {
          return {
            results: [
              { id: 1, title: 'Movie 1', genre_ids: [] },
              { id: 2, title: 'Movie 2', genre_ids: [] },
            ],
          }
        }

        return {
          results: [
            { id: 2, title: 'Movie 2 again', genre_ids: [] },
            { id: 3, title: 'Movie 3', genre_ids: [] },
          ],
        }
      },
    }
  }

  const movies = await collectPopularMovies(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 3,
  })

  assert.deepEqual(
    movies.map((movie) => movie.tmdbId),
    [1, 2, 3]
  )
})

test('insertMovies inserts unseen rows and skips duplicates', async () => {
  const seen = new Set()
  const calls = []
  const client = {
    async query(sql, params) {
      calls.push({ sql, params })

      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rowCount: null }
      }

      if (sql.includes('INSERT INTO movies')) {
        const tmdbId = params[0]
        if (seen.has(tmdbId)) {
          return { rowCount: 0 }
        }

        seen.add(tmdbId)
        return { rowCount: 1 }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
    release() {},
  }
  const pool = {
    async connect() {
      return client
    },
  }

  const movies = [
    { tmdbId: 1, title: 'One', genreIds: [], rawPayload: {}, importRank: 1 },
    { tmdbId: 2, title: 'Two', genreIds: [], rawPayload: {}, importRank: 2 },
    { tmdbId: 1, title: 'One again', genreIds: [], rawPayload: {}, importRank: 3 },
  ].map((movie) => ({
    originalTitle: null,
    overview: null,
    releaseDate: null,
    originalLanguage: null,
    posterPath: null,
    backdropPath: null,
    popularity: null,
    voteAverage: null,
    voteCount: null,
    adult: false,
    video: false,
    ...movie,
  }))

  const result = await insertMovies(pool, movies)

  assert.equal(result.insertedCount, 2)
  assert.equal(result.skippedCount, 1)
  assert.equal(
    calls.filter(({ sql }) => typeof sql === 'string' && sql.includes('INSERT INTO movies')).length,
    3
  )
})

test('importPopularMovies returns fetched, inserted, and skipped counts', async () => {
  const executed = []
  const existingIds = new Set([1, 2])
  const pool = {
    async query(sql) {
      executed.push(sql)
      return { rowCount: null }
    },
    async connect() {
      return {
        async query(sql, params) {
          if (sql === 'BEGIN' || sql === 'COMMIT') {
            return { rowCount: null }
          }

          if (sql.includes('INSERT INTO movies')) {
            const tmdbId = params[0]
            if (existingIds.has(tmdbId)) {
              return { rowCount: 0 }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1 }
          }

          throw new Error(`Unexpected query: ${sql}`)
        },
        release() {},
      }
    },
  }
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        results: Array.from({ length: 4 }, (_, index) => ({
          id: index + 1,
          title: `Movie ${index + 1}`,
          genre_ids: [],
        })),
      }
    },
  })

  const result = await importPopularMovies(pool, {
    fetchImpl,
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 4,
  })

  assert.equal(result.fetchedCount, 4)
  assert.equal(result.insertedCount, 2)
  assert.equal(result.skippedCount, 2)
  assert.equal(result.movies.length, 4)
  assert.equal(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS movies')), true)
})
