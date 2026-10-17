import { loadConfig } from './config.js'
import { createPool, ensureAdminJobExecutionsTable } from './database.js'
import { ensureErrorLogsTable, recordErrorSafely, recordCliError } from './errorLogs.js'
import { nextCollectionRunAt } from './collectionImportService.js'
import { executeCollectionImport } from './collectionImportRunner.js'

async function start() {
  const config = loadConfig({ requireTmdbToken: true })
  const pool = createPool(config.databaseUrl)
  let stopping = false
  let timeout
  let activeRun = Promise.resolve()
  async function shutdown() {
    stopping = true
    clearTimeout(timeout)
    await activeRun
    await pool.end()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  await ensureAdminJobExecutionsTable(pool)
  await ensureErrorLogsTable(pool)
  async function run() {
    try {
      await executeCollectionImport(pool, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl })
    } catch (error) {
      console.error(error.message)
      await recordErrorSafely(pool, { source: 'job', context: 'collections', error })
    }
  }
  function schedule() {
    if (stopping) return
    const next = nextCollectionRunAt()
    console.log(`Next collections import: ${next.toISOString()}`)
    timeout = setTimeout(() => {
      activeRun = run().finally(schedule)
    }, next.getTime() - Date.now())
  }
  if (process.env.COLLECTIONS_IMPORT_ON_STARTUP === 'true') {
    activeRun = run()
    await activeRun
  }
  schedule()
}
start().catch(async (error) => {
  console.error(error.message)
  await recordCliError(error, 'collections')
  process.exitCode = 1
})
