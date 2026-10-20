import { fetchTrendingMedia, fetchUpcomingMoviesPage, fetchMovieVideos, fetchTvVideos } from './tmdbClient.js'
import { readTrendingVideoCache, reserveYoutubeQuota, saveTrendingVideoCache } from './trendingVideoRepository.js'
import { classifyGameVideo, rankTrendingVideos, youtubeIdPattern } from './trendingVideoRanking.js'

const queries = ['official movie trailer', 'official TV series trailer', 'upcoming movie teaser', 'Netflix official trailer', 'movie behind the scenes', 'upcoming series trailer', 'new movie trailer']
const parts = 'snippet,statistics,contentDetails,status'

export async function synchronizeTrendingVideos(pool, { config, token, baseUrl, fetchImpl = fetch, now = Date.now() }) {
  if (!config.apiKey) return { skipped: 'YOUTUBE_API_KEY is not configured' }
  const feed = config.feed ?? 'movies'
  if (!['movies', 'games'].includes(feed)) throw new Error('Invalid trending video feed')
  const games = feed === 'games'
  const lockId = games ? 874216904 : 874216903
  const client = await pool.connect()
  let locked = false
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [lockId])
    locked = rows[0]?.locked === true
    if (!locked) return { skipped: 'Synchronization already running' }
    const previous = await readTrendingVideoCache(client, now, feed)
    const candidates = new Map(), trustedChannels = new Set(), failures = []
    let quotaBlocked = false, successfulDiscovery = 0
    function add(id, source, region, association) {
      if (!youtubeIdPattern.test(id)) return
      const entry = candidates.get(id) ?? { sources: new Set(), regions: new Set() }
      entry.sources.add(source)
      if (region) entry.regions.add(region)
      if (association && (!entry.association || association.official)) entry.association = association
      candidates.set(id, entry)
    }
    async function youtube(path, params) {
      if (quotaBlocked) throw new Error('YouTube quota unavailable')
      if (!await reserveYoutubeQuota(client, config, path === 'search', now)) throw new Error('Configured YouTube quota budget reached')
      const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
      for (const [key, value] of Object.entries({ ...params, key: config.apiKey })) url.searchParams.set(key, String(value))
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000) })
      if (!response.ok) {
        // Never include upstream URLs or response bodies: they may contain the key.
        if (response.status === 403 || response.status === 429) quotaBlocked = true
        throw new Error(`YouTube ${path} returned ${response.status}`)
      }
      const payload = await response.json()
      if (!Array.isArray(payload.items)) throw new Error(`Invalid YouTube ${path} response`)
      return payload.items
    }
    async function attempt(source, work) {
      try { await work(); successfulDiscovery++ } catch { failures.push(source) }
    }
    for (const video of previous.videos) add(video.id, 'cache', null, !games && video.media ? { ...video.media, type: video.category, official: false } : null)

    // Resolve and persist real API-returned IDs and upload playlists, refreshing monthly.
    for (const handle of config.handles) {
      await attempt(`channel:${handle}`, async () => {
        const { rows } = await client.query('SELECT channel_id, uploads_id, verified_at FROM trending_video_channels WHERE handle = $1', [handle])
        let channel = rows[0]
        if (!channel || now - new Date(channel.verified_at).getTime() > 28 * 86400_000) {
          const [result] = await youtube('channels', { part: 'contentDetails', forHandle: handle })
          const uploads = result?.contentDetails?.relatedPlaylists?.uploads
          if (!result?.id || !uploads) throw new Error('Channel not found')
          channel = { channel_id: result.id, uploads_id: uploads }
          await client.query(`INSERT INTO trending_video_channels (handle, channel_id, uploads_id, verified_at)
            VALUES ($1,$2,$3,$4) ON CONFLICT (handle) DO UPDATE SET channel_id=$2, uploads_id=$3, verified_at=$4`,
          [handle, result.id, uploads, new Date(now)])
        }
        trustedChannels.add(channel.channel_id)
        // One recent page, never a scan of the channel's history.
        const uploads = await youtube('playlistItems', { part: 'contentDetails', playlistId: channel.uploads_id, maxResults: 20 })
        for (const item of uploads) {
          if (Date.parse(item.contentDetails?.videoPublishedAt) >= now - 7 * 86400_000) add(item.contentDetails.videoId, 'official-channel')
        }
      })
    }
    for (const region of config.regions) {
      await attempt(`region:${region}`, async () => {
        const videos = await youtube('videos', { chart: 'mostPopular', part: parts, videoCategoryId: games ? 20 : 1, maxResults: 50, regionCode: region })
        for (const video of videos) { add(video.id, 'most-popular', region); if (candidates.has(video.id)) candidates.get(video.id).video = video }
      })
    }
    // Rotate queries; persistently enforced daily budgets also cover restarts/manual runs.
    const queryStart = Math.floor(now / config.intervalMs) * config.searchesPerSync
    for (let i = 0; i < (games ? 0 : config.searchesPerSync); i++) {
      await attempt('search', async () => {
        const items = await youtube('search', { part: 'snippet', type: 'video', q: queries[(queryStart + i) % queries.length], maxResults: 50, order: 'date', publishedAfter: new Date(now - 7 * 86400_000).toISOString() })
        for (const item of items) add(item.id?.videoId, 'search')
      })
    }
    if (token && !games) {
      const titles = new Map()
      for (const kind of ['movie', 'tv']) {
        await attempt(`tmdb:${kind}`, async () => {
          const payload = await fetchTrendingMedia(fetchImpl, { token, baseUrl, mediaType: kind })
          for (const title of (payload.results ?? []).slice(0, 10)) titles.set(`${kind}:${title.id}`, { ...title, kind })
        })
      }
      await attempt('tmdb:upcoming', async () => {
        const payload = await fetchUpcomingMoviesPage(fetchImpl, { token, baseUrl, page: 1 })
        for (const title of (payload.results ?? []).slice(0, 10)) titles.set(`movie:${title.id}`, { ...title, kind: 'movie' })
      })
      for (const title of titles.values()) {
        await attempt(`tmdb:${title.kind}:${title.id}`, async () => {
          const options = { token, baseUrl, movieId: title.id, tvShowId: title.id }
          const payload = await (title.kind === 'movie' ? fetchMovieVideos : fetchTvVideos)(fetchImpl, options)
          for (const video of payload.results ?? []) {
            if (video.site === 'YouTube' && (candidates.has(video.key) || Date.parse(video.published_at) >= now - 7 * 86400_000)) {
              add(video.key, 'tmdb', null, { id: title.id, kind: title.kind, title: title.title || title.name, type: video.type, official: video.official === true })
            }
          }
        })
      }
    }
    // Refresh statistics for every candidate, including previously ranked videos.
    const ids = [...candidates.keys()]
    let detailSuccesses = 0
    for (let i = 0; i < ids.length; i += 50) {
      await attempt('video-details', async () => {
        const batch = ids.slice(i, i + 50)
        const videos = await youtube('videos', { part: parts, id: batch.join(','), maxResults: 50 })
        detailSuccesses++
        // Missing IDs are deleted/private. Do not retain old copies or chart metadata.
        for (const id of batch) delete candidates.get(id).video
        for (const video of videos) if (candidates.has(video.id)) candidates.get(video.id).video = video
      })
    }
    const videos = rankTrendingVideos([...candidates.values()].filter((entry) => entry.video), {
      previous: previous.videos, previousAt: previous.updatedAt, now, trustedChannels,
      ...(games ? { classify: classifyGameVideo } : {}),
    })
    if ((!successfulDiscovery || (ids.length && !detailSuccesses) || (!videos.length && failures.length))) throw new Error('Trending videos synchronization failed; keeping the previous cache')
    // A partial details refresh would lose the velocity baseline and remove valid cached
    // videos. Keep the atomic previous snapshot until every batch can be revalidated.
    if (failures.includes('video-details')) throw new Error('Incomplete YouTube statistics refresh; keeping the previous cache')
    await saveTrendingVideoCache(client, videos, { failures, candidateCount: ids.length }, now, feed)
    await client.query('DELETE FROM trending_video_quota WHERE day < CURRENT_DATE - 35')
    return { count: videos.length, failures }
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [lockId])
    client.release()
  }
}

// Isolate failures: each feed owns its cache/lock while sharing the quota ledger.
export async function synchronizeTrendingVideoFeeds(pool, { configs, ...options }) {
  const outcomes = []
  for (const config of configs) {
    try {
      outcomes.push({ feed: config.feed ?? 'movies', result: await synchronizeTrendingVideos(pool, { ...options, config }) })
    } catch (error) {
      outcomes.push({ feed: config.feed ?? 'movies', error })
    }
  }
  return outcomes
}
