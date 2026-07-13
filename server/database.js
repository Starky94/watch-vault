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
    CREATE TABLE IF NOT EXISTS tv_genres (
      id BIGSERIAL PRIMARY KEY,
      tmdb_genre_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tv_shows (
      id BIGSERIAL PRIMARY KEY,
      tmdb_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      original_name TEXT,
      overview TEXT,
      first_air_date DATE,
      original_language TEXT,
      poster_path TEXT,
      backdrop_path TEXT,
      popularity DOUBLE PRECISION,
      vote_average DOUBLE PRECISION,
      vote_count INTEGER,
      genre_ids INTEGER[] NOT NULL DEFAULT '{}',
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
      biography TEXT,
      birthday DATE,
      deathday DATE,
      place_of_birth TEXT,
      known_for_department TEXT,
      popularity DOUBLE PRECISION,
      homepage TEXT,
      imdb_id TEXT,
      detail_payload JSONB,
      credits_payload JSONB,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    ALTER TABLE cast_members
    ADD COLUMN IF NOT EXISTS biography TEXT,
    ADD COLUMN IF NOT EXISTS birthday DATE,
    ADD COLUMN IF NOT EXISTS deathday DATE,
    ADD COLUMN IF NOT EXISTS place_of_birth TEXT,
    ADD COLUMN IF NOT EXISTS known_for_department TEXT,
    ADD COLUMN IF NOT EXISTS popularity DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS homepage TEXT,
    ADD COLUMN IF NOT EXISTS imdb_id TEXT,
    ADD COLUMN IF NOT EXISTS detail_payload JSONB,
    ADD COLUMN IF NOT EXISTS credits_payload JSONB,
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ
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

  await pool.query(`
    ALTER TABLE watched_movies
    ADD COLUMN IF NOT EXISTS watch_service TEXT
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS movie_ratings (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      score NUMERIC(2, 1) NOT NULL CHECK (score >= 1.0 AND score <= 5.0 AND MOD(score * 2, 1) = 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, movie_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tv_watchlist_items (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tv_show_id BIGINT NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, tv_show_id)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watched_tv_shows (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tv_show_id BIGINT NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, tv_show_id)
    )
  `)

}

export async function ensureTvDetailTables(pool) {
  await pool.query(`
    ALTER TABLE tv_shows
    ADD COLUMN IF NOT EXISTS detail_hydrated_at TIMESTAMPTZ
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tv_seasons (
      id BIGSERIAL PRIMARY KEY,
      tv_show_id BIGINT NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
      tmdb_id INTEGER,
      season_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      overview TEXT,
      air_date DATE,
      poster_path TEXT,
      episode_count INTEGER NOT NULL DEFAULT 0,
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tv_show_id, season_number)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tv_episodes (
      id BIGSERIAL PRIMARY KEY,
      tv_season_id BIGINT NOT NULL REFERENCES tv_seasons(id) ON DELETE CASCADE,
      tmdb_id INTEGER,
      episode_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      overview TEXT,
      air_date DATE,
      runtime_minutes INTEGER,
      still_path TEXT,
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tv_season_id, episode_number)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tv_show_credits (
      id BIGSERIAL PRIMARY KEY,
      tv_show_id BIGINT NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
      tmdb_person_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      profile_path TEXT,
      character_name TEXT,
      department TEXT,
      job TEXT,
      billing_order INTEGER,
      credit_type TEXT NOT NULL,
      UNIQUE (tv_show_id, tmdb_person_id, credit_type)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tv_recommendations (
      id BIGSERIAL PRIMARY KEY,
      tv_show_id BIGINT NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
      recommended_tmdb_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      first_air_date DATE,
      poster_path TEXT,
      vote_average DOUBLE PRECISION,
      display_order INTEGER NOT NULL,
      raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (tv_show_id, recommended_tmdb_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tv_trailers (
      id BIGSERIAL PRIMARY KEY,
      tv_show_id BIGINT NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      video_key TEXT NOT NULL,
      name TEXT NOT NULL,
      site TEXT NOT NULL,
      video_type TEXT,
      is_official BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (tv_show_id, provider, video_key)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watched_tv_episodes (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tv_episode_id BIGINT NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
      watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, tv_episode_id)
    )
  `)
  await pool.query(`
    ALTER TABLE watched_tv_episodes
    ADD COLUMN IF NOT EXISTS watch_service TEXT
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tv_episode_ratings (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tv_episode_id BIGINT NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
      score NUMERIC(2, 1) NOT NULL CHECK (score >= 1.0 AND score <= 5.0 AND MOD(score * 2, 1) = 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, tv_episode_id)
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
        biography,
        birthday,
        deathday,
        place_of_birth,
        known_for_department,
        popularity,
        homepage,
        imdb_id,
        detail_payload,
        credits_payload,
        last_synced_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      ON CONFLICT (tmdb_person_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        profile_path = EXCLUDED.profile_path,
        biography = COALESCE(EXCLUDED.biography, cast_members.biography),
        birthday = COALESCE(EXCLUDED.birthday, cast_members.birthday),
        deathday = COALESCE(EXCLUDED.deathday, cast_members.deathday),
        place_of_birth = COALESCE(EXCLUDED.place_of_birth, cast_members.place_of_birth),
        known_for_department = COALESCE(EXCLUDED.known_for_department, cast_members.known_for_department),
        popularity = COALESCE(EXCLUDED.popularity, cast_members.popularity),
        homepage = COALESCE(EXCLUDED.homepage, cast_members.homepage),
        imdb_id = COALESCE(EXCLUDED.imdb_id, cast_members.imdb_id),
        detail_payload = COALESCE(EXCLUDED.detail_payload, cast_members.detail_payload),
        credits_payload = COALESCE(EXCLUDED.credits_payload, cast_members.credits_payload),
        last_synced_at = COALESCE(EXCLUDED.last_synced_at, cast_members.last_synced_at),
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted
    `,
    [
      castMember.tmdbPersonId,
      castMember.name,
      castMember.profilePath ?? null,
      castMember.biography ?? null,
      castMember.birthday ?? null,
      castMember.deathday ?? null,
      castMember.placeOfBirth ?? null,
      castMember.knownForDepartment ?? null,
      castMember.popularity ?? null,
      castMember.homepage ?? null,
      castMember.imdbId ?? null,
      castMember.detailPayload ?? null,
      castMember.creditsPayload ?? null,
      castMember.lastSyncedAt ?? null,
    ]
  )

  return {
    id: result.rows[0].id,
    inserted: Boolean(result.rows[0].inserted),
  }
}

export async function syncPersonProfile(pool, personProfile) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await upsertCastMember(client, personProfile)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listMovieSummariesByTmdbIds(pool, tmdbIds = []) {
  const normalizedIds = [...new Set(tmdbIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]

  if (normalizedIds.length === 0) {
    return []
  }

  const result = await pool.query(
    `
      SELECT
        tmdb_id,
        title,
        release_date,
        poster_path,
        backdrop_path,
        vote_average,
        certification
      FROM movies
      WHERE tmdb_id = ANY($1::int[])
    `,
    [normalizedIds]
  )

  return result.rows
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

export async function listKnownTvGenreIds(pool, genreIds) {
  if (genreIds.length === 0) {
    return new Set()
  }

  const result = await pool.query(
    `
      SELECT tmdb_genre_id
      FROM tv_genres
      WHERE tmdb_genre_id = ANY($1::INTEGER[])
    `,
    [genreIds]
  )

  return new Set(result.rows.map((row) => row.tmdb_genre_id))
}

export async function upsertTvGenres(pool, genres) {
  if (genres.length === 0) {
    return
  }

  for (const genre of genres) {
    await pool.query(
      `
        INSERT INTO tv_genres (
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

export async function upsertTvShows(pool, tvShows) {
  if (tvShows.length === 0) {
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

    for (const tvShow of tvShows) {
      const result = await client.query(
        `
          INSERT INTO tv_shows (
            tmdb_id,
            name,
            original_name,
            overview,
            first_air_date,
            original_language,
            poster_path,
            backdrop_path,
            popularity,
            vote_average,
            vote_count,
            genre_ids,
            detail_payload,
            raw_payload,
            import_rank,
            imported_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, NOW()
          )
          ON CONFLICT (tmdb_id)
          DO UPDATE SET
            name = EXCLUDED.name,
            original_name = EXCLUDED.original_name,
            overview = EXCLUDED.overview,
            first_air_date = EXCLUDED.first_air_date,
            original_language = EXCLUDED.original_language,
            poster_path = EXCLUDED.poster_path,
            backdrop_path = EXCLUDED.backdrop_path,
            popularity = EXCLUDED.popularity,
            vote_average = EXCLUDED.vote_average,
            vote_count = EXCLUDED.vote_count,
            genre_ids = EXCLUDED.genre_ids,
            detail_payload = EXCLUDED.detail_payload,
            raw_payload = EXCLUDED.raw_payload,
            import_rank = EXCLUDED.import_rank,
            imported_at = NOW()
          RETURNING id, (xmax = 0) AS inserted
        `,
        [
          tvShow.tmdbId,
          tvShow.name,
          tvShow.originalName,
          tvShow.overview,
          tvShow.firstAirDate,
          tvShow.originalLanguage,
          tvShow.posterPath,
          tvShow.backdropPath,
          tvShow.popularity,
          tvShow.voteAverage,
          tvShow.voteCount,
          tvShow.genreIds,
          JSON.stringify(tvShow.detailPayload),
          JSON.stringify(tvShow.rawPayload),
          tvShow.importRank,
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

export async function listMovies(pool, options = {}) {
  const { limit = 30, page = 1, genre = '' } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const normalizedGenre = typeof genre === 'string' ? genre.trim() : ''
  const offset = (normalizedPage - 1) * normalizedLimit

  const params = [normalizedLimit, offset]
  const genreFilterSql = normalizedGenre
    ? `
    WHERE EXISTS (
      SELECT 1
      FROM UNNEST(movies.genre_ids) AS selected_genre(tmdb_genre_id)
      JOIN genres AS selected_genres ON selected_genres.tmdb_genre_id = selected_genre.tmdb_genre_id
      WHERE LOWER(selected_genres.name) = LOWER($3)
    )
  `
    : ''

  if (normalizedGenre) {
    params.push(normalizedGenre)
  }

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
    ${genreFilterSql}
    GROUP BY movies.id
    ORDER BY popularity DESC NULLS LAST, tmdb_id ASC
    LIMIT $1
    OFFSET $2
  `, params)

  return result.rows
}

export async function searchMovies(pool, query, limit = 30) {
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30

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
      movies.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      movies.detail_payload,
      movies.raw_payload,
      movies.import_rank,
      movies.imported_at
    FROM movies
    LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE POSITION(LOWER($1) IN LOWER(movies.title)) > 0
    GROUP BY movies.id
    ORDER BY movies.popularity DESC NULLS LAST, movies.title ASC, movies.tmdb_id ASC
    LIMIT $2
  `,
    [query, normalizedLimit]
  )

  return result.rows
}

export async function listGenres(pool) {
  const result = await pool.query(`
    SELECT
      genres.tmdb_genre_id,
      genres.name,
      COUNT(DISTINCT movies.id)::INTEGER AS movie_count
    FROM genres
    JOIN movies ON genres.tmdb_genre_id = ANY(movies.genre_ids)
    GROUP BY genres.id
    HAVING COUNT(DISTINCT movies.id) > 0
    ORDER BY LOWER(genres.name) ASC, genres.tmdb_genre_id ASC
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

export async function updateUserPassword(pool, { username, currentPassword, newPassword }) {
  const result = await pool.query(
    `
      UPDATE users
      SET
        password = $3,
        updated_at = NOW()
      WHERE username = $1
        AND password = $2
      RETURNING
        id,
        username,
        full_name
    `,
    [username, currentPassword, newPassword]
  )

  return result.rows[0] ?? null
}

export async function getMovieCommunityRating(pool, { movieId, username = null }) {
  const result = await pool.query(
    `
      WITH selected_movie AS (
        SELECT id
        FROM movies
        WHERE tmdb_id = $1 OR id = $1
        ORDER BY CASE WHEN tmdb_id = $1 THEN 0 ELSE 1 END
        LIMIT 1
      ),
      selected_user AS (
        SELECT id
        FROM users
        WHERE username = $2
        LIMIT 1
      )
      SELECT
        EXISTS(SELECT 1 FROM selected_movie) AS has_movie,
        AVG(movie_ratings.score)::DOUBLE PRECISION AS average,
        COUNT(movie_ratings.id)::INTEGER AS vote_count,
        (
          SELECT movie_ratings.score::DOUBLE PRECISION
          FROM movie_ratings
          WHERE movie_ratings.movie_id IN (SELECT id FROM selected_movie)
            AND movie_ratings.user_id IN (SELECT id FROM selected_user)
          LIMIT 1
        ) AS your_score
      FROM selected_movie
      LEFT JOIN movie_ratings ON movie_ratings.movie_id = selected_movie.id
    `,
    [movieId, username]
  )

  const row = result.rows[0] ?? null

  if (!row?.has_movie) {
    return { status: 'missing_movie' }
  }

  return {
    status: 'ok',
    average: row.average === null ? null : Number(row.average),
    voteCount: Number(row.vote_count ?? 0),
    yourScore: row.your_score === null || row.your_score === undefined ? null : Number(row.your_score),
  }
}

export async function upsertMovieRatingForUser(pool, { username, movieId, score }) {
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
      saved_rating AS (
        INSERT INTO movie_ratings (user_id, movie_id, score, created_at, updated_at)
        SELECT selected_user.id, selected_movie.id, $3, NOW(), NOW()
        FROM selected_user
        CROSS JOIN selected_movie
        ON CONFLICT (user_id, movie_id)
        DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
        RETURNING score
      )
      SELECT
        EXISTS(SELECT 1 FROM selected_user) AS has_user,
        EXISTS(SELECT 1 FROM selected_movie) AS has_movie,
        (SELECT score::DOUBLE PRECISION FROM saved_rating) AS score
    `,
    [username, movieId, score]
  )

  const row = result.rows[0] ?? null

  if (!row?.has_user) return { status: 'missing_user' }
  if (!row.has_movie) return { status: 'missing_movie' }

  return { status: 'ok', score: Number(row.score) }
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
      movies.imported_at,
      (
        SELECT AVG(movie_ratings.score)::DOUBLE PRECISION
        FROM movie_ratings
        WHERE movie_ratings.movie_id = movies.id
      ) AS community_rating_average,
      (
        SELECT COUNT(*)::INTEGER
        FROM movie_ratings
        WHERE movie_ratings.movie_id = movies.id
      ) AS community_rating_vote_count
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
  const { limit = 30, page = 1 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const offset = (normalizedPage - 1) * normalizedLimit

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
    OFFSET $2
  `,
    [normalizedLimit, offset]
  )

  return result.rows
}

export async function listTopRatedMovies(pool, options = {}) {
  const { limit = 30, page = 1 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const offset = (normalizedPage - 1) * normalizedLimit

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
    OFFSET $2
  `,
    [normalizedLimit, offset]
  )

  return result.rows
}

export async function listUpcomingMovies(pool, options = {}) {
  const { limit = 30, page = 1 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const offset = (normalizedPage - 1) * normalizedLimit

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
    OFFSET $2
  `,
    [normalizedLimit, offset]
  )

  return result.rows
}

export async function listTvShows(pool, options = {}) {
  const { limit = 30, page = 1 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const offset = (normalizedPage - 1) * normalizedLimit

  const result = await pool.query(
    `
    SELECT
      tv_shows.tmdb_id,
      tv_shows.name,
      tv_shows.original_name,
      tv_shows.overview,
      tv_shows.first_air_date,
      tv_shows.original_language,
      tv_shows.poster_path,
      tv_shows.backdrop_path,
      tv_shows.popularity,
      tv_shows.vote_average,
      tv_shows.vote_count,
      tv_shows.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(tv_genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      tv_shows.detail_payload,
      tv_shows.raw_payload,
      tv_shows.import_rank,
      tv_shows.imported_at
    FROM tv_shows
    LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    GROUP BY tv_shows.id
    ORDER BY tv_shows.popularity DESC NULLS LAST, tv_shows.tmdb_id ASC
    LIMIT $1
    OFFSET $2
  `,
    [normalizedLimit, offset]
  )

  return result.rows
}

export async function searchTvShows(pool, query, limit = 30) {
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30

  const result = await pool.query(
    `
    SELECT
      tv_shows.tmdb_id,
      tv_shows.name,
      tv_shows.original_name,
      tv_shows.overview,
      tv_shows.first_air_date,
      tv_shows.original_language,
      tv_shows.poster_path,
      tv_shows.backdrop_path,
      tv_shows.popularity,
      tv_shows.vote_average,
      tv_shows.vote_count,
      tv_shows.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(tv_genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      tv_shows.detail_payload,
      tv_shows.raw_payload,
      tv_shows.import_rank,
      tv_shows.imported_at
    FROM tv_shows
    LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE POSITION(LOWER($1) IN LOWER(tv_shows.name)) > 0
    GROUP BY tv_shows.id
    ORDER BY tv_shows.popularity DESC NULLS LAST, tv_shows.name ASC, tv_shows.tmdb_id ASC
    LIMIT $2
  `,
    [query, normalizedLimit]
  )

  return result.rows
}

export async function searchActors(pool, query, limit = 30) {
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const result = await pool.query(
    `
    SELECT
      tmdb_person_id,
      name,
      profile_path,
      known_for_department,
      popularity
    FROM cast_members
    WHERE POSITION(LOWER($1) IN LOWER(name)) > 0
    ORDER BY popularity DESC NULLS LAST, name ASC, tmdb_person_id ASC
    LIMIT $2
  `,
    [query, normalizedLimit]
  )

  return result.rows
}

export async function listRecentlyAiredTvShows(pool, options = {}) {
  const { limit = 30, page = 1 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const offset = (normalizedPage - 1) * normalizedLimit

  const result = await pool.query(
    `
    SELECT
      tv_shows.tmdb_id,
      tv_shows.name,
      tv_shows.original_name,
      tv_shows.overview,
      tv_shows.first_air_date,
      tv_shows.original_language,
      tv_shows.poster_path,
      tv_shows.backdrop_path,
      tv_shows.popularity,
      tv_shows.vote_average,
      tv_shows.vote_count,
      tv_shows.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(tv_genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      tv_shows.detail_payload,
      tv_shows.raw_payload,
      tv_shows.import_rank,
      tv_shows.imported_at
    FROM tv_shows
    LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE tv_shows.first_air_date IS NOT NULL
      AND tv_shows.first_air_date <= CURRENT_DATE
    GROUP BY tv_shows.id
    ORDER BY tv_shows.first_air_date DESC, tv_shows.tmdb_id ASC
    LIMIT $1
    OFFSET $2
  `,
    [normalizedLimit, offset]
  )

  return result.rows
}

export async function listLatestEpisodeTvShows(pool) {
  const result = await pool.query(
    `
      WITH latest_episodes AS (
        SELECT DISTINCT ON (tv_seasons.tv_show_id)
          tv_seasons.tv_show_id,
          tv_seasons.season_number,
          tv_episodes.episode_number,
          tv_episodes.name AS episode_name,
          tv_episodes.air_date
        FROM tv_episodes
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
        WHERE tv_episodes.air_date IS NOT NULL
          AND tv_episodes.air_date <= CURRENT_DATE
        ORDER BY tv_seasons.tv_show_id, tv_episodes.air_date DESC, tv_seasons.season_number DESC, tv_episodes.episode_number DESC
      )
      SELECT
        tv_shows.tmdb_id,
        tv_shows.name,
        tv_shows.poster_path,
        tv_shows.backdrop_path,
        tv_shows.popularity,
        latest_episodes.season_number,
        latest_episodes.episode_number,
        latest_episodes.episode_name,
        latest_episodes.air_date
      FROM latest_episodes
      JOIN tv_shows ON tv_shows.id = latest_episodes.tv_show_id
      ORDER BY latest_episodes.air_date DESC, tv_shows.popularity DESC NULLS LAST, tv_shows.tmdb_id ASC
      LIMIT 10
    `
  )

  return result.rows
}

export async function listTopRatedTvShows(pool, options = {}) {
  const { limit = 30, page = 1 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const offset = (normalizedPage - 1) * normalizedLimit

  const result = await pool.query(
    `
    SELECT
      tv_shows.tmdb_id,
      tv_shows.name,
      tv_shows.original_name,
      tv_shows.overview,
      tv_shows.first_air_date,
      tv_shows.original_language,
      tv_shows.poster_path,
      tv_shows.backdrop_path,
      tv_shows.popularity,
      tv_shows.vote_average,
      tv_shows.vote_count,
      tv_shows.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(tv_genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      tv_shows.detail_payload,
      tv_shows.raw_payload,
      tv_shows.import_rank,
      tv_shows.imported_at
    FROM tv_shows
    LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE tv_shows.first_air_date IS NOT NULL
      AND tv_shows.first_air_date <= CURRENT_DATE
    GROUP BY tv_shows.id
    ORDER BY tv_shows.vote_average DESC NULLS LAST, tv_shows.vote_count DESC NULLS LAST, tv_shows.tmdb_id ASC
    LIMIT $1
    OFFSET $2
  `,
    [normalizedLimit, offset]
  )

  return result.rows
}

export async function listUpcomingTvShows(pool, options = {}) {
  const { limit = 30, page = 1 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const offset = (normalizedPage - 1) * normalizedLimit

  const result = await pool.query(
    `
    SELECT
      tv_shows.tmdb_id,
      tv_shows.name,
      tv_shows.original_name,
      tv_shows.overview,
      tv_shows.first_air_date,
      tv_shows.original_language,
      tv_shows.poster_path,
      tv_shows.backdrop_path,
      tv_shows.popularity,
      tv_shows.vote_average,
      tv_shows.vote_count,
      tv_shows.genre_ids,
      COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(tv_genres.name ORDER BY genre_ids.ordinality), NULL),
        '{}'
      ) AS genre_names,
      tv_shows.detail_payload,
      tv_shows.raw_payload,
      tv_shows.import_rank,
      tv_shows.imported_at
    FROM tv_shows
    LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
    LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id = genre_ids.tmdb_genre_id
    WHERE tv_shows.first_air_date IS NOT NULL
      AND tv_shows.first_air_date > CURRENT_DATE
    GROUP BY tv_shows.id
    ORDER BY tv_shows.first_air_date ASC, tv_shows.tmdb_id ASC
    LIMIT $1
    OFFSET $2
  `,
    [normalizedLimit, offset]
  )

  return result.rows
}

export async function getTvShowByTmdbId(pool, tmdbId) {
  const result = await pool.query(
    `SELECT tv_shows.*, COALESCE(ARRAY_REMOVE(ARRAY_AGG(tv_genres.name ORDER BY genre_ids.ordinality), NULL), '{}') AS genre_names
     FROM tv_shows
     LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
     LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id = genre_ids.tmdb_genre_id
     WHERE tv_shows.tmdb_id = $1 OR tv_shows.id = $1
     GROUP BY tv_shows.id
     ORDER BY CASE WHEN tv_shows.tmdb_id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [tmdbId]
  )
  return result.rows[0] ?? null
}

export async function replaceTvDetailRelations(pool, tmdbId, detail = {}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const showResult = await client.query('SELECT id FROM tv_shows WHERE tmdb_id = $1 LIMIT 1', [tmdbId])
    const showId = showResult.rows[0]?.id
    if (!showId) throw new Error(`TV show ${tmdbId} is missing after hydration`)
    await client.query('DELETE FROM tv_show_credits WHERE tv_show_id = $1', [showId])
    await client.query('DELETE FROM tv_recommendations WHERE tv_show_id = $1', [showId])
    await client.query('DELETE FROM tv_trailers WHERE tv_show_id = $1', [showId])
    for (const credit of detail.credits ?? []) {
      if (!Number.isInteger(credit.tmdbPersonId)) continue
      await client.query(`INSERT INTO tv_show_credits (tv_show_id, tmdb_person_id, name, profile_path, character_name, department, job, billing_order, credit_type)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (tv_show_id, tmdb_person_id, credit_type) DO UPDATE SET
        name=EXCLUDED.name, profile_path=EXCLUDED.profile_path, character_name=EXCLUDED.character_name, department=EXCLUDED.department, job=EXCLUDED.job, billing_order=EXCLUDED.billing_order`,
      [showId, credit.tmdbPersonId, credit.name, credit.profilePath ?? null, credit.characterName ?? null, credit.department ?? null, credit.job ?? null, credit.billingOrder ?? null, credit.creditType])
    }
    for (const item of detail.recommendations ?? []) {
      if (!Number.isInteger(item.tmdbId)) continue
      await client.query(`INSERT INTO tv_recommendations (tv_show_id, recommended_tmdb_id, name, first_air_date, poster_path, vote_average, display_order, raw_payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT (tv_show_id, recommended_tmdb_id) DO UPDATE SET
        name=EXCLUDED.name, first_air_date=EXCLUDED.first_air_date, poster_path=EXCLUDED.poster_path, vote_average=EXCLUDED.vote_average, display_order=EXCLUDED.display_order, raw_payload=EXCLUDED.raw_payload`,
      [showId, item.tmdbId, item.name, item.firstAirDate ?? null, item.posterPath ?? null, item.voteAverage ?? null, item.displayOrder, JSON.stringify(item.rawPayload ?? {})])
    }
    for (const trailer of detail.trailers ?? []) {
      if (!trailer.key) continue
      await client.query(`INSERT INTO tv_trailers (tv_show_id, provider, video_key, name, site, video_type, is_official)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tv_show_id, provider, video_key) DO UPDATE SET name=EXCLUDED.name, site=EXCLUDED.site, video_type=EXCLUDED.video_type, is_official=EXCLUDED.is_official`,
      [showId, trailer.provider, trailer.key, trailer.name, trailer.site, trailer.type ?? null, Boolean(trailer.official)])
    }
    for (const season of detail.seasons ?? []) {
      if (!Number.isInteger(season.seasonNumber)) continue
      const seasonResult = await client.query(`INSERT INTO tv_seasons (tv_show_id, tmdb_id, season_number, name, overview, air_date, poster_path, episode_count, raw_payload, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW()) ON CONFLICT (tv_show_id, season_number) DO UPDATE SET
        tmdb_id=EXCLUDED.tmdb_id, name=EXCLUDED.name, overview=EXCLUDED.overview, air_date=EXCLUDED.air_date, poster_path=EXCLUDED.poster_path, episode_count=EXCLUDED.episode_count, raw_payload=EXCLUDED.raw_payload, updated_at=NOW() RETURNING id`,
      [showId, season.tmdbId ?? null, season.seasonNumber, season.name || `Season ${season.seasonNumber}`, season.overview ?? null, season.airDate ?? null, season.posterPath ?? null, season.episodeCount ?? 0, JSON.stringify(season.rawPayload ?? {})])
      const seasonId = seasonResult.rows[0].id
      if (Array.isArray(season.episodes)) {
        for (const episode of season.episodes) {
          if (!Number.isInteger(episode.episodeNumber)) continue
          await client.query(`INSERT INTO tv_episodes (tv_season_id, tmdb_id, episode_number, name, overview, air_date, runtime_minutes, still_path, raw_payload, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW())
            ON CONFLICT (tv_season_id, episode_number) DO UPDATE SET
              tmdb_id=EXCLUDED.tmdb_id, name=EXCLUDED.name, overview=EXCLUDED.overview,
              air_date=EXCLUDED.air_date, runtime_minutes=EXCLUDED.runtime_minutes,
              still_path=EXCLUDED.still_path, raw_payload=EXCLUDED.raw_payload, updated_at=NOW()`,
          [seasonId, episode.tmdbId ?? null, episode.episodeNumber, episode.name || `Episode ${episode.episodeNumber}`, episode.overview ?? null, episode.airDate ?? null, episode.runtimeMinutes ?? null, episode.stillPath ?? null, JSON.stringify(episode.rawPayload ?? {})])
        }
      }
    }
    await client.query('UPDATE tv_shows SET detail_hydrated_at=NOW() WHERE id=$1', [showId])
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function getTvDetailForUser(pool, { showId, username = null }) {
  const show = await getTvShowByTmdbId(pool, showId)
  if (!show) return null
  const [seasons, credits, recommendations, trailers, ratingSummary] = await Promise.all([
    pool.query(`SELECT s.*, COALESCE(json_agg(json_build_object('id', e.id, 'tmdb_id', e.tmdb_id, 'episode_number', e.episode_number, 'name', e.name, 'overview', e.overview, 'air_date', e.air_date, 'runtime_minutes', e.runtime_minutes, 'still_path', e.still_path, 'is_aired', e.air_date IS NULL OR e.air_date <= CURRENT_DATE, 'watched', w.id IS NOT NULL, 'your_score', r.score) ORDER BY e.episode_number) FILTER (WHERE e.id IS NOT NULL), '[]') AS episodes FROM tv_seasons s LEFT JOIN tv_episodes e ON e.tv_season_id=s.id LEFT JOIN watched_tv_episodes w ON w.tv_episode_id=e.id AND w.user_id=(SELECT id FROM users WHERE username=$2) LEFT JOIN tv_episode_ratings r ON r.tv_episode_id=e.id AND r.user_id=(SELECT id FROM users WHERE username=$2) WHERE s.tv_show_id=$1 GROUP BY s.id ORDER BY s.season_number`, [show.id, username]),
    pool.query('SELECT * FROM tv_show_credits WHERE tv_show_id = $1 ORDER BY credit_type, billing_order NULLS LAST LIMIT 12', [show.id]),
    pool.query('SELECT * FROM tv_recommendations WHERE tv_show_id = $1 ORDER BY display_order LIMIT 10', [show.id]),
    pool.query('SELECT * FROM tv_trailers WHERE tv_show_id = $1 ORDER BY is_official DESC LIMIT 5', [show.id]),
    pool.query(`SELECT AVG(r.score)::DOUBLE PRECISION AS community_average, COUNT(r.id)::INTEGER AS community_vote_count, AVG(r.score) FILTER (WHERE r.user_id = (SELECT id FROM users WHERE username = $2))::DOUBLE PRECISION AS your_average, COUNT(r.id) FILTER (WHERE r.user_id = (SELECT id FROM users WHERE username = $2))::INTEGER AS your_rating_count FROM tv_episodes e JOIN tv_seasons s ON s.id = e.tv_season_id LEFT JOIN tv_episode_ratings r ON r.tv_episode_id = e.id WHERE s.tv_show_id = $1`, [show.id, username]),
  ])
  const ratings = ratingSummary.rows[0] ?? {}
  return {
    show,
    seasons: seasons.rows,
    credits: credits.rows,
    recommendations: recommendations.rows,
    trailers: trailers.rows,
    communityRating: { average: ratings.community_average === null || ratings.community_average === undefined ? null : Number(ratings.community_average), voteCount: Number(ratings.community_vote_count ?? 0) },
    yourEpisodeRating: { average: ratings.your_average === null || ratings.your_average === undefined ? null : Number(ratings.your_average), ratingCount: Number(ratings.your_rating_count ?? 0) },
  }
}

export async function upsertTvEpisodeRatingForUser(pool, { username, episodeId, score }) {
  const result = await pool.query(
    `WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1), selected_episode AS (SELECT id FROM tv_episodes WHERE id = $2 LIMIT 1), saved_rating AS (INSERT INTO tv_episode_ratings (user_id, tv_episode_id, score, created_at, updated_at) SELECT selected_user.id, selected_episode.id, $3, NOW(), NOW() FROM selected_user CROSS JOIN selected_episode ON CONFLICT (user_id, tv_episode_id) DO UPDATE SET score = EXCLUDED.score, updated_at = NOW() RETURNING score) SELECT EXISTS(SELECT 1 FROM selected_user) AS has_user, EXISTS(SELECT 1 FROM selected_episode) AS has_episode, (SELECT score::DOUBLE PRECISION FROM saved_rating) AS score`,
    [username, episodeId, score]
  )
  const row = result.rows[0] ?? null
  if (!row?.has_user) return { status: 'missing_user' }
  if (!row.has_episode) return { status: 'missing_episode' }
  return { status: 'ok', score: Number(row.score) }
}

export function normalizeWatchService(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized ? normalized.slice(0, 80) : null
}

export async function updateTvEpisodeWatchStateForUser(pool, { username, showId, action, episodeId = null, seasonId = null, watchService = null }) {
  const normalizedWatchService = normalizeWatchService(watchService)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const contextResult = await client.query(
      `SELECT u.id AS user_id, t.id AS show_id
       FROM users u CROSS JOIN tv_shows t
       WHERE u.username = $1 AND (t.tmdb_id = $2 OR t.id = $2)
       LIMIT 1`,
      [username, showId]
    )
    const context = contextResult.rows[0]
    if (!context) {
      await client.query('ROLLBACK')
      return { status: 'missing_user_or_show' }
    }

    let updatedCount = 0
    if (action === 'mark_episode' || action === 'unmark_episode' || action === 'mark_through_episode') {
      const episodeResult = await client.query(
        `SELECT e.id, e.episode_number, s.season_number
         FROM tv_episodes e
         JOIN tv_seasons s ON s.id = e.tv_season_id
         WHERE e.id = $1 AND s.tv_show_id = $2 AND (e.air_date IS NULL OR e.air_date <= CURRENT_DATE)
         LIMIT 1`,
        [episodeId, context.show_id]
      )
      const episode = episodeResult.rows[0]
      if (!episode) {
        await client.query('ROLLBACK')
        return { status: 'missing_episode' }
      }

      let result
      if (action === 'unmark_episode') {
        result = await client.query(
          'DELETE FROM watched_tv_episodes WHERE user_id = $1 AND tv_episode_id = $2',
          [context.user_id, episode.id]
        )
      } else if (action === 'mark_episode') {
        result = await client.query(
          'INSERT INTO watched_tv_episodes (user_id, tv_episode_id, watch_service) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [context.user_id, episode.id, normalizedWatchService]
        )
      } else {
        result = await client.query(
          `INSERT INTO watched_tv_episodes (user_id, tv_episode_id, watch_service)
           SELECT $1, e.id, $5
           FROM tv_episodes e
           JOIN tv_seasons s ON s.id = e.tv_season_id
           WHERE s.tv_show_id = $2
             AND (e.air_date IS NULL OR e.air_date <= CURRENT_DATE)
             AND (s.season_number < $3 OR (s.season_number = $3 AND e.episode_number <= $4))
           ON CONFLICT DO NOTHING`,
          [context.user_id, context.show_id, episode.season_number, episode.episode_number, normalizedWatchService]
        )
      }
      updatedCount = result.rowCount ?? 0
    } else if (action === 'mark_season') {
      const seasonResult = await client.query(
        'SELECT id FROM tv_seasons WHERE id = $1 AND tv_show_id = $2 LIMIT 1',
        [seasonId, context.show_id]
      )
      const season = seasonResult.rows[0]
      if (!season) {
        await client.query('ROLLBACK')
        return { status: 'missing_season' }
      }
      const result = await client.query(
        `INSERT INTO watched_tv_episodes (user_id, tv_episode_id, watch_service)
         SELECT $1, e.id, $3
         FROM tv_episodes e
         WHERE e.tv_season_id = $2 AND (e.air_date IS NULL OR e.air_date <= CURRENT_DATE)
         ON CONFLICT DO NOTHING`,
        [context.user_id, season.id, normalizedWatchService]
      )
      updatedCount = result.rowCount ?? 0
    } else {
      await client.query('ROLLBACK')
      return { status: 'invalid_action' }
    }

    await syncTvShowWatchCompletion(client, username, showId)
    await client.query('COMMIT')
    return { status: 'ok', updatedCount }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

async function syncTvShowWatchCompletion(client, username, showId) {
  const result = await client.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1), selected_show AS (SELECT id FROM tv_shows WHERE tmdb_id=$2 OR id=$2 LIMIT 1), episode_totals AS (SELECT COUNT(*)::integer total, COUNT(w.id)::integer watched FROM tv_episodes e JOIN tv_seasons s ON s.id=e.tv_season_id LEFT JOIN watched_tv_episodes w ON w.tv_episode_id=e.id AND w.user_id=(SELECT id FROM selected_user) WHERE s.tv_show_id=(SELECT id FROM selected_show) AND (e.air_date IS NULL OR e.air_date <= CURRENT_DATE)) SELECT (SELECT id FROM selected_user) user_id, (SELECT id FROM selected_show) show_id, total, watched FROM episode_totals`, [username, showId])
  const row = result.rows[0]
  if (!row?.user_id || !row?.show_id) return
  if (row.total > 0 && row.total === row.watched) await client.query('INSERT INTO watched_tv_shows (user_id,tv_show_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [row.user_id, row.show_id])
  else await client.query('DELETE FROM watched_tv_shows WHERE user_id=$1 AND tv_show_id=$2', [row.user_id, row.show_id])
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

export async function listCoStarsForPerson(pool, tmdbPersonId, options = {}) {
  const limit = Number.isInteger(options.limit) ? Math.max(1, options.limit) : 6
  const result = await pool.query(
    `
      SELECT
        peer_cast.tmdb_person_id,
        peer_cast.name,
        peer_cast.profile_path,
        COUNT(*)::INTEGER AS shared_credits
      FROM cast_members target_cast
      JOIN movie_cast target_movie_cast
        ON target_movie_cast.cast_member_id = target_cast.id
      JOIN movie_cast peer_movie_cast
        ON peer_movie_cast.movie_id = target_movie_cast.movie_id
       AND peer_movie_cast.credit_type = 'actor'
      JOIN cast_members peer_cast
        ON peer_cast.id = peer_movie_cast.cast_member_id
      WHERE target_cast.tmdb_person_id = $1
        AND peer_cast.tmdb_person_id <> $1
      GROUP BY peer_cast.tmdb_person_id, peer_cast.name, peer_cast.profile_path
      ORDER BY shared_credits DESC, peer_cast.name ASC
      LIMIT $2
    `,
    [tmdbPersonId, limit]
  )

  return result.rows
}

export async function ensureFavoriteActorsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorite_actors (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cast_member_id BIGINT NOT NULL REFERENCES cast_members(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, cast_member_id)
    )
  `)
}

export async function listFavoriteActorsForUser(pool, username) {
  const result = await pool.query(
    `
      SELECT
        cast_members.tmdb_person_id,
        cast_members.name,
        cast_members.profile_path,
        cast_members.known_for_department,
        cast_members.popularity,
        favorite_actors.created_at AS favorited_at
      FROM favorite_actors
      JOIN users ON users.id = favorite_actors.user_id
      JOIN cast_members ON cast_members.id = favorite_actors.cast_member_id
      WHERE users.username = $1
      ORDER BY favorite_actors.created_at DESC, cast_members.name ASC
    `,
    [username]
  )

  return result.rows
}

export async function toggleFavoriteActorForUser(pool, { username, personId }) {
  const result = await pool.query(
    `
      WITH selected_user AS (
        SELECT id FROM users WHERE username = $1 LIMIT 1
      ),
      selected_actor AS (
        SELECT id FROM cast_members WHERE tmdb_person_id = $2 LIMIT 1
      ),
      existing_favorite AS (
        SELECT favorite_actors.id
        FROM favorite_actors
        JOIN selected_user ON selected_user.id = favorite_actors.user_id
        JOIN selected_actor ON selected_actor.id = favorite_actors.cast_member_id
      ),
      removed_favorite AS (
        DELETE FROM favorite_actors
        WHERE id IN (SELECT id FROM existing_favorite)
        RETURNING id
      ),
      inserted_favorite AS (
        INSERT INTO favorite_actors (user_id, cast_member_id)
        SELECT selected_user.id, selected_actor.id
        FROM selected_user CROSS JOIN selected_actor
        WHERE NOT EXISTS (SELECT 1 FROM existing_favorite)
        RETURNING id
      )
      SELECT
        EXISTS (SELECT 1 FROM selected_user) AS has_user,
        EXISTS (SELECT 1 FROM selected_actor) AS has_actor,
        EXISTS (SELECT 1 FROM inserted_favorite) AS favorited
    `,
    [username, personId]
  )

  const row = result.rows[0] ?? {}
  if (!row.has_user) return { status: 'missing_user' }
  if (!row.has_actor) return { status: 'missing_actor' }
  return { status: 'ok', favorited: Boolean(row.favorited) }
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

export async function addMovieToWatchedForUser(pool, { username, movieId, watchService = null }) {
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
          watch_service,
          created_at
        )
        SELECT
          selected_user.id,
          selected_movie.id,
          $3,
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
    [username, movieId, normalizeWatchService(watchService)]
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

export async function getMovieStatsForUser(pool, username, period = 'month') {
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
          AND watched_movies.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ),
      watchlist_totals AS (
        SELECT COUNT(*)::INTEGER AS watchlist_count
        FROM watchlist_items
        WHERE watchlist_items.user_id IN (SELECT id FROM selected_user)
          AND watchlist_items.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ),
      rating_totals AS (
        SELECT AVG(movie_ratings.score)::DOUBLE PRECISION AS average_rating
        FROM movie_ratings
        WHERE movie_ratings.user_id IN (SELECT id FROM selected_user)
          AND GREATEST(movie_ratings.created_at, movie_ratings.updated_at) >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      )
      SELECT
        EXISTS(SELECT 1 FROM selected_user) AS has_user,
        COALESCE((SELECT movies_watched FROM watched_totals), 0) AS movies_watched,
        COALESCE((SELECT time_watched_minutes FROM watched_totals), 0) AS time_watched_minutes,
        COALESCE((SELECT watchlist_count FROM watchlist_totals), 0) AS watchlist_count,
        (SELECT average_rating FROM rating_totals) AS average_rating
    `,
    [username, period]
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
    averageRating: row.average_rating === null || row.average_rating === undefined ? null : Number(row.average_rating),
  }
}

export async function getStatsInsightsForUser(pool, username, { period = 'year', timeZone = 'UTC' } = {}) {
  const [result, topRatedThisMonth, mostWatchedActors, streamingPlatforms, recentHistory, yearInReview] = await Promise.all([
    pool.query(
    `
      WITH selected_user AS (
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
      ),
      stats_insight_events AS (
        SELECT
          'movie'::TEXT AS media_type,
          watched_movies.created_at AS watched_at,
          COALESCE(movies.runtime_minutes, 0)::INTEGER AS runtime_minutes,
          COALESCE(ARRAY_REMOVE(ARRAY_AGG(genres.name), NULL), '{}') AS genre_names
        FROM watched_movies
        JOIN movies ON movies.id = watched_movies.movie_id
        LEFT JOIN LATERAL UNNEST(movies.genre_ids) AS selected_genre(tmdb_genre_id) ON TRUE
        LEFT JOIN genres ON genres.tmdb_genre_id = selected_genre.tmdb_genre_id
        WHERE watched_movies.user_id IN (SELECT id FROM selected_user)
          AND watched_movies.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        GROUP BY watched_movies.id, watched_movies.created_at, movies.runtime_minutes

        UNION ALL

        SELECT
          'tv'::TEXT AS media_type,
          watched_tv_episodes.watched_at AS watched_at,
          COALESCE(tv_episodes.runtime_minutes, 0)::INTEGER AS runtime_minutes,
          COALESCE(ARRAY_REMOVE(ARRAY_AGG(tv_genres.name), NULL), '{}') AS genre_names
        FROM watched_tv_episodes
        JOIN tv_episodes ON tv_episodes.id = watched_tv_episodes.tv_episode_id
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
        JOIN tv_shows ON tv_shows.id = tv_seasons.tv_show_id
        LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) AS selected_genre(tmdb_genre_id) ON TRUE
        LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id = selected_genre.tmdb_genre_id
        WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user)
          AND watched_tv_episodes.watched_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        GROUP BY watched_tv_episodes.id, watched_tv_episodes.watched_at, tv_episodes.runtime_minutes
      )
      SELECT media_type, watched_at, runtime_minutes, genre_names
      FROM stats_insight_events
      ORDER BY watched_at ASC
    `,
      [username, period]
    ),
    getTopRatedThisMonthForUser(pool, username),
    getMostWatchedActorsForUser(pool, username, period),
    getStreamingPlatformsForUser(pool, username, period),
    getRecentHistoryForUser(pool, username),
    getYearInReviewForUser(pool, username),
  ])

  return { ...buildStatsInsights(result.rows, { period, timeZone }), topRatedThisMonth, mostWatchedActors, streamingPlatforms, recentHistory, yearInReview }
}

export async function getRecentHistoryForUser(pool, username) {
  const result = await pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1), events AS (
    SELECT movies.tmdb_id, movies.title, movies.poster_path, 'movie'::TEXT AS media_type, NULL::INTEGER AS season_number, NULL::INTEGER AS episode_number, watched_movies.created_at AS watched_at FROM watched_movies JOIN movies ON movies.id=watched_movies.movie_id WHERE watched_movies.user_id IN (SELECT id FROM selected_user)
    UNION ALL
    SELECT tv_shows.tmdb_id, tv_shows.name AS title, tv_shows.poster_path, 'tv'::TEXT AS media_type, tv_seasons.season_number, tv_episodes.episode_number, watched_tv_episodes.watched_at FROM watched_tv_episodes JOIN tv_episodes ON tv_episodes.id=watched_tv_episodes.tv_episode_id JOIN tv_seasons ON tv_seasons.id=tv_episodes.tv_season_id JOIN tv_shows ON tv_shows.id=tv_seasons.tv_show_id WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user)
  ) SELECT * FROM events ORDER BY watched_at DESC LIMIT 5`, [username])
  return result.rows.map((row) => ({ ...(Number.isInteger(Number(row.tmdb_id)) ? { id: Number(row.tmdb_id) } : {}), title: row.title, posterPath: row.poster_path ?? null, mediaType: row.media_type === 'tv' ? 'tv' : 'movie', seasonNumber: row.season_number === null ? null : Number(row.season_number), episodeNumber: row.episode_number === null ? null : Number(row.episode_number), watchedAt: row.watched_at }))
}

export async function getYearInReviewForUser(pool, username) {
  const [eventsResult, ratingsResult] = await Promise.all([
    pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1), events AS (
      SELECT 'movie'::TEXT media_type, movies.id::TEXT title_key, watched_movies.created_at watched_at, COALESCE(movies.runtime_minutes,0)::INTEGER runtime_minutes, COALESCE(ARRAY_REMOVE(ARRAY_AGG(genres.name),NULL),'{}') genre_names FROM watched_movies JOIN movies ON movies.id=watched_movies.movie_id LEFT JOIN LATERAL UNNEST(movies.genre_ids) selected_genre(tmdb_genre_id) ON TRUE LEFT JOIN genres ON genres.tmdb_genre_id=selected_genre.tmdb_genre_id WHERE watched_movies.user_id IN (SELECT id FROM selected_user) AND watched_movies.created_at >= date_trunc('year', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' GROUP BY watched_movies.id,movies.id
      UNION ALL
      SELECT 'tv'::TEXT, tv_seasons.tv_show_id::TEXT, watched_tv_episodes.watched_at, COALESCE(tv_episodes.runtime_minutes,0)::INTEGER, COALESCE(ARRAY_REMOVE(ARRAY_AGG(tv_genres.name),NULL),'{}') FROM watched_tv_episodes JOIN tv_episodes ON tv_episodes.id=watched_tv_episodes.tv_episode_id JOIN tv_seasons ON tv_seasons.id=tv_episodes.tv_season_id JOIN tv_shows ON tv_shows.id=tv_seasons.tv_show_id LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) selected_genre(tmdb_genre_id) ON TRUE LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id=selected_genre.tmdb_genre_id WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user) AND watched_tv_episodes.watched_at >= date_trunc('year', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' GROUP BY watched_tv_episodes.id,tv_seasons.tv_show_id,tv_episodes.runtime_minutes
    ) SELECT * FROM events`, [username]),
    pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1) SELECT score::DOUBLE PRECISION score, GREATEST(created_at,updated_at) rated_at FROM movie_ratings WHERE user_id IN (SELECT id FROM selected_user) AND GREATEST(created_at,updated_at) >= date_trunc('year', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' UNION ALL SELECT score::DOUBLE PRECISION, GREATEST(created_at,updated_at) FROM tv_episode_ratings WHERE user_id IN (SELECT id FROM selected_user) AND GREATEST(created_at,updated_at) >= date_trunc('year', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [username]),
  ])
  return buildYearInReview(eventsResult.rows, ratingsResult.rows)
}

export function buildYearInReview(events = [], ratings = []) {
  const titleKeys = new Set(); const genreMinutes = new Map(); const monthMinutes = Array(12).fill(0); const dates = new Set(); let minutes = 0; let episodes = 0
  for (const event of events) { const date = new Date(event.watched_at); if (Number.isNaN(date.valueOf())) continue; minutes += Number(event.runtime_minutes) || 0; if (event.media_type === 'tv') episodes += 1; titleKeys.add(`${event.media_type}-${event.title_key}`); dates.add(date.toISOString().slice(0,10)); monthMinutes[date.getUTCMonth()] += Number(event.runtime_minutes) || 0; for (const genre of event.genre_names ?? []) genreMinutes.set(genre,(genreMinutes.get(genre) ?? 0)+(Number(event.runtime_minutes)||0)) }
  const scores = ratings.map((rating) => Number(rating.score)).filter(Number.isFinite); const topGenre = [...genreMinutes].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0] ?? null; const maxMonth = Math.max(...monthMinutes); const mostWatchedMonth = maxMonth ? new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(new Date().getUTCFullYear(),monthMinutes.indexOf(maxMonth),1))) : null
  const orderedDates = [...dates].sort(); let longest = 0; let streak = 0; let previous = null; for (const value of orderedDates) { const current = new Date(`${value}T00:00:00Z`); streak = previous && current - previous === 86400000 ? streak + 1 : 1; longest = Math.max(longest, streak); previous = current }
  return { titlesWatched:titleKeys.size, minutes, episodesWatched:episodes, averageRating:scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null, topGenre, longestStreak:longest, mostWatchedMonth, newFavorites:scores.filter((score)=>score>=4.5).length }
}

export async function getMostWatchedActorsForUser(pool, username, period) {
  const result = await pool.query(
    `
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1),
      watched_titles AS (
        SELECT cast_members.tmdb_person_id::TEXT AS person_key, cast_members.name, cast_members.profile_path, 'movie-' || movies.id::TEXT AS title_key
        FROM watched_movies
        JOIN movies ON movies.id = watched_movies.movie_id
        JOIN movie_cast ON movie_cast.movie_id = movies.id AND movie_cast.credit_type = 'actor'
        JOIN cast_members ON cast_members.id = movie_cast.cast_member_id
        WHERE watched_movies.user_id IN (SELECT id FROM selected_user)
          AND watched_movies.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'

        UNION ALL

        SELECT tv_show_credits.tmdb_person_id::TEXT AS person_key, tv_show_credits.name, tv_show_credits.profile_path, 'tv-' || tv_shows.id::TEXT AS title_key
        FROM (
          SELECT DISTINCT tv_seasons.tv_show_id
          FROM watched_tv_episodes
          JOIN tv_episodes ON tv_episodes.id = watched_tv_episodes.tv_episode_id
          JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
          WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user)
            AND watched_tv_episodes.watched_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        ) AS watched_tv_shows
        JOIN tv_shows ON tv_shows.id = watched_tv_shows.tv_show_id
        JOIN tv_show_credits ON tv_show_credits.tv_show_id = tv_shows.id AND tv_show_credits.credit_type = 'actor'
      )
      SELECT person_key, name, MAX(profile_path) AS profile_path, COUNT(DISTINCT title_key)::INTEGER AS title_count
      FROM watched_titles
      GROUP BY person_key, name
      ORDER BY title_count DESC, name ASC
      LIMIT 4
    `,
    [username, period]
  )
  return result.rows.map((row) => ({ personId: row.person_key, name: row.name, profilePath: row.profile_path ?? null, titleCount: Number(row.title_count) }))
}

export async function getStreamingPlatformsForUser(pool, username, period) {
  const result = await pool.query(
    `
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1),
      service_minutes AS (
        SELECT watched_movies.watch_service AS name, COALESCE(movies.runtime_minutes, 0)::INTEGER AS minutes
        FROM watched_movies
        JOIN movies ON movies.id = watched_movies.movie_id
        WHERE watched_movies.user_id IN (SELECT id FROM selected_user)
          AND watched_movies.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND watched_movies.watch_service IS NOT NULL

        UNION ALL

        SELECT watched_tv_episodes.watch_service AS name, COALESCE(tv_episodes.runtime_minutes, 0)::INTEGER AS minutes
        FROM watched_tv_episodes
        JOIN tv_episodes ON tv_episodes.id = watched_tv_episodes.tv_episode_id
        WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user)
          AND watched_tv_episodes.watched_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND watched_tv_episodes.watch_service IS NOT NULL
      )
      SELECT name, SUM(minutes)::INTEGER AS minutes
      FROM service_minutes
      GROUP BY name
      ORDER BY minutes DESC, name ASC
    `,
    [username, period]
  )
  const platforms = result.rows.map((row) => ({ name: row.name, minutes: Number(row.minutes) }))
  const totalMinutes = platforms.reduce((total, platform) => total + platform.minutes, 0)
  return platforms.slice(0, 5).map((platform) => ({ ...platform, percent: totalMinutes ? Math.round((platform.minutes / totalMinutes) * 100) : 0 }))
}

export async function getTopRatedThisMonthForUser(pool, username) {
  const result = await pool.query(
    `
      WITH selected_user AS (
        SELECT id FROM users WHERE username = $1 LIMIT 1
      ),
      movie_ratings_this_month AS (
        SELECT
          movies.tmdb_id,
          movies.title,
          movies.poster_path,
          movie_ratings.score::DOUBLE PRECISION AS score,
          GREATEST(movie_ratings.created_at, movie_ratings.updated_at) AS rated_at
        FROM movie_ratings
        JOIN movies ON movies.id = movie_ratings.movie_id
        WHERE movie_ratings.user_id IN (SELECT id FROM selected_user)
          AND GREATEST(movie_ratings.created_at, movie_ratings.updated_at) >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ),
      tv_ratings_this_month AS (
        SELECT
          tv_shows.tmdb_id,
          tv_shows.name AS title,
          tv_shows.poster_path,
          AVG(tv_episode_ratings.score)::DOUBLE PRECISION AS score,
          COUNT(tv_episode_ratings.id)::INTEGER AS episode_count,
          MAX(GREATEST(tv_episode_ratings.created_at, tv_episode_ratings.updated_at)) AS rated_at
        FROM tv_episode_ratings
        JOIN tv_episodes ON tv_episodes.id = tv_episode_ratings.tv_episode_id
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
        JOIN tv_shows ON tv_shows.id = tv_seasons.tv_show_id
        WHERE tv_episode_ratings.user_id IN (SELECT id FROM selected_user)
          AND GREATEST(tv_episode_ratings.created_at, tv_episode_ratings.updated_at) >= date_trunc('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        GROUP BY tv_shows.id, tv_shows.tmdb_id, tv_shows.name, tv_shows.poster_path
      ),
      combined_ratings AS (
        SELECT tmdb_id, title, poster_path, 'movie'::TEXT AS media_type, score, 0::INTEGER AS episode_count, rated_at FROM movie_ratings_this_month
        UNION ALL
        SELECT tmdb_id, title, poster_path, 'tv'::TEXT AS media_type, score, episode_count, rated_at FROM tv_ratings_this_month
      )
      SELECT tmdb_id, title, poster_path, media_type, score, episode_count
      FROM combined_ratings
      ORDER BY score DESC, rated_at DESC, title ASC
      LIMIT 4
    `,
    [username]
  )

  return result.rows.map((row) => ({
    ...(Number.isInteger(Number(row.tmdb_id)) ? { id: Number(row.tmdb_id) } : {}),
    title: row.title,
    posterPath: row.poster_path ?? null,
    mediaType: row.media_type === 'tv' ? 'tv' : 'movie',
    score: Number(row.score),
    episodeCount: Number(row.episode_count ?? 0),
  }))
}

export function buildStatsInsights(events = [], { period = 'year', timeZone = 'UTC', now = new Date() } = {}) {
  const normalizedEvents = events.map((event) => ({
    mediaType: event.media_type === 'tv' ? 'tv' : 'movie',
    watchedAt: new Date(event.watched_at),
    runtimeMinutes: Math.max(0, Number(event.runtime_minutes) || 0),
    genreNames: Array.isArray(event.genre_names) ? event.genre_names.filter(Boolean) : [],
  })).filter((event) => !Number.isNaN(event.watchedAt.valueOf()))
  const activityBuckets = createStatsActivityBuckets(period, now)
  const activityByKey = new Map(activityBuckets.map((bucket) => [bucket.key, bucket]))
  const genreMinutes = new Map()
  const weekdayMinutes = Array(7).fill(0)
  const hourMinutes = Array(24).fill(0)
  const timePartsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  let movieEvents = 0
  let tvEpisodeEvents = 0

  normalizedEvents.forEach((event) => {
    if (event.mediaType === 'tv') tvEpisodeEvents += 1
    else movieEvents += 1

    const bucket = activityByKey.get(getStatsActivityBucketKey(event.watchedAt, period, activityBuckets))
    if (bucket) {
      bucket.totalMinutes += event.runtimeMinutes
      if (event.mediaType === 'tv') bucket.tvMinutes += event.runtimeMinutes
      else bucket.movieMinutes += event.runtimeMinutes
    }

    event.genreNames.forEach((genreName) => {
      genreMinutes.set(genreName, (genreMinutes.get(genreName) ?? 0) + event.runtimeMinutes)
    })

    const parts = Object.fromEntries(timePartsFormatter.formatToParts(event.watchedAt).map((part) => [part.type, part.value]))
    const weekdayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday)
    const hour = Number(parts.hour)
    if (weekdayIndex >= 0) weekdayMinutes[weekdayIndex] += event.runtimeMinutes
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) hourMinutes[hour] += event.runtimeMinutes
  })

  const bestWeekdayMinutes = Math.max(...weekdayMinutes)
  const bestWeekdayIndex = bestWeekdayMinutes > 0 ? weekdayMinutes.indexOf(bestWeekdayMinutes) : null
  const peakWindow = getPeakWatchWindow(hourMinutes)

  return {
    activity: {
      buckets: activityBuckets.map(({ key: _key, ...bucket }) => bucket),
    },
    mediaSplit: { movieEvents, tvEpisodeEvents },
    genres: Array.from(genreMinutes, ([name, minutes]) => ({ name, minutes }))
      .sort((left, right) => right.minutes - left.minutes || left.name.localeCompare(right.name))
      .slice(0, 5),
    habits: { weekdayMinutes, bestWeekdayIndex, peakWindow },
  }
}

function createStatsActivityBuckets(period, now) {
  const start = getStatsPeriodStart(period, now)
  const buckets = []

  if (period === 'week') {
    for (let day = 0; day < 7; day += 1) {
      const bucketStart = addUtcDays(start, day)
      buckets.push(createStatsActivityBucket(formatUtcDate(bucketStart), formatUtcLabel(bucketStart, { weekday: 'short' }), bucketStart, addUtcDays(bucketStart, 1)))
    }
    return buckets
  }

  if (period === 'month') {
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
    let bucketStart = start
    while (bucketStart < monthEnd) {
      const daysUntilMonday = (8 - bucketStart.getUTCDay()) % 7 || 7
      const bucketEnd = new Date(Math.min(addUtcDays(bucketStart, daysUntilMonday).valueOf(), monthEnd.valueOf()))
      buckets.push(createStatsActivityBucket(formatUtcDate(bucketStart), formatStatsWeekLabel(bucketStart, bucketEnd), bucketStart, bucketEnd))
      bucketStart = bucketEnd
    }
    return buckets
  }

  for (let month = 0; month < 12; month += 1) {
    const bucketStart = new Date(Date.UTC(start.getUTCFullYear(), month, 1))
    buckets.push(createStatsActivityBucket(formatUtcDate(bucketStart), formatUtcLabel(bucketStart, { month: 'short' }), bucketStart, new Date(Date.UTC(start.getUTCFullYear(), month + 1, 1))))
  }
  return buckets
}

function createStatsActivityBucket(key, label, start, end) {
  return { key, label, start, end, movieMinutes: 0, tvMinutes: 0, totalMinutes: 0 }
}

function getStatsActivityBucketKey(date, _period, buckets) {
  const timestamp = date.valueOf()
  return buckets.find((bucket) => timestamp >= bucket.start.valueOf() && timestamp < bucket.end.valueOf())?.key
}

function getStatsPeriodStart(period, now) {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (period === 'week') return addUtcDays(current, -((current.getUTCDay() + 6) % 7))
  if (period === 'month') return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1))
  return new Date(Date.UTC(current.getUTCFullYear(), 0, 1))
}

function getPeakWatchWindow(hourMinutes) {
  let startHour = 0
  let minutes = 0
  for (let hour = 0; hour < 24; hour += 1) {
    const windowMinutes = hourMinutes[hour] + hourMinutes[(hour + 1) % 24] + hourMinutes[(hour + 2) % 24]
    if (windowMinutes > minutes) {
      startHour = hour
      minutes = windowMinutes
    }
  }
  return minutes > 0 ? { startHour, endHour: (startHour + 3) % 24, minutes } : null
}

function addUtcDays(date, days) {
  return new Date(date.valueOf() + days * 24 * 60 * 60 * 1000)
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10)
}

function formatUtcLabel(date, options) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date)
}

function formatStatsWeekLabel(start, end) {
  const finalDay = addUtcDays(end, -1)
  const month = formatUtcLabel(start, { month: 'short' })
  return `${month} ${start.getUTCDate()}–${finalDay.getUTCDate()}`
}

export async function getTvLibraryForUser(pool, username) {
  const result = await pool.query(
    `
      SELECT
        COALESCE(ARRAY(SELECT tv_shows.tmdb_id FROM watched_tv_shows JOIN tv_shows ON tv_shows.id = watched_tv_shows.tv_show_id WHERE watched_tv_shows.user_id = users.id), '{}') AS watched_ids,
        COALESCE(ARRAY(SELECT tv_shows.tmdb_id FROM tv_watchlist_items JOIN tv_shows ON tv_shows.id = tv_watchlist_items.tv_show_id WHERE tv_watchlist_items.user_id = users.id), '{}') AS watchlist_ids
      FROM users
      WHERE users.username = $1
      LIMIT 1
    `,
    [username]
  )
  const row = result.rows[0] ?? null
  return row ? { status: 'ok', watchedIds: row.watched_ids.map(Number), watchlistIds: row.watchlist_ids.map(Number) } : { status: 'missing_user' }
}

export async function listTvWatchlistShowsForUser(pool, username) {
  const result = await pool.query(
    `
      SELECT
        tv_shows.tmdb_id,
        tv_shows.name,
        tv_shows.first_air_date,
        tv_shows.poster_path,
        tv_shows.backdrop_path,
        tv_shows.vote_average,
        COALESCE(
          ARRAY_REMOVE(ARRAY_AGG(tv_genres.name ORDER BY genre_ids.ordinality), NULL),
          '{}'
        ) AS genre_names,
        tv_watchlist_items.created_at AS watchlisted_at
      FROM tv_watchlist_items
      JOIN users ON users.id = tv_watchlist_items.user_id
      JOIN tv_shows ON tv_shows.id = tv_watchlist_items.tv_show_id
      LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
      LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id = genre_ids.tmdb_genre_id
      WHERE users.username = $1
      GROUP BY tv_shows.id, tv_watchlist_items.created_at
      ORDER BY tv_watchlist_items.created_at DESC, tv_shows.tmdb_id ASC
    `,
    [username]
  )

  return result.rows
}

export async function listContinueWatchingTvShowsForUser(pool, username, options = {}) {
  const { limit = 5, page = 1 } = options
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 5
  const normalizedPage = Number.isInteger(page) ? Math.max(1, page) : 1
  const offset = (normalizedPage - 1) * normalizedLimit
  const result = await pool.query(
    `
      WITH episode_progress AS (
        SELECT
          tv_seasons.tv_show_id,
          COUNT(*)::INTEGER AS aired_episode_count,
          COUNT(watched_tv_episodes.id)::INTEGER AS watched_episode_count,
          MAX(watched_tv_episodes.watched_at) AS last_watched_at
        FROM tv_episodes
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
        LEFT JOIN watched_tv_episodes
          ON watched_tv_episodes.tv_episode_id = tv_episodes.id
          AND watched_tv_episodes.user_id = (SELECT id FROM users WHERE username = $1 LIMIT 1)
        WHERE tv_episodes.air_date IS NULL OR tv_episodes.air_date <= CURRENT_DATE
        GROUP BY tv_seasons.tv_show_id
        HAVING COUNT(watched_tv_episodes.id) > 0
          AND COUNT(watched_tv_episodes.id) < COUNT(*)
      ),
      latest_watched_episodes AS (
        SELECT DISTINCT ON (tv_seasons.tv_show_id)
          tv_seasons.tv_show_id,
          tv_seasons.season_number,
          tv_episodes.episode_number,
          watched_tv_episodes.watched_at
        FROM watched_tv_episodes
        JOIN tv_episodes ON tv_episodes.id = watched_tv_episodes.tv_episode_id
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
        JOIN users ON users.id = watched_tv_episodes.user_id
        WHERE users.username = $1
        ORDER BY tv_seasons.tv_show_id, watched_tv_episodes.watched_at DESC, watched_tv_episodes.id DESC
      )
      SELECT
        tv_shows.tmdb_id,
        tv_shows.name,
        tv_shows.poster_path,
        tv_shows.backdrop_path,
        episode_progress.watched_episode_count,
        episode_progress.aired_episode_count,
        episode_progress.last_watched_at,
        latest_watched_episodes.season_number AS latest_watched_season_number,
        latest_watched_episodes.episode_number AS latest_watched_episode_number
      FROM episode_progress
      JOIN tv_shows ON tv_shows.id = episode_progress.tv_show_id
      JOIN latest_watched_episodes ON latest_watched_episodes.tv_show_id = episode_progress.tv_show_id
      ORDER BY episode_progress.last_watched_at DESC, tv_shows.tmdb_id ASC
      LIMIT $2
      OFFSET $3
    `,
    [username, normalizedLimit, offset]
  )

  return result.rows
}

export async function getTvStatsForUser(pool, username, period = 'month') {
  const result = await pool.query(
    `
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1),
      watched_totals AS (
        SELECT
          COUNT(DISTINCT CASE WHEN watched_tv_shows.id IS NOT NULL THEN watched_tv_shows.tv_show_id END)::INTEGER AS shows_watched,
          COUNT(watched_tv_episodes.id)::INTEGER AS episodes_watched,
          COALESCE(SUM(tv_episodes.runtime_minutes), 0)::INTEGER AS time_watched_minutes
        FROM watched_tv_episodes
        JOIN tv_episodes ON tv_episodes.id = watched_tv_episodes.tv_episode_id
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
        LEFT JOIN watched_tv_shows ON watched_tv_shows.tv_show_id = tv_seasons.tv_show_id AND watched_tv_shows.user_id = watched_tv_episodes.user_id
        WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user)
          AND watched_tv_episodes.watched_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ),
      watchlist_totals AS (
        SELECT COUNT(*)::INTEGER AS watchlist_count
        FROM tv_watchlist_items
        WHERE user_id IN (SELECT id FROM selected_user)
          AND created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      )
      SELECT EXISTS(SELECT 1 FROM selected_user) AS has_user,
        COALESCE((SELECT shows_watched FROM watched_totals), 0) AS shows_watched,
        COALESCE((SELECT episodes_watched FROM watched_totals), 0) AS episodes_watched,
        COALESCE((SELECT time_watched_minutes FROM watched_totals), 0) AS time_watched_minutes,
        COALESCE((SELECT watchlist_count FROM watchlist_totals), 0) AS watchlist_count
    `,
    [username, period]
  )
  const row = result.rows[0] ?? null
  if (!row?.has_user) return { status: 'missing_user' }
  return { status: 'ok', showsWatched: Number(row.shows_watched), episodesWatched: Number(row.episodes_watched), timeWatchedMinutes: Number(row.time_watched_minutes), watchlistCount: Number(row.watchlist_count) }
}

export async function toggleTvLibraryItemForUser(pool, { username, showId, kind }) {
  if (kind !== 'watchlist') return { status: 'unsupported_kind' }
  const table = 'tv_watchlist_items'
  const column = 'tv_show_id'
  const result = await pool.query(
    `
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1),
      selected_show AS (SELECT id FROM tv_shows WHERE tmdb_id = $2 OR id = $2 ORDER BY CASE WHEN tmdb_id = $2 THEN 0 ELSE 1 END LIMIT 1),
      deleted AS (DELETE FROM ${table} WHERE user_id IN (SELECT id FROM selected_user) AND ${column} IN (SELECT id FROM selected_show) RETURNING id),
      inserted AS (
        INSERT INTO ${table} (user_id, ${column}, created_at)
        SELECT selected_user.id, selected_show.id, NOW() FROM selected_user CROSS JOIN selected_show
        WHERE NOT EXISTS (SELECT 1 FROM deleted)
        ON CONFLICT (user_id, ${column}) DO NOTHING
        RETURNING id
      )
      SELECT EXISTS(SELECT 1 FROM selected_user) AS has_user, EXISTS(SELECT 1 FROM selected_show) AS has_show,
        EXISTS(SELECT 1 FROM inserted) AS added, EXISTS(SELECT 1 FROM deleted) AS removed
    `,
    [username, showId]
  )
  const row = result.rows[0] ?? null
  if (!row?.has_user) return { status: 'missing_user' }
  if (!row.has_show) return { status: 'missing_show' }
  return { status: 'ok', added: Boolean(row.added), removed: Boolean(row.removed) }
}

export async function countMovies(pool) {
  const result = await pool.query(`
    SELECT COUNT(*)::INTEGER AS movie_count
    FROM movies
  `)

  return result.rows[0]?.movie_count ?? 0
}

export async function countTvShows(pool) {
  const result = await pool.query(`
    SELECT COUNT(*)::INTEGER AS tv_show_count
    FROM tv_shows
  `)

  return result.rows[0]?.tv_show_count ?? 0
}

export async function countActors(pool) {
  const result = await pool.query(`
    SELECT COUNT(*)::INTEGER AS actor_count
    FROM cast_members
  `)

  return result.rows[0]?.actor_count ?? 0
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
