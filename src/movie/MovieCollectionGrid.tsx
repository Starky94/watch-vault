import { useRef, type ComponentType } from 'react'
import type { GridConfig } from './movieCollections.ts'
import type { MovieCard, MovieCollectionState } from './movieTypes.ts'

interface CardProps {
  movie: MovieCard
  railKind?: string
  railIndex: number
  onOpenMovie: (movie: MovieCard) => void
  isWatched: boolean
  isInWatchlist: boolean
  onToggleWatchlist?: (movie: MovieCard) => void
  onToggleWatched?: (movie: MovieCard) => void
}

export interface MovieGridUi {
  MovieCard: ComponentType<CardProps>
  SectionMessage: ComponentType<{ message: string; tone?: 'error' | 'neutral' }>
  ChevronLeftIcon: ComponentType
  ChevronRightIcon: ComponentType
}

interface GridProps {
  config: GridConfig
  state: MovieCollectionState
  layout?: 'catalog' | 'slider'
  sort?: 'featured' | 'rating' | 'release'
  watchedMovieIds?: ReadonlySet<number>
  watchlistMovieIds?: ReadonlySet<number>
  onOpenMovie: (movie: MovieCard) => void
  onToggleWatchlist?: (movie: MovieCard) => void
  onToggleWatched?: (movie: MovieCard) => void
  ui: MovieGridUi
}

function sortRailCards(movies: MovieCard[], sort: GridProps['sort']): MovieCard[] {
  if (sort === 'rating') return [...movies].sort((left, right) => Number(right.rating) - Number(left.rating))
  if (sort === 'release') return [...movies].sort((left, right) => new Date(right.releaseDate || 0).getTime() - new Date(left.releaseDate || 0).getTime())
  return movies
}

function MoviePosterSkeletons() {
  return <div className="movie-card-grid popular-movies-slider movie-skeleton-grid" aria-label="Loading movies">
    {Array.from({ length: 5 }, (_, index) => <div className="movie-card movie-skeleton-card" key={index}><div className="movie-card-poster" /><div className="movie-card-copy"><i /><i /></div></div>)}
  </div>
}

export function MovieCollectionGrid({ config, state, layout = 'slider', sort = 'featured', watchedMovieIds = new Set(), watchlistMovieIds = new Set(), onOpenMovie, onToggleWatchlist, onToggleWatched, ui }: GridProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const { MovieCard, SectionMessage, ChevronLeftIcon, ChevronRightIcon } = ui

  if (state.status === 'loading' || state.status === 'idle') return <MoviePosterSkeletons />
  if (state.status === 'error') return <SectionMessage message={`Could not load ${config.errorLabel}. ${state.error}`} tone="error" />
  if (state.movies.length === 0) return <SectionMessage message={config.emptyMessage} />

  const movies = layout === 'catalog' ? state.movies : sortRailCards(state.movies.slice(0, 10), sort)
  const cards = movies.map((movie, index) => <MovieCard
    key={movie.id}
    movie={movie}
    railKind={config.railKind}
    railIndex={index}
    onOpenMovie={onOpenMovie}
    isWatched={watchedMovieIds.has(movie.id)}
    isInWatchlist={watchlistMovieIds.has(movie.id)}
    onToggleWatchlist={onToggleWatchlist}
    onToggleWatched={onToggleWatched}
  />)

  if (layout === 'catalog') return <div className="movie-card-grid popular-movies-catalog" aria-label={config.catalogLabel}>{cards}</div>

  const ariaLabel = config.railLabel || 'Movies'
  const scrollRail = (direction: number) => railRef.current?.scrollBy({ left: direction * Math.max(railRef.current.clientWidth * 0.8, 260), behavior: 'smooth' })
  return <div className="movie-rail-wrap">
    <div className="movie-rail-navigation" aria-label={`${ariaLabel} navigation`}>
      <button type="button" onClick={() => scrollRail(-1)} aria-label={`Previous ${ariaLabel}`}><ChevronLeftIcon /></button>
      <button type="button" onClick={() => scrollRail(1)} aria-label={`Next ${ariaLabel}`}><ChevronRightIcon /></button>
    </div>
    <div ref={railRef} className="movie-card-grid popular-movies-slider" aria-label={ariaLabel}>{cards}</div>
  </div>
}
