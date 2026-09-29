import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMovieDetailData, loadPersonDetailData } from './movieDetailRequests.ts'

const reply = (status, payload) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => payload })

test('movie detail request uses a preview only for a missing movie', async () => {
  const preview = { id: 42, title: 'Example', rating: '8.2', certification: 'PG-13' }
  const fallback = await loadMovieDetailData(42, preview, reply(404, { error: 'Missing' }))
  assert.equal(fallback.status, 'success')
  assert.equal(fallback.movie.score, '8.2/10')
  assert.equal(fallback.movie.certification, 'PG-13')

  const failure = await loadMovieDetailData(42, preview, reply(500, { error: 'Unavailable' }))
  assert.deepEqual(failure, { status: 'error', movie: null, error: 'Unavailable' })
})

test('person detail request maps filmography and rejects a malformed success payload', async () => {
  const success = await loadPersonDetailData(7, null, reply(200, {
    person: { id: 7, name: 'Actor' },
    filmography: [{ id: 42, title: 'Example', personal: { yourScore: null } }],
  }))
  assert.equal(success.status, 'success')
  assert.equal(success.filmography[0].personal.yourScore, null)

  const malformed = await loadPersonDetailData(7, null, reply(200, { person: { id: 7 } }))
  assert.equal(malformed.status, 'error')
})
