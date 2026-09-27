import { NEWS_CATEGORIES } from '../shared/newsCategories.js'

export const ENTERTAINMENT_NEWS_SOURCES = [
  { key: 'bbc-formula-1', name: 'BBC Sport Formula 1', category: 'formula-1', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml?edition=int' },
  { key: 'ign-ps5', name: 'IGN PS5', category: 'games', url: 'https://feeds.feedburner.com/IGNPS5Articles' },
  { key: 'ign-movies', name: 'IGN Movies', category: 'movies', url: 'https://feeds.feedburner.com/ign/movies-articles' },
  { key: 'ign-tv', name: 'IGN TV', category: 'tv-shows', url: 'https://feeds.feedburner.com/ign/tv-articles' },
]

export const entertainmentNewsSourceKeys = new Set(ENTERTAINMENT_NEWS_SOURCES.map((source) => source.key))
export const newsCategoryKeys = new Set(NEWS_CATEGORIES.map((category) => category.key))
