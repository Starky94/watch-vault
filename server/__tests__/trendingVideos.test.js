import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTrendingVideoConfig } from '../trendingVideoConfig.js'
import { rankTrendingVideos, classifyVideo } from '../trendingVideoRanking.js'
import { readTrendingVideoCache, reserveYoutubeQuota } from '../trendingVideoRepository.js'
import { synchronizeTrendingVideos } from '../trendingVideoService.js'
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

function fixture({ fail = false, locked = true, cachedChannels = false, previous = [], missing = false, quota = true } = {}) {
  const requests = [], writes = [], calls = []
  let released = false
  const pool = { async connect() { return this }, release() { released = true }, async query(sql, params) {
    calls.push(sql)
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked }] }
    if (sql.includes('SELECT videos')) return { rows: [{ videos: previous, updated_at: new Date(now - 3600_000) }] }
    if (sql.includes('SELECT channel_id')) return { rows: cachedChannels ? [{ channel_id: 'official', uploads_id: 'real-uploads', verified_at: new Date(now) }] : [] }
    if (sql.includes('RETURNING day')) return { rows: quota ? [{}] : [] }
    if (sql.includes('INSERT INTO trending_video_cache')) writes.push(params)
    return { rows: [] }
  } }
  async function fetchImpl(input) {
    const url = new URL(input); requests.push(url)
    if (fail) return { ok: false, status: 403 }
    let items = []
    if (url.pathname.endsWith('/channels')) items = [{ id: 'official', contentDetails: { relatedPlaylists: { uploads: 'real-uploads' } } }]
    if (url.pathname.endsWith('/playlistItems')) items = [{ contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: new Date(now).toISOString() } }]
    if (url.pathname.endsWith('/search')) items = [{ id: { videoId: 'abcdefghijk' } }]
    if (url.pathname.endsWith('/videos')) items = missing && url.searchParams.has('id') ? [] : [video()]
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
