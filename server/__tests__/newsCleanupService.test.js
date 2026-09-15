import test from 'node:test'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { deleteExpiredUnretainedNewsArticles } from '../database.js'
import { nextNewsCleanupRunAt, runNewsCleanup } from '../newsCleanupService.js'

function date(value) {
  return new Date(value)
}

test('news cleanup deletes only expired, unsaved, unmapped articles using the publication date', async () => {
  const now = date('2026-09-15T12:00:00.000Z')
  const articles = [
    { id: 1, publishedAt: '2026-09-08T11:59:59.999Z', saved: false, mapped: false },
    { id: 2, publishedAt: '2026-09-08T11:59:59.999Z', saved: true, mapped: false },
    { id: 3, publishedAt: '2026-09-08T11:59:59.999Z', saved: false, mapped: true },
    { id: 4, publishedAt: '2026-09-08T12:00:00.000Z', saved: false, mapped: false },
    { id: 5, publishedAt: '2026-09-14T12:00:00.000Z', saved: false, mapped: false },
    { id: 6, publishedAt: null, saved: false, mapped: false },
  ]
  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params = []) {
      executedSql = sql
      executedParams = params
      const cutoff = new Date(params[0])
      const deleted = articles.filter((article) => article.publishedAt && new Date(article.publishedAt) < cutoff && !article.saved && !article.mapped)
      return { rows: deleted.map(({ id }) => ({ id })), rowCount: deleted.length }
    },
  }

  const result = await runNewsCleanup(pool, { now })

  assert.deepEqual(result, { deletedCount: 1, cutoff: '2026-09-08T12:00:00.000Z' })
  assert.equal(executedParams[0], '2026-09-08T12:00:00.000Z')
  assert.match(executedSql, /published_at IS NOT NULL/)
  assert.match(executedSql, /published_at < \$1/)
  assert.match(executedSql, /NOT EXISTS[\s\S]*news_article_saves/)
  assert.match(executedSql, /NOT EXISTS[\s\S]*news_article_actors/)
  assert.match(executedSql, /NOT EXISTS[\s\S]*news_article_movies/)
  assert.match(executedSql, /NOT EXISTS[\s\S]*news_article_tv_shows/)
})

test('news cleanup rejects an invalid cutoff before querying', async () => {
  await assert.rejects(
    deleteExpiredUnretainedNewsArticles({ query: async () => ({ rows: [] }) }, { cutoff: new Date('invalid') }),
    /valid news article cleanup cutoff/i
  )
})

test('news cleanup schedules for 00:10 in the configured timezone', () => {
  assert.equal(nextNewsCleanupRunAt(date('2026-09-15T21:09:30.000Z'), 'Europe/Bucharest').toISOString(), '2026-09-15T21:10:00.000Z')
  assert.equal(nextNewsCleanupRunAt(date('2026-09-15T21:10:00.000Z'), 'Europe/Bucharest').toISOString(), '2026-09-16T21:10:00.000Z')
})

function createAdminPool() {
  return {
    async query(sql, params = []) {
      if (sql.includes('FROM users') && sql.includes('WHERE username = $1')) {
        return { rows: [{ id: 7, username: params[0], full_name: 'Florin' }] }
      }
      if (sql.includes('INSERT INTO admin_job_executions')) {
        return { rows: [{ last_executed_at: '2026-09-15T12:00:00.000Z' }] }
      }
      return { rows: [] }
    },
  }
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('authenticated Admin can manually run the news cleanup job', async () => {
  const app = await createApp(createAdminPool(), {
    jobs: [{
      key: 'news-cleanup',
      name: 'News Retention Cleanup',
      execution: 'Daily scheduler worker',
      frequency: 'Daily at 00:10',
      source: 'news-cleanup',
      run: async () => ({ deletedCount: 3, cutoff: '2026-09-08T12:00:00.000Z' }),
    }],
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const response = await fetch(`${baseUrl}/api/admin/jobs/news-cleanup/run`, {
      method: 'POST',
      headers: { 'x-watchvault-username': 'florin' },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      job: 'news-cleanup',
      fetchedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      lastExecutedAt: '2026-09-15T12:00:00.000Z',
      deletedCount: 3,
      cutoff: '2026-09-08T12:00:00.000Z',
    })
  } finally {
    await closeServer(server)
  }
})
