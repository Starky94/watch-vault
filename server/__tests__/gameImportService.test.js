import test from 'node:test'
import assert from 'node:assert/strict'
import { hydrateGameByIgdbId, importPopularGames, importRecentlyReleasedGames, importUpcomingGames, normalizeGame } from '../gameImportService.js'
import { getIgdbRateLimitConfig, igdbRequest, resetIgdbRateLimiterForTests } from '../igdbClient.js'
import { countGames, ensureGamesTable, ensureRecentlyReleasedGamesTable, ensureUpcomingGamesTable, getGameTimeToBeat, listPlayedGamesForUser, listPopularGames, listRecentlyReleasedGames, listUpcomingGames, upsertGameTimeToBeat, upsertGames } from '../database.js'
import { adminJobs } from '../adminJobs.js'

function jsonResponse(payload) {
  return { ok: true, async json() { return payload } }
}

test('normalizeGame maps display-ready IGDB metadata', () => {
  assert.deepEqual(normalizeGame({
    id: 7, name: 'Example Game', summary: 'Summary', first_release_date: 1704067200,
    rating: 82.1, rating_count: 5, aggregated_rating: 88.2, aggregated_rating_count: 4,
    cover: { image_id: 'cover-id' }, platforms: [{ name: 'PC' }], genres: [{ name: 'RPG' }], url: 'https://igdb.com/games/example',
  }, { steamPeakPlayers: 12345, importRank: 2 }), {
    igdbId: 7, title: 'Example Game', summary: 'Summary',
    coverImageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/cover-id.jpg',
    releaseDate: '2024-01-01', rating: 82.1, ratingCount: 5, aggregatedRating: 88.2,
    aggregatedRatingCount: 4, steamPeakPlayers: 12345, platforms: ['PC'], genres: ['RPG'],
    igdbUrl: 'https://igdb.com/games/example', importRank: 2,
  })
})

test('hydrateGameByIgdbId stores a missing game with its IGDB details', async () => {
  resetIgdbRateLimiterForTests()
  const writes = []
  const pool = {
    async query() { return { rows: [] } },
    async connect() {
      return {
        async query(sql, values) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
          writes.push(values)
          return { rows: [{ inserted: true }] }
        },
        release() {},
      }
    },
  }
  const game = await hydrateGameByIgdbId(pool, {
    clientId: 'client', clientSecret: 'secret', baseUrl: 'https://example.test/v4', tokenUrl: 'https://example.test/token', gameId: 42,
    fetchImpl: async (url) => String(url).includes('/token')
      ? jsonResponse({ access_token: 'token' })
      : jsonResponse([{ id: 42, name: 'Saved Game', summary: 'Stored details', first_release_date: 1704067200, cover: { image_id: 'cover' }, genres: [{ name: 'RPG' }], platforms: [{ name: 'PC' }] }]),
  })
  assert.deepEqual(game, { igdbId: 42, title: 'Saved Game', summary: 'Stored details', coverImageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/cover.jpg', releaseDate: '2024-01-01', rating: null, ratingCount: null, aggregatedRating: null, aggregatedRatingCount: null, steamPeakPlayers: 0, platforms: ['PC'], genres: ['RPG'], igdbUrl: null, importRank: 1 })
  assert.equal(writes.length, 1)
})

test('game time-to-beat cache reads and upserts IGDB durations', async () => {
  const queries = []
  const pool = {
    async query(sql, values) {
      queries.push({ sql, values })
      if (sql.includes('SELECT game_igdb_id')) return { rows: [{ game_igdb_id: 7, hastily: 1800, normally: 3600, completely: 7200 }] }
      return { rows: [{ game_igdb_id: 7, hastily: 1800, normally: 3600, completely: 7200 }] }
    },
  }
  assert.deepEqual(await getGameTimeToBeat(pool, 7), { game_igdb_id: 7, hastily: 1800, normally: 3600, completely: 7200 })
  assert.deepEqual(await upsertGameTimeToBeat(pool, { gameId: 7, hastily: 1800, normally: 3600, completely: 7200 }), { game_igdb_id: 7, hastily: 1800, normally: 3600, completely: 7200 })
  assert.deepEqual(queries[0].values, [7])
  assert.deepEqual(queries[1].values, [7, 1800, 3600, 7200])
  assert.match(queries[1].sql, /ON CONFLICT \(game_igdb_id\) DO UPDATE/i)
})

test('IGDB client spaces burst requests to at most four per second', async () => {
  resetIgdbRateLimiterForTests()
  const startedAt = []
  const fetchImpl = async () => {
    startedAt.push(Date.now())
    return jsonResponse([])
  }
  await Promise.all(Array.from({ length: 5 }, () => igdbRequest(fetchImpl, {
    clientId: 'client', accessToken: 'token', baseUrl: 'https://example.test/v4', path: 'games', body: 'fields id;',
  })))
  const { minIntervalMs } = getIgdbRateLimitConfig()
  assert.equal(minIntervalMs, 250)
  assert.equal(startedAt.length, 5)
  assert.ok(startedAt[1] - startedAt[0] >= minIntervalMs - 10)
  assert.ok(startedAt[2] - startedAt[1] >= minIntervalMs - 10)
  assert.ok(startedAt[4] - startedAt[0] >= minIntervalMs * 4 - 10)
})

test('popular game import ranks Steam peaks and writes one upsert per IGDB ID', async () => {
  resetIgdbRateLimiterForTests()
  const requests = []
  const schemaQueries = []
  let writes = 0
  const pool = {
    async query(sql) { schemaQueries.push(sql); return { rows: [] } },
    async connect() {
      return {
        async query(sql) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
          writes += 1
          return { rows: [{ inserted: writes === 1 }] }
        },
        release() {},
      }
    },
  }
  const result = await importPopularGames(pool, {
    clientId: 'client', clientSecret: 'secret', baseUrl: 'https://example.test/v4', tokenUrl: 'https://example.test/token', count: 2,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), body: options.body })
      if (String(url).includes('/token')) return jsonResponse({ access_token: 'token' })
      if (String(url).endsWith('/popularity_types')) return jsonResponse([{ id: 5, name: '24hr Peak Players' }])
      if (String(url).endsWith('/popularity_primitives')) return jsonResponse([{ game_id: 9, value: 900 }, { game_id: 3, value: 300 }])
      if (String(url).endsWith('/games')) return jsonResponse([{ id: 3, name: 'Third' }, { id: 9, name: 'First' }])
      throw new Error(`Unexpected request ${url}`)
    },
  })
  assert.deepEqual(result, {
    fetchedCount: 2, insertedCount: 1, updatedCount: 1,
    games: [
      { igdbId: 9, title: 'First', summary: null, coverImageUrl: null, releaseDate: null, rating: null, ratingCount: null, aggregatedRating: null, aggregatedRatingCount: null, steamPeakPlayers: 900, platforms: [], genres: [], igdbUrl: null, importRank: 1 },
      { igdbId: 3, title: 'Third', summary: null, coverImageUrl: null, releaseDate: null, rating: null, ratingCount: null, aggregatedRating: null, aggregatedRatingCount: null, steamPeakPlayers: 300, platforms: [], genres: [], igdbUrl: null, importRank: 2 },
    ],
  })
  assert.ok(schemaQueries.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS games')))
  assert.match(requests.find((request) => request.url.endsWith('/popularity_primitives')).body, /sort value desc; limit 2;/)
})

test('recently released game import ranks the current 30-day window by IGDB Visits', async () => {
  resetIgdbRateLimiterForTests()
  const requests = []
  const writes = []
  const pool = {
    async query() { return { rows: [] } },
    async connect() {
      return {
        async query(sql, values) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
          writes.push({ sql, values })
          return { rows: [{ inserted: writes.length === 1 }] }
        },
        release() {},
      }
    },
  }
  const result = await importRecentlyReleasedGames(pool, {
    clientId: 'client', clientSecret: 'secret', baseUrl: 'https://example.test/v4', tokenUrl: 'https://example.test/token', count: 2,
    now: new Date('2026-08-24T12:00:00.000Z'),
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), body: options.body })
      if (String(url).includes('/token')) return jsonResponse({ access_token: 'token' })
      if (String(url).endsWith('/popularity_types')) return jsonResponse([{ id: 1, name: 'Visits' }])
      if (String(url).endsWith('/popularity_primitives')) return jsonResponse([{ game_id: 9, value: 9 }, { game_id: 3, value: 3 }])
      if (String(url).endsWith('/games')) return jsonResponse([{ id: 3, name: 'Third', first_release_date: 1724457600 }, { id: 9, name: 'First', first_release_date: 1724457600 }])
      throw new Error(`Unexpected request ${url}`)
    },
  })

  assert.equal(result.fetchedCount, 2)
  assert.deepEqual(result.games.map((game) => ({ id: game.igdbId, rank: game.importRank, score: game.popularityScore })), [
    { id: 9, rank: 1, score: 9 },
    { id: 3, rank: 2, score: 3 },
  ])
  assert.match(requests.find((request) => request.url.endsWith('/games')).body, /first_release_date >= 1784937600.*first_release_date <= 1787615999.*limit 500; offset 0;/)
  assert.match(requests.find((request) => request.url.endsWith('/popularity_primitives')).body, /popularity_type = 1.*game_id = \(3,9\); limit 500;/)
  assert.ok(!requests.some((request) => request.body?.includes('game.first_release_date')))
  assert.ok(writes.some(({ sql }) => sql.includes('DELETE FROM recently_released_games WHERE NOT')))
})

test('upcoming game import ranks the next 30-day window by release date then IGDB Visits', async () => {
  resetIgdbRateLimiterForTests()
  const requests = []
  const writes = []
  const pool = {
    async query() { return { rows: [] } },
    async connect() {
      return {
        async query(sql, values) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
          writes.push({ sql, values })
          return { rows: [{ inserted: writes.length === 1 }] }
        },
        release() {},
      }
    },
  }
  const result = await importUpcomingGames(pool, {
    clientId: 'client', clientSecret: 'secret', baseUrl: 'https://example.test/v4', tokenUrl: 'https://example.test/token', count: 3,
    now: new Date('2026-08-24T12:00:00.000Z'),
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), body: options.body })
      if (String(url).includes('/token')) return jsonResponse({ access_token: 'token' })
      if (String(url).endsWith('/popularity_types')) return jsonResponse([{ id: 1, name: 'Visits' }])
      if (String(url).endsWith('/popularity_primitives')) return jsonResponse([{ game_id: 9, value: 9 }, { game_id: 3, value: 3 }, { game_id: 4, value: 30 }])
      if (String(url).endsWith('/games')) return jsonResponse([
        { id: 3, name: 'Later', first_release_date: 1787702400 },
        { id: 9, name: 'Sooner popular', first_release_date: 1787616000 },
        { id: 4, name: 'Sooner most popular', first_release_date: 1787616000 },
      ])
      throw new Error(`Unexpected request ${url}`)
    },
  })

  assert.deepEqual(result.games.map((game) => ({ id: game.igdbId, rank: game.importRank, score: game.popularityScore })), [
    { id: 4, rank: 1, score: 30 },
    { id: 9, rank: 2, score: 9 },
    { id: 3, rank: 3, score: 3 },
  ])
  assert.match(requests.find((request) => request.url.endsWith('/games')).body, /first_release_date >= 1787616000.*first_release_date <= 1790207999.*limit 500; offset 0;/)
  assert.match(requests.find((request) => request.url.endsWith('/popularity_primitives')).body, /popularity_type = 1.*game_id = \(3,9,4\); limit 500;/)
  assert.ok(writes.some(({ sql }) => sql.includes('DELETE FROM upcoming_games WHERE NOT')))
})

test('game schema and upsert use unique IGDB IDs and update repeated games', async () => {
  const schemaQueries = []
  await ensureGamesTable({ query: async (sql) => { schemaQueries.push(sql); return { rows: [] } } })
  assert.match(schemaQueries[0], /igdb_id INTEGER NOT NULL UNIQUE/i)
  assert.ok(schemaQueries.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS game_time_to_beats')))

  let calls = 0
  const result = await upsertGames({ connect: async () => ({
    async query(sql) {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      calls += 1
      assert.match(sql, /ON CONFLICT \(igdb_id\) DO UPDATE/i)
      return { rows: [{ inserted: calls === 1 }] }
    },
    release() {},
  }) }, [
    { igdbId: 9, title: 'First', summary: null, coverImageUrl: null, releaseDate: null, rating: null, ratingCount: null, aggregatedRating: null, aggregatedRatingCount: null, steamPeakPlayers: 100, platforms: [], genres: [], igdbUrl: null, importRank: 1 },
    { igdbId: 9, title: 'First updated', summary: null, coverImageUrl: null, releaseDate: null, rating: null, ratingCount: null, aggregatedRating: null, aggregatedRatingCount: null, steamPeakPlayers: 200, platforms: [], genres: [], igdbUrl: null, importRank: 1 },
  ])
  assert.deepEqual(result, { insertedCount: 1, updatedCount: 1 })
})

test('games expose an admin job and database total', async () => {
  const job = adminJobs.find((candidate) => candidate.key === 'games-popular')
  assert.deepEqual({ name: job?.name, frequency: job?.frequency, source: job?.source }, {
    name: 'Popular Games Import', frequency: 'Every 24 hours', source: 'igdb',
  })
  let sql = ''
  const total = await countGames({ query: async (query) => { sql = query; return { rows: [{ game_count: 30 }] } } })
  assert.equal(total, 30)
  assert.match(sql, /COUNT\(DISTINCT igdb_id\)::INTEGER AS game_count/i)
  assert.match(sql, /SELECT igdb_id FROM recently_released_games/i)
  assert.match(sql, /SELECT igdb_id FROM upcoming_games/i)
})

test('listPopularGames paginates by Steam popularity', async () => {
  let sql = ''
  let params = []
  const rows = [{ igdb_id: 2, import_rank: 1 }, { igdb_id: 9, import_rank: 2 }]
  const result = await listPopularGames({ query: async (query, values) => { sql = query; params = values; return { rows } } }, { limit: 2, page: 3 })

  assert.deepEqual(result, rows)
  assert.deepEqual(params, [2, 4])
  assert.match(sql, /ORDER BY steam_peak_players DESC, igdb_id ASC/i)
  assert.match(sql, /LIMIT \$1/i)
  assert.match(sql, /OFFSET \$2/i)
})

test('recently released games use a separate ranked table', async () => {
  const schemaQueries = []
  await ensureRecentlyReleasedGamesTable({ query: async (sql) => { schemaQueries.push(sql); return { rows: [] } } })
  assert.match(schemaQueries[0], /CREATE TABLE IF NOT EXISTS recently_released_games/i)

  let sql = ''
  let params = []
  const rows = [{ igdb_id: 2, import_rank: 1 }]
  const result = await listRecentlyReleasedGames({ query: async (query, values) => { sql = query; params = values; return { rows } } }, { limit: 5, page: 2 })
  assert.deepEqual(result, rows)
  assert.deepEqual(params, [5, 5])
  assert.match(sql, /FROM recently_released_games/i)
  assert.match(sql, /ORDER BY popularity_score DESC, igdb_id ASC/i)
  assert.match(sql, /OFFSET \$2/i)
})

test('upcoming games use a separate ranked table', async () => {
  const schemaQueries = []
  await ensureUpcomingGamesTable({ query: async (sql) => { schemaQueries.push(sql); return { rows: [] } } })
  assert.match(schemaQueries[0], /CREATE TABLE IF NOT EXISTS upcoming_games/i)

  let sql = ''
  let params = []
  const rows = [{ igdb_id: 2, import_rank: 1 }]
  const result = await listUpcomingGames({ query: async (query, values) => { sql = query; params = values; return { rows } } }, { limit: 5, page: 2 })
  assert.deepEqual(result, rows)
  assert.deepEqual(params, [5, 5])
  assert.match(sql, /FROM upcoming_games/i)
  assert.match(sql, /ORDER BY popularity_score DESC, igdb_id ASC/i)
  assert.match(sql, /OFFSET \$2/i)
})

test('played game history resolves all game catalogs without duplicate games', async () => {
  let sql = ''
  let params = []
  const rows = [{ igdb_id: 2, title: 'Played Game', played_at: '2026-08-25T10:00:00.000Z' }]
  const result = await listPlayedGamesForUser({ query: async (query, values) => { sql = query; params = values; return { rows } } }, 'florind')
  assert.deepEqual(result, rows)
  assert.deepEqual(params, ['florind'])
  assert.match(sql, /FROM games/i)
  assert.match(sql, /FROM recently_released_games/i)
  assert.match(sql, /FROM upcoming_games/i)
  assert.match(sql, /SELECT DISTINCT ON \(igdb_id\)/i)
  assert.match(sql, /ORDER BY played_games\.created_at DESC/i)
})
