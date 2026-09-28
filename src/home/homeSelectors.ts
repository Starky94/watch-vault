import type {
  ContinueWatchingState, HomeItem, HomeKind, HomeQueue,
  HomeQueueItem, HomeSource, HomeTvShow, HomeUser, HomeWatchlistItem,
  HomeWatchlistState, NextUpItem, PopularMoviesState, TonightPick,
} from './homeTypes.ts'

function makeQueueItem(item: HomeItem, source: HomeSource): HomeQueueItem {
  const artwork = {
    portrait: item.posterUrl || item.backdropUrl || null,
    landscape: item.backdropUrl || item.posterUrl || null,
  }
  const queueItem: HomeQueueItem = {
    item, source, id: item.id, watchlistedAt: item.watchlistedAt || null,
    topSlot: Number.isInteger(item.topSlot) && (item.topSlot ?? 0) >= 1 && (item.topSlot ?? 0) <= 3 ? item.topSlot! : null,
    queuePosition: Number.isInteger(item.queuePosition) && (item.queuePosition ?? 0) >= 1 ? item.queuePosition! : null,
    artwork, tonight: null, nextUp: null,
  }

  if (source === 'continue' && item.kind === 'tv') {
    queueItem.tonight = { reason: 'Continue where you left off', detail: `${item.latestWatchedEpisodeLabel} · ${item.progress}% complete` }
    queueItem.nextUp = { kicker: 'Continue next episode', detail: `${item.nextEpisodeLabel} · ${item.nextEpisodeTitle}`, actionLabel: 'Continue' }
  } else if (source === 'featured' && item.kind === 'movie') {
    queueItem.tonight = { reason: 'Popular tonight', detail: item.genreLabel || '' }
  } else if (item.kind === 'movie') {
    queueItem.tonight = { reason: 'From your watchlist', detail: item.meta || '' }
    queueItem.nextUp = {
      kicker: watchlistKicker(queueItem, 'movie'),
      detail: [item.runtime, item.streamingService].filter((value) => value && !value.includes('TBA')).join(' · ') || item.meta || '',
      actionLabel: 'Start movie',
    }
  } else if (item.kind === 'tv') {
    queueItem.nextUp = { kicker: watchlistKicker(queueItem, 'show'), detail: item.meta || '', actionLabel: 'Start show' }
  } else {
    queueItem.nextUp = { kicker: watchlistKicker(queueItem, 'book'), detail: `${item.meta} · ${item.categoriesLabel}`, actionLabel: 'Start reading' }
  }
  return queueItem
}

function watchlistKicker(entry: HomeQueueItem, label: string): string {
  if (entry.topSlot !== null) return `Top ${entry.topSlot} ${label}`
  if (entry.queuePosition !== null) return `Queue #${entry.queuePosition} ${label}`
  return `Watchlist ${label}`
}

const mediaOrder: Record<HomeKind, number> = { movie: 0, tv: 1, book: 2 }

function priorityRank(entry: HomeQueueItem): [number, number] {
  if (entry.topSlot !== null) return [0, entry.topSlot]
  if (entry.queuePosition !== null) return [1, entry.queuePosition]
  return [2, 0]
}

function addedTime(entry: HomeQueueItem): number {
  const time = Date.parse(entry.watchlistedAt || '')
  return Number.isNaN(time) ? -Infinity : time
}

// Top 1–3, then queue position, then unranked. Within the same rank use newest
// watchlist date, movie/show/book order, title, and ID for stable results.
function compareHomePriority(left: HomeQueueItem, right: HomeQueueItem): number {
  const [leftTier, leftRank] = priorityRank(left)
  const [rightTier, rightRank] = priorityRank(right)
  return leftTier - rightTier || leftRank - rightRank || addedTime(right) - addedTime(left)
    || mediaOrder[left.item.kind] - mediaOrder[right.item.kind]
    || left.item.title.localeCompare(right.item.title)
    || String(left.id).localeCompare(String(right.id))
}

export function createHomeQueue({ watchlistState, tvWatchlistShows, continueWatchingState, popularMoviesState }: {
  watchlistState: HomeWatchlistState
  tvWatchlistShows: Omit<HomeTvShow, 'kind'>[]
  continueWatchingState: ContinueWatchingState
  popularMoviesState: PopularMoviesState
}): HomeQueue {
  return {
    continuing: continueWatchingState.shows[0] ? makeQueueItem({ ...continueWatchingState.shows[0], kind: 'tv' }, 'continue') : null,
    watchlist: {
      movie: watchlistState.movies.map((item) => makeQueueItem({ ...item, kind: 'movie' }, 'watchlist')).sort(compareHomePriority),
      tv: tvWatchlistShows.map((item) => makeQueueItem({ ...item, kind: 'tv' }, 'watchlist')).sort(compareHomePriority),
      book: watchlistState.books.map((item) => makeQueueItem({ ...item, kind: 'book' }, 'watchlist')).sort(compareHomePriority),
    },
    featured: popularMoviesState.featuredMovie ? makeQueueItem({ ...popularMoviesState.featuredMovie, kind: 'movie' }, 'featured') : null,
  }
}

export function selectHomeWatchlistItems(queue: HomeQueue): HomeWatchlistItem[] {
  const { movie, tv, book } = queue.watchlist
  return [movie[0], tv[0], book[0], ...movie.slice(1), ...tv.slice(1), ...book.slice(1)]
    .filter((entry): entry is HomeQueueItem => Boolean(entry))
    .slice(0, 8)
    .map((entry) => entry.item)
}

export function selectTonightPick(queue: HomeQueue, user?: HomeUser | null): TonightPick | null {
  const entry = queue.continuing || queue.watchlist.movie[0] || queue.featured
  if (!entry || !entry.tonight || entry.item.kind === 'book') return null
  return {
    ...entry.item,
    reason: entry.source === 'featured' && user ? 'A popular pick for tonight' : entry.tonight.reason,
    detail: entry.tonight.detail,
    artworkUrl: entry.artwork.portrait,
    ...(entry.source === 'featured' ? { streamingService: 'Streaming TBA' } : {}),
  }
}

export function selectNextUpItems(queue: HomeQueue): NextUpItem[] {
  const { movie, tv, book } = queue.watchlist
  const priority = [...movie, ...tv, ...book]
    .filter((entry) => entry.item.kind !== 'tv' || Number(entry.id) !== Number(queue.continuing?.id))
    .sort(compareHomePriority)
    .slice(0, 3)
  return [queue.continuing, ...priority].filter((entry): entry is HomeQueueItem => Boolean(entry))
    .filter((entry) => Boolean(entry.nextUp))
    .map((entry) => ({
      ...entry.item,
      ...entry.nextUp!,
      artworkUrl: entry.source === 'continue' ? entry.artwork.landscape : entry.artwork.portrait,
      ...(entry.source === 'continue' ? { featured: true } : {}),
    }))
}
