import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createApp, sessionCookieFor } from './sessionTestHelpers.js'
import { confirmDirectWatchForUser, getDirectWatchEligibility, listDirectWatchLogsForUser } from '../database.js'

const connectionString = process.env.WATCHVAULT_TEST_DATABASE_URL

test('direct shared logging against PostgreSQL', { skip: !connectionString }, async (t) => {
  const schema = `direct_together_${process.pid}_${Date.now()}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA ${schema}`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end() })
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const people = (await pool.query(`INSERT INTO users (username,password,full_name) VALUES
    ('direct_alice','test','Alice'), ('direct_bob','test','Bob') RETURNING id, username`)).rows
  const alice = people.find((u) => u.username === 'direct_alice').id
  const bob = people.find((u) => u.username === 'direct_bob').id
  const pair = (await pool.query('INSERT INTO watch_together_pairs DEFAULT VALUES RETURNING id')).rows[0].id
  await pool.query('INSERT INTO watch_together_pair_members (pair_id,user_id) VALUES ($1,$2),($1,$3)', [pair, alice, bob])
  let seq = 300000
  async function movie() {
    return (await pool.query("INSERT INTO movies (tmdb_id,title,import_rank,raw_payload) VALUES ($1,'Direct movie',1,'{}') RETURNING id,tmdb_id", [++seq])).rows[0]
  }
  async function show() {
    const show = (await pool.query("INSERT INTO tv_shows (tmdb_id,name,import_rank,detail_hydrated_at,raw_payload) VALUES ($1,'Direct show',1,NOW(),'{}') RETURNING id,tmdb_id", [++seq])).rows[0]
    const season = (await pool.query("INSERT INTO tv_seasons (tv_show_id,season_number,name) VALUES ($1,1,'Season 1') RETURNING id", [show.id])).rows[0].id
    show.episodes = []
    for (let n = 1; n <= 4; n++) show.episodes.push((await pool.query(`INSERT INTO tv_episodes (tv_season_id,episode_number,name,air_date,tmdb_id)
      VALUES ($1,$2,'Episode',CURRENT_DATE - 1,$3) RETURNING id`, [season,n,++seq])).rows[0].id)
    return show
  }
  const logMovie = (item, username = 'direct_alice') => confirmDirectWatchForUser(pool, { username, mediaType: 'movie', mediaId: item.tmdb_id, watchService: 'Netflix' })
  const logEpisode = (item, index, username = 'direct_alice') => confirmDirectWatchForUser(pool, { username, mediaType: 'tv', episodeId: item.episodes[index], watchService: 'Netflix' })
  async function watched(item, userId, indices) {
    for (const i of indices) await pool.query('INSERT INTO watched_tv_episodes (user_id,tv_episode_id) VALUES ($1,$2)', [userId,item.episodes[i]])
  }
  const eligibility = (item) => getDirectWatchEligibility(pool, { username: 'direct_alice', mediaType: 'tv', mediaId: item.tmdb_id })
  const count = async (table, column, id) => Number((await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = $1`, [id])).rows[0].n)

  await t.test('movies require both confirmations, retry safely, preserve watched data and Tonight’s Pick', async () => {
    const pick = await movie(); const item = await movie()
    await pool.query("INSERT INTO watch_together_items (pair_id,media_type,media_id,is_selected) VALUES ($1,'movie',$2,TRUE)", [pair,pick.tmdb_id])
    await pool.query('INSERT INTO watchlist_items (user_id,movie_id) VALUES ($1,$2)', [alice,item.id])
    assert.equal((await logMovie(item)).status, 'waiting_for_partner')
    assert.equal(await count('watched_movies','movie_id',item.id), 1)
    assert.equal(await count('watchlist_items','movie_id',item.id), 0)
    assert.equal(await count('watch_together_watched_movies','movie_id',item.id), 0)
    assert.equal((await logMovie(item)).added, false)
    const pending = await listDirectWatchLogsForUser(pool, 'direct_bob')
    assert.equal(pending.some((row) => Number(row.media_id) === item.tmdb_id && row.confirmed_by_partner && !row.confirmed_by_current_user), true)
    assert.equal((await logMovie(item, 'direct_bob')).status, 'completed')
    assert.equal(await count('watched_movies','movie_id',item.id), 2)
    assert.equal(await count('watch_together_watched_movies','movie_id',item.id), 1)
    assert.equal((await logMovie(item, 'direct_bob')).added, false)
    assert.equal((await pool.query('SELECT is_selected FROM watch_together_items WHERE pair_id=$1 AND media_id=$2', [pair,pick.tmdb_id])).rows[0].is_selected, true)
    assert.equal((await pool.query('SELECT watch_service FROM watched_movies WHERE user_id=$1 AND movie_id=$2', [alice,item.id])).rows[0].watch_service, 'Netflix')
  })

  await t.test('rejects movies independently watched by either partner without partial writes', async () => {
    for (const userId of [alice,bob]) {
      const item = await movie()
      await pool.query('INSERT INTO watched_movies (user_id,movie_id) VALUES ($1,$2)', [userId,item.id])
      assert.equal((await logMovie(item)).status, 'already_watched')
      assert.equal(await count('watched_movies','movie_id',item.id), 1)
      assert.equal(await count('watch_together_direct_logs','entity_id',item.id), 0)
    }
  })

  await t.test('TV requires identical histories, including equal-count and skipped-episode cases', async () => {
    for (const [mine,theirs] of [[[0],[]], [[0],[1]], [[0,2],[0,1]]]) {
      const item = await show(); await watched(item,alice,mine); await watched(item,bob,theirs)
      assert.equal((await eligibility(item)).reason, 'progress_mismatch')
      assert.equal((await logEpisode(item,3)).status, 'progress_mismatch')
      assert.equal(await count('watched_tv_episodes','tv_episode_id',item.episodes[3]), 0)
    }
    const item = await show(); await watched(item,alice,[0,2]); await watched(item,bob,[0,2])
    assert.equal((await eligibility(item)).nextEpisodeId, Number(item.episodes[1]))
    assert.equal((await logEpisode(item,3)).status, 'not_next_episode')
    assert.equal((await logEpisode(item,1)).status, 'waiting_for_partner')
  })

  await t.test('pending TV confirmations survive the initiator advancing further', async () => {
    const item = await show()
    assert.equal((await logEpisode(item,0)).status, 'waiting_for_partner')
    await watched(item,alice,[1])
    assert.equal((await eligibility(item)).reason, 'progress_mismatch')
    assert.equal((await logEpisode(item,0,'direct_bob')).status, 'completed')
    assert.equal(await count('watch_together_watched_episodes','tv_episode_id',item.episodes[0]), 1)
    assert.equal((await logEpisode(item,0,'direct_bob')).added, false)
  })

  await t.test('specials and future episodes cannot be logged and missing dates follow existing eligibility', async () => {
    const item = await show()
    await pool.query('UPDATE tv_episodes SET air_date = NULL WHERE id=$1', [item.episodes[0]])
    await pool.query('UPDATE tv_episodes SET air_date = CURRENT_DATE + 30 WHERE id=$1', [item.episodes[1]])
    const specialSeason = (await pool.query("INSERT INTO tv_seasons (tv_show_id,season_number,name) VALUES ($1,0,'Specials') RETURNING id", [item.id])).rows[0].id
    const special = (await pool.query("INSERT INTO tv_episodes (tv_season_id,episode_number,name) VALUES ($1,1,'Special') RETURNING id", [specialSeason])).rows[0].id
    assert.equal((await eligibility(item)).nextEpisodeId, Number(item.episodes[0]))
    assert.equal((await logEpisode(item,1)).status, 'not_next_episode')
    assert.equal((await confirmDirectWatchForUser(pool, { username: 'direct_alice', mediaType:'tv', episodeId:special })).status, 'not_next_episode')
  })

  await t.test('concurrent confirmations and duplicates create one shared history entry', async () => {
    const item = await movie()
    const results = await Promise.all([logMovie(item),logMovie(item,'direct_bob'),logMovie(item)])
    assert.equal(results.filter((r) => r.added).length, 2)
    assert.equal(await count('watched_movies','movie_id',item.id), 2)
    assert.equal(await count('watch_together_watched_movies','movie_id',item.id), 1)
  })

  await t.test('API authenticates, validates input, rejects stale progress and exposes pending confirmations', async () => {
    assert.equal((await fetch(`${base}/api/watch-together/watches`, { method:'POST',headers:{'Content-Type':'application/json'},body:'{}' })).status, 401)
    const headers = { 'Content-Type':'application/json',Cookie:sessionCookieFor('direct_alice') }
    assert.equal((await fetch(`${base}/api/watch-together/watches`, { method:'POST',headers,body:JSON.stringify({mediaType:'tv',episodeId:-1}) })).status, 400)
    const item = await show()
    const before = await fetch(`${base}/api/watch-together/eligibility?mediaType=tv&mediaId=${item.tmdb_id}`, { headers })
    assert.equal((await before.json()).eligible,true)
    await watched(item,bob,[1])
    const stale = await fetch(`${base}/api/watch-together/watches`, {method:'POST',headers,body:JSON.stringify({mediaType:'tv',episodeId:item.episodes[0]})})
    assert.equal(stale.status,409); assert.equal((await stale.json()).reason,'progress_mismatch')
    assert.equal(await count('watched_tv_episodes','tv_episode_id',item.episodes[0]),0)
    const film = await movie()
    const response = await fetch(`${base}/api/watch-together/watches`, {method:'POST',headers,body:JSON.stringify({mediaType:'movie',mediaId:film.tmdb_id})})
    assert.equal(response.status,200); assert.equal((await response.json()).watchTogether.status,'waiting_for_partner')
    const shared = await fetch(`${base}/api/watch-together`, { headers:{Cookie:sessionCookieFor('direct_bob')} })
    assert.equal(shared.status,200)
    assert.equal((await shared.json()).directLogs.some((row) => row.id === film.tmdb_id && row.confirmedByPartner),true)
  })

  await t.test('TV completion uses existing history, achievements, ratings and shared sessions', async () => {
    const item = await show()
    await watched(item,alice,[0,1,2]); await watched(item,bob,[0,1,2])
    await pool.query("UPDATE tv_shows SET detail_payload = '{\"status\":\"Ended\"}' WHERE id=$1", [item.id])
    await pool.query('INSERT INTO tv_watchlist_items (user_id,tv_show_id) VALUES ($1,$3),($2,$3)', [alice,bob,item.id])
    for (const username of ['direct_alice','direct_bob']) {
      const response = await fetch(`${base}/api/watch-together/watches`, { method:'POST',
        headers:{'Content-Type':'application/json',Cookie:sessionCookieFor(username)},
        body:JSON.stringify({mediaType:'tv',episodeId:item.episodes[3],watchService:'Netflix'}) })
      assert.equal(response.status,200)
      const payload = await response.json()
      assert.equal(payload.watchTogether.added,true)
      assert.equal(Array.isArray(payload.newlyUnlockedAchievements),true)
    }
    assert.equal(await count('watched_tv_shows','tv_show_id',item.id),2)
    assert.equal(await count('tv_watchlist_items','tv_show_id',item.id),0)
    await pool.query('INSERT INTO tv_episode_ratings (user_id,tv_episode_id,score) VALUES ($1,$2,4.5)', [alice,item.episodes[3]])
    assert.equal((await logEpisode(item,3)).added,false)
    assert.equal(Number((await pool.query('SELECT score FROM tv_episode_ratings WHERE user_id=$1 AND tv_episode_id=$2', [alice,item.episodes[3]])).rows[0].score),4.5)
    const headers = {'Content-Type':'application/json',Cookie:sessionCookieFor('direct_alice')}
    const state = await (await fetch(`${base}/api/watch-together`, {headers})).json()
    const history = state.watchedEpisodes.find((row) => row.id === item.tmdb_id)
    assert.ok(history)
    assert.equal(state.directLogs.some((row) => row.id === item.tmdb_id),false)
    const session = await fetch(`${base}/api/watch-together/sessions`, {method:'POST',headers,
      body:JSON.stringify({mediaType:'tv',mediaId:item.tmdb_id,episodeId:history.episodeId,details:{notes:'Shared finale'}})})
    assert.equal(session.status,200)
    const updatedState = await (await fetch(`${base}/api/watch-together`, {headers})).json()
    assert.equal(updatedState.watchedEpisodes.find((row) => row.id === item.tmdb_id).sessionDetails.notes,'Shared finale')
  })

  await t.test('a database failure rolls back both personal and shared state', async () => {
    const item = await movie()
    const brokenPool = { connect: async () => {
      const client = await pool.connect()
      return { release: () => client.release(), query: (sql,params) => {
        if (sql.startsWith('INSERT INTO watch_together_direct_logs')) throw new Error('injected write failure')
        return client.query(sql,params)
      } }
    } }
    await assert.rejects(confirmDirectWatchForUser(brokenPool, {username:'direct_alice',mediaType:'movie',mediaId:item.tmdb_id}), /injected write failure/)
    assert.equal(await count('watched_movies','movie_id',item.id),0)
    assert.equal(await count('watch_together_direct_logs','entity_id',item.id),0)
  })

  await t.test('disconnect invalidates pending requests and prevents further personal writes', async () => {
    const item = await movie(); await logMovie(item)
    await pool.query('DELETE FROM watch_together_pairs WHERE id=$1', [pair])
    assert.equal((await logMovie(item,'direct_bob')).status,'no_pair')
    assert.equal(await count('watched_movies','movie_id',item.id),1)
    assert.equal((await listDirectWatchLogsForUser(pool,'direct_bob')).length,0)
  })
})
