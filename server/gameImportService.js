import { ensureGamesTable, ensureRecentlyReleasedGamesTable, ensureUpcomingGamesTable, replaceRecentlyReleasedGames, replaceUpcomingGames, upsertGames } from './database.js'
import { fetchIgdbAccessToken, igdbRequest } from './igdbClient.js'

const steamPeakPlayersName = '24hr Peak Players'
const igdbVisitsName = 'Visits'
const igdbPageSize = 500
const gameFields = 'id,name,summary,first_release_date,rating,rating_count,aggregated_rating,aggregated_rating_count,cover.image_id,genres.name,platforms.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,franchise.name,collection.name,url'

function textNames(values) {
  return Array.isArray(values) ? values.map((value) => typeof value?.name === 'string' ? value.name.trim() : '').filter(Boolean) : []
}

export function normalizeGame(game, { steamPeakPlayers, importRank }) {
  const coverImageId = typeof game?.cover?.image_id === 'string' ? game.cover.image_id : null
  const companies = Array.isArray(game?.involved_companies) ? game.involved_companies : []
  const companyNames = (property) => [...new Set(companies.filter((company) => company?.[property]).map((company) => typeof company?.company?.name === 'string' ? company.company.name.trim() : '').filter(Boolean))]
  return {
    igdbId: Number(game.id),
    title: typeof game.name === 'string' && game.name.trim() ? game.name.trim() : 'Untitled',
    summary: typeof game.summary === 'string' ? game.summary : null,
    coverImageUrl: coverImageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverImageId}.jpg` : null,
    releaseDate: Number.isFinite(game.first_release_date) ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null,
    rating: Number.isFinite(game.rating) ? game.rating : null,
    ratingCount: Number.isInteger(game.rating_count) ? game.rating_count : null,
    aggregatedRating: Number.isFinite(game.aggregated_rating) ? game.aggregated_rating : null,
    aggregatedRatingCount: Number.isInteger(game.aggregated_rating_count) ? game.aggregated_rating_count : null,
    steamPeakPlayers: Number(steamPeakPlayers),
    platforms: textNames(game.platforms),
    genres: textNames(game.genres),
    igdbUrl: typeof game.url === 'string' ? game.url : null,
    ...(companyNames('developer').length ? { developerNames: companyNames('developer') } : {}),
    ...(companyNames('publisher').length ? { publisherNames: companyNames('publisher') } : {}),
    ...((typeof game?.franchise?.name === 'string' && game.franchise.name.trim()) || (typeof game?.collection?.name === 'string' && game.collection.name.trim()) ? { seriesName: typeof game?.franchise?.name === 'string' && game.franchise.name.trim() ? game.franchise.name.trim() : game.collection.name.trim() } : {}),
    importRank,
  }
}

export function normalizeRecentlyReleasedGame(game, { popularityScore, importRank }) {
  const normalized = normalizeGame(game, { steamPeakPlayers: 0, importRank })
  return {
    ...normalized,
    popularityScore: Number(popularityScore),
  }
}

export function normalizeUpcomingGame(game, { popularityScore, importRank }) {
  return {
    ...normalizeGame(game, { steamPeakPlayers: 0, importRank }),
    popularityScore: Number(popularityScore),
  }
}

export async function hydrateGameByIgdbId(pool, options) {
  const { fetchImpl = fetch, clientId, clientSecret, baseUrl, tokenUrl, gameId, importRank = 1 } = options
  if (!clientId || !clientSecret) throw new Error('IGDB client ID and client secret are required')
  if (!Number.isInteger(gameId)) throw new Error('A valid IGDB game ID is required')

  const accessToken = await fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl })
  const games = await igdbRequest(fetchImpl, {
    clientId,
    accessToken,
    baseUrl,
    path: 'games',
    body: `fields ${gameFields}; where id = ${gameId}; limit 1;`,
  })
  const game = Array.isArray(games) ? games[0] : null
  if (!game || Number(game.id) !== gameId) return null

  const normalizedGame = normalizeGame(game, { steamPeakPlayers: 0, importRank })
  await ensureGamesTable(pool)
  await upsertGames(pool, [normalizedGame])
  return normalizedGame
}

export async function importPopularGames(pool, options) {
  const { fetchImpl = fetch, clientId, clientSecret, baseUrl, tokenUrl, count = 30 } = options
  if (!clientId || !clientSecret) throw new Error('IGDB client ID and client secret are required')
  const accessToken = await fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl })
  const request = (path, body) => igdbRequest(fetchImpl, { clientId, accessToken, baseUrl, path, body })
  const popularityTypes = await request('popularity_types', 'fields id,name; where name = "24hr Peak Players";')
  const popularityType = popularityTypes.find((type) => type?.name === steamPeakPlayersName && Number.isInteger(type.id))
  if (!popularityType) throw new Error('IGDB does not expose the Steam 24hr Peak Players popularity type')
  const primitives = await request('popularity_primitives', `fields game_id,value; where popularity_type = ${popularityType.id}; sort value desc; limit ${count};`)
  if (!Array.isArray(primitives) || primitives.length !== count) throw new Error(`Expected ${count} Steam popularity records from IGDB, received ${Array.isArray(primitives) ? primitives.length : 0}`)
  const ranking = primitives.map((primitive) => ({ id: Number(primitive.game_id), value: Number(primitive.value) })).filter(({ id, value }) => Number.isInteger(id) && Number.isFinite(value))
  if (ranking.length !== count || new Set(ranking.map(({ id }) => id)).size !== count) throw new Error('IGDB returned invalid or duplicate Steam popularity game IDs')
  const games = await request('games', `fields ${gameFields}; where id = (${ranking.map(({ id }) => id).join(',')}); limit ${count};`)
  const gamesById = new Map(Array.isArray(games) ? games.map((game) => [Number(game.id), game]) : [])
  const normalizedGames = ranking.map(({ id, value }, index) => {
    const game = gamesById.get(id)
    if (!game) throw new Error(`IGDB did not return metadata for game ${id}`)
    return normalizeGame(game, { steamPeakPlayers: value, importRank: index + 1 })
  })
  await ensureGamesTable(pool)
  const summary = await upsertGames(pool, normalizedGames)
  return { fetchedCount: normalizedGames.length, ...summary, games: normalizedGames }
}

function getRecentReleaseWindow(now) {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - 30)
  const end = new Date(now)
  end.setUTCHours(23, 59, 59, 999)
  return {
    startSeconds: Math.floor(start.getTime() / 1000),
    endSeconds: Math.floor(end.getTime() / 1000),
  }
}

function getUpcomingReleaseWindow(now) {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() + 1)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 29)
  end.setUTCHours(23, 59, 59, 999)
  return {
    startSeconds: Math.floor(start.getTime() / 1000),
    endSeconds: Math.floor(end.getTime() / 1000),
  }
}

export async function importRecentlyReleasedGames(pool, options) {
  const { fetchImpl = fetch, clientId, clientSecret, baseUrl, tokenUrl, count = 30, now = new Date() } = options
  if (!clientId || !clientSecret) throw new Error('IGDB client ID and client secret are required')

  const accessToken = await fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl })
  const request = (path, body) => igdbRequest(fetchImpl, { clientId, accessToken, baseUrl, path, body })
  const popularityTypes = await request('popularity_types', 'fields id,name; where name = "Visits";')
  const popularityType = popularityTypes.find((type) => type?.name === igdbVisitsName && Number.isInteger(type.id))
  if (!popularityType) throw new Error('IGDB does not expose the Visits popularity type')

  const { startSeconds, endSeconds } = getRecentReleaseWindow(now)
  const recentGames = []
  for (let offset = 0; ; offset += igdbPageSize) {
    const page = await request(
      'games',
      `fields ${gameFields}; where first_release_date >= ${startSeconds} & first_release_date <= ${endSeconds}; limit ${igdbPageSize}; offset ${offset};`
    )
    const pageGames = Array.isArray(page) ? page : []
    recentGames.push(...pageGames)
    if (pageGames.length < igdbPageSize) break
  }

  const gamesById = new Map(recentGames.map((game) => [Number(game.id), game]).filter(([id]) => Number.isInteger(id)))
  const popularityByGameId = new Map()
  const gameIds = [...gamesById.keys()]
  for (let index = 0; index < gameIds.length; index += igdbPageSize) {
    const ids = gameIds.slice(index, index + igdbPageSize)
    const primitives = await request('popularity_primitives', `fields game_id,value; where popularity_type = ${popularityType.id} & game_id = (${ids.join(',')}); limit ${igdbPageSize};`)
    for (const primitive of Array.isArray(primitives) ? primitives : []) {
      const id = Number(primitive.game_id)
      const value = Number(primitive.value)
      if (gamesById.has(id) && Number.isFinite(value)) popularityByGameId.set(id, value)
    }
  }

  const normalizedGames = [...popularityByGameId.entries()]
    .sort(([leftId, leftScore], [rightId, rightScore]) => rightScore - leftScore || leftId - rightId)
    .slice(0, count)
    .map(([id, popularityScore], index) => normalizeRecentlyReleasedGame(gamesById.get(id), { popularityScore, importRank: index + 1 }))

  await ensureRecentlyReleasedGamesTable(pool)
  const summary = await replaceRecentlyReleasedGames(pool, normalizedGames)
  return { fetchedCount: normalizedGames.length, ...summary, games: normalizedGames }
}

export async function importUpcomingGames(pool, options) {
  const { fetchImpl = fetch, clientId, clientSecret, baseUrl, tokenUrl, count = 30, now = new Date() } = options
  if (!clientId || !clientSecret) throw new Error('IGDB client ID and client secret are required')

  const accessToken = await fetchIgdbAccessToken(fetchImpl, { clientId, clientSecret, tokenUrl })
  const request = (path, body) => igdbRequest(fetchImpl, { clientId, accessToken, baseUrl, path, body })
  const popularityTypes = await request('popularity_types', 'fields id,name; where name = "Visits";')
  const popularityType = popularityTypes.find((type) => type?.name === igdbVisitsName && Number.isInteger(type.id))
  if (!popularityType) throw new Error('IGDB does not expose the Visits popularity type')

  const { startSeconds, endSeconds } = getUpcomingReleaseWindow(now)
  const upcomingGames = []
  for (let offset = 0; ; offset += igdbPageSize) {
    const page = await request(
      'games',
      `fields ${gameFields}; where first_release_date >= ${startSeconds} & first_release_date <= ${endSeconds}; limit ${igdbPageSize}; offset ${offset};`
    )
    const pageGames = Array.isArray(page) ? page : []
    upcomingGames.push(...pageGames)
    if (pageGames.length < igdbPageSize) break
  }

  const gamesById = new Map(upcomingGames.map((game) => [Number(game.id), game]).filter(([id]) => Number.isInteger(id)))
  const popularityByGameId = new Map()
  const gameIds = [...gamesById.keys()]
  for (let index = 0; index < gameIds.length; index += igdbPageSize) {
    const ids = gameIds.slice(index, index + igdbPageSize)
    const primitives = await request('popularity_primitives', `fields game_id,value; where popularity_type = ${popularityType.id} & game_id = (${ids.join(',')}); limit ${igdbPageSize};`)
    for (const primitive of Array.isArray(primitives) ? primitives : []) {
      const id = Number(primitive.game_id)
      const value = Number(primitive.value)
      if (gamesById.has(id) && Number.isFinite(value)) popularityByGameId.set(id, value)
    }
  }

  const normalizedGames = [...popularityByGameId.entries()]
    .map(([id, popularityScore]) => ({ game: gamesById.get(id), popularityScore }))
    .sort((left, right) => left.game.first_release_date - right.game.first_release_date || right.popularityScore - left.popularityScore || left.game.id - right.game.id)
    .slice(0, count)
    .map(({ game, popularityScore }, index) => normalizeUpcomingGame(game, { popularityScore, importRank: index + 1 }))

  await ensureUpcomingGamesTable(pool)
  const summary = await replaceUpcomingGames(pool, normalizedGames)
  return { fetchedCount: normalizedGames.length, ...summary, games: normalizedGames }
}
