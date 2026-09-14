import { XMLParser } from 'fast-xml-parser'
import { ensureNewsTables, linkNewsArticlesToActors, linkNewsArticlesToMovies, linkNewsArticlesToTvShows, listNewsActors, listNewsMovies, listNewsTvShows, upsertNewsArticles } from './database.js'

export const ENTERTAINMENT_NEWS_FEEDS = [
  'https://variety.com/feed/',
  'https://variety.com/v/film/feed/',
  'https://deadline.com/feed/',
  'https://www.hollywoodreporter.com/feed/',
]

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  trimValues: true,
})

function asArray(value) {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]
}

function textValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (!value || typeof value !== 'object') return ''
  return textValue(value.__cdata ?? value['#text'] ?? value['@_href'] ?? value['@_url'] ?? '')
}

function firstUrl(values) {
  for (const value of asArray(values)) {
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (value && typeof value === 'object') {
      const url = value['@_url'] ?? value['@_href'] ?? value.url
      if (typeof url === 'string' && url.trim()) return url.trim()
    }
  }
  return null
}

function imageFromHtml(value) {
  const match = textValue(value).match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)
  return match?.[1] ?? null
}

function decodeHtmlEntities(value) {
  const namedEntities = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' }
  return String(value || '').replace(/&(#(?:x[0-9a-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity) => {
    if (entity[0] !== '#') return namedEntities[entity.toLocaleLowerCase()] ?? match
    const hexadecimal = entity[1]?.toLocaleLowerCase() === 'x'
    const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10)
    try {
      return Number.isInteger(codePoint) ? String.fromCodePoint(codePoint) : match
    } catch {
      return match
    }
  })
}

function descriptionFromHtml(value, title) {
  const description = decodeHtmlEntities(textValue(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  return description && description !== title ? description : null
}

export function canonicalizeNewsLink(value) {
  const link = textValue(value)
  if (!link) return null
  try {
    const url = new URL(link)
    url.hash = ''
    return url.toString()
  } catch {
    return link
  }
}

export function normalizeNewsActorName(value) {
  return textValue(value).normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

export function normalizeNewsItem(item) {
  const title = textValue(item?.title)
  const link = canonicalizeNewsLink(item?.link)
  if (!title || !link) return null
  const publishedCandidate = textValue(item?.pubDate ?? item?.published ?? item?.updated)
  const publishedAt = publishedCandidate && !Number.isNaN(Date.parse(publishedCandidate)) ? new Date(publishedCandidate).toISOString() : null
  const photoUrl = firstUrl(item?.['media:content'])
    ?? firstUrl(item?.['media:thumbnail'])
    ?? firstUrl(item?.enclosure)
    ?? firstUrl(item?.['itunes:image'])
    ?? firstUrl(item?.image?.url ?? item?.image)
    ?? imageFromHtml(item?.['content:encoded'])
    ?? imageFromHtml(item?.description)
  const description = descriptionFromHtml(item?.['content:encoded'] ?? item?.description ?? item?.summary, title)
  const categories = [...new Set(asArray(item?.category).map(normalizeNewsActorName).filter(Boolean))]
  return { title, link, publishedAt, photoUrl, description, categories }
}

export function parseNewsFeed(xml) {
  const document = xmlParser.parse(xml)
  const channel = document?.rss?.channel ?? document?.feed
  return asArray(channel?.item ?? channel?.entry).map(normalizeNewsItem).filter(Boolean)
}

async function fetchNewsFeed(fetchImpl, url) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'user-agent': 'WatchVault entertainment-news importer',
    },
  })
  if (!response.ok) throw new Error(`RSS request failed (${response.status}) for ${url}`)
  return parseNewsFeed(await response.text())
}

export async function importEntertainmentNews(pool, { fetchImpl = fetch, feeds = ENTERTAINMENT_NEWS_FEEDS } = {}) {
  await ensureNewsTables(pool)
  const settledFeeds = await Promise.allSettled(feeds.map((url) => fetchNewsFeed(fetchImpl, url)))
  const errors = []
  const articleByLink = new Map()
  let fetchedCount = 0

  settledFeeds.forEach((result, index) => {
    if (result.status === 'rejected') {
      errors.push({ feed: feeds[index], message: result.reason?.message ?? String(result.reason) })
      return
    }
    for (const article of result.value) {
      fetchedCount += 1
      const existing = articleByLink.get(article.link)
      articleByLink.set(article.link, existing
        ? {
            ...existing,
            title: article.title || existing.title,
            publishedAt: article.publishedAt ?? existing.publishedAt,
            photoUrl: article.photoUrl ?? existing.photoUrl,
            description: article.description ?? existing.description,
            categories: [...new Set([...existing.categories, ...article.categories])],
          }
        : article)
    }
  })

  const articles = [...articleByLink.values()]
  const [{ articleIdsByLink, insertedCount, updatedCount }, actors, movies, shows] = await Promise.all([
    upsertNewsArticles(pool, articles),
    listNewsActors(pool),
    listNewsMovies(pool),
    listNewsTvShows(pool),
  ])
  const actorIdsByName = new Map()
  for (const actor of actors) {
    const name = normalizeNewsActorName(actor.name)
    if (!name) continue
    const actorIds = actorIdsByName.get(name) ?? []
    actorIds.push(actor.id)
    actorIdsByName.set(name, actorIds)
  }

  const actorLinks = articles.flatMap((article) => article.categories.flatMap((category) =>
    (actorIdsByName.get(category) ?? []).map((actorId) => ({ articleId: articleIdsByLink.get(article.link), actorId }))
  ))
  const createTitleIdsByName = (items, label) => {
    const idsByName = new Map()
    for (const item of items) {
      const name = normalizeNewsActorName(item[label])
      if (!name) continue
      idsByName.set(name, [...(idsByName.get(name) ?? []), item.id])
    }
    return idsByName
  }
  const movieIdsByName = createTitleIdsByName(movies, 'title')
  const showIdsByName = createTitleIdsByName(shows, 'name')
  const createTitleLinks = (idsByName) => articles.flatMap((article) => article.categories.flatMap((category) =>
    (idsByName.get(category) ?? []).map((entityId) => ({ articleId: articleIdsByLink.get(article.link), entityId }))
  ))
  const [linkedActorCount, linkedMovieCount, linkedShowCount] = await Promise.all([
    linkNewsArticlesToActors(pool, actorLinks),
    linkNewsArticlesToMovies(pool, createTitleLinks(movieIdsByName)),
    linkNewsArticlesToTvShows(pool, createTitleLinks(showIdsByName)),
  ])
  return { fetchedCount, insertedCount, updatedCount, linkedActorCount, linkedMovieCount, linkedShowCount, failedFeedCount: errors.length, errors }
}
