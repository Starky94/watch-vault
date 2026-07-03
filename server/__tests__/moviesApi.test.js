import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { countMovies, countStoredDataBytes, ensureMoviesTable, listMovies, listRecentlyReleasedMovies, listSimilarMovies, listTopRatedMovies, listUpcomingMovies } from '../database.js'

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
    sql.includes('CREATE TABLE IF NOT EXISTS watchlist_items') ||
    sql.includes('CREATE TABLE IF NOT EXISTS watched_movies')
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
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS users')), true)
  assert.equal(executedSql.some((sql) => sql.includes('INSERT INTO users')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS watchlist_items')), true)
  assert.equal(executedSql.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS watched_movies')), true)
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
    })
    assert.equal(alexWatchedResponse.status, 200)
    assert.equal(alexWatchedPayload.count, 0)
    assert.deepEqual(alexWatchedPayload.stats, {
      moviesWatched: 0,
      timeWatchedMinutes: 0,
      watchlistCount: 0,
    })
    assert.equal(removeResponse.status, 200)
    assert.deepEqual(removePayload, {
      removed: true,
      stats: {
        moviesWatched: 0,
        timeWatchedMinutes: 0,
        watchlistCount: 0,
      },
    })
  } finally {
    await closeServer(server)
  }
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
        return { rows: [] }
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
        return { rows: [] }
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

test('GET /api/movies/:movieId returns 404 when the movie is missing', async () => {
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

test('GET /api/movies/:movieId returns empty credits when none are stored', async () => {
  const row = {
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

  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('WHERE movies.tmdb_id = $1')) {
        return { rows: [row] }
      }

      if (sql.includes('FROM movie_cast')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/movies/77`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.movie.director, null)
    assert.deepEqual(payload.movie.cast, [])
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

test('GET /api/admin/overview returns the configured jobs, total movie count, and stored data size', async () => {
  const pool = {
    async query(sql) {
      if (isSchemaSetupQuery(sql)) {
        return { rowCount: null }
      }

      if (sql.includes('SELECT COUNT(*)::INTEGER AS movie_count')) {
        return { rows: [{ movie_count: 125 }] }
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
    assert.equal(payload.totals.movies, 125)
    assert.equal(payload.totals.storedDataBytes, 5242880)
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
