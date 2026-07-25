import { readFile } from 'node:fs/promises'
import { loadConfig } from './config.js'
import { createPool } from './database.js'
import { importMovieKeywordTaxonomy } from './movieKeywordImportService.js'

async function run() {
  const filePath = process.argv[2]
  if (!filePath) throw new Error('Usage: npm run import:movie-keywords -- /path/to/tmdb_movie_keywords.json')

  const payload = JSON.parse(await readFile(filePath, 'utf8'))
  const config = loadConfig({ requireDatabase: true, requireTmdbToken: true })
  const pool = createPool(config.databaseUrl)

  try {
    const result = await importMovieKeywordTaxonomy(pool, { token: config.tmdbBearerToken, baseUrl: config.tmdbBaseUrl, payload })
    console.log(`Stored ${result.keywordCount} keywords in ${result.groupCount} groups and ${result.combinationCount} combinations.`)
    if (result.unresolvedKeywords.length > 0) console.warn(`No exact TMDB keyword match: ${result.unresolvedKeywords.join(', ')}`)
  } finally {
    await pool.end()
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
