import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFilelistSearchUrl, buildFilelistTvEpisodeQuery, decryptFilelistValue, encryptFilelistValue, mapFilelistResults } from '../filelist.js'
import { getFilelistTvEpisodeTargetForUser, reserveFilelistRequest } from '../database.js'

const encryptionKey = Buffer.alloc(32, 7).toString('base64')

test('Filelist credentials encrypt at rest and decrypt only with the configured key', () => {
  const encrypted = encryptFilelistValue('private-passkey', encryptionKey)
  assert.notEqual(encrypted, 'private-passkey')
  assert.equal(decryptFilelistValue(encrypted, encryptionKey), 'private-passkey')
  assert.throws(() => decryptFilelistValue(encrypted, Buffer.alloc(32, 8).toString('base64')))
})

test('Filelist search URL encodes the title and keeps credentials server-side inputs', () => {
  const url = buildFilelistSearchUrl({ username: 'member', passkey: 'secret', query: 'A Movie & More' })
  assert.equal(url.origin, 'https://filelist.io')
  assert.equal(url.searchParams.get('action'), 'search-torrents')
  assert.equal(url.searchParams.get('type'), 'name')
  assert.equal(url.searchParams.get('query'), 'A Movie & More')
  assert.equal(url.searchParams.get('season'), null)
  assert.equal(url.searchParams.get('episode'), null)
})

test('Filelist TV episode query uses a dotted lowercase title and zero-padded episode reference', () => {
  const query = buildFilelistTvEpisodeQuery('House of the Dragon', 3, 6)
  assert.equal(query, 'house.of.the.dragon.S03E06')
  assert.equal(buildFilelistTvEpisodeQuery('  A  Show!  ', 1, 4), 'a.show!.S01E04')

  const url = buildFilelistSearchUrl({ username: 'member', passkey: 'secret', query })
  assert.equal(url.searchParams.get('query'), 'house.of.the.dragon.S03E06')
  assert.equal(url.searchParams.get('season'), null)
  assert.equal(url.searchParams.get('episode'), null)
})

test('Filelist results are newest-first, projected, and capped at ten', () => {
  const payload = Array.from({ length: 12 }, (_, index) => ({
    name: `Movie ${index}`,
    category: 'Movies 4K',
    upload_date: `2026-07-${String(index + 1).padStart(2, '0')} 10:00:00`,
    download_link: `https://filelist.io/download.php?id=${index}`,
  })).reverse()
  payload.push({ name: 'Incomplete' })
  const results = mapFilelistResults(payload)
  assert.equal(results.length, 10)
  assert.equal(results[0].name, 'Movie 11')
  assert.deepEqual(Object.keys(results[0]).sort(), ['category', 'downloadLink', 'name', 'uploadDate'])
})

test('Filelist request reservation uses an atomic per-user hourly counter', async () => {
  let query = ''
  const allowed = await reserveFilelistRequest({
    async query(sql) { query = sql; return { rows: [{ request_count: 150 }] } },
  }, 42)
  assert.equal(allowed.allowed, true)
  assert.equal(allowed.count, 150)
  assert.match(query, /ON CONFLICT \(user_id, hour_start\) DO UPDATE/i)
  assert.match(query, /request_count < 150/i)

  const rejected = await reserveFilelistRequest({ async query() { return { rows: [] } } }, 42)
  assert.equal(rejected.allowed, false)
  assert.equal(rejected.count, 150)
  assert.ok(rejected.minutesUntilReset >= 1)
})

function createTvTargetPool(episodes) {
  return {
    async query(sql) {
      if (sql.includes('FROM tv_shows')) return { rows: [{ id: 17, tmdb_id: 42, name: 'A Show', genre_names: [] }] }
      if (sql.includes('FROM tv_seasons s')) return { rows: episodes }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

test('Filelist TV target falls back to season 1 episode 1 before watching begins', async () => {
  const target = await getFilelistTvEpisodeTargetForUser(createTvTargetPool([
    { season_number: 1, episode_number: 1, name: 'Pilot', air_date: '2030-01-01', watched: false },
  ]), { showId: 42, username: 'member' })
  assert.equal(target.status, 'ok')
  assert.deepEqual(target.episode, { seasonNumber: 1, episodeNumber: 1, name: 'Pilot', airDate: '2030-01-01', watched: false })
})

test('Filelist TV target uses the next unwatched aired episode and reports caught up', async () => {
  const episodes = [
    { season_number: 3, episode_number: 3, name: 'Three', air_date: '2020-01-01', watched: true },
    { season_number: 3, episode_number: 4, name: 'Four', air_date: '2020-01-08', watched: false },
    { season_number: 3, episode_number: 5, name: 'Future', air_date: '2030-01-01', watched: false },
  ]
  const target = await getFilelistTvEpisodeTargetForUser(createTvTargetPool(episodes), { showId: 42, username: 'member' })
  assert.equal(target.status, 'ok')
  assert.equal(target.episode.episodeNumber, 4)

  const caughtUp = await getFilelistTvEpisodeTargetForUser(createTvTargetPool(episodes.map((episode) => ({ ...episode, watched: episode.episode_number !== 5 }))), { showId: 42, username: 'member' })
  assert.equal(caughtUp.status, 'caught_up')
})
