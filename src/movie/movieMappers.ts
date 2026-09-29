import type { CommunityRating, FeaturedMovie, FeaturedMovieApi, MovieCard, MovieDetail, MovieDetailApi, MoviePreview, MovieRowApi } from './movieTypes.ts'
import { formatLongDate, formatMovieRating, formatMovieYear, formatTomatoScore, formatVoteCount, resolveMovieBackdropUrl, resolveMoviePosterUrl } from './movieFormatting.ts'

function mapStoredMovieDisplay(movie: MovieRowApi): MovieCard {
  return {
    id: movie.tmdb_id,
    title: movie.title,
    year: formatMovieYear(movie.release_date),
    rating: formatMovieRating(movie.vote_average),
    posterUrl: resolveMoviePosterUrl(movie.poster_path),
    certification: movie.certification || 'NR',
  }
}

export function mapMovieRowToCard(movie: MovieRowApi): MovieCard {
  return {
    ...mapStoredMovieDisplay(movie),
    meta: typeof movie.vote_count === 'number' ? formatVoteCount(movie.vote_count) : 'From local DB',
    releaseDate: movie.release_date || null,
    theme: 'theme-catalog',
  }
}

export function mapMovieRowToSimilarCard(movie: MovieRowApi): MovieCard {
  return mapStoredMovieDisplay(movie)
}

export function mapFeaturedMoviePayload(movie: FeaturedMovieApi): FeaturedMovie {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || 'Release TBA',
    genreLabel: Array.isArray(movie.genres) && movie.genres.length > 0 ? movie.genres.join(', ') : 'Genre TBA',
    certification: movie.rating || 'NR',
    runtime: movie.runtime || 'Runtime TBA',
    score: movie.score || 'N/A',
    audience: movie.audience || 'No votes',
    summary: movie.summary || 'Overview not available yet.',
    posterUrl: resolveMoviePosterUrl(movie.posterPath),
    backdropUrl: resolveMovieBackdropUrl(movie.backdropPath),
  }
}

export function mapCommunityRatingPayload(communityRating?: Partial<CommunityRating> | null): CommunityRating {
  const voteCount = communityRating?.voteCount
  return {
    average: typeof communityRating?.average === 'number' ? communityRating.average : null,
    voteCount: typeof voteCount === 'number' && Number.isInteger(voteCount) ? voteCount : 0,
    yourScore: typeof communityRating?.yourScore === 'number' ? communityRating.yourScore : null,
  }
}

export function mapMovieDetailPayload(movie: MovieDetailApi): MovieDetail {
  const genres = Array.isArray(movie.genres) ? movie.genres : []
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || 'Release TBA',
    overview: movie.overview || 'Overview not available yet.',
    genres,
    genresLabel: genres.length > 0 ? genres.join(', ') : 'Genre TBA',
    certification: movie.certification || 'NR',
    runtime: movie.runtime || 'Runtime TBA',
    score: movie.score || 'N/A',
    tomatoScore: formatTomatoScore(movie.score),
    audience: movie.audience || 'No votes',
    originalLanguage: movie.originalLanguage || 'Unknown',
    releaseDate: movie.releaseDate || null,
    releaseDateLabel: formatLongDate(movie.releaseDate),
    availability: movie.availability || 'Availability TBA',
    hasReleaseReminder: Boolean(movie.hasReleaseReminder),
    posterUrl: movie.posterUrl || null,
    backdropUrl: movie.backdropUrl || null,
    director: movie.director || null,
    cast: Array.isArray(movie.cast) ? movie.cast : [],
    reviews: Array.isArray(movie.reviews) ? movie.reviews : [],
    communityRating: mapCommunityRatingPayload(movie.communityRating),
  }
}

export function mapMoviePreviewToDetail(movie: MoviePreview): MovieDetail {
  const genres = movie.genreLabel ? movie.genreLabel.split(',').map((genre) => genre.trim()).filter(Boolean) : []
  const rating = String(movie.rating ?? '')
  const cardScore = /^\d+(?:\.\d+)?(?:\/10)?$/.test(rating)
    ? rating.endsWith('/10') ? rating : `${rating}/10`
    : null

  return mapMovieDetailPayload({
    ...movie,
    overview: movie.summary || movie.overview || 'Overview not available yet.',
    genres,
    certification: movie.certification || 'NR',
    score: movie.score || cardScore || 'N/A',
  })
}
