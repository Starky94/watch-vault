const TMDB_RATE_LIMIT_PER_SECOND = 35
const TMDB_MIN_INTERVAL_MS = Math.ceil(1000 / TMDB_RATE_LIMIT_PER_SECOND)

let nextRequestAt = 0
let rateLimitQueue = Promise.resolve()

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForTmdbRateLimit(now = Date.now) {
  let delayMs = 0

  rateLimitQueue = rateLimitQueue.then(async () => {
    const currentTime = now()
    delayMs = Math.max(0, nextRequestAt - currentTime)

    if (delayMs > 0) {
      await sleep(delayMs)
    }

    const scheduledAt = Math.max(nextRequestAt, currentTime)
    nextRequestAt = scheduledAt + TMDB_MIN_INTERVAL_MS
  })

  await rateLimitQueue
  return delayMs
}

async function tmdbRequest(fetchImpl, options) {
  const { token, baseUrl, path, searchParams } = options
  await waitForTmdbRateLimit()

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const url = new URL(path, normalizedBaseUrl)

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`TMDB request failed with status ${response.status}: ${body}`)
  }

  return response.json()
}

export async function fetchNowPlayingMoviesPage(fetchImpl, options) {
  const { token, page, baseUrl } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: 'movie/now_playing',
    searchParams: {
      page,
    },
  })
}

export async function fetchUpcomingMoviesPage(fetchImpl, options) {
  const { token, page, baseUrl } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: 'movie/upcoming',
    searchParams: {
      page,
    },
  })
}

export async function fetchPopularMoviesPage(fetchImpl, options) {
  const { token, page, baseUrl } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: 'movie/popular',
    searchParams: {
      page,
    },
  })
}

export async function fetchPopularTvShowsPage(fetchImpl, options) {
  const { token, page, baseUrl } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: 'tv/popular',
    searchParams: {
      page,
    },
  })
}

export async function fetchAiringTodayTvShowsPage(fetchImpl, options) {
  const { token, page, baseUrl } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: 'tv/airing_today',
    searchParams: {
      page,
    },
  })
}

export async function fetchOnTheAirTvShowsPage(fetchImpl, options) {
  const { token, page, baseUrl } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: 'tv/on_the_air',
    searchParams: {
      page,
    },
  })
}

export async function fetchMovieGenres(fetchImpl, options) {
  const { token, baseUrl } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: 'genre/movie/list',
  })
}

export async function fetchTvGenres(fetchImpl, options) {
  const { token, baseUrl } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: 'genre/tv/list',
  })
}

export async function fetchMovieDetails(fetchImpl, options) {
  const { token, baseUrl, movieId } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: `movie/${movieId}`,
    searchParams: {
      append_to_response: 'release_dates',
    },
  })
}

export async function fetchTvDetails(fetchImpl, options) {
  const { token, baseUrl, tvShowId } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: `tv/${tvShowId}`,
  })
}

export async function fetchMovieCredits(fetchImpl, options) {
  const { token, baseUrl, movieId } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: `movie/${movieId}/credits`,
  })
}

export async function fetchMovieReviews(fetchImpl, options) {
  const { token, baseUrl, movieId } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: `movie/${movieId}/reviews`,
  })
}

export async function fetchPersonDetails(fetchImpl, options) {
  const { token, baseUrl, personId } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: `person/${personId}`,
  })
}

export async function fetchPersonCombinedCredits(fetchImpl, options) {
  const { token, baseUrl, personId } = options

  return tmdbRequest(fetchImpl, {
    token,
    baseUrl,
    path: `person/${personId}/combined_credits`,
  })
}

export function resetTmdbRateLimiterForTests() {
  nextRequestAt = 0
  rateLimitQueue = Promise.resolve()
}

export function getTmdbRateLimitConfig() {
  return {
    requestsPerSecond: TMDB_RATE_LIMIT_PER_SECOND,
    minIntervalMs: TMDB_MIN_INTERVAL_MS,
  }
}
