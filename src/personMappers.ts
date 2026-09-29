import type { PersonCoStar, PersonCredit, PersonCreditApi, PersonDetail, PersonDetailApi, PersonFilmographyCredit, PersonFilmographyCreditApi, PersonHistory, PersonHistoryApi } from './movie/movieTypes.ts'

export function mapPersonDetailPayload(person: PersonDetailApi): PersonDetail {
  return {
    id: person.id,
    name: person.name,
    biography: person.biography || 'Biography not available yet.',
    profileUrl: person.profileUrl || null,
    knownForDepartment: person.knownForDepartment || 'Performer',
    roles: Array.isArray(person.roles) ? person.roles : [],
    heroBackdropUrl: person.heroBackdropUrl || null,
  }
}

export function mapPersonPreview(person: { id: number; name: string; role?: string | null; profileUrl?: string | null }): PersonDetail {
  return {
    id: person.id,
    name: person.name,
    biography: person.role ? `${person.role} in your WatchVault credits.` : 'Biography not available yet.',
    profileUrl: person.profileUrl || null,
    knownForDepartment: person.role || 'Performer',
    roles: person.role ? [person.role] : [],
    heroBackdropUrl: null,
  }
}

export function mapPersonMovieCredit(movie: PersonCreditApi): PersonCredit {
  return {
    id: movie.id,
    mediaType: movie.mediaType === 'tv' ? 'tv' : 'movie',
    title: movie.title,
    year: movie.year || 'Release TBA',
    rating: movie.rating || 'N/A',
    meta: movie.meta || 'Credit',
    knownForReason: movie.knownForReason || 'Popular credit',
    posterUrl: movie.posterUrl || null,
    backdropUrl: movie.backdropUrl || null,
    theme: 'theme-catalog',
  }
}

export function mapPersonCoStar(person: { id: number; name: string; profileUrl?: string | null; sharedCredits?: number | null; sharedTitles?: string[] | null }): PersonCoStar {
  return {
    id: person.id,
    name: person.name,
    profileUrl: person.profileUrl || null,
    sharedCredits: person.sharedCredits || 0,
    sharedTitles: Array.isArray(person.sharedTitles) ? person.sharedTitles : [],
  }
}

function nullablePersonNumber(value: number | string | null | undefined): number | null {
  return value === null || value === undefined || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) ? null : Number(value)
}

export function mapPersonFilmographyRow(movie: PersonFilmographyCreditApi): PersonFilmographyCredit {
  return {
    id: movie.id,
    title: movie.title || '',
    year: movie.year || 'Release TBA',
    mediaType: movie.mediaType === 'tv' ? 'tv' : 'movie',
    releaseDate: movie.releaseDate || null,
    decade: movie.decade || null,
    role: movie.role || 'Credit',
    creditCategories: Array.isArray(movie.creditCategories) ? movie.creditCategories : [],
    popularity: nullablePersonNumber(movie.popularity),
    voteAverage: nullablePersonNumber(movie.voteAverage),
    rating: movie.rating || 'N/A',
    posterUrl: movie.posterUrl || null,
    personal: {
      watchlisted: Boolean(movie.personal?.watchlisted),
      watched: Boolean(movie.personal?.watched),
      yourScore: nullablePersonNumber(movie.personal?.yourScore),
      ratingCount: Number(movie.personal?.ratingCount) || 0,
    },
    theme: 'theme-catalog',
  }
}

export function mapPersonHistoryPayload(history: PersonHistoryApi | null | undefined): PersonHistory | null {
  if (!history || typeof history !== 'object') return null
  const next = history.nextRecommendation
  return {
    titlesWatched: Number(history.titlesWatched) || 0,
    averageRating: nullablePersonNumber(history.averageRating),
    hoursWatched: Number(history.hoursWatched) || 0,
    nextRecommendation: next && Number.isInteger(Number(next.id)) ? mapPersonFilmographyRow(next) : null,
  }
}

export interface FilmographySelection {
  role: string
  media: 'all' | 'movie' | 'tv'
  decade: string
  sort: 'popular' | 'newest' | 'rated' | 'oldest' | 'unwatched'
  isSignedIn: boolean
}

export function selectPersonFilmography(filmography: PersonFilmographyCredit[], { role, media, decade, sort, isSignedIn }: FilmographySelection): PersonFilmographyCredit[] {
  const date = (item: PersonFilmographyCredit) => Date.parse(item.releaseDate || '') || 0
  const numeric = (value: number | null) => value ?? -1
  return filmography
    .filter((item) => role === 'all' || item.creditCategories.includes(role))
    .filter((item) => media === 'all' || item.mediaType === media)
    .filter((item) => decade === 'all' || item.decade === decade)
    .sort((left, right) => {
      if (sort === 'newest') return date(right) - date(left) || numeric(right.popularity) - numeric(left.popularity)
      if (sort === 'oldest') return date(left) - date(right) || numeric(right.popularity) - numeric(left.popularity)
      if (sort === 'rated') return numeric(right.voteAverage) - numeric(left.voteAverage) || date(right) - date(left)
      if (sort === 'unwatched' && isSignedIn) return Number(left.personal.watched) - Number(right.personal.watched) || date(right) - date(left)
      return numeric(right.popularity) - numeric(left.popularity) || date(right) - date(left)
    })
}
