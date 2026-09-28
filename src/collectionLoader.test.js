import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadCollection, requestJson } from './collectionLoader.js'

const loadingState = { status: 'loading', movies: [], featuredMovie: null, pagination: { page: 2 }, error: '' }
const tick = () => new Promise((resolve) => setImmediate(resolve))

test('collection loader maps items, featured data, and pagination into a success state', async () => {
  const states = []
  const paths = []
  loadCollection({
    url: '/api/movies?page=2', setState: (state) => states.push(state), loadingState,
    itemsKey: 'movies', mapItem: (movie) => ({ id: movie.tmdb_id }),
    featuredKey: 'featuredMovie', mapFeatured: (movie) => ({ id: movie.id }),
    mapPagination: (value) => value,
    fetchRequest: async (path) => {
      paths.push(path)
      return { ok: true, json: async () => ({ movies: [{ tmdb_id: 4 }], featuredMovie: { id: 4 }, pagination: { page: 2, hasNextPage: true } }) }
    },
  })
  await tick()
  assert.deepEqual(paths, ['/api/movies?page=2'])
  assert.deepEqual(states.map((state) => state.status), ['loading', 'success'])
  assert.deepEqual(states[1].movies, [{ id: 4 }])
  assert.deepEqual(states[1].featuredMovie, { id: 4 })
  assert.deepEqual(states[1].pagination, { page: 2, hasNextPage: true })
})

test('API error messages are used consistently, including non-JSON errors', async () => {
  await assert.rejects(
    requestJson('/api/movies', undefined, async () => ({ ok: false, status: 503, json: async () => ({ error: 'Unavailable' }) })),
    /Unavailable/,
  )
  await assert.rejects(
    requestJson('/api/movies', undefined, async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('HTML response') } })),
    /Request failed with status 502/,
  )
})

test('cancelled collections cannot replace newer state', async () => {
  const states = []
  let resolveRequest
  const cancel = loadCollection({
    url: '/api/movies', setState: (state) => states.push(state), loadingState,
    itemsKey: 'movies', mapItem: (movie) => movie,
    fetchRequest: () => new Promise((resolve) => { resolveRequest = resolve }),
  })
  cancel()
  resolveRequest({ ok: true, json: async () => ({ movies: [{ id: 1 }] }) })
  await tick()
  assert.deepEqual(states.map((state) => state.status), ['loading'])
})
