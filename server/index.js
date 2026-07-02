import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { createApp } from './app.js'

async function start() {
  const config = loadConfig({
    requireDatabase: true,
    requireTmdbToken: false,
  })

  const pool = createPool(config.databaseUrl)
  const app = await createApp(pool)

  const server = app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`)
  })

  const shutdown = async () => {
    server.close(async () => {
      await pool.end()
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
