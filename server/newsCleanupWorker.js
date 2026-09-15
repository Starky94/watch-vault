import { loadConfig } from './config.js'
import { createPool, ensureAdminJobExecutionsTable, ensureNewsTables, recordAdminJobExecution } from './database.js'
import { nextNewsCleanupRunAt, runNewsCleanup } from './newsCleanupService.js'

async function start() {
  const config = loadConfig({ requireDatabase: true })
  const pool = createPool(config.databaseUrl)
  await ensureNewsTables(pool)
  await ensureAdminJobExecutionsTable(pool)
  let timeout
  let stopping = false

  const shutdown = async () => {
    stopping = true
    if (timeout) clearTimeout(timeout)
    await pool.end()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  async function scheduleNextRun() {
    const nextRun = nextNewsCleanupRunAt(new Date(), config.newsCleanupTimeZone)
    console.log(`Next news cleanup run: ${nextRun.toISOString()}.`)
    timeout = setTimeout(async () => {
      try {
        const result = await runNewsCleanup(pool)
        await recordAdminJobExecution(pool, 'news-cleanup')
        console.log(`News cleanup removed ${result.deletedCount} expired unlinked, unsaved article${result.deletedCount === 1 ? '' : 's'}.`)
      } catch (error) {
        console.error(`News cleanup failed: ${error.message}`)
      }
      if (!stopping) await scheduleNextRun()
    }, nextRun.getTime() - Date.now())
  }

  await scheduleNextRun()
}

start().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
