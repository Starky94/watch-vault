import {
  ensureMovieKeywordTables,
  replaceMovieKeywordCombinations,
  replaceMovieKeywordGroup,
  upsertMovieKeyword,
} from './database.js'
import { searchMovieKeywords } from './tmdbClient.js'

function labelFor(sourceKey) {
  return sourceKey.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeName(name) {
  return name.trim().toLocaleLowerCase()
}

export function parseMovieKeywordTaxonomy(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Movie keyword file must contain a JSON object')
  }

  const groups = []
  const combinations = Array.isArray(payload.suggested_combinations) ? payload.suggested_combinations : []

  for (const [sourceKey, values] of Object.entries(payload)) {
    if (Array.isArray(values) && sourceKey !== 'suggested_combinations') {
      groups.push({ sourceKey, label: labelFor(sourceKey), groupType: 'category', keywordNames: values })
    }
  }

  for (const [mood, keywordNames] of Object.entries(payload.moods ?? {})) {
    if (Array.isArray(keywordNames)) {
      groups.push({ sourceKey: `mood:${mood}`, label: labelFor(mood), groupType: 'mood', keywordNames })
    }
  }

  const keywordNames = new Map()
  const addKeywordName = (name) => {
    if (typeof name !== 'string' || !name.trim()) return
    const normalizedName = normalizeName(name)
    if (!keywordNames.has(normalizedName)) keywordNames.set(normalizedName, name)
  }
  for (const group of groups) {
    for (const name of group.keywordNames) addKeywordName(name)
  }
  for (const combination of combinations) {
    for (const keywordName of combination?.keywords ?? []) addKeywordName(keywordName)
  }

  return {
    groups,
    combinations: combinations.filter((combination) => ['AND', 'OR'].includes(combination?.operator) && Array.isArray(combination.keywords)),
    keywordNames: [...keywordNames.values()],
  }
}

export function findExactTmdbKeyword(payload, keywordName) {
  const normalizedName = normalizeName(keywordName)
  const result = (Array.isArray(payload?.results) ? payload.results : []).find((keyword) =>
    Number.isInteger(keyword?.id) && typeof keyword?.name === 'string' && normalizeName(keyword.name) === normalizedName
  )
  return result ? { id: result.id, name: result.name } : null
}

export async function importMovieKeywordTaxonomy(pool, options) {
  const { fetchImpl = fetch, token, baseUrl, payload } = options
  const taxonomy = parseMovieKeywordTaxonomy(payload)
  await ensureMovieKeywordTables(pool)

  const keywordIds = new Map()
  const unresolvedKeywords = []
  for (const name of taxonomy.keywordNames) {
    const searchPayload = await searchMovieKeywords(fetchImpl, { token, baseUrl, query: name })
    const tmdbKeyword = findExactTmdbKeyword(searchPayload, name)
    const keywordId = await upsertMovieKeyword(pool, {
      name,
      tmdbKeywordId: tmdbKeyword?.id ?? null,
      tmdbName: tmdbKeyword?.name ?? null,
    })
    keywordIds.set(normalizeName(name), keywordId)
    if (!tmdbKeyword) unresolvedKeywords.push(name)
  }

  for (const group of taxonomy.groups) {
    await replaceMovieKeywordGroup(pool, group, group.keywordNames.map((name) => keywordIds.get(normalizeName(name))))
  }

  await replaceMovieKeywordCombinations(pool, taxonomy.combinations.map((combination) => ({
    operator: combination.operator,
    keywordIds: combination.keywords.map((name) => keywordIds.get(normalizeName(name))),
  })))

  return { keywordCount: taxonomy.keywordNames.length, groupCount: taxonomy.groups.length, combinationCount: taxonomy.combinations.length, unresolvedKeywords }
}
