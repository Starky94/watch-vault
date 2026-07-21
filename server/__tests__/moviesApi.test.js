import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { buildStatsInsights, countMovies, countStoredDataBytes, ensureMoviesTable, getBookStatsForUser, getMostWatchedActorsForUser, getMovieStatsForUser, getStatsInsightsForUser, getStreamingPlatformsForUser, getTopRatedThisMonthForUser, listCalendarEventsForUser, listContinueWatchingTvShowsForUser, listGenres, listLatestEpisodeTvShows, listMovies, listRecentlyReleasedMovies, listSimilarMovies, listTopRatedMovies, listTvShows, listTvWatchlistShowsForUser, listUpcomingMovies, listWatchedMoviesByGenreForUser, listWatchedTvEpisodesForUser, searchActors, searchBooks, searchMovies, searchTvShows, updateTvEpisodeWatchStateForUser, upsertTvEpisodeRatingForUser } from '../database.js'

function isSchemaSetupQuery(sql) {
  return (
    sql.includes('CREATE TABLE IF NOT EXISTS movies') ||
    sql.includes('CREATE TABLE IF NOT EXISTS books') ||
    sql.includes('CREATE TABLE IF NOT EXISTS authors') ||
    sql.includes('CREATE TABLE IF NOT EXISTS book_authors') ||
    sql.includes('CREATE TABLE IF NOT EXISTS favorite_authors') ||
    sql.includes('CREATE TABLE IF NOT EXISTS book_watchlist_items') ||
    sql.includes('CREATE TABLE IF NOT EXISTS read_books') ||
    sql.includes('CREATE TABLE IF NOT EXISTS book_ratings') ||
    sql.includes('CREATE INDEX IF NOT EXISTS books_import_order_idx') ||
    sql.includes('INSERT INTO authors') ||
    sql.includes('INSERT INTO book_authors') ||
    sql.includes('UPDATE books') ||
    sql.includes('CREATE TABLE IF NOT EXISTS genres') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_genres') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_shows') ||
    sql.includes('ALTER TABLE movies') ||
    sql.includes('UPDATE movies') ||
    sql.includes('CREATE TABLE IF NOT EXISTS cast_members') ||
    sql.includes('CREATE TABLE IF NOT EXISTS movie_cast') ||
    sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS movie_cast_unique_credit_idx') ||
    sql.includes('ALTER TABLE cast_members') ||
    sql.includes('CREATE TABLE IF NOT EXISTS users') ||
    sql.includes('INSERT INTO users') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watchlist_items') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watched_movies') ||
    sql.includes('ALTER TABLE watched_movies') ||
    sql.includes('CREATE TABLE IF NOT EXISTS movie_ratings') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_watchlist_items') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watched_tv_shows') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_seasons') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_episodes') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_show_credits') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_recommendations') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_trailers') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watched_tv_episodes') ||
    sql.includes('ALTER TABLE watched_tv_episodes') ||
    sql.includes('CREATE TABLE IF NOT EXISTS tv_episode_ratings') ||
    sql.includes('ALTER TABLE tv_shows')
    || sql.includes('ALTER TABLE users')
    || sql.includes('CREATE TABLE IF NOT EXISTS user_alerts')
    || sql.includes('CREATE TABLE IF NOT EXISTS alert_feature_state')
    || sql.includes('INSERT INTO alert_feature_state')
    || sql.includes('CREATE TABLE IF NOT EXISTS favorite_actors')
    || sql.includes('CREATE TABLE IF NOT EXISTS achievement_')
    || sql.includes('CREATE TABLE IF NOT EXISTS user_achievement_unlocks')
    || sql.includes('INSERT INTO achievement_')
  )
}

async function closeServer(server) {
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

test('listMovies requests the top 30 titles ordered by popularity descending', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }

  const movies = await listMovies(pool)

  assert.deepEqual(movies, [])
  assert.match(executedSql, /ORDER BY popularity DESC NULLS LAST, tmdb_id ASC/i)
  assert.match(executedSql, /LIMIT \$1/i)
  assert.match(executedSql, /OFFSET \$2/i)
  assert.deepEqual(executedParams, [30, 0])
})

test('listMovies applies a case-insensitive genre filter when provided', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }

  const movies = await listMovies(pool, { genre: 'action' })

  assert.deepEqual(movies, [])
  assert.match(executedSql, /WHERE EXISTS/i)
  assert.match(executedSql, /LOWER\(selected_genres\.name\) = LOWER\(\$3\)/i)
  assert.deepEqual(executedParams, [30, 0, 'action'])
})

test('listWatchedMoviesByGenreForUser scopes, filters, orders, and paginates watched movies', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }

  await listWatchedMoviesByGenreForUser(pool, 'florind', { genre: 'sci-fi', limit: 31, page: 2 })

  assert.match(executedSql, /WHERE users\.username = \$1/i)
  assert.match(executedSql, /LOWER\(selected_genres\.name\) = LOWER\(\$2\)/i)
  assert.match(executedSql, /ORDER BY watched_movies\.created_at DESC, movies\.tmdb_id ASC/i)
  assert.match(executedSql, /LIMIT \$3/i)
  assert.match(executedSql, /OFFSET \$4/i)
  assert.deepEqual(executedParams, ['florind', 'sci-fi', 31, 31])
})

test('local search queries use literal case-insensitive substring matching with stable result ordering', async () => {
  const queries = []
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params })
      return { rows: [] }
    },
  }

  await Promise.all([
    searchMovies(pool, 'Dune'),
    searchTvShows(pool, 'Dune'),
    searchActors(pool, 'Dune'),
  ])

  assert.equal(queries.length, 3)
  for (const { sql, params } of queries) {
    assert.match(sql, /POSITION\(LOWER\(\$1\) IN LOWER\(/i)
    assert.match(sql, /ORDER BY (?:movies\.|tv_shows\.)?popularity DESC NULLS LAST/i)
    assert.match(sql, /LIMIT \$2/i)
    assert.deepEqual(params, ['Dune', 30])
  }
})

test('listGenres returns only used genres ordered alphabetically', async () => {
  let executedSql = ''
  const rows = [
    { tmdb_genre_id: 12, name: 'Adventure', movie_count: 4 },
    { tmdb_genre_id: 18, name: 'Drama', movie_count: 7 },
  ]
  const pool = {
    async query(sql) {
      executedSql = sql
      return { rows }
    },
  }

  const genres = await listGenres(pool)

  assert.deepEqual(genres, rows)
  assert.match(executedSql, /JOIN movies ON genres\.tmdb_genre_id = ANY\(movies\.genre_ids\)/i)
  assert.match(executedSql, /HAVING COUNT\(DISTINCT movies\.id\) > 0/i)
  assert.match(executedSql, /ORDER BY LOWER\(genres\.name\) ASC/i)
})

test('getBookStatsForUser scopes all book widgets to the requested period and preserves missing page counts', async () => {
  const queries = []
  const responses = [
    { rows: [{ has_user: true, books_read: 2, pages_read: 320, physical_books_read: 1, ebook_books_read: 0, audiobook_books_read: 1, watchlist_count: 1, average_rating: 4.5 }] },
    { rows: [{ read_at: '2026-07-02T12:00:00.000Z', page_count: 320 }, { read_at: '2026-07-08T12:00:00.000Z', page_count: 0 }] },
    { rows: [{ name: 'Fantasy', book_count: 2, pages: 320 }] },
    { rows: [{ name: 'Ursula K. Le Guin', book_count: 2 }] },
    { rows: [{ google_books_id: 'earthsea', title: 'A Wizard of Earthsea', authors: ['Ursula K. Le Guin'], cover_image_url: null, score: 5 }] },
    { rows: [{ google_books_id: 'earthsea', title: 'A Wizard of Earthsea', authors: ['Ursula K. Le Guin'], cover_image_url: null, read_at: '2026-07-08T12:00:00.000Z' }] },
  ]
  const pool = { async query(sql, params) { queries.push({ sql, params }); return responses.shift() } }

  const stats = await getBookStatsForUser(pool, 'florind', 'month')

  assert.deepEqual(stats.metrics, { booksRead: 2, pagesRead: 320, watchlistCount: 1, averageRating: 4.5 })
  assert.deepEqual(stats.formats, { physical: 1, ebook: 0, audiobook: 1 })
  assert.deepEqual(stats.categories, [{ name: 'Fantasy', bookCount: 2, pages: 320 }])
  assert.deepEqual(stats.authors, [{ name: 'Ursula K. Le Guin', bookCount: 2 }])
  assert.equal(stats.topRated[0].id, 'earthsea')
  assert.equal(stats.recentReads[0].id, 'earthsea')
  assert.equal(stats.activity.buckets.reduce((total, bucket) => total + bucket.pagesRead, 0), 320)
  assert.equal(stats.activity.buckets.reduce((total, bucket) => total + bucket.booksRead, 0), 2)
  assert.equal(queries.length, 6)
  for (const query of queries) assert.equal(query.params[1], 'month')
})

test('ensureMoviesTable creates normalized cast tables and watchlist tables', async () => {
  const executedSql = []
  const pool = {
    async query(sql) {
      executedSql.push(sql)
      return { rowCount: null }
    },
  }

  await ensureMoviesTable(pool)

  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS cast_members')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS movie_cast')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS movie_cast_unique_credit_idx')), true)
  assert.equal(executedSql.some((sql) => sql.includes('ALTER TABLE cast_members')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS users')), true)
  assert.equal(executedSql.some((sql) => sql.includes('INSERT INTO users')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS watchlist_items')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS watched_movies')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS movie_ratings')), true)
  assert.equal(executedSql.some((sql) => sql.includes('UNIQUE (user_id, movie_id)')), true)
  assert.equal(executedSql.some((sql) => sql.includes('score >= 1.0 AND score <= 5.0')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS tv_watchlist_items')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS watched_tv_shows')), true)
  assert.equal(executedSql.some((sql) => sql.includes('UPDATE movies')), true)
})

test('POST /api/auth/login authenticates seeded users from the database', async () => {
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM users') && sql.includes('AND password = $2')) {
        if (params[0] === 'florind' && params[1] === 'test') {
          return {
            rows: [
              {
                id: 1,
                username: 'florind',
                full_name: 'Florin Druta',
              },
            ],
          }
        }

        return { rows: [] }
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'florind',
        password: 'test',
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload.user, {
      username: 'florind',
      fullName: 'Florin Druta',
    })
  } finally {
    await closeServer(server)
  }
})

test('POST /api/auth/login rejects invalid credentials', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM users') && sql.includes('AND password = $2')) {
        return { rows: [] }
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'unknown',
        password: 'wrong',
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.error, 'Invalid username or password')
  } finally {
    await closeServer(server)
  }
})

test('POST /api/auth/change-password updates the password for an authenticated user', async () => {
  const users = new Map([
    ['florind', { id: 1, username: 'florind', full_name: 'Florin Druta', password: 'test' }],
  ])

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM users') && sql.includes('AND password = $2')) {
        const [username, password] = params
        const user = users.get(username)

        if (!user || user.password !== password) {
          return { rows: [] }
        }

        return {
          rows: [
            {
              id: user.id,
              username: user.username,
              full_name: user.full_name,
            },
          ],
        }
      }

      if (sql.includes('FROM users') && sql.includes('WHERE username = $1') && sql.includes('LIMIT 1')) {
        const [username] = params
        const user = users.get(username)

        return {
          rows: user
            ? [
                {
                  id: user.id,
                  username: user.username,
                  full_name: user.full_name,
                },
              ]
            : [],
        }
      }

      if (sql.includes('UPDATE users') && sql.includes('SET') && sql.includes('password = $3')) {
        const [username, currentPassword, newPassword] = params
        const user = users.get(username)

        if (!user || user.password !== currentPassword) {
          return { rows: [] }
        }

        user.password = newPassword

        return {
          rows: [
            {
              id: user.id,
              username: user.username,
              full_name: user.full_name,
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const changePasswordResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        currentPassword: 'test',
        newPassword: 'fresh-pass',
        confirmPassword: 'fresh-pass',
      }),
    })
    const changePasswordPayload = await changePasswordResponse.json()

    assert.equal(changePasswordResponse.status, 200)
    assert.equal(changePasswordPayload.message, 'Password changed successfully')

    const oldPasswordResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'florind',
        password: 'test',
      }),
    })

    assert.equal(oldPasswordResponse.status, 401)

    const newPasswordResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'florind',
        password: 'fresh-pass',
      }),
    })
    const newPasswordPayload = await newPasswordResponse.json()

    assert.equal(newPasswordResponse.status, 200)
    assert.deepEqual(newPasswordPayload.user, {
      username: 'florind',
      fullName: 'Florin Druta',
    })
  } finally {
    await closeServer(server)
  }
})

test('POST /api/auth/change-password rejects missing authentication', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'test',
        newPassword: 'fresh-pass',
        confirmPassword: 'fresh-pass',
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.error, 'Authentication required')
  } finally {
    await closeServer(server)
  }
})

test('POST /api/auth/change-password rejects an incorrect current password', async () => {
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM users') && sql.includes('WHERE username = $1') && sql.includes('LIMIT 1')) {
        return {
          rows: [
            {
              id: 1,
              username: params[0],
              full_name: 'Florin Druta',
            },
          ],
        }
      }

      if (sql.includes('UPDATE users') && sql.includes('password = $3')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        currentPassword: 'wrong',
        newPassword: 'fresh-pass',
        confirmPassword: 'fresh-pass',
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.error, 'Current password is incorrect')
  } finally {
    await closeServer(server)
  }
})

test('POST /api/auth/change-password validates new password requirements', async () => {
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM users') && sql.includes('WHERE username = $1') && sql.includes('LIMIT 1')) {
        return {
          rows: [
            {
              id: 1,
              username: params[0],
              full_name: 'Florin Druta',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()

    const emptyPasswordResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        currentPassword: 'test',
        newPassword: '   ',
        confirmPassword: '   ',
      }),
    })
    const emptyPasswordPayload = await emptyPasswordResponse.json()

    assert.equal(emptyPasswordResponse.status, 400)
    assert.equal(emptyPasswordPayload.error, 'New password is required')

    const samePasswordResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        currentPassword: 'test',
        newPassword: 'test',
        confirmPassword: 'test',
      }),
    })
    const samePasswordPayload = await samePasswordResponse.json()

    assert.equal(samePasswordResponse.status, 400)
    assert.equal(samePasswordPayload.error, 'New password must be different from your current password')

    const mismatchResponse = await fetch(`http://127.0.0.1:${address.port}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        currentPassword: 'test',
        newPassword: 'fresh-pass',
        confirmPassword: 'not-the-same',
      }),
    })
    const mismatchPayload = await mismatchResponse.json()

    assert.equal(mismatchResponse.status, 400)
    assert.equal(mismatchPayload.error, 'New password confirmation does not match')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/watchlist rejects unauthenticated requests', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/watchlist`)
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.error, 'Authentication required')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/calendar validates its month and media type before querying user data', async () => {
  const pool = { async query(sql) { if (isSchemaSetupQuery(sql)) return { rowCount: null }; throw new Error(`Unexpected query: ${sql}`) } }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/calendar?month=July&mediaType=book`)
    const payload = await response.json()
    assert.equal(response.status, 400)
    assert.equal(payload.error, 'month must use YYYY-MM format')
  } finally {
    await closeServer(server)
  }
})

test('watchlist endpoints stay isolated per user and duplicate adds are idempotent', async () => {
  const watchlists = new Map([
    ['florind', []],
    ['alex', []],
  ])
  const movieRow = {
    tmdb_id: 42,
    title: 'Dune: Part Two',
    original_title: 'Dune: Part Two',
    overview: 'Movie overview',
    release_date: '2024-03-01',
    original_language: 'en',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    popularity: 100,
    vote_average: 8.7,
    vote_count: 2150,
    adult: false,
    video: false,
    genre_ids: [12, 878],
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
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('deleted_watchlist AS')) {
        const [username, movieId] = params

        if (!watchlists.has(username)) {
          return {
            rows: [{ has_user: false, has_movie: false, removed: false }],
          }
        }

        if (movieId !== 42) {
          return {
            rows: [{ has_user: true, has_movie: false, removed: false }],
          }
        }

        const existing = watchlists.get(username) ?? []
        const nextMovies = existing.filter((movie) => Number(movie.tmdb_id) !== movieId)
        const removed = nextMovies.length !== existing.length
        watchlists.set(username, nextMovies)

        return {
          rows: [{ has_user: true, has_movie: true, removed }],
        }
      }

      if (sql.includes('WITH selected_user AS')) {
        const [username, movieId] = params

        if (!watchlists.has(username)) {
          return {
            rows: [{ has_user: false, has_movie: false, created_at: null }],
          }
        }

        if (movieId !== 42) {
          return {
            rows: [{ has_user: true, has_movie: false, created_at: null }],
          }
        }

        const existing = watchlists.get(username)
        const createdAt = existing[0]?.watchlisted_at ?? '2026-07-03T10:00:00.000Z'

        if (existing.length === 0) {
          watchlists.set(username, [{ ...movieRow, watchlisted_at: createdAt }])
        }

        return {
          rows: [{ has_user: true, has_movie: true, created_at: createdAt }],
        }
      }

      if (sql.includes('FROM users') && sql.includes('WHERE username = $1') && sql.includes('LIMIT 1')) {
        const username = params[0]

        if (!watchlists.has(username)) {
          return { rows: [] }
        }

        return {
          rows: [
            {
              id: username === 'florind' ? 1 : 2,
              username,
              full_name: username === 'florind' ? 'Florin Druta' : 'Alex Morgan',
            },
          ],
        }
      }

      if (sql.includes('FROM watchlist_items') && sql.includes('WHERE users.username = $1')) {
        return {
          rows: watchlists.get(params[0]) ?? [],
        }
      }

      if (sql.includes('FROM book_watchlist_items') && sql.includes('WHERE users.username = $1')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()

    const addFirstResponse = await fetch(`http://127.0.0.1:${address.port}/api/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        movieId: 42,
      }),
    })
    const addFirstPayload = await addFirstResponse.json()

    const addDuplicateResponse = await fetch(`http://127.0.0.1:${address.port}/api/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        movieId: 42,
      }),
    })
    const addDuplicatePayload = await addDuplicateResponse.json()

    const florindWatchlistResponse = await fetch(`http://127.0.0.1:${address.port}/api/watchlist`, {
      headers: {
        'x-watchvault-username': 'florind',
      },
    })
    const florindWatchlistPayload = await florindWatchlistResponse.json()

    const alexWatchlistResponse = await fetch(`http://127.0.0.1:${address.port}/api/watchlist`, {
      headers: {
        'x-watchvault-username': 'alex',
      },
    })
    const alexWatchlistPayload = await alexWatchlistResponse.json()

    const removeResponse = await fetch(`http://127.0.0.1:${address.port}/api/watchlist/42`, {
      method: 'DELETE',
      headers: {
        'x-watchvault-username': 'florind',
      },
    })
    const removePayload = await removeResponse.json()

    const florindWatchlistAfterRemoveResponse = await fetch(`http://127.0.0.1:${address.port}/api/watchlist`, {
      headers: {
        'x-watchvault-username': 'florind',
      },
    })
    const florindWatchlistAfterRemovePayload = await florindWatchlistAfterRemoveResponse.json()

    assert.equal(addFirstResponse.status, 200)
    assert.equal(addDuplicateResponse.status, 200)
    assert.equal(addFirstPayload.movie.id, 42)
    assert.equal(addDuplicatePayload.movie.id, 42)
    assert.equal(florindWatchlistResponse.status, 200)
    assert.equal(florindWatchlistPayload.count, 1)
    assert.deepEqual(florindWatchlistPayload.movies[0], {
      id: 42,
      title: 'Dune: Part Two',
      year: '2024',
      meta: 'Adventure, Sci-Fi',
      rating: 8.7,
      type: 'Movies',
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
      watchlistedAt: '2026-07-03T10:00:00.000Z',
    })
    assert.equal(alexWatchlistResponse.status, 200)
    assert.equal(alexWatchlistPayload.count, 0)
    assert.deepEqual(alexWatchlistPayload.movies, [])
    assert.equal(removeResponse.status, 200)
    assert.deepEqual(removePayload, { removed: true })
    assert.equal(florindWatchlistAfterRemoveResponse.status, 200)
    assert.equal(florindWatchlistAfterRemovePayload.count, 0)
    assert.deepEqual(florindWatchlistAfterRemovePayload.movies, [])
  } finally {
    await closeServer(server)
  }
})

test('POST /api/watchlist rejects adds beyond the 30 movie limit', async () => {
  const watchlists = new Map([
    [
      'florind',
      Array.from({ length: 30 }, (_, index) => ({
        tmdb_id: index + 1,
        title: `Movie ${index + 1}`,
        release_date: '2026-01-01',
        genre_names: ['Drama'],
        vote_average: 7.5,
        poster_path: `/poster-${index + 1}.jpg`,
        backdrop_path: `/backdrop-${index + 1}.jpg`,
        watchlisted_at: `2026-07-03T10:${String(index).padStart(2, '0')}:00.000Z`,
      })),
    ],
  ])

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WITH selected_user AS')) {
        const [username, movieId] = params
        const existing = watchlists.get(username) ?? []
        const alreadySaved = existing.some((movie) => Number(movie.tmdb_id) === movieId)

        return {
          rows: [
            {
              has_user: username === 'florind',
              has_movie: true,
              watchlist_total: existing.length,
              already_saved: alreadySaved,
              created_at: alreadySaved ? existing.find((movie) => Number(movie.tmdb_id) === movieId)?.watchlisted_at ?? null : null,
            },
          ],
        }
      }

      if (sql.includes('FROM users') && sql.includes('WHERE username = $1') && sql.includes('LIMIT 1')) {
        if (params[0] !== 'florind') {
          return { rows: [] }
        }

        return {
          rows: [
            {
              id: 1,
              username: 'florind',
              full_name: 'Florin Druta',
            },
          ],
        }
      }

      if (sql.includes('FROM watchlist_items') && sql.includes('WHERE users.username = $1')) {
        return {
          rows: watchlists.get(params[0]) ?? [],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/watchlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        movieId: 999,
      }),
    })
    const payload = await response.json()

    assert.equal(response.status, 409)
    assert.deepEqual(payload, {
      error: 'You can save up to 30 movies in your watchlist.',
    })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/watched rejects unauthenticated requests', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/watched`)
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.error, 'Authentication required')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/watched/by-genre returns a user-scoped 30-item page', async () => {
  const watchedMovies = Array.from({ length: 31 }, (_value, index) => ({
    tmdb_id: index + 1,
    title: `Sci-Fi ${index + 1}`,
    release_date: '2024-01-01',
    genre_names: ['Sci-Fi'],
    vote_average: 8,
    poster_path: null,
    backdrop_path: null,
    watched_at: `2026-07-${String(31 - index).padStart(2, '0')}T00:00:00.000Z`,
  }))
  const queries = []
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params })
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      if (sql.includes('FROM users') && sql.includes('WHERE username = $1') && sql.includes('LIMIT 1')) {
        return { rows: [{ id: 1, username: params[0], full_name: 'Florin Druta' }] }
      }
      if (sql.includes('FROM watched_movies') && sql.includes('selected_genres')) {
        return { rows: watchedMovies }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/watched/by-genre?genre=sci-fi&page=1&limit=30`, {
      headers: { 'x-watchvault-username': 'florind' },
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.count, 30)
    assert.equal(payload.movies.length, 30)
    assert.deepEqual(payload.pagination, { page: 1, pageSize: 30, hasNextPage: true, hasPreviousPage: false })
    const genreQuery = queries.find(({ sql }) => sql.includes('FROM watched_movies') && sql.includes('selected_genres'))
    assert.deepEqual(genreQuery.params, ['florind', 'sci-fi', 31, 0])
  } finally {
    await closeServer(server)
  }
})

test('GET /api/watched/by-genre requires authentication', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/watched/by-genre?genre=Drama`)
    const payload = await response.json()
    assert.equal(response.status, 401)
    assert.equal(payload.error, 'Authentication required')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/stats/insights requires authentication and validates period and timezone', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      if (sql.includes('combined_ratings')) return { rows: [{ title: 'Movie A', poster_path: '/movie-a.jpg', media_type: 'movie', score: 5, episode_count: 0 }] }
      if (sql.includes('events AS') || sql.includes('SELECT score::DOUBLE PRECISION score')) return { rows: [] }
      if (sql.includes('SELECT') && sql.includes('FROM users') && sql.includes('WHERE username = $1')) {
        return { rows: [{ id: 1, username: 'florind', full_name: 'Florin Druta' }] }
      }
      if (sql.includes('stats_insight_events')) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}/api/stats/insights`

    let response = await fetch(baseUrl)
    assert.equal(response.status, 401)

    response = await fetch(`${baseUrl}?period=decade`, { headers: { 'x-watchvault-username': 'florind' } })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'period must be one of: week, month, year' })

    response = await fetch(`${baseUrl}?period=year&timeZone=Not/A_Real_Zone`, { headers: { 'x-watchvault-username': 'florind' } })
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'timeZone must be a valid IANA timezone' })

    response = await fetch(`${baseUrl}?period=year&timeZone=UTC`, { headers: { 'x-watchvault-username': 'florind' } })
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).topRatedThisMonth, [{ title: 'Movie A', posterPath: '/movie-a.jpg', mediaType: 'movie', score: 5, episodeCount: 0 }])
  } finally {
    await closeServer(server)
  }
})

test('movie stats include the user rating average for ratings created or updated in the selected period', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      return {
        rows: [{
          has_user: true,
          movies_watched: 2,
          time_watched_minutes: 250,
          watchlist_count: 1,
          average_rating: 4.25,
        }],
      }
    },
  }

  const stats = await getMovieStatsForUser(pool, 'florind', 'week')

  assert.deepEqual(stats, {
    status: 'ok',
    moviesWatched: 2,
    timeWatchedMinutes: 250,
    watchlistCount: 1,
    averageRating: 4.25,
  })
  assert.deepEqual(calls[0].params, ['florind', 'week'])
  assert.match(calls[0].sql, /AVG\(movie_ratings\.score\)::DOUBLE PRECISION AS average_rating/i)
  assert.match(calls[0].sql, /GREATEST\(movie_ratings\.created_at, movie_ratings\.updated_at\)/i)
  assert.match(calls[0].sql, /date_trunc\(\$2, NOW\(\) AT TIME ZONE 'UTC'\)/i)
})

test('movie stats expose a null rating average when the selected period has no ratings', async () => {
  const pool = {
    async query() {
      return {
        rows: [{
          has_user: true,
          movies_watched: 0,
          time_watched_minutes: 0,
          watchlist_count: 0,
          average_rating: null,
        }],
      }
    },
  }

  const stats = await getMovieStatsForUser(pool, 'florind', 'year')

  assert.equal(stats.averageRating, null)
})

test('stats insights aggregate watch activity, media events, full genre runtime, and browser-local habits', () => {
  const insights = buildStatsInsights([
    { media_type: 'movie', watched_at: '2026-07-13T01:30:00.000Z', runtime_minutes: 120, genre_names: ['Action', 'Drama'] },
    { media_type: 'tv', watched_at: '2026-07-13T22:15:00.000Z', runtime_minutes: 45, genre_names: ['Drama'] },
  ], {
    period: 'week',
    timeZone: 'Europe/Bucharest',
    now: new Date('2026-07-13T12:00:00.000Z'),
  })

  assert.equal(insights.activity.buckets.length, 7)
  assert.deepEqual(insights.activity.buckets.map(({ label, totalMinutes }) => ({ label, totalMinutes })), [
    { label: 'Mon', totalMinutes: 165 }, { label: 'Tue', totalMinutes: 0 }, { label: 'Wed', totalMinutes: 0 },
    { label: 'Thu', totalMinutes: 0 }, { label: 'Fri', totalMinutes: 0 }, { label: 'Sat', totalMinutes: 0 }, { label: 'Sun', totalMinutes: 0 },
  ])
  assert.deepEqual(insights.mediaSplit, { movieEvents: 1, tvEpisodeEvents: 1 })
  assert.deepEqual(insights.genres, [{ name: 'Drama', minutes: 165 }, { name: 'Action', minutes: 120 }])
  assert.equal(insights.habits.bestWeekdayIndex, 0)
  assert.deepEqual(insights.habits.peakWindow, { startHour: 2, endHour: 5, minutes: 120 })
})

test('stats insights produce period-specific activity buckets and query both movie and TV events', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      return { rows: [] }
    },
  }

  const insights = await getStatsInsightsForUser(pool, 'florind', { period: 'year', timeZone: 'UTC' })
  const insightQuery = calls.find(({ sql }) => sql.includes('stats_insight_events'))

  assert.equal(insights.activity.buckets.length, 12)
  assert.deepEqual(insightQuery.params, ['florind', 'year'])
  assert.match(insightQuery.sql, /FROM watched_movies/i)
  assert.match(insightQuery.sql, /FROM watched_tv_episodes/i)
  assert.match(insightQuery.sql, /tv_seasons\.season_number > 0/i)
})

test('top rated this month combines movie ratings with grouped TV episode ratings', async () => {
  let executedSql = ''
  const pool = {
    async query(sql) {
      executedSql = sql
      return { rows: [
        { title: 'Movie A', poster_path: '/movie-a.jpg', media_type: 'movie', score: '5', episode_count: 0 },
        { title: 'Show B', poster_path: '/show-b.jpg', media_type: 'tv', score: '4.5', episode_count: '3' },
      ] }
    },
  }

  assert.deepEqual(await getTopRatedThisMonthForUser(pool, 'florind'), [
    { title: 'Movie A', posterPath: '/movie-a.jpg', mediaType: 'movie', score: 5, episodeCount: 0 },
    { title: 'Show B', posterPath: '/show-b.jpg', mediaType: 'tv', score: 4.5, episodeCount: 3 },
  ])
  assert.match(executedSql, /GREATEST\(movie_ratings\.created_at, movie_ratings\.updated_at\)/i)
  assert.match(executedSql, /AVG\(tv_episode_ratings\.score\)/i)
  assert.match(executedSql, /tv_seasons\.season_number > 0/i)
  assert.match(executedSql, /GROUP BY tv_shows\.id/i)
  assert.match(executedSql, /ORDER BY score DESC, rated_at DESC, title ASC/i)
  assert.match(executedSql, /LIMIT 4/i)
})

test('stats actor and streaming platform queries aggregate watched titles and tagged runtime', async () => {
  const queries = []
  const pool = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes('watched_titles')) return { rows: [{ person_key: '12', name: 'Actor A', profile_path: '/actor.jpg', title_count: '2' }] }
      return { rows: [{ name: 'Netflix', minutes: '180' }, { name: 'Max', minutes: '60' }] }
    },
  }

  assert.deepEqual(await getMostWatchedActorsForUser(pool, 'florind', 'month'), [{ personId: '12', name: 'Actor A', profilePath: '/actor.jpg', titleCount: 2 }])
  assert.deepEqual(await getStreamingPlatformsForUser(pool, 'florind', 'month'), [{ name: 'Netflix', minutes: 180, percent: 75 }, { name: 'Max', minutes: 60, percent: 25 }])
  assert.match(queries[0], /SELECT DISTINCT tv_seasons\.tv_show_id/i)
  assert.match(queries[0], /tv_show_credits\.credit_type = 'actor'/i)
  assert.match(queries[1], /watch_service IS NOT NULL/i)
})

test('watched endpoints toggle watched state, remove watchlist entries, and return stats', async () => {
  const movieRow = {
    tmdb_id: 42,
    title: 'Dune: Part Two',
    original_title: 'Dune: Part Two',
    overview: 'Movie overview',
    release_date: '2024-03-01',
    original_language: 'en',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    popularity: 100,
    vote_average: 8.7,
    vote_count: 2150,
    adult: false,
    video: false,
    genre_ids: [12, 878],
    genre_names: ['Adventure', 'Sci-Fi'],
    runtime_minutes: 166,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }
  const watchlists = new Map([
    ['florind', [{ ...movieRow, watchlisted_at: '2026-07-03T09:00:00.000Z' }]],
    ['alex', []],
  ])
  const watched = new Map([
    ['florind', []],
    ['alex', []],
  ])

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('deleted_watched AS')) {
        const [username, movieId] = params

        if (!watched.has(username)) {
          return {
            rows: [{ has_user: false, has_movie: false, removed: false }],
          }
        }

        if (movieId !== 42) {
          return {
            rows: [{ has_user: true, has_movie: false, removed: false }],
          }
        }

        const existing = watched.get(username) ?? []
        const nextMovies = existing.filter((movie) => Number(movie.tmdb_id) !== movieId)
        const removed = nextMovies.length !== existing.length
        watched.set(username, nextMovies)

        return {
          rows: [{ has_user: true, has_movie: true, removed }],
        }
      }

      if (sql.includes('inserted_watched AS')) {
        const [username, movieId] = params

        if (!watched.has(username)) {
          return {
            rows: [{ has_user: false, has_movie: false, removed_from_watchlist: false, created_at: null }],
          }
        }

        if (movieId !== 42) {
          return {
            rows: [{ has_user: true, has_movie: false, removed_from_watchlist: false, created_at: null }],
          }
        }

        const existingWatched = watched.get(username) ?? []
        const createdAt = existingWatched[0]?.watched_at ?? '2026-07-03T11:30:00.000Z'

        if (existingWatched.length === 0) {
          watched.set(username, [{ ...movieRow, watched_at: createdAt }])
        }

        const existingWatchlist = watchlists.get(username) ?? []
        const nextWatchlist = existingWatchlist.filter((movie) => Number(movie.tmdb_id) !== movieId)
        const removedFromWatchlist = nextWatchlist.length !== existingWatchlist.length
        watchlists.set(username, nextWatchlist)

        return {
          rows: [{ has_user: true, has_movie: true, removed_from_watchlist: removedFromWatchlist, created_at: createdAt }],
        }
      }

      if (sql.includes('watched_totals AS')) {
        const username = params[0]

        if (!watched.has(username)) {
          return {
            rows: [{ has_user: false, movies_watched: 0, time_watched_minutes: 0, watchlist_count: 0 }],
          }
        }

        const watchedMovies = watched.get(username) ?? []
        const watchlistMovies = watchlists.get(username) ?? []

        return {
          rows: [
            {
              has_user: true,
              movies_watched: watchedMovies.length,
              time_watched_minutes: watchedMovies.reduce((total, movie) => total + (movie.runtime_minutes ?? 0), 0),
              watchlist_count: watchlistMovies.length,
            },
          ],
        }
      }

      if (sql.includes('FROM users') && sql.includes('WHERE username = $1') && sql.includes('LIMIT 1')) {
        const username = params[0]

        if (!watched.has(username)) {
          return { rows: [] }
        }

        return {
          rows: [
            {
              id: username === 'florind' ? 1 : 2,
              username,
              full_name: username === 'florind' ? 'Florin Druta' : 'Alex Morgan',
            },
          ],
        }
      }

      if (sql.includes('FROM watched_movies') && sql.includes('WHERE users.username = $1')) {
        return {
          rows: watched.get(params[0]) ?? [],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()

    const addResponse = await fetch(`http://127.0.0.1:${address.port}/api/watched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-watchvault-username': 'florind',
      },
      body: JSON.stringify({
        movieId: 42,
      }),
    })
    const addPayload = await addResponse.json()

    const florindWatchedResponse = await fetch(`http://127.0.0.1:${address.port}/api/watched`, {
      headers: {
        'x-watchvault-username': 'florind',
      },
    })
    const florindWatchedPayload = await florindWatchedResponse.json()

    const alexWatchedResponse = await fetch(`http://127.0.0.1:${address.port}/api/watched`, {
      headers: {
        'x-watchvault-username': 'alex',
      },
    })
    const alexWatchedPayload = await alexWatchedResponse.json()

    const removeResponse = await fetch(`http://127.0.0.1:${address.port}/api/watched/42`, {
      method: 'DELETE',
      headers: {
        'x-watchvault-username': 'florind',
      },
    })
    const removePayload = await removeResponse.json()

    assert.equal(addResponse.status, 200)
    assert.equal(addPayload.movie.id, 42)
    assert.equal(addPayload.removedFromWatchlist, true)
    assert.deepEqual(addPayload.stats, {
      moviesWatched: 1,
      timeWatchedMinutes: 166,
      watchlistCount: 0,
      averageRating: null,
    })
    assert.equal(florindWatchedResponse.status, 200)
    assert.equal(florindWatchedPayload.count, 1)
    assert.deepEqual(florindWatchedPayload.movies[0], {
      id: 42,
      title: 'Dune: Part Two',
      year: '2024',
      meta: 'Adventure, Sci-Fi',
      rating: 8.7,
      type: 'Movies',
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
      watchedAt: '2026-07-03T11:30:00.000Z',
      runtimeMinutes: 166,
    })
    assert.deepEqual(florindWatchedPayload.stats, {
      moviesWatched: 1,
      timeWatchedMinutes: 166,
      watchlistCount: 0,
      averageRating: null,
    })
    assert.equal(alexWatchedResponse.status, 200)
    assert.equal(alexWatchedPayload.count, 0)
    assert.deepEqual(alexWatchedPayload.stats, {
      moviesWatched: 0,
      timeWatchedMinutes: 0,
      watchlistCount: 0,
      averageRating: null,
    })
    assert.equal(removeResponse.status, 200)
    assert.deepEqual(removePayload, {
      removed: true,
      stats: {
        moviesWatched: 0,
        timeWatchedMinutes: 0,
        watchlistCount: 0,
        averageRating: null,
      },
    })
  } finally {
    await closeServer(server)
  }
})

test('listRecentlyReleasedMovies requests paged non-future titles ordered by release date descending', async () => {
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
  assert.match(executedSql, /OFFSET \$2/i)
  assert.deepEqual(executedParams, [30, 0])
})

test('listRecentlyReleasedMovies supports page offsets without a hard 30-title ceiling', async () => {
  let executedParams = []
  const pool = {
    async query(_sql, params) {
      executedParams = params
      return { rows: [] }
    },
  }

  await listRecentlyReleasedMovies(pool, { limit: 50, page: 2 })

  assert.deepEqual(executedParams, [50, 50])
})

test('listTopRatedMovies requests paged released titles ordered by score descending', async () => {
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
  assert.match(executedSql, /OFFSET \$2/i)
  assert.deepEqual(executedParams, [30, 0])
})

test('listTopRatedMovies supports page offsets without a hard 30-title ceiling', async () => {
  let executedParams = []
  const pool = {
    async query(_sql, params) {
      executedParams = params
      return { rows: [] }
    },
  }

  await listTopRatedMovies(pool, { limit: 50, page: 2 })

  assert.deepEqual(executedParams, [50, 50])
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

test('countStoredDataBytes returns the stored data footprint for app tables', async () => {
  let executedSql = ''
  const pool = {
    async query(sql) {
      executedSql = sql
      return {
        rows: [{ stored_data_bytes: 1048576 }],
      }
    },
  }

  const total = await countStoredDataBytes(pool)

  assert.equal(total, 1048576)
  assert.match(executedSql, /pg_total_relation_size/i)
})

test('listUpcomingMovies requests paged future titles in the next 30 days ordered by release date ascending', async () => {
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
  assert.match(executedSql, /OFFSET \$2/i)
  assert.deepEqual(executedParams, [30, 0])
})

test('listUpcomingMovies supports page offsets without a hard 30-title ceiling', async () => {
  let executedParams = []
  const pool = {
    async query(_sql, params) {
      executedParams = params
      return { rows: [] }
    },
  }

  await listUpcomingMovies(pool, { limit: 50, page: 2 })

  assert.deepEqual(executedParams, [50, 50])
})

test('listSimilarMovies requests up to 10 related titles sharing at least one genre', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }

  const movies = await listSimilarMovies(pool, 42)

  assert.deepEqual(movies, [])
  assert.match(executedSql, /WITH source_movie AS/i)
  assert.match(executedSql, /shared_genre_count/i)
  assert.match(executedSql, /movies\.tmdb_id <> \$1/i)
  assert.match(executedSql, /ORDER BY\s+ranked_movies\.shared_genre_count DESC/i)
  assert.match(executedSql, /ranked_movies\.popularity DESC NULLS LAST/i)
  assert.match(executedSql, /LIMIT \$2/i)
  assert.deepEqual(executedParams, [42, 10])
})

test('listSimilarMovies caps the limit at 10', async () => {
  let executedParams = []
  const pool = {
    async query(_sql, params) {
      executedParams = params
      return { rows: [] }
    },
  }

  await listSimilarMovies(pool, 42, { limit: 50 })

  assert.deepEqual(executedParams, [42, 10])
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
      if (isSchemaSetupQuery(sql)) {
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

test('GET /api/genres returns database-backed genres ordered alphabetically', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM genres') && sql.includes('movie_count')) {
        return {
          rows: [
            { tmdb_genre_id: 12, name: 'Adventure', movie_count: 4 },
            { tmdb_genre_id: 18, name: 'Drama', movie_count: 7 },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/genres`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.count, 2)
    assert.deepEqual(payload.genres, [
      { id: 12, name: 'Adventure', movieCount: 4 },
      { id: 18, name: 'Drama', movieCount: 7 },
    ])
  } finally {
    await closeServer(server)
  }
})

test('GET /api/search validates the query and returns grouped local matches', async () => {
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }

      if (sql.includes('FROM movies') && sql.includes('POSITION')) {
        assert.deepEqual(params, ['Dune', 30])
        return { rows: [{ tmdb_id: 1, title: 'Dune', popularity: 100 }] }
      }

      if (sql.includes('FROM tv_shows') && sql.includes('POSITION')) {
        assert.deepEqual(params, ['Dune', 30])
        return { rows: [{ tmdb_id: 2, name: 'Dune: Prophecy', popularity: 90 }] }
      }

      if (sql.includes('FROM cast_members') && sql.includes('POSITION')) {
        assert.deepEqual(params, ['Dune', 30])
        return { rows: [{ tmdb_person_id: 3, name: 'Dune Actor', popularity: 80 }] }
      }

      if (sql.includes('FROM books') && sql.includes('POSITION')) {
        assert.deepEqual(params, ['Dune', 30])
        return { rows: [{ google_books_id: 'dune-book', title: 'Dune', authors: ['Frank Herbert'] }] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const missingResponse = await fetch(`http://127.0.0.1:${address.port}/api/search?q=%20%20`)
    assert.equal(missingResponse.status, 400)
    assert.deepEqual(await missingResponse.json(), { error: 'q is required' })

    const response = await fetch(`http://127.0.0.1:${address.port}/api/search?q=%20Dune%20`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.query, 'Dune')
    assert.deepEqual(payload.movies.map((movie) => movie.title), ['Dune'])
    assert.deepEqual(payload.shows.map((show) => show.name), ['Dune: Prophecy'])
    assert.deepEqual(payload.actors.map((actor) => actor.name), ['Dune Actor'])
    assert.deepEqual(payload.books.map((book) => book.title), ['Dune'])
  } finally {
    await closeServer(server)
  }
})

test('searchBooks matches stored titles case-insensitively', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }
  await searchBooks(pool, 'Dune')
  assert.match(executedSql, /FROM books/i)
  assert.match(executedSql, /POSITION\(LOWER\(\$1\) IN LOWER\(title\)\)/i)
  assert.deepEqual(executedParams, ['Dune', 30])
})

test('GET /api/search/tmdb returns normalized TMDB title cards without database writes', async () => {
  const nonSchemaQueries = []
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      nonSchemaQueries.push(sql)
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const originalFetch = global.fetch
  const tmdbRequests = []
  global.fetch = async (url, options) => {
    if (!String(url).startsWith('https://example.test')) return originalFetch(url, options)
    tmdbRequests.push({ url: String(url), options })
    if (String(url).includes('/search/movie')) {
      return {
        ok: true,
        async json() {
          return { results: Array.from({ length: 21 }, (_value, index) => ({ id: index + 1, title: `Movie ${index + 1}`, release_date: '2026-01-02', vote_average: 7.4, poster_path: '/movie.jpg' })) }
        },
      }
    }
    return {
      ok: true,
      async json() {
        return { results: [{ id: 50, name: 'Dune: Prophecy', first_air_date: '2024-11-17', vote_average: 8.1, vote_count: 12, overview: 'A TV story.', poster_path: '/show.jpg', backdrop_path: '/backdrop.jpg' }] }
      },
    }
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({ tmdbBearerToken: 'token', tmdbBaseUrl: 'https://example.test' }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}/api/search/tmdb`
    const missingResponse = await originalFetch(`${baseUrl}?q=%20%20`)
    assert.equal(missingResponse.status, 400)
    assert.deepEqual(await missingResponse.json(), { error: 'q is required' })

    const response = await originalFetch(`${baseUrl}?q=%20Dune%20`)
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.equal(payload.query, 'Dune')
    assert.equal(payload.movies.length, 20)
    assert.deepEqual(payload.movies[0], {
      id: 1, title: 'Movie 1', year: '2026', rating: '7.4', meta: 'Movie', releaseDate: '2026-01-02', posterUrl: 'https://image.tmdb.org/t/p/w500/movie.jpg', theme: 'theme-catalog',
    })
    assert.deepEqual(payload.shows[0], {
      id: 50, title: 'Dune: Prophecy', year: '2024', rating: '8.1', meta: 'TV Series', seasonMeta: 'TV Series', genreLabel: 'Genre TBA', maturityRating: 'TV Series', audience: '12 votes', description: 'A TV story.', posterUrl: 'https://image.tmdb.org/t/p/w500/show.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg', theme: 'theme-catalog',
    })
    assert.equal(tmdbRequests.length, 2)
    assert.ok(tmdbRequests.some((request) => request.url.endsWith('/search/movie?query=Dune&page=1')))
    assert.ok(tmdbRequests.some((request) => request.url.endsWith('/search/tv?query=Dune&page=1')))
    assert.ok(tmdbRequests.every((request) => request.options.headers.Authorization === 'Bearer token'))
    assert.deepEqual(nonSchemaQueries, [])
  } finally {
    global.fetch = originalFetch
    await closeServer(server)
  }
})

test('GET /api/movies forwards the optional genre filter to the database query', async () => {
  const rows = [
    {
      tmdb_id: 1,
      title: 'Movie 1',
      original_title: 'Movie 1',
      overview: null,
      release_date: '2024-01-01',
      original_language: 'en',
      poster_path: null,
      backdrop_path: null,
      popularity: 100,
      vote_average: 8.5,
      vote_count: 1000,
      adult: false,
      video: false,
      genre_ids: [28],
      genre_names: ['Action'],
      runtime_minutes: 110,
      certification: 'PG-13',
      detail_payload: {},
      raw_payload: {},
      import_rank: 1,
      imported_at: '2026-07-02T00:00:00.000Z',
    },
  ]
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM movies')) {
        assert.deepEqual(params, [31, 0, 'action'])
        return { rows }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies?genre=action`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.count, 1)
    assert.equal(payload.movies[0].title, 'Movie 1')
    assert.deepEqual(payload.movies[0].genre_names, ['Action'])
  } finally {
    await closeServer(server)
  }
})

test('GET /api/movies/:movieId returns a mapped movie detail payload from the local DB', async () => {
  const row = {
    id: 900,
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
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        assert.deepEqual(params, [42])
        return { rows: [row] }
      }

      if (sql.includes('FROM movie_cast')) {
        assert.deepEqual(params, [900])
        return {
          rows: [
            {
              credit_type: 'director',
              character_name: null,
              billing_order: null,
              department: 'Directing',
              job: 'Director',
              tmdb_person_id: 300,
              name: 'Denis Villeneuve',
              profile_path: '/director.jpg',
            },
            {
              credit_type: 'actor',
              character_name: 'Paul Atreides',
              billing_order: 0,
              department: null,
              job: null,
              tmdb_person_id: 301,
              name: 'Timothee Chalamet',
              profile_path: '/timothee.jpg',
            },
            {
              credit_type: 'actor',
              character_name: 'Chani',
              billing_order: 1,
              department: null,
              job: null,
              tmdb_person_id: 302,
              name: 'Zendaya',
              profile_path: null,
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    hydrateMovie: async () => {
      throw new Error('hydrateMovie should not be called for complete records')
    },
  })
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
      director: {
        id: 300,
        name: 'Denis Villeneuve',
        profileUrl: 'https://image.tmdb.org/t/p/w185/director.jpg',
      },
      cast: [
        {
          id: 301,
          name: 'Timothee Chalamet',
          role: 'Paul Atreides',
          profileUrl: 'https://image.tmdb.org/t/p/w185/timothee.jpg',
          order: 0,
        },
        {
          id: 302,
          name: 'Zendaya',
          role: 'Chani',
          profileUrl: null,
          order: 1,
        },
      ],
      reviews: [],
      communityRating: {
        average: null,
        voteCount: 0,
        yourScore: null,
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

test('GET /api/movies/:movieId includes live TMDB reviews when available', async () => {
  const row = {
    id: 900,
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
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        assert.deepEqual(params, [42])
        return { rows: [row] }
      }

      if (sql.includes('FROM movie_cast')) {
        assert.deepEqual(params, [900])
        return {
          rows: [
            {
              credit_type: 'director',
              character_name: null,
              billing_order: null,
              department: 'Directing',
              job: 'Director',
              tmdb_person_id: 300,
              name: 'Denis Villeneuve',
              profile_path: '/director.jpg',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const originalFetch = global.fetch
  global.fetch = async (url) => {
    assert.match(String(url), /\/movie\/42\/reviews$/)
    return {
      ok: true,
      async json() {
        return {
          results: [
            {
              id: 'review-1',
              author: 'Cinephile88',
              content: 'A stunning continuation that elevates the story to epic proportions.',
              created_at: '2024-04-14T12:00:00.000Z',
              updated_at: '2024-04-15T08:30:00.000Z',
              url: 'https://www.themoviedb.org/review/review-1',
              author_details: {
                rating: 8.5,
              },
            },
            {
              id: 'review-2',
              author: 'NoScoreFan',
              content: 'Still worth watching for the final act alone.',
              created_at: '2024-04-13T12:00:00.000Z',
              updated_at: null,
              url: '',
              author_details: {},
            },
          ],
        }
      },
    }
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/movies/42`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload.movie.reviews, [
      {
        id: 'review-1',
        author: 'Cinephile88',
        rating: '8.5/10',
        date: 'Apr 15, 2024',
        copy: 'A stunning continuation that elevates the story to epic proportions.',
        url: 'https://www.themoviedb.org/review/review-1',
      },
      {
        id: 'review-2',
        author: 'NoScoreFan',
        rating: null,
        date: 'Apr 13, 2024',
        copy: 'Still worth watching for the final act alone.',
        url: null,
      },
    ])
  } finally {
    global.fetch = originalFetch
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

test('GET /api/movies/:movieId returns an empty review list when TMDB reviews fail', async () => {
  const row = {
    id: 900,
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
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        assert.deepEqual(params, [42])
        return { rows: [row] }
      }

      if (sql.includes('FROM movie_cast')) {
        assert.deepEqual(params, [900])
        return {
          rows: [
            {
              credit_type: 'director',
              character_name: null,
              billing_order: null,
              department: 'Directing',
              job: 'Director',
              tmdb_person_id: 300,
              name: 'Denis Villeneuve',
              profile_path: '/director.jpg',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const originalFetch = global.fetch
  global.fetch = async () => {
    throw new Error('TMDB reviews unavailable')
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/movies/42`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload.movie.reviews, [])
    assert.equal(payload.movie.title, 'Dune: Part Two')
  } finally {
    global.fetch = originalFetch
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

test('GET /api/people/:personId returns normalized person detail and refreshes stored data', async () => {
  const originalFetch = global.fetch
  const syncQueries = []
  const queryCalls = []

  const client = {
    async query(sql, params) {
      syncQueries.push({ sql, params })

      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rowCount: null }
      }

      if (sql.includes('INSERT INTO cast_members')) {
        return { rows: [{ id: 10, inserted: false }] }
      }

      throw new Error(`Unexpected client query: ${sql}`)
    },
    release() {},
  }

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      queryCalls.push({ sql, params })

      if (sql.includes('FROM movies') && sql.includes('WHERE tmdb_id = ANY')) {
        assert.deepEqual(params, [[201, 202]])
        return {
          rows: [
            {
              tmdb_id: 201,
              title: 'Dune: Part Two',
              release_date: '2024-03-01',
              poster_path: '/dune.jpg',
              backdrop_path: '/dune-backdrop.jpg',
              vote_average: 8.7,
              certification: 'PG-13',
            },
          ],
        }
      }

      if (sql.includes('shared_credits')) {
        assert.deepEqual(params, [301, 6])
        return {
          rows: [
            {
              tmdb_person_id: 302,
              name: 'Zendaya',
              profile_path: '/zendaya.jpg',
              shared_credits: 2,
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
    async connect() {
      return client
    },
  }

  global.fetch = async (url) => {
    const value = String(url)

    if (value.endsWith('/person/301')) {
      return {
        ok: true,
        async json() {
          return {
            id: 301,
            name: 'Timothee Chalamet',
            biography: 'Acclaimed actor and producer.',
            profile_path: '/timothee.jpg',
            birthday: '1995-12-27',
            place_of_birth: 'New York City, USA',
            known_for_department: 'Acting',
            popularity: 94.2,
          }
        },
      }
    }

    if (value.endsWith('/person/301/combined_credits')) {
      return {
        ok: true,
        async json() {
          return {
            cast: [
              {
                id: 201,
                media_type: 'movie',
                title: 'Dune: Part Two',
                release_date: '2024-03-01',
                character: 'Paul Atreides',
                poster_path: '/dune.jpg',
                backdrop_path: '/dune-backdrop.jpg',
                vote_average: 8.7,
                popularity: 100,
              },
            ],
            crew: [
              {
                id: 202,
                media_type: 'movie',
                title: 'Bones and All',
                release_date: '2022-11-18',
                job: 'Producer',
                poster_path: '/bones.jpg',
                vote_average: 7.2,
                popularity: 44,
                department: 'Production',
              },
            ],
          }
        },
      }
    }

    throw new Error(`Unexpected fetch url: ${value}`)
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/people/301`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.person.name, 'Timothee Chalamet')
    assert.equal(payload.person.knownForDepartment, 'Acting')
    assert.equal(payload.knownFor[0].title, 'Dune: Part Two')
    assert.equal(payload.filmography[1].role, 'Producer')
    assert.equal(payload.coStars[0].name, 'Zendaya')
    assert.equal(payload.facts[0].label, 'Birthdate')
    assert.equal(syncQueries.some(({ sql }) => sql.includes('INSERT INTO cast_members')), true)
  } finally {
    global.fetch = originalFetch
    await closeServer(server)
  }
})

test('GET /api/people/:personId returns a server error when TMDB detail refresh fails', async () => {
  const originalFetch = global.fetch

  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
    async connect() {
      throw new Error('connect should not be called')
    },
  }

  global.fetch = async () => ({
    ok: false,
    status: 500,
    async text() {
      return 'tmdb unavailable'
    },
  })

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/people/301`)
    const payload = await response.json()

    assert.equal(response.status, 500)
    assert.match(payload.error, /TMDB request failed/)
  } finally {
    global.fetch = originalFetch
    await closeServer(server)
  }
})

test('GET /api/movies/:movieId hydrates a missing movie from TMDB before responding', async () => {
  let movieLookupCount = 0
  let hydrateOptions = null

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        movieLookupCount += 1

        if (movieLookupCount === 1) {
          return { rows: [] }
        }

        return {
          rows: [
            {
              id: 904,
              tmdb_id: 404,
              title: 'Hydrated Movie',
              original_title: 'Hydrated Movie',
              overview: 'Fresh from TMDB.',
              release_date: '2024-06-01',
              original_language: 'en',
              poster_path: '/poster.jpg',
              backdrop_path: '/backdrop.jpg',
              popularity: 88,
              vote_average: 8.1,
              vote_count: 900,
              adult: false,
              video: false,
              genre_ids: [12],
              genre_names: ['Adventure'],
              runtime_minutes: 140,
              certification: 'PG-13',
              detail_payload: {},
              raw_payload: {},
              import_rank: 1,
              imported_at: '2026-07-02T00:00:00.000Z',
            },
          ],
        }
      }

      if (sql.includes('FROM movie_cast')) {
        assert.deepEqual(params, [904])
        return {
          rows: [
            {
              credit_type: 'director',
              character_name: null,
              billing_order: null,
              department: 'Directing',
              job: 'Director',
              tmdb_person_id: 300,
              name: 'Denis Villeneuve',
              profile_path: '/director.jpg',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
    hydrateMovie: async (_pool, options) => {
      hydrateOptions = options
    },
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/404`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(movieLookupCount, 2)
    assert.deepEqual(hydrateOptions, {
      token: 'token',
      baseUrl: 'https://example.test',
      movieId: 404,
      importRank: 1,
    })
    assert.equal(payload.movie.title, 'Hydrated Movie')
    assert.equal(payload.movie.runtime, '2h 20m')
    assert.equal(payload.movie.director?.name, 'Denis Villeneuve')
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

test('GET /api/movies/:movieId rehydrates an incomplete movie that has no stored credits', async () => {
  const incompleteRow = {
    id: 903,
    tmdb_id: 77,
    title: 'No Credits Yet',
    original_title: 'No Credits Yet',
    overview: 'Overview',
    release_date: '2024-05-01',
    original_language: 'en',
    poster_path: null,
    backdrop_path: null,
    popularity: 10,
    vote_average: 7.5,
    vote_count: 200,
    adult: false,
    video: false,
    genre_ids: [],
    genre_names: [],
    runtime_minutes: 100,
    certification: 'PG',
    detail_payload: {},
    raw_payload: {},
    import_rank: 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }
  const hydratedRow = {
    ...incompleteRow,
    title: 'Hydrated Credits',
  }
  let movieLookupCount = 0
  let hydrateCalls = 0

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        movieLookupCount += 1
        return { rows: [movieLookupCount === 1 ? incompleteRow : hydratedRow] }
      }

      if (sql.includes('FROM movie_cast')) {
        if (movieLookupCount === 1) {
          return { rows: [] }
        }

        assert.deepEqual(params, [903])
        return {
          rows: [
            {
              credit_type: 'director',
              character_name: null,
              billing_order: null,
              department: 'Directing',
              job: 'Director',
              tmdb_person_id: 500,
              name: 'Director Person',
              profile_path: '/director.jpg',
            },
            {
              credit_type: 'actor',
              character_name: 'Lead',
              billing_order: 0,
              department: null,
              job: null,
              tmdb_person_id: 501,
              name: 'Lead Actor',
              profile_path: '/lead.jpg',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
    hydrateMovie: async () => {
      hydrateCalls += 1
    },
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/77`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(hydrateCalls, 1)
    assert.equal(payload.movie.title, 'Hydrated Credits')
    assert.equal(payload.movie.director?.name, 'Director Person')
    assert.deepEqual(payload.movie.cast.map((castMember) => castMember.name), ['Lead Actor'])
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

test('GET /api/movies/:movieId rehydrates an incomplete movie that lacks detail payload fields', async () => {
  const incompleteRow = {
    id: 905,
    tmdb_id: 55,
    title: 'Partial Movie',
    original_title: 'Partial Movie',
    overview: 'Overview',
    release_date: '2024-05-01',
    original_language: 'en',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    popularity: 10,
    vote_average: 7.5,
    vote_count: 200,
    adult: false,
    video: false,
    genre_ids: [18],
    genre_names: ['Drama'],
    runtime_minutes: null,
    certification: null,
    detail_payload: null,
    raw_payload: {},
    import_rank: 4,
    imported_at: '2026-07-02T00:00:00.000Z',
  }
  const hydratedRow = {
    ...incompleteRow,
    runtime_minutes: 123,
    certification: 'R',
    detail_payload: {},
  }
  let movieLookupCount = 0
  let hydrateOptions = null

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        movieLookupCount += 1
        return { rows: [movieLookupCount === 1 ? incompleteRow : hydratedRow] }
      }

      if (sql.includes('FROM movie_cast')) {
        return {
          rows: [
            {
              credit_type: 'actor',
              character_name: 'Lead',
              billing_order: 0,
              department: null,
              job: null,
              tmdb_person_id: 701,
              name: 'Lead Actor',
              profile_path: null,
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
    hydrateMovie: async (_pool, options) => {
      hydrateOptions = options
    },
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/55`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(movieLookupCount, 2)
    assert.deepEqual(hydrateOptions, {
      token: 'token',
      baseUrl: 'https://example.test',
      movieId: 55,
      importRank: 4,
    })
    assert.equal(payload.movie.runtime, '2h 3m')
    assert.equal(payload.movie.certification, 'R')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/movies/:movieId returns a server error when movie hydration fails', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({
      tmdbBearerToken: 'token',
      tmdbBaseUrl: 'https://example.test',
    }),
    hydrateMovie: async () => {
      throw new Error('TMDB hydrate failed')
    },
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/404`)
    const payload = await response.json()

    assert.equal(response.status, 500)
    assert.equal(payload.error, 'TMDB hydrate failed')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/movies/:movieId/similar returns related movies from the local DB', async () => {
  const sourceRow = {
    id: 901,
    tmdb_id: 42,
    title: 'Dune: Part Two',
    original_title: 'Dune: Part Two',
    overview: 'Source overview',
    release_date: '2024-03-01',
    original_language: 'en',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    popularity: 99.9,
    vote_average: 8.7,
    vote_count: 2150,
    adult: false,
    video: false,
    genre_ids: [12, 878],
    genre_names: ['Adventure', 'Sci-Fi'],
    runtime_minutes: 166,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }

  const relatedRows = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 100,
    title: `Related Movie ${index + 1}`,
    original_title: `Related Movie ${index + 1}`,
    overview: 'Related overview',
    release_date: '2024-02-01',
    original_language: 'en',
    poster_path: `/related-${index + 1}.jpg`,
    backdrop_path: null,
    popularity: 90 - index,
    vote_average: 8.2 - index * 0.1,
    vote_count: 1000 + index,
    adult: false,
    video: false,
    genre_ids: [12],
    genre_names: ['Adventure'],
    runtime_minutes: 120,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        assert.deepEqual(params, [42])
        return { rows: [sourceRow] }
      }

      if (sql.includes('FROM movie_cast')) {
        return { rows: [] }
      }

      if (sql.includes('WITH source_movie AS')) {
        assert.deepEqual(params, [42, 10])
        return { rows: relatedRows }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/42/similar`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.count, 10)
    assert.equal(payload.movies.length, 10)
    assert.equal(payload.movies.every((movie) => movie.tmdb_id !== 42), true)
    assert.equal(payload.movies.every((movie) => movie.genre_names.includes('Adventure')), true)
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

test('GET /api/movies/:movieId/similar returns 400 for an invalid movie id', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/not-a-number/similar`)
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(payload.error, 'Invalid movie id: not-a-number')
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

test('GET /api/movies/:movieId/similar returns 404 when the base movie is missing', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/404/similar`)
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

test('GET /api/movies/:movieId/similar returns an empty list when no related movies match', async () => {
  const sourceRow = {
    id: 902,
    tmdb_id: 42,
    title: 'Dune: Part Two',
    original_title: 'Dune: Part Two',
    overview: 'Source overview',
    release_date: '2024-03-01',
    original_language: 'en',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    popularity: 99.9,
    vote_average: 8.7,
    vote_count: 2150,
    adult: false,
    video: false,
    genre_ids: [12, 878],
    genre_names: ['Adventure', 'Sci-Fi'],
    runtime_minutes: 166,
    certification: 'PG-13',
    detail_payload: {},
    raw_payload: {},
    import_rank: 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }

  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        return { rows: [sourceRow] }
      }

      if (sql.includes('FROM movie_cast')) {
        return { rows: [] }
      }

      if (sql.includes('WITH source_movie AS')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/42/similar`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      count: 0,
      movies: [],
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

test('GET /api/admin/overview returns the configured jobs and database totals', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('SELECT COUNT(*)::INTEGER AS movie_count')) {
        return { rows: [{ movie_count: 125 }] }
      }

      if (sql.includes('SELECT COUNT(*)::INTEGER AS book_count')) {
        return { rows: [{ book_count: 240 }] }
      }

      if (sql.includes('SELECT COUNT(*)::INTEGER AS tv_show_count')) {
        return { rows: [{ tv_show_count: 48 }] }
      }

      if (sql.includes('SELECT COUNT(*)::INTEGER AS actor_count')) {
        return { rows: [{ actor_count: 913 }] }
      }

      if (sql.includes('pg_total_relation_size')) {
        return { rows: [{ stored_data_bytes: 5242880 }] }
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
    assert.equal(payload.totals.actors, 913)
    assert.equal(payload.totals.books, 240)
    assert.equal(payload.totals.movies, 125)
    assert.equal(payload.totals.storedDataBytes, 5242880)
    assert.equal(payload.totals.tvShows, 48)
    assert.deepEqual(payload.crons, [
      {
        key: 'books',
        name: 'Books Import',
        execution: 'Interval-based loop',
        frequency: 'Every hour',
      },
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
      {
        key: 'tv-popular',
        name: 'Popular TV Shows Import',
        execution: 'Interval-based loop',
        frequency: 'Every 10 minutes',
      },
      {
        key: 'tv-airing-today',
        name: 'TV Airing Today Import',
        execution: 'Interval-based loop',
        frequency: 'Every 24 hours',
      },
      {
        key: 'tv-on-the-air',
        name: 'TV On The Air Import',
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

test('POST /api/admin/jobs/:jobKey/run can dispatch a TV import job', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const invocations = []
  const app = await createApp(pool, {
    jobs: [
      {
        key: 'tv-popular',
        name: 'Popular TV Shows Import',
        execution: 'Interval-based loop',
        frequency: 'Every 10 minutes',
        async run(receivedPool, options) {
          invocations.push({ receivedPool, options })
          return {
            fetchedCount: 30,
            insertedCount: 5,
            updatedCount: 25,
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/jobs/tv-popular/run`, {
      method: 'POST',
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      job: 'tv-popular',
      fetchedCount: 30,
      insertedCount: 5,
      updatedCount: 25,
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
    await closeServer(server)
  }
})

test('POST /api/admin/jobs/:jobKey/run dispatches the selected job and returns the summary', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
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
      if (isSchemaSetupQuery(sql)) {
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
      if (isSchemaSetupQuery(sql)) {
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
      if (isSchemaSetupQuery(sql)) {
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
      if (isSchemaSetupQuery(sql)) {
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
      if (isSchemaSetupQuery(sql)) {
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
      if (isSchemaSetupQuery(sql)) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/recently-released?limit=30&page=2`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[31, 31]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.movies, [])
    assert.deepEqual(payload.pagination, {
      page: 2,
      pageSize: 30,
      hasNextPage: false,
      hasPreviousPage: true,
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
      if (isSchemaSetupQuery(sql)) {
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
      if (isSchemaSetupQuery(sql)) {
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
      if (isSchemaSetupQuery(sql)) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/top-rated?limit=30&page=2`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[31, 31]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.movies, [])
    assert.deepEqual(payload.pagination, {
      page: 2,
      pageSize: 30,
      hasNextPage: false,
      hasPreviousPage: true,
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

test('GET /api/movies/upcoming forwards a requested limit', async () => {
  const capturedParams = []
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/upcoming?limit=30&page=2`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[31, 31]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.movies, [])
    assert.deepEqual(payload.pagination, {
      page: 2,
      pageSize: 30,
      hasNextPage: false,
      hasPreviousPage: true,
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

test('listTvShows requests the top 30 TV titles ordered by popularity descending', async () => {
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }

  const shows = await listTvShows(pool)

  assert.deepEqual(shows, [])
  assert.match(executedSql, /ORDER BY tv_shows\.popularity DESC NULLS LAST, tv_shows\.tmdb_id ASC/i)
  assert.deepEqual(executedParams, [30, 0])
})

test('listTvWatchlistShowsForUser returns a user’s saved shows in most-recent order', async () => {
  let executedSql = ''
  let executedParams = []
  const rows = [{ tmdb_id: 88, name: 'Saved Show', genre_names: ['Drama'], watchlisted_at: '2026-07-10T12:00:00.000Z' }]
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows }
    },
  }

  const shows = await listTvWatchlistShowsForUser(pool, 'florind')

  assert.deepEqual(shows, rows)
  assert.match(executedSql, /FROM tv_watchlist_items/i)
  assert.match(executedSql, /JOIN users ON users\.id = tv_watchlist_items\.user_id/i)
  assert.match(executedSql, /JOIN tv_shows ON tv_shows\.id = tv_watchlist_items\.tv_show_id/i)
  assert.match(executedSql, /ORDER BY tv_watchlist_items\.created_at DESC, tv_shows\.tmdb_id ASC/i)
  assert.deepEqual(executedParams, ['florind'])
})

test('listCalendarEventsForUser scopes releases to the user watchlist and eligible unwatched TV episodes', async () => {
  let executedSql = ''
  let executedParams = []
  const rows = [{ event_date: '2026-07-20', media_type: 'movie', media_id: 22, title: 'Saved Movie' }]
  const pool = { async query(sql, params) { executedSql = sql; executedParams = params; return { rows } } }

  const events = await listCalendarEventsForUser(pool, 'florind', { startDate: '2026-07-01', endDate: '2026-08-01', mediaType: 'all' })

  assert.deepEqual(events, rows)
  assert.match(executedSql, /FROM watchlist_items/i)
  assert.match(executedSql, /FROM tv_watchlist_items/i)
  assert.match(executedSql, /HAVING COUNT\(watched_tv_episodes\.id\) > 0/i)
  assert.match(executedSql, /COUNT\(watched_tv_episodes\.id\) < COUNT\(tv_episodes\.id\)/i)
  assert.match(executedSql, /tv_episodes\.air_date > CURRENT_DATE OR watched_tv_episodes\.id IS NULL/i)
  assert.match(executedSql, /tv_seasons\.season_number > 0/i)
  assert.deepEqual(executedParams, ['florind', '2026-07-01', '2026-08-01', 'all'])
})

test('listContinueWatchingTvShowsForUser selects paginated, most recently watched in-progress shows', async () => {
  let executedSql = ''
  let executedParams = []
  const rows = [{ tmdb_id: 91, name: 'In Progress', watched_episode_count: 3, aired_episode_count: 8 }]
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows }
    },
  }

  const shows = await listContinueWatchingTvShowsForUser(pool, 'florind', { limit: 30, page: 2 })

  assert.deepEqual(shows, rows)
  assert.match(executedSql, /HAVING COUNT\(watched_tv_episodes\.id\) > 0/i)
  assert.match(executedSql, /COUNT\(watched_tv_episodes\.id\) < COUNT\(\*\)/i)
  assert.match(executedSql, /MAX\(watched_tv_episodes\.watched_at\) AS last_watched_at/i)
  assert.match(executedSql, /ORDER BY episode_progress\.last_watched_at DESC, tv_shows\.tmdb_id ASC/i)
  assert.match(executedSql, /LIMIT \$2/i)
  assert.match(executedSql, /OFFSET \$3/i)
  assert.deepEqual(executedParams, ['florind', 30, 30])
})

test('listWatchedTvEpisodesForUser returns a user’s watched episodes newest first with show and episode details', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      return {
        rows: [{
          show_id: 42,
          show_name: 'Example Show',
          show_poster_path: '/show.jpg',
          episode_id: 8401,
          episode_name: 'Finale',
          season_number: 2,
          episode_number: 8,
          watched_at: '2026-07-14T12:00:00.000Z',
        }],
      }
    },
  }

  const episodes = await listWatchedTvEpisodesForUser(pool, 'florind')

  assert.equal(episodes.length, 1)
  assert.deepEqual(episodes[0], {
    show_id: 42,
    show_name: 'Example Show',
    show_poster_path: '/show.jpg',
    episode_id: 8401,
    episode_name: 'Finale',
    season_number: 2,
    episode_number: 8,
    watched_at: '2026-07-14T12:00:00.000Z',
  })
  assert.equal(calls[0].params[0], 'florind')
  assert.match(calls[0].sql, /FROM watched_tv_episodes/i)
  assert.match(calls[0].sql, /tv_seasons\.season_number > 0/i)
  assert.match(calls[0].sql, /ORDER BY watched_tv_episodes\.watched_at DESC/i)
})

test('listLatestEpisodeTvShows selects one aired episode per show and prioritizes date then popularity', async () => {
  let executedSql = ''
  const rows = [{ tmdb_id: 99, name: 'Fresh Episode', season_number: 2, episode_number: 3, air_date: '2026-07-12' }]
  const pool = {
    async query(sql) {
      executedSql = sql
      return { rows }
    },
  }

  const shows = await listLatestEpisodeTvShows(pool)

  assert.deepEqual(shows, rows)
  assert.match(executedSql, /SELECT DISTINCT ON \(tv_seasons\.tv_show_id\)/i)
  assert.match(executedSql, /tv_episodes\.air_date IS NOT NULL/i)
  assert.match(executedSql, /tv_episodes\.air_date <= CURRENT_DATE/i)
  assert.match(executedSql, /tv_seasons\.season_number > 0/i)
  assert.match(executedSql, /ORDER BY latest_episodes\.air_date DESC, tv_shows\.popularity DESC NULLS LAST, tv_shows\.tmdb_id ASC/i)
  assert.match(executedSql, /LIMIT 10/i)
})

test('GET /api/tv/library returns saved TV show cards only for the authenticated user', async () => {
  const savedShow = {
    tmdb_id: 88,
    name: 'Saved Show',
    first_air_date: '2025-01-10',
    poster_path: '/saved.jpg',
    backdrop_path: '/saved-backdrop.jpg',
    vote_average: 8.2,
    genre_names: ['Drama'],
    watchlisted_at: '2026-07-10T12:00:00.000Z',
  }
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      if (sql.includes('FROM users') && sql.includes('full_name') && sql.includes('WHERE username = $1')) {
        return { rows: params[0] === 'florind' ? [{ id: 1, username: 'florind', full_name: 'Florind' }] : [] }
      }
      if (sql.includes('COALESCE(ARRAY(SELECT tv_shows.tmdb_id FROM watched_tv_shows')) {
        return { rows: [{ watched_ids: [], watchlist_ids: [88] }] }
      }
      if (sql.includes('watched_totals AS')) {
        return { rows: [{ has_user: true, shows_watched: 0, episodes_watched: 0, time_watched_minutes: 0, watchlist_count: 1 }] }
      }
      if (sql.includes('FROM tv_watchlist_items') && sql.includes('watchlisted_at')) {
        return { rows: params[0] === 'florind' ? [savedShow] : [] }
      }
      if (sql.includes('WITH episode_progress AS')) {
        return { rows: [] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/library`, { headers: { 'x-watchvault-username': 'florind' } })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload.watchlistIds, [88])
    assert.deepEqual(payload.watchlistShows, [{
      id: 88,
      title: 'Saved Show',
      year: '2025',
      meta: 'Drama',
      rating: 8.2,
      type: 'TV Shows',
      posterUrl: 'https://image.tmdb.org/t/p/w500/saved.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/saved-backdrop.jpg',
      watchlistedAt: '2026-07-10T12:00:00.000Z',
    }])
    assert.deepEqual(payload.continueWatchingShows, [])
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/library returns mapped in-progress TV shows for Continue Watching', async () => {
  const continueWatchingShow = {
    tmdb_id: 91,
    name: 'In Progress',
    poster_path: '/progress.jpg',
    backdrop_path: '/progress-backdrop.jpg',
    watched_episode_count: 3,
    aired_episode_count: 8,
    latest_watched_season_number: 2,
    latest_watched_episode_number: 4,
    last_watched_at: '2026-07-12T10:00:00.000Z',
  }
  let continueWatchingParams = []
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      if (sql.includes('FROM users') && sql.includes('full_name') && sql.includes('WHERE username = $1')) return { rows: [{ id: 1, username: 'florind', full_name: 'Florind' }] }
      if (sql.includes('COALESCE(ARRAY(SELECT tv_shows.tmdb_id FROM watched_tv_shows')) return { rows: [{ watched_ids: [], watchlist_ids: [] }] }
      if (sql.includes('watched_totals AS')) return { rows: [{ has_user: true, shows_watched: 0, episodes_watched: 3, time_watched_minutes: 120, watchlist_count: 0 }] }
      if (sql.includes('FROM tv_watchlist_items') && sql.includes('watchlisted_at')) return { rows: [] }
      if (sql.includes('WITH episode_progress AS')) {
        continueWatchingParams = params
        return { rows: params[0] === 'florind' ? [continueWatchingShow] : [] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/library`, { headers: { 'x-watchvault-username': 'florind' } })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(continueWatchingParams, ['florind', 5, 0])
    assert.deepEqual(payload.continueWatchingShows, [{
      id: 91,
      title: 'In Progress',
      posterUrl: 'https://image.tmdb.org/t/p/w500/progress.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/progress-backdrop.jpg',
      watchedEpisodeCount: 3,
      airedEpisodeCount: 8,
      progress: 38,
      latestWatchedEpisodeLabel: 'S2 E4',
      lastWatchedAt: '2026-07-12T10:00:00.000Z',
    }])
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/continue-watching returns paginated mapped in-progress shows', async () => {
  const continueWatchingShow = {
    tmdb_id: 91,
    name: 'In Progress',
    poster_path: '/progress.jpg',
    backdrop_path: '/progress-backdrop.jpg',
    watched_episode_count: 3,
    aired_episode_count: 8,
    latest_watched_season_number: 2,
    latest_watched_episode_number: 4,
    last_watched_at: '2026-07-12T10:00:00.000Z',
  }
  let continueWatchingParams = []
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      if (sql.includes('FROM users') && sql.includes('full_name') && sql.includes('WHERE username = $1')) return { rows: [{ id: 1, username: 'florind', full_name: 'Florind' }] }
      if (sql.includes('WITH episode_progress AS')) {
        continueWatchingParams = params
        return { rows: [continueWatchingShow] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/continue-watching?page=2&limit=30`, { headers: { 'x-watchvault-username': 'florind' } })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(continueWatchingParams, ['florind', 31, 31])
    assert.deepEqual(payload.pagination, { page: 2, pageSize: 30, hasNextPage: false, hasPreviousPage: true })
    assert.deepEqual(payload.shows, [{
      id: 91,
      title: 'In Progress',
      posterUrl: 'https://image.tmdb.org/t/p/w500/progress.jpg',
      backdropUrl: 'https://image.tmdb.org/t/p/w1280/progress-backdrop.jpg',
      watchedEpisodeCount: 3,
      airedEpisodeCount: 8,
      progress: 38,
      latestWatchedEpisodeLabel: 'S2 E4',
      lastWatchedAt: '2026-07-12T10:00:00.000Z',
    }])
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/continue-watching requires authentication', async () => {
  const pool = { async query(sql) { if (isSchemaSetupQuery(sql)) return { rowCount: null }; throw new Error(`Unexpected query: ${sql}`) } }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/continue-watching`)
    assert.equal(response.status, 401)
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/latest-episodes returns mapped latest episode cards', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      if (sql.includes('WITH latest_episodes AS')) {
        return { rows: [{ tmdb_id: 99, name: 'Fresh Episode', poster_path: '/fresh.jpg', backdrop_path: '/fresh-backdrop.jpg', popularity: 83.4, season_number: 2, episode_number: 3, episode_name: 'The Signal', air_date: '2026-07-12' }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/latest-episodes`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(payload, {
      count: 1,
      shows: [{
        id: 99,
        title: 'Fresh Episode',
        posterUrl: 'https://image.tmdb.org/t/p/w500/fresh.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w1280/fresh-backdrop.jpg',
        popularity: 83.4,
        latestEpisode: { seasonNumber: 2, episodeNumber: 3, title: 'The Signal', airDate: '2026-07-12' },
      }],
    })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv returns the popular TV shows payload from the local DB', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 1,
    name: `Popular Show ${index + 1}`,
    original_name: `Popular Show ${index + 1}`,
    overview: `Overview ${index + 1}`,
    first_air_date: `2026-06-${String(20 - index).padStart(2, '0')}`,
    original_language: 'en',
    poster_path: `/poster-${index + 1}.jpg`,
    backdrop_path: `/backdrop-${index + 1}.jpg`,
    popularity: 100 - index,
    vote_average: 8.8 - index * 0.1,
    vote_count: 2000 - index * 10,
    genre_ids: [18, 10765],
    genre_names: ['Drama', 'Sci-Fi & Fantasy'],
    detail_payload: {
      number_of_episodes: 8,
      number_of_seasons: 1,
      episode_run_time: [55],
    },
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  let tvQueryCount = 0
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY tv_shows.popularity DESC')) {
        tvQueryCount += 1
        return { rows }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(tvQueryCount, 1)
    assert.equal(payload.count, 10)
    assert.equal(payload.shows.length, 10)
    assert.equal(payload.shows[0].name, 'Popular Show 1')
    assert.equal(payload.featuredShow.title, 'Popular Show 1')
    assert.equal(payload.featuredShow.episodesLabel, '8 Episodes')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/:showId hydrates summary-only records once before returning detail relations', async () => {
  const summaryOnlyShow = {
    id: 41,
    tmdb_id: 900,
    name: 'Summary Only',
    overview: 'A show awaiting detailed relations.',
    first_air_date: '2025-01-01',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    vote_average: 8.2,
    vote_count: 400,
    genre_names: ['Drama'],
    detail_payload: { number_of_seasons: 1 },
    import_rank: 5,
  }
  const hydratedShow = { ...summaryOnlyShow, detail_hydrated_at: '2026-07-10T12:00:00.000Z' }
  let showLookupCount = 0
  let hydrationOptions = null
  let hydrationCalls = 0

  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql) || sql.includes('ALTER TABLE tv_shows') || sql.includes('CREATE TABLE IF NOT EXISTS tv_') || sql.includes('CREATE TABLE IF NOT EXISTS watched_tv_episodes')) return { rowCount: null }
      if (sql.includes('WHERE tv_shows.tmdb_id = $1')) {
        showLookupCount += 1
        return { rows: [showLookupCount === 1 ? summaryOnlyShow : hydratedShow] }
      }
      if (sql.includes('community_average')) return { rows: [{ community_average: null, community_vote_count: 0, your_average: null, your_rating_count: 0 }] }
      if (sql.includes('FROM tv_seasons')) {
        return { rows: [
          { id: 11, season_number: 0, name: 'Specials', overview: null, air_date: '2024-12-01', poster_path: null, episodes: [{ id: 100, tmdb_id: 9900, episode_number: 1, name: 'Special', overview: null, air_date: '2024-12-01', runtime_minutes: 45, still_path: null, is_aired: true, watched: true }] },
          { id: 12, season_number: 1, name: 'Season 1', overview: null, air_date: '2025-01-01', poster_path: null, episodes: [{ id: 101, tmdb_id: 9901, episode_number: 1, name: 'Pilot', overview: null, air_date: '2025-01-01', runtime_minutes: 45, still_path: null, is_aired: true, watched: false }] },
        ] }
      }
      if (sql.includes('FROM tv_show_credits')) return { rows: [{ tmdb_person_id: 1, name: 'Lead Actor', profile_path: null, character_name: 'Lead', job: null, credit_type: 'actor' }] }
      if (sql.includes('FROM tv_recommendations')) return { rows: [{ recommended_tmdb_id: 901, name: 'Related Show', first_air_date: '2025-02-01', poster_path: null, vote_average: 7.4 }] }
      if (sql.includes('FROM tv_trailers')) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({ tmdbBearerToken: 'token', tmdbBaseUrl: 'https://example.test' }),
    hydrateTvShow: async (_pool, options) => { hydrationCalls += 1; hydrationOptions = options },
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/900`)
    const payload = await response.json()

    assert.equal(response.status, 200, payload.error)
    assert.equal(showLookupCount, 2)
    assert.deepEqual(hydrationOptions, { token: 'token', baseUrl: 'https://example.test', tvShowId: 900, importRank: 5 })
    assert.equal(payload.show.seasons.length, 1)
    assert.equal(payload.show.seasons[0].seasonNumber, 1)
    assert.equal(payload.show.seasons[0].episodes[0].name, 'Pilot')
    assert.equal(payload.show.credits[0].name, 'Lead Actor')
    assert.equal(payload.show.recommendations[0].title, 'Related Show')

    const repeatResponse = await fetch(`http://127.0.0.1:${address.port}/api/tv/900`)
    assert.equal(repeatResponse.status, 200)
    assert.equal(hydrationCalls, 1)
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv returns a safe empty featured payload when no TV shows exist', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('FROM tv_shows')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.shows, [])
    assert.equal(payload.featuredShow, null)
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/recently-released returns the latest released TV shows payload from the local DB', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 1,
    name: `Recent Show ${index + 1}`,
    original_name: `Recent Show ${index + 1}`,
    overview: null,
    first_air_date: `2026-07-${String(10 - index).padStart(2, '0')}`,
    original_language: 'en',
    poster_path: null,
    backdrop_path: null,
    popularity: 100 - index,
    vote_average: 8.5 - index * 0.1,
    vote_count: 1000 + index,
    genre_ids: [],
    genre_names: ['Drama'],
    detail_payload: {},
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  let recentQueryCount = 0
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY tv_shows.first_air_date DESC')) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/recently-released`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(recentQueryCount, 1)
    assert.equal(payload.count, 10)
    assert.equal(payload.shows.length, 10)
    assert.equal(payload.shows[0].name, 'Recent Show 1')
    assert.equal(payload.shows[9].name, 'Recent Show 10')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/recently-released forwards a requested limit', async () => {
  const capturedParams = []
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY tv_shows.first_air_date DESC')) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/recently-released?limit=30&page=2`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[31, 31]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.shows, [])
    assert.deepEqual(payload.pagination, {
      page: 2,
      pageSize: 30,
      hasNextPage: false,
      hasPreviousPage: true,
    })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/upcoming returns the upcoming TV shows payload from the local DB', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 1,
    name: `Upcoming Show ${index + 1}`,
    original_name: `Upcoming Show ${index + 1}`,
    overview: null,
    first_air_date: `2026-07-${String(index + 3).padStart(2, '0')}`,
    original_language: 'en',
    poster_path: null,
    backdrop_path: null,
    popularity: 100 - index,
    vote_average: 8.5 - index * 0.1,
    vote_count: 1000 + index,
    genre_ids: [],
    genre_names: ['Drama'],
    detail_payload: {},
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  let upcomingQueryCount = 0
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY tv_shows.first_air_date ASC')) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/upcoming`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(upcomingQueryCount, 1)
    assert.equal(payload.count, 10)
    assert.equal(payload.shows.length, 10)
    assert.equal(payload.shows[0].name, 'Upcoming Show 1')
    assert.equal(payload.shows[9].name, 'Upcoming Show 10')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/upcoming forwards a requested limit', async () => {
  const capturedParams = []
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY tv_shows.first_air_date ASC')) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/upcoming?limit=30&page=2`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[31, 31]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.shows, [])
    assert.deepEqual(payload.pagination, {
      page: 2,
      pageSize: 30,
      hasNextPage: false,
      hasPreviousPage: true,
    })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/top-rated returns the top-rated released TV shows payload from the local DB', async () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    tmdb_id: index + 1,
    name: `Top Rated Show ${index + 1}`,
    original_name: `Top Rated Show ${index + 1}`,
    overview: null,
    first_air_date: `2026-06-${String(30 - index).padStart(2, '0')}`,
    original_language: 'en',
    poster_path: null,
    backdrop_path: null,
    popularity: 100 - index,
    vote_average: 9.5 - index * 0.1,
    vote_count: 2000 - index * 10,
    genre_ids: [],
    genre_names: ['Drama'],
    detail_payload: {},
    raw_payload: {},
    import_rank: index + 1,
    imported_at: '2026-07-02T00:00:00.000Z',
  }))

  let topRatedQueryCount = 0
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY tv_shows.vote_average DESC')) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/top-rated`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(topRatedQueryCount, 1)
    assert.equal(payload.count, 10)
    assert.equal(payload.shows.length, 10)
    assert.equal(payload.shows[0].name, 'Top Rated Show 1')
    assert.equal(payload.shows[9].name, 'Top Rated Show 10')
  } finally {
    await closeServer(server)
  }
})

test('GET /api/tv/top-rated forwards a requested limit', async () => {
  const capturedParams = []
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('ORDER BY tv_shows.vote_average DESC')) {
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
    const response = await fetch(`http://127.0.0.1:${address.port}/api/tv/top-rated?limit=30&page=2`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedParams, [[31, 31]])
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.shows, [])
    assert.deepEqual(payload.pagination, {
      page: 2,
      pageSize: 30,
      hasNextPage: false,
      hasPreviousPage: true,
    })
  } finally {
    await closeServer(server)
  }
})

test('movie ratings update one user vote and return the combined WatchVault average', async () => {
  const users = new Map([
    ['florind', { id: 1, username: 'florind', full_name: 'Florin Druta' }],
    ['alex', { id: 2, username: 'alex', full_name: 'Alex Morgan' }],
  ])
  const ratings = new Map()

  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }

      if (sql.includes('INSERT INTO movie_ratings')) {
        const [username, movieId, score] = params
        const user = users.get(username)
        if (!user) return { rows: [{ has_user: false, has_movie: false, score: null }] }
        if (movieId !== 42) return { rows: [{ has_user: true, has_movie: false, score: null }] }
        ratings.set(`${user.id}:${movieId}`, score)
        return { rows: [{ has_user: true, has_movie: true, score }] }
      }

      if (sql.includes('AVG(movie_ratings.score)')) {
        const [movieId, username] = params
        if (movieId !== 42) return { rows: [{ has_movie: false, average: null, vote_count: 0, your_score: null }] }
        const scores = [...ratings.entries()]
          .filter(([key]) => key.endsWith(`:${movieId}`))
          .map(([, score]) => score)
        const user = users.get(username)
        return {
          rows: [{
            has_movie: true,
            average: scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null,
            vote_count: scores.length,
            your_score: user ? ratings.get(`${user.id}:${movieId}`) ?? null : null,
          }],
        }
      }

      if (sql.includes('FROM users')) {
        const user = users.get(params[0])
        return { rows: user ? [user] : [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}/api/movies/42/rating`
    const rate = (username, score) => fetch(baseUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-watchvault-username': username },
      body: JSON.stringify({ score }),
    })

    let response = await rate('florind', 5)
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).communityRating, { average: 5, voteCount: 1, yourScore: 5 })

    response = await rate('alex', 4)
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).communityRating, { average: 4.5, voteCount: 2, yourScore: 4 })

    response = await rate('florind', 4.5)
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).communityRating, { average: 4.25, voteCount: 2, yourScore: 4.5 })
  } finally {
    await closeServer(server)
  }
})

test('movie rating endpoint rejects unauthenticated, invalid, and unknown-movie requests', async () => {
  const pool = {
    async query(sql, params) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      if (sql.includes('INSERT INTO movie_ratings')) return { rows: [{ has_user: true, has_movie: false, score: null }] }
      if (sql.includes('FROM users')) {
        return { rows: params[0] === 'florind' ? [{ id: 1, username: 'florind', full_name: 'Florin Druta' }] : [] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}/api/movies`
    let response = await fetch(`${baseUrl}/42/rating`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 5 }) })
    assert.equal(response.status, 401)

    response = await fetch(`${baseUrl}/42/rating`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-watchvault-username': 'florind' }, body: JSON.stringify({ score: 3.2 }) })
    assert.equal(response.status, 400)

    response = await fetch(`${baseUrl}/404/rating`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-watchvault-username': 'florind' }, body: JSON.stringify({ score: 4 }) })
    assert.equal(response.status, 404)
  } finally {
    await closeServer(server)
  }
})

test('GET /api/movies/:movieId/trailer selects a transient playable YouTube trailer', async () => {
  const nonSchemaQueries = []
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) return { rowCount: null }
      nonSchemaQueries.push(sql)
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const originalFetch = global.fetch
  global.fetch = async (url, options) => {
    if (!String(url).startsWith('https://example.test')) {
      return originalFetch(url, options)
    }

    const movieId = String(url).match(/\/movie\/(\d+)\/videos$/)?.[1]
    if (movieId === '42') {
      return {
        ok: true,
        async json() {
          return {
            results: [
              { site: 'YouTube', type: 'Trailer', key: 'unofficial', name: 'Trailer', official: false },
              { site: 'YouTube', type: 'Trailer', key: 'official', name: 'Official Trailer', official: true },
            ],
          }
        },
      }
    }
    if (movieId === '43') {
      return {
        ok: true,
        async json() {
          return { results: [{ site: 'YouTube', type: 'Trailer', key: 'fallback', name: 'Trailer 2', official: false }] }
        },
      }
    }
    if (movieId === '44') {
      return { ok: true, async json() { return { results: [{ site: 'Vimeo', type: 'Trailer', key: 'not-playable' }] } } }
    }
    return { ok: false, status: 503, async text() { return 'TMDB unavailable' } }
  }

  const app = await createApp(pool, {
    loadRuntimeConfig: () => ({ tmdbBearerToken: 'token', tmdbBaseUrl: 'https://example.test' }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}/api/movies`

    let response = await originalFetch(`${baseUrl}/42/trailer`)
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).trailer, { provider: 'YouTube', key: 'official', name: 'Official Trailer' })

    response = await originalFetch(`${baseUrl}/43/trailer`)
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).trailer, { provider: 'YouTube', key: 'fallback', name: 'Trailer 2' })

    response = await originalFetch(`${baseUrl}/44/trailer`)
    assert.equal(response.status, 404)
    assert.match((await response.json()).error, /No playable YouTube trailer/)

    response = await originalFetch(`${baseUrl}/45/trailer`)
    assert.equal(response.status, 500)
    assert.match((await response.json()).error, /TMDB request failed with status 503/)

    response = await originalFetch(`${baseUrl}/not-a-number/trailer`)
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /Invalid movie id/)
    assert.deepEqual(nonSchemaQueries, [])
  } finally {
    global.fetch = originalFetch
    await closeServer(server)
  }
})

function createTvWatchUpdatePool({ episode = { id: 301, season_number: 2, episode_number: 4 }, season = { id: 71 }, watched = 3, total = 3 } = {}) {
  const calls = []
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('FROM users u CROSS JOIN tv_shows t')) return { rows: [{ user_id: 11, show_id: 22 }] }
      if (sql.includes('SELECT e.id, e.episode_number, s.season_number')) return { rows: [episode] }
      if (sql.includes('SELECT id FROM tv_seasons')) return { rows: [season] }
      if (sql.includes('episode_totals AS')) return { rows: [{ user_id: 11, show_id: 22, watched, total }] }
      if (sql.includes('INSERT INTO watched_tv_episodes') || sql.includes('DELETE FROM watched_tv_episodes')) return { rows: [], rowCount: 2 }
      if (sql.includes('INSERT INTO watched_tv_shows') || sql.includes('DELETE FROM watched_tv_shows')) return { rows: [], rowCount: 1 }
      throw new Error(`Unexpected query: ${sql}`)
    },
    release() {},
  }
  return { pool: { async connect() { return client } }, calls }
}

test('mark_through_episode marks only aired episodes through the selected episode across seasons', async () => {
  const { pool, calls } = createTvWatchUpdatePool()

  const result = await updateTvEpisodeWatchStateForUser(pool, {
    username: 'florind', showId: 900, action: 'mark_through_episode', episodeId: 301,
  })

  assert.deepEqual(result, { status: 'ok', updatedCount: 2 })
  const bulkInsert = calls.find(({ sql }) => sql.includes('s.season_number < $3'))
  assert.ok(bulkInsert)
  assert.match(bulkInsert.sql, /e\.air_date IS NULL OR e\.air_date <= CURRENT_DATE/i)
  assert.match(bulkInsert.sql, /s\.season_number > 0/i)
  assert.match(bulkInsert.sql, /e\.episode_number <= \$4/i)
  assert.match(bulkInsert.sql, /ON CONFLICT DO NOTHING/i)
  assert.deepEqual(bulkInsert.params, [11, 22, 2, 4, null])
})

test('mark_season marks only aired episodes in the requested season', async () => {
  const { pool, calls } = createTvWatchUpdatePool()

  const result = await updateTvEpisodeWatchStateForUser(pool, {
    username: 'florind', showId: 900, action: 'mark_season', seasonId: 71,
  })

  assert.deepEqual(result, { status: 'ok', updatedCount: 2 })
  const bulkInsert = calls.find(({ sql }) => sql.includes('WHERE e.tv_season_id = $2'))
  assert.ok(bulkInsert)
  assert.match(bulkInsert.sql, /e\.air_date IS NULL OR e\.air_date <= CURRENT_DATE/i)
  assert.match(bulkInsert.sql, /ON CONFLICT DO NOTHING/i)
  assert.deepEqual(bulkInsert.params, [11, 71, null])
})

test('individual episode watch actions are idempotent and synchronize whole-show completion', async () => {
  const { pool, calls } = createTvWatchUpdatePool({ watched: 2, total: 3 })

  const markResult = await updateTvEpisodeWatchStateForUser(pool, {
    username: 'florind', showId: 900, action: 'mark_episode', episodeId: 301,
  })
  const unmarkResult = await updateTvEpisodeWatchStateForUser(pool, {
    username: 'florind', showId: 900, action: 'unmark_episode', episodeId: 301,
  })

  assert.deepEqual(markResult, { status: 'ok', updatedCount: 2 })
  assert.deepEqual(unmarkResult, { status: 'ok', updatedCount: 2 })
  assert.equal(calls.some(({ sql }) => sql.includes('VALUES ($1, $2, $3) ON CONFLICT DO NOTHING')), true)
  assert.equal(calls.some(({ sql }) => sql.includes('DELETE FROM watched_tv_episodes WHERE user_id = $1 AND tv_episode_id = $2')), true)
  assert.equal(calls.filter(({ sql }) => sql.includes('DELETE FROM watched_tv_shows')).length, 2)
})

test('special episodes cannot be marked through the episode watch API', async () => {
  const { pool, calls } = createTvWatchUpdatePool({ episode: null })

  const result = await updateTvEpisodeWatchStateForUser(pool, {
    username: 'florind', showId: 900, action: 'mark_episode', episodeId: 301,
  })

  assert.deepEqual(result, { status: 'missing_episode' })
  assert.equal(calls.some(({ sql }) => sql.includes('INSERT INTO watched_tv_episodes')), false)
  const lookup = calls.find(({ sql }) => sql.includes('SELECT e.id, e.episode_number, s.season_number'))
  assert.match(lookup.sql, /s\.season_number > 0/i)
})

test('episode ratings upsert one score per user and validate the selected episode', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (params[0] === 'missing') return { rows: [{ has_user: false, has_episode: false, score: null }] }
      if (params[1] === 404) return { rows: [{ has_user: true, has_episode: false, score: null }] }
      return { rows: [{ has_user: true, has_episode: true, score: params[2] }] }
    },
  }

  assert.deepEqual(await upsertTvEpisodeRatingForUser(pool, { username: 'florind', episodeId: 301, score: 4.5 }), { status: 'ok', score: 4.5 })
  assert.deepEqual(await upsertTvEpisodeRatingForUser(pool, { username: 'missing', episodeId: 301, score: 4 }), { status: 'missing_user' })
  assert.deepEqual(await upsertTvEpisodeRatingForUser(pool, { username: 'florind', episodeId: 404, score: 4 }), { status: 'missing_episode' })
  assert.match(calls[0].sql, /INSERT INTO tv_episode_ratings/i)
  assert.match(calls[0].sql, /s\.season_number > 0/i)
  assert.match(calls[0].sql, /ON CONFLICT \(user_id, tv_episode_id\)/i)
})
