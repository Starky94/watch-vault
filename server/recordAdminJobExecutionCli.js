import { loadConfig } from './config.js'
import { createPool, ensureAdminJobExecutionsTable, recordAdminJobExecution } from './database.js'

async function run() {
  const jobKey = process.argv[2]
  if (!jobKey) throw new Error('An admin job key is required.')
  const config = loadConfig({ requireDatabase: true, requireTmdbToken: false })
  const pool = createPool(config.databaseUrl)
  try {
    await ensureAdminJobExecutionsTable(pool)
    const lastExecutedAt = await recordAdminJobExecution(pool, jobKey)
    console.log(`Recorded ${jobKey} execution at ${lastExecutedAt?.toISOString?.() ?? lastExecutedAt}.`)
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
