import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { sessionCookieFor } from './sessionTestHelpers.js'

async function listen(app) {
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  return { server, base: `http://127.0.0.1:${server.address().port}` }
}

test('completion sort requires a session and sorts personal progress before pagination', async () => {
  const calls = []
  const pool = { async query(sql, params) {
    calls.push({ sql, params })
    return { rows: [], rowCount: 0 }
  } }
  const app = await createApp(pool, {
    initializeAuthSchema: async () => {},
    resolveSession: async () => ({ username: 'alice' }),
    loadRuntimeConfig: () => { throw new Error('Completion sorting must not hydrate movies') },
  })
  const { server, base } = await listen(app)
  try {
    calls.length = 0
    const url = `${base}/api/movies/collections?sort=completion&page=2&limit=10&q=%20Matrix%20`
    assert.equal((await fetch(url)).status, 401)
    assert.equal(calls.length, 0)
    const response = await fetch(url, { headers: { cookie: sessionCookieFor('alice') } })
    assert.equal(response.status, 200)
    assert.deepEqual((await response.json()).pagination, { page: 2, pageSize: 10, hasNextPage: false, hasPreviousPage: true })
    assert.equal(calls.length, 1)
    const { sql, params } = calls[0]
    assert.deepEqual(params, [11, 10, 'Matrix', 'alice'])
    assert.match(sql, /COUNT\(\*\)::numeric/)
    assert.match(sql, /WHERE users.username = \$4 AND movies.tmdb_id = \(member->>'id'\)::integer/)
    assert.match(sql, /NULLIF\(jsonb_array_length\(parts\), 0\), 0\) AS completion_progress/)
    assert.match(sql, /ORDER BY completion_progress DESC NULLS LAST, name ASC, tmdb_id ASC LIMIT \$1 OFFSET \$2/)
    assert.doesNotMatch(sql, /ROUND\(/)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('hide watched requires a session and filters fully completed collections before pagination for every sort', async () => {
  const calls = []
  const pool = { async query(sql, params) {
    calls.push({ sql, params })
    return { rows: [], rowCount: 0 }
  } }
  const app = await createApp(pool, {
    initializeAuthSchema: async () => {},
    resolveSession: async () => ({ username: 'alice' }),
  })
  const { server, base } = await listen(app)
  try {
    calls.length = 0
    assert.equal((await fetch(`${base}/api/movies/collections?hideWatched=true`)).status, 401)
    assert.equal(calls.length, 0)
    for (const [sort, column] of [['popularity', 'popularity'], ['rating', 'average_rating'], ['completion', 'completion_progress']]) {
      const response = await fetch(`${base}/api/movies/collections?hideWatched=true&sort=${sort}&page=2&q=Matrix`, { headers: { cookie: sessionCookieFor('alice') } })
      assert.equal(response.status, 200)
      assert.equal((await response.json()).pagination.page, 2)
      const { sql, params } = calls.at(-1)
      assert.deepEqual(params, [31, 30, 'Matrix', 'alice'])
      assert.match(sql, /AND COALESCE\(\(SELECT COUNT\(\*\)::numeric/)
      assert.match(sql, /WHERE users.username = \$4 AND movies.tmdb_id = \(member->>'id'\)::integer/)
      assert.match(sql, /NULLIF\(jsonb_array_length\(parts\), 0\), 0\) < 1\s+ORDER BY/)
      assert.ok(sql.includes(`ORDER BY ${column} DESC NULLS LAST`))
      assert.doesNotMatch(sql, /ROUND\(/)
    }
    await fetch(`${base}/api/movies/collections?hideWatched=false`)
    assert.deepEqual(calls.at(-1).params, [31, 0, ''])
    assert.doesNotMatch(calls.at(-1).sql, /FROM watched_movies/)
  } finally { await new Promise((resolve) => server.close(resolve)) }
})

test('collection list/detail use only stored summaries; movie hydration occurs on opening a member', async () => {
  const calls = []
  const members = [{ id: 900, title: 'Member', release_date: '2020-01-01' }]
  let storedMovie = null
  let hydrationCount = 0
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM movie_collections')) {
        if (sql.includes('WHERE tmdb_id')) return { rows: params[0] === 1 ? [{ id: 1, name: 'Example', parts: members }] : [] }
        return { rows: Array.from({ length: 31 }, (_, i) => ({ id: i + 1, name: `Collection ${i}`, movie_count: 1, movie_ids: [900] })) }
      }
      if (sql.includes('WHERE movies.tmdb_id = $1')) return { rows: storedMovie ? [storedMovie] : [] }
      if (sql.includes('FROM movie_cast')) return { rows: [{ credit_type: 'director', tmdb_person_id: 12, name: 'Director' }] }
      return { rows: [], rowCount: 0 }
    },
  }
  const app = await createApp(pool, {
    initializeAuthSchema: async () => {},
    loadRuntimeConfig: () => { throw new Error('No TMDB access while browsing collections') },
    hydrateMovie: async (_pool, { movieId }) => {
      hydrationCount++
      assert.equal(movieId, 900)
      storedMovie = { id: 100, tmdb_id: movieId, title: 'Member', detail_payload: { id: movieId }, runtime_minutes: 100, certification: 'PG', genre_names: [], vote_count: 1, vote_average: 7 }
    },
  })
  const { server, base } = await listen(app)
  try {
    calls.length = 0
    let response = await fetch(`${base}/api/movies/collections?page=2`)
    assert.equal(response.status, 200)
    const listing = await response.json()
    assert.equal(listing.collections.length, 30)
    assert.deepEqual(listing.collections[0].movie_ids, [900])
    assert.match(calls.at(-1).sql, /ARRAY\(SELECT \(member->>'id'\)::integer FROM jsonb_array_elements\(parts\) AS member\) AS movie_ids/)
    assert.match(calls.at(-1).sql, /ORDER BY popularity DESC NULLS LAST/)
    assert.equal(listing.pagination.hasNextPage, true)
    assert.equal(listing.pagination.hasPreviousPage, true)
    assert.deepEqual(calls.at(-1).params, [31, 30, ''])
    response = await fetch(`${base}/api/movies/collections?q=%20Matrix%20&page=1`)
    assert.equal(response.status, 200)
    assert.deepEqual(calls.at(-1).params, [31, 0, 'Matrix'])
    response = await fetch(`${base}/api/movies/collections?sort=popularity&q=Matrix`)
    assert.equal(response.status, 200)
    assert.match(calls.at(-1).sql, /ORDER BY popularity DESC NULLS LAST/)
    assert.deepEqual(calls.at(-1).params, [31, 0, 'Matrix'])
    response = await fetch(`${base}/api/movies/collections?sort=rating`)
    assert.equal(response.status, 200)
    assert.match(calls.at(-1).sql, /ORDER BY average_rating DESC NULLS LAST/)
    response = await fetch(`${base}/api/movies/collections/1`)
    assert.deepEqual((await response.json()).collection.parts, members)
    assert.equal(hydrationCount, 0)
    assert.equal(storedMovie, null)
    assert.ok(calls.every(({ sql }) => sql.includes('FROM movie_collections')))
    assert.equal((await fetch(`${base}/api/movies/collections/999`)).status, 404)
    assert.equal((await fetch(`${base}/api/movies/collections/nope`)).status, 400)
    assert.equal((await fetch(`${base}/api/movies/collections/0`)).status, 400)
  } finally { await new Promise((resolve) => server.close(resolve)) }

  // Opening the member enters the existing detail endpoint and hydrates only then.
  const detailApp = await createApp(pool, {
    initializeAuthSchema: async () => {},
    loadRuntimeConfig: () => ({ token: 'test', tmdbBaseUrl: 'https://example.test', tmdbBearerToken: 'test' }),
    hydrateMovie: async (_pool, { movieId }) => {
      hydrationCount++
      storedMovie = { id: 100, tmdb_id: movieId, title: 'Member', detail_payload: { id: movieId }, runtime_minutes: 100, certification: 'PG', genre_names: [], vote_count: 1, vote_average: 7 }
    },
  })
  const originalFetch = global.fetch
  global.fetch = async (url, options) => String(url).startsWith('https://example.test') ? Response.json({ results: [] }) : originalFetch(url, options)
  const detail = await listen(detailApp)
  try {
    const response = await originalFetch(`${detail.base}/api/movies/900`)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).movie.title, 'Member')
    assert.equal(hydrationCount, 1)
    assert.equal(storedMovie.tmdb_id, 900)
    assert.equal((await originalFetch(`${detail.base}/api/movies/900`)).status, 200)
    assert.equal(hydrationCount, 1)
  } finally {
    global.fetch = originalFetch
    await new Promise((resolve) => detail.server.close(resolve))
  }
})
