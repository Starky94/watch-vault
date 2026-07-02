import pg from 'pg'

const { Pool } = pg

export function createPool(databaseUrl) {
  return new Pool({
    connectionString: databaseUrl,
  })
}

export async function ensureMoviesTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS genres (
      id BIGSERIAL PRIMARY KEY,
      tmdb_genre_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS movies (
      id BIGSERIAL PRIMARY KEY,
      tmdb_id INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      original_title TEXT,
      overview TEXT,
      release_date DATE,
      original_language TEXT,
      poster_path TEXT,
      backdrop_path TEXT,
      popularity DOUBLE PRECISION,
      vote_average DOUBLE PRECISION,
      vote_count INTEGER,
      adult BOOLEAN NOT NULL DEFAULT FALSE,
      video BOOLEAN NOT NULL DEFAULT FALSE,
      genre_ids INTEGER[] NOT NULL DEFAULT '{}',
      runtime_minutes INTEGER,
      certification TEXT,
      detail_payload JSONB,
      raw_payload JSONB NOT NULL,
      import_rank INTEGER NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    ALTER TABLE movies
    ADD COLUMN IF NOT EXISTS runtime_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS certification TEXT,
    ADD COLUMN IF NOT EXISTS detail_payload JSONB
  `)
}

export async function listKnownGenreIds(pool, genreIds) {
  if (genreIds.length === 0) {
    return new Set()
  }

  const result = await pool.query(
    `
      SELECT tmdb_genre_id
      FROM genres
      WHERE tmdb_genre_id = ANY($1::INTEGER[])
    `,
    [genreIds]
  )

  return new Set(result.rows.map((row) => row.tmdb_genre_id))
}

export async function upsertGenres(pool, genres) {
  if (genres.length === 0) {
    return
  }

  for (const genre of genres) {
    await pool.query(
      `
        INSERT INTO genres (
          tmdb_genre_id,
          name,
          created_at,
          updated_at
        )
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (tmdb_genre_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
      `,
      [genre.tmdbGenreId, genre.name]
    )
  }
}

export async function upsertMovies(pool, movies) {
  if (movies.length === 0) {
    return {
      insertedCount: 0,
      updatedCount: 0,
    }
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    let insertedCount = 0
    let updatedCount = 0

    for (const movie of movies) {
      const result = await client.query(
        `
          INSERT INTO movies (
            tmdb_id,
            title,
            original_title,
            overview,
            release_date,
            original_language,
            poster_path,
            backdrop_path,
            popularity,
            vote_average,
            vote_count,
            adult,
            video,
            genre_ids,
            runtime_minutes,
            certification,
            detail_payload,
            raw_payload,
            import_rank,
            imported_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19, NOW()
          )
          ON CONFLICT (tmdb_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            original_title = EXCLUDED.original_title,
            overview = EXCLUDED.overview,
            release_date = EXCLUDED.release_date,
            original_language = EXCLUDED.original_language,
            poster_path = EXCLUDED.poster_path,
            backdrop_path = EXCLUDED.backdrop_path,
            popularity = EXCLUDED.popularity,
            vote_average = EXCLUDED.vote_average,
            vote_count = EXCLUDED.vote_count,
            adult = EXCLUDED.adult,
            video = EXCLUDED.video,
            genre_ids = EXCLUDED.genre_ids,
            runtime_minutes = EXCLUDED.runtime_minutes,
            certification = EXCLUDED.certification,
            detail_payload = EXCLUDED.detail_payload,
            raw_payload = EXCLUDED.raw_payload,
            import_rank = EXCLUDED.import_rank,
            imported_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `,
        [
          movie.tmdbId,
          movie.title,
          movie.originalTitle,
          movie.overview,
          movie.releaseDate,
          movie.originalLanguage,
          movie.posterPath,
          movie.backdropPath,
          movie.popularity,
          movie.voteAverage,
          movie.voteCount,
          movie.adult,
          movie.video,
          movie.genreIds,
          movie.runtimeMinutes,
          movie.certification,
          JSON.stringify(movie.detailPayload),
          JSON.stringify(movie.rawPayload),
          movie.importRank,
        ]
      )

      if (result.rows[0]?.inserted) {
        insertedCount += 1
      } else {
        updatedCount += 1
      }
    }

    await client.query('COMMIT')

    return {
      insertedCount,
      updatedCount,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listMovies(pool) {
  const result = await pool.query(`
    SELECT
      movies.tmdb_id,
      movies.title,
      movies.original_title,
      movies.overview,
      movies.release_date,
      movies.original_language,
      movies.poster_path,
      movies.backdrop_path,
      movies.popularity,
      movies.vote_average,
      movies.vote_count,
      movies.adult,
      movies.video,
      movies.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      movies.runtime_minutes,
      movies.certification,
      movies.detail_payload,
      movies.raw_payload,
      movies.import_rank,
      movies.imported_at
    FROM movies
    LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    GROUP BY movies.id
    ORDER BY popularity DESC NULLS LAST, tmdb_id ASC
    LIMIT 30
  `)

  return result.rows
}

export async function getMovieByTmdbId(pool, tmdbId) {
  const result = await pool.query(
    `
    SELECT
      movies.tmdb_id,
      movies.title,
      movies.original_title,
      movies.overview,
      movies.release_date,
      movies.original_language,
      movies.poster_path,
      movies.backdrop_path,
      movies.popularity,
      movies.vote_average,
      movies.vote_count,
      movies.adult,
      movies.video,
      movies.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      movies.runtime_minutes,
      movies.certification,
      movies.detail_payload,
      movies.raw_payload,
      movies.import_rank,
      movies.imported_at
    FROM movies
    LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE movies.tmdb_id = $1 OR movies.id = $1
    GROUP BY movies.id
    ORDER BY CASE WHEN movies.tmdb_id = $1 THEN 0 ELSE 1 END
    LIMIT 1
  `,
    [tmdbId]
  )

  return result.rows[0] ?? null
}

export async function listRecentlyReleasedMovies(pool, options = {}) {
  const { limit = 10 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 30)) : 10

  const result = await pool.query(
    `
    SELECT
      movies.tmdb_id,
      movies.title,
      movies.original_title,
      movies.overview,
      movies.release_date,
      movies.original_language,
      movies.poster_path,
      movies.backdrop_path,
      movies.popularity,
      movies.vote_average,
      movies.vote_count,
      movies.adult,
      movies.video,
      movies.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      movies.runtime_minutes,
      movies.certification,
      movies.detail_payload,
      movies.raw_payload,
      movies.import_rank,
      movies.imported_at
    FROM movies
    LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE movies.release_date IS NOT NULL
      AND movies.release_date <= CURRENT_DATE
    GROUP BY movies.id
    ORDER BY movies.release_date DESC, movies.tmdb_id ASC
    LIMIT $1
  `,
    [normalizedLimit]
  )

  return result.rows
}

export async function listTopRatedMovies(pool, options = {}) {
  const { limit = 10 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 30)) : 10

  const result = await pool.query(
    `
    SELECT
      movies.tmdb_id,
      movies.title,
      movies.original_title,
      movies.overview,
      movies.release_date,
      movies.original_language,
      movies.poster_path,
      movies.backdrop_path,
      movies.popularity,
      movies.vote_average,
      movies.vote_count,
      movies.adult,
      movies.video,
      movies.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      movies.runtime_minutes,
      movies.certification,
      movies.detail_payload,
      movies.raw_payload,
      movies.import_rank,
      movies.imported_at
    FROM movies
    LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE movies.release_date IS NOT NULL
      AND movies.release_date <= CURRENT_DATE
    GROUP BY movies.id
    ORDER BY movies.vote_average DESC NULLS LAST, movies.vote_count DESC NULLS LAST, movies.tmdb_id ASC
    LIMIT $1
  `,
    [normalizedLimit]
  )

  return result.rows
}

export async function listUpcomingMovies(pool, options = {}) {
  const { limit = 10 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 30)) : 10

  const result = await pool.query(
    `
    SELECT
      movies.tmdb_id,
      movies.title,
      movies.original_title,
      movies.overview,
      movies.release_date,
      movies.original_language,
      movies.poster_path,
      movies.backdrop_path,
      movies.popularity,
      movies.vote_average,
      movies.vote_count,
      movies.adult,
      movies.video,
      movies.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      movies.runtime_minutes,
      movies.certification,
      movies.detail_payload,
      movies.raw_payload,
      movies.import_rank,
      movies.imported_at
    FROM movies
    LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE movies.release_date IS NOT NULL
      AND movies.release_date > CURRENT_DATE
      AND movies.release_date <= CURRENT_DATE + INTERVAL '30 days'
    GROUP BY movies.id
    ORDER BY movies.release_date ASC, movies.tmdb_id ASC
    LIMIT $1
  `,
    [normalizedLimit]
  )

  return result.rows
}

export async function countMovies(pool) {
  const result = await pool.query(`
    SELECT COUNT(*)::INTEGER AS movie_count
    FROM movies
  `)

  return result.rows[0]?.movie_count ?? 0
}
