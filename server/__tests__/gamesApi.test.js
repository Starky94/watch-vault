import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { encryptFilelistValue } from '../filelist.js'

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('GET /api/search/igdb validates, normalizes results, and does not write local games', async () => {
  const encryptionKey = Buffer.alloc(32, 11).toString('base64')
  const databaseQueries = []
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT encrypted_client_id')) {
        return { rows: [{ encrypted_client_id: encryptFilelistValue('client-id', encryptionKey), encrypted_private_key: encryptFilelistValue('client-secret', encryptionKey) }] }
      }
      databaseQueries.push(sql)
      return { rows: [] }
    },
  }
  const requestedBodies = []
  const fetchImpl = async (url, options = {}) => {
    if (String(url).includes('oauth2/token')) return { ok: true, async json() { return { access_token: 'access-token' } } }
    requestedBodies.push(options.body)
    return { ok: true, async json() { return Array.from({ length: 21 }, (_, index) => ({ id: index + 1, name: `Game ${index + 1}`, first_release_date: 1767225600, rating: 80, cover: { image_id: 'cover' } })) } }
  }
  const app = await createApp(pool, {
    fetchImpl,
    loadRuntimeConfig: () => ({ filelistEncryptionKey: encryptionKey, igdbBaseUrl: 'https://igdb.example/v4', twitchTokenUrl: 'https://id.twitch.tv/oauth2/token' }),
  })
  const server = app.listen(0)
  try {
    const queryCountBeforeSearch = databaseQueries.length
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}/api/search/igdb`
    const missing = await fetch(`${baseUrl}?q=%20%20`)
    assert.equal(missing.status, 400)
    const response = await fetch(`${baseUrl}?q=%20Dune%20`)
    const payload = await response.json()
    assert.equal(response.status, 200)
    assert.equal(payload.query, 'Dune')
    assert.equal(payload.games.length, 20)
    assert.deepEqual(payload.games[0], { id: 1, title: 'Game 1', summary: 'Description not available yet.', coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/cover.jpg', rating: '80.0', playersLabel: '', meta: 'Released 2026' })
    assert.equal(requestedBodies[0], 'search "Dune"; fields id,name,summary,first_release_date,rating,aggregated_rating,cover.image_id; limit 20;')
    assert.equal(databaseQueries.slice(queryCountBeforeSearch).some((sql) => /(?:INSERT INTO|UPDATE|DELETE FROM)\s+games\b/i.test(sql)), false)
  } finally {
    await closeServer(server)
  }
})

test('GET /api/search/igdb reports when IGDB credentials are missing', async () => {
  const pool = { async query() { return { rows: [] } } }
  const app = await createApp(pool)
  const server = app.listen(0)
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/search/igdb?q=Dune`)
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: 'IGDB credentials have not been configured in Admin settings.' })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/games paginates popular games and reports a next page', async () => {
  const rows = Array.from({ length: 31 }, (_, index) => ({
    igdb_id: index + 10,
    title: `Game ${index + 1}`,
    import_rank: index + 1,
    steam_peak_players: 100 - index,
  }))
  let requestedLimit = null
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM games') && sql.includes('ORDER BY steam_peak_players DESC')) {
        requestedLimit = params
        return { rows }
      }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(requestedLimit, [31, 0])
    assert.equal(payload.count, 30)
    assert.deepEqual(payload.games, rows.slice(0, 30))
    assert.deepEqual(payload.pagination, { page: 1, pageSize: 30, hasNextPage: true, hasPreviousPage: false })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/games returns an empty paginated catalog when the database has no games', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('FROM games') && sql.includes('ORDER BY steam_peak_players DESC')) return { rows: [] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.count, 0)
    assert.deepEqual(payload.games, [])
    assert.deepEqual(payload.pagination, { page: 1, pageSize: 30, hasNextPage: false, hasPreviousPage: false })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/games/recently-released paginates recent games', async () => {
  const rows = [{ igdb_id: 99, title: 'New Game', import_rank: 1, release_date: '2026-08-20' }]
  let requestedLimit = null
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM recently_released_games')) {
        requestedLimit = params
        return { rows }
      }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/recently-released?page=2&limit=8`)
    const payload = await response.json()
    assert.equal(response.status, 200)
    assert.deepEqual(requestedLimit, [9, 9])
    assert.deepEqual(payload, { count: 1, games: rows, pagination: { page: 2, pageSize: 8, hasNextPage: false, hasPreviousPage: true } })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/games/upcoming paginates upcoming games', async () => {
  const rows = [{ igdb_id: 100, title: 'Future Game', import_rank: 1, release_date: '2026-08-30' }]
  let requestedLimit = null
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM upcoming_games')) {
        requestedLimit = params
        return { rows }
      }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/upcoming?limit=8`)
    const payload = await response.json()
    assert.equal(response.status, 200)
    assert.deepEqual(requestedLimit, [9, 0])
    assert.deepEqual(payload, { count: 1, games: rows, pagination: { page: 1, pageSize: 8, hasNextPage: false, hasPreviousPage: false } })
  } finally {
    await closeServer(server)
  }
})

test('GET /api/games/played requires authentication and returns the newest played games first', async () => {
  const rows = [
    { igdb_id: 2, title: 'Newest Game', cover_image_url: 'https://example.test/newest.jpg', release_date: '2026-08-20', rating: 90, steam_peak_players: 1200, played_at: '2026-08-25T10:00:00.000Z' },
    { igdb_id: 1, title: 'Older Game', cover_image_url: null, release_date: null, aggregated_rating: 80, steam_peak_players: null, played_at: '2026-08-24T10:00:00.000Z' },
  ]
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT\n        id,\n        username,\n        full_name')) return { rows: [{ id: 1, username: 'florind' }] }
      if (sql.includes('ranked_games')) return { rows }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)
  try {
    const address = server.address()
    const unauthenticated = await fetch(`http://127.0.0.1:${address.port}/api/games/played`)
    assert.equal(unauthenticated.status, 401)
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/played`, { headers: { 'x-watchvault-username': 'florind' } })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      count: 2,
      games: [
        { id: 2, title: 'Newest Game', coverUrl: 'https://example.test/newest.jpg', releaseDate: '2026-08-20', rating: 90, steamPeakPlayers: 1200, playedAt: '2026-08-25T10:00:00.000Z' },
        { id: 1, title: 'Older Game', coverUrl: null, releaseDate: null, rating: 80, steamPeakPlayers: null, playedAt: '2026-08-24T10:00:00.000Z' },
      ],
    })
  } finally { await closeServer(server) }
})

test('GET /api/games/:gameId returns imported detail and public rating state', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('game_candidates')) return { rows: [{ igdb_id: 42, title: 'Detail Game', summary: 'A game', cover_image_url: 'https://example.test/cover.jpg', release_date: '2026-08-20', rating: 82, rating_count: 12, aggregated_rating: 84, aggregated_rating_count: 8, steam_peak_players: 2000, platforms: ['PC'], genres: ['Action'], igdb_url: 'https://igdb.com/games/detail-game' }] }
      if (sql.includes('AVG(game_ratings.score)')) return { rows: [{ average: 4.5, vote_count: 2, your_score: null }] }
      if (sql.includes('FROM played_games')) return { rows: [{ played: false }] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)
  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/42`)
    const payload = await response.json()
    assert.equal(response.status, 200)
    assert.deepEqual(payload.game, { id: 42, title: 'Detail Game', summary: 'A game', coverUrl: 'https://example.test/cover.jpg', releaseDate: '2026-08-20', rating: 82, ratingCount: 12, aggregatedRating: 84, aggregatedRatingCount: 8, steamPeakPlayers: 2000, platforms: ['PC'], genres: ['Action'], igdbUrl: 'https://igdb.com/games/detail-game', timeToBeat: null, communityRating: { average: 4.5, voteCount: 2, yourScore: null }, played: false })
  } finally { await closeServer(server) }
})

test('GET /api/games/:gameId returns cached time-to-beat data without contacting IGDB', async () => {
  let requestedIgdb = false
  const pool = {
    async query(sql) {
      if (sql.includes('game_candidates')) return { rows: [{ igdb_id: 42, title: 'Detail Game' }] }
      if (sql.includes('FROM game_time_to_beats')) return { rows: [{ game_igdb_id: 42, hastily: 5400, normally: 9000, completely: 18000 }] }
      if (sql.includes('AVG(game_ratings.score)')) return { rows: [{ average: null, vote_count: 0, your_score: null }] }
      if (sql.includes('FROM played_games')) return { rows: [{ played: false }] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool, { fetchImpl: async () => { requestedIgdb = true; throw new Error('IGDB should not be called') } })
  const server = app.listen(0)
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/games/42`)
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).game.timeToBeat, { mainStory: 5400, mainAndExtras: 9000, completionist: 18000 })
    assert.equal(requestedIgdb, false)
  } finally { await closeServer(server) }
})

test('GET /api/games/:gameId fetches and caches time-to-beat data when absent locally', async () => {
  const encryptionKey = Buffer.alloc(32, 12).toString('base64')
  let persisted = null
  const requests = []
  const pool = {
    async query(sql, values) {
      if (sql.includes('game_candidates')) return { rows: [{ igdb_id: 42, title: 'Detail Game' }] }
      if (sql.includes('FROM game_time_to_beats')) return { rows: [] }
      if (sql.includes('SELECT encrypted_client_id')) return { rows: [{ encrypted_client_id: encryptFilelistValue('client-id', encryptionKey), encrypted_private_key: encryptFilelistValue('client-secret', encryptionKey) }] }
      if (sql.includes('INSERT INTO game_time_to_beats')) { persisted = values; return { rows: [{ game_igdb_id: 42, hastily: 3600, normally: 7200, completely: 14400 }] } }
      if (sql.includes('AVG(game_ratings.score)')) return { rows: [{ average: null, vote_count: 0, your_score: null }] }
      if (sql.includes('FROM played_games')) return { rows: [{ played: false }] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool, {
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), body: options.body })
      if (String(url).includes('/token')) return { ok: true, async json() { return { access_token: 'access-token' } } }
      if (String(url).endsWith('/game_time_to_beats')) return { ok: true, async json() { return [{ game_id: 42, hastily: 3600, normally: 7200, completely: 14400 }] } }
      throw new Error(`Unexpected request: ${url}`)
    },
    loadRuntimeConfig: () => ({ filelistEncryptionKey: encryptionKey, twitchTokenUrl: 'https://oauth.example.test/token', igdbBaseUrl: 'https://igdb.example.test/v4' }),
  })
  const server = app.listen(0)
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/games/42`)
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).game.timeToBeat, { mainStory: 3600, mainAndExtras: 7200, completionist: 14400 })
    assert.deepEqual(persisted, [42, 3600, 7200, 14400])
    assert.equal(requests[1].body, 'fields game_id,hastily,normally,completely; where game_id = 42; limit 1;')
  } finally { await closeServer(server) }
})

test('GET /api/games/:gameId keeps detail available when the time-to-beat lookup fails', async () => {
  const encryptionKey = Buffer.alloc(32, 13).toString('base64')
  const pool = {
    async query(sql) {
      if (sql.includes('game_candidates')) return { rows: [{ igdb_id: 42, title: 'Detail Game' }] }
      if (sql.includes('FROM game_time_to_beats')) return { rows: [] }
      if (sql.includes('SELECT encrypted_client_id')) return { rows: [{ encrypted_client_id: encryptFilelistValue('client-id', encryptionKey), encrypted_private_key: encryptFilelistValue('client-secret', encryptionKey) }] }
      if (sql.includes('AVG(game_ratings.score)')) return { rows: [{ average: null, vote_count: 0, your_score: null }] }
      if (sql.includes('FROM played_games')) return { rows: [{ played: false }] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool, {
    fetchImpl: async (url) => String(url).includes('/token')
      ? { ok: true, async json() { return { access_token: 'access-token' } } }
      : { ok: false, status: 503, async text() { return 'IGDB unavailable' } },
    loadRuntimeConfig: () => ({ filelistEncryptionKey: encryptionKey, twitchTokenUrl: 'https://oauth.example.test/token', igdbBaseUrl: 'https://igdb.example.test/v4' }),
  })
  const server = app.listen(0)
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/games/42`)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).game.timeToBeat, null)
  } finally { await closeServer(server) }
})

test('game detail tracking validates IDs, ratings, and authentication', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('game_candidates')) return { rows: [{ igdb_id: 42, title: 'Detail Game' }] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)
  try {
    const address = server.address()
    const [invalidId, invalidRating, unauthenticatedPlayed] = await Promise.all([
      fetch(`http://127.0.0.1:${address.port}/api/games/nope`),
      fetch(`http://127.0.0.1:${address.port}/api/games/42/rating`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 5.2 }) }),
      fetch(`http://127.0.0.1:${address.port}/api/games/42/played`, { method: 'POST' }),
    ])
    assert.equal(invalidId.status, 400)
    assert.equal(invalidRating.status, 400)
    assert.equal(unauthenticatedPlayed.status, 401)
  } finally { await closeServer(server) }
})

test('GET /api/games/:gameId/similar falls back to local genre matches', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('game_candidates')) return { rows: [{ igdb_id: 42, title: 'Current Game', genres: ['Action'] }] }
      if (sql.includes('shared_genre_count')) return { rows: [{ igdb_id: 77, title: 'Related Game', cover_image_url: 'https://example.test/related.jpg', release_date: '2026-08-02', rating: 88, aggregated_rating: 87, genres: ['Action'] }] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0)
  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/42/similar`)
    const payload = await response.json()
    assert.equal(response.status, 200)
    assert.equal(payload.source, 'local')
    assert.deepEqual(payload.games, [{ id: 77, title: 'Related Game', coverUrl: 'https://example.test/related.jpg', releaseDate: '2026-08-02', rating: 88, genres: ['Action'] }])
  } finally { await closeServer(server) }
})

test('GET /api/games/:gameId/trailer fetches and maps the first playable IGDB video', async () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64')
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT encrypted_client_id')) {
        return {
          rows: [{
            encrypted_client_id: encryptFilelistValue('client-id', encryptionKey),
            encrypted_private_key: encryptFilelistValue('client-secret', encryptionKey),
          }],
        }
      }
      return { rows: [] }
    },
  }
  const requests = []
  const app = await createApp(pool, {
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options })
      if (String(url) === 'https://oauth.example.test/token?client_id=client-id&client_secret=client-secret&grant_type=client_credentials') {
        return { ok: true, async json() { return { access_token: 'access-token' } } }
      }
      if (String(url) === 'https://igdb.example.test/v4/game_videos') {
        return { ok: true, async json() { return [{ name: '  Reveal Trailer  ', video_id: '  first-video  ' }, { name: 'Later video', video_id: 'second-video' }] } }
      }
      throw new Error(`Unexpected request: ${url}`)
    },
    loadRuntimeConfig: () => ({ filelistEncryptionKey: encryptionKey, twitchTokenUrl: 'https://oauth.example.test/token', igdbBaseUrl: 'https://igdb.example.test/v4' }),
  })
  const server = app.listen(0)

  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/42/trailer`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { trailer: { provider: 'YouTube', key: 'first-video', name: 'Reveal Trailer' } })
    assert.equal(requests.length, 2)
    assert.equal(requests[1].options.body, 'fields name,video_id; where game = 42; limit 10;')
  } finally { await closeServer(server) }
})

test('GET /api/games/:gameId/trailer reports invalid IDs, missing credentials, and missing videos', async () => {
  const noCredentialsApp = await createApp({ async query() { return { rows: [] } } })
  const noCredentialsServer = noCredentialsApp.listen(0)
  try {
    const address = noCredentialsServer.address()
    const [invalid, unconfigured] = await Promise.all([
      fetch(`http://127.0.0.1:${address.port}/api/games/not-a-number/trailer`),
      fetch(`http://127.0.0.1:${address.port}/api/games/42/trailer`),
    ])
    assert.equal(invalid.status, 400)
    assert.equal(unconfigured.status, 409)
  } finally { await closeServer(noCredentialsServer) }

  const encryptionKey = Buffer.alloc(32, 9).toString('base64')
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT encrypted_client_id')) return { rows: [{ encrypted_client_id: encryptFilelistValue('client-id', encryptionKey), encrypted_private_key: encryptFilelistValue('client-secret', encryptionKey) }] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool, {
    fetchImpl: async (url) => String(url).includes('/token')
      ? { ok: true, async json() { return { access_token: 'access-token' } } }
      : { ok: true, async json() { return [{ name: 'Missing video id' }] } },
    loadRuntimeConfig: () => ({ filelistEncryptionKey: encryptionKey, twitchTokenUrl: 'https://oauth.example.test/token', igdbBaseUrl: 'https://igdb.example.test/v4' }),
  })
  const server = app.listen(0)
  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/42/trailer`)
    assert.equal(response.status, 404)
  } finally { await closeServer(server) }
})

test('GET /api/games/:gameId/trailer surfaces IGDB failures', async () => {
  const encryptionKey = Buffer.alloc(32, 11).toString('base64')
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT encrypted_client_id')) return { rows: [{ encrypted_client_id: encryptFilelistValue('client-id', encryptionKey), encrypted_private_key: encryptFilelistValue('client-secret', encryptionKey) }] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool, {
    fetchImpl: async (url) => String(url).includes('/token')
      ? { ok: true, async json() { return { access_token: 'access-token' } } }
      : { ok: false, status: 503, async text() { return 'IGDB unavailable' } },
    loadRuntimeConfig: () => ({ filelistEncryptionKey: encryptionKey, twitchTokenUrl: 'https://oauth.example.test/token', igdbBaseUrl: 'https://igdb.example.test/v4' }),
  })
  const server = app.listen(0)
  try {
    const address = server.address()
    const response = await fetch(`http://127.0.0.1:${address.port}/api/games/42/trailer`)
    assert.equal(response.status, 500)
    assert.match((await response.json()).error, /IGDB request failed with status 503/)
  } finally { await closeServer(server) }
})
