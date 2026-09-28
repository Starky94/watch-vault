import { loadConfig } from './config.js'
import { createPool, ensureAdminJobExecutionsTable, recordAdminJobExecution } from './database.js'
import { nextThemeSchedulerRunAt, runThemeScheduler } from './themeScheduler.js'
import { recordErrorSafely, recordCliError, ensureErrorLogsTable } from './errorLogs.js'

async function start() {
  const config = loadConfig({ requireDatabase: true })
  const pool = createPool(config.databaseUrl)
  await ensureAdminJobExecutionsTable(pool)
  await ensureErrorLogsTable(pool)
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

  async function runAndSchedule() {
    try {
      const result = await runThemeScheduler(pool, { timeZone: config.themeSchedulerTimeZone })
      await recordAdminJobExecution(pool, 'theme-scheduler')
      console.log(`Seasonal theme scheduler ${result.changed ? 'set' : 'kept'} ${result.activeTheme} (${result.timeZone}).`)
    } catch (error) {
      console.error(`Seasonal theme scheduler failed: ${error.message}`)
      await recordErrorSafely(pool, { source: 'job', context: 'theme-scheduler', error })
    }
    if (stopping) return
    const nextRun = nextThemeSchedulerRunAt(new Date(), config.themeSchedulerTimeZone)
    console.log(`Next seasonal theme scheduler run: ${nextRun.toISOString()}.`)
    timeout = setTimeout(runAndSchedule, nextRun.getTime() - Date.now())
  }

  await runAndSchedule()
}

start().catch(async (error) => {
  console.error(error.message)
  await recordCliError(error, 'theme-scheduler')
  process.exit(1)
})
