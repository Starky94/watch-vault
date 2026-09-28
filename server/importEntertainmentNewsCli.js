import { recordCliError } from './errorLogs.js'
import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { importEntertainmentNews } from './newsImportService.js'

async function run() {
  const config = loadConfig({ requireDatabase: true })
  const pool = createPool(config.databaseUrl)
  try {
    const result = await importEntertainmentNews(pool)
    console.log(`Fetched ${result.fetchedCount} news articles. Inserted ${result.insertedCount}, refreshed ${result.updatedCount}, and linked ${result.linkedShowCount} TV show associations.`)
    for (const error of result.errors) {
      console.error(`Feed failed (${error.feed}): ${error.message}`)
      let feedPath = 'feed'
      try { const url = new URL(error.feed); feedPath = `${url.host}${url.pathname}` } catch { /* Keep a safe context. */ }
      await recordCliError(error.message, `entertainment-news: ${feedPath}`)
    }
  } finally {
    await pool.end()
  }
}

run().catch(async (error) => {
  console.error(error.message)
  await recordCliError(error, 'entertainment-news')
  process.exit(1)
})
