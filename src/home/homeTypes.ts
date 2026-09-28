import type { ComponentType } from 'react'

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error'
export type HomeKind = 'movie' | 'tv' | 'book'

interface HomeItemBase {
  id: string | number
  title: string
  year?: string
  meta?: string
  posterUrl?: string | null
  backdropUrl?: string | null
  theme?: string
  watchlistedAt?: string | null
  topSlot?: number | null
  queuePosition?: number | null
}

export interface HomeMovie extends HomeItemBase {
  kind: 'movie'
  rating?: number | string
  runtime?: string
  streamingService?: string
  genreLabel?: string
  subtitle?: string
}

export interface HomeTvShow extends HomeItemBase {
  kind: 'tv'
  rating?: number | string
  seasonMeta?: string
  runtime?: string
  streamingService?: string
  latestWatchedEpisodeLabel?: string
  watchedEpisodeCount?: number
  airedEpisodeCount?: number
  progress?: number
  nextEpisodeLabel?: string
  nextEpisodeTitle?: string
}

export interface HomeBook extends HomeItemBase {
  kind: 'book'
  coverUrl?: string | null
  authorsLabel?: string
  categoriesLabel?: string
}

export type HomeItem = HomeMovie | HomeTvShow | HomeBook
export type HomeSource = 'continue' | 'watchlist' | 'featured'
export type HomeQueueItem = {
  item: HomeItem
  source: HomeSource
  id: string | number
  watchlistedAt: string | null
  topSlot: number | null
  queuePosition: number | null
  artwork: { portrait: string | null; landscape: string | null }
  tonight: { reason: string; detail: string } | null
  nextUp: { kicker: string; detail: string; actionLabel: string } | null
}
export interface HomeQueue {
  continuing: HomeQueueItem | null
  watchlist: { movie: HomeQueueItem[]; tv: HomeQueueItem[]; book: HomeQueueItem[] }
  featured: HomeQueueItem | null
}
export type HomeWatchlistItem = HomeItem
export type TonightPick = (HomeMovie | HomeTvShow) & { reason: string; detail: string; artworkUrl: string | null }
export type NextUpItem = HomeItem & { kicker: string; detail: string; actionLabel: string; artworkUrl: string | null; featured?: boolean }

export interface CollectionState {
  status: LoadStatus
  error: string
  [key: string]: unknown
}
export interface HomeWatchlistState extends CollectionState {
  movies: Omit<HomeMovie, 'kind'>[]
  books: Omit<HomeBook, 'kind'>[]
}
export interface ContinueWatchingState extends CollectionState {
  shows: Omit<HomeTvShow, 'kind'>[]
}
export interface PopularMoviesState extends CollectionState {
  movies: Omit<HomeMovie, 'kind'>[]
  featuredMovie: Omit<HomeMovie, 'kind'> | null
}
export interface LatestEpisodesState extends CollectionState {
  shows: Omit<HomeTvShow, 'kind'>[]
  pagination: { page: number; pageSize: number; hasNextPage: boolean; hasPreviousPage: boolean }
}
export interface LatestEpisodeApi {
  id: number
  title: string
  popularity?: number | null
  posterUrl?: string | null
  backdropUrl?: string | null
  latestEpisode?: { seasonNumber?: number; episodeNumber?: number; airDate?: string | null; title?: string | null } | null
}
export interface MovieRowApi {
  tmdb_id: number
  title: string
  release_date?: string | null
  vote_average?: number | null
  poster_path?: string | null
  [key: string]: unknown
}
export interface FeaturedMovieApi {
  id: number
  title: string
  year?: string | null
  genres?: string[] | null
  rating?: string | null
  runtime?: string | null
  score?: string | null
  audience?: string | null
  summary?: string | null
  posterPath?: string | null
  backdropPath?: string | null
}
export interface PopularMoviesApi {
  movies?: MovieRowApi[]
  featuredMovie?: FeaturedMovieApi | null
}

export interface HomeUser { fullName?: string; [key: string]: unknown }
export interface HomeStatsItem { label: string; value: string | number; tone: string; icon: ComponentType }
export interface HomeInputData {
  seasonalTheme: { emoji: string; name: string } | null
  stats: HomeStatsItem[]
  statsPeriod: string
  watchlistState: HomeWatchlistState
  continueWatchingState: ContinueWatchingState
  tvWatchlistShows: Omit<HomeTvShow, 'kind'>[]
  tvWatchlistIds: Set<number>
  tvWatchedIds: Set<number>
  watchlistMovieIds: Set<number>
  watchedMovieIds: Set<number>
  readBookIds: Set<string | number>
}
export interface HomeActions {
  onOpenMovie: (item: HomeMovie) => void
  onOpenPopularMovies: () => void
  onOpenWatchlist: () => void
  onOpenDiscover: () => void
  onOpenSeasonalMovies: () => void
  onStatsPeriodChange: (period: string) => void
  onOpenContinueWatching: () => void
  onOpenTvShow: (item: HomeTvShow) => void
  onOpenBook: (item: HomeBook) => void
  onOpenLatestEpisodes: () => void
  onToggleMovieWatchlist: (item: HomeMovie) => void
  onToggleMovieWatched: (item: HomeMovie) => void
  onToggleTvWatchlist: (item: HomeTvShow) => void
  onToggleBookWatchlist: (item: HomeBook) => void
  onToggleBookRead: (item: HomeBook) => void
  openTonightPick: () => void
}
export interface HomeViewData extends HomeInputData {
  user: HomeUser | null
  popularMoviesState: PopularMoviesState
  latestEpisodesState: LatestEpisodesState
  homeWatchlistItems: HomeWatchlistItem[]
  nextUpItems: NextUpItem[]
  trendingMovies: HomeMovie[]
  tonightPick: TonightPick | null
}

// These UI components still live in App.jsx; their data and action props are typed above.
export interface HomeUi {
  SparklesIcon: ComponentType
  ClockIcon: ComponentType
  PlayIcon: ComponentType
  BookmarkIcon: ComponentType
  ClapperIcon: ComponentType
  TvIcon: ComponentType
  ChevronRight: ComponentType
  StatsPanel: ComponentType<any>
  ContentSection: ComponentType<any>
  ProgressCard: ComponentType<any>
  RatingCard: ComponentType<any>
  HomeWatchlistCard: ComponentType<any>
  TvShowsGrid: ComponentType<any>
  SectionMessage: ComponentType<any>
  getFirstName: (name?: string) => string
  getSeasonalThemeLabel: (theme: NonNullable<HomeInputData['seasonalTheme']>) => string
}
