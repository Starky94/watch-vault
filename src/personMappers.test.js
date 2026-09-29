import assert from 'node:assert/strict'
import test from 'node:test'
import { mapPersonFilmographyRow, mapPersonHistoryPayload, selectPersonFilmography } from './personMappers.ts'

test('person mappers preserve missing ratings as null', () => {
  const row = mapPersonFilmographyRow({ id: 42, title: 'Example', personal: { yourScore: null } })
  assert.equal(row.personal.yourScore, null)
  assert.equal(row.popularity, null)
  assert.equal(row.voteAverage, null)
  assert.equal(mapPersonFilmographyRow({ id: 43, personal: {} }).personal.yourScore, null)
  assert.equal(mapPersonHistoryPayload({ averageRating: null }).averageRating, null)
  assert.equal(mapPersonHistoryPayload({}).averageRating, null)
  assert.equal(mapPersonHistoryPayload({ averageRating: '' }).averageRating, null)
})

test('person mappers retain valid numeric ratings', () => {
  const row = mapPersonFilmographyRow({ id: 42, personal: { yourScore: '4.5' }, voteAverage: '8.2' })
  assert.equal(row.personal.yourScore, 4.5)
  assert.equal(row.voteAverage, 8.2)
  assert.equal(mapPersonHistoryPayload({ averageRating: '3.75' }).averageRating, 3.75)
})

test('filmography selection filters credits and sorts the typed rows', () => {
  const credits = [
    mapPersonFilmographyRow({ id: 1, title: 'Older', releaseDate: '2020-01-01', creditCategories: ['acting'], personal: { watched: true }, popularity: 9 }),
    mapPersonFilmographyRow({ id: 2, title: 'Newer', releaseDate: '2025-01-01', creditCategories: ['acting'], personal: { watched: false }, popularity: 2 }),
    mapPersonFilmographyRow({ id: 3, title: 'Directed', releaseDate: '2024-01-01', creditCategories: ['directing'], popularity: 20 }),
  ]
  const visible = selectPersonFilmography(credits, { role: 'acting', media: 'movie', decade: 'all', sort: 'unwatched', isSignedIn: true })
  assert.deepEqual(visible.map((credit) => credit.id), [2, 1])
  assert.deepEqual(credits.map((credit) => credit.id), [1, 2, 3])
})
