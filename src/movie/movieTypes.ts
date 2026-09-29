export interface Pagination {
  page: number
  pageSize: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface MovieRowApi {
  tmdb_id: number
  title: string
  release_date?: string | null
  vote_average?: number | null
  vote_count?: number | null
  poster_path?: string | null
  certification?: string | null
}

export interface MovieCard {
  id: number
  title: string
  year: string
  rating: string
  posterUrl: string | null
  certification: string
  meta?: string
  releaseDate?: string | null
  theme?: string
}

export interface FeaturedMovieApi {
  id: number
  title: string
  year?: string | null
  genres?: string[] | null
  /** The featured endpoint calls the certification "rating". */
  rating?: string | null
  runtime?: string | null
  score?: string | null
  audience?: string | null
  summary?: string | null
  posterPath?: string | null
  backdropPath?: string | null
}

export interface FeaturedMovie {
  id: number
  title: string
  year: string
  genreLabel: string
  certification: string
  runtime: string
  score: string
  audience: string
  summary: string
  posterUrl: string | null
  backdropUrl: string | null
}

export interface CommunityRating {
  average: number | null
  voteCount: number
  yourScore: number | null
}

export interface MovieCredit {
  id: number
  name: string
  role?: string
  profileUrl: string | null
  order?: number | null
}

export interface MovieReview {
  id: string
  author: string
  rating: string | null
  date: string
  copy: string
  url?: string | null
}

export interface MovieDetailApi {
  id: number
  title: string
  year?: string | null
  overview?: string | null
  genres?: string[] | null
  certification?: string | null
  runtime?: string | null
  score?: string | null
  audience?: string | null
  originalLanguage?: string | null
  releaseDate?: string | null
  availability?: string | null
  hasReleaseReminder?: boolean
  posterUrl?: string | null
  backdropUrl?: string | null
  director?: MovieCredit | null
  cast?: MovieCredit[] | null
  reviews?: MovieReview[] | null
  communityRating?: Partial<CommunityRating> | null
}

export interface MovieDetail {
  id: number
  title: string
  year: string
  overview: string
  genres: string[]
  genresLabel: string
  certification: string
  runtime: string
  score: string
  tomatoScore: string
  audience: string
  originalLanguage: string
  releaseDate: string | null
  releaseDateLabel: string
  availability: string
  hasReleaseReminder: boolean
  posterUrl: string | null
  backdropUrl: string | null
  director: MovieCredit | null
  cast: MovieCredit[]
  reviews: MovieReview[]
  communityRating: CommunityRating
}

export interface MoviePreview {
  id: number
  title: string
  year?: string
  rating?: string | number
  score?: string
  certification?: string
  genreLabel?: string
  summary?: string
  overview?: string
  runtime?: string
  audience?: string
  originalLanguage?: string
  releaseDate?: string | null
  posterUrl?: string | null
  backdropUrl?: string | null
}

export type MovieCollectionState =
  | { status: 'idle' | 'loading'; movies: MovieCard[]; pagination: Pagination; featuredMovie?: FeaturedMovie | null; error: '' }
  | { status: 'success'; movies: MovieCard[]; pagination: Pagination; featuredMovie?: FeaturedMovie | null; error: '' }
  | { status: 'error'; movies: MovieCard[]; pagination: Pagination; featuredMovie?: FeaturedMovie | null; error: string }

export type MovieDetailState =
  | { status: 'idle' | 'hidden' | 'loading'; movie: MovieDetail | null; error: '' }
  | { status: 'success'; movie: MovieDetail; error: '' }
  | { status: 'error'; movie: null; error: string }

export interface PersonFilmographyCreditApi {
  id: number
  title?: string
  year?: string | null
  mediaType?: string
  releaseDate?: string | null
  decade?: string | null
  role?: string | null
  creditCategories?: string[] | null
  popularity?: number | string | null
  voteAverage?: number | string | null
  rating?: string | null
  posterUrl?: string | null
  personal?: { watchlisted?: boolean; watched?: boolean; yourScore?: number | string | null; ratingCount?: number | null } | null
}

export interface PersonFilmographyCredit {
  id: number
  title: string
  year: string
  mediaType: 'movie' | 'tv'
  releaseDate: string | null
  decade: string | null
  role: string
  creditCategories: string[]
  popularity: number | null
  voteAverage: number | null
  rating: string
  posterUrl: string | null
  personal: { watchlisted: boolean; watched: boolean; yourScore: number | null; ratingCount: number }
  theme: 'theme-catalog'
}

export interface PersonHistoryApi {
  titlesWatched?: number | null
  averageRating?: number | string | null
  hoursWatched?: number | null
  nextRecommendation?: PersonFilmographyCreditApi | null
}

export interface PersonHistory {
  titlesWatched: number
  averageRating: number | null
  hoursWatched: number
  nextRecommendation: PersonFilmographyCredit | null
}

export interface PersonDetailApi {
  id: number
  name: string
  biography?: string | null
  profileUrl?: string | null
  knownForDepartment?: string | null
  roles?: string[] | null
  heroBackdropUrl?: string | null
}

export interface PersonDetail {
  id: number
  name: string
  biography: string
  profileUrl: string | null
  knownForDepartment: string
  roles: string[]
  heroBackdropUrl: string | null
}

export interface PersonCreditApi {
  id: number
  mediaType?: string
  title: string
  year?: string | null
  rating?: string | null
  meta?: string | null
  knownForReason?: string | null
  posterUrl?: string | null
  backdropUrl?: string | null
}

export interface PersonCredit {
  id: number
  mediaType: 'tv' | 'movie'
  title: string
  year: string
  rating: string
  meta: string
  knownForReason: string
  posterUrl: string | null
  backdropUrl: string | null
  theme: 'theme-catalog'
}

export interface PersonCoStar {
  id: number
  name: string
  profileUrl: string | null
  sharedCredits: number
  sharedTitles: string[]
}

export interface PersonFact { label: string; value: string }

export type PersonDetailState =
  | { status: 'idle' | 'hidden' | 'loading'; person: PersonDetail | null; knownFor: PersonCredit[]; filmography: PersonFilmographyCredit[]; coStars: PersonCoStar[]; facts: PersonFact[]; personalHistory: PersonHistory | null; error: '' }
  | { status: 'success'; person: PersonDetail; knownFor: PersonCredit[]; filmography: PersonFilmographyCredit[]; coStars: PersonCoStar[]; facts: PersonFact[]; personalHistory: PersonHistory | null; error: '' }
  | { status: 'error'; person: null; knownFor: PersonCredit[]; filmography: PersonFilmographyCredit[]; coStars: PersonCoStar[]; facts: PersonFact[]; personalHistory: null; error: string }

export type MediaDetailRoute = { kind: 'movieDetail'; movieId: number } | { kind: 'personDetail'; personId: number }

export function readMediaDetailRoute(pathname: string): MediaDetailRoute | null {
  const movie = pathname.match(/^\/movies\/(\d+)\/?$/)
  if (movie) return { kind: 'movieDetail', movieId: Number(movie[1]) }
  const person = pathname.match(/^\/people\/(\d+)\/?$/)
  if (person) return { kind: 'personDetail', personId: Number(person[1]) }
  return null
}
