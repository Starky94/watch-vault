import express from 'express'
import { ensureMoviesTable, listMovies } from './database.js'

export async function createApp(pool) {
  await ensureMoviesTable(pool)

  const app = express()
  app.use(express.json())

  app.get('/api/health', async (_request, response) => {
    response.json({ ok: true })
  })

  app.get('/api/movies', async (_request, response, next) => {
    try {
      const movies = await listMovies(pool)
      response.json({
        count: movies.length,
        movies,
      })
    } catch (error) {
      next(error)
    }
  })

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      error: error.message || 'Unexpected server error',
    })
  })

  return app
}
