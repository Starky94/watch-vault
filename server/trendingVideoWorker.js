import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { loadTrendingVideoConfig } from './trendingVideoConfig.js'
import { ensureTrendingVideoTables } from './trendingVideoRepository.js'
import { synchronizeTrendingVideoFeeds } from './trendingVideoService.js'
import { ensureErrorLogsTable, recordErrorSafely, recordCliError } from './errorLogs.js'

async function start() {
  const runtime = loadConfig()
  const config = loadTrendingVideoConfig()
  const gameConfig = loadTrendingVideoConfig(process.env, 'games')
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
    const outcomes = await synchronizeTrendingVideoFeeds(pool, { configs: [config, gameConfig], token: runtime.tmdbBearerToken, baseUrl: runtime.tmdbBaseUrl })
    for (const { feed, result, error } of outcomes) {
      if (error) {
        console.error(`${feed} trending videos:`, error.message)
        await recordErrorSafely(pool, { source: 'job', context: `trending-videos:${feed}`, error })
        if (once) process.exitCode = 1
      } else {
        console.log(`${feed} trending videos:`, result)
      }
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
