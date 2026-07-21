import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { importBooks } from './bookImportService.js'

async function run() {
  const config = loadConfig({ requireDatabase: true })
  const pool = createPool(config.databaseUrl)
  try {
    const result = await importBooks(pool, { apiKey: config.googleBooksApiKey, baseUrl: config.googleBooksBaseUrl })
    console.log(`Fetched ${result.fetchedCount} ${result.category} books from Google Books. Inserted ${result.insertedCount} and refreshed ${result.updatedCount}.`)
  } finally { await pool.end() }
}
run().catch((error) => { console.error(error.message); process.exit(1) })
