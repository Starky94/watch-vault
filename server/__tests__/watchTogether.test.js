import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWatchTogetherStats, ensureWatchTogetherTables } from '../database.js'
import { WATCH_TOGETHER_ACHIEVEMENTS } from '../watchTogetherAchievements.js'

test('Watch Together schema enforces request, pairing, and shared-title constraints', async () => {
  const queries = []
  await ensureWatchTogetherTables({ query: async (sql) => { queries.push(sql); return { rows: [] } } })
  assert.equal(queries.some((sql) => sql.includes('UNIQUE (user_id)')), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_requests')), true)
  assert.equal(queries.some((sql) => sql.includes("status IN ('pending', 'accepted', 'denied', 'invalidated')")), true)
  assert.equal(queries.some((sql) => sql.includes('one_pending_requester')), true)
  assert.equal(queries.some((sql) => sql.includes('one_pending_recipient')), true)
  assert.equal(queries.some((sql) => sql.includes("media_type IN ('movie', 'tv')")), true)
  assert.equal(queries.some((sql) => sql.includes('WHERE is_selected')), true)
  assert.equal(queries.some((sql) => sql.includes('pick_proposed_by_user_id')), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_one_pending_pick_idx')), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_one_active_pick_idx')), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_item_confirmations')), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_watched_movies')), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_sessions')), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_achievement_unlocks')), true)
})

test('Watch Together catalog contains all 125 supplied achievements with stable ids', () => {
  assert.equal(WATCH_TOGETHER_ACHIEVEMENTS.length, 125)
  assert.equal(new Set(WATCH_TOGETHER_ACHIEVEMENTS.map((item) => item.id)).size, 125)
  assert.equal(WATCH_TOGETHER_ACHIEVEMENTS.some((item) => item.name === 'Better Together'), true)
  assert.equal(WATCH_TOGETHER_ACHIEVEMENTS.some((item) => item.name === 'Relationship Test Passed'), true)
})

test('shared stats keep movie and show history separate and aggregate both partner ratings', () => {
  const movies = buildWatchTogetherStats([
    { id: 1, title: 'Shared Movie', watched_at: '2026-01-11T20:00:00.000Z', runtime_minutes: 120, genre_names: ['Drama'], watch_service: 'Netflix', score: 4 },
    { id: 2, title: 'Another Shared Movie', watched_at: '2026-02-12T20:00:00.000Z', runtime_minutes: 90, genre_names: ['Drama', 'Comedy'], watch_service: 'Max', score: null },
  ], { kind: 'movies', timeZone: 'UTC' })
  const shows = buildWatchTogetherStats([
    { id: 9, episode_id: 90, title: 'Shared Show', watched_at: '2026-02-14T20:00:00.000Z', runtime_minutes: 45, genre_names: ['Sci-Fi'], score: 4.5 },
    { id: 9, episode_id: 91, title: 'Shared Show', watched_at: '2026-03-14T20:00:00.000Z', runtime_minutes: 45, genre_names: ['Sci-Fi'], score: 3.5 },
  ], { kind: 'shows', timeZone: 'UTC' })

  assert.deepEqual(movies.metrics, { titlesWatched: 2, episodesWatched: 0, timeWatchedMinutes: 210, averageRating: 4 })
  assert.equal(movies.genres[0].name, 'Drama')
  assert.equal(movies.streamingPlatforms.length, 2)
  assert.equal(movies.activity.buckets[0].label, 'Jan 26')
  assert.deepEqual(shows.metrics, { titlesWatched: 1, episodesWatched: 2, timeWatchedMinutes: 90, averageRating: 4 })
  assert.equal(shows.yearInReview.episodesWatched, 2)
})
