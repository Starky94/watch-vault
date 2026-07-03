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

  await pool.query(`
    UPDATE movies
    SET detail_payload = jsonb_set(
      detail_payload,
      '{release_dates,results}',
      COALESCE(
        (
          SELECT jsonb_agg(entry)
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(detail_payload->'release_dates'->'results') = 'array'
                THEN detail_payload->'release_dates'->'results'
              ELSE '[]'::jsonb
            END
          ) AS entry
          WHERE entry->>'iso_3166_1' = 'US'
        ),
        '[]'::jsonb
      ),
      true
    )
    WHERE detail_payload IS NOT NULL
      AND detail_payload ? 'release_dates'
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cast_members (
      id BIGSERIAL PRIMARY KEY,
      tmdb_person_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      profile_path TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS movie_cast (
      id BIGSERIAL PRIMARY KEY,
      movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      cast_member_id BIGINT NOT NULL REFERENCES cast_members(id) ON DELETE CASCADE,
      credit_type TEXT NOT NULL CHECK (credit_type IN ('actor', 'director')),
      character_name TEXT,
      billing_order INTEGER,
      department TEXT,
      job TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS movie_cast_unique_credit_idx
    ON movie_cast (
      movie_id,
      cast_member_id,
      credit_type,
      COALESCE(character_name, ''),
      COALESCE(job, '')
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  for (const user of demoUsers) {
    await pool.query(
      `
        INSERT INTO users (
          username,
          password,
          full_name,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (username)
        DO UPDATE SET
          password = EXCLUDED.password,
          full_name = EXCLUDED.full_name,
          updated_at = NOW()
      `,
      [user.username, user.password, user.fullName]
    )
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, movie_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watched_movies (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, movie_id)
    )
  `)
}

const demoUsers = [
  {
    username: 'florind',
    password: 'test',
    fullName: 'Florin Druta',
  },
  {
    username: 'andreead',
    password: 'test',
    fullName: 'Andreea Druta',
  },
  {
    username: 'alex',
    password: 'test',
    fullName: 'Alex Morgan',
  },
]

async function upsertCastMember(client, castMember) {
  const result = await client.query(
    `
      INSERT INTO cast_members (
        tmdb_person_id,
        name,
        profile_path,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (tmdb_person_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        profile_path = EXCLUDED.profile_path,
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted
    `,
    [castMember.tmdbPersonId, castMember.name, castMember.profilePath]
  )

  return {
    id: result.rows[0].id,
    inserted: Boolean(result.rows[0].inserted),
  }
}

async function replaceMovieCreditsForMovieId(client, movieId, credits = {}) {
  const { director = null, cast = [] } = credits
  let insertedCastMembersCount = 0

  await client.query(
    `
      DELETE FROM movie_cast
      WHERE movie_id = $1
    `,
    [movieId]
  )

  const creditRows = []

  if (director?.tmdbPersonId && director?.name) {
    creditRows.push({
      ...director,
      creditType: 'director',
    })
  }

  for (const castMember of cast) {
    if (!castMember?.tmdbPersonId || !castMember?.name) {
      continue
    }

    creditRows.push({
      ...castMember,
      creditType: 'actor',
    })
  }

  for (const credit of creditRows) {
    const castMember = await upsertCastMember(client, credit)

    if (castMember.inserted) {
      insertedCastMembersCount += 1
    }

    await client.query(
      `
        INSERT INTO movie_cast (
          movie_id,
          cast_member_id,
          credit_type,
          character_name,
          billing_order,
          department,
          job,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `,
      [
        movieId,
        castMember.id,
        credit.creditType,
        credit.characterName ?? null,
        Number.isInteger(credit.billingOrder) ? credit.billingOrder : null,
        credit.department ?? null,
        credit.job ?? null,
      ]
    )
  }

  return {
    insertedCastMembersCount,
    creditCount: creditRows.length,
  }
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
          RETURNING id, (xmax = 0) AS inserted
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

      await replaceMovieCreditsForMovieId(client, result.rows[0].id, movie.credits)

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

export async function replaceMovieCredits(pool, tmdbId, credits) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const movieResult = await client.query(
      `
        SELECT id
        FROM movies
        WHERE tmdb_id = $1 OR id = $1
        ORDER BY CASE WHEN tmdb_id = $1 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [tmdbId]
    )

    const movieId = movieResult.rows[0]?.id

    if (!movieId) {
      await client.query('ROLLBACK')
      return null
    }

    const result = await replaceMovieCreditsForMovieId(client, movieId, credits)
    await client.query('COMMIT')
    return result
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

export async function findUserByCredentials(pool, { username, password }) {
  const result = await pool.query(
    `
      SELECT
        id,
        username,
        full_name
      FROM users
      WHERE username = $1
        AND password = $2
      LIMIT 1
    `,
    [username, password]
  )

  return result.rows[0] ?? null
}

export async function findUserByUsername(pool, username) {
  const result = await pool.query(
    `
      SELECT
        id,
        username,
        full_name
      FROM users
      WHERE username = $1
      LIMIT 1
    `,
    [username]
  )

  return result.rows[0] ?? null
}

export async function getMovieByTmdbId(pool, tmdbId) {
  const result = await pool.query(
    `
    SELECT
      movies.id,
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

  const movie = result.rows[0] ?? null

  if (!movie) {
    return null
  }

  const creditsResult = await pool.query(
    `
      SELECT
        movie_cast.credit_type,
        movie_cast.character_name,
        movie_cast.billing_order,
        movie_cast.department,
        movie_cast.job,
        cast_members.tmdb_person_id,
        cast_members.name,
        cast_members.profile_path
      FROM movie_cast
      JOIN cast_members ON cast_members.id = movie_cast.cast_member_id
      WHERE movie_cast.movie_id = $1
      ORDER BY
        CASE WHEN movie_cast.credit_type = 'director' THEN 0 ELSE 1 END ASC,
        movie_cast.billing_order ASC NULLS LAST,
        cast_members.name ASC
    `,
    [movie.id]
  )

  const directorRow = creditsResult.rows.find((row) => row.credit_type === 'director') ?? null
  const castRows = creditsResult.rows.filter((row) => row.credit_type === 'actor')

  return {
    ...movie,
    director: directorRow
      ? {
          id: directorRow.tmdb_person_id,
          name: directorRow.name,
          profile_path: directorRow.profile_path,
          department: directorRow.department,
          job: directorRow.job,
        }
      : null,
    cast: castRows.map((row) => ({
      id: row.tmdb_person_id,
      name: row.name,
      profile_path: row.profile_path,
      character_name: row.character_name,
      billing_order: row.billing_order,
    })),
  }
}

export async function listMoviesForCreditsBackfill(pool) {
  const result = await pool.query(`
    SELECT
      id,
      tmdb_id,
      title
    FROM movies
    ORDER BY tmdb_id ASC
  `)

  return result.rows
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

export async function listSimilarMovies(pool, tmdbId, options = {}) {
  const { limit = 10 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 10)) : 10

  const result = await pool.query(
    `
    WITH source_movie AS (
      SELECT genre_ids
      FROM movies
      WHERE tmdb_id = $1 OR id = $1
      ORDER BY CASE WHEN tmdb_id = $1 THEN 0 ELSE 1 END
      LIMIT 1
    ),
    ranked_movies AS (
      SELECT
        movies.id,
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
        movies.runtime_minutes,
        movies.certification,
        movies.detail_payload,
        movies.raw_payload,
        movies.import_rank,
        movies.imported_at,
        COUNT(*)::INTEGER AS shared_genre_count
      FROM movies
      CROSS JOIN source_movie
      JOIN LATERAL UNNEST(movies.genre_ids) AS candidate_genre(tmdb_genre_id) ON TRUE
      JOIN LATERAL UNNEST(source_movie.genre_ids) AS source_genre(tmdb_genre_id)
        ON source_genre.tmdb_genre_id = candidate_genre.tmdb_genre_id
      WHERE movies.tmdb_id <> $1
        AND movies.id <> $1
      GROUP BY movies.id
    )
    SELECT
      ranked_movies.tmdb_id,
      ranked_movies.title,
      ranked_movies.original_title,
      ranked_movies.overview,
      ranked_movies.release_date,
      ranked_movies.original_language,
      ranked_movies.poster_path,
      ranked_movies.backdrop_path,
      ranked_movies.popularity,
      ranked_movies.vote_average,
      ranked_movies.vote_count,
      ranked_movies.adult,
      ranked_movies.video,
      ranked_movies.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      ranked_movies.runtime_minutes,
      ranked_movies.certification,
      ranked_movies.detail_payload,
      ranked_movies.raw_payload,
      ranked_movies.import_rank,
      ranked_movies.imported_at
    FROM ranked_movies
    LEFT JOIN LATERAL UNNEST(ranked_movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    GROUP BY
      ranked_movies.id,
      ranked_movies.tmdb_id,
      ranked_movies.title,
      ranked_movies.original_title,
      ranked_movies.overview,
      ranked_movies.release_date,
      ranked_movies.original_language,
      ranked_movies.poster_path,
      ranked_movies.backdrop_path,
      ranked_movies.popularity,
      ranked_movies.vote_average,
      ranked_movies.vote_count,
      ranked_movies.adult,
      ranked_movies.video,
      ranked_movies.genre_ids,
      ranked_movies.runtime_minutes,
      ranked_movies.certification,
      ranked_movies.detail_payload,
      ranked_movies.raw_payload,
      ranked_movies.import_rank,
      ranked_movies.imported_at,
      ranked_movies.shared_genre_count
    ORDER BY
      ranked_movies.shared_genre_count DESC,
      CASE
        WHEN ranked_movies.release_date IS NOT NULL AND ranked_movies.release_date <= CURRENT_DATE THEN 0
        ELSE 1
      END ASC,
      ranked_movies.popularity DESC NULLS LAST,
      ranked_movies.vote_average DESC NULLS LAST,
      ranked_movies.tmdb_id ASC
    LIMIT $2
  `,
    [tmdbId, normalizedLimit]
  )

  return result.rows
}

export async function listWatchlistMoviesForUser(pool, username) {
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
        movies.imported_at,
        watchlist_items.created_at AS watchlisted_at
      FROM watchlist_items
      JOIN users ON users.id = watchlist_items.user_id
      JOIN movies ON movies.id = watchlist_items.movie_id
      LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
      LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
      WHERE users.username = $1
      GROUP BY movies.id, watchlist_items.created_at
      ORDER BY watchlist_items.created_at DESC, movies.tmdb_id ASC
    `,
    [username]
  )

  return result.rows
}

export async function addMovieToWatchlistForUser(pool, { username, movieId }) {
  const result = await pool.query(
    `
      WITH selected_user AS (
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
      ),
      selected_movie AS (
        SELECT id
        FROM movies
        WHERE tmdb_id = $2 OR id = $2
        ORDER BY CASE WHEN tmdb_id = $2 THEN 0 ELSE 1 END
        LIMIT 1
      ),
      watchlist_total AS (
        SELECT COUNT(*)::INTEGER AS total
        FROM watchlist_items
        WHERE user_id IN (SELECT id FROM selected_user)
      ),
      existing_watchlist AS (
        SELECT watchlist_items.created_at
        FROM watchlist_items
        WHERE user_id IN (SELECT id FROM selected_user)
          AND movie_id IN (SELECT id FROM selected_movie)
        LIMIT 1
      ),
      inserted_watchlist AS (
        INSERT INTO watchlist_items (
          user_id,
          movie_id,
          created_at
        )
        SELECT
          selected_user.id,
          selected_movie.id,
          NOW()
        FROM selected_user
        CROSS JOIN selected_movie
        CROSS JOIN watchlist_total
        WHERE watchlist_total.total < 30
          OR EXISTS(SELECT 1 FROM existing_watchlist)
        ON CONFLICT (user_id, movie_id) DO NOTHING
        RETURNING user_id, movie_id, created_at
      )
      SELECT
        EXISTS(SELECT 1 FROM selected_user) AS has_user,
        EXISTS(SELECT 1 FROM selected_movie) AS has_movie,
        (SELECT total FROM watchlist_total) AS watchlist_total,
        EXISTS(SELECT 1 FROM existing_watchlist) AS already_saved,
        COALESCE(
          (SELECT created_at FROM inserted_watchlist),
          (
            SELECT created_at
            FROM existing_watchlist
          )
        ) AS created_at
    `,
    [username, movieId]
  )

  const row = result.rows[0] ?? null

  if (!row?.has_user) {
    return {
      status: 'missing_user',
    }
  }

  if (!row.has_movie) {
    return {
      status: 'missing_movie',
    }
  }

  if (!row.already_saved && Number(row.watchlist_total) >= 30) {
    return {
      status: 'limit_reached',
      limit: 30,
    }
  }

  return {
    status: 'ok',
    createdAt: row.created_at ?? null,
  }
}

export async function removeMovieFromWatchlistForUser(pool, { username, movieId }) {
  const result = await pool.query(
    `
      WITH selected_user AS (
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
      ),
      selected_movie AS (
        SELECT id
        FROM movies
        WHERE tmdb_id = $2 OR id = $2
        ORDER BY CASE WHEN tmdb_id = $2 THEN 0 ELSE 1 END
        LIMIT 1
      ),
      deleted_watchlist AS (
        DELETE FROM watchlist_items
        WHERE user_id IN (SELECT id FROM selected_user)
          AND movie_id IN (SELECT id FROM selected_movie)
        RETURNING id
      )
      SELECT
        EXISTS(SELECT 1 FROM selected_user) AS has_user,
        EXISTS(SELECT 1 FROM selected_movie) AS has_movie,
        EXISTS(SELECT 1 FROM deleted_watchlist) AS removed
    `,
    [username, movieId]
  )

  const row = result.rows[0] ?? null

  if (!row?.has_user) {
    return {
      status: 'missing_user',
    }
  }

  if (!row.has_movie) {
    return {
      status: 'missing_movie',
    }
  }

  return {
    status: 'ok',
    removed: Boolean(row.removed),
  }
}

export async function listWatchedMoviesForUser(pool, username) {
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
        movies.imported_at,
        watched_movies.created_at AS watched_at
      FROM watched_movies
      JOIN users ON users.id = watched_movies.user_id
      JOIN movies ON movies.id = watched_movies.movie_id
      LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
      LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
      WHERE users.username = $1
      GROUP BY movies.id, watched_movies.created_at
      ORDER BY watched_movies.created_at DESC, movies.tmdb_id ASC
    `,
    [username]
  )

  return result.rows
}

export async function addMovieToWatchedForUser(pool, { username, movieId }) {
  const result = await pool.query(
    `
      WITH selected_user AS (
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
      ),
      selected_movie AS (
        SELECT id
        FROM movies
        WHERE tmdb_id = $2 OR id = $2
        ORDER BY CASE WHEN tmdb_id = $2 THEN 0 ELSE 1 END
        LIMIT 1
      ),
      existing_watched AS (
        SELECT watched_movies.created_at
        FROM watched_movies
        WHERE user_id IN (SELECT id FROM selected_user)
          AND movie_id IN (SELECT id FROM selected_movie)
        LIMIT 1
      ),
      deleted_watchlist AS (
        DELETE FROM watchlist_items
        WHERE user_id IN (SELECT id FROM selected_user)
          AND movie_id IN (SELECT id FROM selected_movie)
        RETURNING id
      ),
      inserted_watched AS (
        INSERT INTO watched_movies (
          user_id,
          movie_id,
          created_at
        )
        SELECT
          selected_user.id,
          selected_movie.id,
          NOW()
        FROM selected_user
        CROSS JOIN selected_movie
        ON CONFLICT (user_id, movie_id) DO NOTHING
        RETURNING user_id, movie_id, created_at
      )
      SELECT
        EXISTS(SELECT 1 FROM selected_user) AS has_user,
        EXISTS(SELECT 1 FROM selected_movie) AS has_movie,
        EXISTS(SELECT 1 FROM deleted_watchlist) AS removed_from_watchlist,
        COALESCE(
          (SELECT created_at FROM inserted_watched),
          (SELECT created_at FROM existing_watched)
        ) AS created_at
    `,
    [username, movieId]
  )

  const row = result.rows[0] ?? null

  if (!row?.has_user) {
    return {
      status: 'missing_user',
    }
  }

  if (!row.has_movie) {
    return {
      status: 'missing_movie',
    }
  }

  return {
    status: 'ok',
    createdAt: row.created_at ?? null,
    removedFromWatchlist: Boolean(row.removed_from_watchlist),
  }
}

export async function removeMovieFromWatchedForUser(pool, { username, movieId }) {
  const result = await pool.query(
    `
      WITH selected_user AS (
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
      ),
      selected_movie AS (
        SELECT id
        FROM movies
        WHERE tmdb_id = $2 OR id = $2
        ORDER BY CASE WHEN tmdb_id = $2 THEN 0 ELSE 1 END
        LIMIT 1
      ),
      deleted_watched AS (
        DELETE FROM watched_movies
        WHERE user_id IN (SELECT id FROM selected_user)
          AND movie_id IN (SELECT id FROM selected_movie)
        RETURNING id
      )
      SELECT
        EXISTS(SELECT 1 FROM selected_user) AS has_user,
        EXISTS(SELECT 1 FROM selected_movie) AS has_movie,
        EXISTS(SELECT 1 FROM deleted_watched) AS removed
    `,
    [username, movieId]
  )

  const row = result.rows[0] ?? null

  if (!row?.has_user) {
    return {
      status: 'missing_user',
    }
  }

  if (!row.has_movie) {
    return {
      status: 'missing_movie',
    }
  }

  return {
    status: 'ok',
    removed: Boolean(row.removed),
  }
}

export async function getMovieStatsForUser(pool, username) {
  const result = await pool.query(
    `
      WITH selected_user AS (
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
      ),
      watched_totals AS (
        SELECT
          COUNT(*)::INTEGER AS movies_watched,
          COALESCE(SUM(COALESCE(movies.runtime_minutes, 0)), 0)::INTEGER AS time_watched_minutes
        FROM watched_movies
        JOIN movies ON movies.id = watched_movies.movie_id
        WHERE watched_movies.user_id IN (SELECT id FROM selected_user)
      ),
      watchlist_totals AS (
        SELECT COUNT(*)::INTEGER AS watchlist_count
        FROM watchlist_items
        WHERE watchlist_items.user_id IN (SELECT id FROM selected_user)
      )
      SELECT
        EXISTS(SELECT 1 FROM selected_user) AS has_user,
        COALESCE((SELECT movies_watched FROM watched_totals), 0) AS movies_watched,
        COALESCE((SELECT time_watched_minutes FROM watched_totals), 0) AS time_watched_minutes,
        COALESCE((SELECT watchlist_count FROM watchlist_totals), 0) AS watchlist_count
    `,
    [username]
  )

  const row = result.rows[0] ?? null

  if (!row?.has_user) {
    return {
      status: 'missing_user',
    }
  }

  return {
    status: 'ok',
    moviesWatched: Number(row.movies_watched ?? 0),
    timeWatchedMinutes: Number(row.time_watched_minutes ?? 0),
    watchlistCount: Number(row.watchlist_count ?? 0),
  }
}

export async function countMovies(pool) {
  const result = await pool.query(`
    SELECT COUNT(*)::INTEGER AS movie_count
    FROM movies
  `)

  return result.rows[0]?.movie_count ?? 0
}

export async function countStoredDataBytes(pool) {
  const result = await pool.query(`
    SELECT COALESCE(
      SUM(pg_total_relation_size(to_regclass(table_name))),
      0
    )::BIGINT AS stored_data_bytes
    FROM UNNEST(ARRAY['movies', 'genres', 'cast_members', 'movie_cast', 'users', 'watchlist_items', 'watched_movies']) AS table_name
    WHERE to_regclass(table_name) IS NOT NULL
  `)

  return Number(result.rows[0]?.stored_data_bytes ?? 0)
}
