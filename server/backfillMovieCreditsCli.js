import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { backfillMovieCredits } from './movieImportService.js'

async function run() {
  const config = loadConfig({
    requireDatabase: true,
    requireTmdbToken: true,
  })

  const pool = createPool(config.databaseUrl)

  try {
    const result = await backfillMovieCredits(pool, {
      token: config.tmdbBearerToken,
      baseUrl: config.tmdbBaseUrl,
    })

    console.log(
      `Processed ${result.processedCount} movies. Inserted ${result.insertedCount} cast members, refreshed ${result.updatedCount} movie credits, failed ${result.failedCount}.`
    )
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
