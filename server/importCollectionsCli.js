import { loadConfig } from './config.js'
import { createPool, ensureAdminJobExecutionsTable } from './database.js'
import { ensureErrorLogsTable, recordCliError } from './errorLogs.js'
import { executeCollectionImport } from './collectionImportRunner.js'

const config = loadConfig({ requireTmdbToken: true })
const pool = createPool(config.databaseUrl)
try {
  await ensureAdminJobExecutionsTable(pool)
  await ensureErrorLogsTable(pool)
  await executeCollectionImport(pool, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl })
} catch (error) {
  console.error(error.message)
  await recordCliError(error, 'collections')
  process.exitCode = 1
} finally {
  await pool.end()
}
