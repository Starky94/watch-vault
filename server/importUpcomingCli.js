import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { importUpcomingMovies } from './movieImportService.js'

async function run() {
  const config = loadConfig({
    requireDatabase: true,
    requireTmdbToken: true,
  })

  const pool = createPool(config.databaseUrl)

  try {
    const result = await importUpcomingMovies(pool, {
      token: config.tmdbBearerToken,
      baseUrl: config.tmdbBaseUrl,
      count: 30,
    })

    console.log(
      `Fetched ${result.fetchedCount} upcoming movies from TMDB. Inserted ${result.insertedCount} new movies and refreshed ${result.updatedCount} existing movies.`
    )
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
