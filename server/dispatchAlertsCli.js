import { dispatchReleaseAlerts } from './alertService.js'
import { loadConfig } from './config.js'
import { createPool } from './database.js'

async function run() {
  const config = loadConfig({ requireDatabase: true })
  const pool = createPool(config.databaseUrl)

  try {
    const result = await dispatchReleaseAlerts(pool)
    console.log(`Created ${result.movieReleaseCount} movie-release and ${result.episodeReleaseCount} episode-release alerts.`)
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
