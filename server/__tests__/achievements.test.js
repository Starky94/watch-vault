import test from 'node:test'
import assert from 'node:assert/strict'
import { ACHIEVEMENTS } from '../achievements.js'
import { buildFirstReleaseAchievementValues, getAchievementProgressDetailsForUser } from '../database.js'

test('first-release achievement catalog enables only rules backed by stored activity', () => {
  const byName = new Map(ACHIEVEMENTS.map((item) => [item.name, item]))
  assert.equal(byName.get('Opening Weekend').availability, 'active')
  assert.equal(byName.get('Christmas Classics').availability, 'coming_soon')
  assert.equal(byName.get('Opening Weekend').target, 1)
  assert.equal(byName.get('Director Devotee').target, 15)
  assert.equal(byName.get('Genre Month').target, 10)
})

test('first-release metrics use new movie events, genres, cast credits, and rating evidence', () => {
  const movies = Array.from({ length: 10 }, (_, index) => ({
    entity_id: index + 1,
    occurred_at: `2026-10-31T0${index % 6}:00:00.000Z`,
    title: `${String.fromCharCode(65 + index)} title`,
    release_date: index === 0 ? '2026-10-31' : `20${20 + index}-01-01`,
    detail_payload: index === 0 ? { release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ type: 3, release_date: '2026-10-31T00:00:00.000Z' }] }] } } : null,
    genre_names: ['Horror', index % 2 ? 'Action' : 'Comedy'],
    director_ids: [1], actor_ids: [2, 3],
  }))
  const values = buildFirstReleaseAchievementValues({
    movies,
    ratings: [{ personal_score: 1, vote_count: 1001, community_count: 5, community_average: 3, vote_average: 4 }],
    watchlistCount: 0,
    watchlistAdds: [{ entity_id: 1, occurred_at: '2025-01-01T00:00:00.000Z' }],
  })

  assert.equal(values.opening_weekend, 1)
  assert.equal(values.new_release_hunter, 2)
  assert.equal(values.halloween_horror, 10)
  assert.equal(values.director_max, 10)
  assert.equal(values.actor_pair_max, 10)
  assert.equal(values.genre_month, 10)
  assert.equal(values.zero_backlog, 1)
  assert.equal(values.forgotten_treasure, 1)
  assert.equal(values.against_crowd, 1)
})

test('achievement progress details return the first qualifying movies only', async () => {
  const watchedRows = Array.from({ length: 7 }, (_value, index) => ({
    event_type: 'movie_watched', tmdb_id: index + 1, title: `Movie ${index + 1}`,
    release_date: '2020-01-01', poster_path: null, runtime_minutes: 100,
    original_language: 'en', genre_names: ['Action'], was_watchlisted: false,
    occurred_at: `2026-01-0${index + 1}T00:00:00.000Z`, metadata: {},
  }))
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT * FROM values")) return { rows: [{ movie_count: 7, show_count: 0, movie_watchlist_count: 0, tv_watchlist_count: 0, movie_watchlist_watched: 0, movie_rating_count: 0, tv_rating_count: 0, movie_runtime: 700, tv_runtime: 0 }] }
      if (sql.includes("SELECT\n    COALESCE((SELECT json_agg(name)")) return { rows: [{}] }
      if (sql.includes("SELECT occurred_at::date AS day")) return { rows: [] }
      if (sql.includes("SELECT e.entity_id,e.occurred_at,m.title")) return { rows: [] }
      if (sql.includes("SELECT e.entity_id,(e.metadata->>'score')")) return { rows: [] }
      if (sql.includes('SELECT COUNT(*)::INTEGER AS count FROM watchlist_items')) return { rows: [{ count: 0 }] }
      if (sql.includes("SELECT entity_id,occurred_at FROM achievement_events") && sql.includes("event_type='movie_watchlist_added'")) return { rows: [] }
      if (sql.includes('SELECT achievement_id,unlocked_at')) return { rows: [] }
      if (sql.includes("e.event_type IN ('movie_watched','movie_rated')")) return { rows: watchedRows }
      if (sql.includes("e.event_type='tv_show_completed'")) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const result = await getAchievementProgressDetailsForUser(pool, 'florind', 'movie-night')
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.contributors.map((item) => item.title), ['Movie 1', 'Movie 2', 'Movie 3', 'Movie 4', 'Movie 5'])
  assert.equal(result.achievement.progress.current, 7)
})
