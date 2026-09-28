import { recordCliError } from './errorLogs.js'
import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { importPopularMovies } from './movieImportService.js'

async function run() {
  const config = loadConfig({
    requireDatabase: true,
    requireTmdbToken: true,
  })

  const pool = createPool(config.databaseUrl)

  try {
    const result = await importPopularMovies(pool, {
      token: config.tmdbBearerToken,
      baseUrl: config.tmdbBaseUrl,
      count: 30,
    })

    console.log(
      `Fetched ${result.fetchedCount} movies from TMDB. Inserted ${result.insertedCount} new movies and refreshed ${result.updatedCount} existing movies.`
    )
  } finally {
    await pool.end()
  }
}

run().catch(async (error) => {
  console.error(error.message)
  await recordCliError(error, 'popular')
  process.exit(1)
})
