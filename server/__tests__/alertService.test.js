import assert from 'node:assert/strict'
import test from 'node:test'
import { createFavoriteActorAlertsForNewMovies, dispatchReleaseAlerts } from '../alertService.js'

test('favorite-actor alerts only target newly inserted movie ids and actor credits', async () => {
  const calls = []
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rowCount: 2, rows: [] } } }

  const count = await createFavoriteActorAlertsForNewMovies(pool, [9, 10])

  assert.equal(count, 2)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, [[9, 10]])
  assert.match(calls[0].sql, /movie_cast\.credit_type = 'actor'/)
  assert.match(calls[0].sql, /ON CONFLICT \(source_key\) DO NOTHING/)
})

test('release dispatcher creates deduplicated movie and episode queries for watchlisted or watched shows', async () => {
  const calls = []
  const pool = {
    query: async (sql) => {
      calls.push(sql)
      if (sql.includes('CREATE TABLE') || sql.includes('ALTER TABLE') || sql.includes('INSERT INTO alert_feature_state')) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: sql.includes("'tv_episode_release'") ? 3 : 1 }
    },
  }

  const result = await dispatchReleaseAlerts(pool)

  assert.deepEqual(result, { movieReleaseCount: 1, episodeReleaseCount: 3 })
  const combined = calls.join('\n')
  assert.match(combined, /movies\.release_date = \(NOW\(\) AT TIME ZONE COALESCE\(users\.alert_timezone, 'UTC'\)\)::DATE/)
  assert.match(combined, /FROM tv_watchlist_items/)
  assert.match(combined, /FROM watched_tv_episodes/)
  assert.match(combined, /activated_at.*<.*NOW/s)
  assert.match(combined, /ON CONFLICT \(source_key\) DO NOTHING/)
})
