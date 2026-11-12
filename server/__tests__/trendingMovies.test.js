import test from 'node:test'
import assert from 'node:assert/strict'
import { createTrendingMovieFeed } from '../trendingMovieService.js'

const config = () => ({ tmdbBearerToken: 'token', tmdbBaseUrl: 'https://tmdb.test/3' })
const previews = [
  { id: 50, title: 'First', popularity: 2, vote_average: 7.5, release_date: '2026-01-01', poster_path: '/first.jpg' },
  { id: 12, title: 'Second', popularity: 100 },
]

test('daily trending preserves chart order, maps previews, and caches for ten minutes', async () => {
  let time = 0
  let calls = 0
  const load = createTrendingMovieFeed({
    now: () => time,
    loadRuntimeConfig: config,
    fetchImpl: async (url, options) => {
      calls++
      assert.equal(String(url), 'https://tmdb.test/3/trending/movie/day')
      assert.equal(options.headers.Authorization, 'Bearer token')
      return { ok: true, json: async () => ({ results: previews }) }
    },
  })
  const result = await load()
  assert.deepEqual(result.movies.map((movie) => movie.tmdb_id), [50, 12])
  assert.equal(result.movies[0].vote_average, 7.5)
  assert.equal(result.movies[0].poster_path, '/first.jpg')
  assert.equal(result.movies[1].poster_path, null)
  assert.equal(result.movies[1].release_date, null)
  time = 599999
  assert.strictEqual(await load(), result)
  assert.equal(calls, 1)
  time = 600000
  await load()
  assert.equal(calls, 2)
})

test('concurrent callers share the in-flight TMDB request', async () => {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  let calls = 0
  const load = createTrendingMovieFeed({ loadRuntimeConfig: config, fetchImpl: async () => {
    calls++
    await gate
    return { ok: true, json: async () => ({ results: previews }) }
  } })
  const first = load()
  const second = load()
  release()
  const [a, b] = await Promise.all([first, second])
  assert.strictEqual(a, b)
  assert.equal(calls, 1)
})

test('failed or malformed responses are not cached; empty successful results are cached', async () => {
  let calls = 0
  const load = createTrendingMovieFeed({ loadRuntimeConfig: config, fetchImpl: async () => {
    calls++
    if (calls === 1) return { ok: false, status: 503, text: async () => 'Unavailable' }
    return { ok: true, json: async () => calls === 2 ? {} : { results: [] } }
  } })
  await assert.rejects(load(), /503/)
  await assert.rejects(load(), /Invalid TMDB/)
  assert.deepEqual(await load(), { movies: [] })
  assert.deepEqual(await load(), { movies: [] })
  assert.equal(calls, 3)
})

test('an expired cache does not hide failures or prevent the next retry', async () => {
  let time = 0
  let calls = 0
  const load = createTrendingMovieFeed({ now: () => time, loadRuntimeConfig: config, fetchImpl: async () => {
    calls++
    if (calls === 2) throw new Error('offline')
    return { ok: true, json: async () => ({ results: previews }) }
  } })
  await load()
  time = 600000
  await assert.rejects(load(), /offline/)
  await load()
  assert.equal(calls, 3)
})
