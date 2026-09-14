import test from 'node:test'
import assert from 'node:assert/strict'
import { adminJobs } from '../adminJobs.js'
import { createApp } from '../app.js'
import { addNewsArticleLikeForUser, countNewsArticles, listNewsArticles, removeNewsArticleLikeForUser } from '../database.js'
import { importEntertainmentNews, normalizeNewsItem, parseNewsFeed } from '../newsImportService.js'

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, text: async () => body }
}

function createPool() {
  const articles = new Map()
  const links = new Set()
  const calls = []
  let nextArticleId = 1
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 }
      if (sql.includes('INSERT INTO news_articles')) {
        const [, link] = params
        const existing = articles.get(link)
        const row = { id: existing?.id ?? nextArticleId++, inserted: !existing }
        articles.set(link, { id: row.id, title: params[0], publishedAt: params[2], photoUrl: params[3], description: params[4] })
        return { rows: [row], rowCount: 1 }
      }
      if (sql.includes('INSERT INTO news_article_actors')) {
        const key = params.join(':')
        const inserted = !links.has(key)
        links.add(key)
        return { rows: [], rowCount: inserted ? 1 : 0 }
      }
      if (sql.includes('INSERT INTO news_article_movies') || sql.includes('INSERT INTO news_article_tv_shows')) {
        const key = `${sql.includes('movies') ? 'movie' : 'show'}:${params.join(':')}`
        const inserted = !links.has(key)
        links.add(key)
        return { rows: [], rowCount: inserted ? 1 : 0 }
      }
      return { rows: [], rowCount: 0 }
    },
    release() {},
  }
  return {
    articles,
    links,
    calls,
    async query(sql) {
      calls.push({ sql })
      if (sql.includes('SELECT DISTINCT cast_members.id')) {
        return { rows: [{ id: 10, name: 'Ada Actor' }, { id: 11, name: 'Bea Performer' }] }
      }
      if (sql.includes('SELECT id, tmdb_id, title')) return { rows: [{ id: 20, tmdb_id: 101, title: 'Shared Title' }] }
      if (sql.includes('SELECT id, tmdb_id, name')) return { rows: [{ id: 30, tmdb_id: 202, name: 'Shared Title' }] }
      return { rows: [] }
    },
    async connect() { return client },
  }
}

test('RSS parser normalizes requested fields and standard media image sources', () => {
  const [article] = parseNewsFeed(`<?xml version="1.0"?><rss><channel><item>
    <title><![CDATA[Actor headline]]></title><link>https://example.test/story#comments</link>
    <pubDate>Mon, 01 Sep 2026 12:00:00 GMT</pubDate><category>Ada Actor</category>
    <media:content url="https://images.example.test/photo.jpg" />
    <description><![CDATA[<p>A <strong>short</strong> summary &amp; more.</p>]]></description>
  </item></channel></rss>`)
  assert.deepEqual(article, {
    title: 'Actor headline', link: 'https://example.test/story', publishedAt: '2026-09-01T12:00:00.000Z',
    photoUrl: 'https://images.example.test/photo.jpg', description: 'A short summary & more.', categories: ['ada actor'],
  })
  assert.equal(normalizeNewsItem({ title: 'Enclosure', link: 'https://example.test/e', enclosure: { '@_url': 'https://example.test/e.jpg' } }).photoUrl, 'https://example.test/e.jpg')
  assert.equal(normalizeNewsItem({ title: 'HTML image', link: 'https://example.test/h', description: '<img src="https://example.test/h.jpg">' }).photoUrl, 'https://example.test/h.jpg')
})

test('news import deduplicates article links, links exact actor categories, and tolerates a failed feed', async () => {
  const pool = createPool()
  const xml = (categories) => `<rss><channel><item><title>Story</title><link>https://example.test/story#top</link><pubDate>Mon, 01 Sep 2026 12:00:00 GMT</pubDate>${categories.map((category) => `<category>${category}</category>`).join('')}</item></channel></rss>`
  const feeds = ['one', 'two', 'failed']
  const result = await importEntertainmentNews(pool, {
    feeds,
    fetchImpl: async (url) => {
      if (url === 'failed') throw new Error('network unavailable')
      return response(url === 'one' ? xml(['Ada Actor', 'Not An Actor']) : xml(['Bea Performer', 'Ada']))
    },
  })

  assert.deepEqual({ ...result, errors: result.errors.map(({ feed }) => feed) }, {
    fetchedCount: 2, insertedCount: 1, updatedCount: 0, linkedActorCount: 2, linkedMovieCount: 0, linkedShowCount: 0, failedFeedCount: 1, errors: ['failed'],
  })
  assert.equal(pool.articles.size, 1)
  assert.deepEqual([...pool.links].sort(), ['1:10', '1:11'])
  const actorQuery = pool.calls.find(({ sql }) => sql.includes('SELECT DISTINCT cast_members.id'))?.sql
  assert.match(actorQuery, /movie_cast\.credit_type = 'actor'/)
  assert.match(actorQuery, /tv_show_credits\.credit_type = 'actor'/)
})

test('news import links an exact title category to both movies and shows', async () => {
  const pool = createPool()
  const feed = '<rss><channel><item><title>Story</title><link>https://example.test/story</link><category>Shared Title</category></item></channel></rss>'
  const result = await importEntertainmentNews(pool, { feeds: ['one'], fetchImpl: async () => response(feed) })
  assert.deepEqual({ linkedActorCount: result.linkedActorCount, linkedMovieCount: result.linkedMovieCount, linkedShowCount: result.linkedShowCount }, { linkedActorCount: 0, linkedMovieCount: 1, linkedShowCount: 1 })
  assert.equal(pool.links.has('movie:1:20'), true)
  assert.equal(pool.links.has('show:1:30'), true)
})

test('news import preserves deduplicated actor associations when an article is refreshed', async () => {
  const pool = createPool()
  const feed = '<rss><channel><item><title>Story</title><link>https://example.test/story</link><category>Ada Actor</category></item></channel></rss>'
  const first = await importEntertainmentNews(pool, { feeds: ['one'], fetchImpl: async () => response(feed) })
  const second = await importEntertainmentNews(pool, { feeds: ['one'], fetchImpl: async () => response(feed) })
  assert.equal(first.linkedActorCount, 1)
  assert.deepEqual({ insertedCount: second.insertedCount, updatedCount: second.updatedCount, linkedActorCount: second.linkedActorCount }, { insertedCount: 0, updatedCount: 1, linkedActorCount: 0 })
})

test('entertainment news is registered as an hourly admin job', () => {
  const job = adminJobs.find((candidate) => candidate.key === 'entertainment-news')
  assert.deepEqual({ name: job?.name, frequency: job?.frequency, source: job?.source }, { name: 'Entertainment News Import', frequency: 'Every hour', source: 'rss' })
})

test('news article total is read from the stored news table', async () => {
  let query = ''
  const total = await countNewsArticles({
    async query(sql) {
      query = sql
      return { rows: [{ news_article_count: 37 }] }
    },
  })
  assert.equal(total, 37)
  assert.match(query, /FROM news_articles/)
})

test('news articles are ordered newest-first with a stable fallback and pagination', async () => {
  let executedSql = ''
  let executedParams = []
  const articles = await listNewsArticles({
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }, { limit: 21, page: 3 })

  assert.deepEqual(articles, [])
  assert.match(executedSql, /ORDER BY COALESCE\(published_at, created_at\) DESC, id DESC/i)
  assert.match(executedSql, /LIMIT \$1\s+OFFSET \$2/i)
  assert.deepEqual(executedParams, [21, 42])
})

test('news article queries apply actor and title filters as an intersection', async () => {
  let executedSql = ''
  let executedParams = []
  await listNewsArticles({
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }, { actorId: 7, movieId: 8, limit: 21, page: 2 })
  assert.match(executedSql, /news_article_actors filter_actor_link/)
  assert.match(executedSql, /news_article_movies filter_movie_link/)
  assert.match(executedSql, /WHERE .* AND /s)
  assert.deepEqual(executedParams, [7, 8, 21, 21])
})

test('public news API maps stored rows and exposes batches for infinite scrolling', async () => {
  const newsQueries = []
  const pool = {
    async query(sql, params = []) {
      if (!sql.includes('FROM news_articles') || !sql.includes('ORDER BY COALESCE')) return { rows: [], rowCount: 0 }
      newsQueries.push(params)
      if (params[1] === 0) {
        return { rows: [{ id: '11', title: 'First &#8216;story&#8217;', link: 'https://variety.com/first', published_at: '2026-09-14T08:00:00.000Z', photo_url: 'https://images.test/first.jpg', description: 'A &amp; brief description', actors: [{ id: 7, name: 'Ada Actor' }], movies: [{ id: 8, name: 'Example Movie' }], shows: [{ id: 9, name: 'Example Show' }] }] }
      }
      if (params[1] === 3) {
        return { rows: [
          { id: '8', title: 'Story eight', link: 'https://deadline.com/eight', published_at: '2026-09-13T08:00:00.000Z', photo_url: null, description: null },
          { id: '7', title: 'Story seven', link: 'https://deadline.com/seven', published_at: null, photo_url: null, description: null },
          { id: '6', title: 'Lookahead story', link: 'https://deadline.com/six', published_at: null, photo_url: null, description: null },
        ] }
      }
      return { rows: [] }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/news`
    const firstResponse = await fetch(baseUrl)
    const firstPayload = await firstResponse.json()
    assert.equal(firstResponse.status, 200)
    assert.deepEqual(firstPayload, {
      count: 1,
      articles: [{ id: 11, title: 'First ‘story’', link: 'https://variety.com/first', publishedAt: '2026-09-14T08:00:00.000Z', photoUrl: 'https://images.test/first.jpg', description: 'A & brief description', likeCount: 0, likedByCurrentUser: false, actors: [{ id: 7, name: 'Ada Actor' }], movies: [{ id: 8, name: 'Example Movie' }], shows: [{ id: 9, name: 'Example Show' }] }],
      pagination: { page: 1, pageSize: 20, hasNextPage: false, hasPreviousPage: false },
    })

    const nextPayload = await fetch(`${baseUrl}?page=2&limit=2`).then((response) => response.json())
    assert.equal(nextPayload.count, 2)
    assert.deepEqual(nextPayload.articles.map(({ id }) => id), [8, 7])
    assert.deepEqual(nextPayload.pagination, { page: 2, pageSize: 2, hasNextPage: true, hasPreviousPage: true })

    const emptyPayload = await fetch(`${baseUrl}?page=3&limit=2`).then((response) => response.json())
    assert.deepEqual(emptyPayload, { count: 0, articles: [], pagination: { page: 3, pageSize: 2, hasNextPage: false, hasPreviousPage: true } })
    assert.deepEqual(newsQueries, [[21, 0], [3, 3], [3, 6]])
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('news article likes are unique per user, reversible, and reject missing articles', async () => {
  const articleIds = new Set([11])
  const likes = new Set()
  const pool = {
    async query(sql, params = []) {
      if (sql.includes('SELECT COUNT(news_article_likes.user_id)')) {
        const articleId = params[0]
        if (!articleIds.has(articleId)) return { rows: [] }
        return { rows: [{ like_count: [...likes].filter((value) => value.startsWith(`${articleId}:`)).length }] }
      }
      if (sql.includes('INSERT INTO news_article_likes')) {
        likes.add(`${params[0]}:${params[1]}`)
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes('DELETE FROM news_article_likes')) {
        likes.delete(`${params[0]}:${params[1]}`)
        return { rows: [], rowCount: 1 }
      }
      return { rows: [] }
    },
  }

  assert.deepEqual(await addNewsArticleLikeForUser(pool, { articleId: 11, userId: 7 }), { status: 'ok', likedByCurrentUser: true, likeCount: 1 })
  assert.deepEqual(await addNewsArticleLikeForUser(pool, { articleId: 11, userId: 7 }), { status: 'ok', likedByCurrentUser: true, likeCount: 1 })
  assert.deepEqual(await addNewsArticleLikeForUser(pool, { articleId: 11, userId: 8 }), { status: 'ok', likedByCurrentUser: true, likeCount: 2 })
  assert.deepEqual(await removeNewsArticleLikeForUser(pool, { articleId: 11, userId: 7 }), { status: 'ok', likedByCurrentUser: false, likeCount: 1 })
  assert.deepEqual(await removeNewsArticleLikeForUser(pool, { articleId: 11, userId: 7 }), { status: 'ok', likedByCurrentUser: false, likeCount: 1 })
  assert.deepEqual(await addNewsArticleLikeForUser(pool, { articleId: 99, userId: 7 }), { status: 'missing_article' })
})

test('news article queries include totals and the authenticated viewer like state', async () => {
  let executedSql = ''
  let executedParams = []
  await listNewsArticles({
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      return { rows: [] }
    },
  }, { userId: '42', limit: 3, page: 2 })
  assert.match(executedSql, /COUNT\(\*\)::INTEGER FROM news_article_likes/)
  assert.match(executedSql, /viewer_like\.user_id = \$1/)
  assert.deepEqual(executedParams, [42, 3, 3])
})

test('news like API requires a user and reports the authenticated user state', async () => {
  const likes = new Set()
  const pool = {
    async query(sql, params = []) {
      if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX') || sql.includes('ALTER TABLE') || sql.includes('INSERT INTO achievement_')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM users') && sql.includes('WHERE username')) return { rows: [{ id: '7', username: params[0], full_name: 'Ada Viewer' }] }
      if (sql.includes('SELECT COUNT(news_article_likes.user_id)')) return params[0] === 11
        ? { rows: [{ like_count: [...likes].filter((value) => value.startsWith('11:')).length }] }
        : { rows: [] }
      if (sql.includes('INSERT INTO news_article_likes')) {
        likes.add(`${params[0]}:${params[1]}`)
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes('DELETE FROM news_article_likes')) {
        likes.delete(`${params[0]}:${params[1]}`)
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes('FROM news_articles') && sql.includes('ORDER BY COALESCE')) {
        return { rows: [{ id: '11', title: 'Liked story', link: 'https://example.test/liked', published_at: null, photo_url: null, description: null, like_count: likes.size, liked_by_current_user: likes.has('11:7'), actors: [], movies: [], shows: [] }] }
      }
      return { rows: [], rowCount: 0 }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/news/11/like`

  try {
    assert.equal((await fetch(baseUrl, { method: 'POST' })).status, 401)
    assert.deepEqual(await fetch(baseUrl, { method: 'POST', headers: { 'x-watchvault-username': 'ada' } }).then((response) => response.json()), { likeCount: 1, likedByCurrentUser: true })
    assert.deepEqual(await fetch(baseUrl, { method: 'POST', headers: { 'x-watchvault-username': 'ada' } }).then((response) => response.json()), { likeCount: 1, likedByCurrentUser: true })
    const feed = await fetch(`${baseUrl.replace('/11/like', '')}`, { headers: { 'x-watchvault-username': 'ada' } }).then((response) => response.json())
    assert.deepEqual(feed.articles.map(({ likeCount, likedByCurrentUser }) => ({ likeCount, likedByCurrentUser })), [{ likeCount: 1, likedByCurrentUser: true }])
    assert.deepEqual(await fetch(baseUrl, { method: 'DELETE', headers: { 'x-watchvault-username': 'ada' } }).then((response) => response.json()), { likeCount: 0, likedByCurrentUser: false })
    assert.equal((await fetch(`${baseUrl.replace('/11/', '/99/')}`, { method: 'POST', headers: { 'x-watchvault-username': 'ada' } })).status, 404)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
