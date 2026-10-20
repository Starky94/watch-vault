const defaultRegions = 'US,GB,CA,AU,DE,FR,BR,IN,JP,KR'
// Resolve these official handles with channels.list; never infer channel IDs.
const defaultGameHandles = '@PlayStation,@Xbox,@NintendoAmerica,@Ubisoft,@EA'
const defaultHandles = '@Netflix,@WarnerBros,@UniversalPictures,@SonyPictures,@paramountpictures,@20thcenturystudios,@marvel,@AppleTV'

function integer(env, name, fallback, min, max) {
  const value = Number(env[name] ?? fallback)
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}`)
  return value
}

export function loadTrendingVideoConfig(env = process.env, feed = 'movies') {
  if (!['movies', 'games'].includes(feed)) throw new Error('Invalid trending video feed')
  const handlesVariable = feed === 'games' ? 'TRENDING_GAME_VIDEO_CHANNEL_HANDLES' : 'TRENDING_VIDEO_CHANNEL_HANDLES'
  const regions = [...new Set((env.TRENDING_VIDEO_REGIONS ?? defaultRegions).split(',').map((value) => value.trim().toUpperCase()).filter(Boolean))]
  if (!regions.length || regions.length > 30 || regions.some((value) => !/^[A-Z]{2}$/.test(value))) throw new Error('TRENDING_VIDEO_REGIONS must contain 1–30 two-letter region codes')
  const handles = [...new Set((env[handlesVariable] ?? (feed === 'games' ? defaultGameHandles : defaultHandles)).split(',').map((value) => value.trim()).filter(Boolean))]
  if (handles.length > 50 || handles.some((value) => !/^@[\p{L}\p{N}_.-]+$/u.test(value))) throw new Error(`Invalid ${handlesVariable}`)
  return {
    feed,
    apiKey: env.YOUTUBE_API_KEY,
    regions, handles,
    intervalMs: integer(env, 'TRENDING_VIDEO_SYNC_MINUTES', 120, 15, 1440) * 60_000,
    dailySearchCalls: integer(env, 'TRENDING_VIDEO_DAILY_SEARCH_CALLS', 24, 0, 100),
    dailyUnits: integer(env, 'TRENDING_VIDEO_DAILY_QUOTA_UNITS', 8000, 0, 1000000),
    searchesPerSync: feed === 'games' ? 0 : integer(env, 'TRENDING_VIDEO_SEARCHES_PER_SYNC', 2, 0, 7),
  }
}
