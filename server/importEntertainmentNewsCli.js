import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { importEntertainmentNews } from './newsImportService.js'

async function run() {
  const config = loadConfig({ requireDatabase: true })
  const pool = createPool(config.databaseUrl)
  try {
    const result = await importEntertainmentNews(pool)
    console.log(`Fetched ${result.fetchedCount} entertainment-news articles. Inserted ${result.insertedCount}, refreshed ${result.updatedCount}, and linked ${result.linkedActorCount} actor associations.`)
    for (const error of result.errors) console.error(`Feed failed (${error.feed}): ${error.message}`)
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
