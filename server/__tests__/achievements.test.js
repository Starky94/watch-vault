import test from 'node:test'
import assert from 'node:assert/strict'
import { ACHIEVEMENTS } from '../achievements.js'
import { buildFirstReleaseAchievementValues } from '../database.js'

test('first-release achievement catalog enables only rules backed by stored activity', () => {
  const byName = new Map(ACHIEVEMENTS.map((item) => [item.name, item]))
  assert.equal(byName.get('Opening Weekend').availability, 'active')
  assert.equal(byName.get('Christmas Classics').availability, 'coming_soon')
  assert.equal(byName.get('Opening Weekend').target, 1)
  assert.equal(byName.get('Director Devotee').target, 15)
  assert.equal(byName.get('Genre Month').target, 10)
})

test('first-release metrics use new movie events, genres, cast credits, and rating evidence', () => {
  const movies = Array.from({ length: 10 }, (_, index) => ({
    entity_id: index + 1,
    occurred_at: `2026-10-31T0${index % 6}:00:00.000Z`,
    title: `${String.fromCharCode(65 + index)} title`,
    release_date: index === 0 ? '2026-10-31' : `20${20 + index}-01-01`,
    detail_payload: index === 0 ? { release_dates: { results: [{ iso_3166_1: 'US', release_dates: [{ type: 3, release_date: '2026-10-31T00:00:00.000Z' }] }] } } : null,
    genre_names: ['Horror', index % 2 ? 'Action' : 'Comedy'],
    director_ids: [1], actor_ids: [2, 3],
  }))
  const values = buildFirstReleaseAchievementValues({
    movies,
    ratings: [{ personal_score: 1, vote_count: 1001, community_count: 5, community_average: 3, vote_average: 4 }],
    watchlistCount: 0,
    watchlistAdds: [{ entity_id: 1, occurred_at: '2025-01-01T00:00:00.000Z' }],
  })

  assert.equal(values.opening_weekend, 1)
  assert.equal(values.new_release_hunter, 2)
  assert.equal(values.halloween_horror, 10)
  assert.equal(values.director_max, 10)
  assert.equal(values.actor_pair_max, 10)
  assert.equal(values.genre_month, 10)
  assert.equal(values.zero_backlog, 1)
  assert.equal(values.forgotten_treasure, 1)
  assert.equal(values.against_crowd, 1)
})
