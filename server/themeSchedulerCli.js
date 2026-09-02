import { loadConfig } from './config.js'
import { createPool, ensureAdminJobExecutionsTable, recordAdminJobExecution } from './database.js'
import { runThemeScheduler } from './themeScheduler.js'

async function run() {
  const config = loadConfig({ requireDatabase: true })
  const pool = createPool(config.databaseUrl)
  try {
    await ensureAdminJobExecutionsTable(pool)
    const result = await runThemeScheduler(pool, { timeZone: config.themeSchedulerTimeZone })
    await recordAdminJobExecution(pool, 'theme-scheduler')
    console.log(`Seasonal theme scheduler ${result.changed ? 'set' : 'kept'} ${result.activeTheme} (${result.timeZone}).`)
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
