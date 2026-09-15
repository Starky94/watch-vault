export const ENTERTAINMENT_NEWS_SOURCES = [
  { key: 'variety', name: 'Variety', url: 'https://variety.com/feed/' },
  { key: 'variety-film', name: 'Variety Film', url: 'https://variety.com/v/film/feed/' },
  { key: 'deadline', name: 'Deadline', url: 'https://deadline.com/feed/' },
  { key: 'hollywood-reporter', name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/' },
  { key: 'filmnow', name: 'Film Now', url: 'https://www.filmnow.ro/rss' },
  { key: 'e-online', name: 'E! Online', url: 'https://eol-feeds.eonline.com/rssfeed/us/top_stories' },
  { key: 'profm', name: 'ProFM', url: 'https://www.profm.ro/rss' },
]

export const entertainmentNewsSourceKeys = new Set(ENTERTAINMENT_NEWS_SOURCES.map((source) => source.key))
