export const GOOGLE_BOOKS_CATEGORIES = [
  'Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery & Detective',
  'Romance',
  'Thrillers',
  'Historical Fiction',
  'Biography & Autobiography',
  'History',
  'Business & Economics',
  'Computers',
  'Cooking',
  'Health & Fitness',
  'Self-Help',
  'Travel',
  'Art',
  'Juvenile Fiction',
]

export function buildVolumesUrl({ baseUrl = 'https://www.googleapis.com/books/v1', apiKey, category, maxResults = 10 }) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/volumes`)
  url.searchParams.set('q', `subject:${category}`)
  url.searchParams.set('printType', 'books')
  url.searchParams.set('maxResults', String(Math.min(40, Math.max(1, maxResults))))
  url.searchParams.set('key', apiKey)
  return url.toString()
}

export function buildRelatedBooksUrl({ baseUrl = 'https://www.googleapis.com/books/v1', apiKey, category, maxResults = 11 }) {
  return buildVolumesUrl({ baseUrl, apiKey, category, maxResults })
}

export function buildTitleSearchUrl({ baseUrl = 'https://www.googleapis.com/books/v1', apiKey, query, maxResults = 20 }) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/volumes`)
  url.searchParams.set('q', `intitle:${query}`)
  url.searchParams.set('printType', 'books')
  url.searchParams.set('maxResults', String(Math.min(40, Math.max(1, maxResults))))
  url.searchParams.set('key', apiKey)
  return url.toString()
}

export function buildVolumeByIdUrl({ baseUrl = 'https://www.googleapis.com/books/v1', apiKey, bookId }) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/volumes/${encodeURIComponent(bookId)}`)
  url.searchParams.set('key', apiKey)
  return url.toString()
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchGoogleBooksPayload(fetchImpl, url, { retries = 3, sleep = wait }) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetchImpl(url)
    if (response.ok) return response.json()

    const isTransient = response.status === 429 || response.status >= 500
    if (!isTransient || attempt === retries) {
      throw new Error(`Google Books request failed with status ${response.status}`)
    }

    await sleep(250 * (2 ** attempt))
  }

  throw new Error('Google Books request failed without a response')
}

export async function fetchBooksByCategory(fetchImpl, options) {
  const url = buildVolumesUrl(options)
  return fetchGoogleBooksPayload(fetchImpl, url, options)
}

export async function fetchRelatedBooksByCategory(fetchImpl, options) {
  return fetchGoogleBooksPayload(fetchImpl, buildRelatedBooksUrl(options), options)
}

export async function searchBooksByTitle(fetchImpl, options) {
  return fetchGoogleBooksPayload(fetchImpl, buildTitleSearchUrl(options), options)
}

export async function fetchBookById(fetchImpl, options) {
  return fetchGoogleBooksPayload(fetchImpl, buildVolumeByIdUrl(options), options)
}
