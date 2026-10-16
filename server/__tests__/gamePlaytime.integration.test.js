import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createApp, sessionCookieFor } from './sessionTestHelpers.js'
import { ensureGameTrackingTables } from '../database.js'

// Use a disposable schema so existing users, tracking, and sessions remain untouched.
const connectionString = process.env.WATCHVAULT_TEST_DATABASE_URL

test('logged game sessions count toward details, activity, and achievements', { skip: !connectionString }, async (t) => {
  const schema = `game_playtime_${process.pid}_${Date.now()}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` })
  t.after(async () => {
    await pool.end()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
  })
  const app = await createApp(pool)
  await ensureGameTrackingTables(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  const users = (await pool.query(`INSERT INTO users (username, password, full_name)
    VALUES ('alice', 'test', 'Alice'), ('bob', 'test', 'Bob') RETURNING id, username`)).rows
  const alice = users.find((user) => user.username === 'alice').id
  const bob = users.find((user) => user.username === 'bob').id
  await pool.query(`INSERT INTO games (igdb_id, title, import_rank, steam_peak_players) VALUES (42, 'Session game', 1, 0), (43, 'Manual game', 2, 0)`)

  async function request(path, { method = 'GET', body, username = 'alice' } = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path.startsWith('/api/') ? path : `/api/games${path}`}`, {
      method,
      headers: { Cookie: sessionCookieFor(username), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const payload = await response.json()
    assert.equal(response.ok, true, JSON.stringify(payload))
    return payload
  }

  await t.test('historical sessions count without a tracking entry and stay scoped to their owner', async () => {
    await pool.query(`INSERT INTO game_sessions (user_id, game_igdb_id, duration_minutes)
      VALUES ($1, 42, 30), ($2, 42, 300)`, [alice, bob])
    const { tracking } = await request('/42/tracking')
    assert.equal(tracking.playtimeMinutes, 30)
    assert.equal(tracking.manualPlaytimeMinutes, 0)
    assert.equal(tracking.sessionPlaytimeMinutes, 30)
    assert.equal(tracking.completionPercent, null)
    assert.equal((await request('/activity')).playtimeMinutes, 30)
    assert.equal((await request('/43/tracking')).tracking, null)
  })

  await t.test('logging immediately returns the updated detail total', async () => {
    const result = await request('/42/sessions', { method: 'POST', body: { durationMinutes: 60, mode: 'solo' } })
    assert.ok(result.sessionId)
    assert.equal(result.tracking.playtimeMinutes, 90)
    assert.equal(result.tracking.manualPlaytimeMinutes, 0)
    assert.equal((await request('/42')).game.tracking.playtimeMinutes, 90)
    assert.equal((await request('/activity')).playtimeMinutes, 90)
    const fresh = await request('/43/sessions', { method: 'POST', body: { durationMinutes: 15, mode: 'solo' } })
    assert.equal(fresh.tracking.playtimeMinutes, 15)
  })

  await t.test('manual time adds to sessions and unchanged progress saves never count sessions twice', async () => {
    const emptyManual = await request('/42/tracking', { method: 'PUT', body: { status: 'playing', playtimeMinutes: null } })
    assert.equal(emptyManual.tracking.playtimeMinutes, 90)
    const body = { status: 'completed', playtimeMinutes: 120, completionPercent: 100 }
    for (let attempt = 0; attempt < 2; attempt++) {
      const saved = await request('/42/tracking', { method: 'PUT', body })
      assert.equal(saved.tracking.manualPlaytimeMinutes, 120)
      assert.equal(saved.tracking.sessionPlaytimeMinutes, 90)
      assert.equal(saved.tracking.playtimeMinutes, 210)
    }
    const saved = await request('/42/sessions', { method: 'POST', body: { durationMinutes: 5790, mode: 'solo' } })
    assert.equal(saved.tracking.status, 'completed')
    assert.equal(saved.tracking.completionPercent, 100)
    assert.equal(saved.tracking.playtimeMinutes, 6000)
    assert.equal((await request('/activity')).playtimeMinutes, 6015)
    const { achievements } = await request('/api/game-achievements')
    for (const name of ['100 Hours Played', 'Comfort Game', 'Epic Journey']) {
      const achievement = achievements.find((item) => item.name === name)
      assert.equal(achievement.progress.complete, true, name)
      assert.equal(achievement.unlocked, true, name)
    }
    assert.equal((await request('/42', { username: 'bob' })).game.tracking.playtimeMinutes, 300)
    assert.equal((await pool.query('SELECT playtime_minutes FROM game_tracking_entries WHERE user_id=$1 AND game_igdb_id=42', [alice])).rows[0].playtime_minutes, 120)
  })
})
