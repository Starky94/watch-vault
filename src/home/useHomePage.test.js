import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHomeQueue, selectHomeWatchlistItems, selectNextUpItems, selectTonightPick } from './homeSelectors.ts'

const movie = { id: 1, title: 'Movie', meta: 'Drama', posterUrl: '/movie.jpg', watchlistedAt: '2026-01-02' }
const show = { id: 2, title: 'Show', meta: 'TV drama', latestWatchedEpisodeLabel: 'S1 E2', nextEpisodeLabel: 'S1 E3', nextEpisodeTitle: 'Return', progress: 25, posterUrl: '/show.jpg', backdropUrl: '/show-wide.jpg' }
const book = { id: 3, title: 'Book', meta: 'Novel', categoriesLabel: 'Fiction' }
const featuredMovie = { id: 4, title: 'Featured', genreLabel: 'Comedy' }

function queue(overrides = {}) {
  return createHomeQueue({
    watchlistState: { movies: [movie], books: [book] },
    tvWatchlistShows: [show],
    popularMoviesState: { movies: [featuredMovie], featuredMovie },
    continueWatchingState: { shows: [show] },
    ...overrides,
  })
}

test('Tonight’s Pick follows the shared queue priority and keeps its display fields', () => {
  const current = queue()
  assert.equal(selectTonightPick(current, { username: 'viewer' }).id, show.id)
  assert.equal(selectTonightPick(current, { username: 'viewer' }).artworkUrl, '/show.jpg')
  assert.equal(selectTonightPick(queue({ continueWatchingState: { shows: [] } })).id, movie.id)
  const featured = selectTonightPick(queue({ continueWatchingState: { shows: [] }, watchlistState: { movies: [], books: [] } }), { username: 'viewer' })
  assert.equal(featured.id, featuredMovie.id)
  assert.equal(featured.reason, 'A popular pick for tonight')
  assert.equal(selectTonightPick(queue({ continueWatchingState: { shows: [] }, watchlistState: { movies: [], books: [] }, popularMoviesState: { featuredMovie: null } })), null)
})

test('the watchlist rail draws from the same typed queue in media priority order', () => {
  assert.deepEqual(selectHomeWatchlistItems(queue()).map(({ kind, id }) => [kind, id]), [
    ['movie', 1], ['tv', 2], ['book', 3],
  ])
})

test('Next up leads with the unfinished show, excludes its watchlist duplicate, and uses wide artwork', () => {
  const items = selectNextUpItems(queue({ tvWatchlistShows: [show, { id: 5, title: 'Other show' }] }))
  assert.deepEqual(items.map(({ kind, id }) => [kind, id]), [
    ['tv', 2], ['movie', 1], ['tv', 5], ['book', 3],
  ])
  assert.equal(items[0].artworkUrl, '/show-wide.jpg')
  assert.equal(items[0].detail, 'S1 E3 · Return')
  assert.equal(items[1].artworkUrl, '/movie.jpg')
})

test('explicit Top slots and queue positions outrank date added across media', () => {
  const prioritizedQueue = queue({
    continueWatchingState: { shows: [] },
    watchlistState: {
      movies: [
        { ...movie, id: 11, title: 'Recent', watchlistedAt: '2026-09-01' },
        { ...movie, id: 12, title: 'Top 2', topSlot: 2, watchlistedAt: '2025-01-01' },
      ],
      books: [{ ...book, id: 13, topSlot: 1, watchlistedAt: '2024-01-01' }],
    },
    tvWatchlistShows: [{ ...show, id: 14, queuePosition: 1, watchlistedAt: '2025-06-01' }],
  })
  const items = selectNextUpItems(prioritizedQueue)
  assert.deepEqual(items.map(({ id }) => id), [13, 12, 14])
  assert.deepEqual(items.map(({ kicker }) => kicker), ['Top 1 book', 'Top 2 movie', 'Queue #1 show'])
  assert.equal(selectTonightPick(prioritizedQueue).id, 12)
  assert.equal(selectHomeWatchlistItems(prioritizedQueue)[0].id, 12)
})

test('unranked fallback uses newest date, then media order and title', () => {
  const items = selectNextUpItems(queue({
    continueWatchingState: { shows: [] },
    watchlistState: {
      movies: [{ ...movie, id: 21, watchlistedAt: '2026-01-01' }],
      books: [{ ...book, id: 22, watchlistedAt: '2026-02-01' }],
    },
    tvWatchlistShows: [{ ...show, id: 23, watchlistedAt: '2026-02-01' }],
  }))
  assert.deepEqual(items.map(({ id }) => id), [23, 22, 21])
  assert.deepEqual(items.map(({ kicker }) => kicker), ['Watchlist show', 'Watchlist book', 'Watchlist movie'])
})
