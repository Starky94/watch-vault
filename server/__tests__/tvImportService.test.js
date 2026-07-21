import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectAiringTodayTvShows,
  collectOnTheAirTvShows,
  collectPopularTvShows,
  importAiringTodayTvShows,
  importOnTheAirTvShows,
  importPopularTvShows,
  normalizeTvShow,
} from '../tvImportService.js'

function isSchemaSetupQuery(sql) {
  return (
    sql.includes('CREATE TABLE IF NOT EXISTS movies') ||
    sql.includes('CREATE TABLE IF NOT EXISTS books') ||
    sql.includes('CREATE INDEX IF NOT EXISTS books_import_order_idx') ||
    sql.includes('UPDATE books') ||
    sql.includes('CREATE TABLE IF NOT EXISTS genres') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_genres') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_shows') ||
    sql.includes('ALTER TABLE movies') ||
    sql.includes('UPDATE movies') ||
    sql.includes('CREATE TABLE IF NOT EXISTS cast_members') ||
    sql.includes('ALTER TABLE cast_members') ||
    sql.includes('CREATE TABLE IF NOT EXISTS movie_cast') ||
    sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS movie_cast_unique_credit_idx') ||
    sql.includes('CREATE TABLE IF NOT EXISTS users') ||
    sql.includes('INSERT INTO users') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watchlist_items') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watched_movies') ||
    sql.includes('ALTER TABLE watched_movies') ||
    sql.includes('CREATE TABLE IF NOT EXISTS movie_ratings') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_watchlist_items') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watched_tv_shows')
    || sql.includes('ALTER TABLE users')
    || sql.includes('CREATE TABLE IF NOT EXISTS user_alerts')
    || sql.includes('CREATE TABLE IF NOT EXISTS alert_feature_state')
    || sql.includes('INSERT INTO alert_feature_state')
    || sql.includes('CREATE TABLE IF NOT EXISTS favorite_actors')
  )
}

test('normalizeTvShow keeps mapped fields and import order', () => {
  const show = normalizeTvShow(
    {
      id: 42,
      name: 'The Last of Us',
      original_name: 'The Last of Us',
      overview: 'Survival drama.',
      first_air_date: '2023-01-15',
      original_language: 'en',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      popularity: 55.1,
      vote_average: 8.7,
      vote_count: 12000,
      genre_ids: [18, 10765],
    },
    4
  )

  assert.equal(show.tmdbId, 42)
  assert.equal(show.name, 'The Last of Us')
  assert.deepEqual(show.genreIds, [18, 10765])
  assert.equal(show.importRank, 5)
})

test('collectPopularTvShows fetches page 2 when page 1 has fewer than 30 shows', async () => {
  const pageOne = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    name: `Show ${index + 1}`,
    genre_ids: [],
  }))

  const pageTwo = Array.from({ length: 20 }, (_, index) => ({
    id: index + 21,
    name: `Show ${index + 21}`,
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

  const shows = await collectPopularTvShows(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 30,
  })

  assert.equal(calls.length, 2)
  assert.equal(shows.length, 30)
  assert.equal(shows[0].tmdbId, 1)
  assert.equal(shows[29].tmdbId, 30)
})

test('collectAiringTodayTvShows filters to the last 30 days and skips duplicates', async () => {
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
              { id: 1, name: 'Recent 1', first_air_date: '2026-06-30', genre_ids: [] },
              { id: 2, name: 'Old', first_air_date: '2026-05-20', genre_ids: [] },
              { id: 3, name: 'Missing date', genre_ids: [] },
            ],
          }
        }

        return {
          total_pages: 2,
          results: [
            { id: 1, name: 'Recent 1 again', first_air_date: '2026-06-30', genre_ids: [] },
            { id: 4, name: 'Recent 2', first_air_date: '2026-06-15', genre_ids: [] },
          ],
        }
      },
    }
  }

  const shows = await collectAiringTodayTvShows(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 5,
    now: new Date('2026-07-02T12:00:00.000Z'),
  })

  assert.deepEqual(
    shows.map((show) => show.tmdbId),
    [1, 4]
  )
})

test('collectOnTheAirTvShows sorts the qualifying subset by first air date ascending', async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        total_pages: 1,
        results: [
          { id: 2, name: 'Later', first_air_date: '2026-07-15', genre_ids: [] },
          { id: 1, name: 'Sooner', first_air_date: '2026-07-08', genre_ids: [] },
          { id: 3, name: 'Too Far', first_air_date: '2026-08-10', genre_ids: [] },
        ],
      }
    },
  })

  const shows = await collectOnTheAirTvShows(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 30,
    now: new Date('2026-07-02T12:00:00.000Z'),
  })

  assert.deepEqual(
    shows.map((show) => show.tmdbId),
    [1, 2]
  )
})

test('importPopularTvShows returns fetched, inserted, and updated counts and writes to tv_shows', async () => {
  const executed = []
  const existingIds = new Set([1, 2])
  const pool = {
    async query(sql, params) {
      executed.push(sql)

      if (sql.includes('FROM tv_genres')) {
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO tv_genres')) {
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

          if (sql.includes('INSERT INTO tv_shows')) {
            const tmdbId = params[0]
            if (existingIds.has(tmdbId)) {
              return { rowCount: 1, rows: [{ id: tmdbId, inserted: false }] }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1, rows: [{ id: tmdbId, inserted: true }] }
          }

          throw new Error(`Unexpected query: ${sql}`)
        },
        release() {},
      }
    },
  }
  const fetchImpl = async (url) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith('/tv/popular')) {
      return {
        ok: true,
        async json() {
          return {
            results: Array.from({ length: 4 }, (_, index) => ({
              id: index + 1,
              name: `Show ${index + 1}`,
              genre_ids: [18],
            })),
          }
        },
      }
    }

    if (parsed.pathname.endsWith('/genre/tv/list')) {
      return {
        ok: true,
        async json() {
          return {
            genres: [{ id: 18, name: 'Drama' }],
          }
        },
      }
    }

    if (parsed.pathname.includes('/tv/')) {
      return {
        ok: true,
        async json() {
          return {
            id: Number.parseInt(parsed.pathname.split('/').at(-1), 10),
            name: 'Detailed Show',
            genres: [{ id: 18, name: 'Drama' }],
          }
        },
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await importPopularTvShows(pool, {
    fetchImpl,
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 4,
  })

  assert.equal(result.fetchedCount, 4)
  assert.equal(result.insertedCount, 2)
  assert.equal(result.updatedCount, 2)
  assert.equal(result.tvShows.length, 4)
  assert.equal(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS tv_shows')), true)
  assert.equal(executed.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS tv_genres')), true)
})

test('importAiringTodayTvShows returns the qualifying subset and updates existing rows', async () => {
  const existingIds = new Set([2])
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM tv_genres')) {
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO tv_genres')) {
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

          if (sql.includes('INSERT INTO tv_shows')) {
            const tmdbId = params[0]
            if (existingIds.has(tmdbId)) {
              return { rowCount: 1, rows: [{ id: tmdbId, inserted: false }] }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1, rows: [{ id: tmdbId, inserted: true }] }
          }

          throw new Error(`Unexpected query: ${sql}`)
        },
        release() {},
      }
    },
  }
  const fetchImpl = async (url) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith('/tv/airing_today')) {
      return {
        ok: true,
        async json() {
          return {
            total_pages: 1,
            results: [
              { id: 1, name: 'Show 1', first_air_date: '2026-06-30', genre_ids: [18] },
              { id: 2, name: 'Show 2', first_air_date: '2026-06-25', genre_ids: [18] },
              { id: 3, name: 'Old Show', first_air_date: '2026-05-10', genre_ids: [18] },
            ],
          }
        },
      }
    }

    if (parsed.pathname.endsWith('/genre/tv/list')) {
      return {
        ok: true,
        async json() {
          return {
            genres: [{ id: 18, name: 'Drama' }],
          }
        },
      }
    }

    if (parsed.pathname.includes('/tv/')) {
      return {
        ok: true,
        async json() {
          return {
            id: Number.parseInt(parsed.pathname.split('/').at(-1), 10),
            name: 'Detailed Show',
            genres: [{ id: 18, name: 'Drama' }],
          }
        },
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await importAiringTodayTvShows(pool, {
    fetchImpl,
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 30,
    now: new Date('2026-07-02T12:00:00.000Z'),
  })

  assert.equal(result.fetchedCount, 2)
  assert.equal(result.insertedCount, 1)
  assert.equal(result.updatedCount, 1)
})

test('importOnTheAirTvShows returns the qualifying subset and updates existing rows', async () => {
  const existingIds = new Set([2])
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM tv_genres')) {
        return { rows: [] }
      }

      if (sql.includes('INSERT INTO tv_genres')) {
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

          if (sql.includes('INSERT INTO tv_shows')) {
            const tmdbId = params[0]
            if (existingIds.has(tmdbId)) {
              return { rowCount: 1, rows: [{ id: tmdbId, inserted: false }] }
            }

            existingIds.add(tmdbId)
            return { rowCount: 1, rows: [{ id: tmdbId, inserted: true }] }
          }

          throw new Error(`Unexpected query: ${sql}`)
        },
        release() {},
      }
    },
  }
  const fetchImpl = async (url) => {
    const parsed = new URL(url)

    if (parsed.pathname.endsWith('/tv/on_the_air')) {
      return {
        ok: true,
        async json() {
          return {
            total_pages: 1,
            results: [
              { id: 1, name: 'Show 1', first_air_date: '2026-07-08', genre_ids: [18] },
              { id: 2, name: 'Show 2', first_air_date: '2026-07-15', genre_ids: [18] },
              { id: 3, name: 'Too Far', first_air_date: '2026-08-10', genre_ids: [18] },
            ],
          }
        },
      }
    }

    if (parsed.pathname.endsWith('/genre/tv/list')) {
      return {
        ok: true,
        async json() {
          return {
            genres: [{ id: 18, name: 'Drama' }],
          }
        },
      }
    }

    if (parsed.pathname.includes('/tv/')) {
      return {
        ok: true,
        async json() {
          return {
            id: Number.parseInt(parsed.pathname.split('/').at(-1), 10),
            name: 'Detailed Show',
            genres: [{ id: 18, name: 'Drama' }],
          }
        },
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  const result = await importOnTheAirTvShows(pool, {
    fetchImpl,
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    count: 30,
    now: new Date('2026-07-02T12:00:00.000Z'),
  })

  assert.equal(result.fetchedCount, 2)
  assert.equal(result.insertedCount, 1)
  assert.equal(result.updatedCount, 1)
  assert.deepEqual(
    result.tvShows.map((show) => show.tmdbId),
    [1, 2]
  )
})
