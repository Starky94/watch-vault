import test from 'node:test'
import assert from 'node:assert/strict'
import { ACHIEVEMENTS } from '../achievements.js'
import { ensureAchievementTables, getAchievementProgressDetailsForUser, getAchievementsForUser, syncTvEpisodeAchievementEventsForUser } from '../database.js'
import { evaluateMovieTvAchievementEvidence } from '../achievementEvidence.js'

test('first-release achievement catalog enables only rules backed by stored activity', () => {
  const byName = new Map(ACHIEVEMENTS.map((item) => [item.name, item]))
  assert.equal(byName.get('Opening Weekend').availability, 'active')
  assert.equal(byName.get('Christmas Classics').availability, 'coming_soon')
  assert.equal(byName.get('Opening Weekend').target, 1)
  assert.equal(byName.get('Director Devotee').target, 15)
  assert.equal(byName.get('Genre Month').target, 10)
})

const movie = (id, occurred_at, extra = {}) => ({ event_id: id, entity_id: id, event_type: 'movie_watched', tmdb_id: id, title: `Movie ${id}`, occurred_at, release_date: '2020-01-01', poster_path: null, runtime_minutes: 100, original_language: 'en', genre_names: [], director_ids: [], actor_ids: [], metadata: {}, ...extra })
const ratedMovie = (id, occurred_at, score, extra = {}) => movie(id, occurred_at, { event_type: 'movie_rated', metadata: { score }, ...extra })
const savedMovie = (id, occurred_at, extra = {}) => movie(id, occurred_at, { event_type: 'movie_watchlist_added', ...extra })
const progress = (result, id) => result.get(id)
const titles = (result, id) => progress(result, id).contributors.map((row) => row.title)

function achievementPool({ movies = [], shows = [], episodes = [], watchlistCount = 0, unlocks = [] } = {}) {
  return { async query(sql) {
    if (sql.includes('JOIN movies m ON m.id=e.entity_id')) return { rows: movies }
    if (sql.includes('JOIN tv_shows s ON s.id=e.entity_id')) return { rows: shows }
    if (sql.includes('JOIN tv_episodes ep ON ep.id=e.entity_id')) return { rows: episodes }
    if (sql.includes('FROM watchlist_items WHERE')) return { rows: [{ count: watchlistCount }] }
    if (sql.includes('FROM user_achievement_unlocks')) return { rows: unlocks }
    throw new Error(`Unexpected achievement query: ${sql}`)
  } }
}

test('every active movie and TV badge has a rule evaluator; coming-soon badges remain inactive', () => {
  const evaluated = evaluateMovieTvAchievementEvidence()
  assert.equal(evaluated.size, 78)
  for (const item of ACHIEVEMENTS) assert.equal(evaluated.has(item.id), item.availability === 'active', item.id)
})

test('movie milestones, genres, and watchlist badges list only the first qualifying titles', () => {
  const movies = [
    savedMovie(1, '2026-01-01T10:00:00Z'),
    movie(1, '2026-01-02T10:00:00Z', { genre_names: ['Comedy', 'Action'] }),
    movie(2, '2026-01-03T10:00:00Z', { genre_names: ['Horror'] }),
    movie(3, '2026-01-04T10:00:00Z', { genre_names: ['Comedy'] }),
    ...Array.from({ length: 8 }, (_, index) => movie(index + 4, `2026-01-${String(index + 5).padStart(2, '0')}T10:00:00Z`, { genre_names: ['Comedy'] })),
  ]
  const result = evaluateMovieTvAchievementEvidence({ movies })
  assert.equal(progress(result, 'movie-night').current, 11)
  assert.deepEqual(titles(result, 'movie-night'), ['Movie 1', 'Movie 2', 'Movie 3', 'Movie 4', 'Movie 5'])
  assert.equal(progress(result, 'laugh-track').current, 10)
  assert.equal(progress(result, 'adrenaline-rush').current, 1)
  assert.deepEqual(titles(result, 'adrenaline-rush'), ['Movie 1'])
  assert.equal(progress(result, 'genre-hopper').current, 3)
  assert.deepEqual(titles(result, 'genre-hopper'), ['Movie 1', 'Movie 2'])
  assert.equal(progress(result, 'mission-accomplished').current, 1)
  assert.deepEqual(titles(result, 'mission-accomplished'), ['Movie 1'])
  assert.deepEqual(titles(result, 'one-for-later'), ['Movie 1'])
})

test('ratings use the latest recorded score and distinct scores have matching movie evidence', () => {
  const movies = [ratedMovie(1, '2026-01-01T10:00:00Z', 1), ratedMovie(2, '2026-01-02T10:00:00Z', 1), ratedMovie(3, '2026-01-03T10:00:00Z', 5), ratedMovie(4, '2026-01-04T10:00:00Z', 4.5)]
  const result = evaluateMovieTvAchievementEvidence({ movies })
  assert.equal(progress(result, 'first-impression').current, 4)
  assert.deepEqual(titles(result, 'harsh-judge'), ['Movie 1', 'Movie 2'])
  assert.deepEqual(titles(result, 'five-star-club'), ['Movie 3'])
  assert.equal(progress(result, 'perfectly-balanced').current, 3)
  assert.deepEqual(titles(result, 'perfectly-balanced'), ['Movie 1', 'Movie 3', 'Movie 4'])
})

test('watchlist timing, current backlog, and rating evidence do not pick unrelated movies', () => {
  const movies = [
    movie(1, '2026-01-01T10:00:00Z'), savedMovie(1, '2026-01-02T10:00:00Z'),
    savedMovie(2, '2025-01-01T10:00:00Z'), movie(2, '2026-01-02T10:00:00Z'),
    ratedMovie(3, '2026-01-03T10:00:00Z', 5, { vote_average: 2, community_count: 1, community_average: 5 }),
  ]
  const result = evaluateMovieTvAchievementEvidence({ movies, watchlistCount: 0 })
  assert.deepEqual(titles(result, 'mission-accomplished'), ['Movie 2'])
  assert.deepEqual(titles(result, 'coming-forgotten-treasure'), ['Movie 2'])
  assert.deepEqual(titles(result, 'coming-so-bad-it-s-good'), ['Movie 3'])
  assert.equal(progress(result, 'coming-zero-backlog').current, 1)
  assert.equal(evaluateMovieTvAchievementEvidence({ movies, watchlistCount: 1 }).get('coming-zero-backlog').current, 0)
})

test('distinct release decades, directors, actors, and letters show representative movies', () => {
  const movies = [
    movie(1, '2026-01-01T10:00:00Z', { title: 'Alpha', release_date: '1981-01-01', director_ids: [7], actor_ids: [1, 2] }),
    movie(2, '2026-01-02T10:00:00Z', { title: 'Another', release_date: '1988-01-01', director_ids: [7], actor_ids: [1, 2] }),
    movie(3, '2026-01-03T10:00:00Z', { title: 'Bravo', release_date: '1995-01-01', director_ids: [8], actor_ids: [1, 3] }),
  ]
  const result = evaluateMovieTvAchievementEvidence({ movies })
  assert.equal(progress(result, 'decade-hopper').current, 2)
  assert.deepEqual(titles(result, 'decade-hopper'), ['Alpha', 'Bravo'])
  assert.equal(progress(result, 'coming-director-s-cut').current, 2)
  assert.deepEqual(titles(result, 'coming-director-s-cut'), ['Alpha', 'Another'])
  assert.equal(progress(result, 'coming-favourite-face').current, 3)
  assert.equal(progress(result, 'coming-cast-reunion').current, 2)
  assert.equal(progress(result, 'coming-auteur-explorer').current, 2)
  assert.deepEqual(titles(result, 'coming-a-z-challenge'), ['Alpha', 'Bravo'])
})

test('calendar badges use UTC and show the first earning window or strongest incomplete window', () => {
  const movies = [
    ...Array.from({ length: 7 }, (_, index) => movie(index + 1, `2026-09-${String(index + 1).padStart(2, '0')}T23:30:00Z`)),
    movie(8, '2026-09-08T23:30:00Z'), movie(9, '2026-10-10T00:15:00Z'),
    movie(10, '2026-10-31T20:00:00Z', { genre_names: ['Horror'] }),
  ]
  const result = evaluateMovieTvAchievementEvidence({ movies })
  assert.equal(progress(result, 'daily-feature').current, 8)
  assert.deepEqual(titles(result, 'daily-feature'), Array.from({ length: 7 }, (_, index) => `Movie ${index + 1}`))
  assert.equal(progress(result, '30-day-challenge').current, 8)
  assert.deepEqual(titles(result, '30-day-challenge'), Array.from({ length: 8 }, (_, index) => `Movie ${index + 1}`))
  assert.equal(progress(result, 'triple-feature').current, 1)
  assert.deepEqual(titles(result, 'triple-feature'), ['Movie 1'])
  assert.equal(progress(result, 'coming-halloween-marathon').current, 1)
  assert.deepEqual(titles(result, 'coming-halloween-marathon'), ['Movie 10'])
})

test('runtime thresholds and a single-day marathon use the contributing movies', () => {
  const movies = [movie(1, '2026-09-01T10:00:00Z', { runtime_minutes: 70 }), movie(2, '2026-09-02T10:00:00Z', { runtime_minutes: 200 }), movie(3, '2026-09-02T14:00:00Z', { runtime_minutes: 180 }), movie(4, '2026-09-03T10:00:00Z', { runtime_minutes: 100 })]
  const result = evaluateMovieTvAchievementEvidence({ movies })
  assert.deepEqual(titles(result, 'quick-watch'), ['Movie 1'])
  assert.deepEqual(titles(result, 'epic-journey'), ['Movie 2'])
  assert.equal(progress(result, 'marathon-session').current, 380)
  assert.deepEqual(titles(result, 'marathon-session'), ['Movie 2', 'Movie 3'])
  assert.equal(progress(result, 'ten-hours-of-cinema').current, 550)
  assert.deepEqual(titles(result, 'ten-hours-of-cinema'), ['Movie 1', 'Movie 2', 'Movie 3', 'Movie 4'])
})

test('TV completion, episode ratings and watched runtime retain episode identity', () => {
  const shows = [{ event_id: 1, entity_id: 1, event_type: 'tv_show_completed', tmdb_id: 44, name: 'Show A', occurred_at: '2026-01-01T10:00:00Z' }, { event_id: 2, entity_id: 2, event_type: 'tv_watchlist_added', tmdb_id: 45, name: 'Show B', occurred_at: '2026-01-02T10:00:00Z' }]
  const episodes = [{ event_id: 3, entity_id: 3, event_type: 'tv_rated', tmdb_id: 44, name: 'Show A', episode_tmdb_id: 333, episode_name: 'Pilot', season_number: 1, episode_number: 1, occurred_at: '2026-01-03T10:00:00Z', metadata: { score: 4 } }, { event_id: 4, entity_id: 4, event_type: 'tv_episode_watched', tmdb_id: 44, name: 'Show A', episode_tmdb_id: 334, episode_name: 'Second', season_number: 1, episode_number: 2, runtime_minutes: 45, occurred_at: '2026-01-04T10:00:00Z' }]
  const result = evaluateMovieTvAchievementEvidence({ shows, episodes })
  assert.deepEqual(titles(result, 'tv-first-series'), ['Show A'])
  assert.deepEqual(titles(result, 'tv-watchlist'), ['Show B'])
  assert.deepEqual(titles(result, 'tv-first-rating'), ['Show A · Pilot'])
  assert.deepEqual(titles(result, 'tv-runtime'), ['Show A · Second'])
  assert.equal(progress(result, 'tv-runtime').contributors[0].episodeNumber, 2)
})

test('catalog and clicked detail use identical event evidence and preserve stored unlocks', async () => {
  const movies = [movie(1, '2026-01-01T10:00:00Z'), movie(2, '2026-01-02T10:00:00Z')]
  const pool = achievementPool({ movies, unlocks: [{ achievement_id: 'movie-first-screening', unlocked_at: '2026-01-01T10:00:01Z' }] })
  const catalog = await getAchievementsForUser(pool, 'viewer')
  const detail = await getAchievementProgressDetailsForUser(pool, 'viewer', 'movie-first-screening')
  assert.equal(catalog.find((item) => item.id === 'movie-first-screening').progress.current, detail.achievement.progress.current)
  assert.equal(detail.achievement.unlocked, true)
  assert.deepEqual(detail.contributors.map((item) => item.title), ['Movie 1'])
  assert.deepEqual(await getAchievementProgressDetailsForUser(pool, 'viewer', 'missing'), { status: 'missing_achievement' })
})

test('first-release release-date and genre-month rules require the matching movie', () => {
  const movies = [
    movie(1, '2026-10-31T23:30:00Z', { release_date: '2026-10-31', genre_names: ['Horror'], detail_payload: { release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ type: 3, release_date: '2026-10-31T00:00:00Z' }] }] } } }),
    movie(2, '2026-11-01T00:15:00Z', { release_date: '2020-01-01', genre_names: ['Comedy'] }),
  ]
  const result = evaluateMovieTvAchievementEvidence({ movies })
  assert.deepEqual(titles(result, 'coming-opening-weekend'), ['Movie 1'])
  assert.deepEqual(titles(result, 'coming-new-release-hunter'), ['Movie 1'])
  assert.deepEqual(titles(result, 'coming-halloween-marathon'), ['Movie 1'])
  assert.equal(progress(result, 'coming-genre-month').current, 1)
  assert.deepEqual(titles(result, 'coming-genre-month'), ['Movie 1'])
})

test('a 30-day challenge uses UTC dates, including the last day but excluding day 31', () => {
  const movies = [movie(1, '2026-09-01T23:30:00Z'), movie(2, '2026-09-30T00:01:00Z'), movie(3, '2026-10-01T00:01:00Z')]
  const result = evaluateMovieTvAchievementEvidence({ movies })
  assert.equal(progress(result, '30-day-challenge').current, 2)
  assert.deepEqual(titles(result, '30-day-challenge'), ['Movie 1', 'Movie 2'])
})

test('30 Day Challenge unlocks at 30 movies and lists the first 30 that earned it', () => {
  const movies = Array.from({ length: 31 }, (_, index) => movie(index + 1, new Date(Date.UTC(2026, 8, 1 + index, 10)).toISOString()))
  const result = evaluateMovieTvAchievementEvidence({ movies })
  assert.equal(progress(result, '30-day-challenge').current, 30)
  assert.equal(progress(result, '30-day-challenge').contributors.length, 30)
  assert.equal(progress(result, '30-day-challenge').contributors.at(-1).id, 30)
})

test('all active individual badges return detail progress from the same events as the catalog', async () => {
  const movies = [savedMovie(1, '2026-01-01T10:00:00Z'), movie(1, '2026-01-02T10:00:00Z', { genre_names: ['Comedy'], director_ids: [3], actor_ids: [4, 5] }), ratedMovie(2, '2026-01-03T10:00:00Z', 5)]
  const shows = [{ event_type: 'tv_show_completed', tmdb_id: 4, name: 'A show', entity_id: 4, occurred_at: '2026-01-04T10:00:00Z' }, { event_type: 'tv_watchlist_added', tmdb_id: 5, name: 'Saved show', entity_id: 5, occurred_at: '2026-01-05T10:00:00Z' }]
  const episodes = [{ event_type: 'tv_rated', tmdb_id: 4, name: 'A show', episode_tmdb_id: 40, episode_name: 'Pilot', entity_id: 40, occurred_at: '2026-01-06T10:00:00Z', metadata: { score: 4 } }, { event_type: 'tv_episode_watched', tmdb_id: 4, name: 'A show', episode_tmdb_id: 41, episode_name: 'Next', entity_id: 41, runtime_minutes: 45, occurred_at: '2026-01-07T10:00:00Z' }]
  const pool = achievementPool({ movies, shows, episodes })
  const catalog = await getAchievementsForUser(pool, 'viewer')
  for (const badge of catalog.filter((item) => item.availability === 'active')) {
    const detail = await getAchievementProgressDetailsForUser(pool, 'viewer', badge.id)
    assert.equal(detail.achievement.progress.current, badge.progress.current, badge.id)
    if (badge.progress.current === 0) assert.deepEqual(detail.contributors, [], badge.id)
  }
})

test('rollout baseline excludes later activity and repairs post-rollout bulk episode watches', async () => {
  const queries = []
  await ensureAchievementTables({ query: async (sql) => { queries.push(sql); return { rows: [] } } })
  const movieBaseline = queries.find((sql) => sql.includes("SELECT item.user_id,'movie_watch',item.movie_id"))
  const episodeBaseline = queries.find((sql) => sql.includes("SELECT item.user_id,'tv_episode_watch',item.tv_episode_id"))
  const repair = queries.find((sql) => sql.includes("SELECT watched.user_id,'tv_episode_watched'"))
  assert.match(movieBaseline, /item\.created_at < tracking\.activated_at/)
  assert.match(episodeBaseline, /item\.watched_at < tracking\.activated_at/)
  assert.match(repair, /watched\.watched_at >= tracking\.activated_at/)
  assert.match(repair, /ON CONFLICT DO NOTHING/)
  const ids = await syncTvEpisodeAchievementEventsForUser({ query: async (_sql, params) => {
    assert.deepEqual(params, ['viewer'])
    return { rows: [{ entity_id: 40 }, { entity_id: 41 }] }
  } }, 'viewer')
  assert.deepEqual(ids, [40, 41])
})
