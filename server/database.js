import pg from 'pg'
import { ACHIEVEMENTS } from './achievements.js'
import { BOOK_ACHIEVEMENTS } from './bookAchievements.js'
import { WATCH_TOGETHER_ACHIEVEMENTS, WATCH_TOGETHER_ACHIEVEMENT_BY_ID } from './watchTogetherAchievements.js'

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

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS alert_timezone TEXT
  `)

  await ensureWatchTogetherTables(pool)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_alerts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('favorite_actor_movie', 'watchlist_movie_release', 'tv_episode_release', 'watch_together_request', 'watch_together_request_accepted', 'watch_together_request_denied')),
      source_key TEXT NOT NULL UNIQUE,
      watch_together_request_id BIGINT REFERENCES watch_together_requests(id) ON DELETE CASCADE,
      movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
      tv_show_id BIGINT REFERENCES tv_shows(id) ON DELETE CASCADE,
      tv_episode_id BIGINT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    )
  `)
  await pool.query(`ALTER TABLE user_alerts ADD COLUMN IF NOT EXISTS watch_together_request_id BIGINT REFERENCES watch_together_requests(id) ON DELETE CASCADE`)
  await pool.query(`ALTER TABLE user_alerts DROP CONSTRAINT IF EXISTS user_alerts_kind_check`)
  await pool.query(`ALTER TABLE user_alerts ADD CONSTRAINT user_alerts_kind_check CHECK (kind IN ('favorite_actor_movie', 'watchlist_movie_release', 'tv_episode_release', 'watch_together_request', 'watch_together_request_accepted', 'watch_together_request_denied'))`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_feature_state (
      id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
      activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query('INSERT INTO alert_feature_state (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING')

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

export async function ensureWatchTogetherTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_together_pairs (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_together_requests (
      id BIGSERIAL PRIMARY KEY,
      requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied', 'invalidated')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      CHECK (requester_id <> recipient_id)
    )
  `)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS watch_together_one_pending_requester_idx ON watch_together_requests (requester_id) WHERE status = 'pending'`)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS watch_together_one_pending_recipient_idx ON watch_together_requests (recipient_id) WHERE status = 'pending'`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_together_pair_members (
      pair_id BIGINT NOT NULL REFERENCES watch_together_pairs(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (pair_id, user_id),
      UNIQUE (user_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_together_items (
      id BIGSERIAL PRIMARY KEY,
      pair_id BIGINT NOT NULL REFERENCES watch_together_pairs(id) ON DELETE CASCADE,
      media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
      media_id INTEGER NOT NULL,
      is_selected BOOLEAN NOT NULL DEFAULT FALSE,
      pick_proposed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      pick_proposed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pair_id, media_type, media_id)
    )
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS watch_together_one_selected_item_idx
    ON watch_together_items (pair_id)
    WHERE is_selected
  `)
  await pool.query(`ALTER TABLE watch_together_items ADD COLUMN IF NOT EXISTS pick_proposed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL`)
  await pool.query(`ALTER TABLE watch_together_items ADD COLUMN IF NOT EXISTS pick_proposed_at TIMESTAMPTZ`)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS watch_together_one_pending_pick_idx ON watch_together_items (pair_id) WHERE pick_proposed_by_user_id IS NOT NULL`)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS watch_together_one_active_pick_idx ON watch_together_items (pair_id) WHERE is_selected OR pick_proposed_by_user_id IS NOT NULL`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_together_sessions (
      id BIGSERIAL PRIMARY KEY,
      pair_id BIGINT NOT NULL REFERENCES watch_together_pairs(id) ON DELETE CASCADE,
      history_key TEXT NOT NULL,
      media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
      media_id INTEGER NOT NULL,
      episode_id BIGINT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      achievement_ids TEXT[] NOT NULL DEFAULT '{}',
      created_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pair_id, history_key)
    )
  `)
  await pool.query(`CREATE TABLE IF NOT EXISTS watch_together_achievement_unlocks (pair_id BIGINT NOT NULL REFERENCES watch_together_pairs(id) ON DELETE CASCADE, achievement_id TEXT NOT NULL, unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (pair_id, achievement_id))`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_together_item_confirmations (
      item_id BIGINT NOT NULL REFERENCES watch_together_items(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (item_id, user_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_together_watched_movies (
      pair_id BIGINT NOT NULL REFERENCES watch_together_pairs(id) ON DELETE CASCADE,
      movie_id BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      watched_together_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (pair_id, movie_id)
    )
  `)
}

export async function ensureBooksTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id BIGSERIAL PRIMARY KEY,
      google_books_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      authors TEXT[] NOT NULL DEFAULT '{}',
      description TEXT,
      isbn_identifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
      categories TEXT[] NOT NULL DEFAULT '{}',
      cover_image_url TEXT,
      publisher TEXT,
      published_date TEXT,
      page_count INTEGER,
      language TEXT,
      raw_payload JSONB NOT NULL,
      import_rank INTEGER NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS books_import_order_idx ON books (import_rank ASC, google_books_id ASC)')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS authors (
      id BIGSERIAL PRIMARY KEY,
      normalized_name TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_authors (
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      author_id BIGINT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      author_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (book_id, author_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS favorite_authors (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_id BIGINT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, author_id)
    )
  `)
  await pool.query(`
    INSERT INTO authors (normalized_name, name)
    SELECT DISTINCT
      LOWER(REGEXP_REPLACE(BTRIM(author_name), '\\s+', ' ', 'g')),
      REGEXP_REPLACE(BTRIM(author_name), '\\s+', ' ', 'g')
    FROM books
    CROSS JOIN LATERAL UNNEST(books.authors) AS author_name
    WHERE BTRIM(author_name) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM authors existing_authors
        WHERE existing_authors.normalized_name = LOWER(REGEXP_REPLACE(BTRIM(author_name), '\\s+', ' ', 'g'))
      )
  `)
  await pool.query(`
    INSERT INTO book_authors (book_id, author_id, author_order)
    SELECT books.id, authors.id, author_entries.ordinality - 1
    FROM books
    CROSS JOIN LATERAL UNNEST(books.authors) WITH ORDINALITY AS author_entries(author_name, ordinality)
    JOIN authors ON authors.normalized_name = LOWER(REGEXP_REPLACE(BTRIM(author_entries.author_name), '\\s+', ' ', 'g'))
    WHERE BTRIM(author_entries.author_name) <> ''
    ON CONFLICT (book_id, author_id) DO UPDATE SET author_order = EXCLUDED.author_order
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_watchlist_items (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, book_id)
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS read_books (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      reading_format TEXT NOT NULL DEFAULT 'physical' CHECK (reading_format IN ('physical', 'ebook', 'audiobook')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, book_id)
    );
    ALTER TABLE read_books ADD COLUMN IF NOT EXISTS reading_format TEXT NOT NULL DEFAULT 'physical' CHECK (reading_format IN ('physical', 'ebook', 'audiobook'));
    UPDATE read_books SET reading_format = 'physical' WHERE reading_format IS NULL
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_ratings (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      score NUMERIC(2, 1) NOT NULL CHECK (score >= 1.0 AND score <= 5.0 AND MOD(score * 2, 1) = 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, book_id)
    )
  `)
  await pool.query(`
    UPDATE books
    SET categories = categories[1:1]
    WHERE cardinality(categories) > 1
  `)
}

export async function upsertBooks(pool, books) {
  if (books.length === 0) return { insertedCount: 0, updatedCount: 0 }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let insertedCount = 0
    let updatedCount = 0
    for (const book of books) {
      const result = await client.query(`
        INSERT INTO books (google_books_id, title, authors, description, isbn_identifiers, categories, cover_image_url, publisher, published_date, page_count, language, raw_payload, import_rank, imported_at)
        VALUES ($1, $2, $3::TEXT[], $4, $5::jsonb, $6::TEXT[], $7, $8, $9, $10, $11, $12::jsonb, $13, NOW())
        ON CONFLICT (google_books_id) DO UPDATE SET
          title = EXCLUDED.title, authors = EXCLUDED.authors, description = EXCLUDED.description,
          isbn_identifiers = EXCLUDED.isbn_identifiers, categories = EXCLUDED.categories,
          cover_image_url = EXCLUDED.cover_image_url, publisher = EXCLUDED.publisher,
          published_date = EXCLUDED.published_date, page_count = EXCLUDED.page_count,
          language = EXCLUDED.language, raw_payload = EXCLUDED.raw_payload,
          import_rank = EXCLUDED.import_rank, imported_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `, [book.googleBooksId, book.title, book.authors, book.description, JSON.stringify(book.isbnIdentifiers), book.categories, book.coverImageUrl, book.publisher, book.publishedDate, book.pageCount, book.language, JSON.stringify(book.rawPayload), book.importRank])
      const storedBookId = await client.query('SELECT id FROM books WHERE google_books_id = $1 LIMIT 1', [book.googleBooksId])
      const bookId = storedBookId.rows[0]?.id
      if (bookId) {
        await client.query('DELETE FROM book_authors WHERE book_id = $1', [bookId])
        const authorNames = Array.isArray(book.authors) ? book.authors : []
        for (const [authorOrder, rawName] of authorNames.entries()) {
          const name = typeof rawName === 'string' ? rawName.replace(/\s+/g, ' ').trim() : ''
          if (!name) continue
          const normalizedName = name.toLowerCase()
          const authorResult = await client.query(`
            WITH existing_author AS (
              SELECT id FROM authors WHERE normalized_name = $1 ORDER BY id ASC LIMIT 1
            ), inserted_author AS (
              INSERT INTO authors (normalized_name, name, updated_at)
              SELECT $1, $2, NOW()
              WHERE NOT EXISTS (SELECT 1 FROM existing_author)
              RETURNING id
            )
            SELECT id FROM inserted_author
            UNION ALL
            SELECT id FROM existing_author
            LIMIT 1
          `, [normalizedName, name])
          await client.query('INSERT INTO book_authors (book_id, author_id, author_order) VALUES ($1, $2, $3)', [bookId, authorResult.rows[0].id, authorOrder])
        }
      }
      if (result.rows[0]?.inserted) insertedCount += 1
      else updatedCount += 1
    }
    await client.query('COMMIT')
    return { insertedCount, updatedCount }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function listBooks(pool, options = {}) {
  const limit = Number.isInteger(options.limit) ? Math.max(1, options.limit) : 30
  const page = Number.isInteger(options.page) ? Math.max(1, options.page) : 1
  const result = await pool.query(`
    SELECT google_books_id, title, authors, description, isbn_identifiers, categories, cover_image_url,
      publisher, published_date, page_count, language, import_rank, imported_at
    FROM books ORDER BY import_rank ASC, google_books_id ASC LIMIT $1 OFFSET $2
  `, [limit, (page - 1) * limit])
  return result.rows
}

export async function searchBooks(pool, query, limit = 30) {
  const normalizedLimit = Number.isInteger(limit) ? Math.max(1, limit) : 30
  const result = await pool.query(
    `
    SELECT google_books_id, title, authors, description, isbn_identifiers, categories, cover_image_url,
      publisher, published_date, page_count, language, import_rank, imported_at
    FROM books
    WHERE POSITION(LOWER($1) IN LOWER(title)) > 0
    ORDER BY import_rank ASC, title ASC, google_books_id ASC
    LIMIT $2
    `,
    [query, normalizedLimit],
  )
  return result.rows
}

export async function getBookByGoogleBooksId(pool, googleBooksId) {
  const result = await pool.query(`
    SELECT google_books_id, title, authors, description, isbn_identifiers, categories, cover_image_url,
      publisher, published_date, page_count, language, import_rank, imported_at
    FROM books WHERE google_books_id = $1 LIMIT 1
  `, [googleBooksId])
  return result.rows[0] ?? null
}

export async function getAuthorById(pool, authorId) {
  const result = await pool.query('SELECT id, name FROM authors WHERE id = $1 LIMIT 1', [authorId])
  return result.rows[0] ?? null
}

export async function listAuthorsForBook(pool, googleBooksId) {
  const result = await pool.query(`
    SELECT authors.id, authors.name
    FROM book_authors
    JOIN books ON books.id = book_authors.book_id
    JOIN authors ON authors.id = book_authors.author_id
    WHERE books.google_books_id = $1
    ORDER BY book_authors.author_order ASC, authors.name ASC
  `, [googleBooksId])
  return result.rows
}

export async function listBooksForAuthor(pool, authorId) {
  const result = await pool.query(`
    SELECT books.google_books_id, books.title, books.authors, books.description, books.isbn_identifiers, books.categories,
      books.cover_image_url, books.publisher, books.published_date, books.page_count, books.language, books.import_rank, books.imported_at
    FROM book_authors
    JOIN books ON books.id = book_authors.book_id
    WHERE book_authors.author_id = $1
    ORDER BY books.import_rank ASC, books.title ASC, books.google_books_id ASC
  `, [authorId])
  return result.rows
}

export async function listFavoriteAuthorsForUser(pool, username) {
  const result = await pool.query(`
    SELECT authors.id, authors.name, favorite_authors.created_at AS favorited_at
    FROM favorite_authors
    JOIN users ON users.id = favorite_authors.user_id
    JOIN authors ON authors.id = favorite_authors.author_id
    WHERE users.username = $1
    ORDER BY favorite_authors.created_at DESC, authors.name ASC
  `, [username])
  return result.rows
}

export async function toggleFavoriteAuthorForUser(pool, { username, authorId }) {
  const result = await pool.query(`
    WITH selected_user AS (
      SELECT id FROM users WHERE username = $1 LIMIT 1
    ),
    selected_author AS (
      SELECT id FROM authors WHERE id = $2 LIMIT 1
    ),
    existing_favorite AS (
      SELECT favorite_authors.id FROM favorite_authors
      JOIN selected_user ON selected_user.id = favorite_authors.user_id
      JOIN selected_author ON selected_author.id = favorite_authors.author_id
    ),
    favorite_total AS (
      SELECT COUNT(*)::INTEGER AS total FROM favorite_authors
      WHERE user_id IN (SELECT id FROM selected_user)
    ),
    removed_favorite AS (
      DELETE FROM favorite_authors WHERE id IN (SELECT id FROM existing_favorite) RETURNING id
    ),
    inserted_favorite AS (
      INSERT INTO favorite_authors (user_id, author_id)
      SELECT selected_user.id, selected_author.id FROM selected_user CROSS JOIN selected_author CROSS JOIN favorite_total
      WHERE NOT EXISTS (SELECT 1 FROM existing_favorite) AND favorite_total.total < 30
      ON CONFLICT (user_id, author_id) DO NOTHING
      RETURNING id
    )
    SELECT
      EXISTS (SELECT 1 FROM selected_user) AS has_user,
      EXISTS (SELECT 1 FROM selected_author) AS has_author,
      (SELECT total FROM favorite_total) AS favorite_total,
      EXISTS (SELECT 1 FROM existing_favorite) AS already_favorited,
      EXISTS (SELECT 1 FROM inserted_favorite) AS favorited
  `, [username, authorId])
  const row = result.rows[0] ?? {}
  if (!row.has_user) return { status: 'missing_user' }
  if (!row.has_author) return { status: 'missing_author' }
  if (!row.already_favorited && Number(row.favorite_total) >= 30) return { status: 'limit_reached', limit: 30 }
  return { status: 'ok', favorited: Boolean(row.favorited) }
}

export async function listWatchlistBooksForUser(pool, username) {
  const result = await pool.query(`
    SELECT books.google_books_id, books.title, books.authors, books.categories, books.cover_image_url,
      books.published_date, book_watchlist_items.created_at AS watchlisted_at
    FROM book_watchlist_items
    JOIN users ON users.id = book_watchlist_items.user_id
    JOIN books ON books.id = book_watchlist_items.book_id
    WHERE users.username = $1
    ORDER BY book_watchlist_items.created_at DESC, books.google_books_id ASC
  `, [username])
  return result.rows
}

export async function addBookToWatchlistForUser(pool, { username, bookId }) {
  const result = await pool.query(`
    WITH selected_user AS (
      SELECT id FROM users WHERE username = $1 LIMIT 1
    ),
    selected_book AS (
      SELECT id FROM books WHERE google_books_id = $2 LIMIT 1
    ),
    watchlist_total AS (
      SELECT COUNT(*)::INTEGER AS total FROM book_watchlist_items
      WHERE user_id IN (SELECT id FROM selected_user)
    ),
    existing_watchlist AS (
      SELECT created_at FROM book_watchlist_items
      WHERE user_id IN (SELECT id FROM selected_user)
        AND book_id IN (SELECT id FROM selected_book)
      LIMIT 1
    ),
    inserted_watchlist AS (
      INSERT INTO book_watchlist_items (user_id, book_id, created_at)
      SELECT selected_user.id, selected_book.id, NOW()
      FROM selected_user CROSS JOIN selected_book CROSS JOIN watchlist_total
      WHERE watchlist_total.total < 30 OR EXISTS (SELECT 1 FROM existing_watchlist)
      ON CONFLICT (user_id, book_id) DO NOTHING
      RETURNING user_id, book_id, created_at
    )
    SELECT
      EXISTS (SELECT 1 FROM selected_user) AS has_user,
      EXISTS (SELECT 1 FROM selected_book) AS has_book,
      (SELECT id FROM selected_book) AS entity_id,
      (SELECT total FROM watchlist_total) AS watchlist_total,
      EXISTS (SELECT 1 FROM existing_watchlist) AS already_saved,
      EXISTS (SELECT 1 FROM inserted_watchlist) AS added
  `, [username, bookId])
  const row = result.rows[0] ?? {}
  if (!row.has_user) return { status: 'missing_user' }
  if (!row.has_book) return { status: 'missing_book' }
  if (!row.already_saved && Number(row.watchlist_total) >= 30) return { status: 'limit_reached', limit: 30 }
  return { status: 'ok', ...(Number.isFinite(Number(row.entity_id)) ? { entityId: Number(row.entity_id) } : {}), added: Boolean(row.added) }
}

export async function removeBookFromWatchlistForUser(pool, { username, bookId }) {
  const result = await pool.query(`
    WITH selected_user AS (
      SELECT id FROM users WHERE username = $1 LIMIT 1
    ),
    selected_book AS (
      SELECT id FROM books WHERE google_books_id = $2 LIMIT 1
    ),
    deleted_watchlist AS (
      DELETE FROM book_watchlist_items
      WHERE user_id IN (SELECT id FROM selected_user)
        AND book_id IN (SELECT id FROM selected_book)
      RETURNING id
    )
    SELECT
      EXISTS (SELECT 1 FROM selected_user) AS has_user,
      EXISTS (SELECT 1 FROM selected_book) AS has_book,
      EXISTS (SELECT 1 FROM deleted_watchlist) AS removed
  `, [username, bookId])
  const row = result.rows[0] ?? {}
  if (!row.has_user) return { status: 'missing_user' }
  if (!row.has_book) return { status: 'missing_book' }
  return { status: 'ok', removed: Boolean(row.removed) }
}

export async function listReadBooksForUser(pool, username) {
  const result = await pool.query(`
    SELECT books.google_books_id, books.title, books.authors, books.categories, books.cover_image_url,
      books.published_date, read_books.reading_format, read_books.completion_metadata, read_books.created_at AS read_at
    FROM read_books
    JOIN users ON users.id = read_books.user_id
    JOIN books ON books.id = read_books.book_id
    WHERE users.username = $1
    ORDER BY read_books.created_at DESC, books.google_books_id ASC
  `, [username])
  return result.rows
}

export async function addBookToReadForUser(pool, { username, bookId, readingFormat, completionMetadata = {} }) {
  const result = await pool.query(`
    WITH selected_user AS (
      SELECT id FROM users WHERE username = $1 LIMIT 1
    ),
    selected_book AS (
      SELECT id FROM books WHERE google_books_id = $2 LIMIT 1
    ),
    deleted_watchlist AS (
      DELETE FROM book_watchlist_items
      WHERE user_id IN (SELECT id FROM selected_user)
        AND book_id IN (SELECT id FROM selected_book)
      RETURNING id
    ),
    inserted_read AS (
      INSERT INTO read_books (user_id, book_id, reading_format, completion_metadata, created_at)
      SELECT selected_user.id, selected_book.id, $3, $4::jsonb, NOW()
      FROM selected_user CROSS JOIN selected_book
      RETURNING id, user_id, book_id, created_at
    )
    SELECT
      EXISTS (SELECT 1 FROM selected_user) AS has_user,
      EXISTS (SELECT 1 FROM selected_book) AS has_book,
      EXISTS (SELECT 1 FROM inserted_read) AS added, (SELECT id FROM inserted_read) AS entity_id,
      EXISTS (SELECT 1 FROM deleted_watchlist) AS removed_from_watchlist,
      (SELECT created_at FROM inserted_read) AS created_at
  `, [username, bookId, readingFormat, JSON.stringify(completionMetadata)])
  const row = result.rows[0] ?? {}
  if (!row.has_user) return { status: 'missing_user' }
  if (!row.has_book) return { status: 'missing_book' }
  return { status: 'ok', added: Boolean(row.added), ...(Number.isFinite(Number(row.entity_id)) ? { entityId: Number(row.entity_id) } : {}), removedFromWatchlist: Boolean(row.removed_from_watchlist), createdAt: row.created_at ?? null }
}

export async function removeBookFromReadForUser(pool, { username, bookId }) {
  const result = await pool.query(`
    WITH selected_user AS (
      SELECT id FROM users WHERE username = $1 LIMIT 1
    ),
    selected_book AS (
      SELECT id FROM books WHERE google_books_id = $2 LIMIT 1
    ),
    deleted_read AS (
      DELETE FROM read_books
      WHERE user_id IN (SELECT id FROM selected_user)
        AND book_id IN (SELECT id FROM selected_book)
      RETURNING id
    )
    SELECT
      EXISTS (SELECT 1 FROM selected_user) AS has_user,
      EXISTS (SELECT 1 FROM selected_book) AS has_book,
      EXISTS (SELECT 1 FROM deleted_read) AS removed
  `, [username, bookId])
  const row = result.rows[0] ?? {}
  if (!row.has_user) return { status: 'missing_user' }
  if (!row.has_book) return { status: 'missing_book' }
  return { status: 'ok', removed: Boolean(row.removed) }
}

export async function getBookCommunityRating(pool, { bookId, username = null }) {
  const result = await pool.query(`
    WITH selected_book AS (
      SELECT id FROM books WHERE google_books_id = $1 LIMIT 1
    ),
    selected_user AS (
      SELECT id FROM users WHERE username = $2 LIMIT 1
    )
    SELECT
      EXISTS (SELECT 1 FROM selected_book) AS has_book,
      AVG(book_ratings.score)::DOUBLE PRECISION AS average,
      COUNT(book_ratings.id)::INTEGER AS vote_count,
      (
        SELECT book_ratings.score::DOUBLE PRECISION
        FROM book_ratings
        WHERE book_ratings.book_id IN (SELECT id FROM selected_book)
          AND book_ratings.user_id IN (SELECT id FROM selected_user)
        LIMIT 1
      ) AS your_score
    FROM selected_book
    LEFT JOIN book_ratings ON book_ratings.book_id = selected_book.id
  `, [bookId, username])
  const row = result.rows[0] ?? null
  if (!row?.has_book) return { status: 'missing_book' }
  return {
    status: 'ok',
    average: row.average === null || row.average === undefined ? null : Number(row.average),
    voteCount: Number(row.vote_count ?? 0),
    yourScore: row.your_score === null || row.your_score === undefined ? null : Number(row.your_score),
  }
}

export async function upsertBookRatingForUser(pool, { username, bookId, score }) {
  const result = await pool.query(`
    WITH selected_user AS (
      SELECT id FROM users WHERE username = $1 LIMIT 1
    ),
    selected_book AS (
      SELECT id FROM books WHERE google_books_id = $2 LIMIT 1
    ),
    saved_rating AS (
      INSERT INTO book_ratings (user_id, book_id, score, created_at, updated_at)
      SELECT selected_user.id, selected_book.id, $3, NOW(), NOW()
      FROM selected_user CROSS JOIN selected_book
      ON CONFLICT (user_id, book_id)
      DO UPDATE SET score = EXCLUDED.score, updated_at = NOW()
      RETURNING score
    )
    SELECT
      EXISTS (SELECT 1 FROM selected_user) AS has_user,
      EXISTS (SELECT 1 FROM selected_book) AS has_book,
      (SELECT id FROM selected_book) AS entity_id,
      (SELECT score::DOUBLE PRECISION FROM saved_rating) AS score
  `, [username, bookId, score])
  const row = result.rows[0] ?? null
  if (!row?.has_user) return { status: 'missing_user' }
  if (!row.has_book) return { status: 'missing_book' }
  return { status: 'ok', ...(Number.isFinite(Number(row.entity_id)) ? { entityId: Number(row.entity_id) } : {}), score: Number(row.score) }
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
  await pool.query(`ALTER TABLE watch_together_items ADD COLUMN IF NOT EXISTS tv_episode_id BIGINT REFERENCES tv_episodes(id) ON DELETE CASCADE`)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watch_together_watched_episodes (
      pair_id BIGINT NOT NULL REFERENCES watch_together_pairs(id) ON DELETE CASCADE,
      tv_episode_id BIGINT NOT NULL REFERENCES tv_episodes(id) ON DELETE CASCADE,
      watched_together_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (pair_id, tv_episode_id)
    )
  `)
}

export async function ensureAchievementTables(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS achievement_tracking (user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS book_achievement_baseline_items (user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, entity_id BIGINT NOT NULL, PRIMARY KEY (user_id, kind, entity_id));
    CREATE TABLE IF NOT EXISTS book_achievement_events (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, event_type TEXT NOT NULL, book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, event_type, book_id));
    CREATE TABLE IF NOT EXISTS user_book_achievement_unlocks (user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, achievement_id TEXT NOT NULL, unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, achievement_id));
    ALTER TABLE read_books ADD COLUMN IF NOT EXISTS completion_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE read_books DROP CONSTRAINT IF EXISTS read_books_user_id_book_id_key;
    CREATE INDEX IF NOT EXISTS read_books_user_book_created_idx ON read_books(user_id, book_id, created_at DESC)`)
  await pool.query(`CREATE TABLE IF NOT EXISTS achievement_baseline_items (user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, entity_id BIGINT NOT NULL, PRIMARY KEY (user_id, kind, entity_id))`)
  await pool.query(`CREATE TABLE IF NOT EXISTS achievement_events (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, event_type TEXT NOT NULL, media_type TEXT NOT NULL, entity_id BIGINT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, event_type, media_type, entity_id))`)
  await pool.query(`CREATE TABLE IF NOT EXISTS user_achievement_unlocks (user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, achievement_id TEXT NOT NULL, unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, achievement_id))`)
  // This is a one-time, idempotent rollout snapshot. Existing records can never become achievement events.
  await pool.query(`INSERT INTO achievement_tracking (user_id) SELECT id FROM users ON CONFLICT DO NOTHING`)
  await pool.query(`INSERT INTO achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'movie_watch',movie_id FROM watched_movies ON CONFLICT DO NOTHING`)
  await pool.query(`INSERT INTO achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'movie_rating',movie_id FROM movie_ratings ON CONFLICT DO NOTHING`)
  await pool.query(`INSERT INTO achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'movie_watchlist',movie_id FROM watchlist_items ON CONFLICT DO NOTHING`)
  await pool.query(`INSERT INTO achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'tv_show',tv_show_id FROM watched_tv_shows ON CONFLICT DO NOTHING`)
  await pool.query(`INSERT INTO achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'tv_episode_rating',tv_episode_id FROM tv_episode_ratings ON CONFLICT DO NOTHING`)
  await pool.query(`INSERT INTO achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'tv_watchlist',tv_show_id FROM tv_watchlist_items ON CONFLICT DO NOTHING`)
  await pool.query(`INSERT INTO achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'tv_episode_watch',tv_episode_id FROM watched_tv_episodes ON CONFLICT DO NOTHING;
    INSERT INTO book_achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'read',id FROM read_books ON CONFLICT DO NOTHING;
    INSERT INTO book_achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'rating',book_id FROM book_ratings ON CONFLICT DO NOTHING;
    INSERT INTO book_achievement_baseline_items (user_id,kind,entity_id) SELECT user_id,'watchlist',book_id FROM book_watchlist_items ON CONFLICT DO NOTHING`)
}

export async function recordBookAchievementEventForUser(pool, { username, eventType, bookId, metadata = {} }) {
  const baselineKind = eventType === 'rated' ? 'rating' : eventType === 'watchlisted' ? 'watchlist' : eventType
  const result = await pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1), eligible AS (
    SELECT id FROM selected_user WHERE NOT EXISTS (SELECT 1 FROM book_achievement_baseline_items b WHERE b.user_id=selected_user.id AND b.kind=$5 AND b.entity_id=$3)
  ), inserted AS (
    INSERT INTO book_achievement_events (user_id,event_type,book_id,metadata)
    SELECT id,$2,$3,$4::jsonb FROM eligible ON CONFLICT (user_id,event_type,book_id) DO UPDATE SET metadata=EXCLUDED.metadata, occurred_at=NOW() RETURNING id
  ) SELECT EXISTS(SELECT 1 FROM inserted) AS inserted`, [username, eventType, bookId, JSON.stringify(metadata), baselineKind])
  return Boolean(result.rows[0]?.inserted)
}

export async function getBookAchievementsForUser(pool, username) {
  const result = await pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1)
    SELECT rb.id, rb.book_id, rb.reading_format, rb.created_at, rb.completion_metadata, b.page_count, b.published_date, b.categories, b.authors,
      EXISTS(SELECT 1 FROM book_achievement_baseline_items base WHERE base.user_id=rb.user_id AND base.kind='read' AND base.entity_id=rb.id) AS baseline,
      EXISTS(SELECT 1 FROM book_watchlist_items wi WHERE wi.user_id=rb.user_id AND wi.book_id=rb.book_id AND wi.created_at <= rb.created_at AND NOT EXISTS(SELECT 1 FROM book_achievement_baseline_items base WHERE base.user_id=wi.user_id AND base.kind='watchlist' AND base.entity_id=wi.book_id)) AS from_tbr
    FROM read_books rb JOIN books b ON b.id=rb.book_id WHERE rb.user_id IN (SELECT id FROM selected_user) ORDER BY rb.created_at ASC, rb.id ASC`, [username])
  const reads = result.rows.filter((row) => !row.baseline)
  const ratings = await pool.query(`SELECT e.metadata FROM book_achievement_events e JOIN users u ON u.id=e.user_id WHERE u.username=$1 AND e.event_type='rated' ORDER BY e.occurred_at ASC`, [username])
  const values = { book_count: reads.length, pages_read: reads.reduce((n, row) => n + Number(row.page_count || 0), 0) }
  const formats = new Set(reads.map((row) => row.reading_format)); values.formats = formats.size
  values['format:audiobook'] = formats.has('audiobook') ? 1 : 0; values['format:ebook'] = formats.has('ebook') ? 1 : 0
  const categories = new Set(reads.flatMap((row) => row.categories || []).filter(Boolean)); values.genres = categories.size
  const decades = new Set(reads.map((row) => String(row.published_date || '').slice(0, 3)).filter(Boolean)); values.decades = decades.size
  const authorCounts = new Map(); reads.flatMap((row) => row.authors || []).forEach((author) => authorCounts.set(author, (authorCounts.get(author) || 0) + 1)); values.author_max = Math.max(0, ...authorCounts.values())
  values.long_book = reads.some((row) => Number(row.page_count) > 500) ? 1 : 0; values.epic_book = reads.some((row) => Number(row.page_count) > 800) ? 1 : 0; values.short_book = reads.some((row) => Number(row.page_count) > 0 && Number(row.page_count) < 150) ? 1 : 0
  values.backlist = reads.some((row) => Number(String(row.published_date || '').slice(0, 4)) <= new Date(row.created_at).getUTCFullYear() - 20) ? 1 : 0
  values.fresh_release = reads.some((row) => String(row.published_date || '').slice(0, 4) === new Date(row.created_at).getUTCFullYear().toString()) ? 1 : 0
  values.seasons = new Set(reads.map((row) => Math.floor(new Date(row.created_at).getUTCMonth() / 3)).filter(Number.isFinite)).size
  values.back_to_back = reads.some((row, index) => index > 0 && new Date(row.created_at) - new Date(reads[index - 1].created_at) <= 7 * 86400000) ? 2 : 0
  const bookCounts = new Map(); reads.forEach((row) => bookCounts.set(String(row.book_id), (bookCounts.get(String(row.book_id)) || 0) + 1)); values.reread = [...bookCounts.values()].some((count) => count > 1) ? 1 : 0
  values.tbr_completed = reads.filter((row) => row.from_tbr).length
  const metas = reads.map((row) => row.completion_metadata || {}); for (const item of metas) for (const [key, value] of Object.entries(item)) if (value === true) values[`flag:${key}`] = (values[`flag:${key}`] || 0) + 1
  values.tropes = new Set(metas.flatMap((item) => Array.isArray(item.tropes) ? item.tropes : [])).size
  const scores = ratings.rows.map((row) => Number(row.metadata?.score)).filter(Number.isFinite); values.five_star_rating = scores.some((score) => score === 5) ? 1 : 0
  let streak = 0; let maxStreak = 0; for (const score of scores) { streak = score === 5 ? streak + 1 : 0; maxStreak = Math.max(maxStreak, streak) }; values.five_star_streak = maxStreak
  const unlocks = await pool.query(`SELECT achievement_id, unlocked_at FROM user_book_achievement_unlocks WHERE user_id=(SELECT id FROM users WHERE username=$1 LIMIT 1)`, [username]); const unlocked = new Map(unlocks.rows.map((row) => [row.achievement_id, row.unlocked_at]))
  return BOOK_ACHIEVEMENTS.map((item) => ({ ...item, progress: { current: Math.min(values[item.rule] || 0, item.target), target: item.target }, unlocked: unlocked.has(item.id), unlockedAt: unlocked.get(item.id) || null }))
}

export async function evaluateBookAchievementsForUser(pool, username) {
  const achievements = await getBookAchievementsForUser(pool, username)
  const newlyUnlocked = achievements.filter((item) => !item.unlocked && item.progress.current >= item.progress.target)
  for (const item of newlyUnlocked) await pool.query(`INSERT INTO user_book_achievement_unlocks (user_id,achievement_id) SELECT id,$2 FROM users WHERE username=$1 ON CONFLICT DO NOTHING`, [username, item.id])
  return newlyUnlocked
}

export async function recordAchievementEventForUser(pool, { username, eventType, mediaType, entityId, baselineKind, metadata = {} }) {
  const result = await pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1), eligible AS (
    SELECT id FROM selected_user WHERE NOT EXISTS (SELECT 1 FROM achievement_baseline_items b WHERE b.user_id=selected_user.id AND b.kind=$5 AND b.entity_id=$4)
  ), inserted AS (
    INSERT INTO achievement_events (user_id,event_type,media_type,entity_id,metadata)
    SELECT id,$2,$3,$4,$6::jsonb FROM eligible ON CONFLICT DO NOTHING RETURNING id
  ) SELECT EXISTS(SELECT 1 FROM inserted) AS inserted`, [username, eventType, mediaType, entityId, baselineKind, JSON.stringify(metadata)])
  return Boolean(result.rows[0]?.inserted)
}

export async function getAchievementsForUser(pool, username) {
  const data = await pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1), events AS (
    SELECT * FROM achievement_events WHERE user_id=(SELECT id FROM selected_user)
  ), movie_events AS (SELECT e.*,m.runtime_minutes,m.release_date,m.original_language,m.genre_ids FROM events e JOIN movies m ON m.id=e.entity_id WHERE e.event_type='movie_watched'),
  show_events AS (SELECT e.*,s.genre_ids FROM events e JOIN tv_shows s ON s.id=e.entity_id WHERE e.event_type='tv_show_completed'),
  values AS (
    SELECT
      (SELECT COUNT(*) FROM movie_events)::int movie_count,
      (SELECT COUNT(*) FROM show_events)::int show_count,
      (SELECT COUNT(*) FROM events WHERE event_type='movie_watchlist_added')::int movie_watchlist_count,
      (SELECT COUNT(*) FROM events WHERE event_type='tv_watchlist_added')::int tv_watchlist_count,
      (SELECT COUNT(*) FROM events watched WHERE watched.event_type='movie_watched' AND EXISTS (SELECT 1 FROM events saved WHERE saved.event_type='movie_watchlist_added' AND saved.entity_id=watched.entity_id AND saved.occurred_at <= watched.occurred_at))::int movie_watchlist_watched,
      (SELECT COUNT(DISTINCT entity_id) FROM events WHERE event_type='movie_rated')::int movie_rating_count,
      (SELECT COUNT(DISTINCT entity_id) FROM events WHERE event_type='tv_rated')::int tv_rating_count,
      (SELECT COALESCE(SUM(runtime_minutes),0) FROM movie_events)::int movie_runtime,
      (SELECT COALESCE(SUM(COALESCE(te.runtime_minutes,0)),0) FROM events e JOIN tv_episodes te ON te.id=e.entity_id WHERE e.event_type='tv_episode_watched')::int tv_runtime
  ) SELECT * FROM values`, [username])
  const metrics = data.rows[0] ?? {}
  const details = await pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1), events AS (SELECT * FROM achievement_events WHERE user_id=(SELECT id FROM selected_user)), movie_events AS (SELECT e.*,m.runtime_minutes,m.release_date,m.original_language,m.genre_ids FROM events e JOIN movies m ON m.id=e.entity_id WHERE e.event_type='movie_watched') SELECT
    COALESCE((SELECT json_agg(name) FROM (SELECT DISTINCT g.name FROM movie_events me JOIN LATERAL unnest(me.genre_ids) gid ON true JOIN genres g ON g.tmdb_genre_id=gid) x),'[]'::json) genres,
    COALESCE((SELECT json_agg(json_build_object('name',x.name,'count',x.count)) FROM (SELECT g.name,COUNT(DISTINCT me.entity_id)::int count FROM movie_events me JOIN LATERAL unnest(me.genre_ids) gid ON true JOIN genres g ON g.tmdb_genre_id=gid GROUP BY g.name) x),'[]'::json) genre_counts,
    COALESCE((SELECT json_agg(score) FROM (SELECT DISTINCT (metadata->>'score')::numeric score FROM events WHERE event_type='movie_rated') x),'[]'::json) rating_scores,
    COALESCE((SELECT COUNT(*)::int FROM events WHERE event_type='movie_rated' AND (metadata->>'score')::numeric=1),0) low_ratings,
    COALESCE((SELECT COUNT(*)::int FROM events WHERE event_type='movie_rated' AND (metadata->>'score')::numeric=5),0) high_ratings,
    COALESCE((SELECT COUNT(DISTINCT EXTRACT(YEAR FROM release_date)::int / 10) FROM movie_events WHERE release_date IS NOT NULL),0) decade_diversity,
    COALESCE((SELECT COUNT(*)::int FROM movie_events WHERE original_language IS NOT NULL AND original_language <> 'en'),0) foreign_language,
    COALESCE((SELECT COUNT(*)::int FROM movie_events WHERE release_date < '1970-01-01'),0) classic_movies,
    COALESCE((SELECT COUNT(*)::int FROM movie_events WHERE runtime_minutes < 80),0) short_movie,
    COALESCE((SELECT COUNT(*)::int FROM movie_events WHERE runtime_minutes > 180),0) long_movie,
    COALESCE((SELECT MAX(count)::int FROM (SELECT COUNT(*)::int count FROM movie_events GROUP BY occurred_at::date) x),0) daily_movies,
    COALESCE((SELECT MAX(minutes)::int FROM (SELECT SUM(COALESCE(runtime_minutes,0))::int minutes FROM movie_events GROUP BY occurred_at::date) x),0) daily_runtime,
    COALESCE((SELECT MAX(count)::int FROM (SELECT COUNT(*)::int count FROM movie_events WHERE EXTRACT(ISODOW FROM occurred_at) IN (6,7) GROUP BY date_trunc('week',occurred_at)) x),0) weekend_movies`, [username])
  const extra = details.rows[0] ?? {}
  const genreCounts = new Map((extra.genre_counts ?? []).map((row) => [row.name, Number(row.count)]))
  const movieDates = await pool.query(`SELECT occurred_at::date AS day FROM achievement_events WHERE user_id=(SELECT id FROM users WHERE username=$1) AND event_type='movie_watched' ORDER BY day`, [username])
  const days = [...new Set(movieDates.rows.map((row) => String(row.day)))].sort()
  let streak = 0; let bestStreak = 0; let previous = null
  for (const day of days) { const current = new Date(`${day}T00:00:00Z`); streak = previous && current - previous === 86400000 ? streak + 1 : 1; bestStreak = Math.max(bestStreak, streak); previous = current }
  const progressFor = (achievement) => {
    if (achievement.availability !== 'active') return { current: 0, complete: false }
    const { rule } = achievement
    let current = 0
    if (rule.startsWith('genre:')) current = genreCounts.get(rule.slice(6)) ?? 0
    else if (rule === 'genre_diversity') current = (extra.genres ?? []).length
    else if (rule === 'movie_streak') current = bestStreak
    else current = Number(metrics[rule] ?? extra[rule] ?? 0)
    if (rule === 'rating_scale') current = (extra.rating_scores ?? []).length
    return { current, complete: current >= achievement.target }
  }
  const unlocked = await pool.query(`SELECT achievement_id,unlocked_at FROM user_achievement_unlocks WHERE user_id=(SELECT id FROM users WHERE username=$1)`, [username])
  const unlockMap = new Map(unlocked.rows.map((row) => [row.achievement_id, row.unlocked_at]))
  return ACHIEVEMENTS.map((achievement) => {
    const progress = progressFor(achievement); const unlockedAt = unlockMap.get(achievement.id) ?? null
    return { ...achievement, progress: { ...progress, target: achievement.target }, unlocked: Boolean(unlockedAt), unlockedAt }
  })
}

export async function evaluateAchievementsForUser(pool, username) {
  const achievements = await getAchievementsForUser(pool, username)
  const newOnes = achievements.filter((item) => item.availability === 'active' && item.progress.complete && !item.unlocked)
  if (!newOnes.length) return []
  const result = await pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1), inserted AS (INSERT INTO user_achievement_unlocks (user_id,achievement_id) SELECT (SELECT id FROM selected_user), unnest($2::text[]) ON CONFLICT DO NOTHING RETURNING achievement_id,unlocked_at) SELECT achievement_id,unlocked_at FROM inserted`, [username, newOnes.map((item) => item.id)])
  const dates = new Map(result.rows.map((row) => [row.achievement_id, row.unlocked_at]))
  return newOnes.filter((item) => dates.has(item.id)).map((item) => ({ ...item, unlocked: true, unlockedAt: dates.get(item.id) }))
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
      insertedMovieIds: [],
    }
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    let insertedCount = 0
    let updatedCount = 0
    const insertedMovieIds = []

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
        insertedMovieIds.push(result.rows[0].id)
      } else {
        updatedCount += 1
      }
    }

    await client.query('COMMIT')

    return {
      insertedCount,
      updatedCount,
      insertedMovieIds,
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

export async function listWatchTogetherUsers(pool, username) {
  const result = await pool.query(
    `
      SELECT users.username, users.full_name
      FROM users
      WHERE users.username <> $1
        AND NOT EXISTS (SELECT 1 FROM watch_together_pair_members members WHERE members.user_id = users.id)
      ORDER BY LOWER(users.full_name), users.username
    `,
    [username]
  )
  return result.rows
}

export async function listWatchTogetherWatchedMovieIdsForUser(pool, { username, movieIds }) {
  const ids = Array.isArray(movieIds) ? movieIds.filter(Number.isInteger) : []
  if (!ids.length) return new Set()
  const result = await pool.query(
    `
      WITH pair AS (
        SELECT mine.pair_id
        FROM watch_together_pair_members mine
        JOIN users ON users.id = mine.user_id
        WHERE users.username = $1
      )
      SELECT DISTINCT movies.tmdb_id
      FROM watched_movies
      JOIN movies ON movies.id = watched_movies.movie_id
      WHERE watched_movies.user_id IN (
        SELECT user_id FROM watch_together_pair_members WHERE pair_id IN (SELECT pair_id FROM pair)
      )
        AND movies.tmdb_id = ANY($2::integer[])
    `,
    [username, ids]
  )
  return new Set(result.rows.map((row) => Number(row.tmdb_id)))
}

export async function getWatchTogetherStateForUser(pool, username) {
  const pairResult = await pool.query(
    `
      SELECT pairs.id AS pair_id, mine.user_id AS current_user_id, other.user_id AS partner_user_id, partner.username AS partner_username, partner.full_name AS partner_full_name
      FROM watch_together_pair_members mine
      JOIN watch_together_pairs pairs ON pairs.id = mine.pair_id
      JOIN watch_together_pair_members other ON other.pair_id = pairs.id AND other.user_id <> mine.user_id
      JOIN users me ON me.id = mine.user_id
      JOIN users partner ON partner.id = other.user_id
      WHERE me.username = $1
      LIMIT 1
    `,
    [username]
  )
  const pair = pairResult.rows[0]
  if (!pair) {
    const pendingResult = await pool.query(
      `
        SELECT requests.id, requests.requester_id, requests.recipient_id, requester.username AS requester_username, requester.full_name AS requester_full_name,
          recipient.username AS recipient_username, recipient.full_name AS recipient_full_name
        FROM watch_together_requests requests
        JOIN users me ON me.username = $1
        JOIN users requester ON requester.id = requests.requester_id
        JOIN users recipient ON recipient.id = requests.recipient_id
        WHERE requests.status = 'pending' AND (requests.requester_id = me.id OR requests.recipient_id = me.id)
        LIMIT 1
      `,
      [username]
    )
    const pending = pendingResult.rows[0]
    return {
      partner: null,
      pendingRequest: pending ? {
        id: Number(pending.id),
        direction: Number(pending.requester_id) === Number(pending.recipient_id) ? 'outgoing' : (pending.requester_username === username ? 'outgoing' : 'incoming'),
        user: pending.requester_username === username
          ? { username: pending.recipient_username, full_name: pending.recipient_full_name }
          : { username: pending.requester_username, full_name: pending.requester_full_name },
      } : null,
      items: [], watchedMovies: [], watchedEpisodes: [], inProgressShows: [],
    }
  }

  const itemsResult = await pool.query(
    `
      SELECT items.media_type, items.media_id, items.tv_episode_id, items.is_selected, items.pick_proposed_by_user_id, items.pick_proposed_at, items.created_at,
        CASE WHEN items.pick_proposed_by_user_id IS NULL THEN NULL WHEN items.pick_proposed_by_user_id = $2 THEN 'proposed_by_current_user' ELSE 'awaiting_current_user' END AS pick_vote_status,
        EXISTS(SELECT 1 FROM watch_together_item_confirmations confirmations WHERE confirmations.item_id = items.id AND confirmations.user_id = $2) AS confirmed_by_current_user,
        EXISTS(SELECT 1 FROM watch_together_item_confirmations confirmations WHERE confirmations.item_id = items.id AND confirmations.user_id = $3) AS confirmed_by_partner,
        movies.title, movies.release_date AS release_date, movies.poster_path, movies.backdrop_path, movies.vote_average,
        NULL::TEXT AS show_name, NULL::DATE AS first_air_date, NULL::TEXT AS show_poster_path, NULL::TEXT AS show_backdrop_path, NULL::DOUBLE PRECISION AS show_vote_average,
        NULL::INTEGER AS season_number, NULL::INTEGER AS episode_number, NULL::TEXT AS episode_name
      FROM watch_together_items items
      JOIN movies ON items.media_type = 'movie' AND movies.tmdb_id = items.media_id
      WHERE items.pair_id = $1
      UNION ALL
      SELECT items.media_type, items.media_id, items.tv_episode_id, items.is_selected, items.pick_proposed_by_user_id, items.pick_proposed_at, items.created_at,
        CASE WHEN items.pick_proposed_by_user_id IS NULL THEN NULL WHEN items.pick_proposed_by_user_id = $2 THEN 'proposed_by_current_user' ELSE 'awaiting_current_user' END AS pick_vote_status,
        EXISTS(SELECT 1 FROM watch_together_item_confirmations confirmations WHERE confirmations.item_id = items.id AND confirmations.user_id = $2) AS confirmed_by_current_user,
        EXISTS(SELECT 1 FROM watch_together_item_confirmations confirmations WHERE confirmations.item_id = items.id AND confirmations.user_id = $3) AS confirmed_by_partner,
        NULL::TEXT AS title, NULL::DATE AS release_date, NULL::TEXT AS poster_path, NULL::TEXT AS backdrop_path, NULL::DOUBLE PRECISION AS vote_average,
        tv_shows.name AS show_name, tv_shows.first_air_date, tv_shows.poster_path AS show_poster_path, tv_shows.backdrop_path AS show_backdrop_path, tv_shows.vote_average AS show_vote_average,
        tv_seasons.season_number, tv_episodes.episode_number, tv_episodes.name AS episode_name
      FROM watch_together_items items
      JOIN tv_shows ON items.media_type = 'tv' AND tv_shows.tmdb_id = items.media_id
      LEFT JOIN tv_episodes ON tv_episodes.id = items.tv_episode_id
      LEFT JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
      WHERE items.pair_id = $1
      ORDER BY is_selected DESC, pick_proposed_at DESC NULLS LAST, created_at DESC, media_type ASC, media_id ASC
    `,
    [pair.pair_id, pair.current_user_id, pair.partner_user_id]
  )
  const watchedResult = await pool.query(
    `
      SELECT movies.tmdb_id, movies.title, movies.release_date, movies.poster_path, movies.backdrop_path, movies.vote_average, watched.watched_together_at,
        session.details AS session_details, session.achievement_ids AS session_achievement_ids
      FROM watch_together_watched_movies watched
      JOIN movies ON movies.id = watched.movie_id
      LEFT JOIN watch_together_sessions session ON session.pair_id=watched.pair_id AND session.history_key=('movie:' || movies.tmdb_id::text)
      WHERE watched.pair_id = $1
      ORDER BY watched.watched_together_at DESC, movies.tmdb_id ASC
    `,
    [pair.pair_id]
  )
  const watchedEpisodesResult = await pool.query(
    `SELECT tv_shows.tmdb_id AS show_id, tv_shows.name AS show_name, tv_shows.poster_path AS show_poster_path,
      tv_episodes.tmdb_id AS episode_id, tv_episodes.name AS episode_name, tv_seasons.season_number, tv_episodes.episode_number, watched.watched_together_at,
      session.details AS session_details, session.achievement_ids AS session_achievement_ids
     FROM watch_together_watched_episodes watched
     JOIN tv_episodes ON tv_episodes.id = watched.tv_episode_id
     JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
     JOIN tv_shows ON tv_shows.id = tv_seasons.tv_show_id
     LEFT JOIN watch_together_sessions session ON session.pair_id=watched.pair_id AND session.history_key=('tv:' || tv_episodes.id::text)
     WHERE watched.pair_id = $1
     ORDER BY watched.watched_together_at DESC, tv_episodes.id ASC`,
    [pair.pair_id]
  )
  const inProgressShowsResult = await pool.query(
    `SELECT DISTINCT ON (tv_shows.id)
       tv_shows.tmdb_id AS show_id, tv_shows.name AS show_name, tv_shows.poster_path AS show_poster_path,
       COUNT(*) OVER (PARTITION BY tv_shows.id)::INTEGER AS watched_episode_count,
       tv_episodes.name AS latest_episode_name, tv_seasons.season_number AS latest_season_number,
       tv_episodes.episode_number AS latest_episode_number, watched.watched_together_at AS last_watched_together_at
     FROM watch_together_watched_episodes watched
     JOIN tv_episodes ON tv_episodes.id = watched.tv_episode_id
     JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
     JOIN tv_shows ON tv_shows.id = tv_seasons.tv_show_id
     WHERE watched.pair_id = $1
     ORDER BY tv_shows.id, watched.watched_together_at DESC, tv_episodes.id DESC`,
    [pair.pair_id]
  )
  return { partner: { username: pair.partner_username, full_name: pair.partner_full_name }, pendingRequest: null, items: itemsResult.rows, watchedMovies: watchedResult.rows, watchedEpisodes: watchedEpisodesResult.rows, inProgressShows: inProgressShowsResult.rows }
}

export async function getWatchTogetherStatsForUser(pool, username, { timeZone = 'UTC' } = {}) {
  const pair = await getWatchTogetherPairForUser(pool, username)
  if (!pair) return { status: 'no_pair' }

  const [moviesResult, episodesResult, movieRatingsResult, episodeRatingsResult, movieActorsResult, showActorsResult] = await Promise.all([
    pool.query(`SELECT movies.tmdb_id AS id, movies.title, movies.poster_path, watched.watched_together_at AS watched_at, COALESCE(movies.runtime_minutes, 0)::INTEGER AS runtime_minutes, MAX(watched_movies.watch_service) AS watch_service,
      COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT genres.name), NULL), '{}') AS genre_names
      FROM watch_together_watched_movies watched JOIN movies ON movies.id=watched.movie_id
      LEFT JOIN watched_movies ON watched_movies.movie_id=movies.id AND watched_movies.user_id IN ($2,$3)
      LEFT JOIN LATERAL UNNEST(movies.genre_ids) selected_genre(tmdb_genre_id) ON TRUE LEFT JOIN genres ON genres.tmdb_genre_id=selected_genre.tmdb_genre_id
      WHERE watched.pair_id=$1 GROUP BY movies.id,movies.tmdb_id,movies.title,movies.poster_path,watched.watched_together_at`, [pair.pair_id, pair.user_id, pair.partner_user_id]),
    pool.query(`SELECT tv_shows.tmdb_id AS id, tv_shows.name AS title, tv_shows.poster_path, tv_episodes.id AS episode_id, tv_episodes.name AS episode_title, tv_seasons.season_number, tv_episodes.episode_number, watched.watched_together_at AS watched_at, COALESCE(tv_episodes.runtime_minutes,0)::INTEGER AS runtime_minutes, MAX(watched_tv_episodes.watch_service) AS watch_service,
      COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT tv_genres.name), NULL), '{}') AS genre_names
      FROM watch_together_watched_episodes watched JOIN tv_episodes ON tv_episodes.id=watched.tv_episode_id JOIN tv_seasons ON tv_seasons.id=tv_episodes.tv_season_id JOIN tv_shows ON tv_shows.id=tv_seasons.tv_show_id
      LEFT JOIN watched_tv_episodes ON watched_tv_episodes.tv_episode_id=tv_episodes.id AND watched_tv_episodes.user_id IN ($2,$3)
      LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) selected_genre(tmdb_genre_id) ON TRUE LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id=selected_genre.tmdb_genre_id
      WHERE watched.pair_id=$1 AND tv_seasons.season_number > 0 GROUP BY tv_shows.id,tv_shows.tmdb_id,tv_shows.name,tv_shows.poster_path,tv_episodes.id,tv_episodes.name,tv_seasons.season_number,tv_episodes.episode_number,watched.watched_together_at`, [pair.pair_id, pair.user_id, pair.partner_user_id]),
    pool.query(`SELECT movies.tmdb_id AS id, AVG(movie_ratings.score)::DOUBLE PRECISION AS score FROM watch_together_watched_movies watched JOIN movies ON movies.id=watched.movie_id JOIN movie_ratings ON movie_ratings.movie_id=movies.id AND movie_ratings.user_id IN ($2,$3) WHERE watched.pair_id=$1 GROUP BY movies.tmdb_id`, [pair.pair_id, pair.user_id, pair.partner_user_id]),
    pool.query(`SELECT watched.tv_episode_id AS episode_id, AVG(tv_episode_ratings.score)::DOUBLE PRECISION AS score FROM watch_together_watched_episodes watched JOIN tv_episode_ratings ON tv_episode_ratings.tv_episode_id=watched.tv_episode_id AND tv_episode_ratings.user_id IN ($2,$3) WHERE watched.pair_id=$1 GROUP BY watched.tv_episode_id`, [pair.pair_id, pair.user_id, pair.partner_user_id]),
    pool.query(`SELECT cast_members.tmdb_person_id::TEXT AS person_id, cast_members.name, MAX(cast_members.profile_path) AS profile_path, COUNT(DISTINCT movies.id)::INTEGER AS title_count FROM watch_together_watched_movies watched JOIN movies ON movies.id=watched.movie_id JOIN movie_cast ON movie_cast.movie_id=movies.id AND movie_cast.credit_type='actor' JOIN cast_members ON cast_members.id=movie_cast.cast_member_id WHERE watched.pair_id=$1 GROUP BY cast_members.tmdb_person_id,cast_members.name ORDER BY title_count DESC,cast_members.name ASC LIMIT 4`, [pair.pair_id]),
    pool.query(`SELECT tv_show_credits.tmdb_person_id::TEXT AS person_id, tv_show_credits.name, MAX(tv_show_credits.profile_path) AS profile_path, COUNT(DISTINCT tv_seasons.tv_show_id)::INTEGER AS title_count FROM watch_together_watched_episodes watched JOIN tv_episodes ON tv_episodes.id=watched.tv_episode_id JOIN tv_seasons ON tv_seasons.id=tv_episodes.tv_season_id JOIN tv_show_credits ON tv_show_credits.tv_show_id=tv_seasons.tv_show_id AND tv_show_credits.credit_type='actor' WHERE watched.pair_id=$1 GROUP BY tv_show_credits.tmdb_person_id,tv_show_credits.name ORDER BY title_count DESC,tv_show_credits.name ASC LIMIT 4`, [pair.pair_id]),
  ])
  const movieScores = new Map(movieRatingsResult.rows.map((row) => [Number(row.id), Number(row.score)]))
  const episodeScores = new Map(episodeRatingsResult.rows.map((row) => [Number(row.episode_id), Number(row.score)]))
  const movies = moviesResult.rows.map((row) => ({ ...row, media_type: 'movie', score: movieScores.get(Number(row.id)) ?? null }))
  const shows = episodesResult.rows.map((row) => ({ ...row, media_type: 'tv', score: episodeScores.get(Number(row.episode_id)) ?? null }))
  return { status: 'ok', movies: buildWatchTogetherStats(movies, { timeZone, kind: 'movies', actors: movieActorsResult.rows }), shows: buildWatchTogetherStats(shows, { timeZone, kind: 'shows', actors: showActorsResult.rows }) }
}

export function buildWatchTogetherStats(rows = [], { timeZone = 'UTC', kind = 'movies', actors = [] } = {}) {
  const events = rows.map((row) => ({ ...row, media_type: row.media_type || (kind === 'shows' ? 'tv' : 'movie'), watched_at: new Date(row.watched_at), runtime_minutes: Math.max(0, Number(row.runtime_minutes) || 0), genre_names: Array.isArray(row.genre_names) ? row.genre_names.filter(Boolean) : [] })).filter((row) => !Number.isNaN(row.watched_at.valueOf()))
  const months = createAllTimeActivityBuckets(events)
  const monthByKey = new Map(months.map((month) => [month.key, month]))
  const genres = new Map(); const weekdays = Array(7).fill(0); const hours = Array(24).fill(0); const services = new Map()
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', hourCycle: 'h23' })
  for (const event of events) {
    const minutes = event.runtime_minutes; const key = event.watched_at.toISOString().slice(0, 7); const month = monthByKey.get(key)
    if (month) month.totalMinutes += minutes
    event.genre_names.forEach((name) => genres.set(name, (genres.get(name) ?? 0) + minutes))
    if (event.watch_service) services.set(event.watch_service, (services.get(event.watch_service) ?? 0) + minutes)
    const parts = Object.fromEntries(formatter.formatToParts(event.watched_at).map((part) => [part.type, part.value])); const weekday = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(parts.weekday); const hour = Number(parts.hour)
    if (weekday >= 0) weekdays[weekday] += minutes; if (hour >= 0 && hour < 24) hours[hour] += minutes
  }
  const scores = events.map((event) => event.score).filter(Number.isFinite)
  const topRated = events.filter((event) => Number.isFinite(event.score)).sort((a,b) => b.score-a.score || b.watched_at-a.watched_at).slice(0,4)
  const recentHistory = [...events].sort((a,b) => b.watched_at-a.watched_at).slice(0,5)
  const totalServiceMinutes = [...services.values()].reduce((sum, minutes) => sum + minutes, 0)
  const distinctShows = new Set(events.map((event) => event.id)).size
  const genreEntries = [...genres].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,5).map(([name, minutes]) => ({ name, minutes }))
  const ratings = scores.map((score) => ({ score }))
  const reviewEvents = events.map((event) => ({ media_type: event.media_type, title_key: kind === 'shows' ? event.id : event.id, watched_at: event.watched_at, runtime_minutes: event.runtime_minutes, genre_names: event.genre_names }))
  return {
    metrics: { titlesWatched: kind === 'movies' ? events.length : distinctShows, episodesWatched: kind === 'shows' ? events.length : 0, timeWatchedMinutes: events.reduce((sum,event) => sum + event.runtime_minutes,0), averageRating: scores.length ? scores.reduce((sum,score) => sum + score,0) / scores.length : null },
    activity: { buckets: months.map(({ key: _key, ...month }) => month) }, genres: genreEntries,
    habits: { weekdayMinutes: weekdays, bestWeekdayIndex: Math.max(...weekdays) > 0 ? weekdays.indexOf(Math.max(...weekdays)) : null, peakWindow: getPeakWatchWindow(hours) },
    topRated: topRated.map(mapWatchTogetherStatEvent), streamingPlatforms: [...services].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,5).map(([name,minutes]) => ({ name, minutes, percent: totalServiceMinutes ? Math.round(minutes / totalServiceMinutes * 100) : 0 })), recentHistory: recentHistory.map(mapWatchTogetherStatEvent),
    yearInReview: buildYearInReview(reviewEvents, ratings), actors: actors.map((actor) => ({ personId: String(actor.person_id), name: actor.name, profilePath: actor.profile_path ?? null, titleCount: Number(actor.title_count) })),
  }
}

function createAllTimeActivityBuckets(events) {
  if (!events.length) return []
  const first = new Date(Math.min(...events.map((event) => event.watched_at.valueOf()))); const now = new Date(); const buckets = []
  let cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)); const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  while (cursor <= end) { buckets.push({ key: cursor.toISOString().slice(0,7), label: new Intl.DateTimeFormat('en-US',{month:'short',year:'2-digit',timeZone:'UTC'}).format(cursor), totalMinutes: 0 }); cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth()+1, 1)) }
  return buckets
}

function mapWatchTogetherStatEvent(event) { return { id: Number(event.id), title: event.title, posterPath: event.poster_path ?? null, mediaType: event.media_type, episodeId: event.episode_id ? Number(event.episode_id) : null, episodeTitle: event.episode_title ?? null, seasonNumber: event.season_number === undefined ? null : Number(event.season_number), episodeNumber: event.episode_number === undefined ? null : Number(event.episode_number), watchedAt: event.watched_at, score: event.score } }

async function getWatchTogetherPairForUser(pool, username) {
  const result = await pool.query(`SELECT mine.pair_id, mine.user_id, other.user_id AS partner_user_id FROM watch_together_pair_members mine JOIN users ON users.id=mine.user_id JOIN watch_together_pair_members other ON other.pair_id=mine.pair_id AND other.user_id<>mine.user_id WHERE users.username=$1 LIMIT 1`, [username])
  return result.rows[0] || null
}

export async function getWatchTogetherAchievementsForUser(pool, username) {
  const pair = await getWatchTogetherPairForUser(pool, username)
  if (!pair) return []
  const [sessions, movieCount, episodeCount, unlocks] = await Promise.all([
    pool.query(`SELECT achievement_ids FROM watch_together_sessions WHERE pair_id=$1`, [pair.pair_id]),
    pool.query(`SELECT COUNT(*)::INTEGER AS count FROM watch_together_watched_movies WHERE pair_id=$1`, [pair.pair_id]),
    pool.query(`SELECT COUNT(*)::INTEGER AS count FROM watch_together_watched_episodes WHERE pair_id=$1`, [pair.pair_id]),
    pool.query(`SELECT achievement_id, unlocked_at FROM watch_together_achievement_unlocks WHERE pair_id=$1`, [pair.pair_id]),
  ])
  const counts = new Map()
  for (const row of sessions.rows) for (const id of row.achievement_ids || []) counts.set(id, (counts.get(id) || 0) + 1)
  // The core milestones progress automatically as shared history grows.
  const auto = { 'watch-together-better-together': Number(movieCount.rows[0]?.count || 0), 'watch-together-pilot-partners': Number(episodeCount.rows[0]?.count || 0), 'watch-together-movie-night-regulars': Number(movieCount.rows[0]?.count || 0), 'watch-together-perfect-pairing': Number(movieCount.rows[0]?.count || 0), 'watch-together-cinema-companions': Number(movieCount.rows[0]?.count || 0), 'watch-together-dynamic-duo': Number(movieCount.rows[0]?.count || 0), 'watch-together-reel-soulmates': Number(movieCount.rows[0]?.count || 0), 'watch-together-long-term-relationship': Number(episodeCount.rows[0]?.count || 0), 'watch-together-episode-experts': Number(episodeCount.rows[0]?.count || 0), 'watch-together-binge-legends': Number(episodeCount.rows[0]?.count || 0) }
  const unlocked = new Map(unlocks.rows.map((row) => [row.achievement_id, row.unlocked_at]))
  return WATCH_TOGETHER_ACHIEVEMENTS.map((achievement) => {
    const current = Math.max(counts.get(achievement.id) || 0, auto[achievement.id] || 0)
    return { ...achievement, progress: { current: Math.min(current, achievement.target), target: achievement.target, complete: current >= achievement.target }, unlocked: unlocked.has(achievement.id), unlockedAt: unlocked.get(achievement.id) || null }
  })
}

export async function evaluateWatchTogetherAchievementsForUser(pool, username) {
  const pair = await getWatchTogetherPairForUser(pool, username)
  if (!pair) return []
  const achievements = await getWatchTogetherAchievementsForUser(pool, username)
  const newly = achievements.filter((item) => item.progress.complete && !item.unlocked)
  if (!newly.length) return []
  const result = await pool.query(`INSERT INTO watch_together_achievement_unlocks (pair_id,achievement_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING RETURNING achievement_id,unlocked_at`, [pair.pair_id, newly.map((item) => item.id)])
  const dates = new Map(result.rows.map((row) => [row.achievement_id, row.unlocked_at]))
  return newly.filter((item) => dates.has(item.id)).map((item) => ({ ...item, unlocked: true, unlockedAt: dates.get(item.id) }))
}

export async function saveWatchTogetherSessionForUser(pool, { username, mediaType, mediaId, episodeId = null, achievementIds = [], details = {} }) {
  const pair = await getWatchTogetherPairForUser(pool, username)
  if (!pair) return { status: 'no_pair' }
  const validIds = [...new Set(achievementIds)].filter((id) => WATCH_TOGETHER_ACHIEVEMENT_BY_ID.has(id))
  const history = mediaType === 'movie'
    ? await pool.query(`SELECT 1 FROM watch_together_watched_movies w JOIN movies m ON m.id=w.movie_id WHERE w.pair_id=$1 AND m.tmdb_id=$2`, [pair.pair_id, mediaId])
    : await pool.query(`SELECT e.id AS episode_id FROM watch_together_watched_episodes w JOIN tv_episodes e ON e.id=w.tv_episode_id WHERE w.pair_id=$1 AND e.tmdb_id=$2`, [pair.pair_id, episodeId])
  if (!history.rows[0]) return { status: 'missing_history' }
  const historyKey = mediaType === 'tv' ? `tv:${history.rows[0].episode_id}` : `movie:${mediaId}`
  await pool.query(`INSERT INTO watch_together_sessions (pair_id,history_key,media_type,media_id,episode_id,details,achievement_ids,created_by_user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (pair_id,history_key) DO UPDATE SET details=EXCLUDED.details, achievement_ids=EXCLUDED.achievement_ids, created_by_user_id=EXCLUDED.created_by_user_id, updated_at=NOW()`, [pair.pair_id, historyKey, mediaType, mediaId, episodeId, details, validIds, pair.user_id])
  return { status: 'ok', newlyUnlockedAchievements: await evaluateWatchTogetherAchievementsForUser(pool, username) }
}

export async function createWatchTogetherPartnerRequest(pool, { username, partnerUsername }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const users = await client.query(`SELECT id, username, full_name FROM users WHERE username = ANY($1::text[]) FOR UPDATE`, [[username, partnerUsername]])
    const current = users.rows.find((row) => row.username === username)
    const partner = users.rows.find((row) => row.username === partnerUsername)
    if (!current || !partner || current.id === partner.id) {
      await client.query('ROLLBACK')
      return { status: !current ? 'missing_user' : !partner ? 'missing_partner' : 'same_user' }
    }

    const activePairs = await client.query(
      `SELECT DISTINCT pair_id FROM watch_together_pair_members WHERE user_id = ANY($1::bigint[])`,
      [[current.id, partner.id]]
    )
    if (activePairs.rows.length) {
      await client.query('ROLLBACK')
      return { status: 'already_paired' }
    }
    const pending = await client.query(
      `SELECT id FROM watch_together_requests WHERE status = 'pending' AND (requester_id = ANY($1::bigint[]) OR recipient_id = ANY($1::bigint[])) LIMIT 1`,
      [[current.id, partner.id]]
    )
    if (pending.rows.length) {
      await client.query('ROLLBACK')
      return { status: 'pending_request' }
    }
    const created = await client.query(
      `INSERT INTO watch_together_requests (requester_id, recipient_id) VALUES ($1, $2) RETURNING id`,
      [current.id, partner.id]
    )
    const requestId = created.rows[0].id
    await client.query(
      `INSERT INTO user_alerts (user_id, kind, source_key, watch_together_request_id, title, message) VALUES ($1, 'watch_together_request', $2, $3, $4, $5)`,
      [partner.id, `watch-together-request:${requestId}`, requestId, 'Watch Together request', `${current.full_name} wants to watch together with you.`]
    )
    await client.query('COMMIT')
    return { status: 'ok', request: { id: Number(requestId), direction: 'outgoing', user: partner } }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function respondToWatchTogetherPartnerRequest(pool, { username, requestId, decision }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const requestResult = await client.query(
      `SELECT requests.*, requester.username AS requester_username, requester.full_name AS requester_full_name, recipient.username AS recipient_username, recipient.full_name AS recipient_full_name
       FROM watch_together_requests requests JOIN users requester ON requester.id = requests.requester_id JOIN users recipient ON recipient.id = requests.recipient_id
       WHERE requests.id = $1 FOR UPDATE`,
      [requestId]
    )
    const invite = requestResult.rows[0]
    if (!invite || invite.recipient_username !== username) { await client.query('ROLLBACK'); return { status: 'missing_request' } }
    if (invite.status !== 'pending') { await client.query('ROLLBACK'); return { status: 'not_pending' } }
    if (decision === 'deny') {
      await client.query(`UPDATE watch_together_requests SET status = 'denied', responded_at = NOW() WHERE id = $1`, [requestId])
      await client.query(`INSERT INTO user_alerts (user_id, kind, source_key, watch_together_request_id, title, message) VALUES ($1, 'watch_together_request_denied', $2, $3, $4, $5)`, [invite.requester_id, `watch-together-request:${requestId}:denied`, requestId, 'Watch Together request declined', `${invite.recipient_full_name} declined your Watch Together request.`])
      await client.query('COMMIT')
      return { status: 'denied' }
    }
    const activePairs = await client.query(`SELECT pair_id FROM watch_together_pair_members WHERE user_id = ANY($1::bigint[])`, [[invite.requester_id, invite.recipient_id]])
    if (activePairs.rows.length) { await client.query('ROLLBACK'); return { status: 'already_paired' } }
    const pair = await client.query(`INSERT INTO watch_together_pairs DEFAULT VALUES RETURNING id`)
    await client.query(`INSERT INTO watch_together_pair_members (pair_id, user_id) VALUES ($1, $2), ($1, $3)`, [pair.rows[0].id, invite.requester_id, invite.recipient_id])
    await client.query(`UPDATE watch_together_requests SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'invalidated' END, responded_at = NOW() WHERE status = 'pending' AND (requester_id = ANY($2::bigint[]) OR recipient_id = ANY($2::bigint[]))`, [requestId, [invite.requester_id, invite.recipient_id]])
    await client.query(`INSERT INTO user_alerts (user_id, kind, source_key, watch_together_request_id, title, message) VALUES ($1, 'watch_together_request_accepted', $2, $3, $4, $5)`, [invite.requester_id, `watch-together-request:${requestId}:accepted`, requestId, 'Watch Together request accepted', `${invite.recipient_full_name} accepted your Watch Together request.`])
    await client.query('COMMIT')
    return { status: 'accepted', partner: { username: invite.requester_username, full_name: invite.requester_full_name } }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function resetWatchTogetherPartnerForUser(pool, username) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pair = await client.query(`SELECT members.pair_id FROM watch_together_pair_members members JOIN users ON users.id = members.user_id WHERE users.username = $1 FOR UPDATE`, [username])
    if (!pair.rows[0]) { await client.query('ROLLBACK'); return { status: 'no_pair' } }
    await client.query(`DELETE FROM watch_together_pairs WHERE id = $1`, [pair.rows[0].pair_id])
    await client.query('COMMIT')
    return { status: 'ok' }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function addWatchTogetherItemForUser(pool, { username, mediaType, mediaId }) {
  if (mediaType === 'tv') return addWatchTogetherTvEpisodeForUser(pool, { username, showId: mediaId })
  const result = await pool.query(
    `
      WITH pair AS (
        SELECT mine.pair_id FROM watch_together_pair_members mine JOIN users ON users.id = mine.user_id WHERE users.username = $1
      ), media AS (
        SELECT tmdb_id AS media_id FROM movies WHERE $2 = 'movie' AND tmdb_id = $3
        UNION ALL SELECT tmdb_id FROM tv_shows WHERE $2 = 'tv' AND tmdb_id = $3
      ), watched_by_pair AS (
        SELECT watched_movies.id
        FROM watched_movies
        JOIN movies ON movies.id = watched_movies.movie_id
        WHERE $2 = 'movie'
          AND movies.tmdb_id = $3
          AND watched_movies.user_id IN (SELECT user_id FROM watch_together_pair_members WHERE pair_id IN (SELECT pair_id FROM pair))
      ), inserted AS (
        INSERT INTO watch_together_items (pair_id, media_type, media_id)
        SELECT pair.pair_id, $2, media.media_id FROM pair CROSS JOIN media
        WHERE NOT EXISTS (SELECT 1 FROM watched_by_pair)
        ON CONFLICT (pair_id, media_type, media_id) DO NOTHING
        RETURNING id
      )
      SELECT EXISTS(SELECT 1 FROM pair) AS has_pair, EXISTS(SELECT 1 FROM media) AS has_media, EXISTS(SELECT 1 FROM watched_by_pair) AS watched_by_pair,
        EXISTS(SELECT 1 FROM inserted) AS added
    `,
    [username, mediaType, mediaId]
  )
  const row = result.rows[0] ?? {}
  if (!row.has_pair) return { status: 'no_pair' }
  if (!row.has_media) return { status: 'missing_media' }
  if (row.watched_by_pair) return { status: 'already_watched' }
  return { status: 'ok', added: Boolean(row.added) }
}

export async function addWatchTogetherTvEpisodeForUser(pool, { username, showId }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pairResult = await client.query(
      `SELECT mine.pair_id, mine.user_id AS current_user_id, other.user_id AS partner_user_id, partner.username AS partner_username
       FROM watch_together_pair_members mine
       JOIN users current_account ON current_account.id = mine.user_id
       JOIN watch_together_pair_members other ON other.pair_id = mine.pair_id AND other.user_id <> mine.user_id
       JOIN users partner ON partner.id = other.user_id
       WHERE current_account.username = $1 FOR UPDATE`, [username]
    )
    const pair = pairResult.rows[0]
    if (!pair) { await client.query('ROLLBACK'); return { status: 'no_pair' } }
    const showResult = await client.query('SELECT id, tmdb_id FROM tv_shows WHERE tmdb_id = $1 OR id = $1 ORDER BY CASE WHEN tmdb_id = $1 THEN 0 ELSE 1 END LIMIT 1', [showId])
    const show = showResult.rows[0]
    if (!show) { await client.query('ROLLBACK'); return { status: 'missing_media' } }
    const episodesResult = await client.query(
      `SELECT e.id, e.tmdb_id, s.season_number, e.episode_number, e.name
       FROM tv_episodes e JOIN tv_seasons s ON s.id = e.tv_season_id
       WHERE s.tv_show_id = $1 AND s.season_number > 0 AND (e.air_date IS NULL OR e.air_date <= CURRENT_DATE)
       ORDER BY s.season_number, e.episode_number`, [show.id]
    )
    const episodes = episodesResult.rows
    if (!episodes.length) { await client.query('ROLLBACK'); return { status: 'no_next_episode' } }
    const watchedResult = await client.query(
      `SELECT watched_tv_episodes.user_id, watched_tv_episodes.tv_episode_id
       FROM watched_tv_episodes
       WHERE watched_tv_episodes.user_id = ANY($1::bigint[])
         AND watched_tv_episodes.tv_episode_id = ANY($2::bigint[])`,
      [[pair.current_user_id, pair.partner_user_id], episodes.map((episode) => episode.id)]
    )
    const mine = new Set(watchedResult.rows.filter((row) => Number(row.user_id) === Number(pair.current_user_id)).map((row) => Number(row.tv_episode_id)))
    const partner = new Set(watchedResult.rows.filter((row) => Number(row.user_id) === Number(pair.partner_user_id)).map((row) => Number(row.tv_episode_id)))
    const matches = mine.size === partner.size && [...mine].every((id) => partner.has(id))
    if (!matches) {
      const behindIsPartner = mine.size > partner.size
      await client.query('ROLLBACK')
      return { status: 'progress_mismatch', behindUsername: behindIsPartner ? pair.partner_username : username }
    }
    const next = episodes.find((episode) => !mine.has(Number(episode.id)))
    if (!next) { await client.query('ROLLBACK'); return { status: 'no_next_episode' } }
    const inserted = await client.query(
      `INSERT INTO watch_together_items (pair_id, media_type, media_id, tv_episode_id)
       VALUES ($1, 'tv', $2, $3) ON CONFLICT (pair_id, media_type, media_id) DO NOTHING RETURNING id`,
      [pair.pair_id, show.tmdb_id, next.id]
    )
    await client.query('COMMIT')
    return { status: 'ok', added: Boolean(inserted.rows[0]), episode: next }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function removeWatchTogetherItemForUser(pool, { username, mediaType, mediaId }) {
  const result = await pool.query(
    `WITH pair AS (SELECT mine.pair_id FROM watch_together_pair_members mine JOIN users ON users.id = mine.user_id WHERE users.username = $1), target AS (SELECT * FROM watch_together_items WHERE pair_id IN (SELECT pair_id FROM pair) AND media_type = $2 AND media_id = $3), deleted AS (DELETE FROM watch_together_items WHERE id IN (SELECT id FROM target WHERE NOT is_selected AND pick_proposed_by_user_id IS NULL) RETURNING id) SELECT EXISTS(SELECT 1 FROM pair) AS has_pair, EXISTS(SELECT 1 FROM target WHERE is_selected OR pick_proposed_by_user_id IS NOT NULL) AS active, EXISTS(SELECT 1 FROM deleted) AS removed`,
    [username, mediaType, mediaId]
  )
  const row = result.rows[0] ?? {}
  if (!row.has_pair) return { status: 'no_pair' }
  if (row.active) return { status: 'active_pick' }
  return { status: 'ok', removed: Boolean(row.removed) }
}

export async function proposeWatchTogetherItemForUser(pool, { username, mediaType, mediaId }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const pair = await client.query(`SELECT mine.pair_id, mine.user_id FROM watch_together_pair_members mine JOIN users ON users.id = mine.user_id JOIN watch_together_pairs pairs ON pairs.id = mine.pair_id WHERE users.username = $1 FOR UPDATE OF pairs`, [username])
    const context = pair.rows[0]
    if (!context) {
      await client.query('ROLLBACK')
      return { status: 'no_pair' }
    }
    const item = await client.query(`SELECT id FROM watch_together_items WHERE pair_id = $1 AND media_type = $2 AND media_id = $3 FOR UPDATE`, [context.pair_id, mediaType, mediaId])
    if (!item.rows[0]) {
      await client.query('ROLLBACK')
      return { status: 'missing_item' }
    }
    const active = await client.query(`SELECT id FROM watch_together_items WHERE pair_id = $1 AND (is_selected OR pick_proposed_by_user_id IS NOT NULL) FOR UPDATE`, [context.pair_id])
    if (active.rows.length) {
      await client.query('ROLLBACK')
      return { status: 'active_pick' }
    }
    await client.query(`UPDATE watch_together_items SET pick_proposed_by_user_id = $2, pick_proposed_at = NOW() WHERE id = $1`, [item.rows[0].id, context.user_id])
    await client.query('COMMIT')
    return { status: 'ok' }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function respondToWatchTogetherPickForUser(pool, { username, mediaType, mediaId, decision }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const context = await client.query(`SELECT mine.pair_id, mine.user_id FROM watch_together_pair_members mine JOIN users ON users.id = mine.user_id JOIN watch_together_pairs pairs ON pairs.id = mine.pair_id WHERE users.username = $1 FOR UPDATE OF pairs`, [username])
    const pair = context.rows[0]
    if (!pair) { await client.query('ROLLBACK'); return { status: 'no_pair' } }
    const item = await client.query(`SELECT id, pick_proposed_by_user_id FROM watch_together_items WHERE pair_id = $1 AND media_type = $2 AND media_id = $3 FOR UPDATE`, [pair.pair_id, mediaType, mediaId])
    const proposed = item.rows[0]
    if (!proposed?.pick_proposed_by_user_id) { await client.query('ROLLBACK'); return { status: 'missing_proposal' } }
    if (Number(proposed.pick_proposed_by_user_id) === Number(pair.user_id)) { await client.query('ROLLBACK'); return { status: 'proposer_cannot_vote' } }
    if (decision === 'accept') await client.query(`UPDATE watch_together_items SET is_selected = TRUE, pick_proposed_by_user_id = NULL, pick_proposed_at = NULL WHERE id = $1`, [proposed.id])
    else await client.query(`UPDATE watch_together_items SET pick_proposed_by_user_id = NULL, pick_proposed_at = NULL WHERE id = $1`, [proposed.id])
    await client.query('COMMIT')
    return { status: decision === 'accept' ? 'accepted' : 'denied' }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function clearWatchTogetherSelectionForUser(pool, username) {
  const result = await pool.query(`WITH pair AS (SELECT mine.pair_id, mine.user_id FROM watch_together_pair_members mine JOIN users ON users.id = mine.user_id WHERE users.username = $1), active AS (SELECT * FROM watch_together_items WHERE pair_id IN (SELECT pair_id FROM pair) AND (is_selected OR pick_proposed_by_user_id IS NOT NULL)), updated AS (UPDATE watch_together_items SET is_selected = FALSE, pick_proposed_by_user_id = NULL, pick_proposed_at = NULL WHERE id IN (SELECT id FROM active WHERE is_selected OR pick_proposed_by_user_id = (SELECT user_id FROM pair)) RETURNING id) SELECT EXISTS(SELECT 1 FROM pair) AS has_pair, EXISTS(SELECT 1 FROM active) AS has_active, EXISTS(SELECT 1 FROM updated) AS cleared`, [username])
  const row = result.rows[0] ?? {}
  if (!row.has_pair) return { status: 'no_pair' }
  if (!row.has_active) return { status: 'no_active_pick' }
  return row.cleared ? { status: 'ok' } : { status: 'not_proposer' }
}

export async function isSelectedWatchTogetherMovieForUser(pool, { username, movieId }) {
  const result = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM watch_together_pair_members members JOIN users ON users.id = members.user_id JOIN watch_together_items items ON items.pair_id = members.pair_id AND items.media_type = 'movie' AND items.is_selected JOIN movies ON movies.tmdb_id = items.media_id WHERE users.username = $1 AND (movies.tmdb_id = $2 OR movies.id = $2)) AS selected`,
    [username, movieId]
  )
  return Boolean(result.rows[0]?.selected)
}

export async function confirmWatchTogetherMovieForUser(pool, { username, movieId }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const context = await client.query(
      `
        SELECT members.pair_id, members.user_id, movies.id AS movie_id
        FROM watch_together_pair_members members
        JOIN users ON users.id = members.user_id
        JOIN movies ON movies.tmdb_id = $2 OR movies.id = $2
        WHERE users.username = $1
        ORDER BY CASE WHEN movies.tmdb_id = $2 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [username, movieId]
    )
    const row = context.rows[0]
    if (!row) {
      await client.query('ROLLBACK')
      return { status: 'not_shared' }
    }
    const item = await client.query(
      `SELECT items.id FROM watch_together_items items JOIN movies ON movies.tmdb_id = items.media_id WHERE items.pair_id = $1 AND items.media_type = 'movie' AND items.is_selected AND movies.id = $2 FOR UPDATE`,
      [row.pair_id, row.movie_id]
    )
    const itemId = item.rows[0]?.id
    if (!itemId) {
      await client.query('ROLLBACK')
      return { status: 'not_selected' }
    }
    await client.query(`INSERT INTO watch_together_item_confirmations (item_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [itemId, row.user_id])
    const confirmations = await client.query(`SELECT COUNT(*)::INTEGER AS count FROM watch_together_item_confirmations WHERE item_id = $1`, [itemId])
    if (Number(confirmations.rows[0]?.count) < 2) {
      await client.query('COMMIT')
      return { status: 'waiting_for_partner' }
    }
    const history = await client.query(
      `INSERT INTO watch_together_watched_movies (pair_id, movie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING watched_together_at`,
      [row.pair_id, row.movie_id]
    )
    await client.query(`DELETE FROM watch_together_items WHERE id = $1`, [itemId])
    await client.query('COMMIT')
    return { status: 'completed', watchedTogetherAt: history.rows[0]?.watched_together_at ?? null }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function confirmWatchTogetherEpisodeForUser(pool, { username, episodeId, watchService = null }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const contextResult = await client.query(
      `SELECT mine.pair_id, mine.user_id, other.user_id AS partner_user_id
       FROM watch_together_pair_members mine
       JOIN users ON users.id = mine.user_id
       JOIN watch_together_pair_members other ON other.pair_id = mine.pair_id AND other.user_id <> mine.user_id
       WHERE users.username = $1 FOR UPDATE`, [username]
    )
    const context = contextResult.rows[0]
    if (!context) { await client.query('ROLLBACK'); return { status: 'no_pair' } }
    const itemResult = await client.query(
      `SELECT items.id, items.tv_episode_id, tv_seasons.tv_show_id
       FROM watch_together_items items
       JOIN tv_episodes ON tv_episodes.id = items.tv_episode_id
       JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
       WHERE items.pair_id = $1 AND items.media_type = 'tv' AND items.tv_episode_id = $2 AND items.is_selected
       FOR UPDATE`, [context.pair_id, episodeId]
    )
    const item = itemResult.rows[0]
    if (!item) { await client.query('ROLLBACK'); return { status: 'not_selected' } }
    const priorConfirmation = await client.query('SELECT 1 FROM watch_together_item_confirmations WHERE item_id = $1 AND user_id = $2', [item.id, context.user_id])
    const alreadyWatched = await client.query('SELECT 1 FROM watched_tv_episodes WHERE user_id = $1 AND tv_episode_id = $2', [context.user_id, item.tv_episode_id])
    if (alreadyWatched.rows[0] && !priorConfirmation.rows[0]) { await client.query('ROLLBACK'); return { status: 'already_watched' } }
    let updatedCount = 0
    if (!priorConfirmation.rows[0]) {
      const inserted = await client.query(
        'INSERT INTO watched_tv_episodes (user_id, tv_episode_id, watch_service) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [context.user_id, item.tv_episode_id, normalizeWatchService(watchService)]
      )
      updatedCount = inserted.rowCount ?? 0
      await client.query('INSERT INTO watch_together_item_confirmations (item_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [item.id, context.user_id])
    }
    const confirmations = await client.query('SELECT COUNT(*)::INTEGER AS count FROM watch_together_item_confirmations WHERE item_id = $1', [item.id])
    const completion = updatedCount ? await syncTvShowWatchCompletion(client, username, item.tv_show_id) : null
    if (Number(confirmations.rows[0]?.count) < 2) {
      await client.query('COMMIT')
      return { status: 'waiting_for_partner', updatedCount, ...(completion?.newlyCompletedShowId ? { newlyCompletedShowId: completion.newlyCompletedShowId } : {}) }
    }
    const history = await client.query(
      'INSERT INTO watch_together_watched_episodes (pair_id, tv_episode_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING watched_together_at',
      [context.pair_id, item.tv_episode_id]
    )
    await client.query('DELETE FROM watch_together_items WHERE id = $1', [item.id])
    await client.query('COMMIT')
    return { status: 'completed', updatedCount, watchedTogetherAt: history.rows[0]?.watched_together_at ?? null, ...(completion?.newlyCompletedShowId ? { newlyCompletedShowId: completion.newlyCompletedShowId } : {}) }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
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
        (SELECT id FROM selected_movie) AS entity_id,
        (SELECT score::DOUBLE PRECISION FROM saved_rating) AS score
    `,
    [username, movieId, score]
  )

  const row = result.rows[0] ?? null

  if (!row?.has_user) return { status: 'missing_user' }
  if (!row.has_movie) return { status: 'missing_movie' }

  return { status: 'ok', score: Number(row.score), ...(Number.isFinite(Number(row.entity_id)) ? { entityId: Number(row.entity_id) } : {}) }
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
          AND tv_seasons.season_number > 0
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
    pool.query(`SELECT s.*, COALESCE(json_agg(json_build_object('id', e.id, 'tmdb_id', e.tmdb_id, 'episode_number', e.episode_number, 'name', e.name, 'overview', e.overview, 'air_date', e.air_date, 'runtime_minutes', e.runtime_minutes, 'still_path', e.still_path, 'is_aired', e.air_date IS NULL OR e.air_date <= CURRENT_DATE, 'watched', w.id IS NOT NULL, 'your_score', r.score) ORDER BY e.episode_number) FILTER (WHERE e.id IS NOT NULL), '[]') AS episodes FROM tv_seasons s LEFT JOIN tv_episodes e ON e.tv_season_id=s.id LEFT JOIN watched_tv_episodes w ON w.tv_episode_id=e.id AND w.user_id=(SELECT id FROM users WHERE username=$2) LEFT JOIN tv_episode_ratings r ON r.tv_episode_id=e.id AND r.user_id=(SELECT id FROM users WHERE username=$2) WHERE s.tv_show_id=$1 AND s.season_number > 0 GROUP BY s.id ORDER BY s.season_number`, [show.id, username]),
    pool.query('SELECT * FROM tv_show_credits WHERE tv_show_id = $1 ORDER BY credit_type, billing_order NULLS LAST LIMIT 12', [show.id]),
    pool.query('SELECT * FROM tv_recommendations WHERE tv_show_id = $1 ORDER BY display_order LIMIT 10', [show.id]),
    pool.query('SELECT * FROM tv_trailers WHERE tv_show_id = $1 ORDER BY is_official DESC LIMIT 5', [show.id]),
    pool.query(`SELECT AVG(r.score)::DOUBLE PRECISION AS community_average, COUNT(r.id)::INTEGER AS community_vote_count, AVG(r.score) FILTER (WHERE r.user_id = (SELECT id FROM users WHERE username = $2))::DOUBLE PRECISION AS your_average, COUNT(r.id) FILTER (WHERE r.user_id = (SELECT id FROM users WHERE username = $2))::INTEGER AS your_rating_count FROM tv_episodes e JOIN tv_seasons s ON s.id = e.tv_season_id LEFT JOIN tv_episode_ratings r ON r.tv_episode_id = e.id WHERE s.tv_show_id = $1 AND s.season_number > 0`, [show.id, username]),
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
    `WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1), selected_episode AS (SELECT e.id FROM tv_episodes e JOIN tv_seasons s ON s.id = e.tv_season_id WHERE e.id = $2 AND s.season_number > 0 LIMIT 1), saved_rating AS (INSERT INTO tv_episode_ratings (user_id, tv_episode_id, score, created_at, updated_at) SELECT selected_user.id, selected_episode.id, $3, NOW(), NOW() FROM selected_user CROSS JOIN selected_episode ON CONFLICT (user_id, tv_episode_id) DO UPDATE SET score = EXCLUDED.score, updated_at = NOW() RETURNING score) SELECT EXISTS(SELECT 1 FROM selected_user) AS has_user, EXISTS(SELECT 1 FROM selected_episode) AS has_episode, (SELECT id FROM selected_episode) AS entity_id, (SELECT score::DOUBLE PRECISION FROM saved_rating) AS score`,
    [username, episodeId, score]
  )
  const row = result.rows[0] ?? null
  if (!row?.has_user) return { status: 'missing_user' }
  if (!row.has_episode) return { status: 'missing_episode' }
  return { status: 'ok', score: Number(row.score), ...(Number.isFinite(Number(row.entity_id)) ? { entityId: Number(row.entity_id) } : {}) }
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
         WHERE e.id = $1 AND s.tv_show_id = $2 AND s.season_number > 0 AND (e.air_date IS NULL OR e.air_date <= CURRENT_DATE)
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
             AND s.season_number > 0
             AND (e.air_date IS NULL OR e.air_date <= CURRENT_DATE)
             AND (s.season_number < $3 OR (s.season_number = $3 AND e.episode_number <= $4))
           ON CONFLICT DO NOTHING`,
          [context.user_id, context.show_id, episode.season_number, episode.episode_number, normalizedWatchService]
        )
      }
      updatedCount = result.rowCount ?? 0
    } else if (action === 'mark_season') {
      const seasonResult = await client.query(
        'SELECT id FROM tv_seasons WHERE id = $1 AND tv_show_id = $2 AND season_number > 0 LIMIT 1',
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

    const completion = await syncTvShowWatchCompletion(client, username, showId)
    await client.query('COMMIT')
    return { status: 'ok', updatedCount, ...(completion?.newlyCompletedShowId ? { newlyCompletedShowId: completion.newlyCompletedShowId } : {}) }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

async function syncTvShowWatchCompletion(client, username, showId) {
  const result = await client.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1), selected_show AS (SELECT id FROM tv_shows WHERE tmdb_id=$2 OR id=$2 LIMIT 1), episode_totals AS (SELECT COUNT(*)::integer total, COUNT(w.id)::integer watched FROM tv_episodes e JOIN tv_seasons s ON s.id=e.tv_season_id LEFT JOIN watched_tv_episodes w ON w.tv_episode_id=e.id AND w.user_id=(SELECT id FROM selected_user) WHERE s.tv_show_id=(SELECT id FROM selected_show) AND s.season_number > 0 AND (e.air_date IS NULL OR e.air_date <= CURRENT_DATE)) SELECT (SELECT id FROM selected_user) user_id, (SELECT id FROM selected_show) show_id, total, watched FROM episode_totals`, [username, showId])
  const row = result.rows[0]
  if (!row?.user_id || !row?.show_id) return null
  if (row.total > 0 && row.total === row.watched) {
    const inserted = await client.query('INSERT INTO watched_tv_shows (user_id,tv_show_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING tv_show_id', [row.user_id, row.show_id])
    return { newlyCompletedShowId: inserted.rows[0]?.tv_show_id ?? null }
  }
  await client.query('DELETE FROM watched_tv_shows WHERE user_id=$1 AND tv_show_id=$2', [row.user_id, row.show_id])
  return null
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

export async function updateUserAlertTimezone(pool, { username, timezone }) {
  await pool.query(
    `
      UPDATE users
      SET alert_timezone = $2, updated_at = NOW()
      WHERE username = $1
    `,
    [username, timezone]
  )
}

export async function listAlertsForUser(pool, username, { limit = 50 } = {}) {
  const result = await pool.query(
    `
      SELECT
        user_alerts.id,
        user_alerts.kind,
        user_alerts.title,
        user_alerts.message,
        user_alerts.created_at,
        user_alerts.read_at,
        user_alerts.watch_together_request_id,
        watch_together_requests.status AS watch_together_request_status,
        movies.tmdb_id AS movie_tmdb_id,
        tv_shows.tmdb_id AS tv_show_tmdb_id
      FROM user_alerts
      JOIN users ON users.id = user_alerts.user_id
      LEFT JOIN movies ON movies.id = user_alerts.movie_id
      LEFT JOIN tv_shows ON tv_shows.id = user_alerts.tv_show_id
      LEFT JOIN watch_together_requests ON watch_together_requests.id = user_alerts.watch_together_request_id
      WHERE users.username = $1
      ORDER BY user_alerts.created_at DESC, user_alerts.id DESC
      LIMIT $2
    `,
    [username, limit]
  )
  return result.rows
}

export async function countUnreadAlertsForUser(pool, username) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::INTEGER AS count
      FROM user_alerts
      JOIN users ON users.id = user_alerts.user_id
      WHERE users.username = $1 AND user_alerts.read_at IS NULL
    `,
    [username]
  )
  return Number(result.rows[0]?.count ?? 0)
}

export async function markAlertsReadForUser(pool, username) {
  const result = await pool.query(
    `
      UPDATE user_alerts
      SET read_at = NOW()
      WHERE user_id = (SELECT id FROM users WHERE username = $1 LIMIT 1)
        AND read_at IS NULL
    `,
    [username]
  )
  return result.rowCount ?? 0
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

export async function listCalendarEventsForUser(pool, username, { startDate, endDate, mediaType = 'all' } = {}) {
  const result = await pool.query(
    `
      WITH selected_user AS (
        SELECT id FROM users WHERE username = $1 LIMIT 1
      ),
      in_progress_shows AS (
        SELECT tv_seasons.tv_show_id
        FROM tv_episodes
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
        LEFT JOIN watched_tv_episodes
          ON watched_tv_episodes.tv_episode_id = tv_episodes.id
          AND watched_tv_episodes.user_id IN (SELECT id FROM selected_user)
        WHERE tv_seasons.season_number > 0
          AND tv_episodes.air_date IS NOT NULL
          AND tv_episodes.air_date <= CURRENT_DATE
        GROUP BY tv_seasons.tv_show_id
        HAVING COUNT(watched_tv_episodes.id) > 0
          AND COUNT(watched_tv_episodes.id) < COUNT(tv_episodes.id)
      ),
      eligible_tv_shows AS (
        SELECT tv_show_id FROM tv_watchlist_items WHERE user_id IN (SELECT id FROM selected_user)
        UNION
        SELECT tv_show_id FROM in_progress_shows
      )
      SELECT
        movies.release_date::TEXT AS event_date,
        'movie'::TEXT AS media_type,
        movies.tmdb_id AS media_id,
        NULL::BIGINT AS episode_id,
        movies.title AS title,
        NULL::TEXT AS episode_title,
        NULL::INTEGER AS season_number,
        NULL::INTEGER AS episode_number,
        movies.poster_path,
        movies.backdrop_path,
        NULL::TEXT AS still_path
      FROM watchlist_items
      JOIN movies ON movies.id = watchlist_items.movie_id
      WHERE watchlist_items.user_id IN (SELECT id FROM selected_user)
        AND movies.release_date >= $2::DATE
        AND movies.release_date < $3::DATE
        AND $4 IN ('all', 'movie')

      UNION ALL

      SELECT
        tv_episodes.air_date::TEXT AS event_date,
        'tv'::TEXT AS media_type,
        tv_shows.tmdb_id AS media_id,
        tv_episodes.id AS episode_id,
        tv_shows.name AS title,
        tv_episodes.name AS episode_title,
        tv_seasons.season_number,
        tv_episodes.episode_number,
        tv_shows.poster_path,
        tv_shows.backdrop_path,
        tv_episodes.still_path
      FROM tv_episodes
      JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
      JOIN tv_shows ON tv_shows.id = tv_seasons.tv_show_id
      LEFT JOIN watched_tv_episodes
        ON watched_tv_episodes.tv_episode_id = tv_episodes.id
        AND watched_tv_episodes.user_id IN (SELECT id FROM selected_user)
      WHERE tv_seasons.tv_show_id IN (SELECT tv_show_id FROM eligible_tv_shows)
        AND tv_seasons.season_number > 0
        AND tv_episodes.air_date >= $2::DATE
        AND tv_episodes.air_date < $3::DATE
        AND (tv_episodes.air_date > CURRENT_DATE OR watched_tv_episodes.id IS NULL)
        AND $4 IN ('all', 'tv')
      ORDER BY event_date ASC, media_type ASC, title ASC, season_number ASC NULLS FIRST, episode_number ASC NULLS FIRST
    `,
    [username, startDate, endDate, mediaType]
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
        (SELECT id FROM selected_movie) AS entity_id,
        (SELECT total FROM watchlist_total) AS watchlist_total,
        EXISTS(SELECT 1 FROM existing_watchlist) AS already_saved,
        COALESCE(
          (SELECT created_at FROM inserted_watchlist),
          (
            SELECT created_at
            FROM existing_watchlist
          )
        ) AS created_at,
        EXISTS(SELECT 1 FROM inserted_watchlist) AS added
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
    entityId: Number(row.entity_id),
    createdAt: row.created_at ?? null,
    added: Boolean(row.added),
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

export async function listWatchedMoviesByGenreForUser(pool, username, options = {}) {
  const { genre = '', limit = 30, page = 1 } = options
  const normalizedGenre = typeof genre === 'string' ? genre.trim() : ''
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
        movies.imported_at,
        watched_movies.created_at AS watched_at
      FROM watched_movies
      JOIN users ON users.id = watched_movies.user_id
      JOIN movies ON movies.id = watched_movies.movie_id
      LEFT JOIN LATERAL UNNEST(movies.genre_ids) WITH ORDINALITY AS genre_ids(tmdb_genre_id, ordinality) ON TRUE
      LEFT JOIN genres ON genres.tmdb_genre_id = genre_ids.tmdb_genre_id
      WHERE users.username = $1
        AND EXISTS (
          SELECT 1
          FROM UNNEST(movies.genre_ids) AS selected_genre(tmdb_genre_id)
          JOIN genres AS selected_genres ON selected_genres.tmdb_genre_id = selected_genre.tmdb_genre_id
          WHERE LOWER(selected_genres.name) = LOWER($2)
        )
      GROUP BY movies.id, watched_movies.created_at
      ORDER BY watched_movies.created_at DESC, movies.tmdb_id ASC
      LIMIT $3
      OFFSET $4
    `,
    [username, normalizedGenre, normalizedLimit, offset]
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
        (SELECT id FROM selected_movie) AS entity_id,
        EXISTS(SELECT 1 FROM deleted_watchlist) AS removed_from_watchlist,
        COALESCE(
          (SELECT created_at FROM inserted_watched),
          (SELECT created_at FROM existing_watched)
        ) AS created_at,
        EXISTS(SELECT 1 FROM inserted_watched) AS added
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
    entityId: Number(row.entity_id),
    createdAt: row.created_at ?? null,
    added: Boolean(row.added),
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

export async function getBookStatsForUser(pool, username, period = 'year') {
  const [metricsResult, readEventsResult, categoryResult, authorResult, topRatedResult, recentReadsResult] = await Promise.all([
    pool.query(`
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1),
      period_start AS (SELECT date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS value)
      SELECT
        EXISTS(SELECT 1 FROM selected_user) AS has_user,
        (SELECT COUNT(*)::INTEGER FROM read_books WHERE user_id IN (SELECT id FROM selected_user) AND created_at >= (SELECT value FROM period_start)) AS books_read,
        (SELECT COALESCE(SUM(COALESCE(books.page_count, 0)), 0)::INTEGER FROM read_books JOIN books ON books.id = read_books.book_id WHERE read_books.user_id IN (SELECT id FROM selected_user) AND read_books.created_at >= (SELECT value FROM period_start)) AS pages_read,
        (SELECT COUNT(*)::INTEGER FROM read_books WHERE user_id IN (SELECT id FROM selected_user) AND created_at >= (SELECT value FROM period_start) AND reading_format = 'physical') AS physical_books_read,
        (SELECT COUNT(*)::INTEGER FROM read_books WHERE user_id IN (SELECT id FROM selected_user) AND created_at >= (SELECT value FROM period_start) AND reading_format = 'ebook') AS ebook_books_read,
        (SELECT COUNT(*)::INTEGER FROM read_books WHERE user_id IN (SELECT id FROM selected_user) AND created_at >= (SELECT value FROM period_start) AND reading_format = 'audiobook') AS audiobook_books_read,
        (SELECT COUNT(*)::INTEGER FROM book_watchlist_items WHERE user_id IN (SELECT id FROM selected_user) AND created_at >= (SELECT value FROM period_start)) AS watchlist_count,
        (SELECT AVG(score)::DOUBLE PRECISION FROM book_ratings WHERE user_id IN (SELECT id FROM selected_user) AND GREATEST(created_at, updated_at) >= (SELECT value FROM period_start)) AS average_rating
    `, [username, period]),
    pool.query(`
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1)
      SELECT read_books.created_at AS read_at, COALESCE(books.page_count, 0)::INTEGER AS page_count
      FROM read_books JOIN books ON books.id = read_books.book_id
      WHERE read_books.user_id IN (SELECT id FROM selected_user)
        AND read_books.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ORDER BY read_books.created_at ASC
    `, [username, period]),
    pool.query(`
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1)
      SELECT category AS name, COUNT(*)::INTEGER AS book_count, COALESCE(SUM(COALESCE(books.page_count, 0)), 0)::INTEGER AS pages
      FROM read_books JOIN books ON books.id = read_books.book_id
      CROSS JOIN LATERAL UNNEST(books.categories) AS category
      WHERE read_books.user_id IN (SELECT id FROM selected_user)
        AND read_books.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        AND BTRIM(category) <> ''
      GROUP BY category ORDER BY book_count DESC, pages DESC, name ASC LIMIT 5
    `, [username, period]),
    pool.query(`
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1)
      SELECT author AS name, COUNT(*)::INTEGER AS book_count
      FROM read_books JOIN books ON books.id = read_books.book_id
      CROSS JOIN LATERAL UNNEST(books.authors) AS author
      WHERE read_books.user_id IN (SELECT id FROM selected_user)
        AND read_books.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        AND BTRIM(author) <> ''
      GROUP BY author ORDER BY book_count DESC, name ASC LIMIT 4
    `, [username, period]),
    pool.query(`
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1)
      SELECT books.google_books_id, books.title, books.authors, books.cover_image_url, book_ratings.score::DOUBLE PRECISION AS score
      FROM book_ratings JOIN books ON books.id = book_ratings.book_id
      WHERE book_ratings.user_id IN (SELECT id FROM selected_user)
        AND GREATEST(book_ratings.created_at, book_ratings.updated_at) >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ORDER BY book_ratings.score DESC, GREATEST(book_ratings.created_at, book_ratings.updated_at) DESC, books.title ASC LIMIT 4
    `, [username, period]),
    pool.query(`
      WITH selected_user AS (SELECT id FROM users WHERE username = $1 LIMIT 1)
      SELECT books.google_books_id, books.title, books.authors, books.cover_image_url, read_books.created_at AS read_at
      FROM read_books JOIN books ON books.id = read_books.book_id
      WHERE read_books.user_id IN (SELECT id FROM selected_user)
        AND read_books.created_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ORDER BY read_books.created_at DESC, books.google_books_id ASC LIMIT 5
    `, [username, period]),
  ])

  const metrics = metricsResult.rows[0] ?? null
  if (!metrics?.has_user) return { status: 'missing_user' }
  return {
    metrics: {
      booksRead: Number(metrics.books_read ?? 0), pagesRead: Number(metrics.pages_read ?? 0),
      watchlistCount: Number(metrics.watchlist_count ?? 0), averageRating: metrics.average_rating == null ? null : Number(metrics.average_rating),
    },
    formats: {
      physical: Number(metrics.physical_books_read ?? 0),
      ebook: Number(metrics.ebook_books_read ?? 0),
      audiobook: Number(metrics.audiobook_books_read ?? 0),
    },
    activity: buildBookStatsActivity(readEventsResult.rows, period),
    categories: categoryResult.rows.map((row) => ({ name: row.name, bookCount: Number(row.book_count), pages: Number(row.pages) })),
    authors: authorResult.rows.map((row) => ({ name: row.name, bookCount: Number(row.book_count) })),
    topRated: topRatedResult.rows.map((row) => ({ id: row.google_books_id, title: row.title, authors: row.authors ?? [], coverUrl: row.cover_image_url ?? null, score: Number(row.score) })),
    recentReads: recentReadsResult.rows.map((row) => ({ id: row.google_books_id, title: row.title, authors: row.authors ?? [], coverUrl: row.cover_image_url ?? null, readAt: row.read_at })),
  }
}

function buildBookStatsActivity(events, period) {
  const buckets = createStatsActivityBuckets(period, new Date())
  for (const event of events) {
    const date = new Date(event.read_at)
    const bucket = getStatsActivityBucketKey(date, period, buckets)
    const target = buckets.find((entry) => entry.key === bucket)
    if (target) { target.totalMinutes += Number(event.page_count) || 0; target.movieMinutes += 1 }
  }
  return { buckets: buckets.map(({ key: _key, movieMinutes: booksRead, tvMinutes: _unused, ...bucket }) => ({ ...bucket, booksRead, pagesRead: bucket.totalMinutes })) }
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
          AND tv_seasons.season_number > 0
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
    SELECT tv_shows.tmdb_id, tv_shows.name AS title, tv_shows.poster_path, 'tv'::TEXT AS media_type, tv_seasons.season_number, tv_episodes.episode_number, watched_tv_episodes.watched_at FROM watched_tv_episodes JOIN tv_episodes ON tv_episodes.id=watched_tv_episodes.tv_episode_id JOIN tv_seasons ON tv_seasons.id=tv_episodes.tv_season_id JOIN tv_shows ON tv_shows.id=tv_seasons.tv_show_id WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user) AND tv_seasons.season_number > 0
  ) SELECT * FROM events ORDER BY watched_at DESC LIMIT 5`, [username])
  return result.rows.map((row) => ({ ...(Number.isInteger(Number(row.tmdb_id)) ? { id: Number(row.tmdb_id) } : {}), title: row.title, posterPath: row.poster_path ?? null, mediaType: row.media_type === 'tv' ? 'tv' : 'movie', seasonNumber: row.season_number === null ? null : Number(row.season_number), episodeNumber: row.episode_number === null ? null : Number(row.episode_number), watchedAt: row.watched_at }))
}

export async function getYearInReviewForUser(pool, username) {
  const [eventsResult, ratingsResult] = await Promise.all([
    pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1), events AS (
      SELECT 'movie'::TEXT media_type, movies.id::TEXT title_key, watched_movies.created_at watched_at, COALESCE(movies.runtime_minutes,0)::INTEGER runtime_minutes, COALESCE(ARRAY_REMOVE(ARRAY_AGG(genres.name),NULL),'{}') genre_names FROM watched_movies JOIN movies ON movies.id=watched_movies.movie_id LEFT JOIN LATERAL UNNEST(movies.genre_ids) selected_genre(tmdb_genre_id) ON TRUE LEFT JOIN genres ON genres.tmdb_genre_id=selected_genre.tmdb_genre_id WHERE watched_movies.user_id IN (SELECT id FROM selected_user) AND watched_movies.created_at >= date_trunc('year', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' GROUP BY watched_movies.id,movies.id
      UNION ALL
      SELECT 'tv'::TEXT, tv_seasons.tv_show_id::TEXT, watched_tv_episodes.watched_at, COALESCE(tv_episodes.runtime_minutes,0)::INTEGER, COALESCE(ARRAY_REMOVE(ARRAY_AGG(tv_genres.name),NULL),'{}') FROM watched_tv_episodes JOIN tv_episodes ON tv_episodes.id=watched_tv_episodes.tv_episode_id JOIN tv_seasons ON tv_seasons.id=tv_episodes.tv_season_id JOIN tv_shows ON tv_shows.id=tv_seasons.tv_show_id LEFT JOIN LATERAL UNNEST(tv_shows.genre_ids) selected_genre(tmdb_genre_id) ON TRUE LEFT JOIN tv_genres ON tv_genres.tmdb_genre_id=selected_genre.tmdb_genre_id WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user) AND watched_tv_episodes.watched_at >= date_trunc('year', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND tv_seasons.season_number > 0 GROUP BY watched_tv_episodes.id,tv_seasons.tv_show_id,tv_episodes.runtime_minutes
    ) SELECT * FROM events`, [username]),
    pool.query(`WITH selected_user AS (SELECT id FROM users WHERE username=$1 LIMIT 1) SELECT score::DOUBLE PRECISION score, GREATEST(created_at,updated_at) rated_at FROM movie_ratings WHERE user_id IN (SELECT id FROM selected_user) AND GREATEST(created_at,updated_at) >= date_trunc('year', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' UNION ALL SELECT tv_episode_ratings.score::DOUBLE PRECISION, GREATEST(tv_episode_ratings.created_at,tv_episode_ratings.updated_at) FROM tv_episode_ratings JOIN tv_episodes ON tv_episodes.id = tv_episode_ratings.tv_episode_id JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id WHERE tv_episode_ratings.user_id IN (SELECT id FROM selected_user) AND GREATEST(tv_episode_ratings.created_at,tv_episode_ratings.updated_at) >= date_trunc('year', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND tv_seasons.season_number > 0`, [username]),
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
            AND tv_seasons.season_number > 0
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
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
        WHERE watched_tv_episodes.user_id IN (SELECT id FROM selected_user)
          AND watched_tv_episodes.watched_at >= date_trunc($2, NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND watched_tv_episodes.watch_service IS NOT NULL
          AND tv_seasons.season_number > 0
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
          AND tv_seasons.season_number > 0
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

export async function listWatchedTvEpisodesForUser(pool, username) {
  const result = await pool.query(
    `
      SELECT
        tv_shows.tmdb_id AS show_id,
        tv_shows.name AS show_name,
        tv_shows.poster_path AS show_poster_path,
        tv_episodes.tmdb_id AS episode_id,
        tv_episodes.name AS episode_name,
        tv_seasons.season_number,
        tv_episodes.episode_number,
        watched_tv_episodes.watched_at
      FROM watched_tv_episodes
      JOIN users ON users.id = watched_tv_episodes.user_id
      JOIN tv_episodes ON tv_episodes.id = watched_tv_episodes.tv_episode_id
      JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
      JOIN tv_shows ON tv_shows.id = tv_seasons.tv_show_id
      WHERE users.username = $1 AND tv_seasons.season_number > 0
      ORDER BY watched_tv_episodes.watched_at DESC, watched_tv_episodes.id DESC
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
        WHERE (tv_episodes.air_date IS NULL OR tv_episodes.air_date <= CURRENT_DATE)
          AND tv_seasons.season_number > 0
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
        WHERE users.username = $1 AND tv_seasons.season_number > 0
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
          AND tv_seasons.season_number > 0
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
        (SELECT id FROM selected_show) AS entity_id, EXISTS(SELECT 1 FROM inserted) AS added, EXISTS(SELECT 1 FROM deleted) AS removed
    `,
    [username, showId]
  )
  const row = result.rows[0] ?? null
  if (!row?.has_user) return { status: 'missing_user' }
  if (!row.has_show) return { status: 'missing_show' }
  return { status: 'ok', entityId: Number(row.entity_id), added: Boolean(row.added), removed: Boolean(row.removed) }
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

export async function countBooks(pool) {
  const result = await pool.query(`
    SELECT COUNT(*)::INTEGER AS book_count
    FROM books
  `)

  return result.rows[0]?.book_count ?? 0
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
    FROM UNNEST(ARRAY['movies', 'books', 'genres', 'cast_members', 'movie_cast', 'users', 'watchlist_items', 'watched_movies']) AS table_name
    WHERE to_regclass(table_name) IS NOT NULL
  `)

  return Number(result.rows[0]?.stored_data_bytes ?? 0)
}
