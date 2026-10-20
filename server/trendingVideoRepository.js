function cacheTable(feed) {
  if (feed === 'movies') return 'trending_video_cache'
  if (feed === 'games') return 'trending_game_video_cache'
  throw new Error('Invalid trending video feed')
}

export async function ensureTrendingVideoTables(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS trending_video_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1), videos JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL, diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb
  )`)
  await pool.query(`CREATE TABLE IF NOT EXISTS trending_game_video_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1), videos JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL, diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb
  )`)
  await pool.query(`CREATE TABLE IF NOT EXISTS trending_video_channels (
    handle TEXT PRIMARY KEY, channel_id TEXT NOT NULL, uploads_id TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`)
  await pool.query(`CREATE TABLE IF NOT EXISTS trending_video_quota (
    day DATE PRIMARY KEY, units INTEGER NOT NULL DEFAULT 0, searches INTEGER NOT NULL DEFAULT 0
  )`)
}

export async function readTrendingVideoCache(pool, now = Date.now(), feed = 'movies') {
  const { rows } = await pool.query(`SELECT videos, updated_at FROM ${cacheTable(feed)} WHERE id = 1`)
  const row = rows[0]
  const age = row ? now - new Date(row.updated_at).getTime() : Infinity
  // Never serve unrefreshed YouTube metadata past 30 days.
  return {
    videos: age < 30 * 86400_000 && Array.isArray(row?.videos) ? row.videos : [],
    updatedAt: row?.updated_at ?? null,
    stale: age > 6 * 3600_000,
    ranking: 'Custom global trending approximation',
  }
}

export async function saveTrendingVideoCache(pool, videos, diagnostics, now, feed = 'movies') {
  await pool.query(`INSERT INTO ${cacheTable(feed)} (id, videos, updated_at, diagnostics)
    VALUES (1, $1::jsonb, $2, $3::jsonb) ON CONFLICT (id) DO UPDATE SET
    videos = EXCLUDED.videos, updated_at = EXCLUDED.updated_at, diagnostics = EXCLUDED.diagnostics`,
  [JSON.stringify(videos), new Date(now), JSON.stringify(diagnostics)])
}

export async function reserveYoutubeQuota(pool, config, isSearch, now) {
  // YouTube resets daily quota at midnight Pacific, including DST changes.
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
  // Conservatively reserve 100 units for each search as well as counting calls.
  const { rows } = await pool.query(`INSERT INTO trending_video_quota (day, units, searches)
    SELECT $1::date, $2::integer, $3::integer WHERE $2 <= $4 AND $3 <= $5
    ON CONFLICT (day) DO UPDATE SET units = trending_video_quota.units + $2,
      searches = trending_video_quota.searches + $3
    WHERE trending_video_quota.units + $2 <= $4 AND trending_video_quota.searches + $3 <= $5
    RETURNING day`, [day, isSearch ? 100 : 1, isSearch ? 1 : 0, config.dailyUnits, config.dailySearchCalls])
  return rows.length > 0
}
