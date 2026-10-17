import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCollectionsPath, formatCollectionMovieCount, formatCollectionPopularity, formatCollectionRating, memberMovieRating, readCollectionsRoute, sortCollectionParts } from './franchiseCollections.js'

test('collection watched percentages use all members, numeric IDs and whole-percent rounding', () => {
  const collection = { movie_count: 8, movie_ids: ['1', 2, 3, 4, 5, 6, 7, 8] }
  assert.equal(formatCollectionMovieCount(collection), '8 movies')
  assert.equal(formatCollectionMovieCount(collection, new Set()), '8 movies · 0% watched')
  assert.equal(formatCollectionMovieCount(collection, new Set([1, 2, 3, 4, 5, 6, 99])), '8 movies · 75% watched')
  assert.equal(formatCollectionMovieCount(collection, new Set([1, 2, 3, 4, 5, 6, 7, 8])), '8 movies · 100% watched')
  assert.equal(formatCollectionMovieCount({ movie_count: 3, movie_ids: [1, 2, 3] }, new Set([1])), '3 movies · 33% watched')
  assert.equal(formatCollectionMovieCount({ movie_count: 3, movie_ids: [1, 2, 3] }, new Set([1, 2])), '3 movies · 67% watched')
  assert.equal(formatCollectionMovieCount({ movie_count: 0, movie_ids: [] }, new Set([1])), '0 movies · 0% watched')
})

test('collection routes preserve pagination for refresh and history navigation', () => {
  assert.deepEqual(readCollectionsRoute('/movies/collections', '?page=3'), { kind: 'collections', collectionId: null, page: 3, query: '', sort: 'popularity', hideWatched: false })
  assert.deepEqual(readCollectionsRoute('/movies/collections/22', '?page=3'), { kind: 'collections', collectionId: 22, page: 3, query: '', sort: 'popularity', hideWatched: false })
  assert.equal(readCollectionsRoute('/movies/22'), null)
  assert.equal(readCollectionsRoute('/movies/collections/0'), null)
  assert.equal(readCollectionsRoute('/movies/collections', '?page=-1').page, 1)
})

test('member movies sort chronologically with undated titles last without mutating summaries', () => {
  const parts = [{ id: 3, title: 'Unknown' }, { id: 2, release_date: '2020-01-01' }, { id: 1, release_date: '2000-01-01' }]
  assert.deepEqual(sortCollectionParts(parts).map(({ id }) => id), [1, 2, 3])
  assert.equal(parts[0].id, 3)
})

test('name search survives pagination, detail navigation and URL encoding', () => {
  const path = buildCollectionsPath({ collectionId: 22, page: 2, query: '  Star & 100%  ' })
  const url = new URL(path, 'https://example.test')
  assert.deepEqual(readCollectionsRoute(url.pathname, url.search), { kind: 'collections', collectionId: 22, page: 2, query: 'Star & 100%', sort: 'popularity', hideWatched: false })
  assert.equal(buildCollectionsPath({ query: 'Matrix' }), '/movies/collections?page=1&q=Matrix')
  assert.equal(buildCollectionsPath(), '/movies/collections?page=1')
})

test('ratings display stored TMDB scores and keep unrated movies distinct', () => {
  assert.equal(formatCollectionRating(memberMovieRating({ vote_average: 8.256 })), '8.3/10')
  assert.equal(formatCollectionRating('7.1250000000000000'), '7.1/10')
  assert.equal(formatCollectionRating(memberMovieRating({ vote_average: 0, vote_count: 0 })), 'Not rated')
  assert.equal(formatCollectionRating(memberMovieRating({})), 'Not rated')
  assert.equal(formatCollectionRating(null), 'Not rated')
  assert.equal(formatCollectionRating(NaN), 'Not rated')
})

test('popularity sort survives searching, pagination, detail navigation and history', () => {
  const url = new URL(buildCollectionsPath({ collectionId: 22, page: 3, query: 'Matrix', sort: 'popularity', hideWatched: false }), 'https://example.test')
  assert.deepEqual(readCollectionsRoute(url.pathname, url.search), { kind: 'collections', collectionId: 22, page: 3, query: 'Matrix', sort: 'popularity', hideWatched: false })
  assert.equal(readCollectionsRoute('/movies/collections', '?sort=invalid').sort, 'popularity')
  assert.equal(formatCollectionPopularity('1234.5678'), '1,234.6')
  assert.equal(formatCollectionPopularity(0), '0.0')
  assert.equal(formatCollectionPopularity(null), 'N/A')
  assert.equal(formatCollectionPopularity(-1), 'N/A')
})

test('explicit rating sort overrides the popularity default and survives URL round trips', () => {
  const path = buildCollectionsPath({ sort: 'rating', page: 2, query: 'Matrix' })
  const url = new URL(path, 'https://example.test')
  assert.equal(url.searchParams.get('sort'), 'rating')
  assert.equal(readCollectionsRoute(url.pathname, url.search).sort, 'rating')
})

test('completion sort survives search, pagination and collection detail navigation', () => {
  for (const collectionId of [null, 22]) {
    const path = buildCollectionsPath({ collectionId, sort: 'completion', page: 3, query: 'Matrix' })
    const url = new URL(path, 'https://example.test')
    assert.deepEqual(readCollectionsRoute(url.pathname, url.search), {
      kind: 'collections', collectionId, page: 3, query: 'Matrix', sort: 'completion', hideWatched: false,
    })
  }
  assert.equal(buildCollectionsPath({ sort: 'completion', query: 'Matrix' }), '/movies/collections?page=1&q=Matrix&sort=completion')
})

test('hide watched filter survives search, sort, pagination and detail navigation', () => {
  for (const sort of ['popularity', 'rating', 'completion']) {
    for (const collectionId of [null, 22]) {
      const url = new URL(buildCollectionsPath({ collectionId, page: 3, query: 'Matrix', sort, hideWatched: true }), 'https://example.test')
      assert.deepEqual(readCollectionsRoute(url.pathname, url.search), {
        kind: 'collections', collectionId, page: 3, query: 'Matrix', sort, hideWatched: true,
      })
    }
  }
  assert.equal(buildCollectionsPath({ hideWatched: false }).includes('hideWatched'), false)
  assert.equal(readCollectionsRoute('/movies/collections', '?hideWatched=false').hideWatched, false)
})
