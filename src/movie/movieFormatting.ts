export function formatMovieYear(releaseDate?: string | null): string {
  return releaseDate ? String(releaseDate).slice(0, 4) : 'Release TBA'
}

export function formatMovieRating(voteAverage?: number | null): string {
  return typeof voteAverage === 'number' ? voteAverage.toFixed(1) : 'N/A'
}

export function formatVoteCount(voteCount: number): string {
  return voteCount >= 1000 ? `${(voteCount / 1000).toFixed(1)}k votes` : `${voteCount} votes`
}

export function formatTomatoScore(score?: string | null): string {
  const match = score?.match(/^(\d+(?:\.\d+)?)\/10$/)
  return match ? `${Math.round(Number.parseFloat(match[1]) * 10)}%` : 'N/A'
}

export function formatLongDate(releaseDate?: string | null): string {
  if (!releaseDate) return 'Release TBA'
  const value = releaseDate.includes('T') ? releaseDate : `${releaseDate}T00:00:00.000Z`
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return 'Release TBA'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsedDate)
}

export function resolveMoviePosterUrl(posterPath?: string | null): string | null {
  return posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null
}

export function resolveMovieBackdropUrl(backdropPath?: string | null): string | null {
  return backdropPath ? `https://image.tmdb.org/t/p/w780${backdropPath}` : null
}
