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
      if (sql.includes("e.event_type IN ('movie_watched','movie_rated','movie_watchlist_added')")) return { rows: watchedRows }
      if (sql.includes("e.event_type='tv_show_completed'")) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const result = await getAchievementProgressDetailsForUser(pool, 'florind', 'movie-night')
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.contributors.map((item) => item.title), ['Movie 1', 'Movie 2', 'Movie 3', 'Movie 4', 'Movie 5'])
  assert.equal(result.achievement.progress.current, 7)
})

test('daily feature progress details return movies from the latest seven-day window', async () => {
  const watchedRows = Array.from({ length: 10 }, (_value, index) => ({
    event_type: 'movie_watched', tmdb_id: index + 1, title: `Movie ${index + 1}`,
    release_date: '2020-01-01', poster_path: null, runtime_minutes: 100,
    original_language: 'en', genre_names: [], was_watchlisted: false,
    occurred_at: `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`, metadata: {},
  }))
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT * FROM values")) return { rows: [{ movie_count: 10, show_count: 0, movie_watchlist_count: 0, tv_watchlist_count: 0, movie_watchlist_watched: 0, movie_rating_count: 0, tv_rating_count: 0, movie_runtime: 1000, tv_runtime: 0 }] }
      if (sql.includes("SELECT\n    COALESCE((SELECT json_agg(name)")) return { rows: [{}] }
      if (sql.includes("SELECT occurred_at::date AS day")) return { rows: watchedRows.map((row) => ({ day: new Date(row.occurred_at).toISOString().slice(0, 10) })) }
      if (sql.includes("SELECT e.entity_id,e.occurred_at,m.title")) return { rows: watchedRows }
      if (sql.includes("SELECT e.entity_id,(e.metadata->>'score')")) return { rows: [] }
      if (sql.includes('SELECT COUNT(*)::INTEGER AS count FROM watchlist_items')) return { rows: [{ count: 0 }] }
      if (sql.includes("SELECT entity_id,occurred_at FROM achievement_events") && sql.includes("event_type='movie_watchlist_added'")) return { rows: [] }
      if (sql.includes('SELECT achievement_id,unlocked_at')) return { rows: [] }
      if (sql.includes("e.event_type IN ('movie_watched','movie_rated','movie_watchlist_added')")) return { rows: watchedRows }
      if (sql.includes("e.event_type='tv_show_completed'")) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const result = await getAchievementProgressDetailsForUser(pool, 'florind', 'daily-feature')
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.contributors.map((item) => item.title), ['Movie 4', 'Movie 5', 'Movie 6', 'Movie 7', 'Movie 8', 'Movie 9', 'Movie 10'])
})

test('weekend binge progress details return movies from the latest weekend', async () => {
  const watchedRows = [
    { event_type: 'movie_watched', tmdb_id: 1, title: 'Old Saturday', occurred_at: '2026-09-05T10:00:00.000Z' },
    { event_type: 'movie_watched', tmdb_id: 2, title: 'Old Sunday', occurred_at: '2026-09-06T10:00:00.000Z' },
    { event_type: 'movie_watched', tmdb_id: 3, title: 'Latest Saturday 1', occurred_at: '2026-09-12T10:00:00.000Z' },
    { event_type: 'movie_watched', tmdb_id: 4, title: 'Latest Saturday 2', occurred_at: '2026-09-12T14:00:00.000Z' },
    { event_type: 'movie_watched', tmdb_id: 5, title: 'Latest Sunday', occurred_at: '2026-09-13T10:00:00.000Z' },
  ].map((row) => ({ ...row, release_date: '2020-01-01', poster_path: null, runtime_minutes: 100, original_language: 'en', genre_names: [], was_watchlisted: false, metadata: {} }))
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT * FROM values")) return { rows: [{ movie_count: 5, show_count: 0, movie_watchlist_count: 0, tv_watchlist_count: 0, movie_watchlist_watched: 0, movie_rating_count: 0, tv_rating_count: 0, movie_runtime: 500, tv_runtime: 0 }] }
      if (sql.includes("SELECT\n    COALESCE((SELECT json_agg(name)")) return { rows: [{}] }
      if (sql.includes("SELECT occurred_at::date AS day")) return { rows: watchedRows.map((row) => ({ day: new Date(row.occurred_at).toISOString().slice(0, 10) })) }
      if (sql.includes("SELECT e.entity_id,e.occurred_at,m.title")) return { rows: watchedRows }
      if (sql.includes("SELECT e.entity_id,(e.metadata->>'score')")) return { rows: [] }
      if (sql.includes('SELECT COUNT(*)::INTEGER AS count FROM watchlist_items')) return { rows: [{ count: 0 }] }
      if (sql.includes("SELECT entity_id,occurred_at FROM achievement_events") && sql.includes("event_type='movie_watchlist_added'")) return { rows: [] }
      if (sql.includes('SELECT achievement_id,unlocked_at')) return { rows: [] }
      if (sql.includes("e.event_type IN ('movie_watched','movie_rated','movie_watchlist_added')")) return { rows: watchedRows }
      if (sql.includes("e.event_type='tv_show_completed'")) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const result = await getAchievementProgressDetailsForUser(pool, 'florind', 'weekend-binge')
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.contributors.map((item) => item.title), ['Latest Saturday 1', 'Latest Saturday 2', 'Latest Sunday'])
})

test('watchlist achievement progress details use added-to-watchlist events', async () => {
  const watchedRows = [{
    event_type: 'movie_watched', tmdb_id: 1, title: 'Watched Movie',
    occurred_at: '2026-09-01T10:00:00.000Z', release_date: '2020-01-01', poster_path: null,
    runtime_minutes: 100, original_language: 'en', genre_names: [], was_watchlisted: false, metadata: {},
  }]
  const watchlistRows = Array.from({ length: 10 }, (_value, index) => ({
    event_type: 'movie_watchlist_added', tmdb_id: index + 10, title: `Watchlist Movie ${index + 1}`,
    occurred_at: `2026-09-${String(index + 2).padStart(2, '0')}T10:00:00.000Z`, release_date: '2020-01-01', poster_path: null,
    runtime_minutes: 100, original_language: 'en', genre_names: [], was_watchlisted: false, metadata: {},
  }))
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT * FROM values")) return { rows: [{ movie_count: 1, show_count: 0, movie_watchlist_count: 10, tv_watchlist_count: 0, movie_watchlist_watched: 0, movie_rating_count: 0, tv_rating_count: 0, movie_runtime: 100, tv_runtime: 0 }] }
      if (sql.includes("SELECT\n    COALESCE((SELECT json_agg(name)")) return { rows: [{}] }
      if (sql.includes("SELECT occurred_at::date AS day")) return { rows: [{ day: '2026-09-01' }] }
      if (sql.includes("SELECT e.entity_id,e.occurred_at,m.title")) return { rows: [...watchedRows, ...watchlistRows] }
      if (sql.includes("SELECT e.entity_id,(e.metadata->>'score')")) return { rows: [] }
      if (sql.includes('SELECT COUNT(*)::INTEGER AS count FROM watchlist_items')) return { rows: [{ count: 10 }] }
      if (sql.includes("SELECT entity_id,occurred_at FROM achievement_events") && sql.includes("event_type='movie_watchlist_added'")) return { rows: watchlistRows.map((row) => ({ entity_id: row.tmdb_id, occurred_at: row.occurred_at })) }
      if (sql.includes('SELECT achievement_id,unlocked_at')) return { rows: [] }
      if (sql.includes("e.event_type IN ('movie_watched','movie_rated','movie_watchlist_added')")) return { rows: [...watchedRows, ...watchlistRows] }
      if (sql.includes("e.event_type='tv_show_completed'")) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const result = await getAchievementProgressDetailsForUser(pool, 'florind', 'growing-backlog')
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.contributors.map((item) => item.title), watchlistRows.slice(0, 10).map((item) => item.title))
  assert.equal(result.achievement.progress.current, 10)
})

test('decade hopper progress counts distinct release decades and lists one movie per decade', async () => {
  const watchedRows = [
    { tmdb_id: 1, title: 'Eighties One', release_date: '1981-01-01' },
    { tmdb_id: 2, title: 'Eighties Two', release_date: '1988-01-01' },
    { tmdb_id: 3, title: 'Nineties', release_date: '1995-01-01' },
    { tmdb_id: 4, title: 'Nineties Two', release_date: '1999-01-01' },
    { tmdb_id: 5, title: 'Two Thousands', release_date: '2004-01-01' },
  ].map((row, index) => ({ ...row, event_type: 'movie_watched', occurred_at: `2026-09-0${index + 1}T10:00:00.000Z`, poster_path: null, runtime_minutes: 100, original_language: 'en', genre_names: [], was_watchlisted: false, metadata: {} }))
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT * FROM values")) return { rows: [{ movie_count: 5, show_count: 0, movie_watchlist_count: 0, tv_watchlist_count: 0, movie_watchlist_watched: 0, movie_rating_count: 0, tv_rating_count: 0, movie_runtime: 500, tv_runtime: 0 }] }
      if (sql.includes("SELECT\n    COALESCE((SELECT json_agg(name)")) return { rows: [{ decade_diversity: 3 }] }
      if (sql.includes("SELECT occurred_at::date AS day")) return { rows: watchedRows.map((row) => ({ day: new Date(row.occurred_at).toISOString().slice(0, 10) })) }
      if (sql.includes("SELECT e.entity_id,e.occurred_at,m.title")) return { rows: watchedRows }
      if (sql.includes("SELECT e.entity_id,(e.metadata->>'score')")) return { rows: [] }
      if (sql.includes('SELECT COUNT(*)::INTEGER AS count FROM watchlist_items')) return { rows: [{ count: 0 }] }
      if (sql.includes("SELECT entity_id,occurred_at FROM achievement_events") && sql.includes("event_type='movie_watchlist_added'")) return { rows: [] }
      if (sql.includes('SELECT achievement_id,unlocked_at')) return { rows: [] }
      if (sql.includes("e.event_type IN ('movie_watched','movie_rated','movie_watchlist_added')")) return { rows: watchedRows }
      if (sql.includes("e.event_type='tv_show_completed'")) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const result = await getAchievementProgressDetailsForUser(pool, 'florind', 'decade-hopper')
  assert.equal(result.status, 'ok')
  assert.equal(result.achievement.progress.current, 3)
  assert.deepEqual(result.contributors.map((item) => item.title), ['Eighties One', 'Nineties', 'Two Thousands'])
})

test('marathon session progress uses the highest-runtime day and lists only that day', async () => {
  const watchedRows = [
    { tmdb_id: 1, title: 'Short Day Movie', occurred_at: '2026-09-01T10:00:00.000Z', runtime_minutes: 120 },
    { tmdb_id: 2, title: 'Marathon Movie 1', occurred_at: '2026-09-02T10:00:00.000Z', runtime_minutes: 200 },
    { tmdb_id: 3, title: 'Marathon Movie 2', occurred_at: '2026-09-02T14:00:00.000Z', runtime_minutes: 180 },
  ].map((row) => ({ ...row, event_type: 'movie_watched', occurred_at: new Date(row.occurred_at), release_date: '2020-01-01', poster_path: null, original_language: 'en', genre_names: [], was_watchlisted: false, metadata: {} }))
  const pool = {
    async query(sql) {
      if (sql.includes("SELECT * FROM values")) return { rows: [{ movie_count: 3, show_count: 0, movie_watchlist_count: 0, tv_watchlist_count: 0, movie_watchlist_watched: 0, movie_rating_count: 0, tv_rating_count: 0, movie_runtime: 500, tv_runtime: 0 }] }
      if (sql.includes("SELECT\n    COALESCE((SELECT json_agg(name)")) return { rows: [{ daily_runtime: 380 }] }
      if (sql.includes("SELECT occurred_at::date AS day")) return { rows: watchedRows.map((row) => ({ day: new Date(row.occurred_at).toISOString().slice(0, 10) })) }
      if (sql.includes("SELECT e.entity_id,e.occurred_at,m.title")) return { rows: watchedRows }
      if (sql.includes("SELECT e.entity_id,(e.metadata->>'score')")) return { rows: [] }
      if (sql.includes('SELECT COUNT(*)::INTEGER AS count FROM watchlist_items')) return { rows: [{ count: 0 }] }
      if (sql.includes("SELECT entity_id,occurred_at FROM achievement_events") && sql.includes("event_type='movie_watchlist_added'")) return { rows: [] }
      if (sql.includes('SELECT achievement_id,unlocked_at')) return { rows: [] }
      if (sql.includes("e.event_type IN ('movie_watched','movie_rated','movie_watchlist_added')")) return { rows: watchedRows }
      if (sql.includes("e.event_type='tv_show_completed'")) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const result = await getAchievementProgressDetailsForUser(pool, 'florind', 'marathon-session')
  assert.equal(result.status, 'ok')
  assert.equal(result.achievement.progress.current, 380)
  assert.deepEqual(result.contributors.map((item) => item.title), ['Marathon Movie 1', 'Marathon Movie 2'])
})
