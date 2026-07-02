import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchPopularMoviesPage,
  fetchUpcomingMoviesPage,
  getTmdbRateLimitConfig,
  resetTmdbRateLimiterForTests,
} from '../tmdbClient.js'

test('TMDB client rate limiter spaces burst requests below the configured ceiling', async () => {
  resetTmdbRateLimiterForTests()

  const startedAt = []
  const fetchImpl = async () => {
    startedAt.push(Date.now())
    return {
      ok: true,
      async json() {
        return { results: [] }
      },
    }
  }

  await Promise.all([
    fetchPopularMoviesPage(fetchImpl, { token: 'token', baseUrl: 'https://api.themoviedb.org/3', page: 1 }),
    fetchPopularMoviesPage(fetchImpl, { token: 'token', baseUrl: 'https://api.themoviedb.org/3', page: 2 }),
    fetchPopularMoviesPage(fetchImpl, { token: 'token', baseUrl: 'https://api.themoviedb.org/3', page: 3 }),
  ])

  const { minIntervalMs } = getTmdbRateLimitConfig()
  assert.equal(startedAt.length, 3)
  assert.ok(startedAt[1] - startedAt[0] >= minIntervalMs - 5)
  assert.ok(startedAt[2] - startedAt[1] >= minIntervalMs - 5)
})

test('fetchUpcomingMoviesPage requests the TMDB upcoming endpoint', async () => {
  let requestedUrl = ''

  const fetchImpl = async (url) => {
    requestedUrl = String(url)
    return {
      ok: true,
      async json() {
        return { results: [] }
      },
    }
  }

  await fetchUpcomingMoviesPage(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    page: 2,
  })

  assert.match(requestedUrl, /\/movie\/upcoming\?page=2$/)
})
