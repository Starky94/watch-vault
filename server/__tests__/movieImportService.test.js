import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../config.js'
import {
  collectNowPlayingMovies,
  collectPopularMovies,
  enrichMoviesWithDetails,
  importNowPlayingMovies,
  importPopularMovies,
  normalizeMovie,
  syncMissingGenres,
} from '../movieImportService.js'
import { upsertMovies } from '../database.js'

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

test('collectNowPlayingMovies filters to the last 30 days and skips duplicates', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(url)
    const page = parsed.searchParams.get('page')

    return {
      ok: true,
      async json() {
        if (page === '1') {
          return {
            total_pages: 2,
            results: [
              { id: 1, title: 'Recent 1', release_date: '2026-06-30', genre_ids: [] },
              { id: 2, title: 'Old', release_date: '2026-05-20', genre_ids: [] },
              { id: 3, title: 'Missing date', genre_ids: [] },
            ],
          }
        }

        return {
          total_pages: 2,
          results: [
            { id: 1, title: 'Recent 1 again', release_date: '2026-06-30', genre_ids: [] },
            { id: 4, title: 'Recent 2', release_date: '2026-06-15', genre_ids: [] },
          ],
        }
      },
    }
  }

  const movies = await collectNowPlayingMovies(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 5,
    now: new Date('2026-07-02T12:00:00.000Z'),
  })

  assert.deepEqual(
    movies.map((movie) => movie.tmdbId),
    [1, 4]
  )
})

test('collectNowPlayingMovies stops cleanly when TMDB returns fewer than 30 qualifying movies', async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        total_pages: 1,
        results: [
          { id: 1, title: 'Recent 1', release_date: '2026-06-30', genre_ids: [] },
          { id: 2, title: 'Old', release_date: '2026-05-01', genre_ids: [] },
        ],
      }
    },
  })

  const movies = await collectNowPlayingMovies(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 30,
    now: new Date('2026-07-02T12:00:00.000Z'),
  })

  assert.equal(movies.length, 1)
  assert.equal(movies[0].tmdbId, 1)
})

test('upsertMovies inserts unseen rows and updates duplicates', async () => {
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
          return { rowCount: 1, rows: [{ inserted: false }] }
        }

        seen.add(tmdbId)
        return { rowCount: 1, rows: [{ inserted: true }] }
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

  const result = await upsertMovies(pool, movies)

  assert.equal(result.insertedCount, 2)
  assert.equal(result.updatedCount, 1)
  assert.equal(
    calls.filter(({ sql }) => typeof sql === 'string' && sql.includes('INSERT INTO movies')).length,
    3
  )
})

test('syncMissingGenres fetches and stores missing TMDB genres', async () => {
  const queriedGenreIds = []
  const upsertedGenres = []
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM genres')) {
        queriedGenreIds.push(...params[0])
        return { rows: [{ tmdb_genre_id: 18 }] }
      }

      if (sql.includes('INSERT INTO genres')) {
        upsertedGenres.push({
          tmdbGenreId: params[0],
          name: params[1],
        })
        return { rowCount: 1 }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        genres: [
          { id: 18, name: 'Drama' },
          { id: 878, name: 'Sci-Fi' },
        ],
      }
    },
  })

  await syncMissingGenres(
    pool,
    fetchImpl,
    {
      token: 'token',
      baseUrl: 'https://api.themoviedb.org/3',
    },
    [
      { genreIds: [18, 878] },
    ]
  )

  assert.deepEqual(queriedGenreIds, [18, 878])
  assert.deepEqual(upsertedGenres, [{ tmdbGenreId: 878, name: 'Sci-Fi' }])
})

test('syncMissingGenres skips TMDB genre lookup when all genre ids are already stored', async () => {
  let fetchCalled = false
  const pool = {
    async query(sql) {
      if (sql.includes('FROM genres')) {
        return { rows: [{ tmdb_genre_id: 18 }, { tmdb_genre_id: 878 }] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const fetchImpl = async () => {
    fetchCalled = true
    throw new Error('Should not fetch genres')
  }

  await syncMissingGenres(
    pool,
    fetchImpl,
    {
      token: 'token',
      baseUrl: 'https://api.themoviedb.org/3',
    },
    [
      { genreIds: [18, 878] },
    ]
  )

  assert.equal(fetchCalled, false)
})

test('enrichMoviesWithDetails stores runtime and certification from TMDB details', async () => {
  const movies = await enrichMoviesWithDetails(
    async () => ({
      ok: true,
      async json() {
        return {
          runtime: 166,
          release_dates: {
            results: [
              {
                iso_3166_1: 'US',
                release_dates: [{ certification: 'PG-13' }],
              },
            ],
          },
        }
      },
    }),
    {
      token: 'token',
      baseUrl: 'https://api.themoviedb.org/3',
    },
    [{ tmdbId: 42, genreIds: [] }]
  )

  assert.equal(movies[0].runtimeMinutes, 166)
  assert.equal(movies[0].certification, 'PG-13')
  assert.equal(movies[0].detailPayload.runtime, 166)
})

test('importPopularMovies returns fetched, inserted, and updated counts', async () => {
  const executed = []
  const existingIds = new Set([1, 2])
  const pool = {
    async query(sql, params) {
      executed.push(sql)

      if (sql.includes('FROM genres')) {
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO genres')) {
        return { rowCount: 1 }
      }

      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql} ${params ?? ''}`)
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
              return { rowCount: 1, rows: [{ inserted: false }] }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1, rows: [{ inserted: true }] }
          }

          throw new Error(`Unexpected query: ${sql}`)
        },
        release() {},
      }
    },
  }
  const fetchImpl = async (url) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith('/movie/popular')) {
      return {
        ok: true,
        async json() {
          return {
            results: Array.from({ length: 4 }, (_, index) => ({
              id: index + 1,
              title: `Movie ${index + 1}`,
              genre_ids: [18],
            })),
          }
        },
      }
    }

    if (parsed.pathname.endsWith('/genre/movie/list')) {
      return {
        ok: true,
        async json() {
          return {
            genres: [{ id: 18, name: 'Drama' }],
          }
        },
      }
    }

    if (parsed.pathname.includes('/movie/')) {
      return {
        ok: true,
        async json() {
          return {
            runtime: 120,
            release_dates: {
              results: [
                {
                  iso_3166_1: 'US',
                  release_dates: [{ certification: 'PG-13' }],
                },
              ],
            },
          }
        },
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await importPopularMovies(pool, {
    fetchImpl,
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 4,
  })

  assert.equal(result.fetchedCount, 4)
  assert.equal(result.insertedCount, 2)
  assert.equal(result.updatedCount, 2)
  assert.equal(result.movies.length, 4)
  assert.equal(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS movies')), true)
  assert.equal(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS genres')), true)
})

test('importNowPlayingMovies returns the qualifying subset and updates existing rows', async () => {
  const executed = []
  const existingIds = new Set([2])
  const pool = {
    async query(sql, params) {
      executed.push(sql)

      if (sql.includes('FROM genres')) {
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO genres')) {
        return { rowCount: 1 }
      }

      if (sql.includes('CREATE TABLE IF NOT EXISTS movies') || sql.includes('CREATE TABLE IF NOT EXISTS genres') || sql.includes('ALTER TABLE movies')) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql} ${params ?? ''}`)
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
              return { rowCount: 1, rows: [{ inserted: false }] }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1, rows: [{ inserted: true }] }
          }

          throw new Error(`Unexpected query: ${sql}`)
        },
        release() {},
      }
    },
  }
  const fetchImpl = async (url) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith('/movie/now_playing')) {
      return {
        ok: true,
        async json() {
          return {
            total_pages: 1,
            results: [
              { id: 1, title: 'Movie 1', release_date: '2026-06-30', genre_ids: [18] },
              { id: 2, title: 'Movie 2', release_date: '2026-06-25', genre_ids: [18] },
              { id: 3, title: 'Old Movie', release_date: '2026-05-10', genre_ids: [18] },
            ],
          }
        },
      }
    }

    if (parsed.pathname.endsWith('/genre/movie/list')) {
      return {
        ok: true,
        async json() {
          return {
            genres: [{ id: 18, name: 'Drama' }],
          }
        },
      }
    }

    if (parsed.pathname.includes('/movie/')) {
      return {
        ok: true,
        async json() {
          return {
            runtime: 120,
            release_dates: {
              results: [
                {
                  iso_3166_1: 'US',
                  release_dates: [{ certification: 'PG-13' }],
                },
              ],
            },
          }
        },
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await importNowPlayingMovies(pool, {
    fetchImpl,
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 30,
    now: new Date('2026-07-02T12:00:00.000Z'),
  })

  assert.equal(result.fetchedCount, 2)
  assert.equal(result.insertedCount, 1)
  assert.equal(result.updatedCount, 1)
  assert.equal(result.movies.length, 2)
  assert.equal(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS movies')), true)
})
