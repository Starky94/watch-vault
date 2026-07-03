import test from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../config.js'
import {
  backfillMovieCredits,
  collectNowPlayingMovies,
  collectPopularMovies,
  collectUpcomingMovies,
  enrichMoviesWithDetails,
  importNowPlayingMovies,
  importPopularMovies,
  importUpcomingMovies,
  normalizeMovie,
  syncMissingGenres,
} from '../movieImportService.js'
import { upsertMovies } from '../database.js'

function isSchemaSetupQuery(sql) {
  return (
    sql.includes('CREATE TABLE IF NOT EXISTS movies') ||
    sql.includes('CREATE TABLE IF NOT EXISTS genres') ||
    sql.includes('ALTER TABLE movies') ||
    sql.includes('UPDATE movies') ||
    sql.includes('CREATE TABLE IF NOT EXISTS cast_members') ||
    sql.includes('CREATE TABLE IF NOT EXISTS movie_cast') ||
    sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS movie_cast_unique_credit_idx') ||
    sql.includes('CREATE TABLE IF NOT EXISTS users') ||
    sql.includes('INSERT INTO users') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watchlist_items')
  )
}

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

test('collectUpcomingMovies keeps only future movies within the next 30 days sorted ascending', async () => {
  const responses = [
    {
      total_pages: 2,
      results: [
        { id: 7, title: 'Same Day', release_date: '2026-07-02', genre_ids: [] },
        { id: 2, title: 'Sooner', release_date: '2026-07-04', genre_ids: [] },
        { id: 3, title: 'Too Far', release_date: '2026-08-05', genre_ids: [] },
      ],
    },
    {
      total_pages: 2,
      results: [
        { id: 2, title: 'Sooner Duplicate', release_date: '2026-07-04', genre_ids: [] },
        { id: 1, title: 'Later', release_date: '2026-07-20', genre_ids: [] },
        { id: 4, title: 'Undated', release_date: null, genre_ids: [] },
        { id: 5, title: 'Past', release_date: '2026-06-30', genre_ids: [] },
      ],
    },
  ]

  const movies = await collectUpcomingMovies(
    async () => ({
      ok: true,
      async json() {
        return responses.shift() ?? { total_pages: 0, results: [] }
      },
    }),
    {
      token: 'token',
      baseUrl: 'https://api.themoviedb.org/3',
      count: 30,
      now: new Date('2026-07-02T12:00:00.000Z'),
    }
  )

  assert.deepEqual(
    movies.map((movie) => ({ tmdbId: movie.tmdbId, releaseDate: movie.releaseDate })),
    [
      { tmdbId: 2, releaseDate: '2026-07-04' },
      { tmdbId: 1, releaseDate: '2026-07-20' },
    ]
  )
})

test('collectUpcomingMovies stops cleanly when TMDB returns fewer than 30 qualifying future movies', async () => {
  const movies = await collectUpcomingMovies(
    async () => ({
      ok: true,
      async json() {
        return {
          total_pages: 1,
          results: [
            { id: 10, title: 'Future 1', release_date: '2026-07-10', genre_ids: [] },
            { id: 11, title: 'Future 2', release_date: '2026-07-18', genre_ids: [] },
          ],
        }
      },
    }),
    {
      token: 'token',
      baseUrl: 'https://api.themoviedb.org/3',
      count: 30,
      now: new Date('2026-07-02T12:00:00.000Z'),
    }
  )

  assert.deepEqual(
    movies.map((movie) => movie.tmdbId),
    [10, 11]
  )
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
          return { rowCount: 1, rows: [{ id: tmdbId, inserted: false }] }
        }

        seen.add(tmdbId)
        return { rowCount: 1, rows: [{ id: tmdbId, inserted: true }] }
      }

      if (sql.includes('DELETE FROM movie_cast')) {
        return { rowCount: 0 }
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
                iso_3166_1: 'GB',
                release_dates: [{ certification: '15' }],
              },
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
  assert.deepEqual(movies[0].detailPayload.release_dates.results, [
    {
      iso_3166_1: 'US',
      release_dates: [{ certification: 'PG-13' }],
    },
  ])
  assert.deepEqual(movies[0].credits, {
    director: null,
    cast: [],
  })
})

test('enrichMoviesWithDetails stores one director and the top 10 ordered cast members', async () => {
  const movies = await enrichMoviesWithDetails(
    async (url) => {
      const parsed = new URL(url)

      if (parsed.pathname.endsWith('/credits')) {
        return {
          ok: true,
          async json() {
            return {
              cast: Array.from({ length: 12 }, (_, index) => ({
                id: index + 1,
                name: `Actor ${index + 1}`,
                character: `Role ${index + 1}`,
                order: 11 - index,
              })),
              crew: [
                { id: 100, name: 'Producer Person', job: 'Producer' },
                { id: 200, name: 'Denis Villeneuve', job: 'Director', department: 'Directing', profile_path: '/director.jpg' },
              ],
            }
          },
        }
      }

      return {
        ok: true,
        async json() {
          return {
            runtime: 166,
            release_dates: {
              results: [],
            },
          }
        },
      }
    },
    {
      token: 'token',
      baseUrl: 'https://api.themoviedb.org/3',
    },
    [{ tmdbId: 42, genreIds: [] }]
  )

  assert.equal(movies[0].credits.director.name, 'Denis Villeneuve')
  assert.equal(movies[0].credits.cast.length, 10)
  assert.deepEqual(
    movies[0].credits.cast.slice(0, 3).map((person) => ({ name: person.name, billingOrder: person.billingOrder })),
    [
      { name: 'Actor 12', billingOrder: 0 },
      { name: 'Actor 11', billingOrder: 1 },
      { name: 'Actor 10', billingOrder: 2 },
    ]
  )
})

test('enrichMoviesWithDetails keeps importing when TMDB credits are unavailable', async () => {
  const movies = await enrichMoviesWithDetails(
    async (url) => {
      const parsed = new URL(url)

      if (parsed.pathname.endsWith('/credits')) {
        return {
          ok: false,
          status: 500,
          async text() {
            return 'credits unavailable'
          },
        }
      }

      return {
        ok: true,
        async json() {
          return {
            runtime: 120,
            release_dates: {
              results: [],
            },
          }
        },
      }
    },
    {
      token: 'token',
      baseUrl: 'https://api.themoviedb.org/3',
    },
    [{ tmdbId: 7, genreIds: [] }]
  )

  assert.equal(movies[0].runtimeMinutes, 120)
  assert.deepEqual(movies[0].credits, {
    director: null,
    cast: [],
  })
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

      if (isSchemaSetupQuery(sql)) {
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
              return { rowCount: 1, rows: [{ id: tmdbId, inserted: false }] }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1, rows: [{ id: tmdbId, inserted: true }] }
          }

          if (sql.includes('DELETE FROM movie_cast')) {
            return { rowCount: 0 }
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

      if (isSchemaSetupQuery(sql)) {
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
              return { rowCount: 1, rows: [{ id: tmdbId, inserted: false }] }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1, rows: [{ id: tmdbId, inserted: true }] }
          }

          if (sql.includes('DELETE FROM movie_cast')) {
            return { rowCount: 0 }
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

test('importUpcomingMovies returns the qualifying subset and updates existing rows', async () => {
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

      if (isSchemaSetupQuery(sql)) {
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
              return { rowCount: 1, rows: [{ id: tmdbId, inserted: false }] }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1, rows: [{ id: tmdbId, inserted: true }] }
          }

          if (sql.includes('DELETE FROM movie_cast')) {
            return { rowCount: 0 }
          }

          throw new Error(`Unexpected query: ${sql}`)
        },
        release() {},
      }
    },
  }
  const fetchImpl = async (url) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith('/movie/upcoming')) {
      return {
        ok: true,
        async json() {
          return {
            total_pages: 1,
            results: [
              { id: 1, title: 'Movie 1', release_date: '2026-07-08', genre_ids: [18] },
              { id: 2, title: 'Movie 2', release_date: '2026-07-15', genre_ids: [18] },
              { id: 3, title: 'Too Far', release_date: '2026-08-10', genre_ids: [18] },
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

  const result = await importUpcomingMovies(pool, {
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
  assert.deepEqual(
    result.movies.map((movie) => movie.tmdbId),
    [1, 2]
  )
  assert.equal(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS movies')), true)
})

test('backfillMovieCredits refreshes existing movies and reports failures without aborting', async () => {
  const replacedMovies = []
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM movies')) {
        return {
          rows: [
            { id: 1, tmdb_id: 101, title: 'One' },
            { id: 2, tmdb_id: 102, title: 'Two' },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
    async connect() {
      return {
        async query(sql, params) {
          if (sql === 'BEGIN' || sql === 'COMMIT') {
            return { rowCount: null }
          }

          if (sql.includes('SELECT id') && sql.includes('FROM movies')) {
            return { rows: [{ id: params[0] }] }
          }

          if (sql.includes('DELETE FROM movie_cast')) {
            replacedMovies.push(params[0])
            return { rowCount: 1 }
          }

          if (sql.includes('INSERT INTO cast_members')) {
            return { rows: [{ id: params[0], inserted: true }] }
          }

          if (sql.includes('INSERT INTO movie_cast')) {
            return { rowCount: 1 }
          }

          throw new Error(`Unexpected query: ${sql}`)
        },
        release() {},
      }
    },
  }

  const result = await backfillMovieCredits(pool, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    fetchImpl: async (url) => {
      if (String(url).endsWith('/102/credits')) {
        throw new Error('boom')
      }

      return {
        ok: true,
        async json() {
          return {
            cast: [{ id: 7, name: 'Actor 7', order: 0, character: 'Lead' }],
            crew: [{ id: 8, name: 'Director 8', job: 'Director' }],
          }
        },
      }
    },
  })

  assert.deepEqual(replacedMovies, [101])
  assert.deepEqual(result, {
    processedCount: 2,
    insertedCount: 2,
    updatedCount: 1,
    failedCount: 1,
  })
})
