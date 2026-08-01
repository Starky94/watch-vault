import dotenv from 'dotenv'
import crypto from 'node:crypto'

dotenv.config()

function requireEnv(name, env) {
  const value = env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function loadConfig(options = {}) {
  const {
    env = process.env,
    requireDatabase = true,
    requireTmdbToken = false,
  } = options

  const config = {
    port: Number(env.PORT || 3001),
    databaseUrl: requireDatabase ? requireEnv('DATABASE_URL', env) : env.DATABASE_URL,
    tmdbBearerToken: requireTmdbToken ? requireEnv('TMDB_BEARER_TOKEN', env) : env.TMDB_BEARER_TOKEN,
    tmdbBaseUrl: env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
    googleBooksApiKey: env.GOOGLE_BOOKS_API_KEY,
    googleBooksBaseUrl: env.GOOGLE_BOOKS_BASE_URL || 'https://www.googleapis.com/books/v1',
    filelistEncryptionKey: env.FILELIST_ENCRYPTION_KEY || deriveFilelistEncryptionKey(env.DATABASE_URL),
  }

  if (!Number.isInteger(config.port) || config.port <= 0) {
    throw new Error('PORT must be a positive integer')
  }

  return config
}

function deriveFilelistEncryptionKey(databaseUrl) {
  if (!databaseUrl) return undefined
  return crypto.createHash('sha256').update(`watchvault-filelist:${databaseUrl}`).digest('base64')
}
