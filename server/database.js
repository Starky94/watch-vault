import pg from 'pg'

const { Pool } = pg

export function createPool(databaseUrl) {
  return new Pool({
    connectionString: databaseUrl,
  })
}

export async function ensureMoviesTable(pool) {
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
      raw_payload JSONB NOT NULL,
      import_rank INTEGER NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function insertMovies(pool, movies) {
  if (movies.length === 0) {
    return {
      insertedCount: 0,
      skippedCount: 0,
    }
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    let insertedCount = 0
    let skippedCount = 0

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
            raw_payload,
            import_rank,
            imported_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, NOW()
          )
          ON CONFLICT (tmdb_id) DO NOTHING
          RETURNING tmdb_id
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
          JSON.stringify(movie.rawPayload),
          movie.importRank,
        ]
      )

      if (result.rowCount === 1) {
        insertedCount += 1
      } else {
        skippedCount += 1
      }
    }

    await client.query('COMMIT')

    return {
      insertedCount,
      skippedCount,
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
      raw_payload,
      import_rank,
      imported_at
    FROM movies
    ORDER BY import_rank ASC, tmdb_id ASC
  `)

  return result.rows
}
