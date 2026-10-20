import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTrendingVideoConfig } from '../trendingVideoConfig.js'
import { rankTrendingVideos, classifyVideo, classifyGameVideo } from '../trendingVideoRanking.js'
import { readTrendingVideoCache, saveTrendingVideoCache, reserveYoutubeQuota } from '../trendingVideoRepository.js'
import { synchronizeTrendingVideos, synchronizeTrendingVideoFeeds } from '../trendingVideoService.js'
import { createApp } from '../app.js'

const now = Date.parse('2026-10-19T12:00:00Z')
const video = (id = 'abcdefghijk', extra = {}) => ({
  id, snippet: { title: `A Movie Official Trailer ${id}`, channelId: 'official', channelTitle: 'Studio', publishedAt: new Date(now - 3600_000).toISOString() },
  statistics: { viewCount: '200000' }, status: { privacyStatus: 'public', uploadStatus: 'processed', embeddable: true }, ...extra,
})
const config = () => ({ ...loadTrendingVideoConfig({ YOUTUBE_API_KEY: 'secret-test-key' }), regions: ['US', 'GB'], handles: ['@Studio'], searchesPerSync: 1 })
const rank = (entries, options = {}) => rankTrendingVideos(entries, { now, trustedChannels: new Set(['official']), ...options })

test('configuration validates limits, deduplicates regions, and allows disabling expensive search', () => {
  assert.deepEqual(loadTrendingVideoConfig({ TRENDING_VIDEO_REGIONS: 'us, GB,US' }).regions, ['US', 'GB'])
  assert.equal(loadTrendingVideoConfig({ TRENDING_VIDEO_DAILY_SEARCH_CALLS: '0' }).dailySearchCalls, 0)
  assert.throws(() => loadTrendingVideoConfig({ TRENDING_VIDEO_REGIONS: 'GLOBAL' }))
  assert.throws(() => loadTrendingVideoConfig({ TRENDING_VIDEO_SYNC_MINUTES: '0' }))
  assert.throws(() => loadTrendingVideoConfig({ TRENDING_VIDEO_DAILY_SEARCH_CALLS: '-1' }))
})

test('filter requires exact TMDB evidence or trusted channel; never trusts Film & Animation or official wording', () => {
  assert.equal(classifyVideo(video(), null, false), null)
  assert.equal(classifyVideo(video(), null, true), 'Trailer')
  assert.equal(classifyVideo(video(), { type: 'Teaser' }, false), 'Teaser')
  for (const title of ['Movie fan-made trailer', 'Trailer reaction', 'Gaming official trailer', 'Movie Concept Trailer', 'Official Music Video']) {
    assert.equal(classifyVideo(video('abcdefghijk', { snippet: { title } }), { type: 'Trailer' }, true), null)
  }
})

test('classifies promotional material without labeling it all as trailers', () => {
  for (const [title, expected] of [['Movie behind the scenes', 'Behind the Scenes'], ['Director interview', 'Interview'], ['First look announcement', 'Promotional Clip'], ['Movie featurette', 'Featurette']]) {
    assert.equal(classifyVideo(video('abcdefghijk', { snippet: { title } }), null, true), expected)
  }
})

test('ranking rejects private, unprocessed, upcoming, malformed and unrelated candidates', () => {
  const invalid = [video('bad'), video('abcdefghijk', { status: { privacyStatus: 'private' } }), video('abcdefghijk', { status: { privacyStatus: 'public', uploadStatus: 'uploaded' } }), video('abcdefghijk', { snippet: { ...video().snippet, liveBroadcastContent: 'upcoming' } }), video('abcdefghijk', { snippet: { ...video().snippet, publishedAt: 'invalid' } })]
  assert.deepEqual(rank(invalid.map((entry) => ({ video: entry }))), [])
})

test('measured engagement allows older videos with renewed popularity and supplies RISING badge', () => {
  const oldVideo = video('abcdefghijk', { snippet: { ...video().snippet, publishedAt: new Date(now - 20 * 86400_000).toISOString() } })
  assert.equal(rank([{ video: oldVideo }]).length, 0)
  const options = { previous: [{ id: oldVideo.id, views: 190000 }], previousAt: new Date(now - 3600_000) }
  assert.equal(rank([{ video: oldVideo }], options)[0].badge, 'RISING')
  assert.equal(rank([{ video: oldVideo, regions: ['JP'] }]).length, 1)
})

test('scores use view growth and deterministic ties; hidden counts stay unknown', () => {
  const first = video('abcdefghij1'), second = video('abcdefghij2')
  const result = rank([{ video: first }, { video: second }], { previous: [{ id: first.id, views: 199999 }, { id: second.id, views: 100000 }], previousAt: new Date(now - 3600_000) })
  assert.equal(result[0].id, second.id)
  assert.equal(rank([{ video: video('abcdefghij3', { statistics: {} }) }])[0].views, null)
})

test('merged region sets produce finite scores and rank engagement ahead of identifier order', () => {
  const result = rank([
    { video: video('aaaaaaaaaaa', { statistics: { viewCount: '100' } }), regions: new Set(['US']) },
    { video: video('zzzzzzzzzzz', { statistics: { viewCount: '10000000' } }), regions: new Set(['US', 'GB']) },
  ])
  assert.equal(result[0].id, 'zzzzzzzzzzz')
  assert.ok(result.every((entry) => Number.isFinite(entry.score)))
  assert.deepEqual(result[0].regions, ['GB', 'US'])
})

test('ranking prefers channel, title, and regional diversity, backfills narrow pools, and deduplicates copies', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({ video: video(`abcdefgh${String(i).padStart(3, '0')}`, { snippet: { ...video().snippet, title: `Movie ${i} Trailer`, channelId: i < 12 ? 'official' : `studio${i}` } }), regions: [i < 12 ? 'US' : 'JP'] }))
  const trustedChannels = new Set(entries.map((entry) => entry.video.snippet.channelId))
  const result = rank(entries, { trustedChannels, limit: 12 })
  assert.equal(result.length, 12)
  assert.ok(result.slice(0, 6).filter((entry) => entry.channelId === 'official').length <= 2)
  assert.equal(rank(entries.slice(0, 12), { limit: 12 }).length, 12)
  assert.equal(rank([{ video: video() }, { video: { ...video(), id: 'abcdefghij2' } }]).length, 1)
})

test('cache indicates staleness and does not serve metadata older than thirty days', async () => {
  const pool = { query: async () => ({ rows: [{ videos: [{ id: 'a' }], updated_at: new Date(now - 7 * 3600_000) }] }) }
  assert.equal((await readTrendingVideoCache(pool, now)).stale, true)
  assert.equal((await readTrendingVideoCache(pool, now)).videos.length, 1)
  assert.equal((await readTrendingVideoCache(pool, now + 31 * 86400_000)).videos.length, 0)
})

test('quota is reserved atomically using Pacific calendar dates and daily search and unit limits', async () => {
  let values
  const pool = { query: async (sql, params) => { values = params; assert.match(sql, /ON CONFLICT/); assert.match(sql, /WHERE trending_video_quota.units/); return { rows: [] } } }
  assert.equal(await reserveYoutubeQuota(pool, config(), true, Date.parse('2026-10-19T02:00:00Z')), false)
  assert.deepEqual(values, ['2026-10-18', 100, 1, 8000, 24])
})

function fixture({ fail = false, locked = true, cachedChannels = false, previous = [], missing = false, quota = true, games = false, privateVideo = false } = {}) {
  const requests = [], writes = [], calls = []
  let released = false
  const pool = { async connect() { return this }, release() { released = true }, async query(sql, params) {
    calls.push(sql)
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked }] }
    if (sql.includes('SELECT videos')) return { rows: [{ videos: previous, updated_at: new Date(now - 3600_000) }] }
    if (sql.includes('SELECT channel_id')) return { rows: cachedChannels ? [{ channel_id: 'official', uploads_id: 'real-uploads', verified_at: new Date(now) }] : [] }
    if (sql.includes('RETURNING day')) return { rows: quota ? [{}] : [] }
    if (sql.includes('INSERT INTO trending_video_cache') || sql.includes('INSERT INTO trending_game_video_cache')) writes.push(params)
    return { rows: [] }
  } }
  async function fetchImpl(input) {
    const url = new URL(input); requests.push(url)
    if (fail) return { ok: false, status: 403 }
    let items = []
    if (url.pathname.endsWith('/channels')) items = [{ id: 'official', contentDetails: { relatedPlaylists: { uploads: 'real-uploads' } } }]
    if (url.pathname.endsWith('/playlistItems')) items = [{ contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: new Date(now).toISOString() } }]
    if (url.pathname.endsWith('/search')) items = [{ id: { videoId: 'abcdefghijk' } }]
    if (url.pathname.endsWith('/videos')) items = missing && url.searchParams.has('id') ? [] : [video('abcdefghijk', { ...(games ? { snippet: { ...video().snippet, title: 'Adventure Official Gameplay Trailer' } } : {}), ...(privateVideo ? { status: { privacyStatus: 'private' } } : {}) })]
    return { ok: true, json: async () => ({ items }) }
  }
  return { pool, fetchImpl, requests, writes, calls, released: () => released }
}

test('sync merges regions and sources by exact video ID, verifies channels and batches statistics', async () => {
  const f = fixture()
  const result = await synchronizeTrendingVideos(f.pool, { config: config(), fetchImpl: f.fetchImpl, now })
  assert.equal(result.count, 1)
  const [entry] = JSON.parse(f.writes[0][0])
  assert.deepEqual(entry.regions, ['GB', 'US'])
  assert.deepEqual(entry.sources, ['most-popular', 'official-channel', 'search'])
  assert.equal(f.requests.filter((url) => url.searchParams.has('id')).length, 1)
  assert.equal(f.requests.find((url) => url.pathname.endsWith('/channels')).searchParams.get('forHandle'), '@Studio')
  assert.ok(f.calls.some((sql) => sql.includes('INSERT INTO trending_video_channels')))
  assert.ok(f.calls.some((sql) => sql.includes('pg_advisory_unlock')))
  assert.equal(f.released(), true)
})

test('resolved channel uploads are reused without channel lookups or history pagination', async () => {
  const f = fixture({ cachedChannels: true })
  await synchronizeTrendingVideos(f.pool, { config: config(), fetchImpl: f.fetchImpl, now })
  assert.ok(!f.requests.some((url) => url.pathname.endsWith('/channels')))
  assert.equal(f.requests.filter((url) => url.pathname.endsWith('/playlistItems')).length, 1)
  assert.ok(!f.requests.some((url) => url.searchParams.has('pageToken')))
})

test('sync removes deleted videos from cache after successful batch revalidation', async () => {
  const f = fixture({ missing: true, previous: [{ id: 'abcdefghijk', views: 100 }] })
  const result = await synchronizeTrendingVideos(f.pool, { config: config(), fetchImpl: f.fetchImpl, now })
  assert.equal(result.count, 0)
  assert.deepEqual(JSON.parse(f.writes[0][0]), [])
})

test('upstream errors and exhausted budgets retain previous cache, avoid leaking keys, and release the lock', async () => {
  for (const options of [{ fail: true }, { quota: false }]) {
    const f = fixture(options)
    await assert.rejects(synchronizeTrendingVideos(f.pool, { config: config(), fetchImpl: f.fetchImpl, now }), /keeping the previous cache/)
    assert.equal(f.writes.length, 0)
    assert.equal(f.released(), true)
    assert.ok(f.requests.length <= 1)
  }
})

test('concurrent synchronization and missing configuration make no upstream calls', async () => {
  const f = fixture({ locked: false })
  assert.ok((await synchronizeTrendingVideos(f.pool, { config: config(), fetchImpl: f.fetchImpl, now })).skipped)
  assert.equal(f.requests.length, 0)
  assert.equal(f.released(), true)
  const absent = fixture()
  assert.ok((await synchronizeTrendingVideos(absent.pool, { config: { ...config(), apiKey: '' }, now })).skipped)
  assert.equal(absent.calls.length, 0)
})

test('TMDB movie and TV videos associate by exact YouTube IDs and survive search failure', async () => {
  const f = fixture({ cachedChannels: true })
  const fetchImpl = async (input, options) => {
    const url = new URL(input)
    if (url.hostname === 'tmdb.test') {
      if (url.pathname.includes('/videos')) return { ok: true, json: async () => ({ results: [{ key: 'abcdefghijk', site: 'YouTube', type: 'Trailer', official: true }] }) }
      return { ok: true, json: async () => ({ results: [{ id: 123, title: 'Known movie', name: 'Known show' }] }) }
    }
    if (url.pathname.endsWith('/search')) return { ok: false, status: 500 }
    return f.fetchImpl(input, options)
  }
  const result = await synchronizeTrendingVideos(f.pool, { config: config(), token: 'tmdb-token', baseUrl: 'https://tmdb.test/3/', fetchImpl, now })
  assert.equal(result.count, 1)
  assert.deepEqual(result.failures, ['search'])
  assert.equal(JSON.parse(f.writes[0][0])[0].media.id, 123)
})

test('public API serves twelve cached videos or sixty for See all without live API calls', async () => {
  const videos = Array.from({ length: 65 }, (_, id) => ({ id: String(id) }))
  const pool = { async query(sql) { return { rows: sql.includes('SELECT videos') ? [{ videos, updated_at: new Date() }] : [], rowCount: 0 } } }
  const app = await createApp(pool, { initializeAuthSchema: async () => {}, loadRuntimeConfig: () => { throw new Error('Must not call providers') } })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/videos/trending`
    const response = await fetch(base)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60')
    assert.equal((await response.json()).videos.length, 12)
    assert.equal((await (await fetch(`${base}?limit=60`)).json()).videos.length, 60)
    assert.equal((await (await fetch(`${base}?limit=99999`)).json()).videos.length, 12)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})


const gameConfig = () => ({ ...config(), feed: 'games', searchesPerSync: 0 })
const gameRank = (entries, options = {}) => rank(entries, { ...options, classify: classifyGameVideo })
const gameVideo = (title = 'Adventure Official Gameplay Trailer', extra = {}) => video('abcdefghijk', { snippet: { ...video().snippet, title }, ...extra })

test('game configuration resolves independent official handles and disables searches', () => {
  const games = loadTrendingVideoConfig({ YOUTUBE_API_KEY: 'key', TRENDING_VIDEO_SEARCHES_PER_SYNC: '7' }, 'games')
  assert.deepEqual(games.handles, ['@PlayStation', '@Xbox', '@NintendoAmerica', '@Ubisoft', '@EA'])
  assert.equal(games.searchesPerSync, 0)
  const custom = loadTrendingVideoConfig({ TRENDING_GAME_VIDEO_CHANNEL_HANDLES: '@Studio,@Studio,@Other', TRENDING_VIDEO_CHANNEL_HANDLES: '@MovieStudio' }, 'games')
  assert.deepEqual(custom.handles, ['@Studio', '@Other'])
  assert.throws(() => loadTrendingVideoConfig({ TRENDING_GAME_VIDEO_CHANNEL_HANDLES: 'invalid' }, 'games'))
  assert.throws(() => loadTrendingVideoConfig({}, 'unknown'))
  assert.equal(games.dailyUnits, loadTrendingVideoConfig({}).dailyUnits)
})

test('game classifier accepts trusted trailers and teasers, excluding unrelated videos and live broadcasts', () => {
  for (const [title, category] of [['Adventure Official Trailer', 'Trailer'], ['Adventure Gameplay Trailer', 'Trailer'], ['Adventure Launch Trailer', 'Trailer'], ['Adventure Announcement Teaser', 'Teaser']]) {
    assert.equal(classifyGameVideo(gameVideo(title), null, true), category)
    assert.equal(classifyGameVideo(gameVideo(title), null, false), null)
  }
  for (const title of ['Adventure Gameplay', 'Adventure Walkthrough Trailer', 'Adventure Trailer Reaction', 'Adventure fan-made trailer', 'Adventure Concept Trailer', 'Adventure AI Trailer', 'Adventure Trailer Livestream', 'Adventure Music Video Trailer', 'Adventure Movie Trailer', 'Adventure TV Series Trailer', 'New Controller Trailer', 'Studio Interview', 'Adventure Behind the Scenes']) {
    assert.equal(classifyGameVideo(gameVideo(title), null, true), null, title)
  }
  for (const liveBroadcastContent of ['upcoming', 'live']) {
    assert.equal(classifyGameVideo(gameVideo('Adventure Trailer', { snippet: { ...gameVideo().snippet, liveBroadcastContent } }), null, true), null)
  }
  assert.equal(classifyVideo(gameVideo(), null, true), null)
})

test('game ranking preserves badges, engagement ordering, diversity and deduplication without associations', () => {
  const entries = Array.from({ length: 15 }, (_, i) => ({ video: gameVideo(`Game ${i} Trailer`, { id: `abcdefgh${String(i).padStart(3, '0')}`, snippet: { ...gameVideo().snippet, title: `Game ${i} Trailer`, channelId: i < 10 ? 'official' : `studio${i}` } }), regions: ['US', 'GB'] }))
  const trustedChannels = new Set(entries.map((entry) => entry.video.snippet.channelId))
  const result = gameRank(entries, { trustedChannels, limit: 12 })
  assert.equal(result.length, 12)
  assert.ok(result.slice(0, 6).filter((entry) => entry.channelId === 'official').length <= 2)
  assert.ok(result.every((entry) => entry.badge === 'NEW' && entry.media === null))
  assert.equal(gameRank([{ video: gameVideo() }, { video: gameVideo(undefined, { id: 'abcdefghij2' }) }]).length, 1)
  const ranked = gameRank(entries.slice(0, 2), { previous: [{ id: entries[0].video.id, views: 199999 }, { id: entries[1].video.id, views: 100000 }], previousAt: new Date(now - 3600_000) })
  assert.equal(ranked[0].id, entries[1].video.id)
})

test('game cache writes and expiry are isolated from homepage data', async () => {
  const snapshots = new Map([
    ['trending_video_cache', { videos: [{ id: 'movie' }], updated_at: new Date(now) }],
    ['trending_game_video_cache', { videos: [{ id: 'game' }], updated_at: new Date(now - 7 * 3600_000) }],
  ])
  const pool = { async query(sql, values) {
    const table = sql.includes('trending_game_video_cache') ? 'trending_game_video_cache' : 'trending_video_cache'
    if (sql.startsWith('INSERT')) snapshots.set(table, { videos: JSON.parse(values[0]), updated_at: values[1] })
    return { rows: [snapshots.get(table)] }
  } }
  assert.equal((await readTrendingVideoCache(pool, now, 'games')).stale, true)
  assert.deepEqual((await readTrendingVideoCache(pool, now, 'games')).videos, [{ id: 'game' }])
  assert.deepEqual((await readTrendingVideoCache(pool, now + 31 * 86400_000, 'games')).videos, [])
  await saveTrendingVideoCache(pool, [{ id: 'new-game' }], {}, now, 'games')
  assert.deepEqual((await readTrendingVideoCache(pool, now)).videos, [{ id: 'movie' }])
  assert.deepEqual((await readTrendingVideoCache(pool, now, 'games')).videos, [{ id: 'new-game' }])
  await assert.rejects(readTrendingVideoCache(pool, now, 'invalid'), /Invalid/)
})

test('game sync uses Gaming charts and official uploads without searches or TMDB; writes only game cache', async () => {
  const f = fixture({ games: true })
  const lockValues = []
  const originalQuery = f.pool.query
  f.pool.query = async (sql, values) => {
    if (sql.includes('advisory')) lockValues.push(values[0])
    return originalQuery(sql, values)
  }
  const result = await synchronizeTrendingVideos(f.pool, { config: { ...gameConfig(), searchesPerSync: 7 }, token: 'unused-tmdb', fetchImpl: f.fetchImpl, now })
  assert.equal(result.count, 1)
  assert.ok(f.requests.every((url) => url.hostname === 'www.googleapis.com' && !url.pathname.endsWith('/search')))
  assert.ok(f.requests.filter((url) => url.searchParams.has('chart')).every((url) => url.searchParams.get('videoCategoryId') === '20'))
  assert.deepEqual(lockValues, [874216904, 874216904])
  assert.ok(f.calls.some((sql) => sql.includes('INSERT INTO trending_game_video_cache')))
  assert.ok(!f.calls.some((sql) => sql.includes('INSERT INTO trending_video_cache')))
  const [entry] = JSON.parse(f.writes[0][0])
  assert.equal(entry.media, null)
  assert.deepEqual(entry.sources, ['most-popular', 'official-channel'])
})

test('game sync removes missing/private videos and retains cache after quota or upstream failures', async () => {
  for (const options of [{ missing: true }, { privateVideo: true }]) {
    const f = fixture({ ...options, games: true, previous: [{ id: 'abcdefghijk', views: 100 }] })
    assert.equal((await synchronizeTrendingVideos(f.pool, { config: gameConfig(), fetchImpl: f.fetchImpl, now })).count, 0)
    assert.deepEqual(JSON.parse(f.writes[0][0]), [])
  }
  for (const options of [{ fail: true }, { quota: false }]) {
    const f = fixture({ ...options, games: true })
    await assert.rejects(synchronizeTrendingVideos(f.pool, { config: gameConfig(), fetchImpl: f.fetchImpl, now }), /keeping the previous cache/)
    assert.equal(f.writes.length, 0)
    assert.ok(f.released())
  }
})

test('both feeds reserve against the same daily quota budget', async () => {
  let used = 0
  const pool = { async query(sql, values) {
    assert.match(sql, /INSERT INTO trending_video_quota/)
    if (used + values[1] > values[3]) return { rows: [] }
    used += values[1]
    return { rows: [{ day: values[0] }] }
  } }
  assert.equal(await reserveYoutubeQuota(pool, { ...config(), dailyUnits: 1 }, false, now), true)
  assert.equal(await reserveYoutubeQuota(pool, { ...gameConfig(), dailyUnits: 1 }, false, now), false)
})

test('worker orchestration refreshes either feed even if the other fails', async () => {
  for (const brokenFeed of ['movies', 'games']) {
    const f = fixture({ games: brokenFeed === 'movies' })
    const configs = [config(), gameConfig()].map((entry) => entry.feed === brokenFeed ? { ...entry, handles: ['@Broken'] } : entry)
    const fetchImpl = async (input) => {
      const url = new URL(input)
      const broken = url.searchParams.get('forHandle') === '@Broken' || (url.searchParams.has('chart') && url.searchParams.get('videoCategoryId') === (brokenFeed === 'games' ? '20' : '1')) || (brokenFeed === 'movies' && url.pathname.endsWith('/search'))
      return broken ? { ok: false, status: 403 } : f.fetchImpl(input)
    }
    const outcomes = await synchronizeTrendingVideoFeeds(f.pool, { configs, fetchImpl, now })
    assert.ok(outcomes.find((entry) => entry.feed === brokenFeed).error)
    assert.equal(outcomes.find((entry) => entry.feed !== brokenFeed).result.count, 1)
    assert.equal(f.writes.length, 1)
  }
})

test('game API serves its independent cached feed, limits, stale flag and total without providers', async () => {
  const videos = Array.from({ length: 65 }, (_, id) => ({ id: `game-${id}` }))
  const pool = { async query(sql) { return { rows: sql.includes('SELECT videos') ? [{ videos: sql.includes('trending_game_video_cache') ? videos : [{ id: 'movie' }], updated_at: new Date(Date.now() - 7 * 3600_000) }] : [], rowCount: 0 } } }
  const app = await createApp(pool, { initializeAuthSchema: async () => {}, loadRuntimeConfig: () => { throw new Error('Must not call providers') } })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const response = await fetch(`${base}/api/games/videos/trending`)
    const feed = await response.json()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60')
    assert.equal(feed.videos.length, 12)
    assert.equal(feed.videos[0].id, 'game-0')
    assert.equal(feed.total, 65)
    assert.equal(feed.stale, true)
    for (const [query, count] of [['60', 60], ['0', 12], ['99999', 12], ['abc', 12]]) {
      assert.equal((await (await fetch(`${base}/api/games/videos/trending?limit=${query}`)).json()).videos.length, count)
    }
    assert.deepEqual((await (await fetch(`${base}/api/videos/trending`)).json()).videos, [{ id: 'movie' }])
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('partial game statistics refresh preserves the entire previous snapshot', async () => {
  const previous = Array.from({ length: 51 }, (_, i) => ({ id: `abcdefgh${String(i).padStart(3, '0')}`, views: 100 }))
  const f = fixture({ games: true, previous })
  let batches = 0
  const fetchImpl = async (input) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/videos') && url.searchParams.has('id') && ++batches === 2) return { ok: false, status: 500 }
    return f.fetchImpl(input)
  }
  await assert.rejects(synchronizeTrendingVideos(f.pool, { config: gameConfig(), fetchImpl, now }), /Incomplete YouTube statistics refresh/)
  assert.equal(f.writes.length, 0)
  assert.ok(f.released())
})

test('game sync skips without a key or when its synchronization lock is held', async () => {
  const absent = fixture({ games: true })
  assert.ok((await synchronizeTrendingVideos(absent.pool, { config: { ...gameConfig(), apiKey: '' }, fetchImpl: absent.fetchImpl, now })).skipped)
  assert.equal(absent.calls.length, 0)
  const busy = fixture({ games: true, locked: false })
  assert.ok((await synchronizeTrendingVideos(busy.pool, { config: gameConfig(), fetchImpl: busy.fetchImpl, now })).skipped)
  assert.equal(busy.requests.length, 0)
  assert.ok(busy.released())
})
