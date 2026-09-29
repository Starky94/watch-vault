import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { requestJson } from '../collectionLoader.js'
import { mapFeaturedMoviePayload, mapMovieRowToCard } from './movieMappers.ts'
import type { FeaturedMovieApi, MovieCollectionState, MovieRowApi, Pagination } from './movieTypes.ts'

export const movieScreenModes = {
  overview: 'overview', popularList: 'popularList', nowPlayingList: 'nowPlayingList',
  topRatedList: 'topRatedList', upcomingList: 'upcomingList', genreList: 'genreList',
} as const

type MovieScreenMode = typeof movieScreenModes[keyof typeof movieScreenModes]
type MovieCatalogSort = 'featured' | 'rating' | 'release'
interface CollectionConfig { path: string; screenMode: MovieScreenMode; featured?: boolean; errorMessage: string }

export const movieCollectionConfigs = {
  popular: { path: '/api/movies', screenMode: movieScreenModes.popularList, featured: true, errorMessage: 'Unable to load movies right now.' },
  upcoming: { path: '/api/movies/upcoming', screenMode: movieScreenModes.upcomingList, errorMessage: 'Unable to load upcoming movies right now.' },
  recent: { path: '/api/movies/recently-released', screenMode: movieScreenModes.nowPlayingList, errorMessage: 'Unable to load recently released movies right now.' },
  topRated: { path: '/api/movies/top-rated', screenMode: movieScreenModes.topRatedList, errorMessage: 'Unable to load top rated movies right now.' },
  genre: { path: '/api/movies', screenMode: movieScreenModes.genreList, errorMessage: 'Unable to load genre movies right now.' },
} satisfies Record<string, CollectionConfig>

export interface GridConfig {
  screenMode: MovieScreenMode
  tab?: string
  title?: string
  overviewTitle?: string
  description?: string
  railLabel?: string
  catalogLabel?: string
  railKind?: string
  errorLabel: string
  emptyMessage: string
}

export const movieGridConfigs = {
  popular: { screenMode: movieScreenModes.popularList, tab: 'Popular', title: 'Popular Right Now', description: 'Browse popular movies imported from your local database, 30 titles at a time.', railLabel: 'Popular movies', catalogLabel: 'Popular movies list', railKind: 'popular', errorLabel: 'popular movies', emptyMessage: 'No movies are available in the local database yet.' },
  recent: { screenMode: movieScreenModes.nowPlayingList, tab: 'Now Playing', title: 'Now Playing', overviewTitle: 'Recently Released', description: 'Browse recently released movies from your local database, 30 titles at a time.', railLabel: 'Recently released movies', catalogLabel: 'Now playing movies list', railKind: 'recent', errorLabel: 'recently released movies', emptyMessage: 'No recently released movies are available in the local database yet.' },
  upcoming: { screenMode: movieScreenModes.upcomingList, tab: 'Upcoming', title: 'Upcoming Soon', description: 'Browse upcoming releases from the next 30 days, 30 titles at a time.', railLabel: 'Upcoming movies', catalogLabel: 'Upcoming movies list', railKind: 'upcoming', errorLabel: 'upcoming movies', emptyMessage: 'No upcoming movies are available in the local database yet.' },
  topRated: { screenMode: movieScreenModes.topRatedList, tab: 'Top Rated', title: 'Top Rated', description: 'Browse top rated movies ordered by score, 30 titles at a time.', railLabel: 'Top rated movies', catalogLabel: 'Top rated movies list', railKind: 'top-rated', errorLabel: 'top rated movies', emptyMessage: 'No top rated movies are available in the local database yet.' },
  genre: { screenMode: movieScreenModes.genreList, errorLabel: 'genre movies', emptyMessage: 'No movies in this genre are available in the local database yet.' },
} satisfies Record<string, GridConfig>

const moviePageSize = 30

function paginationState(page = 1): Pagination {
  return { page, pageSize: moviePageSize, hasNextPage: false, hasPreviousPage: page > 1 }
}

function readPagination(value: unknown, fallbackPage: number): Pagination {
  if (!value || typeof value !== 'object') return paginationState(fallbackPage)
  const pagination = value as Partial<Pagination>
  return {
    page: typeof pagination.page === 'number' && Number.isInteger(pagination.page) && pagination.page > 0 ? pagination.page : fallbackPage,
    pageSize: typeof pagination.pageSize === 'number' && Number.isInteger(pagination.pageSize) && pagination.pageSize > 0 ? pagination.pageSize : moviePageSize,
    hasNextPage: Boolean(pagination.hasNextPage),
    hasPreviousPage: Boolean(pagination.hasPreviousPage),
  }
}

export function createMovieCollectionState({ includeFeaturedMovie = false } = {}): MovieCollectionState {
  return { status: 'idle', movies: [], pagination: paginationState(), ...(includeFeaturedMovie ? { featuredMovie: null } : {}), error: '' }
}

interface CollectionOptions {
  activeView: string
  screenMode: MovieScreenMode
  hideWatchedMovies: boolean
  user: object | null
  watchedMovies: readonly unknown[]
  page: number
  setState: Dispatch<SetStateAction<MovieCollectionState>>
  genreName?: string
  catalogSort: MovieCatalogSort
}

interface MovieCollectionApi { movies?: MovieRowApi[]; featuredMovie?: FeaturedMovieApi | null; pagination?: unknown }

function isMovieRow(value: unknown): value is MovieRowApi {
  return Boolean(value && typeof value === 'object' && typeof (value as MovieRowApi).tmdb_id === 'number' && typeof (value as MovieRowApi).title === 'string')
}

function isFeaturedMovie(value: unknown): value is FeaturedMovieApi {
  return Boolean(value && typeof value === 'object' && typeof (value as FeaturedMovieApi).id === 'number' && typeof (value as FeaturedMovieApi).title === 'string')
}

export async function loadMovieCollectionData(url: string, page: number, config: CollectionConfig, fetchRequest: typeof fetch = fetch): Promise<MovieCollectionState> {
  try {
    const response = await requestJson(url, undefined, fetchRequest)
    const payload = response && typeof response === 'object' ? response as MovieCollectionApi : {}
    return {
      status: 'success',
      movies: Array.isArray(payload.movies) ? payload.movies.filter(isMovieRow).map(mapMovieRowToCard) : [],
      pagination: readPagination(payload.pagination, page),
      ...(config.featured ? { featuredMovie: isFeaturedMovie(payload.featuredMovie) ? mapFeaturedMoviePayload(payload.featuredMovie) : null } : {}),
      error: '',
    }
  } catch (error) {
    return {
      status: 'error', movies: [], pagination: paginationState(page),
      ...(config.featured ? { featuredMovie: null } : {}),
      error: error instanceof Error ? error.message : config.errorMessage,
    }
  }
}

export function useMovieCollection(config: CollectionConfig, { activeView, screenMode, hideWatchedMovies, user, watchedMovies, page, setState, genreName, catalogSort }: CollectionOptions): void {
  const enabled = activeView === 'Movies' && (config.screenMode !== movieScreenModes.genreList || (screenMode === movieScreenModes.genreList && Boolean(genreName)))
  const hideWatched = Boolean(user) && hideWatchedMovies && screenMode === config.screenMode
  const watchedFilterVersion = hideWatched ? watchedMovies : null
  const sort = screenMode === config.screenMode ? catalogSort : 'featured'

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const loadingState: MovieCollectionState = {
      status: 'loading', movies: [], pagination: paginationState(page),
      ...(config.featured ? { featuredMovie: null } : {}), error: '',
    }
    setState(loadingState)

    const params = new URLSearchParams({ page: String(page), limit: String(moviePageSize), sort })
    if (genreName) params.set('genre', genreName)
    if (hideWatched) params.set('hideWatched', 'true')

    void loadMovieCollectionData(`${config.path}?${params.toString()}`, page, config).then((state) => {
      if (cancelled) return
      setState(state)
    })
    return () => { cancelled = true }
  }, [config, enabled, genreName, hideWatched, page, setState, sort, watchedFilterVersion])
}
