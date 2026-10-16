import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_ACHIEVEMENTS } from '../gameAchievements.js'
import { buildGameAchievementValues } from '../database.js'

test('game achievement catalogue contains the complete unique PDF catalogue', () => {
  assert.equal(GAME_ACHIEVEMENTS.length, 148)
  assert.equal(new Set(GAME_ACHIEVEMENTS.map((item) => item.id)).size, 148)
  assert.equal(GAME_ACHIEVEMENTS.find((item) => item.name === 'Gaming Legend').target, 1000)
  assert.equal(GAME_ACHIEVEMENTS.find((item) => item.name === 'Hot Take').rule, 'hot_take')
})

test('game achievement values only use tracked records and combine metadata, sessions, and ratings', () => {
  const entries = [
    { game_igdb_id: 1, status: 'completed', completed_at: '2026-10-31T03:00:00Z', library_added_at: '2025-01-01T00:00:00Z', playtime_minutes: 360, completion_percent: 100, difficulty: 'hard', difficulty_rating: 4, platform: 'PC', genres: ['Horror', 'Action'], developer_names: ['Studio'], publisher_names: ['Publisher'], series_name: 'Saga', release_date: '2010-01-01', completion_metadata: { tags: { coop: true, credits: true } } },
    { game_igdb_id: 2, status: 'completed', completed_at: '2026-11-01T03:00:00Z', playtime_minutes: 120, platform: 'PS5', genres: ['Racing'], developer_names: ['Studio'], publisher_names: ['Publisher'], series_name: 'Saga', release_date: '2000-01-01', completion_metadata: { tags: {} } },
  ]
  const sessions = Array.from({ length: 7 }, (_, index) => ({ game_igdb_id: 1, occurred_at: `2026-10-${String(20 + index).padStart(2, '0')}T01:00:00Z`, duration_minutes: 60, mode: index ? 'solo' : 'coop', metadata: {} }))
  const values = buildGameAchievementValues({ entries, sessions, ratings: [{ game_igdb_id: 1, score: 2.5, rating: 85, rating_count: 5 }], ratingHistory: [{ game_igdb_id: 1, score: 2 }, { game_igdb_id: 1, score: 4 }] })
  assert.equal(values.completed_games, 2)
  assert.equal(values.genre_diversity, 3)
  assert.equal(values.series_max, 2)
  assert.equal(values.backlog_age, 668)
  assert.equal(values.full_completions, 1)
  assert.equal(values.daily_streak, 7)
  assert.equal(values.coop_completions, 1)
  assert.equal(values.hot_take, 1)
  assert.equal(values['tag:credits'], 1)
  assert.equal(values['tag:rerated_up'], 1)
})


test('playtime achievements include sessions for tracked and untracked games once', () => {
  const entries = [{ game_igdb_id: 1, status: 'completed', completed_at: '2026-10-01', playtime_minutes: 120 }]
  const sessions = [
    { game_igdb_id: 1, duration_minutes: 3000 },
    { game_igdb_id: 1, duration_minutes: 2880 },
    { game_igdb_id: 2, duration_minutes: 90 },
  ]
  const values = buildGameAchievementValues({ entries, sessions })
  assert.equal(values.total_playtime, 6090)
  assert.equal(values.per_game_playtime, 6000)
  assert.equal(values.completion_playtime_high, 6000)
  assert.equal(values.completion_playtime_low, 0)
  assert.equal(values.completed_games, 1)
  // Achievement evaluation must not mutate stored manual time or count sessions twice on re-evaluation.
  assert.equal(entries[0].playtime_minutes, 120)
  assert.equal(buildGameAchievementValues({ entries, sessions }).total_playtime, 6090)
})
