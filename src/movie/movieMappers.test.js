import assert from 'node:assert/strict'
import test from 'node:test'
import { mapFeaturedMoviePayload, mapMovieDetailPayload, mapMoviePreviewToDetail, mapMovieRowToCard } from './movieMappers.ts'
import { readMediaDetailRoute } from './movieTypes.ts'

test('movie card score and certification stay separate in a detail preview', () => {
  const card = mapMovieRowToCard({ tmdb_id: 42, title: 'Example', vote_average: 8.2, certification: 'PG-13' })
  const preview = mapMoviePreviewToDetail(card)
  assert.equal(card.rating, '8.2')
  assert.equal(preview.score, '8.2/10')
  assert.equal(preview.certification, 'PG-13')
  assert.equal(preview.tomatoScore, '82%')

  const unrated = mapMoviePreviewToDetail({ id: 43, title: 'Unrated', rating: 'N/A' })
  assert.equal(unrated.score, 'N/A')
  assert.equal(unrated.tomatoScore, 'N/A')
  assert.equal(unrated.certification, 'NR')
})

test('featured API rating maps to certification and detail API keeps its own shape', () => {
  const featured = mapFeaturedMoviePayload({ id: 42, title: 'Example', rating: 'PG-13', score: '8.2/10' })
  assert.equal(featured.certification, 'PG-13')
  assert.equal(featured.score, '8.2/10')
  assert.equal('rating' in featured, false)

  const detail = mapMovieDetailPayload({ id: 42, title: 'Example', certification: 'R', score: '7.5/10' })
  assert.equal(detail.certification, 'R')
  assert.equal(detail.tomatoScore, '75%')
})

test('movie and person detail routes have distinct identifiers', () => {
  assert.deepEqual(readMediaDetailRoute('/movies/42'), { kind: 'movieDetail', movieId: 42 })
  assert.deepEqual(readMediaDetailRoute('/people/7'), { kind: 'personDetail', personId: 7 })
  assert.equal(readMediaDetailRoute('/movies/upcoming'), null)
})
