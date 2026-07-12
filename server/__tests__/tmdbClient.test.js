import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchAiringTodayTvShowsPage,
  fetchMovieCredits,
  fetchMovieReviews,
  fetchMovieVideos,
  fetchOnTheAirTvShowsPage,
  fetchPersonCombinedCredits,
  fetchPersonDetails,
  fetchPopularMoviesPage,
  fetchPopularTvShowsPage,
  searchMovies,
  searchTvShows,
  fetchTvDetails,
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

test('TMDB title searches request first-page movie and TV matches', async () => {
  resetTmdbRateLimiterForTests()
  const requestedUrls = []
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url))
    return { ok: true, async json() { return { results: [] } } }
  }

  await Promise.all([
    searchMovies(fetchImpl, { token: 'token', baseUrl: 'https://api.themoviedb.org/3', query: 'Dune' }),
    searchTvShows(fetchImpl, { token: 'token', baseUrl: 'https://api.themoviedb.org/3', query: 'Dune' }),
  ])

  assert.ok(requestedUrls.some((url) => /\/search\/movie\?query=Dune&page=1$/.test(url)))
  assert.ok(requestedUrls.some((url) => /\/search\/tv\?query=Dune&page=1$/.test(url)))
})

test('fetchPopularTvShowsPage requests the TMDB popular TV endpoint', async () => {
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

  await fetchPopularTvShowsPage(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    page: 2,
  })

  assert.match(requestedUrl, /\/tv\/popular\?page=2$/)
})

test('fetchAiringTodayTvShowsPage requests the TMDB airing today TV endpoint', async () => {
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

  await fetchAiringTodayTvShowsPage(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    page: 3,
  })

  assert.match(requestedUrl, /\/tv\/airing_today\?page=3$/)
})

test('fetchOnTheAirTvShowsPage requests the TMDB on the air TV endpoint', async () => {
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

  await fetchOnTheAirTvShowsPage(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    page: 4,
  })

  assert.match(requestedUrl, /\/tv\/on_the_air\?page=4$/)
})

test('fetchMovieCredits requests the TMDB credits endpoint', async () => {
  let requestedUrl = ''

  const fetchImpl = async (url) => {
    requestedUrl = String(url)
    return {
      ok: true,
      async json() {
        return { cast: [], crew: [] }
      },
    }
  }

  await fetchMovieCredits(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    movieId: 42,
  })

  assert.match(requestedUrl, /\/movie\/42\/credits$/)
})

test('fetchMovieReviews requests the TMDB reviews endpoint', async () => {
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

  await fetchMovieReviews(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    movieId: 42,
  })

  assert.match(requestedUrl, /\/movie\/42\/reviews$/)
})

test('fetchMovieVideos requests the movie videos endpoint with bearer authorization', async () => {
  let requestedUrl = ''
  let requestedHeaders = null

  const fetchImpl = async (url, options) => {
    requestedUrl = String(url)
    requestedHeaders = options.headers
    return { ok: true, async json() { return { results: [] } } }
  }

  await fetchMovieVideos(fetchImpl, { token: 'token', baseUrl: 'https://api.themoviedb.org/3', movieId: 42 })

  assert.match(requestedUrl, /\/movie\/42\/videos$/)
  assert.equal(requestedHeaders.Authorization, 'Bearer token')
})

test('fetchTvDetails requests the TMDB TV detail endpoint', async () => {
  let requestedUrl = ''

  const fetchImpl = async (url) => {
    requestedUrl = String(url)
    return {
      ok: true,
      async json() {
        return { id: 77 }
      },
    }
  }

  await fetchTvDetails(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    tvShowId: 77,
  })

  assert.match(requestedUrl, /\/tv\/77$/)
})

test('fetchPersonDetails requests the TMDB person endpoint', async () => {
  let requestedUrl = ''

  const fetchImpl = async (url) => {
    requestedUrl = String(url)
    return {
      ok: true,
      async json() {
        return { id: 99 }
      },
    }
  }

  await fetchPersonDetails(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    personId: 99,
  })

  assert.match(requestedUrl, /\/person\/99$/)
})

test('fetchPersonCombinedCredits requests the TMDB combined credits endpoint', async () => {
  let requestedUrl = ''

  const fetchImpl = async (url) => {
    requestedUrl = String(url)
    return {
      ok: true,
      async json() {
        return { cast: [], crew: [] }
      },
    }
  }

  await fetchPersonCombinedCredits(fetchImpl, {
    token: 'token',
    baseUrl: 'https://api.themoviedb.org/3',
    personId: 99,
  })

  assert.match(requestedUrl, /\/person\/99\/combined_credits$/)
})
