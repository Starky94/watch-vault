import { createPool } from './database.js'
import { loadConfig } from './config.js'

export const ERROR_LOG_PAGE_SIZE = 25
const sources = new Set(['api', 'job'])

export async function ensureErrorLogsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL CHECK (source IN ('api', 'job')),
      context TEXT NOT NULL,
      message TEXT NOT NULL,
      stack TEXT
    )
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS error_logs_created_at_id_idx ON error_logs (created_at DESC, id DESC)')
}

function redact(value) {
  if (!value) return null
  return String(value)
    .replace(/(authorization\s*[:=]\s*bearer\s+)\S+/gi, '$1[redacted]')
    .replace(/(password|passkey|private[_ -]?key|client[_ -]?secret|token)(\s*[:=]\s*)\S+/gi, '$1$2[redacted]')
    .replace(/([?&](?:password|passkey|key|token|secret)=[^\s&]+)/gi, '[redacted]')
}

export async function insertErrorLog(pool, { source, context, error }) {
  if (!sources.has(source)) throw new Error('Unknown error log source')
  const message = redact(error instanceof Error ? error.message : error) || 'Unknown error'
  const stack = redact(error instanceof Error ? error.stack : null)
  await pool.query(
    'INSERT INTO error_logs (source, context, message, stack) VALUES ($1, $2, $3, $4)',
    [source, String(context || 'unknown'), message, stack]
  )
}

export async function recordErrorSafely(pool, entry) {
  try {
    await insertErrorLog(pool, entry)
  } catch (loggingError) {
    console.error('Unable to persist error log:', loggingError)
    console.error(entry.error)
  }
}

export async function recordCliError(error, context, source = 'job') {
  let pool
  try {
    const { databaseUrl } = loadConfig({ requireDatabase: false })
    if (!databaseUrl) throw new Error('DATABASE_URL is unavailable')
    pool = createPool(databaseUrl)
    await ensureErrorLogsTable(pool)
    await insertErrorLog(pool, { source, context, error })
  } catch (loggingError) {
    console.error('Unable to persist error log:', loggingError)
    console.error(error)
  } finally {
    if (pool) await pool.end().catch((closeError) => console.error('Unable to close error log connection:', closeError))
  }
}

export async function listErrorLogs(pool, { source = null, search = '', page = 1 } = {}) {
  const offset = (page - 1) * ERROR_LOG_PAGE_SIZE
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  const filters = `($1::text IS NULL OR source = $1)
    AND ($2::text = '' OR context ILIKE $3 ESCAPE '\\' OR message ILIKE $3 ESCAPE '\\' OR stack ILIKE $3 ESCAPE '\\')`
  const params = [source, search, pattern]
  const [countResult, rowsResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::integer AS total FROM error_logs WHERE ${filters}`, params),
    pool.query(`SELECT id, created_at, source, context, message, stack FROM error_logs WHERE ${filters}
      ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5`, [...params, ERROR_LOG_PAGE_SIZE, offset]),
  ])
  return {
    logs: rowsResult.rows.map((row) => ({ id: row.id, createdAt: row.created_at, source: row.source, context: row.context, message: row.message, stack: row.stack })),
    total: countResult.rows[0]?.total ?? 0,
    page,
    pageSize: ERROR_LOG_PAGE_SIZE,
  }
}
