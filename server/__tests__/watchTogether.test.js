import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWatchTogetherStats, ensureWatchTogetherTables, evaluateWatchTogetherAchievementsForUser, getWatchTogetherAchievementsForUser } from '../database.js'
import { ACHIEVEMENTS } from '../achievements.js'
import { WATCH_TOGETHER_ACHIEVEMENTS, WATCH_TOGETHER_AUTOMATIC_GENRE_RULES } from '../watchTogetherAchievements.js'

function achievementPool({ sessions = [], movieCount = 0, episodeCount = 0, genreHistory = [], unlocks = [] } = {}) {
  const queries = []
  return {
    queries,
    query: async (sql) => {
      queries.push(sql)
      if (sql.includes('FROM watch_together_pair_members mine')) return { rows: [{ pair_id: 7, user_id: 1, partner_user_id: 2 }] }
      if (sql.includes('SELECT achievement_ids FROM watch_together_sessions')) return { rows: sessions.map((achievement_ids) => ({ achievement_ids })) }
      if (sql.includes('COUNT(*)::INTEGER AS count FROM watch_together_watched_movies')) return { rows: [{ count: movieCount }] }
      if (sql.includes('COUNT(*)::INTEGER AS count FROM watch_together_watched_episodes')) return { rows: [{ count: episodeCount }] }
      if (sql.includes('WITH shared_title_genres')) return { rows: genreHistory.map((genre_names) => ({ genre_names })) }
      if (sql.includes('FROM watch_together_achievement_unlocks')) return { rows: unlocks }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

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
  assert.equal(WATCH_TOGETHER_ACHIEVEMENTS.find((item) => item.id === 'watch-together-comedy-couple')?.tracking, 'automatic')
  assert.equal(WATCH_TOGETHER_ACHIEVEMENTS.find((item) => item.id === 'watch-together-mood-swing')?.tracking, 'manual')
  assert.equal(ACHIEVEMENTS.find((item) => item.name === 'Opening Weekend')?.availability, 'active')
})

test('shared genre achievements derive movie and episode progress from confirmed Watch Together history', async () => {
  const genreHistory = [
    ...Array.from({ length: 9 }, () => ['Comedy', 'Comedy']),
    [' comedy ', 'Drama'], // A shared TV episode counts through its parent show's genres.
    ['Action', 'Adventure', 'Science Fiction', 'Fantasy', 'Romance', 'Horror', 'Mystery', 'Thriller', 'Documentary'],
    [], // Titles without genres do not add progress.
  ]
  const pool = achievementPool({ movieCount: 10, episodeCount: 2, genreHistory })
  const achievements = await getWatchTogetherAchievementsForUser(pool, 'florind')
  const byId = new Map(achievements.map((item) => [item.id, item]))

  assert.deepEqual(byId.get('watch-together-comedy-couple').progress, { current: 10, target: 10, complete: true })
  assert.equal(byId.get('watch-together-genre-tourists').progress.current, 10)
  for (const [id] of WATCH_TOGETHER_AUTOMATIC_GENRE_RULES) assert.equal(byId.get(id).progress.current, id === 'watch-together-comedy-couple' ? 10 : 1)
  const genreQuery = pool.queries.find((sql) => sql.includes('WITH shared_title_genres'))
  assert.match(genreQuery, /watch_together_watched_movies/)
  assert.match(genreQuery, /watch_together_watched_episodes/)
  assert.match(genreQuery, /JOIN tv_shows show/)
})

test('shared automatic genre achievements ignore manual session selections', async () => {
  const achievements = await getWatchTogetherAchievementsForUser(achievementPool({
    sessions: [Array.from({ length: 10 }, () => 'watch-together-comedy-couple')],
    genreHistory: [['Drama']],
  }), 'florind')
  const comedy = achievements.find((item) => item.id === 'watch-together-comedy-couple')
  assert.deepEqual(comedy.progress, { current: 0, target: 10, complete: false })
})

test('shared automatic genre achievement unlocks are inserted once', async () => {
  const unlocks = new Map()
  const pool = achievementPool({ genreHistory: Array.from({ length: 10 }, () => ['Comedy']) })
  const originalQuery = pool.query
  pool.query = async (sql, params) => {
    if (sql.includes('INSERT INTO watch_together_achievement_unlocks')) {
      const ids = params[1].filter((id) => !unlocks.has(id))
      for (const id of ids) unlocks.set(id, '2026-08-02T00:00:00.000Z')
      return { rows: ids.map((achievement_id) => ({ achievement_id, unlocked_at: unlocks.get(achievement_id) })) }
    }
    if (sql.includes('FROM watch_together_achievement_unlocks')) return { rows: [...unlocks].map(([achievement_id, unlocked_at]) => ({ achievement_id, unlocked_at })) }
    return originalQuery(sql, params)
  }

  const first = await evaluateWatchTogetherAchievementsForUser(pool, 'florind')
  const second = await evaluateWatchTogetherAchievementsForUser(pool, 'florind')

  assert.deepEqual(first.map((item) => item.id), ['watch-together-comedy-couple'])
  assert.deepEqual(second, [])
  assert.equal(unlocks.size, 1)
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
