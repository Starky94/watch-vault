const IGDB_RATE_LIMIT_PER_SECOND = 4
const IGDB_MIN_INTERVAL_MS = Math.ceil(1000 / IGDB_RATE_LIMIT_PER_SECOND)

let nextRequestAt = 0
let rateLimitQueue = Promise.resolve()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForIgdbRateLimit(now = Date.now) {
  rateLimitQueue = rateLimitQueue.then(async () => {
    const currentTime = now()
    const delay = Math.max(0, nextRequestAt - currentTime)
    if (delay > 0) await sleep(delay)
    nextRequestAt = Math.max(nextRequestAt, currentTime) + IGDB_MIN_INTERVAL_MS
  })
  await rateLimitQueue
}

async function readJson(response, source) {
  if (response.ok) return response.json()
  const body = await response.text()
  throw new Error(`${source} request failed with status ${response.status}: ${body}`)
}

export async function fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl = 'https://id.twitch.tv/oauth2/token' }) {
  const url = new URL(tokenUrl)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  url.searchParams.set('grant_type', 'client_credentials')
  const payload = await readJson(await fetchImpl(url, { method: 'POST' }), 'Twitch OAuth')
  if (!payload?.access_token || typeof payload.access_token !== 'string') throw new Error('Twitch OAuth returned no access token')
  return payload.access_token
}

export async function igdbRequest(fetchImpl, { clientId, accessToken, baseUrl = 'https://api.igdb.com/v4', path, body }) {
  await waitForIgdbRateLimit()
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  return readJson(await fetchImpl(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Client-ID': clientId, Authorization: `Bearer ${accessToken}` },
    body,
  }), 'IGDB')
}

export function getIgdbRateLimitConfig() {
  return { requestsPerSecond: IGDB_RATE_LIMIT_PER_SECOND, minIntervalMs: IGDB_MIN_INTERVAL_MS }
}

export function resetIgdbRateLimiterForTests() {
  nextRequestAt = 0
  rateLimitQueue = Promise.resolve()
}
