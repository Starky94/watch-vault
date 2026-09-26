import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { buildWatchTogetherRelationshipSummary, buildWatchTogetherStats, calculateCurrentWatchTogetherStreak, ensureWatchTogetherTables, evaluateWatchTogetherAchievementsForUser, getWatchTogetherAchievementProgressDetailsForUser, getWatchTogetherAchievementsForUser } from '../database.js'
import { ACHIEVEMENTS } from '../achievements.js'
import { WATCH_TOGETHER_ACHIEVEMENTS, WATCH_TOGETHER_AUTOMATIC_GENRE_RULES } from '../watchTogetherAchievements.js'

function achievementPool({ sessions = [], movieCount = 0, episodeCount = 0, genreHistory = [], unlocks = [] } = {}) {
  const queries = []
  const sharedGenres = genreHistory.length ? genreHistory : Array.from({ length: movieCount + episodeCount }, () => [])
  const movieRows = Array.from({ length: Math.max(movieCount, sessions.length, sharedGenres.length - episodeCount) }, (_, index) => ({ tmdb_id: index + 1, title: `Shared movie ${index + 1}`, watched_together_at: `2026-09-${String(index + 1).padStart(2, '0')}T10:00:00Z`, genre_names: sharedGenres[index] || [], session_achievement_ids: sessions[index] || [] }))
  const episodeRows = Array.from({ length: episodeCount }, (_, index) => ({ show_tmdb_id: 100, show_name: 'Shared show', episode_tmdb_id: 200 + index, episode_name: `Episode ${index + 1}`, season_number: 1, episode_number: index + 1, watched_together_at: `2026-09-${String(movieRows.length + index + 1).padStart(2, '0')}T10:00:00Z`, genre_names: sharedGenres[movieRows.length + index] || [], session_achievement_ids: [] }))
  return {
    queries,
    query: async (sql) => {
      queries.push(sql)
      if (sql.includes('FROM watch_together_pair_members mine')) return { rows: [{ pair_id: 7, user_id: 1, partner_user_id: 2 }] }
      if (sql.includes('SELECT achievement_ids FROM watch_together_sessions')) return { rows: sessions.map((achievement_ids) => ({ achievement_ids })) }
      if (sql.includes('COUNT(*)::INTEGER AS count FROM watch_together_watched_movies')) return { rows: [{ count: movieCount }] }
      if (sql.includes('COUNT(*)::INTEGER AS count FROM watch_together_watched_episodes')) return { rows: [{ count: episodeCount }] }
      if (sql.includes('WITH shared_title_genres')) return { rows: genreHistory.map((genre_names) => ({ genre_names })) }
      if (sql.includes('SELECT movies.tmdb_id,movies.title')) return { rows: movieRows }
      if (sql.includes('SELECT tv_shows.tmdb_id AS show_tmdb_id')) return { rows: episodeRows }
      if (sql.includes('FROM watch_together_achievement_unlocks')) return { rows: unlocks }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

function achievementProgressPool({ movies = [], episodes = [], ...options } = {}) {
  const base = achievementPool(options)
  return {
    ...base,
    query: async (sql, params) => {
      if (sql.includes('SELECT movies.tmdb_id,movies.title')) return { rows: movies }
      if (sql.includes('SELECT tv_shows.tmdb_id AS show_tmdb_id')) return { rows: episodes }
      return base.query(sql, params)
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
  assert.equal(queries.some((sql) => sql.includes('watch_together_plans')), true)
  assert.equal(queries.some((sql) => sql.includes('pair_id BIGINT NOT NULL UNIQUE')), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_vote_rounds')), true)
  assert.equal(queries.some((sql) => sql.includes("vote IN ('like', 'skip', 'veto')")), true)
  assert.equal(queries.some((sql) => sql.includes('watch_together_one_active_vote_round_idx')), true)
})

test('Watch Together relationship summary counts titles and uses an active local-day streak', () => {
  const summary = buildWatchTogetherRelationshipSummary({
    members: [{ username: 'one', full_name: 'One Viewer' }, { username: 'two', full_name: 'Two Viewer' }],
    watchedMovies: [{ watched_together_at: '2026-09-16T21:00:00.000Z', runtime_minutes: 125 }, { watched_together_at: '2026-09-15T21:00:00.000Z', runtime_minutes: null }],
    watchedEpisodes: [{ show_id: 22, watched_together_at: '2026-09-16T22:00:00.000Z', runtime_minutes: 45 }, { show_id: 22, watched_together_at: '2026-09-14T22:00:00.000Z', runtime_minutes: -10 }, { show_id: 23, watched_together_at: '2026-09-15T22:00:00.000Z', runtime_minutes: 50 }],
    timeZone: 'UTC', now: new Date('2026-09-17T09:00:00.000Z'),
  })
  assert.equal(summary.titles_watched, 4)
  assert.equal(summary.time_watched_minutes, 220)
  assert.equal(summary.current_streak_days, 3)
  assert.equal(calculateCurrentWatchTogetherStreak(['2026-09-15', '2026-09-16'], 'UTC', new Date('2026-09-17T09:00:00.000Z')), 2)
  assert.equal(calculateCurrentWatchTogetherStreak(['2026-09-16'], 'America/Los_Angeles', new Date('2026-09-17T01:00:00.000Z')), 1)
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
  assert.equal(pool.queries.some((sql) => sql.includes('watch_together_watched_movies watched')), true)
  assert.equal(pool.queries.some((sql) => sql.includes('watch_together_watched_episodes watched')), true)
})

test('shared automatic genre achievements ignore manual session selections', async () => {
  const achievements = await getWatchTogetherAchievementsForUser(achievementPool({
    sessions: [Array.from({ length: 10 }, () => 'watch-together-comedy-couple')],
    genreHistory: [['Drama']],
  }), 'florind')
  const comedy = achievements.find((item) => item.id === 'watch-together-comedy-couple')
  assert.deepEqual(comedy.progress, { current: 0, target: 10, complete: false })
})

test('Watch Together progress details list manually tagged shared sessions', async () => {
  const achievementId = 'watch-together-mood-swing'
  const result = await getWatchTogetherAchievementProgressDetailsForUser(achievementProgressPool({
    sessions: [[achievementId]],
    movieCount: 1,
    movies: [{ tmdb_id: 42, title: 'Shared Movie', release_date: '2024-02-03', poster_path: '/movie.jpg', watched_together_at: '2026-09-01T20:00:00.000Z', genre_names: ['Drama'], session_achievement_ids: [achievementId] }],
  }), 'florind', achievementId)

  assert.equal(result.status, 'ok')
  assert.equal(result.achievement.progress.current, 1)
  assert.deepEqual(result.contributors, [{
    id: 42, mediaType: 'movie', title: 'Shared Movie', year: 2024, posterPath: '/movie.jpg', watchedAt: '2026-09-01T20:00:00.000Z', watched: true, qualifier: 'Recorded shared session',
  }])
})

test('Watch Together progress details filter automatic movie, episode, and genre contributors', async () => {
  const movie = { tmdb_id: 42, title: 'Comedy Movie', release_date: '2024-02-03', poster_path: '/movie.jpg', watched_together_at: '2026-09-01T20:00:00.000Z', genre_names: ['Comedy'], session_achievement_ids: [] }
  const episode = { show_tmdb_id: 77, show_name: 'Shared Show', first_air_date: '2022-01-01', poster_path: '/show.jpg', episode_tmdb_id: 88, episode_name: 'Pilot', season_number: 1, episode_number: 1, watched_together_at: '2026-09-02T20:00:00.000Z', genre_names: ['Comedy'], session_achievement_ids: [] }
  const pool = achievementProgressPool({ movieCount: 1, episodeCount: 1, genreHistory: [['Comedy'], ['Comedy']], movies: [movie], episodes: [episode] })

  const movieResult = await getWatchTogetherAchievementProgressDetailsForUser(pool, 'florind', 'watch-together-better-together')
  assert.equal(movieResult.achievement.progress.current, 1)
  assert.deepEqual(movieResult.contributors.map((item) => item.title), ['Comedy Movie'])

  const episodeResult = await getWatchTogetherAchievementProgressDetailsForUser(pool, 'florind', 'watch-together-pilot-partners')
  assert.equal(episodeResult.achievement.progress.current, 1)
  assert.deepEqual(episodeResult.contributors.map((item) => item.title), ['Shared Show · Pilot'])

  const genreResult = await getWatchTogetherAchievementProgressDetailsForUser(pool, 'florind', 'watch-together-comedy-couple')
  assert.equal(genreResult.achievement.progress.current, 2)
  assert.deepEqual(genreResult.contributors.map((item) => item.title), ['Comedy Movie', 'Shared Show · Pilot'])
})

test('Watch Together progress details reject unknown achievements and users without a pair', async () => {
  const pool = achievementProgressPool()
  assert.deepEqual(await getWatchTogetherAchievementProgressDetailsForUser(pool, 'florind', 'not-an-achievement'), { status: 'missing_achievement' })
  assert.deepEqual(await getWatchTogetherAchievementProgressDetailsForUser({ query: async () => ({ rows: [] }) }, 'florind', 'watch-together-better-together'), { status: 'missing_achievement' })
})

test('Watch Together achievement progress API returns mapped shared contributors', async () => {
  const movie = { tmdb_id: 42, title: 'Shared Movie', release_date: '2024-02-03', poster_path: '/movie.jpg', watched_together_at: '2026-09-01T20:00:00.000Z', genre_names: ['Drama'], session_achievement_ids: [] }
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM users') && sql.includes('WHERE username = $1')) return { rows: [{ id: 1, username: params[0], full_name: 'Florin' }] }
      if (sql.includes('FROM watch_together_pair_members mine')) return { rows: [{ pair_id: 7, user_id: 1, partner_user_id: 2 }] }
      if (sql.includes('SELECT achievement_ids FROM watch_together_sessions')) return { rows: [] }
      if (sql.includes('COUNT(*)::INTEGER AS count FROM watch_together_watched_movies')) return { rows: [{ count: 1 }] }
      if (sql.includes('COUNT(*)::INTEGER AS count FROM watch_together_watched_episodes')) return { rows: [{ count: 0 }] }
      if (sql.includes('WITH shared_title_genres')) return { rows: [{ genre_names: ['Drama'] }] }
      if (sql.includes('FROM watch_together_achievement_unlocks')) return { rows: [] }
      if (sql.includes('SELECT movies.tmdb_id,movies.title')) return { rows: [movie] }
      if (sql.includes('SELECT tv_shows.tmdb_id AS show_tmdb_id')) return { rows: [] }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const routeLayer = app.router.stack.find((layer) => layer.route?.path === '/api/achievements/:achievementId/progress')
  assert.ok(routeLayer)
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }
  await routeLayer.route.stack[0].handle({
    params: { achievementId: 'watch-together-better-together' },
    get(name) { return name.toLowerCase() === 'x-watchvault-username' ? 'florind' : undefined },
  }, response, (error) => { throw error })
  assert.equal(response.statusCode, 200)
  assert.equal(response.payload.achievement.id, 'watch-together-better-together')
  assert.equal(response.payload.count, 1)
  assert.equal(response.payload.contributors[0].posterUrl, 'https://image.tmdb.org/t/p/w500/movie.jpg')
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

  assert.deepEqual(first.map((item) => item.id), ['watch-together-better-together', 'watch-together-movie-night-regulars', 'watch-together-perfect-pairing', 'watch-together-comedy-couple'])
  assert.deepEqual(second, [])
  assert.equal(unlocks.size, 4)
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

test('Pilot Partners counts only a first episode, not any episode', async () => {
  const later = { show_tmdb_id: 5, show_name: 'A show', episode_tmdb_id: 52, episode_name: 'Second', season_number: 1, episode_number: 2, watched_together_at: '2026-01-02T10:00:00Z', genre_names: [], session_achievement_ids: [] }
  const pool = achievementProgressPool({ episodes: [later] })
  const catalog = await getWatchTogetherAchievementsForUser(pool, 'viewer')
  const detail = await getWatchTogetherAchievementProgressDetailsForUser(pool, 'viewer', 'watch-together-pilot-partners')
  assert.equal(catalog.find((item) => item.id === 'watch-together-pilot-partners').progress.current, 0)
  assert.deepEqual(detail.contributors, [])
})

test('all shared badge detail lists agree with catalog progress and never use unrelated titles', async () => {
  const manualIds = WATCH_TOGETHER_ACHIEVEMENTS.filter((item) => item.tracking === 'manual').map((item) => item.id)
  const movies = [{ tmdb_id: 11, title: 'Shared movie', watched_together_at: '2026-01-01T10:00:00Z', genre_names: ['Comedy', 'Drama'], session_achievement_ids: manualIds }]
  const episodes = [{ show_tmdb_id: 22, show_name: 'Shared show', episode_tmdb_id: 33, episode_name: 'Pilot', season_number: 1, episode_number: 1, watched_together_at: '2026-01-02T10:00:00Z', genre_names: ['Horror'], session_achievement_ids: [] }]
  const pool = achievementProgressPool({ movies, episodes })
  const catalog = await getWatchTogetherAchievementsForUser(pool, 'viewer')
  assert.equal(catalog.length, 125)
  for (const badge of catalog) {
    const detail = await getWatchTogetherAchievementProgressDetailsForUser(pool, 'viewer', badge.id)
    assert.equal(detail.achievement.progress.current, badge.progress.current, badge.id)
    if (badge.progress.current === 0) assert.deepEqual(detail.contributors, [], badge.id)
    assert.equal(detail.contributors.length <= badge.target, true, badge.id)
  }
  const pilot = await getWatchTogetherAchievementProgressDetailsForUser(pool, 'viewer', 'watch-together-pilot-partners')
  assert.equal(pilot.contributors[0].episodeNumber, 1)
})
