import test from 'node:test'
import assert from 'node:assert/strict'
import { importBooks, normalizeBook, sanitizeBookDescription } from '../bookImportService.js'
import { buildRelatedBooksUrl, buildTitleSearchUrl, buildVolumeByIdUrl, buildVolumesUrl, fetchBooksByCategory, searchBooksByTitle } from '../googleBooksClient.js'
import { addBookToReadForUser, addBookToWatchlistForUser, ensureBooksTable, getBookCommunityRating, listReadBooksForUser, listWatchlistBooksForUser, removeBookFromReadForUser, removeBookFromWatchlistForUser, upsertBookRatingForUser, upsertBooks } from '../database.js'
import { createApp } from '../app.js'

test('Google Books request targets a small book-only category query', () => {
  const url = new URL(buildVolumesUrl({ apiKey: 'test-key', category: 'Science Fiction' }))
  assert.equal(url.pathname, '/books/v1/volumes')
  assert.equal(url.searchParams.get('q'), 'subject:Science Fiction')
  assert.equal(url.searchParams.get('printType'), 'books')
  assert.equal(url.searchParams.get('maxResults'), '10')
  assert.equal(url.searchParams.get('key'), 'test-key')
})

test('Google Books related-book request uses a category query and requests one extra volume', () => {
  const url = new URL(buildRelatedBooksUrl({ apiKey: 'test-key', category: 'Science Fiction' }))
  assert.equal(url.pathname, '/books/v1/volumes')
  assert.equal(url.searchParams.get('q'), 'subject:Science Fiction')
  assert.equal(url.searchParams.get('printType'), 'books')
  assert.equal(url.searchParams.get('maxResults'), '11')
})

test('Google Books title and volume requests encode the requested book without database access', async () => {
  const titleUrl = new URL(buildTitleSearchUrl({ apiKey: 'test-key', query: 'Dune', maxResults: 99 }))
  assert.equal(titleUrl.searchParams.get('q'), 'intitle:Dune')
  assert.equal(titleUrl.searchParams.get('maxResults'), '40')
  const volumeUrl = new URL(buildVolumeByIdUrl({ apiKey: 'test-key', bookId: 'volume/id' }))
  assert.equal(volumeUrl.pathname, '/books/v1/volumes/volume%2Fid')
  const payload = await searchBooksByTitle(async () => ({ ok: true, json: async () => ({ items: [] }) }), { apiKey: 'test-key', query: 'Dune' })
  assert.deepEqual(payload, { items: [] })
})

test('normalizeBook preserves requested Google Books metadata and tolerates missing optional fields', () => {
  const book = normalizeBook({
    id: 'volume-id',
    volumeInfo: {
      title: 'Example Book', authors: ['Ada Author'], description: 'A description',
      industryIdentifiers: [{ type: 'ISBN_10', identifier: '123' }, { type: 'ISBN_13', identifier: '978123' }],
      categories: ['Fiction', 'Science Fiction'], imageLinks: { thumbnail: 'http://example.test/cover.jpg' },
      publisher: 'Example Press', publishedDate: '2024-01', pageCount: 240, language: 'en',
    },
  }, 3)
  assert.deepEqual(book, {
    googleBooksId: 'volume-id', title: 'Example Book', authors: ['Ada Author'], description: 'A description',
    isbnIdentifiers: [{ type: 'ISBN_10', identifier: '123' }, { type: 'ISBN_13', identifier: '978123' }],
    categories: ['Fiction'], coverImageUrl: 'https://example.test/cover.jpg', publisher: 'Example Press',
    publishedDate: '2024-01', pageCount: 240, language: 'en', rawPayload: book.rawPayload, importRank: 3,
  })
  const sparse = normalizeBook({ id: 'sparse', volumeInfo: {} }, 1)
  assert.deepEqual({ ...sparse, rawPayload: undefined }, {
    googleBooksId: 'sparse', title: 'Untitled', authors: [], description: null, isbnIdentifiers: [], categories: [],
    coverImageUrl: null, publisher: null, publishedDate: null, pageCount: null, language: null, rawPayload: undefined, importRank: 1,
  })
})

test('book descriptions are converted from Google Books HTML to readable text', () => {
  assert.equal(sanitizeBookDescription('<p>First &amp; <strong>second</strong>.</p><p>Next&nbsp;line &#x2014; done.</p>'), 'First & second.\nNext line — done.')
  assert.equal(normalizeBook({ id: 'html-book', volumeInfo: { description: '<em>Readable</em> description' } }, 1).description, 'Readable description')
})

test('fetchBooksByCategory returns the parsed Google Books payload and surfaces failures', async () => {
  const payload = await fetchBooksByCategory(async () => ({ ok: true, json: async () => ({ items: [] }) }), { apiKey: 'key', category: 'Fiction' })
  assert.deepEqual(payload, { items: [] })
  await assert.rejects(() => fetchBooksByCategory(async () => ({ ok: false, status: 429 }), { apiKey: 'key', category: 'Fiction', sleep: async () => {} }), /429/)
})

test('fetchBooksByCategory retries temporary Google Books failures with exponential backoff', async () => {
  let requests = 0
  const delays = []
  const payload = await fetchBooksByCategory(async () => {
    requests += 1
    return requests < 3 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ items: ['recovered'] }) }
  }, { apiKey: 'key', category: 'Fiction', sleep: async (delay) => { delays.push(delay) } })
  assert.deepEqual(payload, { items: ['recovered'] })
  assert.equal(requests, 3)
  assert.deepEqual(delays, [250, 500])
})

test('book imports select one random category per run', async () => {
  const requestedUrls = []
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      query: async (sql) => sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' ? { rows: [] } : { rows: [{ inserted: true }] },
      release() {},
    }),
  }
  const result = await importBooks(pool, {
    apiKey: 'test-key',
    categories: ['Fiction', 'History', 'Travel'],
    random: () => 0.5,
    fetchImpl: async (url) => {
      requestedUrls.push(String(url))
      return { ok: true, json: async () => ({ items: [{ id: 'history-book', volumeInfo: { title: 'History Book' } }] }) }
    },
  })

  assert.equal(result.category, 'History')
  assert.equal(result.fetchedCount, 1)
  assert.equal(requestedUrls.length, 1)
  assert.equal(new URL(requestedUrls[0]).searchParams.get('q'), 'subject:History')
})

test('upsertBooks reports inserted and refreshed volumes without duplicating their IDs', async () => {
  let calls = 0
  const client = {
    async query(sql, params) {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      calls += 1
      return { rows: [{ inserted: calls === 1 }] }
    },
    release() {},
  }
  const result = await upsertBooks({ connect: async () => client }, [
    { googleBooksId: 'first', title: 'First', authors: [], description: null, isbnIdentifiers: [], categories: [], coverImageUrl: null, publisher: null, publishedDate: null, pageCount: null, language: null, rawPayload: {}, importRank: 1 },
    { googleBooksId: 'first', title: 'First updated', authors: [], description: null, isbnIdentifiers: [], categories: [], coverImageUrl: null, publisher: null, publishedDate: null, pageCount: null, language: null, rawPayload: {}, importRank: 2 },
  ])
  assert.deepEqual(result, { insertedCount: 1, updatedCount: 1 })
})

test('book watchlist schema and helpers use a per-user, 30-book collection', async () => {
  const schemaQueries = []
  await ensureBooksTable({ query: async (sql) => { schemaQueries.push(sql); return { rows: [] } } })
  const schema = schemaQueries.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS book_watchlist_items'))
  assert.match(schema, /UNIQUE \(user_id, book_id\)/)

  let executedSql = ''
  const pool = {
    async query(sql) {
      executedSql = sql
      if (sql.includes('INSERT INTO book_watchlist_items')) return { rows: [{ has_user: true, has_book: true, watchlist_total: 0, already_saved: false, added: true }] }
      if (sql.includes('DELETE FROM book_watchlist_items')) return { rows: [{ has_user: true, has_book: true, removed: true }] }
      return { rows: [{ google_books_id: 'volume-id', title: 'Example Book' }] }
    },
  }
  assert.deepEqual(await addBookToWatchlistForUser(pool, { username: 'reader', bookId: 'volume-id' }), { status: 'ok', added: true })
  assert.match(executedSql, /watchlist_total\.total < 30/i)
  assert.deepEqual(await removeBookFromWatchlistForUser(pool, { username: 'reader', bookId: 'volume-id' }), { status: 'ok', removed: true })
  assert.match(executedSql, /DELETE FROM book_watchlist_items/i)
  assert.deepEqual(await listWatchlistBooksForUser(pool, 'reader'), [{ google_books_id: 'volume-id', title: 'Example Book' }])
  assert.match(executedSql, /ORDER BY book_watchlist_items\.created_at DESC/i)
})

test('book read schema and helpers record a per-user history and remove watchlist entries', async () => {
  const schemaQueries = []
  await ensureBooksTable({ query: async (sql) => { schemaQueries.push(sql); return { rows: [] } } })
  const schema = schemaQueries.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS read_books'))
  assert.match(schema, /UNIQUE \(user_id, book_id\)/)
  assert.match(schema, /reading_format TEXT NOT NULL DEFAULT 'physical'/i)
  assert.ok(schemaQueries.some((sql) => sql.includes("UPDATE read_books SET reading_format = 'physical'")))

  let executedSql = ''
  let executedParams = []
  const pool = {
    async query(sql, params) {
      executedSql = sql
      executedParams = params
      if (sql.includes('INSERT INTO read_books')) return { rows: [{ has_user: true, has_book: true, added: true, removed_from_watchlist: true, created_at: '2026-07-21T00:00:00.000Z' }] }
      if (sql.includes('DELETE FROM read_books')) return { rows: [{ has_user: true, has_book: true, removed: true }] }
      return { rows: [{ google_books_id: 'volume-id', title: 'Example Book' }] }
    },
  }
  assert.deepEqual(await addBookToReadForUser(pool, { username: 'reader', bookId: 'volume-id', readingFormat: 'audiobook' }), { status: 'ok', added: true, removedFromWatchlist: true, createdAt: '2026-07-21T00:00:00.000Z' })
  assert.match(executedSql, /INSERT INTO read_books \(user_id, book_id, reading_format, completion_metadata, created_at\)/i)
  assert.equal(executedParams[2], 'audiobook')
  assert.match(executedSql, /DELETE FROM book_watchlist_items/i)
  assert.deepEqual(await removeBookFromReadForUser(pool, { username: 'reader', bookId: 'volume-id' }), { status: 'ok', removed: true })
  assert.match(executedSql, /DELETE FROM read_books/i)
  assert.deepEqual(await listReadBooksForUser(pool, 'reader'), [{ google_books_id: 'volume-id', title: 'Example Book' }])
  assert.match(executedSql, /ORDER BY read_books\.created_at DESC/i)
})

test('book ratings use one validated per-user score and return community totals', async () => {
  const schemaQueries = []
  await ensureBooksTable({ query: async (sql) => { schemaQueries.push(sql); return { rows: [] } } })
  const schema = schemaQueries.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS book_ratings'))
  assert.match(schema, /UNIQUE \(user_id, book_id\)/)
  assert.match(schema, /score >= 1\.0 AND score <= 5\.0/i)

  const queries = []
  const pool = {
    async query(sql) {
      queries.push(sql)
      if (sql.includes('INSERT INTO book_ratings')) return { rows: [{ has_user: true, has_book: true, score: 4.5 }] }
      return { rows: [{ has_book: true, average: 4.25, vote_count: 2, your_score: 4.5 }] }
    },
  }
  assert.deepEqual(await upsertBookRatingForUser(pool, { username: 'reader', bookId: 'volume-id', score: 4.5 }), { status: 'ok', score: 4.5 })
  assert.match(queries[0], /ON CONFLICT \(user_id, book_id\)/i)
  assert.deepEqual(await getBookCommunityRating(pool, { bookId: 'volume-id', username: 'reader' }), { status: 'ok', average: 4.25, voteCount: 2, yourScore: 4.5 })
  assert.match(queries[1], /AVG\(book_ratings\.score\)/i)
})

test('book rating helpers report missing users and books', async () => {
  const responses = [{ has_user: false }, { has_user: true, has_book: false }, { has_book: false }]
  const pool = { query: async () => ({ rows: [responses.shift()] }) }
  assert.deepEqual(await upsertBookRatingForUser(pool, { username: 'missing', bookId: 'volume-id', score: 4 }), { status: 'missing_user' })
  assert.deepEqual(await upsertBookRatingForUser(pool, { username: 'reader', bookId: 'missing', score: 4 }), { status: 'missing_book' })
  assert.deepEqual(await getBookCommunityRating(pool, { bookId: 'missing' }), { status: 'missing_book' })
})

test('book read API authenticates, returns history, and supports marking read and unread', async () => {
  const readBook = {
    google_books_id: 'volume-id', title: 'Example Book', authors: ['Ada Author'], categories: ['Fiction'],
    cover_image_url: 'https://example.test/cover.jpg', published_date: '2024', reading_format: 'ebook', completion_metadata: { tropes: ['Found family', 'Slow burn'] }, read_at: '2026-07-21T00:00:00.000Z',
  }
  let insertedCompletionMetadata = null
  const pool = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO read_books')) {
        insertedCompletionMetadata = JSON.parse(params[3])
        return { rows: [{ has_user: true, has_book: true, added: true, removed_from_watchlist: true }] }
      }
      if (sql.includes('DELETE FROM read_books')) return { rows: [{ has_user: true, has_book: true, removed: true }] }
      if (sql.includes('FROM read_books') && sql.includes('JOIN users')) return { rows: [readBook] }
      if (sql.includes('FROM users') && sql.includes('WHERE username = $1')) return { rows: [{ id: 1, username: 'reader', full_name: 'Reader' }] }
      return { rows: [], rowCount: 0 }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  try {
    const { port } = server.address()
    const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/read/books`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: 'volume-id', readingFormat: 'ebook' }) })
    assert.equal(unauthenticated.status, 401)

    const invalidFormat = await fetch(`http://127.0.0.1:${port}/api/read/books`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: 'volume-id', readingFormat: 'paperback' }) })
    assert.equal(invalidFormat.status, 400)

    const headers = { 'Content-Type': 'application/json', 'x-watchvault-username': 'reader' }
    const history = await fetch(`http://127.0.0.1:${port}/api/read/books`, { headers })
    assert.deepEqual(await history.json(), { count: 1, books: [{ id: 'volume-id', title: 'Example Book', year: '2024', meta: 'Ada Author', categoriesLabel: 'Fiction', type: 'Books', posterUrl: 'https://example.test/cover.jpg', watchlistedAt: null, readAt: '2026-07-21T00:00:00.000Z', readingFormat: 'ebook', completionMetadata: { tropes: ['Found family', 'Slow burn'] } }] })

    const added = await fetch(`http://127.0.0.1:${port}/api/read/books`, { method: 'POST', headers, body: JSON.stringify({ bookId: 'volume-id', readingFormat: 'ebook', completionMetadata: { tropes: [' Found family ', 'Found family', '', 'Slow burn', 7] } }) })
    assert.equal(added.status, 200)
    assert.deepEqual(insertedCompletionMetadata, { tropes: ['Found family', 'Slow burn'] })
    const addedPayload = await added.json()
    assert.equal(addedPayload.removedFromWatchlist, true)
    assert.deepEqual(addedPayload.book.completionMetadata, { tropes: ['Found family', 'Slow burn'] })

    const removed = await fetch(`http://127.0.0.1:${port}/api/read/books/volume-id`, { method: 'DELETE', headers: { 'x-watchvault-username': 'reader' } })
    assert.deepEqual(await removed.json(), { removed: true })
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('book rating API validates scores, authenticates users, and returns refreshed ratings', async () => {
  const pool = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO book_ratings')) return { rows: [params[2] === 4.5 ? { has_user: true, has_book: true, score: 4.5 } : { has_user: true, has_book: false }] }
      if (sql.includes('AVG(book_ratings.score)')) return { rows: [{ has_book: true, average: 4.5, vote_count: 1, your_score: 4.5 }] }
      if (sql.includes('FROM users') && sql.includes('WHERE username = $1')) return { rows: [{ id: 1, username: 'reader', full_name: 'Reader' }] }
      return { rows: [], rowCount: 0 }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  try {
    const { port } = server.address()
    const invalid = await fetch(`http://127.0.0.1:${port}/api/books/volume-id/rating`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 4.2 }) })
    assert.equal(invalid.status, 400)

    const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/books/volume-id/rating`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: 4.5 }) })
    assert.equal(unauthenticated.status, 401)

    const headers = { 'Content-Type': 'application/json', 'x-watchvault-username': 'reader' }
    const saved = await fetch(`http://127.0.0.1:${port}/api/books/volume-id/rating`, { method: 'PUT', headers, body: JSON.stringify({ score: 4.5 }) })
    assert.equal(saved.status, 200)
    assert.deepEqual(await saved.json(), { communityRating: { average: 4.5, voteCount: 1, yourScore: 4.5 } })

    const missing = await fetch(`http://127.0.0.1:${port}/api/books/missing/rating`, { method: 'PUT', headers, body: JSON.stringify({ score: 4 }) })
    assert.equal(missing.status, 404)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('book watchlist helpers report missing books and capacity limits', async () => {
  const responses = [
    { has_user: true, has_book: false },
    { has_user: true, has_book: true, watchlist_total: 30, already_saved: false },
    { has_user: true, has_book: true, watchlist_total: 30, already_saved: true, added: false },
  ]
  const pool = { query: async () => ({ rows: [responses.shift()] }) }
  assert.deepEqual(await addBookToWatchlistForUser(pool, { username: 'reader', bookId: 'missing' }), { status: 'missing_book' })
  assert.deepEqual(await addBookToWatchlistForUser(pool, { username: 'reader', bookId: 'volume-id' }), { status: 'limit_reached', limit: 30 })
  assert.deepEqual(await addBookToWatchlistForUser(pool, { username: 'reader', bookId: 'already-saved' }), { status: 'ok', added: false })
})

test('book watchlist API authenticates and returns saved books', async () => {
  const savedBook = {
    google_books_id: 'volume-id', title: 'Example Book', authors: ['Ada Author'], categories: ['Fiction'],
    cover_image_url: 'https://example.test/cover.jpg', published_date: '2024', watchlisted_at: '2026-07-21T00:00:00.000Z',
  }
  const pool = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO book_watchlist_items')) {
        return { rows: [params[1] === 'full-book'
          ? { has_user: true, has_book: true, watchlist_total: 30, already_saved: false, added: false }
          : { has_user: true, has_book: true, watchlist_total: 0, already_saved: false, added: true }] }
      }
      if (sql.includes('DELETE FROM book_watchlist_items')) return { rows: [{ has_user: true, has_book: true, removed: true }] }
      if (sql.includes('FROM book_watchlist_items') && sql.includes('JOIN users')) return { rows: [savedBook] }
      if (sql.includes('FROM users') && sql.includes('WHERE username = $1')) return { rows: [{ id: 1, username: 'reader', full_name: 'Reader' }] }
      return { rows: [], rowCount: 0 }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  try {
    const { port } = server.address()
    const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/watchlist/books`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: 'volume-id' }) })
    assert.equal(unauthenticated.status, 401)

    const headers = { 'Content-Type': 'application/json', 'x-watchvault-username': 'reader' }
    const added = await fetch(`http://127.0.0.1:${port}/api/watchlist/books`, { method: 'POST', headers, body: JSON.stringify({ bookId: 'volume-id' }) })
    assert.equal(added.status, 200)
    assert.deepEqual((await added.json()).book, {
      id: 'volume-id', title: 'Example Book', year: '2024', meta: 'Ada Author', categoriesLabel: 'Fiction',
      type: 'Books', posterUrl: 'https://example.test/cover.jpg', watchlistedAt: '2026-07-21T00:00:00.000Z',
    })

    const limitReached = await fetch(`http://127.0.0.1:${port}/api/watchlist/books`, { method: 'POST', headers, body: JSON.stringify({ bookId: 'full-book' }) })
    assert.equal(limitReached.status, 409)
    assert.match((await limitReached.json()).error, /up to 30 books/i)

    const removed = await fetch(`http://127.0.0.1:${port}/api/watchlist/books/volume-id`, { method: 'DELETE', headers: { 'x-watchvault-username': 'reader' } })
    assert.equal(removed.status, 200)
    assert.deepEqual(await removed.json(), { removed: true })
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('Books API paginates local rows and returns a stored detail record', async () => {
  const row = { google_books_id: 'volume-id', title: 'Example Book', authors: ['Ada Author'], description: 'Description', isbn_identifiers: [], categories: ['Fiction'], cover_image_url: null, publisher: 'Press', published_date: '2024', page_count: 100, language: 'en' }
  const pool = {
    async query(sql) {
      if (sql.includes('FROM books WHERE google_books_id')) return { rows: [row] }
      if (sql.includes('FROM books ORDER BY')) return { rows: [row, { ...row, google_books_id: 'next-volume' }] }
      return { rows: [], rowCount: 0 }
    },
  }
  const app = await createApp(pool)
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  try {
    const { port } = server.address()
    const listResponse = await fetch(`http://127.0.0.1:${port}/api/books?page=1&limit=1`)
    const listPayload = await listResponse.json()
    assert.equal(listResponse.status, 200)
    assert.equal(listPayload.books.length, 1)
    assert.equal(listPayload.pagination.hasNextPage, true)
    const detailResponse = await fetch(`http://127.0.0.1:${port}/api/books/volume-id`)
    assert.deepEqual(await detailResponse.json(), { book: { ...row, communityRating: { average: null, voteCount: 0, yourScore: null } } })
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('Google Books search is read-only and selecting a volume persists it before returning detail', async () => {
  const storedBook = { google_books_id: 'volume-id', title: 'Example Book', authors: ['Ada Author'], description: null, isbn_identifiers: [], categories: [], cover_image_url: null, publisher: null, published_date: '2024', page_count: null, language: 'en' }
  let nonSchemaReads = 0
  let upsertCalls = 0
  const pool = {
    async query(sql) {
      if (sql.includes('FROM books WHERE google_books_id')) return { rows: [storedBook] }
      return { rows: [], rowCount: 0 }
    },
    async connect() {
      return {
        async query(sql) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
          if (sql.includes('INSERT INTO books')) {
            upsertCalls += 1
            return { rows: [{ inserted: upsertCalls === 1 }] }
          }
          if (sql.includes('SELECT id FROM books')) return { rows: [{ id: 1 }] }
          if (sql.includes('INSERT INTO authors')) return { rows: [{ id: 2 }] }
          return { rows: [] }
        },
        release() {},
      }
    },
  }
  const originalFetch = global.fetch
  const googleRequests = []
  global.fetch = async (url) => {
    if (!String(url).startsWith('https://books.example.test')) return originalFetch(url)
    googleRequests.push(String(url))
    return {
      ok: true,
      async json() {
        return String(url).includes('/volumes/volume-id')
          ? { id: 'volume-id', volumeInfo: { title: 'Example Book', authors: ['Ada Author'], publishedDate: '2024' } }
          : { items: Array.from({ length: 21 }, (_value, index) => ({ id: `volume-${index + 1}`, volumeInfo: { title: `Book ${index + 1}` } })) }
      },
    }
  }
  const app = await createApp(pool, { loadRuntimeConfig: () => ({ googleBooksApiKey: 'key', googleBooksBaseUrl: 'https://books.example.test/books/v1' }) })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  try {
    const { port } = server.address()
    const searchResponse = await originalFetch(`http://127.0.0.1:${port}/api/search/books?q=%20Dune%20`)
    assert.equal(searchResponse.status, 200)
    const searchPayload = await searchResponse.json()
    assert.equal(searchPayload.query, 'Dune')
    assert.equal(searchPayload.books.length, 20)
    assert.equal(upsertCalls, 0)
    assert.equal(nonSchemaReads, 0)
    assert.match(googleRequests[0], /q=intitle%3ADune/)

    const persistResponse = await originalFetch(`http://127.0.0.1:${port}/api/books/volume-id`, { method: 'POST' })
    assert.equal(persistResponse.status, 201)
    assert.deepEqual(await persistResponse.json(), { book: storedBook })
    assert.equal(upsertCalls, 1)
    assert.ok(googleRequests.some((url) => url.includes('/volumes/volume-id')))
  } finally {
    global.fetch = originalFetch
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('Related books are fetched live by category without persisting the recommendations', async () => {
  const storedBook = { google_books_id: 'current-volume', title: 'Current Book', authors: ['Ada Author'], description: null, isbn_identifiers: [], categories: ['Fiction'], cover_image_url: null, publisher: null, published_date: '2024', page_count: null, language: 'en' }
  let upsertCalls = 0
  const pool = {
    async query(sql) {
      if (sql.includes('FROM books WHERE google_books_id')) return { rows: [storedBook] }
      return { rows: [], rowCount: 0 }
    },
    async connect() {
      return {
        async query(sql) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
          upsertCalls += 1
          return { rows: [{ inserted: true }] }
        },
        release() {},
      }
    },
  }
  const originalFetch = global.fetch
  const googleRequests = []
  global.fetch = async (url) => {
    if (!String(url).startsWith('https://books.example.test')) return originalFetch(url)
    googleRequests.push(String(url))
    return {
      ok: true,
      async json() {
        return {
          items: [
            { id: 'current-volume', volumeInfo: { title: 'Current Book' } },
            ...Array.from({ length: 11 }, (_value, index) => ({ id: `related-${index + 1}`, volumeInfo: { title: `Related ${index + 1}`, categories: ['Fiction'] } })),
          ],
        }
      },
    }
  }
  const app = await createApp(pool, { loadRuntimeConfig: () => ({ googleBooksApiKey: 'key', googleBooksBaseUrl: 'https://books.example.test/books/v1' }) })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject) })
  try {
    const { port } = server.address()
    const response = await originalFetch(`http://127.0.0.1:${port}/api/books/current-volume/related`)
    const payload = await response.json()
    assert.equal(response.status, 200)
    assert.equal(payload.count, 10)
    assert.equal(payload.books.length, 10)
    assert.ok(payload.books.every((book) => book.googleBooksId !== 'current-volume'))
    assert.equal(upsertCalls, 0)
    assert.match(googleRequests[0], /q=subject%3AFiction/)
    assert.match(googleRequests[0], /maxResults=11/)
  } finally {
    global.fetch = originalFetch
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
