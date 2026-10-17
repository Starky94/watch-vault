import test from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectionExportDate, nextCollectionRunAt, extractCollectionExport, importCollections, withCollectionRetry } from '../collectionImportService.js'
import { getCollection, listCollections } from '../collectionRepository.js'

function database({ locked = true } = {}) {
  const saved = new Map()
  const queries = []
  let released = 0
  const client = {
    async query(sql, params) {
      queries.push({ sql, params })
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ locked }] }
      if (sql === 'SELECT tmdb_id FROM movie_collections') return { rows: [...saved.keys()].map((tmdb_id) => ({ tmdb_id })) }
      if (sql.includes('INSERT INTO movie_collections')) saved.set(params[0], JSON.parse(params[8]))
      if (/\b(?:INSERT INTO|UPDATE|DELETE FROM) movies\b/.test(sql)) assert.fail('Importer wrote movies')
      return { rows: [] }
    },
    release() { released++ },
  }
  return { pool: { connect: async () => client }, saved, queries, released: () => released }
}

function exportResponse(entries) {
  return new Response(gzipSync(entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'))
}

test('export date uses UTC and previous day before availability; schedule is 08:30 UTC', () => {
  assert.equal(collectionExportDate(new Date('2026-01-01T07:59:00Z')), '12_31_2025')
  assert.equal(collectionExportDate(new Date('2026-10-17T08:00:00Z')), '10_17_2026')
  assert.equal(nextCollectionRunAt(new Date('2026-10-17T08:29:59Z')).toISOString(), '2026-10-17T08:30:00.000Z')
  assert.equal(nextCollectionRunAt(new Date('2026-10-17T08:30:00Z')).toISOString(), '2026-10-18T08:30:00.000Z')
})

test('archive is removed immediately on extraction and temp files cleaned on failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'collections-test-'))
  try {
    const files = await extractCollectionExport('https://example.test', { tempRoot: root, fetchImpl: async () => exportResponse([{ id: 1 }]) })
    assert.deepEqual(await readdir(files.directory), ['collections.ndjson'])
    await rm(files.directory, { recursive: true })
    await assert.rejects(extractCollectionExport('https://example.test', { tempRoot: root, fetchImpl: async () => new Response('broken gzip') }))
    assert.deepEqual(await readdir(root), [])
    await assert.rejects(extractCollectionExport('https://example.test', { tempRoot: root, fetchImpl: async () => new Response('', { status: 404 }) }))
    assert.deepEqual(await readdir(root), [])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('imports only new collections with one details request; members remain summaries and subsequent runs skip details', async () => {
  const db = database()
  const calls = []
  const root = await mkdtemp(join(tmpdir(), 'collections-test-'))
  const fetchImpl = async (url) => {
    const value = new URL(url)
    calls.push(value)
    if (value.hostname === 'files.tmdb.org') return exportResponse([{ id: 1, name: 'Example' }, { id: 1 }, { id: 2 }])
    assert.match(value.pathname, /^\/3\/collection\/[12]$/)
    assert.equal(value.searchParams.get('language'), 'en-US')
    const id = Number(value.pathname.split('/').at(-1))
    return Response.json({ id, name: `Collection ${id}`, poster_path: '/poster.jpg', parts: [{ id: 900, title: 'Not imported' }] })
  }
  try {
    const options = { token: 'test', baseUrl: 'https://api.themoviedb.org/3', fetchImpl, tempRoot: root }
    const first = await importCollections(db.pool, options)
    assert.equal(first.insertedCount, 2)
    assert.equal(first.fetchedCount, 2)
    assert.deepEqual(db.saved.get(1).parts, [{ id: 900, title: 'Not imported' }])
    assert.equal(calls.length, 3)
    const second = await importCollections(db.pool, options)
    assert.equal(second.insertedCount, 0)
    assert.equal(calls.length, 4)
    assert.equal(db.released(), 2)
    assert.deepEqual(await readdir(root), [])
    assert.equal(db.queries.filter(({ sql }) => sql.includes('pg_advisory_unlock')).length, 2)
    assert.ok(db.queries.every(({ sql }) => !/\b(?:INSERT INTO|UPDATE|DELETE FROM) movies\b/.test(sql)))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('overlap skips work and releases the connection without unlocking another worker', async () => {
  const db = database({ locked: false })
  const result = await importCollections(db.pool, { fetchImpl: () => assert.fail('Unexpected request') })
  assert.equal(result.skipped, true)
  assert.equal(db.released(), 1)
  assert.equal(db.queries.length, 1)
})

test('failed entries are retried next run while successful collections remain unchanged', async () => {
  const db = database()
  let fail = true
  const fetchImpl = async (url) => {
    const value = new URL(url)
    if (value.hostname === 'files.tmdb.org') return exportResponse([{ id: 1 }, { id: 2 }])
    const id = Number(value.pathname.split('/').at(-1))
    if (id === 1 && fail) return new Response('', { status: 404 })
    return Response.json({ id, name: 'Collection', parts: [] })
  }
  const options = { token: 'test', baseUrl: 'https://api.themoviedb.org/3', fetchImpl }
  const first = await importCollections(db.pool, options)
  assert.equal(first.errors.length, 1)
  assert.equal(first.errors[0].id, 1)
  assert.equal(db.saved.size, 1)
  fail = false
  const second = await importCollections(db.pool, options)
  assert.equal(second.insertedCount, 1)
  assert.equal(db.saved.size, 2)
})

test('invalid JSON cleans extraction files and unlocks the import', async () => {
  const db = database()
  const root = await mkdtemp(join(tmpdir(), 'collections-test-'))
  try {
    await assert.rejects(importCollections(db.pool, { tempRoot: root, fetchImpl: async () => new Response(gzipSync('not json')) }))
    assert.deepEqual(await readdir(root), [])
    assert.ok(db.queries.some(({ sql }) => sql.includes('pg_advisory_unlock')))
    assert.equal(db.released(), 1)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('transient errors retry at most twice; permanent errors fail immediately', async () => {
  let count = 0
  const delays = []
  await assert.rejects(withCollectionRetry(async () => { count++; throw Object.assign(new Error('busy'), { status: 429, retryAfterMs: 2000 }) }, { sleep: async (ms) => { delays.push(ms) } }))
  assert.equal(count, 3)
  assert.deepEqual(delays, [2000, 2000])
  count = 0
  await assert.rejects(withCollectionRetry(async () => { count++; throw Object.assign(new Error('missing'), { status: 404 }) }))
  assert.equal(count, 1)
})

test('collection repository paginates deterministically and reads complete member summaries without movie access', async () => {
  const queries = []
  const pool = { async query(sql, params) { queries.push({ sql, params }); return { rows: [{ id: 1 }, { id: 2 }, { id: 3 }] } } }
  const page = await listCollections(pool, { page: 2, limit: 2 })
  assert.match(queries[0].sql, /AVG\(NULLIF\(\(member->>'vote_average'\)::numeric, 0\)\)/)
  assert.equal(page.collections.length, 2)
  assert.equal(page.pagination.hasNextPage, true)
  assert.equal(page.pagination.hasPreviousPage, true)
  assert.deepEqual(queries[0].params, [3, 2, ''])
  assert.match(queries[0].sql, /ORDER BY popularity DESC NULLS LAST, name ASC, tmdb_id ASC/)
  await getCollection(pool, 1)
  assert.match(queries[1].sql, /parts, imported_at/)
  assert.ok(queries.every(({ sql }) => !/\bmovies\b/.test(sql)))
})

test('collection name filtering is case insensitive and treats wildcard characters literally', async () => {
  let captured
  const pool = { async query(sql, params) { captured = { sql, params }; return { rows: [] } } }
  await listCollections(pool, { limit: 30, page: 1, query: '  Star%_  ' })
  assert.deepEqual(captured.params, [31, 0, 'Star%_'])
  assert.match(captured.sql, /strpos\(lower\(name\), lower\(\$3\)\) > 0/)
})

test('popularity sorting uses stored member summaries and validates the sort column', async () => {
  const queries = []
  const pool = { async query(sql) { queries.push(sql); return { rows: [] } } }
  await listCollections(pool, { limit: 30, page: 1, sort: 'popularity' })
  assert.match(queries[0], /AVG\(\(member->>'popularity'\)::numeric\)/)
  assert.match(queries[0], /ORDER BY popularity DESC NULLS LAST, name ASC, tmdb_id ASC/)
  await listCollections(pool, { limit: 30, page: 1, sort: 'bad;DROP TABLE movies' })
  assert.match(queries[1], /ORDER BY popularity DESC NULLS LAST/)
  await listCollections(pool, { limit: 30, page: 1, sort: 'rating' })
  assert.match(queries[2], /ORDER BY average_rating DESC NULLS LAST/)
  assert.ok(!queries[1].includes('DROP TABLE'))
})
