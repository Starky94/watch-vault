import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createApp, sessionCookieFor } from './sessionTestHelpers.js'
import {
  confirmWatchTogetherEpisodeForUser,
  getTvLibraryForUser,
  getTvDetailForUser,
  listContinueWatchingTvShowsForUser,
  setTvWatchingStatusForUser,
  upsertTvEpisodeRatingForUser,
  reconcileCompletedTvWatchlists,
  toggleTvLibraryItemForUser,
  updateTvEpisodeWatchStateForUser,
} from '../database.js'

// Run against a disposable PostgreSQL database; each run owns an isolated schema.
const connectionString = process.env.WATCHVAULT_TEST_DATABASE_URL

test('TV completion and stop/resume watching against PostgreSQL', { skip: !connectionString }, async (t) => {
  const schema = `tv_completion_${process.pid}_${Date.now()}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` })
  t.after(async () => {
    await pool.end()
    await admin.query(`DROP SCHEMA ${schema} CASCADE`)
    await admin.end()
  })
  await createApp(pool)
  const users = (await pool.query(`INSERT INTO users (username, password, full_name)
    VALUES ('alice', 'test', 'Alice'), ('bob', 'test', 'Bob') RETURNING id, username`)).rows
  const alice = users.find((u) => u.username === 'alice').id
  const bob = users.find((u) => u.username === 'bob').id
  let tmdbId = 10000

  async function show({ status = 'Ended', episodes = 2, watched = episodes, userId = alice, rawStatus = status } = {}) {
    const row = (await pool.query(`INSERT INTO tv_shows (tmdb_id, name, detail_payload, raw_payload, import_rank)
      VALUES ($1, 'Test show', $2, $3, 1) RETURNING id, tmdb_id`,
    [++tmdbId, status === null ? {} : { status }, rawStatus === null ? {} : { status: rawStatus }])).rows[0]
    const seasonId = (await pool.query(`INSERT INTO tv_seasons (tv_show_id, season_number, name)
      VALUES ($1, 1, 'Season 1') RETURNING id`, [row.id])).rows[0].id
    const episodeIds = []
    for (let i = 1; i <= episodes; i++) {
      const id = (await pool.query(`INSERT INTO tv_episodes (tv_season_id, episode_number, name, air_date)
        VALUES ($1, $2, 'Episode', CURRENT_DATE - 1) RETURNING id`, [seasonId, i])).rows[0].id
      episodeIds.push(id)
      if (i <= watched) await pool.query('INSERT INTO watched_tv_episodes (user_id, tv_episode_id) VALUES ($1, $2)', [userId, id])
    }
    await pool.query('INSERT INTO tv_watchlist_items (user_id, tv_show_id) VALUES ($1, $2)', [userId, row.id])
    return { ...row, seasonId, episodeIds }
  }

  async function isSaved(item, userId = alice) {
    return (await pool.query('SELECT 1 FROM tv_watchlist_items WHERE user_id = $1 AND tv_show_id = $2', [userId, item.id])).rowCount > 0
  }

  await t.test('startup cleans every user, preserves history and ratings, and is idempotent', async () => {
    const a = await show()
    const b = await show({ userId: bob })
    await pool.query('INSERT INTO tv_episode_ratings (user_id, tv_episode_id, score) VALUES ($1, $2, 4)', [alice, a.episodeIds[0]])
    await createApp(pool)
    assert.equal(await isSaved(a), false)
    assert.equal(await isSaved(b, bob), false)
    assert.equal((await pool.query('SELECT 1 FROM watched_tv_episodes WHERE tv_episode_id = ANY($1::bigint[])', [a.episodeIds])).rowCount, 2)
    assert.equal((await pool.query('SELECT score FROM tv_episode_ratings WHERE tv_episode_id = $1', [a.episodeIds[0]])).rows[0].score, '4.0')
    assert.equal((await reconcileCompletedTvWatchlists(pool)).rowCount, 0)
  })

  await t.test('keeps incomplete, non-ended, and empty shows; status uses detail then raw payload', async () => {
    const retained = []
    for (const options of [{ watched: 1 }, { status: 'Returning Series' }, { status: 'Canceled' }, { status: null }, { episodes: 0 }, { status: 'Returning Series', rawStatus: 'Ended' }]) {
      retained.push(await show(options))
    }
    const fallback = await show({ status: null, rawStatus: 'Ended' })
    const library = await getTvLibraryForUser(pool, 'alice')
    for (const item of retained) {
      assert.equal(await isSaved(item), true)
      assert.equal(library.watchedIds.includes(item.tmdb_id), false)
    }
    assert.equal(await isSaved(fallback), false)
    assert.equal(library.watchedIds.includes(fallback.tmdb_id), true)
  })

  await t.test('eligibility excludes specials and future episodes, and includes undated episodes', async () => {
    const item = await show({ episodes: 3, watched: 2 })
    await pool.query('UPDATE tv_episodes SET air_date = NULL WHERE id = $1', [item.episodeIds[0]])
    await pool.query("UPDATE tv_episodes SET air_date = CURRENT_DATE + 30 WHERE id = $1", [item.episodeIds[2]])
    const special = (await pool.query("INSERT INTO tv_seasons (tv_show_id, season_number, name) VALUES ($1, 0, 'Specials') RETURNING id", [item.id])).rows[0].id
    await pool.query("INSERT INTO tv_episodes (tv_season_id, episode_number, name) VALUES ($1, 1, 'Special')", [special])
    await reconcileCompletedTvWatchlists(pool, 'alice')
    assert.equal(await isSaved(item), false)
    const undated = await show({ watched: 1 })
    await pool.query('UPDATE tv_episodes SET air_date = NULL WHERE id = $1', [undated.episodeIds[1]])
    await reconcileCompletedTvWatchlists(pool, 'alice')
    assert.equal(await isSaved(undated), true)
  })

  await t.test('all marking actions remove the entry before commit; unmark does not restore it', async () => {
    for (const action of ['mark_episode', 'mark_season', 'mark_through_episode']) {
      const item = await show({ watched: action === 'mark_episode' ? 1 : 0 })
      const result = await updateTvEpisodeWatchStateForUser(pool, {
        username: 'alice', showId: item.tmdb_id, action, episodeId: item.episodeIds[1], seasonId: item.seasonId,
      })
      assert.equal(result.newlyCompletedShowId, item.id)
      assert.equal(await isSaved(item), false)
      const library = await getTvLibraryForUser(pool, 'alice')
      assert.equal(library.watchedIds.includes(item.tmdb_id), true)
      assert.equal(library.watchlistIds.includes(item.tmdb_id), false)
      await updateTvEpisodeWatchStateForUser(pool, { username: 'alice', showId: item.tmdb_id, action: 'unmark_episode', episodeId: item.episodeIds[1] })
      assert.equal(await isSaved(item), false)
      assert.equal((await getTvLibraryForUser(pool, 'alice')).watchedIds.includes(item.tmdb_id), false)
    }
  })

  await t.test('completed additions are successful no-ops, including legacy saved entries', async () => {
    const item = await show()
    for (let i = 0; i < 2; i++) {
      const result = await toggleTvLibraryItemForUser(pool, { username: 'alice', showId: item.tmdb_id, kind: 'watchlist' })
      assert.equal(result.status, 'ok')
      assert.equal(result.added, false)
      assert.equal(await isSaved(item), false)
    }
    assert.equal((await toggleTvLibraryItemForUser(pool, { username: 'bob', showId: item.tmdb_id, kind: 'watchlist' })).added, true)
    assert.equal(await isSaved(item, bob), true)
  })

  await t.test('cleanup failure rolls back episode and show completion', async () => {
    const item = await show({ watched: 1 })
    const failingPool = {
      async connect() {
        const client = await pool.connect()
        return {
          query(sql, params) {
            if (sql.includes('DELETE FROM tv_watchlist_items wi USING')) throw new Error('Cleanup failed')
            return client.query(sql, params)
          },
          release() { client.release() },
        }
      },
    }
    await assert.rejects(updateTvEpisodeWatchStateForUser(failingPool, {
      username: 'alice', showId: item.tmdb_id, action: 'mark_episode', episodeId: item.episodeIds[1],
    }), /Cleanup failed/)
    assert.equal(await isSaved(item), true)
    assert.equal((await pool.query('SELECT 1 FROM watched_tv_episodes WHERE user_id = $1 AND tv_episode_id = $2', [alice, item.episodeIds[1]])).rowCount, 0)
    assert.equal((await pool.query('SELECT 1 FROM watched_tv_shows WHERE user_id = $1 AND tv_show_id = $2', [alice, item.id])).rowCount, 0)
  })

  await t.test('batch cleanup removes priorities and closes queue gaps in order across media', async () => {
    const items = []
    for (const watched of [2, 1, 2, 1]) items.push(await show({ watched }))
    // Reverse insertion order exercises shifts when later entries are stored first.
    for (let i = 3; i >= 0; i--) {
      await pool.query(`INSERT INTO watchlist_priorities (user_id, media_type, media_id, queue_position, top_slot)
        VALUES ($1, 'tv', $2, $3, $4)`, [alice, String(items[i].tmdb_id), i + 1, i === 0 ? 1 : null])
    }
    await pool.query("INSERT INTO watchlist_priorities (user_id, media_type, media_id, queue_position) VALUES ($1, 'book', 'queued-book', 5)", [alice])
    await reconcileCompletedTvWatchlists(pool, 'alice')
    const priorities = (await pool.query('SELECT media_id, queue_position, top_slot FROM watchlist_priorities WHERE user_id = $1 ORDER BY queue_position', [alice])).rows
    assert.deepEqual(priorities, [
      { media_id: String(items[1].tmdb_id), queue_position: 1, top_slot: null },
      { media_id: String(items[3].tmdb_id), queue_position: 2, top_slot: null },
      { media_id: 'queued-book', queue_position: 3, top_slot: null },
    ])
  })

  await t.test('Watch Together completion removes each participant independently', async () => {
    const item = await show({ watched: 1 })
    await pool.query('INSERT INTO tv_watchlist_items (user_id, tv_show_id) VALUES ($1, $2)', [bob, item.id])
    await pool.query('INSERT INTO watched_tv_episodes (user_id, tv_episode_id) VALUES ($1, $2)', [bob, item.episodeIds[0]])
    const pairId = (await pool.query('INSERT INTO watch_together_pairs DEFAULT VALUES RETURNING id')).rows[0].id
    await pool.query('INSERT INTO watch_together_pair_members (pair_id, user_id) VALUES ($1, $2), ($1, $3)', [pairId, alice, bob])
    await pool.query("INSERT INTO watch_together_items (pair_id, media_type, media_id, tv_episode_id, is_selected) VALUES ($1, 'tv', $2, $3, TRUE)", [pairId, item.tmdb_id, item.episodeIds[1]])
    assert.equal((await confirmWatchTogetherEpisodeForUser(pool, { username: 'alice', episodeId: item.episodeIds[1] })).status, 'waiting_for_partner')
    assert.equal(await isSaved(item), false)
    assert.equal(await isSaved(item, bob), true)
    assert.equal((await confirmWatchTogetherEpisodeForUser(pool, { username: 'bob', episodeId: item.episodeIds[1] })).status, 'completed')
    assert.equal(await isSaved(item, bob), false)
  })

  await t.test('library and combined watchlist responses immediately reflect metadata changes', async () => {
    const app = await createApp(pool)
    const server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    try {
      const completed = await show()
      const before = (await pool.query('SELECT COUNT(*) FROM achievement_events')).rows[0].count
      const addResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/tv/library/watchlist`, {
        method: 'POST',
        headers: { Cookie: sessionCookieFor('alice'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ showId: completed.tmdb_id }),
      })
      assert.equal(addResponse.status, 200)
      const addPayload = await addResponse.json()
      assert.equal(addPayload.added, false)
      assert.equal(addPayload.watchlistIds.includes(completed.tmdb_id), false)
      assert.deepEqual(addPayload.newlyUnlockedAchievements, [])
      assert.equal((await pool.query('SELECT COUNT(*) FROM achievement_events')).rows[0].count, before)
      for (const path of ['/api/tv/library', '/api/watchlist']) {
        const item = await show({ status: 'Returning Series' })
        await pool.query(`UPDATE tv_shows SET detail_payload = '{"status":"Ended"}' WHERE id = $1`, [item.id])
        const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: { Cookie: sessionCookieFor('alice') } })
        assert.equal(response.status, 200)
        const payload = await response.json()
        const actualIds = (await pool.query('SELECT t.tmdb_id FROM tv_watchlist_items wi JOIN tv_shows t ON t.id = wi.tv_show_id WHERE wi.user_id = $1', [alice])).rows.map((r) => r.tmdb_id).sort()
        const returnedShows = path === '/api/tv/library' ? payload.watchlistShows : payload.tvShows
        assert.deepEqual(returnedShows.map((s) => s.id).sort(), actualIds)
        if (path === '/api/tv/library') {
          assert.deepEqual(payload.watchlistIds.sort(), actualIds)
          assert.equal(payload.stats.watchlistCount, actualIds.length)
          assert.equal(payload.watchedIds.includes(item.tmdb_id), true)
        } else {
          assert.equal(payload.count, payload.movies.length + payload.books.length + actualIds.length)
        }
        assert.equal(await isSaved(item), false)
      }
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  async function watchingState(item, username = 'alice') {
    return getTvDetailForUser(pool, { username, showId: item.tmdb_id })
  }

  await t.test('stop/resume persists per user, preserves history, and drops old priorities', async () => {
    const item = await show({ episodes: 3, watched: 1 })
    await pool.query('INSERT INTO watched_tv_episodes (user_id, tv_episode_id) VALUES ($1, $2)', [bob, item.episodeIds[0]])
    await pool.query('INSERT INTO tv_watchlist_items (user_id, tv_show_id) VALUES ($1, $2)', [bob, item.id])
    await upsertTvEpisodeRatingForUser(pool, { username: 'alice', episodeId: item.episodeIds[0], score: 4 })
    // Earlier tests leave other priorities in place; use the next available position.
    const position = (await pool.query('SELECT COALESCE(MAX(queue_position), 0) + 1 AS n FROM watchlist_priorities WHERE user_id = $1', [alice])).rows[0].n
    await pool.query("INSERT INTO watchlist_priorities (user_id, media_type, media_id, top_slot, queue_position) VALUES ($1, 'tv', $2, 1, $3)", [alice, String(item.tmdb_id), position])
    assert.equal((await watchingState(item)).canStopWatching, true)
    for (let i = 0; i < 2; i++) {
      assert.equal((await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: true })).status, 'ok')
    }
    const stoppedAt = (await pool.query('SELECT stopped_at FROM stopped_tv_shows WHERE user_id = $1 AND tv_show_id = $2', [alice, item.id])).rows[0].stopped_at
    await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: true })
    assert.deepEqual((await pool.query('SELECT stopped_at FROM stopped_tv_shows WHERE user_id = $1 AND tv_show_id = $2', [alice, item.id])).rows[0].stopped_at, stoppedAt)
    assert.equal((await watchingState(item)).stoppedWatching, true)
    assert.equal((await watchingState(item, 'bob')).stoppedWatching, false)
    assert.equal(await isSaved(item), false)
    assert.equal(await isSaved(item, bob), true)
    assert.equal((await listContinueWatchingTvShowsForUser(pool, 'alice', { limit: 1000 })).some((r) => r.tmdb_id === item.tmdb_id), false)
    const allProgress = await listContinueWatchingTvShowsForUser(pool, 'alice', { limit: 1000 })
    for (const page of [1, 2]) {
      const paged = await listContinueWatchingTvShowsForUser(pool, 'alice', { limit: 1, page })
      assert.deepEqual(paged.map((r) => r.tmdb_id), allProgress.slice(page - 1, page).map((r) => r.tmdb_id))
    }
    assert.equal((await listContinueWatchingTvShowsForUser(pool, 'bob', { limit: 1000 })).some((r) => r.tmdb_id === item.tmdb_id), true)
    assert.equal((await pool.query('SELECT 1 FROM watchlist_priorities WHERE user_id = $1 AND media_id = $2', [alice, String(item.tmdb_id)])).rowCount, 0)
    const stopped = await watchingState(item)
    assert.equal(stopped.seasons[0].episodes[0].watched, true)
    assert.equal(stopped.yourEpisodeRating.average, 4)
    for (let i = 0; i < 2; i++) await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: false })
    assert.equal((await watchingState(item)).stoppedWatching, false)
    assert.equal(await isSaved(item), true)
    assert.equal((await listContinueWatchingTvShowsForUser(pool, 'alice', { limit: 1000 })).some((r) => r.tmdb_id === item.tmdb_id), true)
    assert.equal((await pool.query('SELECT 1 FROM watchlist_priorities WHERE user_id = $1 AND media_id = $2', [alice, String(item.tmdb_id)])).rowCount, 0)
  })

  await t.test('eligibility includes caught-up ongoing shows and rejects completed or unstarted shows', async () => {
    for (const options of [{ watched: 0 }, { watched: 2 }, { episodes: 0 }]) {
      const item = await show(options)
      assert.equal((await watchingState(item)).canStopWatching, false)
      assert.equal((await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: true })).status, 'cannot_stop')
    }
    for (const options of [{ status: 'Returning Series' }, { status: 'Canceled', watched: 1 }, { status: null, watched: 1 }]) {
      const item = await show(options)
      assert.equal((await watchingState(item)).canStopWatching, true)
      assert.equal((await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: true })).status, 'ok')
    }
    const specialOnly = await show({ watched: 1 })
    await pool.query('UPDATE tv_seasons SET season_number = 0 WHERE id = $1', [specialOnly.seasonId])
    assert.equal((await watchingState(specialOnly)).canStopWatching, false)
  })

  await t.test('each marking action and watchlist addition resumes; completion still stays off watchlist', async () => {
    for (const action of ['mark_episode', 'mark_season', 'mark_through_episode', 'watchlist']) {
      const item = await show({ status: 'Returning Series', episodes: 3, watched: 1 })
      await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: true })
      if (action === 'watchlist') {
        assert.equal((await toggleTvLibraryItemForUser(pool, { username: 'alice', showId: item.tmdb_id, kind: 'watchlist' })).added, true)
      } else {
        await updateTvEpisodeWatchStateForUser(pool, { username: 'alice', showId: item.tmdb_id, action, episodeId: item.episodeIds[1], seasonId: item.seasonId })
      }
      assert.equal((await watchingState(item)).stoppedWatching, false)
      assert.equal(await isSaved(item), true)
    }
    const final = await show({ watched: 1 })
    await setTvWatchingStatusForUser(pool, { username: 'alice', showId: final.tmdb_id, stoppedWatching: true })
    await updateTvEpisodeWatchStateForUser(pool, { username: 'alice', showId: final.tmdb_id, action: 'mark_episode', episodeId: final.episodeIds[1] })
    assert.equal((await watchingState(final)).stoppedWatching, false)
    assert.equal(await isSaved(final), false)
    const becameComplete = await show({ status: 'Returning Series' })
    await setTvWatchingStatusForUser(pool, { username: 'alice', showId: becameComplete.tmdb_id, stoppedWatching: true })
    await pool.query(`UPDATE tv_shows SET detail_payload = '{"status":"Ended"}' WHERE id = $1`, [becameComplete.id])
    await setTvWatchingStatusForUser(pool, { username: 'alice', showId: becameComplete.tmdb_id, stoppedWatching: false })
    assert.equal((await watchingState(becameComplete)).stoppedWatching, false)
    assert.equal(await isSaved(becameComplete), false)
  })

  await t.test('ratings and unmarking do not resume, even after all watched progress is removed', async () => {
    const item = await show({ watched: 1 })
    await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: true })
    await upsertTvEpisodeRatingForUser(pool, { username: 'alice', episodeId: item.episodeIds[0], score: 5 })
    assert.equal((await watchingState(item)).stoppedWatching, true)
    await updateTvEpisodeWatchStateForUser(pool, { username: 'alice', showId: item.tmdb_id, action: 'unmark_episode', episodeId: item.episodeIds[0] })
    const state = await watchingState(item)
    assert.equal(state.stoppedWatching, true)
    assert.equal(state.canStopWatching, false)
    assert.equal(await isSaved(item), false)
    await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: false })
    assert.equal((await watchingState(item)).stoppedWatching, false)
    assert.equal(await isSaved(item), true)
  })

  await t.test('Watch Together confirmation automatically resumes only the confirming participant', async () => {
    const item = await show({ episodes: 3, watched: 1 })
    await pool.query('INSERT INTO watched_tv_episodes (user_id, tv_episode_id) VALUES ($1, $2)', [bob, item.episodeIds[0]])
    await pool.query('INSERT INTO tv_watchlist_items (user_id, tv_show_id) VALUES ($1, $2)', [bob, item.id])
    for (const username of ['alice', 'bob']) await setTvWatchingStatusForUser(pool, { username, showId: item.tmdb_id, stoppedWatching: true })
    const pairId = (await pool.query('SELECT pair_id FROM watch_together_pair_members WHERE user_id = $1', [alice])).rows[0].pair_id
    await pool.query("INSERT INTO watch_together_items (pair_id, media_type, media_id, tv_episode_id, is_selected) VALUES ($1, 'tv', $2, $3, TRUE)", [pairId, item.tmdb_id, item.episodeIds[1]])
    await confirmWatchTogetherEpisodeForUser(pool, { username: 'alice', episodeId: item.episodeIds[1] })
    assert.equal((await watchingState(item)).stoppedWatching, false)
    assert.equal((await watchingState(item, 'bob')).stoppedWatching, true)
    assert.equal(await isSaved(item), true)
    assert.equal(await isSaved(item, bob), false)
    await confirmWatchTogetherEpisodeForUser(pool, { username: 'bob', episodeId: item.episodeIds[1] })
    assert.equal((await watchingState(item, 'bob')).stoppedWatching, false)
    assert.equal(await isSaved(item, bob), true)
  })

  await t.test('failed stop or resume rolls back both state and membership', async () => {
    const item = await show({ watched: 1 })
    function failingPool(fragment) {
      return { async connect() {
        const client = await pool.connect()
        return {
          query(sql, params) {
            if (sql.includes(fragment)) throw new Error('Injected status failure')
            return client.query(sql, params)
          },
          release() { client.release() },
        }
      } }
    }
    await assert.rejects(setTvWatchingStatusForUser(failingPool('DELETE FROM tv_watchlist_items'), { username: 'alice', showId: item.tmdb_id, stoppedWatching: true }), /Injected status failure/)
    assert.equal((await watchingState(item)).stoppedWatching, false)
    assert.equal(await isSaved(item), true)
    await setTvWatchingStatusForUser(pool, { username: 'alice', showId: item.tmdb_id, stoppedWatching: true })
    await assert.rejects(setTvWatchingStatusForUser(failingPool('INSERT INTO tv_watchlist_items'), { username: 'alice', showId: item.tmdb_id, stoppedWatching: false }), /Injected status failure/)
    assert.equal((await watchingState(item)).stoppedWatching, true)
    assert.equal(await isSaved(item), false)
    await assert.rejects(updateTvEpisodeWatchStateForUser(failingPool('INSERT INTO tv_watchlist_items'), { username: 'alice', showId: item.tmdb_id, action: 'mark_episode', episodeId: item.episodeIds[1] }), /Injected status failure/)
    assert.equal((await watchingState(item)).stoppedWatching, true)
    assert.equal((await pool.query('SELECT 1 FROM watched_tv_episodes WHERE user_id = $1 AND tv_episode_id = $2', [alice, item.episodeIds[1]])).rowCount, 0)
  })

  await t.test('watching-status endpoint validates input, authenticates, and persists returned detail state', async () => {
    const app = await createApp(pool)
    const server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    try {
      const item = await show({ watched: 1 })
      await pool.query('UPDATE tv_shows SET detail_hydrated_at = NOW() WHERE id = $1', [item.id])
      const base = `http://127.0.0.1:${server.address().port}/api/tv`
      const headers = { Cookie: sessionCookieFor('alice'), 'Content-Type': 'application/json' }
      const put = (id, body, requestHeaders = headers) => fetch(`${base}/${id}/watching-status`, { method: 'PUT', headers: requestHeaders, body: JSON.stringify(body) })
      assert.equal((await put(item.tmdb_id, { stoppedWatching: true }, { 'Content-Type': 'application/json' })).status, 401)
      for (const body of [{}, { stoppedWatching: 'true' }, { stoppedWatching: null }]) assert.equal((await put(item.tmdb_id, body)).status, 400)
      for (const id of ['invalid', '1.5', '0', '-1', '1trailing']) assert.equal((await put(id, { stoppedWatching: true })).status, 400)
      assert.equal((await put(99999999, { stoppedWatching: true })).status, 404)
      const unstarted = await show({ watched: 0 })
      assert.equal((await put(unstarted.tmdb_id, { stoppedWatching: true })).status, 409)
      for (const stoppedWatching of [true, true, false, false]) {
        const response = await put(item.tmdb_id, { stoppedWatching })
        assert.equal(response.status, 200)
        assert.equal((await response.json()).show.stoppedWatching, stoppedWatching)
        const reopened = await fetch(`${base}/${item.tmdb_id}`, { headers })
        assert.equal(reopened.status, 200)
        assert.equal((await reopened.json()).show.stoppedWatching, stoppedWatching)
      }
      const anonymous = await fetch(`${base}/${item.tmdb_id}`)
      const publicShow = (await anonymous.json()).show
      assert.equal(publicShow.stoppedWatching, false)
      assert.equal(publicShow.canStopWatching, false)
    } finally { await new Promise((resolve) => server.close(resolve)) }
  })

})
