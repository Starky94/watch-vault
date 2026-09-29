import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMovieCollectionData, movieCollectionConfigs } from './movieCollections.ts'

const reply = (status, payload) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => payload })

test('movie collection maps a page and keeps featured certification separate from score', async () => {
  const state = await loadMovieCollectionData('/api/movies?page=2', 2, movieCollectionConfigs.popular, reply(200, {
    movies: [{ tmdb_id: 42, title: 'Example', vote_average: 8.2 }, { title: 'Invalid row' }],
    featuredMovie: { id: 42, title: 'Example', rating: 'PG-13', score: '8.2/10' },
    pagination: { page: 2, pageSize: 30, hasNextPage: true, hasPreviousPage: true },
  }))
  assert.equal(state.status, 'success')
  assert.equal(state.movies.length, 1)
  assert.equal(state.movies[0].rating, '8.2')
  assert.equal(state.featuredMovie.certification, 'PG-13')
  assert.equal(state.pagination.hasNextPage, true)
})

test('movie collection failures keep page context and expose the API error', async () => {
  const state = await loadMovieCollectionData('/api/movies/upcoming?page=3', 3, movieCollectionConfigs.upcoming, reply(503, { error: 'Unavailable' }))
  assert.deepEqual(state, {
    status: 'error', movies: [], pagination: { page: 3, pageSize: 30, hasNextPage: false, hasPreviousPage: true }, error: 'Unavailable',
  })
})
