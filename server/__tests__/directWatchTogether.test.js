import test from 'node:test'
import assert from 'node:assert/strict'
import { sharedEpisodeEligibility } from '../watchTogetherEligibility.js'

const episodes = [1, 2, 3, 4].map((id) => ({ id }))
const rows = (mine, partner) => [
  ...mine.map((id) => ({ user_id: 10, tv_episode_id: id })),
  ...partner.map((id) => ({ user_id: 20, tv_episode_id: id })),
]

test('shared episode eligibility compares exact history and chooses the first gap', () => {
  for (const [mine, partner, expected] of [
    [[], [], { eligible: true, reason: null, nextEpisodeId: 1 }],
    [[1], [1], { eligible: true, reason: null, nextEpisodeId: 2 }],
    [[1, 3], [1, 3], { eligible: true, reason: null, nextEpisodeId: 2 }],
    [[1], [], { eligible: false, reason: 'progress_mismatch', nextEpisodeId: null }],
    [[1], [2], { eligible: false, reason: 'progress_mismatch', nextEpisodeId: null }],
    [[1, 2, 3, 4], [1, 2, 3, 4], { eligible: false, reason: 'no_next_episode', nextEpisodeId: null }],
  ]) assert.deepEqual(sharedEpisodeEligibility(episodes, rows(mine, partner), 10, 20), expected)
})

test('excluded episodes and database bigint strings do not alter shared eligibility', () => {
  assert.deepEqual(sharedEpisodeEligibility(episodes, [
    { user_id: '10', tv_episode_id: '1' }, { user_id: '20', tv_episode_id: '1' },
    { user_id: '10', tv_episode_id: '999' },
  ], '10', '20'), { eligible: true, reason: null, nextEpisodeId: 2 })
})
