import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { loadTrendingVideoConfig } from './trendingVideoConfig.js'
import { ensureTrendingVideoTables } from './trendingVideoRepository.js'
import { synchronizeTrendingVideos } from './trendingVideoService.js'
import { ensureErrorLogsTable, recordErrorSafely, recordCliError } from './errorLogs.js'

async function start() {
  const runtime = loadConfig()
  const config = loadTrendingVideoConfig()
  const once = process.argv.includes('--once')
  if (!config.apiKey) {
    console.log('Trending videos disabled: set YOUTUBE_API_KEY to enable discovery.')
    if (!once) {
      // Remain idle in Docker without restarting continuously when unconfigured.
      const idle = setInterval(() => {}, 3600_000)
      for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => clearInterval(idle))
    }
    return
  }
  const pool = createPool(runtime.databaseUrl)
  let timeout, stopping = false, active = Promise.resolve()
  async function shutdown() { stopping = true; clearTimeout(timeout); await active; await pool.end() }
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, shutdown)
  await ensureTrendingVideoTables(pool)
  await ensureErrorLogsTable(pool)
  async function run() {
    try {
      console.log('Trending videos:', await synchronizeTrendingVideos(pool, { config, token: runtime.tmdbBearerToken, baseUrl: runtime.tmdbBaseUrl }))
    } catch (error) {
      console.error(error.message)
      await recordErrorSafely(pool, { source: 'job', context: 'trending-videos', error })
      if (once) process.exitCode = 1
    }
    if (!stopping && !once) timeout = setTimeout(() => { active = run() }, config.intervalMs)
  }
  active = run()
  await active
  if (once) await pool.end()
}

start().catch(async (error) => {
  console.error(error.message)
  await recordCliError(error, 'trending-videos')
  process.exitCode = 1
})
