import { ensureMoviesTable, ensureTvDetailTables } from './database.js'

export async function createFavoriteActorAlertsForNewMovies(pool, movieIds) {
  if (!Array.isArray(movieIds) || movieIds.length === 0) return 0

  const result = await pool.query(
    `
      INSERT INTO user_alerts (user_id, kind, source_key, movie_id, title, message)
      SELECT
        favorites.user_id,
        'favorite_actor_movie',
        CONCAT('favorite-actor:', favorites.user_id, ':', movies.id),
        movies.id,
        movies.title,
        CONCAT('New import featuring your favorite actor, ', MIN(cast_members.name), '.')
      FROM movies
      JOIN movie_cast ON movie_cast.movie_id = movies.id AND movie_cast.credit_type = 'actor'
      JOIN cast_members ON cast_members.id = movie_cast.cast_member_id
      JOIN favorite_actors favorites ON favorites.cast_member_id = cast_members.id
      WHERE movies.id = ANY($1::BIGINT[])
      GROUP BY favorites.user_id, movies.id, movies.title
      ON CONFLICT (source_key) DO NOTHING
    `,
    [movieIds]
  )

  return result.rowCount ?? 0
}

export async function dispatchReleaseAlerts(pool) {
  await ensureMoviesTable(pool)
  await ensureTvDetailTables(pool)

  const [movieResult, episodeResult] = await Promise.all([
    pool.query(`
      INSERT INTO user_alerts (user_id, kind, source_key, movie_id, title, message)
      SELECT
        users.id,
        'watchlist_movie_release',
        CONCAT('movie-release:', users.id, ':', movies.id),
        movies.id,
        movies.title,
        'A movie in your watchlist releases today.'
      FROM watchlist_items
      JOIN users ON users.id = watchlist_items.user_id
      JOIN movies ON movies.id = watchlist_items.movie_id
      CROSS JOIN alert_feature_state
      WHERE movies.release_date = (NOW() AT TIME ZONE COALESCE(users.alert_timezone, 'UTC'))::DATE
        AND (alert_feature_state.activated_at AT TIME ZONE COALESCE(users.alert_timezone, 'UTC'))::DATE
          < (NOW() AT TIME ZONE COALESCE(users.alert_timezone, 'UTC'))::DATE
      ON CONFLICT (source_key) DO NOTHING
    `),
    pool.query(`
      WITH eligible_shows AS (
        SELECT user_id, tv_show_id FROM tv_watchlist_items
        UNION
        SELECT watched_tv_episodes.user_id, tv_seasons.tv_show_id
        FROM watched_tv_episodes
        JOIN tv_episodes ON tv_episodes.id = watched_tv_episodes.tv_episode_id
        JOIN tv_seasons ON tv_seasons.id = tv_episodes.tv_season_id
      )
      INSERT INTO user_alerts (user_id, kind, source_key, tv_show_id, tv_episode_id, title, message)
      SELECT
        users.id,
        'tv_episode_release',
        CONCAT('episode-release:', users.id, ':', tv_episodes.id),
        tv_shows.id,
        tv_episodes.id,
        tv_shows.name,
        CONCAT('New episode released: S', tv_seasons.season_number, ' E', tv_episodes.episode_number, CASE WHEN tv_episodes.name <> '' THEN CONCAT(' — ', tv_episodes.name) ELSE '' END)
      FROM eligible_shows
      JOIN users ON users.id = eligible_shows.user_id
      JOIN tv_shows ON tv_shows.id = eligible_shows.tv_show_id
      JOIN tv_seasons ON tv_seasons.tv_show_id = tv_shows.id
      JOIN tv_episodes ON tv_episodes.tv_season_id = tv_seasons.id
      CROSS JOIN alert_feature_state
      WHERE tv_episodes.air_date = (NOW() AT TIME ZONE COALESCE(users.alert_timezone, 'UTC'))::DATE
        AND (alert_feature_state.activated_at AT TIME ZONE COALESCE(users.alert_timezone, 'UTC'))::DATE
          < (NOW() AT TIME ZONE COALESCE(users.alert_timezone, 'UTC'))::DATE
      ON CONFLICT (source_key) DO NOTHING
    `),
  ])

  return {
    movieReleaseCount: movieResult.rowCount ?? 0,
    episodeReleaseCount: episodeResult.rowCount ?? 0,
  }
}
