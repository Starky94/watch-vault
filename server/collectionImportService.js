import { mkdtemp, rm } from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { ensureCollectionsTable, saveCollection } from './collectionRepository.js'
import { fetchCollectionDetails } from './tmdbClient.js'

const lockId = 741093821

export function collectionExportDate(now = new Date()) {
  const date = new Date(now)
  if (date.getUTCHours() < 8) date.setUTCDate(date.getUTCDate() - 1)
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}_${String(date.getUTCDate()).padStart(2, '0')}_${date.getUTCFullYear()}`
}

export function nextCollectionRunAt(now = new Date()) {
  const date = new Date(now)
  date.setUTCHours(8, 30, 0, 0)
  if (date <= now) date.setUTCDate(date.getUTCDate() + 1)
  return date
}

export async function withCollectionRetry(operation, { sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await operation() } catch (error) {
      const transient = !error.status || error.status === 429 || error.status >= 500
      if (!transient || attempt >= 2) throw error
      await sleep(Math.min(Math.max(error.retryAfterMs || 0, 1000 * 2 ** attempt), 30_000))
    }
  }
}

export async function extractCollectionExport(url, { fetchImpl = fetch, tempRoot = tmpdir(), sleep } = {}) {
  const directory = await mkdtemp(join(tempRoot, 'watchvault-collections-'))
  const archive = join(directory, 'collections.json.gz')
  try {
    await withCollectionRetry(async () => {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(120_000) })
      if (!response.ok) {
        await response.body?.cancel()
        const error = new Error(`Collection export download failed: ${response.status}`)
        error.status = response.status
        throw error
      }
      await pipeline(Readable.fromWeb(response.body), createWriteStream(archive))
    }, { sleep })
    const extracted = join(directory, 'collections.ndjson')
    await pipeline(createReadStream(archive), createGunzip(), createWriteStream(extracted))
    await rm(archive, { force: true })
    return { directory, extracted }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}

export async function importCollections(pool, { token, baseUrl, fetchImpl = fetch, now = new Date(), tempRoot, sleep } = {}) {
  const client = await pool.connect()
  let locked = false
  let directory
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [lockId])
    locked = rows[0]?.locked === true
    if (!locked) return { skipped: true, fetchedCount: 0, insertedCount: 0, updatedCount: 0 }
    await ensureCollectionsTable(client)
    const known = await client.query('SELECT tmdb_id FROM movie_collections')
    const ids = new Set(known.rows.map((row) => Number(row.tmdb_id)))
    const url = `https://files.tmdb.org/p/exports/collection_ids_${collectionExportDate(now)}.json.gz`
    const exportFiles = await extractCollectionExport(url, { fetchImpl, tempRoot, sleep })
    directory = exportFiles.directory
    const input = createReadStream(exportFiles.extracted)
    const lines = createInterface({ input, crlfDelay: Infinity })
    let fetchedCount = 0
    let insertedCount = 0
    const errors = []
    try {
      for await (const line of lines) {
        if (!line.trim()) continue
        const entry = JSON.parse(line)
        if (!Number.isSafeInteger(entry.id) || entry.id <= 0) throw new Error('Invalid collection export ID')
        if (ids.has(entry.id)) continue
        try {
          const payload = await withCollectionRetry(() => fetchCollectionDetails(fetchImpl, { token, baseUrl, collectionId: entry.id }), { sleep })
          fetchedCount++
          if (payload?.id !== entry.id || typeof payload.name !== 'string' || !payload.name.trim() || !Array.isArray(payload.parts)) {
            throw Object.assign(new Error('Invalid collection details response'), { status: 400 })
          }
          await saveCollection(client, entry, payload)
          ids.add(entry.id)
          insertedCount++
        } catch (error) {
          errors.push({ id: entry.id, message: error.message })
          // Authentication failures affect every entry; stop rather than exhaust the export.
          if (error.status === 401 || error.status === 403) throw error
        }
      }
    } finally {
      lines.close()
      input.destroy()
    }
    return { fetchedCount, insertedCount, updatedCount: 0, errors }
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true })
    } finally {
      try { if (locked) await client.query('SELECT pg_advisory_unlock($1)', [lockId]) } finally { client.release() }
    }
  }
}
