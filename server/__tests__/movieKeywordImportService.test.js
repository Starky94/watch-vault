import test from 'node:test'
import assert from 'node:assert/strict'
import { findExactTmdbKeyword, parseMovieKeywordTaxonomy } from '../movieKeywordImportService.js'

test('parseMovieKeywordTaxonomy keeps category and mood filters and combination-only keywords', () => {
  const taxonomy = parseMovieKeywordTaxonomy({
    story: ['Friendship'],
    moods: { cozy: ['family'] },
    suggested_combinations: [{ operator: 'AND', keywords: ['friendship', 'time travel'] }],
  })

  assert.deepEqual(taxonomy.groups, [
    { sourceKey: 'story', label: 'Story', groupType: 'category', keywordNames: ['Friendship'] },
    { sourceKey: 'mood:cozy', label: 'Cozy', groupType: 'mood', keywordNames: ['family'] },
  ])
  assert.deepEqual(taxonomy.keywordNames.sort(), ['Friendship', 'family', 'time travel'].sort())
  assert.equal(taxonomy.combinations.length, 1)
})

test('findExactTmdbKeyword only accepts a case-insensitive exact name match', () => {
  const result = findExactTmdbKeyword({
    results: [
      { id: 1, name: 'Time Traveler' },
      { id: 2, name: 'Time Travel' },
    ],
  }, 'time travel')

  assert.deepEqual(result, { id: 2, name: 'Time Travel' })
  assert.equal(findExactTmdbKeyword({ results: [{ id: 1, name: 'Time Traveler' }] }, 'time travel'), null)
})
