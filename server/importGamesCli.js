import { loadConfig } from './config.js'
import { createPool, ensureIgdbCredentialsTable, getIgdbCredentials } from './database.js'
import { decryptFilelistValue } from './filelist.js'
import { importPopularGames } from './gameImportService.js'

async function run() {
  const config = loadConfig({ requireDatabase: true })
  const pool = createPool(config.databaseUrl)
  try {
    await ensureIgdbCredentialsTable(pool)
    const credentials = await getIgdbCredentials(pool)
    if (!credentials) throw new Error('IGDB credentials have not been configured in Admin settings')
    const result = await importPopularGames(pool, {
      clientId: decryptFilelistValue(credentials.encrypted_client_id, config.filelistEncryptionKey),
      clientSecret: decryptFilelistValue(credentials.encrypted_private_key, config.filelistEncryptionKey),
      baseUrl: config.igdbBaseUrl,
      tokenUrl: config.twitchTokenUrl,
      count: 30,
    })
    console.log(`Fetched ${result.fetchedCount} games from IGDB. Inserted ${result.insertedCount} new games and refreshed ${result.updatedCount} existing games.`)
  } finally {
    await pool.end()
  }
}

run().catch((error) => { console.error(error.message); process.exit(1) })
