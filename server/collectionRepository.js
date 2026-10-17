// Zero/missing TMDB ratings represent unrated movies and do not affect the mean.
const collectionAverageSql = `(SELECT AVG(NULLIF((member->>'vote_average')::numeric, 0))
  FROM jsonb_array_elements(parts) AS member) AS average_rating`

const collectionPopularitySql = `(SELECT AVG((member->>'popularity')::numeric)
  FROM jsonb_array_elements(parts) AS member) AS popularity`

// Collection members intentionally remain JSON summaries, independent of movies.
export async function ensureCollectionsTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS movie_collections (
    tmdb_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    overview TEXT,
    poster_path TEXT,
    backdrop_path TEXT,
    tmdb_url TEXT NOT NULL,
    parts JSONB NOT NULL DEFAULT '[]'::jsonb,
    export_payload JSONB NOT NULL,
    raw_payload JSONB NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`)
  await pool.query('CREATE INDEX IF NOT EXISTS movie_collections_name_idx ON movie_collections (name, tmdb_id)')
}

export async function saveCollection(pool, entry, payload) {
  await pool.query(`INSERT INTO movie_collections
    (tmdb_id, name, overview, poster_path, backdrop_path, tmdb_url, parts, export_payload, raw_payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)
    ON CONFLICT (tmdb_id) DO NOTHING`, [
    entry.id, payload.name, payload.overview || null, payload.poster_path || null,
    payload.backdrop_path || null, `https://www.themoviedb.org/collection/${entry.id}`,
    JSON.stringify(payload.parts), JSON.stringify(entry), JSON.stringify(payload),
  ])
}

export async function listCollections(pool, { limit, page, query = '', sort = 'popularity', hideWatched = false, username = null }) {
  const sortColumn = sort === 'completion' ? 'completion_progress' : sort === 'rating' ? 'average_rating' : 'popularity'
  const completionExpression = `COALESCE((SELECT COUNT(*)::numeric
    FROM jsonb_array_elements(parts) AS member
    WHERE EXISTS (
      SELECT 1 FROM watched_movies
      JOIN movies ON movies.id = watched_movies.movie_id
      JOIN users ON users.id = watched_movies.user_id
      WHERE users.username = $4 AND movies.tmdb_id = (member->>'id')::integer
    )) / NULLIF(jsonb_array_length(parts), 0), 0)`
  const completionSql = sort === 'completion' ? `, ${completionExpression} AS completion_progress` : ''
  const params = [limit + 1, (page - 1) * limit, query.trim()]
  if (sort === 'completion' || hideWatched) params.push(username)
  const { rows } = await pool.query(`SELECT tmdb_id AS id, name, overview, poster_path, backdrop_path,
    tmdb_url, jsonb_array_length(parts) AS movie_count,
    ARRAY(SELECT (member->>'id')::integer FROM jsonb_array_elements(parts) AS member) AS movie_ids,
    ${collectionAverageSql}, ${collectionPopularitySql}${completionSql} FROM movie_collections
    WHERE ($3 = '' OR strpos(lower(name), lower($3)) > 0)
    ${hideWatched ? `AND ${completionExpression} < 1` : ''}
    ORDER BY ${sortColumn} DESC NULLS LAST, name ASC, tmdb_id ASC LIMIT $1 OFFSET $2`, params)
  return { collections: rows.slice(0, limit), count: Math.min(rows.length, limit), pagination: {
    page, pageSize: limit, hasNextPage: rows.length > limit, hasPreviousPage: page > 1,
  } }
}

export async function getCollection(pool, id) {
  const { rows } = await pool.query(`SELECT tmdb_id AS id, name, overview, poster_path, backdrop_path,
    tmdb_url, parts, imported_at, ${collectionAverageSql}, ${collectionPopularitySql} FROM movie_collections WHERE tmdb_id = $1`, [id])
  return rows[0] ?? null
}
