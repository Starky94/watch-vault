import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp, sessionCookieFor } from './sessionTestHelpers.js'
import { insertErrorLog, listErrorLogs } from '../errorLogs.js'

function createPool({ failInsert = false, failTheme = false } = {}) {
  const entries = []
  return {
    entries,
    async query(sql, params = []) {
      if (sql.includes('FROM users') && sql.includes('WHERE username')) return { rows: [{ id: 1, username: params[0], full_name: 'Admin', role: params[0] === 'florind' ? 'admin' : 'user' }] }
      if (sql.includes('INSERT INTO error_logs')) {
        if (failInsert) throw new Error('logging unavailable')
        entries.push({ source: params[0], context: params[1], message: params[2], stack: params[3] })
        return { rows: [] }
      }
      if (failTheme && sql.includes('FROM site_theme_preferences')) throw new Error('theme failed')
      if (sql.includes('FROM error_logs')) {
        const filtered = entries.filter((entry) => (!params[0] || entry.source === params[0]) && (!params[1] || `${entry.context} ${entry.message} ${entry.stack}`.toLowerCase().includes(params[1].toLowerCase())))
        if (sql.includes('COUNT(*)')) return { rows: [{ total: filtered.length }] }
        return { rows: filtered.slice(params[4], params[4] + params[3]).reverse().map((entry, index) => ({ id: index + 1, created_at: new Date(), ...entry })) }
      }
      return { rows: [] }
    },
  }
}

async function withServer(pool, options, run) {
  const app = await createApp(pool, options)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  try { await run(`http://127.0.0.1:${server.address().port}`) }
  finally { await new Promise((resolve) => server.close(resolve)) }
}

test('error log API is admin-only and supports source and text filters', async () => {
  const pool = createPool()
  await insertErrorLog(pool, { source: 'api', context: 'GET /api/theme', error: new Error('theme broke') })
  await insertErrorLog(pool, { source: 'job', context: 'books', error: new Error('import broke') })
  await withServer(pool, {}, async (base) => {
    assert.equal((await fetch(`${base}/api/admin/error-logs`)).status, 401)
    assert.equal((await fetch(`${base}/api/admin/error-logs`, { headers: { Cookie: sessionCookieFor('alex') } })).status, 403)
    const response = await fetch(`${base}/api/admin/error-logs?source=job&search=import`, { headers: { Cookie: sessionCookieFor('florind') } })
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.equal(payload.total, 1)
    assert.equal(payload.logs[0].context, 'books')
    assert.equal((await fetch(`${base}/api/admin/error-logs?page=-1`, { headers: { Cookie: sessionCookieFor('florind') } })).status, 400)
  })
})

test('unexpected API failure is recorded once and logging failure preserves the 500 response', async () => {
  for (const failInsert of [false, true]) {
    const pool = createPool({ failTheme: true, failInsert })
    const originalError = console.error
    console.error = () => {}
    try {
      await withServer(pool, {}, async (base) => {
        const response = await fetch(`${base}/api/theme`)
        assert.equal(response.status, 500)
        assert.equal((await response.json()).error, 'theme failed')
      })
      assert.equal(pool.entries.length, failInsert ? 0 : 1)
      if (!failInsert) assert.equal(pool.entries[0].context, 'GET /api/theme')
    } finally { console.error = originalError }
  }
})

test('manual job failures and partial RSS feed failures are recorded once', async () => {
  const pool = createPool()
  const jobs = [
    { key: 'broken', source: 'rss', run: async () => { throw new Error('job failed') } },
    { key: 'entertainment-news', source: 'rss', run: async () => ({ errors: [{ feed: 'https://example.com/feed?token=secret', message: 'feed failed' }] }) },
  ]
  await withServer(pool, { jobs }, async (base) => {
    const headers = { Cookie: sessionCookieFor('florind') }
    assert.equal((await fetch(`${base}/api/admin/jobs/broken/run`, { method: 'POST', headers })).status, 500)
    assert.equal((await fetch(`${base}/api/admin/jobs/entertainment-news/run`, { method: 'POST', headers })).status, 200)
  })
  assert.equal(pool.entries.length, 2)
  assert.deepEqual(pool.entries.map(({ source, context }) => ({ source, context })), [
    { source: 'job', context: 'broken' },
    { source: 'job', context: 'entertainment-news: example.com/feed' },
  ])
})

test('error log query pages newest first and redacts credentials', async () => {
  const calls = []
  const pool = { async query(sql, params) {
    calls.push({ sql, params })
    if (sql.includes('COUNT(*)')) return { rows: [{ total: 26 }] }
    if (sql.includes('FROM error_logs')) return { rows: [{ id: 26, created_at: new Date('2026-01-01'), source: 'job', context: 'books', message: 'bad', stack: null }] }
    return { rows: [] }
  } }
  const result = await listErrorLogs(pool, { source: 'job', search: 'bad', page: 2 })
  assert.equal(result.total, 26)
  assert.equal(result.pageSize, 25)
  assert.match(calls[1].sql, /ORDER BY created_at DESC, id DESC LIMIT \$4 OFFSET \$5/)
  assert.deepEqual(calls[1].params.slice(-2), [25, 25])
  await insertErrorLog(pool, { source: 'api', context: 'GET /api/theme', error: new Error('token=secret authorization: Bearer abc') })
  assert.doesNotMatch(calls[2].params[2], /secret|abc/)
})
