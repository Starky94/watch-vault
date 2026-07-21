import { ensureBooksTable, upsertBooks } from './database.js'
import { fetchBooksByCategory, GOOGLE_BOOKS_CATEGORIES } from './googleBooksClient.js'

export function sanitizeBookDescription(description) {
  if (typeof description !== 'string') return null
  const plainText = description
    .replace(/<(?:br\s*\/?>|\/p\s*>|\/div\s*>|\/li\s*>|\/h[1-6]\s*>)/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, value) => String.fromCodePoint(value.startsWith('x') ? Number.parseInt(value.slice(1), 16) : Number.parseInt(value, 10)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return plainText || null
}

export function normalizeBook(volume, importRank) {
  const info = volume?.volumeInfo ?? {}
  return {
    googleBooksId: String(volume?.id || ''),
    title: info.title || 'Untitled',
    authors: Array.isArray(info.authors) ? info.authors.filter(Boolean) : [],
    description: sanitizeBookDescription(info.description),
    isbnIdentifiers: Array.isArray(info.industryIdentifiers)
      ? info.industryIdentifiers.filter((identifier) => identifier?.type && identifier?.identifier).map(({ type, identifier }) => ({ type, identifier })) : [],
    categories: Array.isArray(info.categories) ? info.categories.filter(Boolean).slice(0, 1) : [],
    coverImageUrl: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') || info.imageLinks?.smallThumbnail?.replace(/^http:/, 'https:') || null,
    publisher: info.publisher || null,
    publishedDate: info.publishedDate || null,
    pageCount: Number.isInteger(info.pageCount) ? info.pageCount : null,
    language: info.language || null,
    rawPayload: volume ?? {},
    importRank,
  }
}

export async function importBooks(pool, options = {}) {
  const { fetchImpl = fetch, apiKey, baseUrl, googleBooksBaseUrl, categories = GOOGLE_BOOKS_CATEGORIES, random = Math.random } = options
  if (!apiKey) throw new Error('Missing required environment variable: GOOGLE_BOOKS_API_KEY')
  const availableCategories = Array.isArray(categories) ? categories.filter((category) => typeof category === 'string' && category.trim()) : []
  if (availableCategories.length === 0) throw new Error('At least one Google Books category is required')
  const category = availableCategories[Math.min(availableCategories.length - 1, Math.floor(random() * availableCategories.length))]
  await ensureBooksTable(pool)
  const payload = await fetchBooksByCategory(fetchImpl, {
    apiKey,
    baseUrl: googleBooksBaseUrl ?? baseUrl,
    category,
    maxResults: 10,
  })
  const books = (Array.isArray(payload?.items) ? payload.items : [])
    .filter((volume) => volume?.id)
    .map((volume, index) => normalizeBook(volume, index + 1))
  const uniqueBooks = [...new Map(books.map((book) => [book.googleBooksId, book])).values()]
  const result = await upsertBooks(pool, uniqueBooks)
  return { category, fetchedCount: uniqueBooks.length, ...result }
}
