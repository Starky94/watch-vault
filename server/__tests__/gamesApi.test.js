import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

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
