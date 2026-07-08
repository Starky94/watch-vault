import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { importPopularTvShows } from './tvImportService.js'

async function run() {
  const config = loadConfig({
    requireDatabase: true,
    requireTmdbToken: true,
  })

  const pool = createPool(config.databaseUrl)

  try {
    const result = await importPopularTvShows(pool, {
      token: config.tmdbBearerToken,
      baseUrl: config.tmdbBaseUrl,
      count: 30,
    })

    console.log(
      `Fetched ${result.fetchedCount} popular TV shows from TMDB. Inserted ${result.insertedCount} new shows and refreshed ${result.updatedCount} existing shows.`
    )
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
