import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { defaultThemeKey, seasonalThemes } from '../shared/themes.js'
import { applyActiveTheme, readCachedActiveTheme } from './theme.js'

const primaryViews = {
  home: 'Home',
  movies: 'Movies',
  books: 'Books',
  games: 'Games',
  tvShows: 'TV Shows',
  news: 'News',
  watchlist: 'Watchlist',
  calendar: 'Calendar',
  stats: 'Stats',
  achievements: 'Achievements',
  watchTogether: 'Watch Together',
}

const navItems = [
  { label: 'Home', icon: HomeIcon, view: primaryViews.home },
  { label: 'Movies', icon: ClapperIcon, view: primaryViews.movies },
  { label: 'Books', icon: BookmarkIcon, view: primaryViews.books },
  { label: 'Games', icon: GamepadIcon, view: primaryViews.games },
  { label: 'TV Shows', icon: TvIcon, view: primaryViews.tvShows },
  { label: 'News', icon: NewsIcon, view: primaryViews.news },
  { label: 'Watchlist', icon: BookmarkIcon, view: primaryViews.watchlist },
  { label: 'Calendar', icon: CalendarIcon, view: primaryViews.calendar },
  { label: 'Stats', icon: BarsIcon, view: primaryViews.stats },
  { label: 'Achievements', icon: TrophyIcon, view: primaryViews.achievements },
  { label: 'Watch Together', icon: UserIcon, view: primaryViews.watchTogether },
]

const defaultEnabledSections = ['movies', 'tv', 'books', 'games', 'calendar']
const requiredEnabledSections = ['movies', 'tv']
const sectionByPrimaryView = {
  [primaryViews.movies]: 'movies',
  [primaryViews.tvShows]: 'tv',
  [primaryViews.books]: 'books',
  [primaryViews.games]: 'games',
  [primaryViews.calendar]: 'calendar',
}

const movieTabs = ['All Movies', 'Popular', 'Now Playing', 'Upcoming', 'Top Rated']
const statsTabs = [
  { label: 'Overview' },
  { label: 'Movies', section: 'movies' },
  { label: 'TV Shows', section: 'tv' },
  { label: 'Games', section: 'games' },
  { label: 'Books', section: 'books' },
  { label: 'Book stats', section: 'books' },
  { label: 'Book achievements', section: 'books' },
  { label: 'Game achievements', section: 'games' },
  { label: 'Achievements' },
]
const movieScreenModes = {
  overview: 'overview',
  popularList: 'popularList',
  nowPlayingList: 'nowPlayingList',
  topRatedList: 'topRatedList',
  upcomingList: 'upcomingList',
  genreList: 'genreList',
}

const appScreens = {
  dashboard: 'dashboard',
  admin: 'admin',
  login: 'login',
  account: 'account',
}

const routeKinds = {
  home: 'home',
  stats: 'stats',
  search: 'search',
  discover: 'discover',
  news: 'news',
  seasonalMovies: 'seasonalMovies',
  continueWatching: 'continueWatching',
  calendar: 'calendar',
  watchlist: 'watchlist',
  movieDetail: 'movieDetail',
  tvDetail: 'tvDetail',
  bookDetail: 'bookDetail',
  authorDetail: 'authorDetail',
  personDetail: 'personDetail',
  gameDetail: 'gameDetail',
}

const authStorageKey = 'watchvault.auth.user'
const recentSearchesStorageKey = 'watchvault.search.recent'
const maxRecentSearches = 8
const adminRunIdleState = {
  status: 'idle',
  message: '',
}

const watchlistAccentOptions = ['gold', 'violet', 'silver']

const tvShowTabs = ['All Shows', 'Popular', 'Airing Now', 'Upcoming', 'Top Rated']
const initialTvWatchlistIds = []
const initialTvWatchedIds = []

const mobileNavItems = [
  { label: 'Home', icon: HomeIcon, view: primaryViews.home },
  { label: 'Search', icon: SearchIcon, view: primaryViews.movies },
  { label: 'Books', icon: BookmarkIcon, view: primaryViews.books },
  { label: 'Games', icon: GamepadIcon, view: primaryViews.games },
  { label: 'News', icon: NewsIcon, view: primaryViews.news },
  { label: 'Watchlist', icon: BookmarkIcon, view: primaryViews.watchlist },
  { label: 'Calendar', icon: CalendarIcon, view: primaryViews.calendar },
  { label: 'Stats', icon: BarsIcon, view: primaryViews.stats },
  { label: 'Together', icon: UserIcon, view: primaryViews.watchTogether },
]

const watchlistTabs = ['All', 'Movies', 'TV Shows', 'Books', 'Actors', 'Authors']
const moviesPageSize = 30
const statsWatchedMoviesPageSize = 30
const watchTogetherHistoryPageSize = 20
const newsPageSize = 20
const emptyNewsFilters = { actor: null, movie: null, show: null }
const genreAccentPalette = ['#ff6b7a', '#7c8dff', '#ffd86f', '#84b3ff', '#ff6cb6', '#67e8f9', '#9ae66e']
const statsActorColors = ['#c99a75', '#8f5e48', '#5e7792', '#a47265']

const emptyMovieStats = {
  moviesWatched: 0,
  timeWatchedMinutes: 0,
  watchlistCount: 0,
  averageRating: null,
}
const emptyTvStats = {
  showsWatched: 0,
  episodesWatched: 0,
  timeWatchedMinutes: 0,
  watchlistCount: 0,
}
const emptyBookStats = {
  metrics: { booksRead: 0, pagesRead: 0, watchlistCount: 0, averageRating: null },
  formats: { physical: 0, ebook: 0, audiobook: 0 },
  activity: { buckets: [] },
  categories: [],
  authors: [],
  topRated: [],
  recentReads: [],
}
const emptyStatsInsights = {
  activity: { buckets: [] },
  mediaSplit: { movieEvents: 0, tvEpisodeEvents: 0 },
  genres: [],
  habits: { weekdayMinutes: Array(7).fill(0), bestWeekdayIndex: null, peakWindow: null },
  topRatedThisMonth: [],
  mostWatchedActors: [],
  streamingPlatforms: [],
  recentHistory: [],
  yearInReview: { titlesWatched: 0, minutes: 0, episodesWatched: 0, averageRating: null, topGenre: null, longestStreak: 0, mostWatchedMonth: null, newFavorites: 0 },
}
const emptyCommunityRating = {
  average: null,
  voteCount: 0,
  yourScore: null,
}
const emptyGameActivity = {
  gamesPlayed: 0,
  playtimeMinutes: 0,
  lastCompletedAt: null,
}
const movieRatingOptions = Array.from({ length: 9 }, (_value, index) => 1 + index * 0.5)
const watchServiceOptions = ['Netflix', 'Prime Video', 'Disney+', 'Max', 'Apple TV+', 'Hulu', 'Paramount+', 'Peacock']
const bookCompletionFields = [
  ['favorite', 'This is a favorite'], ['translated', 'Read in translation'], ['newAuthor', 'A new-to-you author'], ['seriesStarted', 'Started a series'], ['seriesFinished', 'Finished a series'], ['classic', 'A recognized classic'], ['library', 'Borrowed from a library'], ['recommended', 'Recommended by someone'], ['plotTwist', 'A surprising plot twist'], ['madeCry', 'Made me cry'], ['madeLaugh', 'Made me laugh aloud'], ['fictionalCrush', 'A favorite character'], ['foundFamily', 'Found-family theme'], ['villainFavorite', 'Favorite villain/antihero'], ['enemiesToLovers', 'Enemies-to-lovers'], ['slowBurn', 'Slow-burn romance'], ['cozy', 'A cozy read'], ['vacation', 'Read on vacation'], ['coverEnjoyed', 'Chose it for the cover and enjoyed it'], ['coverRegretted', 'Chose it for the cover and regretted it'], ['hyped', 'A hyped or trending read'], ['moodRead', 'Picked for my mood'], ['adaptationWatched', 'Watched its adaptation'], ['bookWasBetter', 'The book was better'], ['adaptationWon', 'The adaptation was better'], ['mapUsed', 'Had a map'], ['trickyNames', 'Names were hard to pronounce'], ['slumpEscape', 'Helped end a reading slump'],
]
const statsPeriods = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

const _statsMockData = {
  metrics: [
    { label: 'Titles Watched', value: '148', trend: '18%', tone: 'violet', icon: ClapperIcon },
    { label: 'Hours Watched', value: '426h', trend: '22%', tone: 'blue', icon: ClockIcon },
    { label: 'Episodes Watched', value: '312', trend: '15%', tone: 'teal', icon: TvIcon },
    { label: 'Average Rating', value: '4.3', suffix: '/5', trend: '0.2', tone: 'gold', icon: StarOutlineIcon },
  ],
  activity: [38, 54, 49, 68, 36, 65, 62, 45, 86, 61, 47, 42],
  genres: [
    { label: 'Sci-Fi', value: '112h', percent: 92 }, { label: 'Drama', value: '86h', percent: 70 },
    { label: 'Thriller', value: '74h', percent: 60 }, { label: 'Adventure', value: '63h', percent: 51 },
    { label: 'Comedy', value: '41h', percent: 34 },
  ],
  achievements: [
    { title: '7-Day Streak', detail: 'Watch something for 7 days in a row', value: 'Complete', icon: ShieldIcon, complete: true },
    { title: 'Century Club', detail: 'Watch 100 movies', value: '100 / 100', icon: StarIcon, complete: true },
    { title: 'Sci-Fi Master', detail: 'Watch 50 Sci-Fi titles', value: '36 / 50', icon: SparklesIcon, complete: false },
  ],
  history: [
    { title: 'Oppenheimer', kind: 'Movie', time: '2h ago', theme: 'theme-ember' }, { title: 'Wonka', kind: 'Movie', time: 'Yesterday', theme: 'theme-arrival' },
    { title: 'Interstellar', kind: 'Movie', time: '2 days ago', theme: 'theme-starfall' }, { title: 'Eclipse Point', kind: 'TV Show', time: '2 days ago', theme: 'theme-eclipse' },
    { title: 'Neon City', kind: 'TV Show', time: '4 days ago', theme: 'theme-neon' },
  ],
}

function App() {
  const [currentRoute, setCurrentRoute] = useState(() => readAppRoute())
  const [activeView, setActiveView] = useState(() =>
    readAppRoute().kind === routeKinds.stats
      ? primaryViews.stats
      : readAppRoute().kind === routeKinds.news
        ? primaryViews.news
      : readAppRoute().kind === routeKinds.calendar
        ? primaryViews.calendar
        : readAppRoute().kind === routeKinds.watchlist
          ? primaryViews.watchlist
      : readAppRoute().kind === routeKinds.bookDetail
        ? primaryViews.books
      : readAppRoute().kind === routeKinds.authorDetail
        ? primaryViews.books
      : readAppRoute().kind === routeKinds.gameDetail
        ? primaryViews.games
      : readAppRoute().kind === routeKinds.movieDetail || readAppRoute().kind === routeKinds.personDetail || readAppRoute().kind === routeKinds.tvDetail
      ? primaryViews.movies
      : primaryViews.home
  )
  const [activeMovieTab, setActiveMovieTab] = useState(movieTabs[0])
  const [activeTvTab, setActiveTvTab] = useState(tvShowTabs[0])
  const [activeWatchlistTab, setActiveWatchlistTab] = useState(() => readWatchlistViewState().tab)
  const [watchlistAvailability, setWatchlistAvailability] = useState(() => readWatchlistViewState().availability)
  const [watchlistSort, setWatchlistSort] = useState(() => readWatchlistViewState().sort)
  const [calendarMonth, setCalendarMonth] = useState(() => getLocalIsoMonth())
  const [calendarMediaType, setCalendarMediaType] = useState('all')
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => getLocalIsoDate())
  const [calendarState, setCalendarState] = useState({ status: 'idle', events: [], upcoming: [], error: '' })
  const [moviesScreenMode, setMoviesScreenMode] = useState(movieScreenModes.overview)
  const [currentScreen, setCurrentScreen] = useState(appScreens.dashboard)
  const [searchInput, setSearchInput] = useState(() => readAppRoute().query || '')
  const [searchError, setSearchError] = useState('')
  const [searchResultsState, setSearchResultsState] = useState({
    status: 'idle',
    movies: [],
    shows: [],
    actors: [],
    books: [],
    games: [],
    error: '',
  })
  const [tmdbSearchState, setTmdbSearchState] = useState({
    status: 'idle',
    movies: [],
    shows: [],
    error: '',
  })
  const [seasonalMoviesState, setSeasonalMoviesState] = useState({ status: 'idle', theme: null, movies: [], error: '' })
  const tmdbSearchRequestId = useRef(0)
  const tmdbSearchStartedQueryRef = useRef('')
  const [googleBooksSearchState, setGoogleBooksSearchState] = useState({
    status: 'idle',
    books: [],
    error: '',
    persistingBookId: null,
  })
  const googleBooksSearchRequestId = useRef(0)
  const googleBooksSearchStartedQueryRef = useRef('')
  const [igdbSearchState, setIgdbSearchState] = useState({ status: 'idle', games: [], error: '' })
  const igdbSearchRequestId = useRef(0)
  const igdbSearchStartedQueryRef = useRef('')
  const [activeSearchSource, setActiveSearchSource] = useState('watchvault')
  const [user, setUser] = useState(null)
  const [activeTheme, setActiveTheme] = useState(() => readCachedActiveTheme())
  const [themeState, setThemeState] = useState({ status: 'loading', pendingTheme: null, error: '', message: '' })
  const [enabledSections, setEnabledSections] = useState(defaultEnabledSections)
  const [authStatus, setAuthStatus] = useState('idle')
  const [authError, setAuthError] = useState('')
  const [changePasswordState, setChangePasswordState] = useState({
    status: 'idle',
    error: '',
    message: '',
  })
  const [popularMoviesPage, setPopularMoviesPage] = useState(1)
  const [hideWatchedMovies, setHideWatchedMovies] = useState(false)
  const [booksPage, setBooksPage] = useState(1)
  const [recentMoviesPage, setRecentMoviesPage] = useState(1)
  const [upcomingMoviesPage, setUpcomingMoviesPage] = useState(1)
  const [topRatedMoviesPage, setTopRatedMoviesPage] = useState(1)
  const [popularTvPage, setPopularTvPage] = useState(1)
  const [recentTvPage, setRecentTvPage] = useState(1)
  const [upcomingTvPage, setUpcomingTvPage] = useState(1)
  const [topRatedTvPage, setTopRatedTvPage] = useState(1)
  const [popularMoviesState, setPopularMoviesState] = useState(() => createMovieCollectionState({ includeFeaturedMovie: true }))
  const [activeGamesTab, setActiveGamesTab] = useState('all')
  const [gamesPage, setGamesPage] = useState(1)
  const [gamesState, setGamesState] = useState(() => createGameCollectionState())
  const [gamesDashboardState, setGamesDashboardState] = useState(() => createGamesDashboardState())
  const [gameActivityState, setGameActivityState] = useState({ status: 'idle', activity: emptyGameActivity, error: '' })
  const [favoriteGames, setFavoriteGames] = useState(() => readStoredGameFavorites())
  const handleToggleGameFavorite = (game) => {
    if (!game?.id) return
    setFavoriteGames((currentGames) => {
      const exists = currentGames.some((favorite) => favorite.id === game.id)
      const nextGames = exists ? currentGames.filter((favorite) => favorite.id !== game.id) : [...currentGames, game]
      storeGameFavorites(nextGames)
      return nextGames
    })
  }

  function handleOpenGameDetail(game) {
    const gameId = Number(game?.id)
    if (!Number.isInteger(gameId)) return
    setGameDetailState({ status: 'loading', game: mapGamePreviewToDetail(game), error: '' })
    handleNavigateToPath(buildGameDetailPath(gameId), { kind: routeKinds.gameDetail, gameId }, primaryViews.games)
  }

  async function handleToggleGamePlayed(game) {
    const gameId = Number(game?.id)
    if (!Number.isInteger(gameId)) return false
    if (!user) { handleOpenLogin(); return false }
    const isPlayed = Boolean(gameDetailState.game?.played)
    setGamePlayedActionState({ status: 'loading', gameId, error: '' })
    try {
      const response = await fetch(`/api/games/${gameId}/played`, { method: isPlayed ? 'DELETE' : 'POST', headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setGameDetailState((state) => Number(state.game?.id) === gameId ? { ...state, game: { ...state.game, played: payload.played } } : state)
      setGamePlayedActionState({ status: 'success', gameId, error: '' })
      void loadPlayedGamesForUser(user)
      void loadGameActivityForUser(user)
      return true
    } catch (error) {
      setGamePlayedActionState({ status: 'error', gameId, error: error instanceof Error ? error.message : 'Unable to update played status right now.' })
      return false
    }
  }

  async function handleSubmitGameRating(game, score) {
    const gameId = Number(game?.id)
    if (!Number.isInteger(gameId)) return false
    if (!user) { handleOpenLogin(); return false }
    setGameRatingActionState({ status: 'loading', gameId, error: '' })
    try {
      const response = await fetch(`/api/games/${gameId}/rating`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify({ score }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      const communityRating = mapCommunityRatingPayload(payload.communityRating)
      setGameDetailState((state) => Number(state.game?.id) === gameId ? { ...state, game: { ...state.game, communityRating } } : state)
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
      setGameRatingActionState({ status: 'success', gameId, error: '' })
      return true
    } catch (error) {
      setGameRatingActionState({ status: 'error', gameId, error: error instanceof Error ? error.message : 'Unable to save your rating right now.' })
      return false
    }
  }

  async function handleSaveGameTracking(game, tracking) {
    const gameId = Number(game?.id)
    if (!Number.isInteger(gameId)) return false
    if (!user) { handleOpenLogin(); return false }
    setGameTrackingActionState({ status: 'loading', gameId, error: '' })
    try {
      const response = await fetch(`/api/games/${gameId}/tracking`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify(tracking) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to save game tracking.')
      setGameDetailState((state) => Number(state.game?.id) === gameId ? { ...state, game: { ...state.game, tracking: payload.tracking } } : state)
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
      setGameTrackingActionState({ status: 'success', gameId, error: '' })
      void loadGameActivityForUser(user)
      return true
    } catch (error) { setGameTrackingActionState({ status: 'error', gameId, error: error instanceof Error ? error.message : 'Unable to save game tracking.' }); return false }
  }

  async function handleSaveGameSession(game, session) {
    const gameId = Number(game?.id)
    if (!Number.isInteger(gameId)) return false
    if (!user) { handleOpenLogin(); return false }
    setGameTrackingActionState({ status: 'loading', gameId, error: '' })
    try {
      const response = await fetch(`/api/games/${gameId}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify(session) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to save game session.')
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
      setGameTrackingActionState({ status: 'success', gameId, error: '' })
      void loadGameActivityForUser(user)
      return true
    } catch (error) { setGameTrackingActionState({ status: 'error', gameId, error: error instanceof Error ? error.message : 'Unable to save game session.' }); return false }
  }
  const [booksState, setBooksState] = useState(() => createBookCollectionState())
  const [recentMoviesState, setRecentMoviesState] = useState(() => createMovieCollectionState())
  const [upcomingMoviesState, setUpcomingMoviesState] = useState(() => createMovieCollectionState())
  const [topRatedMoviesState, setTopRatedMoviesState] = useState(() => createMovieCollectionState())
  const [popularTvState, setPopularTvState] = useState(() => createTvCollectionState({ includeFeaturedShow: true }))
  const [recentTvState, setRecentTvState] = useState(() => createTvCollectionState())
  const [upcomingTvState, setUpcomingTvState] = useState(() => createTvCollectionState())
  const [topRatedTvState, setTopRatedTvState] = useState(() => createTvCollectionState())
  const [latestEpisodesState, setLatestEpisodesState] = useState(() => createTvCollectionState())
  const [genreMoviesPage, setGenreMoviesPage] = useState(1)
  const [genreMoviesState, setGenreMoviesState] = useState(() => createMovieCollectionState())
  const [genresState, setGenresState] = useState({
    status: 'idle',
    genres: [],
    error: '',
  })
  const [selectedGenre, setSelectedGenre] = useState(null)
  const [movieDetailState, setMovieDetailState] = useState({
    status: currentRoute.kind === routeKinds.movieDetail ? 'idle' : 'hidden',
    movie: null,
    error: '',
  })
  const [gameDetailState, setGameDetailState] = useState({ status: currentRoute.kind === routeKinds.gameDetail ? 'idle' : 'hidden', game: null, error: '' })
  const [similarGamesState, setSimilarGamesState] = useState({ status: 'idle', games: [], source: null, error: '' })
  const [bookDetailState, setBookDetailState] = useState({ status: currentRoute.kind === routeKinds.bookDetail ? 'idle' : 'hidden', book: null, error: '' })
  const [authorDetailState, setAuthorDetailState] = useState({ status: currentRoute.kind === routeKinds.authorDetail ? 'idle' : 'hidden', author: null, books: [], error: '' })
  const [relatedBooksState, setRelatedBooksState] = useState({ status: currentRoute.kind === routeKinds.bookDetail ? 'idle' : 'hidden', books: [], error: '', persistingBookId: null })
  const [tvDetailState, setTvDetailState] = useState({ status: currentRoute.kind === routeKinds.tvDetail ? 'idle' : 'hidden', show: null, error: '' })
  const [tvReviewsState, setTvReviewsState] = useState({ status: 'idle', reviews: [], error: '' })
  const [similarMoviesState, setSimilarMoviesState] = useState({
    status: currentRoute.kind === routeKinds.movieDetail ? 'idle' : 'hidden',
    movies: [],
    error: '',
  })
  const [personDetailState, setPersonDetailState] = useState({
    status: currentRoute.kind === routeKinds.personDetail ? 'idle' : 'hidden',
    person: null,
    knownFor: [],
    filmography: [],
    coStars: [],
    facts: [],
    personalHistory: null,
    error: '',
  })
  const [personDetailRefreshKey, setPersonDetailRefreshKey] = useState(0)
  const [adminOverviewState, setAdminOverviewState] = useState({
    status: 'idle',
    crons: [],
    totalActors: 0,
    totalBooks: 0,
    totalGames: 0,
    totalMovies: 0,
    totalNewsArticles: 0,
    storedDataBytes: 0,
    totalTvShows: 0,
    filelist: { configured: false, updatedAt: null },
    igdb: { configured: false, updatedAt: null },
    rssSources: [],
    sections: { enabled: defaultEnabledSections },
    error: '',
  })
  const [adminRunState, setAdminRunState] = useState({})
  const [adminRefreshKey, setAdminRefreshKey] = useState(0)
  const [watchlistState, setWatchlistState] = useState({
    status: 'idle',
    movies: [],
    books: [],
    error: '',
  })
  const [favoriteActorsState, setFavoriteActorsState] = useState({
    status: 'idle',
    actors: [],
    error: '',
  })
  const [favoriteAuthorsState, setFavoriteAuthorsState] = useState({ status: 'idle', authors: [], error: '' })
  const [alertsState, setAlertsState] = useState({ status: 'idle', alerts: [], unreadCount: 0, error: '' })
  const [watchlistActionState, setWatchlistActionState] = useState({
    status: 'idle',
    movieId: null,
    error: '',
  })
  const [bookWatchlistActionState, setBookWatchlistActionState] = useState({
    status: 'idle',
    bookId: null,
    error: '',
  })
  const [readBooksState, setReadBooksState] = useState({ status: 'idle', books: [], error: '' })
  const [playedGamesState, setPlayedGamesState] = useState({ status: 'idle', games: [], error: '' })
  const [bookReadActionState, setBookReadActionState] = useState({ status: 'idle', bookId: null, error: '' })
  const [bookReadingFormatDialogBook, setBookReadingFormatDialogBook] = useState(null)
  const [bookRatingActionState, setBookRatingActionState] = useState({ status: 'idle', bookId: null, error: '' })
  const [watchedState, setWatchedState] = useState({
    status: 'idle',
    movies: [],
    error: '',
  })
  const [watchedActionState, setWatchedActionState] = useState({
    status: 'idle',
    movieId: null,
    error: '',
  })
  const [movieRatingActionState, setMovieRatingActionState] = useState({
    status: 'idle',
    movieId: null,
    error: '',
  })
  const [gamePlayedActionState, setGamePlayedActionState] = useState({ status: 'idle', gameId: null, error: '' })
  const [gameRatingActionState, setGameRatingActionState] = useState({ status: 'idle', gameId: null, error: '' })
  const [gameTrackingActionState, setGameTrackingActionState] = useState({ status: 'idle', gameId: null, error: '' })
  const [movieReleaseReminderActionState, setMovieReleaseReminderActionState] = useState({ status: 'idle', movieId: null, error: '' })
  const [tvEpisodeRatingActionState, setTvEpisodeRatingActionState] = useState({ status: 'idle', episodeId: null, error: '' })
  const [movieStatsState, setMovieStatsState] = useState({
    status: 'idle',
    stats: emptyMovieStats,
    error: '',
  })
  const [statsPeriod, setStatsPeriod] = useState('year')
  const [tvStatsState, setTvStatsState] = useState({ status: 'idle', stats: emptyTvStats, error: '' })
  const [tvWatchedHistoryState, setTvWatchedHistoryState] = useState({ status: 'idle', episodes: [], error: '' })
  const [statsInsightsState, setStatsInsightsState] = useState({ status: 'idle', insights: emptyStatsInsights, error: '' })
  const [bookStatsState, setBookStatsState] = useState({ status: 'idle', stats: emptyBookStats, error: '' })
  const [bookAchievementsState, setBookAchievementsState] = useState({ status: 'idle', achievements: [], error: '' })
  const [gameAchievementsState, setGameAchievementsState] = useState({ status: 'idle', achievements: [], error: '' })
  const [statsInitialTab, setStatsInitialTab] = useState('Overview')
  const [achievementsState, setAchievementsState] = useState({ status: 'idle', achievements: [], error: '' })
  const [achievementToast, setAchievementToast] = useState(null)
  const [continueWatchingState, setContinueWatchingState] = useState({ status: 'idle', shows: [], error: '' })
  const [continueWatchingPage, setContinueWatchingPage] = useState(1)
  const [continueWatchingPageState, setContinueWatchingPageState] = useState(() => createTvCollectionState())
  const [selectedTvShowId, setSelectedTvShowId] = useState(null)
  const [tvWatchlistIds, setTvWatchlistIds] = useState(() => new Set(initialTvWatchlistIds))
  const [tvWatchlistShows, setTvWatchlistShows] = useState([])
  const [tvWatchedIds, setTvWatchedIds] = useState(() => new Set(initialTvWatchedIds))
  const [watchTogetherState, setWatchTogetherState] = useState({ status: 'idle', partner: null, pendingRequest: null, users: [], items: [], watchedMovies: [], watchedEpisodes: [], inProgressShows: [], error: '' })
  const [watchTogetherSearch, setWatchTogetherSearch] = useState({ query: '', type: 'all', status: 'idle', items: [], error: '' })
  const [watchTogetherAction, setWatchTogetherAction] = useState({ status: 'idle', key: null, error: '' })
  const [watchTogetherTab, setWatchTogetherTab] = useState('movies')
  const [watchTogetherAchievementsState, setWatchTogetherAchievementsState] = useState({ status: 'idle', achievements: [], error: '' })
  const [watchTogetherStatsState, setWatchTogetherStatsState] = useState({ status: 'idle', stats: null, error: '' })

  useEffect(() => {
    function handlePopState() {
      const nextRoute = readAppRoute()
      setCurrentRoute(nextRoute)
      setCurrentScreen(appScreens.dashboard)
      setActiveView(
        nextRoute.kind === routeKinds.stats
          ? primaryViews.stats
          : nextRoute.kind === routeKinds.news
            ? primaryViews.news
          : nextRoute.kind === routeKinds.calendar
            ? primaryViews.calendar
            : nextRoute.kind === routeKinds.watchlist
              ? primaryViews.watchlist
          : nextRoute.kind === routeKinds.bookDetail
            ? primaryViews.books
            : nextRoute.kind === routeKinds.authorDetail
              ? primaryViews.books
            : nextRoute.kind === routeKinds.gameDetail
              ? primaryViews.games
            : nextRoute.kind === routeKinds.movieDetail || nextRoute.kind === routeKinds.personDetail || nextRoute.kind === routeKinds.tvDetail
          ? primaryViews.movies
          : primaryViews.home
      )
      if (nextRoute.kind === routeKinds.watchlist) {
        const view = readWatchlistViewState()
        setActiveWatchlistTab(view.tab)
        setWatchlistAvailability(view.availability)
        setWatchlistSort(view.sort)
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (currentRoute.kind === routeKinds.search) {
      setSearchInput(currentRoute.query)
      setSearchError('')
    }
  }, [currentRoute])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.seasonalMovies) {
      setSeasonalMoviesState({ status: 'idle', theme: null, movies: [], error: '' })
      return
    }

    if (themeState.status === 'loading') return

    if (!getSeasonalThemeWithMovies(activeTheme)) {
      window.history.replaceState({}, '', '/')
      setCurrentRoute({ kind: routeKinds.home })
      setActiveView(primaryViews.home)
      return
    }

    let cancelled = false
    setSeasonalMoviesState({ status: 'loading', theme: null, movies: [], error: '' })

    fetch('/api/seasonal-movies')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) {
          setSeasonalMoviesState({
            status: 'success',
            theme: payload.theme ?? null,
            movies: Array.isArray(payload.movies) ? payload.movies : [],
            error: '',
          })
        }
      })
      .catch((error) => {
        if (!cancelled) setSeasonalMoviesState({ status: 'error', theme: null, movies: [], error: error instanceof Error ? error.message : 'Unable to load seasonal movies right now.' })
      })

    return () => { cancelled = true }
  }, [activeTheme, currentRoute, themeState.status])

  useEffect(() => {
    if (!enabledSections.includes('books') && activeSearchSource === 'books') {
      setActiveSearchSource('watchvault')
    }
  }, [activeSearchSource, enabledSections])

  useEffect(() => {
    let cancelled = false
    fetch('/api/theme')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) {
          const nextTheme = applyActiveTheme(payload.activeTheme)
          setActiveTheme(nextTheme)
          setThemeState({ status: 'success', pendingTheme: null, error: '', message: '' })
        }
      })
      .catch((error) => {
        if (!cancelled) setThemeState({ status: 'error', pendingTheme: null, error: error instanceof Error ? error.message : 'Unable to load the active site theme.', message: '' })
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    applyActiveTheme(activeTheme)
  }, [activeTheme])

  useEffect(() => {
    try {
      const storedUser = window.localStorage.getItem(authStorageKey)

      if (!storedUser) {
        return
      }

      const parsedUser = JSON.parse(storedUser)

      if (parsedUser?.username && parsedUser?.fullName) {
        setUser(parsedUser)
      }
    } catch {
      window.localStorage.removeItem(authStorageKey)
    }
  }, [])

  useEffect(() => {
    if (user?.username && user?.fullName) {
      window.localStorage.setItem(authStorageKey, JSON.stringify(user))
      return
    }

    window.localStorage.removeItem(authStorageKey)
  }, [user])

  useEffect(() => {
    if (!user) {
      setEnabledSections(defaultEnabledSections)
      return
    }

    let cancelled = false

    async function loadEnabledSections() {
      try {
        const response = await fetch('/api/preferences/sections', { headers: buildAuthHeaders(user) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) setEnabledSections(normalizeEnabledSections(payload.enabled))
      } catch {
        if (!cancelled) setEnabledSections(defaultEnabledSections)
      }
    }

    loadEnabledSections()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user || currentRoute.kind !== routeKinds.calendar || enabledSections.includes('calendar')) return
    window.history.replaceState({}, '', '/')
    setCurrentRoute({ kind: routeKinds.home })
    setActiveView(primaryViews.home)
    setCurrentScreen(appScreens.dashboard)
  }, [currentRoute.kind, enabledSections, user])

  function handleOpenLogin() {
    setAuthError('')
    setAuthStatus('idle')
    setCurrentScreen(appScreens.login)
  }

  function handleCloseLogin() {
    setAuthError('')
    setAuthStatus('idle')
    setCurrentScreen(appScreens.dashboard)
  }

  function handleOpenAdmin() {
    setCurrentScreen(appScreens.admin)
  }

  function handleOpenAccount() {
    if (!user) {
      handleOpenLogin()
      return
    }

    setChangePasswordState({
      status: 'idle',
      error: '',
      message: '',
    })
    setCurrentScreen(appScreens.account)
  }

  function handleOpenDashboard() {
    setChangePasswordState({
      status: 'idle',
      error: '',
      message: '',
    })
    setCurrentScreen(appScreens.dashboard)
  }

  function handleLogout() {
    setUser(null)
    setEnabledSections(defaultEnabledSections)
    setAuthStatus('idle')
    setAuthError('')
    setWatchlistActionState({
      status: 'idle',
      movieId: null,
      error: '',
    })
    setWatchedActionState({
      status: 'idle',
      movieId: null,
      error: '',
    })
    setMovieStatsState({
      status: 'idle',
      stats: emptyMovieStats,
      error: '',
    })
    setChangePasswordState({
      status: 'idle',
      error: '',
      message: '',
    })
    setCurrentScreen(appScreens.dashboard)

    if (currentRoute.kind !== routeKinds.movieDetail && currentRoute.kind !== routeKinds.personDetail && currentRoute.kind !== routeKinds.bookDetail && currentRoute.kind !== routeKinds.authorDetail) {
      setActiveView(primaryViews.home)
    }
  }

  function handleOpenWatchlistCta() {
    if (!user) {
      handleOpenLogin()
      return
    }

    handleMovieViewSelection(primaryViews.watchlist)
  }

  function handleNavigateToPath(path, nextRoute, nextView = primaryViews.home, historyState = {}) {
    if (`${window.location.pathname}${window.location.search}` !== path) {
      window.history.pushState(historyState, '', path)
    }

    setCurrentRoute(nextRoute)
    setCurrentScreen(appScreens.dashboard)
    setActiveView(nextView)
  }

  function saveRecentSearch(query) {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return
    const current = readRecentSearches()
    const next = [normalizedQuery, ...current.filter((item) => item.toLocaleLowerCase() !== normalizedQuery.toLocaleLowerCase())].slice(0, maxRecentSearches)
    window.localStorage.setItem(recentSearchesStorageKey, JSON.stringify(next))
  }

  function handleSearchSubmit(nextQuery = searchInput) {
    const query = nextQuery.trim()

    if (!query) {
      setSearchError('Enter a movie, show, book, game, or actor to search.')
      return false
    }

    setSearchError('')
    setSearchInput(query)
    saveRecentSearch(query)
    handleNavigateToPath(buildSearchPath(query), { kind: routeKinds.search, query })
    return true
  }

  function handleOpenSearchSuggestion(suggestion) {
    if (!suggestion?.id || !suggestion?.label) return
    saveRecentSearch(suggestion.label)
    setSearchInput(suggestion.label)
    if (suggestion.kind === 'movie') handleOpenMovieDetail({ id: suggestion.id })
    if (suggestion.kind === 'tv') handleOpenTvDetail({ id: suggestion.id })
    if (suggestion.kind === 'book') handleOpenBookDetail({ id: suggestion.id })
    if (suggestion.kind === 'person') handleOpenPersonDetail({ id: suggestion.id, name: suggestion.label })
  }

  function handleOpenDiscover() {
    handleNavigateToPath('/discover', { kind: routeKinds.discover })
  }

  function handleOpenSeasonalMovies() {
    if (!getSeasonalThemeWithMovies(activeTheme)) return
    handleNavigateToPath('/seasonal', { kind: routeKinds.seasonalMovies })
  }

  async function handleSearchTmdb() {
    const query = currentRoute.kind === routeKinds.search ? currentRoute.query : ''
    if (!query || tmdbSearchStartedQueryRef.current === query) return

    tmdbSearchStartedQueryRef.current = query
    const requestId = ++tmdbSearchRequestId.current
    setTmdbSearchState({ status: 'loading', movies: [], shows: [], error: '' })

    try {
      const response = await fetch(`/api/search/tmdb?q=${encodeURIComponent(query)}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)

      if (requestId === tmdbSearchRequestId.current) {
        setTmdbSearchState({
          status: 'success',
          movies: Array.isArray(payload.movies) ? payload.movies : [],
          shows: Array.isArray(payload.shows) ? payload.shows : [],
          error: '',
        })
      }
    } catch (error) {
      if (requestId === tmdbSearchRequestId.current) {
        setTmdbSearchState({
          status: 'error',
          movies: [],
          shows: [],
          error: error instanceof Error ? error.message : 'Unable to search TMDB right now.',
        })
      }
    }
  }

  async function handleSearchGoogleBooks() {
    const query = currentRoute.kind === routeKinds.search ? currentRoute.query : ''
    if (!query || googleBooksSearchStartedQueryRef.current === query) return

    googleBooksSearchStartedQueryRef.current = query
    const requestId = ++googleBooksSearchRequestId.current
    setGoogleBooksSearchState({ status: 'loading', books: [], error: '', persistingBookId: null })

    try {
      const response = await fetch(`/api/search/books?q=${encodeURIComponent(query)}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      if (requestId === googleBooksSearchRequestId.current) {
        setGoogleBooksSearchState({
          status: 'success',
          books: Array.isArray(payload.books) ? payload.books.map(mapGoogleBookToCard) : [],
          error: '',
          persistingBookId: null,
        })
      }
    } catch (error) {
      if (requestId === googleBooksSearchRequestId.current) {
        setGoogleBooksSearchState({ status: 'error', books: [], error: error instanceof Error ? error.message : 'Unable to search Google Books right now.', persistingBookId: null })
      }
    }
  }

  async function handleSearchIgdb() {
    const query = currentRoute.kind === routeKinds.search ? currentRoute.query : ''
    if (!query || igdbSearchStartedQueryRef.current === query) return

    igdbSearchStartedQueryRef.current = query
    const requestId = ++igdbSearchRequestId.current
    setIgdbSearchState({ status: 'loading', games: [], error: '' })

    try {
      const response = await fetch(`/api/search/igdb?q=${encodeURIComponent(query)}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      if (requestId === igdbSearchRequestId.current) {
        setIgdbSearchState({ status: 'success', games: Array.isArray(payload.games) ? payload.games : [], error: '' })
      }
    } catch (error) {
      if (requestId === igdbSearchRequestId.current) {
        setIgdbSearchState({ status: 'error', games: [], error: error instanceof Error ? error.message : 'Unable to search IGDB right now.' })
      }
    }
  }

  function handleOpenMovieDetail(movie) {
    const normalizedMovieId = Number(movie?.id)

    if (!Number.isInteger(normalizedMovieId)) {
      return
    }

    setMovieDetailState({
      status: 'success',
      movie: mapMoviePreviewToDetail(movie),
      error: '',
    })

    handleNavigateToPath(buildMovieDetailPath(normalizedMovieId), {
      kind: routeKinds.movieDetail,
      movieId: normalizedMovieId,
    }, primaryViews.movies, {
      moviePreview: movie,
    })
  }

  function handleOpenBookDetail(book) {
    const bookId = String(book?.id || '').trim()
    if (!bookId) return
    setBookDetailState({ status: 'success', book, error: '' })
    handleNavigateToPath(buildBookDetailPath(bookId), { kind: routeKinds.bookDetail, bookId }, primaryViews.books, { bookPreview: book })
  }

  function handleOpenAuthorDetail(author) {
    const authorId = Number(author?.id)
    if (!Number.isInteger(authorId)) return
    setAuthorDetailState({ status: 'success', author: { id: authorId, name: author.name || 'Author' }, books: [], error: '' })
    handleNavigateToPath(buildAuthorDetailPath(authorId), { kind: routeKinds.authorDetail, authorId }, primaryViews.books, { authorPreview: author })
  }

  async function persistGoogleBook(book) {
    const bookId = String(book?.id || '').trim()
    if (!bookId) throw new Error('Book ID is required')
    try {
      const response = await fetch(`/api/books/${encodeURIComponent(bookId)}`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      return payload.book ? mapBookDetailPayload(payload.book) : book
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unable to save this book right now.')
    }
  }

  async function handleOpenGoogleBookDetail(book) {
    const bookId = String(book?.id || '').trim()
    if (!bookId || googleBooksSearchState.persistingBookId) return

    setGoogleBooksSearchState((state) => ({ ...state, error: '', persistingBookId: bookId }))
    try {
      const storedBook = await persistGoogleBook(book)
      setBookDetailState({ status: 'success', book: storedBook, error: '' })
      handleNavigateToPath(buildBookDetailPath(bookId), { kind: routeKinds.bookDetail, bookId }, primaryViews.books, { bookPreview: storedBook })
    } catch (error) {
      setGoogleBooksSearchState((state) => ({ ...state, error: error.message, persistingBookId: null }))
      return
    }
    setGoogleBooksSearchState((state) => ({ ...state, persistingBookId: null }))
  }

  async function handleOpenRelatedBookDetail(book) {
    const bookId = String(book?.id || '').trim()
    if (!bookId || relatedBooksState.persistingBookId) return

    setRelatedBooksState((state) => ({ ...state, error: '', persistingBookId: bookId }))
    try {
      const storedBook = await persistGoogleBook(book)
      setBookDetailState({ status: 'success', book: storedBook, error: '' })
      handleNavigateToPath(buildBookDetailPath(bookId), { kind: routeKinds.bookDetail, bookId }, primaryViews.books, { bookPreview: storedBook })
    } catch (error) {
      setRelatedBooksState((state) => ({ ...state, error: error.message, persistingBookId: null }))
      return
    }
    setRelatedBooksState((state) => ({ ...state, persistingBookId: null }))
  }

  function handleOpenTvDetail(show) {
    const showId = Number(show?.id)
    if (!Number.isInteger(showId)) return
    handleNavigateToPath(`/tv/${showId}`, { kind: routeKinds.tvDetail, showId }, primaryViews.tvShows, { tvPreview: show })
  }

  function handleOpenAlert(alert) {
    if (Number.isInteger(Number(alert?.movieId))) {
      handleOpenMovieDetail({ id: Number(alert.movieId), title: alert.title })
      return
    }
    if (Number.isInteger(Number(alert?.showId))) {
      handleOpenTvDetail({ id: Number(alert.showId), title: alert.title })
    }
  }

  function handleOpenContinueWatching() {
    setContinueWatchingPage(1)
    handleNavigateToPath('/tv/continue-watching', { kind: routeKinds.continueWatching })
  }

  function handleOpenPersonDetail(person) {
    const normalizedPersonId = Number(person?.id)

    if (!Number.isInteger(normalizedPersonId)) {
      return
    }

    setPersonDetailState({
      status: 'success',
      person: mapPersonPreview(person),
      knownFor: [],
      filmography: [],
      coStars: [],
      facts: [],
      personalHistory: null,
      error: '',
    })

    handleNavigateToPath(buildPersonDetailPath(normalizedPersonId), {
      kind: routeKinds.personDetail,
      personId: normalizedPersonId,
    }, primaryViews.movies, {
      personPreview: person,
    })
  }

  function updatePersonFilmographyPersonalState(mediaType, id, changes) {
    setPersonDetailState((state) => ({
      ...state,
      filmography: state.filmography.map((item) => item.mediaType === mediaType && Number(item.id) === Number(id)
        ? { ...item, personal: { ...item.personal, ...changes } }
        : item),
    }))
    refreshPersonDetailHistory()
  }

  function refreshPersonDetailHistory() {
    if (currentRoute.kind === routeKinds.personDetail) setPersonDetailRefreshKey((key) => key + 1)
  }

  async function handleLogin(credentials) {
    setAuthStatus('loading')
    setAuthError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Invalid username or password')
      }

      if (!payload?.user?.username || !payload?.user?.fullName) {
        throw new Error('Login response was missing user details')
      }

      setUser(payload.user)
      setAuthStatus('success')
      setCurrentScreen(appScreens.dashboard)
    } catch (error) {
      setAuthStatus('error')
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in right now.')
    }
  }

  async function handleChangePassword(passwords) {
    if (!user) {
      handleOpenLogin()
      return
    }

    setChangePasswordState({
      status: 'loading',
      error: '',
      message: '',
    })

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(user),
        },
        body: JSON.stringify(passwords),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      setChangePasswordState({
        status: 'success',
        error: '',
        message: payload.message || 'Password changed successfully',
      })
    } catch (error) {
      setChangePasswordState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unable to change your password right now.',
        message: '',
      })
    }
  }

  function handleMovieViewSelection(view) {
    if (view === primaryViews.news) {
      handleNavigateToPath('/news', { kind: routeKinds.news }, view)
      setSelectedGenre(null)
      return
    }

    if (view === primaryViews.stats) {
      setStatsInitialTab('Overview')
      handleNavigateToPath('/stats', { kind: routeKinds.stats }, view)
      setSelectedGenre(null)
      return
    }

    if (view === primaryViews.calendar) {
      handleNavigateToPath('/calendar', { kind: routeKinds.calendar }, view)
      setSelectedGenre(null)
      return
    }

    if (view === primaryViews.watchlist) {
      const next = readWatchlistViewState()
      handleNavigateToPath(buildWatchlistPath(next), { kind: routeKinds.watchlist }, view)
      setActiveWatchlistTab(next.tab)
      setWatchlistAvailability(next.availability)
      setWatchlistSort(next.sort)
      setSelectedGenre(null)
      return
    }

    setActiveView(view)
    if (currentRoute.kind === routeKinds.movieDetail || currentRoute.kind === routeKinds.gameDetail || currentRoute.kind === routeKinds.personDetail || currentRoute.kind === routeKinds.tvDetail || currentRoute.kind === routeKinds.bookDetail || currentRoute.kind === routeKinds.authorDetail) {
      handleNavigateToPath('/', { kind: routeKinds.home }, view)
    } else if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
      setCurrentRoute({ kind: routeKinds.home })
    }

    if (view !== primaryViews.movies) {
      setSelectedGenre(null)
      return
    }

    setSelectedGenre(null)

    if (activeMovieTab === 'Popular') {
      setMoviesScreenMode(movieScreenModes.popularList)
      return
    }

    if (activeMovieTab === 'Now Playing') {
      setMoviesScreenMode(movieScreenModes.nowPlayingList)
      return
    }

    if (activeMovieTab === 'Top Rated') {
      setMoviesScreenMode(movieScreenModes.topRatedList)
      return
    }

    if (activeMovieTab === 'Upcoming') {
      setMoviesScreenMode(movieScreenModes.upcomingList)
      return
    }

    setMoviesScreenMode(movieScreenModes.overview)
  }

  function handleWatchlistViewChange(patch) {
    const next = { tab: activeWatchlistTab, availability: watchlistAvailability, sort: watchlistSort, ...patch }
    setActiveWatchlistTab(next.tab)
    setWatchlistAvailability(next.availability)
    setWatchlistSort(next.sort)
    handleNavigateToPath(buildWatchlistPath(next), { kind: routeKinds.watchlist }, primaryViews.watchlist)
  }

  function handleWatchlistTabChange(tab) {
    handleWatchlistViewChange({ tab })
  }

  function handleTvTabChange(tab) {
    setActiveTvTab(tab)
    setSelectedTvShowId(null)

    if (tab === 'All Shows') {
      setPopularTvPage(1)
      setRecentTvPage(1)
      setTopRatedTvPage(1)
      setUpcomingTvPage(1)
      return
    }

    if (tab === 'Popular' && activeTvTab !== tab) {
      setPopularTvPage(1)
      return
    }

    if (tab === 'Airing Now' && activeTvTab !== tab) {
      setRecentTvPage(1)
      return
    }

    if (tab === 'Top Rated' && activeTvTab !== tab) {
      setTopRatedTvPage(1)
      return
    }

    if (tab === 'Upcoming' && activeTvTab !== tab) {
      setUpcomingTvPage(1)
    }
  }

  function handleMovieTabChange(tab) {
    setActiveMovieTab(tab)
    setSelectedGenre(null)

    if (tab === 'All Movies') {
      setPopularMoviesPage(1)
      setRecentMoviesPage(1)
      setTopRatedMoviesPage(1)
      setUpcomingMoviesPage(1)
      setGenreMoviesPage(1)
    }

    if (tab === 'Popular') {
      if (activeMovieTab !== tab) {
        setPopularMoviesPage(1)
      }
      setMoviesScreenMode(movieScreenModes.popularList)
      return
    }

    if (tab === 'Now Playing') {
      if (activeMovieTab !== tab) {
        setRecentMoviesPage(1)
      }
      setMoviesScreenMode(movieScreenModes.nowPlayingList)
      return
    }

    if (tab === 'Top Rated') {
      if (activeMovieTab !== tab) {
        setTopRatedMoviesPage(1)
      }
      setMoviesScreenMode(movieScreenModes.topRatedList)
      return
    }

    if (tab === 'Upcoming') {
      if (activeMovieTab !== tab) {
        setUpcomingMoviesPage(1)
      }
      setMoviesScreenMode(movieScreenModes.upcomingList)
      return
    }

    setMoviesScreenMode(movieScreenModes.overview)
  }

  function handleHideWatchedMoviesChange(nextValue) {
    setHideWatchedMovies(nextValue)

    if (moviesScreenMode === movieScreenModes.genreList) setGenreMoviesPage(1)
    if (moviesScreenMode === movieScreenModes.popularList) setPopularMoviesPage(1)
    if (moviesScreenMode === movieScreenModes.nowPlayingList) setRecentMoviesPage(1)
    if (moviesScreenMode === movieScreenModes.topRatedList) setTopRatedMoviesPage(1)
    if (moviesScreenMode === movieScreenModes.upcomingList) setUpcomingMoviesPage(1)
  }

  function handleOpenPopularMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Popular')
    setSelectedGenre(null)
    setPopularMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.popularList)
  }

  function handleOpenRecentlyReleasedMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Now Playing')
    setSelectedGenre(null)
    setRecentMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.nowPlayingList)
  }

  function handleOpenUpcomingMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Upcoming')
    setSelectedGenre(null)
    setUpcomingMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.upcomingList)
  }

  function handleOpenTopRatedMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Top Rated')
    setSelectedGenre(null)
    setTopRatedMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.topRatedList)
  }

  function handleSelectTvShow(show) {
    handleOpenTvDetail(show)
  }

  function handleOpenPopularTvShows() {
    setActiveView(primaryViews.tvShows)
    setActiveTvTab('Popular')
    setSelectedTvShowId(null)
    setPopularTvPage(1)
  }

  function handleOpenRecentlyAiredTvShows() {
    setActiveView(primaryViews.tvShows)
    setActiveTvTab('Airing Now')
    setSelectedTvShowId(null)
    setRecentTvPage(1)
  }

  function handleOpenUpcomingTvShows() {
    setActiveView(primaryViews.tvShows)
    setActiveTvTab('Upcoming')
    setSelectedTvShowId(null)
    setUpcomingTvPage(1)
  }

  function handleOpenTopRatedTvShows() {
    setActiveView(primaryViews.tvShows)
    setActiveTvTab('Top Rated')
    setSelectedTvShowId(null)
    setTopRatedTvPage(1)
  }

  async function handleToggleTvLibrary(show, kind) {
    const showId = Number(show?.id)
    if (!Number.isInteger(showId)) return
    if (!user) return handleOpenLogin()
    try {
      const response = await fetch(`/api/tv/library/${kind}?period=${statsPeriod}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
        body: JSON.stringify({ showId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setTvWatchedIds(new Set(payload.watchedIds ?? []))
      setTvWatchlistIds(new Set(payload.watchlistIds ?? []))
      setTvWatchlistShows(Array.isArray(payload.watchlistShows) ? payload.watchlistShows.map(mapTvWatchlistShowPayload) : [])
      setTvStatsState({ status: 'success', stats: mapTvStatsPayload(payload.stats), error: '' })
      updatePersonFilmographyPersonalState('tv', showId, {
        watchlisted: (payload.watchlistIds ?? []).map(Number).includes(showId),
        watched: (payload.watchedIds ?? []).map(Number).includes(showId),
      })
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
    } catch (error) {
      setTvStatsState((state) => ({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Unable to update TV library.' }))
    }
  }

  function handleToggleTvWatchlist(show) { return handleToggleTvLibrary(show, 'watchlist') }

  function handleToggleTvWatched(show) { return handleToggleTvLibrary(show, 'watched') }

  async function handleUpdateTvEpisodes(showId, { action, episodeId, seasonId, watchService = null }) {
    if (!user) return handleOpenLogin()
    const response = await fetch('/api/tv/episodes/watched', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
      body: JSON.stringify({ showId, action, episodeId, seasonId, watchService }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to update episode')
    setTvDetailState({ status: 'success', show: mapTvDetailPayload(payload.show), error: '' })
    receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
    await Promise.all([loadTvLibraryForUser(user), loadTvWatchedHistoryForUser(user)])
  }

  async function handleSubmitTvEpisodeRating(episode, score) {
    const episodeId = Number(episode?.id)
    if (!Number.isInteger(episodeId)) return false
    if (!user) {
      handleOpenLogin()
      return false
    }
    setTvEpisodeRatingActionState({ status: 'loading', episodeId, error: '' })
    try {
      const response = await fetch(`/api/tv/episodes/${episodeId}/rating`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
        body: JSON.stringify({ score }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to save episode rating')
      if (payload.show) setTvDetailState({ status: 'success', show: mapTvDetailPayload(payload.show), error: '' })
      setTvEpisodeRatingActionState({ status: 'success', episodeId, error: '' })
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
      return true
    } catch (error) {
      setTvEpisodeRatingActionState({ status: 'error', episodeId, error: error instanceof Error ? error.message : 'Unable to save episode rating.' })
      return false
    }
  }

  function handleOpenGenre(genre) {
    if (!genre?.name) {
      return
    }

    setActiveMovieTab('All Movies')
    setSelectedGenre(genre)
    setGenreMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.genreList)
    handleNavigateToPath('/', { kind: routeKinds.home }, primaryViews.movies)
  }

  async function loadWatchlistForUser(nextUser) {
    if (!nextUser?.username) {
      setWatchlistState({
        status: 'idle',
        movies: [],
        books: [],
        error: '',
      })
      return
    }

    setWatchlistState((previousState) => ({
      ...previousState,
      status: 'loading',
      error: '',
    }))

    try {
      const response = await fetch('/api/watchlist', {
        headers: buildAuthHeaders(nextUser),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      setWatchlistState({
        status: 'success',
        movies: Array.isArray(payload.movies) ? payload.movies.map(mapWatchlistMoviePayload) : [],
        books: Array.isArray(payload.books) ? payload.books.map(mapWatchlistBookPayload) : [],
        error: '',
      })
    } catch (error) {
      setWatchlistState({
        status: 'error',
        movies: [],
        books: [],
        error: error instanceof Error ? error.message : 'Unable to load your watchlist right now.',
      })
    }
  }

  async function loadReadBooksForUser(nextUser) {
    if (!nextUser?.username) {
      setReadBooksState({ status: 'idle', books: [], error: '' })
      return
    }

    setReadBooksState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/read/books', { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setReadBooksState({ status: 'success', books: Array.isArray(payload.books) ? payload.books.map(mapReadBookPayload) : [], error: '' })
    } catch (error) {
      setReadBooksState({ status: 'error', books: [], error: error instanceof Error ? error.message : 'Unable to load your read books right now.' })
    }
  }

  async function loadFavoriteActorsForUser(nextUser) {
    if (!nextUser?.username) {
      setFavoriteActorsState({ status: 'idle', actors: [], error: '' })
      return
    }

    setFavoriteActorsState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/favorite-actors', { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setFavoriteActorsState({ status: 'success', actors: Array.isArray(payload.actors) ? payload.actors : [], error: '' })
    } catch (error) {
      setFavoriteActorsState({ status: 'error', actors: [], error: error instanceof Error ? error.message : 'Unable to load favorite actors right now.' })
    }
  }

  async function loadFavoriteAuthorsForUser(nextUser) {
    if (!nextUser?.username) {
      setFavoriteAuthorsState({ status: 'idle', authors: [], error: '' })
      return
    }

    setFavoriteAuthorsState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/favorite-authors', { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setFavoriteAuthorsState({ status: 'success', authors: Array.isArray(payload.authors) ? payload.authors : [], error: '' })
    } catch (error) {
      setFavoriteAuthorsState({ status: 'error', authors: [], error: error instanceof Error ? error.message : 'Unable to load favorite authors right now.' })
    }
  }

  async function loadAlertsForUser(nextUser) {
    if (!nextUser?.username) {
      setAlertsState({ status: 'idle', alerts: [], unreadCount: 0, error: '' })
      return
    }

    setAlertsState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const response = await fetch(`/api/alerts?timeZone=${encodeURIComponent(timezone || 'UTC')}`, { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setAlertsState({
        status: 'success',
        alerts: Array.isArray(payload.alerts) ? payload.alerts : [],
        unreadCount: Number(payload.unreadCount) || 0,
        error: '',
      })
    } catch (error) {
      setAlertsState((state) => ({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Unable to load alerts right now.' }))
    }
  }

  async function handleOpenAlerts() {
    if (!user) return handleOpenLogin()
    await loadAlertsForUser(user)
    try {
      await fetch('/api/alerts/read', { method: 'POST', headers: buildAuthHeaders(user) })
      setAlertsState((state) => ({ ...state, unreadCount: 0, alerts: state.alerts.map((alert) => ({ ...alert, readAt: alert.readAt || new Date().toISOString() })) }))
    } catch {
      // Alerts remain visible even if marking them read fails.
    }
  }

  async function handleToggleFavoriteActor(person) {
    const personId = Number(person?.id)
    if (!Number.isInteger(personId)) return
    if (!user) return handleOpenLogin()

    try {
      const response = await fetch(`/api/favorite-actors/${personId}`, { method: 'POST', headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      await loadFavoriteActorsForUser(user)
    } catch (error) {
      setFavoriteActorsState((state) => ({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Unable to update favorite actor.' }))
    }
  }

  async function handleToggleFavoriteAuthor(author) {
    const authorId = Number(author?.id)
    if (!Number.isInteger(authorId)) return
    if (!user) return handleOpenLogin()

    try {
      const response = await fetch(`/api/favorite-authors/${authorId}`, { method: 'POST', headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      await loadFavoriteAuthorsForUser(user)
    } catch (error) {
      setFavoriteAuthorsState((state) => ({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Unable to update favorite author.' }))
    }
  }

  async function loadWatchedForUser(nextUser) {
    if (!nextUser?.username) {
      setWatchedState({
        status: 'idle',
        movies: [],
        error: '',
      })
      setMovieStatsState({
        status: 'idle',
        stats: emptyMovieStats,
        error: '',
      })
      return
    }

    setWatchedState((previousState) => ({
      ...previousState,
      status: 'loading',
      error: '',
    }))
    setMovieStatsState((previousState) => ({
      ...previousState,
      status: 'loading',
      error: '',
    }))

    try {
      const response = await fetch(`/api/watched?period=${statsPeriod}`, {
        headers: buildAuthHeaders(nextUser),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      setWatchedState({
        status: 'success',
        movies: Array.isArray(payload.movies) ? payload.movies.map(mapWatchedMoviePayload) : [],
        error: '',
      })
      setMovieStatsState({
        status: 'success',
        stats: mapMovieStatsPayload(payload.stats),
        error: '',
      })
    } catch (error) {
      setWatchedState({
        status: 'error',
        movies: [],
        error: error instanceof Error ? error.message : 'Unable to load your watched movies right now.',
      })
      setMovieStatsState({
        status: 'error',
        stats: emptyMovieStats,
        error: error instanceof Error ? error.message : 'Unable to load your movie stats right now.',
      })
    }
  }

  async function loadTvLibraryForUser(nextUser) {
    if (!nextUser?.username) {
      setTvWatchedIds(new Set())
      setTvWatchlistIds(new Set())
      setTvWatchlistShows([])
      setTvStatsState({ status: 'idle', stats: emptyTvStats, error: '' })
      setContinueWatchingState({ status: 'idle', shows: [], error: '' })
      return
    }
    setTvStatsState((state) => ({ ...state, status: 'loading', error: '' }))
    setContinueWatchingState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch(`/api/tv/library?period=${statsPeriod}`, { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setTvWatchedIds(new Set(payload.watchedIds ?? []))
      setTvWatchlistIds(new Set(payload.watchlistIds ?? []))
      setTvWatchlistShows(Array.isArray(payload.watchlistShows) ? payload.watchlistShows.map(mapTvWatchlistShowPayload) : [])
      setTvStatsState({ status: 'success', stats: mapTvStatsPayload(payload.stats), error: '' })
      setContinueWatchingState({ status: 'success', shows: Array.isArray(payload.continueWatchingShows) ? payload.continueWatchingShows.map(mapContinueWatchingTvShowPayload) : [], error: '' })
    } catch (error) {
      setTvWatchedIds(new Set())
      setTvWatchlistIds(new Set())
      setTvWatchlistShows([])
      setTvStatsState({ status: 'error', stats: emptyTvStats, error: error instanceof Error ? error.message : 'Unable to load TV stats right now.' })
      setContinueWatchingState({ status: 'error', shows: [], error: error instanceof Error ? error.message : 'Unable to load your TV progress right now.' })
    }
  }

  async function loadTvWatchedHistoryForUser(nextUser) {
    if (!nextUser?.username) {
      setTvWatchedHistoryState({ status: 'idle', episodes: [], error: '' })
      return
    }

    setTvWatchedHistoryState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/tv/watched-history', { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setTvWatchedHistoryState({ status: 'success', episodes: Array.isArray(payload.episodes) ? payload.episodes.map(mapWatchedTvEpisodePayload) : [], error: '' })
    } catch (error) {
      setTvWatchedHistoryState({ status: 'error', episodes: [], error: error instanceof Error ? error.message : 'Unable to load watched episode history right now.' })
    }
  }

  async function loadPlayedGamesForUser(nextUser) {
    if (!nextUser?.username) {
      setPlayedGamesState({ status: 'idle', games: [], error: '' })
      return
    }

    setPlayedGamesState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/games/played', { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setPlayedGamesState({ status: 'success', games: Array.isArray(payload.games) ? payload.games.map(mapPlayedGamePayload) : [], error: '' })
    } catch (error) {
      setPlayedGamesState({ status: 'error', games: [], error: error instanceof Error ? error.message : 'Unable to load played games right now.' })
    }
  }

  async function loadGameActivityForUser(nextUser) {
    if (!nextUser?.username) {
      setGameActivityState({ status: 'idle', activity: emptyGameActivity, error: '' })
      return
    }

    setGameActivityState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/games/activity', { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setGameActivityState({
        status: 'success',
        activity: {
          gamesPlayed: Number(payload.gamesPlayed) || 0,
          playtimeMinutes: Number(payload.playtimeMinutes) || 0,
          lastCompletedAt: payload.lastCompletedAt || null,
        },
        error: '',
      })
    } catch (error) {
      setGameActivityState({ status: 'error', activity: emptyGameActivity, error: error instanceof Error ? error.message : 'Unable to load game activity right now.' })
    }
  }

  async function handleAddMovieToWatchlist(movie) {
    const normalizedMovieId = Number(movie?.id)

    if (!Number.isInteger(normalizedMovieId)) {
      return
    }

    if (!user) {
      handleOpenLogin()
      return
    }

    if (watchedState.movies.some((watchedMovie) => Number(watchedMovie.id) === normalizedMovieId)) {
      return
    }

    if (watchlistState.movies.some((watchlistMovie) => Number(watchlistMovie.id) === normalizedMovieId)) {
      return
    }

    setWatchlistActionState({
      status: 'loading',
      movieId: normalizedMovieId,
      error: '',
    })

    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(user),
        },
        body: JSON.stringify({
          movieId: normalizedMovieId,
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      const savedMovie = payload.movie ? mapWatchlistMoviePayload(payload.movie) : null

      setWatchlistState((previousState) => {
        const remainingMovies = previousState.movies.filter((watchlistMovie) => Number(watchlistMovie.id) !== normalizedMovieId)

        return {
          status: 'success',
          movies: savedMovie ? [savedMovie, ...remainingMovies] : remainingMovies,
          books: previousState.books,
          error: '',
        }
      })
      setWatchlistActionState({
        status: 'success',
        movieId: normalizedMovieId,
        error: '',
      })
      updatePersonFilmographyPersonalState('movie', normalizedMovieId, { watchlisted: true, watched: false })
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
      void loadWatchedForUser(user)
    } catch (error) {
      setWatchlistActionState({
        status: 'error',
        movieId: normalizedMovieId,
        error: error instanceof Error ? error.message : 'Unable to add this movie right now.',
      })
    }
  }

  async function handleRemoveMovieFromWatchlist(movie) {
    const normalizedMovieId = Number(movie?.id)

    if (!Number.isInteger(normalizedMovieId) || !user) {
      if (!user) {
        handleOpenLogin()
      }
      return
    }

    setWatchlistActionState({
      status: 'loading',
      movieId: normalizedMovieId,
      error: '',
    })

    try {
      const response = await fetch(`/api/watchlist/${normalizedMovieId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(user),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      setWatchlistState((previousState) => ({
        status: 'success',
        movies: previousState.movies.filter((watchlistMovie) => Number(watchlistMovie.id) !== normalizedMovieId),
        books: previousState.books,
        error: '',
      }))
      setWatchlistActionState({
        status: 'success',
        movieId: normalizedMovieId,
        error: '',
      })
      updatePersonFilmographyPersonalState('movie', normalizedMovieId, { watchlisted: false })
      void loadWatchedForUser(user)
    } catch (error) {
      setWatchlistActionState({
        status: 'error',
        movieId: normalizedMovieId,
        error: error instanceof Error ? error.message : 'Unable to remove this movie right now.',
      })
    }
  }

  async function handleToggleMovieInWatchlist(movie) {
    const normalizedMovieId = Number(movie?.id)

    if (!Number.isInteger(normalizedMovieId)) {
      return
    }

    const isSaved = watchlistState.movies.some((watchlistMovie) => Number(watchlistMovie.id) === normalizedMovieId)

    if (isSaved) {
      await handleRemoveMovieFromWatchlist(movie)
      return
    }

    await handleAddMovieToWatchlist(movie)
  }

  async function handleToggleMovieReleaseReminder(movie) {
    const movieId = Number(movie?.id)
    if (!Number.isInteger(movieId)) return
    if (!user) return handleOpenLogin()

    const hasReleaseReminder = Boolean(movie?.hasReleaseReminder)
    setMovieReleaseReminderActionState({ status: 'loading', movieId, error: '' })
    try {
      const response = await fetch(`/api/movies/${movieId}/release-reminder`, {
        method: hasReleaseReminder ? 'DELETE' : 'POST',
        headers: buildAuthHeaders(user),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)

      setMovieDetailState((state) => (
        state.movie && Number(state.movie.id) === movieId
          ? { ...state, movie: { ...state.movie, hasReleaseReminder: Boolean(payload.hasReleaseReminder) } }
          : state
      ))
      setWatchlistState((state) => ({ ...state, movies: state.movies.map((item) => Number(item.id) === movieId ? { ...item, hasReleaseReminder: Boolean(payload.hasReleaseReminder) } : item) }))
      setMovieReleaseReminderActionState({ status: 'success', movieId, error: '' })
    } catch (error) {
      setMovieReleaseReminderActionState({ status: 'error', movieId, error: error instanceof Error ? error.message : 'Unable to update this release reminder right now.' })
    }
  }

  async function handleSetWatchlistPriority(item, patch) {
    if (!user) return handleOpenLogin()
    const mediaType = item.type === 'Movies' ? 'movie' : item.type === 'TV Shows' ? 'tv' : item.type === 'Books' ? 'book' : null
    if (!mediaType) return
    try {
      const response = await fetch('/api/watchlist/priority', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
        body: JSON.stringify({ mediaType, mediaId: item.id, ...patch }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to update priority')
      await Promise.all([loadWatchlistForUser(user), loadTvLibraryForUser(user)])
    } catch (error) {
      setWatchlistState((state) => ({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Unable to update priority.' }))
    }
  }

  async function handleToggleBookInWatchlist(book) {
    const bookId = String(book?.id || '').trim()
    if (!bookId) return
    if (!user) return handleOpenLogin()

    const isSaved = watchlistState.books.some((watchlistBook) => watchlistBook.id === bookId)
    setBookWatchlistActionState({ status: 'loading', bookId, error: '' })

    try {
      const response = await fetch(isSaved ? `/api/watchlist/books/${encodeURIComponent(bookId)}` : '/api/watchlist/books', {
        method: isSaved ? 'DELETE' : 'POST',
        headers: isSaved ? buildAuthHeaders(user) : { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
        body: isSaved ? undefined : JSON.stringify({ bookId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)

      setWatchlistState((state) => ({
        ...state,
        status: 'success',
        books: isSaved
          ? state.books.filter((watchlistBook) => watchlistBook.id !== bookId)
          : [payload.book ? mapWatchlistBookPayload(payload.book) : mapBookToWatchlistItem(book), ...state.books.filter((watchlistBook) => watchlistBook.id !== bookId)],
        error: '',
      }))
      setBookWatchlistActionState({ status: 'success', bookId, error: '' })
    } catch (error) {
      setBookWatchlistActionState({ status: 'error', bookId, error: error instanceof Error ? error.message : 'Unable to update this book right now.' })
    }
  }

  async function handleToggleBookRead(book, readingFormat = null) {
    const bookId = String(book?.id || '').trim()
    if (!bookId) return
    if (!user) return handleOpenLogin()

    if (!readingFormat) {
      setBookReadingFormatDialogBook(book)
      return
    }
    setBookReadActionState({ status: 'loading', bookId, error: '' })
    try {
      const response = await fetch('/api/read/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
        body: JSON.stringify({ bookId, readingFormat, completionMetadata: book?.metadata ?? {} }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)

      setReadBooksState((state) => ({
        status: 'success',
        books: [payload.book ? mapReadBookPayload(payload.book) : { ...mapBookToWatchlistItem(book), readAt: new Date().toISOString(), readingFormat }, ...state.books.filter((readBook) => readBook.id !== bookId)],
        error: '',
      }))
      setWatchlistState((state) => ({ ...state, books: state.books.filter((watchlistBook) => watchlistBook.id !== bookId) }))
      setBookReadingFormatDialogBook(null)
      receiveAchievementUnlocks(payload.newlyUnlockedBookAchievements)
      setBookReadActionState({ status: 'success', bookId, error: '' })
    } catch (error) {
      setBookReadActionState({ status: 'error', bookId, error: error instanceof Error ? error.message : 'Unable to update this book right now.' })
    }
  }

  async function handleMarkBookUnread(book) {
    const bookId = String(book?.id || '').trim()
    if (!bookId || !user) return
    setBookReadActionState({ status: 'loading', bookId, error: '' })
    try {
      const response = await fetch(`/api/read/books/${encodeURIComponent(bookId)}`, { method: 'DELETE', headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setReadBooksState((state) => ({ ...state, status: 'success', books: state.books.filter((readBook) => readBook.id !== bookId), error: '' }))
      setBookReadActionState({ status: 'success', bookId, error: '' })
    } catch (error) {
      setBookReadActionState({ status: 'error', bookId, error: error instanceof Error ? error.message : 'Unable to mark this book as unread.' })
    }
  }

  async function loadWatchTogetherForUser(nextUser) {
    if (!nextUser?.username) {
      setWatchTogetherState({ status: 'idle', partner: null, pendingRequest: null, users: [], items: [], watchedMovies: [], watchedEpisodes: [], inProgressShows: [], error: '' })
      return
    }
    setWatchTogetherState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/watch-together', { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load Watch Together.')
      setWatchTogetherState({ status: 'success', partner: payload.partner || null, pendingRequest: payload.pendingRequest || null, users: Array.isArray(payload.users) ? payload.users : [], items: Array.isArray(payload.items) ? payload.items : [], watchedMovies: Array.isArray(payload.watchedMovies) ? payload.watchedMovies : [], watchedEpisodes: Array.isArray(payload.watchedEpisodes) ? payload.watchedEpisodes : [], inProgressShows: Array.isArray(payload.inProgressShows) ? payload.inProgressShows : [], error: '' })
    } catch (error) {
      setWatchTogetherState((state) => ({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Unable to load Watch Together.' }))
    }
  }

  async function loadWatchTogetherAchievements(nextUser) {
    if (!nextUser?.username) return setWatchTogetherAchievementsState({ status: 'idle', achievements: [], error: '' })
    setWatchTogetherAchievementsState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/watch-together/achievements', { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load shared achievements.')
      setWatchTogetherAchievementsState({ status: 'success', achievements: Array.isArray(payload.achievements) ? payload.achievements : [], error: '' })
    } catch (error) { setWatchTogetherAchievementsState({ status: 'error', achievements: [], error: error instanceof Error ? error.message : 'Unable to load shared achievements.' }) }
  }

  async function loadWatchTogetherStats(nextUser) {
    if (!nextUser?.username) return setWatchTogetherStatsState({ status: 'idle', stats: null, error: '' })
    setWatchTogetherStatsState((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const timeZone = resolveBrowserTimeZone()
      const response = await fetch(`/api/watch-together/stats?timeZone=${encodeURIComponent(timeZone)}`, { headers: buildAuthHeaders(nextUser) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load shared stats.')
      setWatchTogetherStatsState({ status: 'success', stats: payload, error: '' })
    } catch (error) { setWatchTogetherStatsState({ status: 'error', stats: null, error: error instanceof Error ? error.message : 'Unable to load shared stats.' }) }
  }

  async function handleSaveWatchTogetherSession(item, achievementIds, details = {}) {
    if (!user?.username) return false
    const response = await fetch('/api/watch-together/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify({ mediaType: item.mediaType, mediaId: item.id, episodeId: item.episodeId || null, achievementIds, details }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to save shared session details.')
    receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
    await loadWatchTogetherAchievements(user)
    return true
  }

  async function handleChooseWatchTogetherPartner(username) {
    if (!user?.username || !username) return
    setWatchTogetherAction({ status: 'loading', key: 'partner', error: '' })
    try {
      const response = await fetch('/api/watch-together/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify({ username }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to send your Watch Together request.')
      setWatchTogetherSearch((state) => ({ ...state, items: [], status: 'idle', error: '' }))
      setWatchTogetherTab('movies')
      await loadWatchTogetherForUser(user)
      setWatchTogetherAction({ status: 'success', key: 'partner', error: '' })
    } catch (error) { setWatchTogetherAction({ status: 'error', key: 'partner', error: error instanceof Error ? error.message : 'Unable to send your Watch Together request.' }) }
  }

  async function handleWatchTogetherRequestResponse(requestId, decision) {
    if (!user?.username) return
    setWatchTogetherAction({ status: 'loading', key: `request-${requestId}`, error: '' })
    try {
      const response = await fetch(`/api/watch-together/requests/${requestId}/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify({ decision }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to respond to the Watch Together request.')
      await Promise.all([loadAlertsForUser(user), loadWatchTogetherForUser(user)])
      setWatchTogetherAction({ status: 'success', key: `request-${requestId}`, error: '' })
    } catch (error) { setWatchTogetherAction({ status: 'error', key: `request-${requestId}`, error: error instanceof Error ? error.message : 'Unable to respond to the Watch Together request.' }) }
  }

  async function handleResetWatchTogether() {
    if (!user?.username) return false
    setWatchTogetherAction({ status: 'loading', key: 'reset', error: '' })
    try {
      const response = await fetch('/api/watch-together/partner', { method: 'DELETE', headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to reset Watch Together.')
      setWatchTogetherSearch({ query: '', type: 'all', status: 'idle', items: [], error: '' })
      await loadWatchTogetherForUser(user)
      setWatchTogetherAction({ status: 'success', key: 'reset', error: '' })
      return true
    } catch (error) { setWatchTogetherAction({ status: 'error', key: 'reset', error: error instanceof Error ? error.message : 'Unable to reset Watch Together.' }); return false }
  }

  async function handleWatchTogetherSearch() {
    const query = watchTogetherSearch.query.trim()
    if (!query || !user?.username) return
    setWatchTogetherSearch((state) => ({ ...state, status: 'loading', error: '' }))
    try {
      const response = await fetch(`/api/watch-together/search?q=${encodeURIComponent(query)}&type=${watchTogetherSearch.type}`, { headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to search titles.')
      setWatchTogetherSearch((state) => ({ ...state, status: 'success', items: Array.isArray(payload.items) ? payload.items : [], error: '' }))
    } catch (error) { setWatchTogetherSearch((state) => ({ ...state, status: 'error', items: [], error: error instanceof Error ? error.message : 'Unable to search titles.' })) }
  }

  async function handleWatchTogetherItem(action, item = null) {
    if (!user?.username) return
    const key = item ? `${action}-${item.mediaType}-${item.id}` : action
    setWatchTogetherAction({ status: 'loading', key, error: '' })
    try {
      let path = '/api/watch-together/selection'; let method = 'DELETE'; let body
      if (action === 'add') { path = '/api/watch-together/items'; method = 'POST'; body = { mediaType: item.mediaType, mediaId: item.id } }
      if (action === 'remove') { path = `/api/watch-together/items/${item.mediaType}/${item.id}`; method = 'DELETE' }
      if (action === 'select') { path = '/api/watch-together/selection'; method = 'PUT'; body = { mediaType: item.mediaType, mediaId: item.id } }
      if (action === 'accept' || action === 'deny') { path = `/api/watch-together/selection/${item.mediaType}/${item.id}/respond`; method = 'POST'; body = { decision: action } }
      const response = await fetch(path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...buildAuthHeaders(user) }, ...(body ? { body: JSON.stringify(body) } : {}) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to update the shared shortlist.')
      await loadWatchTogetherForUser(user)
      setWatchTogetherAction({ status: 'success', key, error: '' })
    } catch (error) { setWatchTogetherAction({ status: 'error', key, error: error instanceof Error ? error.message : 'Unable to update the shared shortlist.' }) }
  }

  async function handleWatchTogetherEpisodeWatched(item, watchService) {
    if (!user?.username || !Number.isInteger(Number(item?.episodeId))) return false
    const key = `watch-tv-${item.episodeId}`
    setWatchTogetherAction({ status: 'loading', key, error: '' })
    try {
      const response = await fetch(`/api/watch-together/episodes/${item.episodeId}/watched`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify({ watchService }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to mark this shared episode watched.')
      await Promise.all([loadTvLibraryForUser(user), loadTvWatchedHistoryForUser(user)])
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
      const confirmationStatus = payload.watchTogether?.status || 'waiting_for_partner'
      if (confirmationStatus !== 'completed') await loadWatchTogetherForUser(user)
      await loadWatchTogetherAchievements(user)
      setWatchTogetherAction({ status: 'success', key, error: '' })
      return confirmationStatus
    } catch (error) {
      setWatchTogetherAction({ status: 'error', key, error: error instanceof Error ? error.message : 'Unable to mark this shared episode watched.' })
      return false
    }
  }

  useEffect(() => {
    loadWatchlistForUser(user)
    loadReadBooksForUser(user)
    loadWatchedForUser(user)
    loadTvLibraryForUser(user)
    loadFavoriteActorsForUser(user)
    loadFavoriteAuthorsForUser(user)
    loadAlertsForUser(user)
  }, [user, statsPeriod])

  useEffect(() => {
    if (activeView === primaryViews.watchTogether) { loadWatchTogetherForUser(user); loadWatchTogetherAchievements(user) }
  }, [activeView, user])

  useEffect(() => {
    if (activeView === primaryViews.watchTogether && watchTogetherTab === 'stats') loadWatchTogetherStats(user)
  }, [activeView, watchTogetherTab, user])

  useEffect(() => {
    loadTvWatchedHistoryForUser(user)
    loadPlayedGamesForUser(user)
  }, [user])

  useEffect(() => {
    if (activeView === primaryViews.games) loadGameActivityForUser(user)
  }, [activeView, user])

  useEffect(() => {
    if (activeView !== primaryViews.stats || !user?.username) {
      if (!user?.username) setStatsInsightsState({ status: 'idle', insights: emptyStatsInsights, error: '' })
      return
    }

    let cancelled = false

    async function loadStatsInsights() {
      setStatsInsightsState((state) => ({ ...state, status: 'loading', error: '' }))

      try {
        const timeZone = resolveBrowserTimeZone()
        const response = await fetch(`/api/stats/insights?period=${statsPeriod}&timeZone=${encodeURIComponent(timeZone)}`, {
          headers: buildAuthHeaders(user),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) setStatsInsightsState({ status: 'success', insights: mapStatsInsightsPayload(payload), error: '' })
      } catch (error) {
        if (!cancelled) setStatsInsightsState({ status: 'error', insights: emptyStatsInsights, error: error instanceof Error ? error.message : 'Unable to load stats insights right now.' })
      }
    }

    loadStatsInsights()

    return () => {
      cancelled = true
    }
  }, [activeView, statsPeriod, user])

  useEffect(() => {
    if (activeView !== primaryViews.stats || !user?.username) {
      if (!user?.username) setBookStatsState({ status: 'idle', stats: emptyBookStats, error: '' })
      return
    }
    let cancelled = false
    setBookStatsState((state) => ({ ...state, status: 'loading', error: '' }))
    fetch(`/api/stats/books?period=${statsPeriod}`, { headers: buildAuthHeaders(user) })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload.error || 'Unable to load book stats.')
        if (!cancelled) setBookStatsState({ status: 'success', stats: mapBookStatsPayload(payload), error: '' })
      })
      .catch((error) => {
        if (!cancelled) setBookStatsState({ status: 'error', stats: emptyBookStats, error: error instanceof Error ? error.message : 'Unable to load book stats right now.' })
      })
    return () => { cancelled = true }
  }, [activeView, statsPeriod, user])

  useEffect(() => {
    if (![primaryViews.achievements, primaryViews.stats].includes(activeView) || !user?.username) return
    let cancelled = false
    setAchievementsState((state) => ({ ...state, status: 'loading', error: '' }))
    fetch('/api/achievements', { headers: buildAuthHeaders(user) })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload.error || 'Unable to load achievements.')
        if (!cancelled) setAchievementsState({ status: 'success', achievements: Array.isArray(payload.achievements) ? payload.achievements : [], error: '' })
      })
      .catch((error) => { if (!cancelled) setAchievementsState({ status: 'error', achievements: [], error: error instanceof Error ? error.message : 'Unable to load achievements.' }) })
    return () => { cancelled = true }
  }, [activeView, user])

  useEffect(() => {
    if (![primaryViews.games, primaryViews.stats].includes(activeView) || !user?.username) return
    let cancelled = false
    setBookAchievementsState((state) => ({ ...state, status: 'loading', error: '' }))
    fetch('/api/book-achievements', { headers: buildAuthHeaders(user) })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload.error || 'Unable to load book achievements.')
        if (!cancelled) setBookAchievementsState({ status: 'success', achievements: Array.isArray(payload.achievements) ? payload.achievements : [], error: '' })
      })
      .catch((error) => { if (!cancelled) setBookAchievementsState({ status: 'error', achievements: [], error: error instanceof Error ? error.message : 'Unable to load book achievements.' }) })
    return () => { cancelled = true }
  }, [activeView, user, bookReadActionState.status, bookRatingActionState.status])

  useEffect(() => {
    if (activeView !== primaryViews.stats || !user?.username) return
    let cancelled = false
    setGameAchievementsState((state) => ({ ...state, status: 'loading', error: '' }))
    fetch('/api/game-achievements', { headers: buildAuthHeaders(user) })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => { if (!response.ok) throw new Error(payload.error || 'Unable to load game achievements.'); if (!cancelled) setGameAchievementsState({ status: 'success', achievements: Array.isArray(payload.achievements) ? payload.achievements : [], error: '' }) })
      .catch((error) => { if (!cancelled) setGameAchievementsState({ status: 'error', achievements: [], error: error instanceof Error ? error.message : 'Unable to load game achievements.' }) })
    return () => { cancelled = true }
  }, [activeView, user, gameRatingActionState.status, gameTrackingActionState.status])

  function receiveAchievementUnlocks(items) {
    if (!Array.isArray(items) || !items.length) return
    setAchievementToast(items[0])
    window.setTimeout(() => setAchievementToast(null), 4500)
  }

  async function handleAddMovieToWatched(movie, watchService = null, { deferWatchTogetherRefresh = false, watchTogether = false } = {}) {
    const normalizedMovieId = Number(movie?.id)

    if (!Number.isInteger(normalizedMovieId)) {
      return
    }

    if (!user) {
      handleOpenLogin()
      return
    }

    setWatchedActionState({
      status: 'loading',
      movieId: normalizedMovieId,
      error: '',
    })

    try {
      const response = await fetch(`/api/watched?period=${statsPeriod}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(user),
        },
        body: JSON.stringify({
          movieId: normalizedMovieId,
          watchService,
          ...(watchTogether ? { watchTogether: true } : {}),
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      const watchedMovie = payload.movie ? mapWatchedMoviePayload(payload.movie) : null

      setWatchedState((previousState) => {
        const remainingMovies = previousState.movies.filter((currentMovie) => Number(currentMovie.id) !== normalizedMovieId)

        return {
          status: 'success',
          movies: watchedMovie ? [watchedMovie, ...remainingMovies] : remainingMovies,
          error: '',
        }
      })
      setWatchlistState((previousState) => ({
        ...previousState,
        movies: previousState.movies.filter((watchlistMovie) => Number(watchlistMovie.id) !== normalizedMovieId),
      }))
      setMovieStatsState({
        status: 'success',
        stats: mapMovieStatsPayload(payload.stats),
        error: '',
      })
      setWatchedActionState({
        status: 'success',
        movieId: normalizedMovieId,
        error: '',
      })
      updatePersonFilmographyPersonalState('movie', normalizedMovieId, { watched: true, watchlisted: false })
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
      // Do not unmount the completed title before the confirming partner can
      // rate it. The rating dialog refreshes the shared state when it closes.
      if (activeView === primaryViews.watchTogether && !deferWatchTogetherRefresh && payload.watchTogether?.status !== 'completed') void loadWatchTogetherForUser(user)
      if (payload.watchTogether?.status === 'completed') void loadWatchTogetherAchievements(user)
      return true
    } catch (error) {
      setWatchedActionState({
        status: 'error',
        movieId: normalizedMovieId,
        error: error instanceof Error ? error.message : 'Unable to mark this movie as watched right now.',
      })
      return false
    }
  }

  async function handleRemoveMovieFromWatched(movie) {
    const normalizedMovieId = Number(movie?.id)

    if (!Number.isInteger(normalizedMovieId) || !user) {
      if (!user) {
        handleOpenLogin()
      }
      return
    }

    setWatchedActionState({
      status: 'loading',
      movieId: normalizedMovieId,
      error: '',
    })

    try {
      const response = await fetch(`/api/watched/${normalizedMovieId}?period=${statsPeriod}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(user),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      setWatchedState((previousState) => ({
        status: 'success',
        movies: previousState.movies.filter((watchedMovie) => Number(watchedMovie.id) !== normalizedMovieId),
        error: '',
      }))
      setMovieStatsState({
        status: 'success',
        stats: mapMovieStatsPayload(payload.stats),
        error: '',
      })
      setWatchedActionState({
        status: 'success',
        movieId: normalizedMovieId,
        error: '',
      })
      updatePersonFilmographyPersonalState('movie', normalizedMovieId, { watched: false })
    } catch (error) {
      setWatchedActionState({
        status: 'error',
        movieId: normalizedMovieId,
        error: error instanceof Error ? error.message : 'Unable to remove this watched movie right now.',
      })
    }
  }

  async function handleToggleMovieWatched(movie, watchService = null) {
    const normalizedMovieId = Number(movie?.id)

    if (!Number.isInteger(normalizedMovieId)) {
      return
    }

    const isWatched = watchedState.movies.some((watchedMovie) => Number(watchedMovie.id) === normalizedMovieId)

    if (isWatched) {
      return handleRemoveMovieFromWatched(movie)
    }

    return handleAddMovieToWatched(movie, watchService)
  }

  async function handleSubmitMovieRating(movie, score) {
    const movieId = Number(movie?.id)
    if (!Number.isInteger(movieId)) return false

    if (!user) {
      handleOpenLogin()
      return false
    }

    setMovieRatingActionState({ status: 'loading', movieId, error: '' })

    try {
      const response = await fetch(`/api/movies/${movieId}/rating`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
        body: JSON.stringify({ score }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)

      const communityRating = mapCommunityRatingPayload(payload.communityRating)
      setMovieDetailState((previousState) => (
        Number(previousState.movie?.id) === movieId
          ? { ...previousState, movie: { ...previousState.movie, communityRating } }
          : previousState
      ))
      setMovieRatingActionState({ status: 'success', movieId, error: '' })
      receiveAchievementUnlocks(payload.newlyUnlockedAchievements)
      return true
    } catch (error) {
      setMovieRatingActionState({
        status: 'error',
        movieId,
        error: error instanceof Error ? error.message : 'Unable to save your rating right now.',
      })
      return false
    }
  }

  async function handleSubmitBookRating(book, score) {
    const bookId = String(book?.id || '').trim()
    if (!bookId) return false
    if (!user) {
      handleOpenLogin()
      return false
    }

    setBookRatingActionState({ status: 'loading', bookId, error: '' })
    try {
      const response = await fetch(`/api/books/${encodeURIComponent(bookId)}/rating`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
        body: JSON.stringify({ score }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      const communityRating = mapCommunityRatingPayload(payload.communityRating)
      setBookDetailState((state) => state.book?.id === bookId ? { ...state, book: { ...state.book, communityRating } } : state)
      setBookRatingActionState({ status: 'success', bookId, error: '' })
      receiveAchievementUnlocks(payload.newlyUnlockedBookAchievements)
      return true
    } catch (error) {
      setBookRatingActionState({ status: 'error', bookId, error: error instanceof Error ? error.message : 'Unable to save your rating right now.' })
      return false
    }
  }

  useEffect(() => {
    if (currentScreen !== appScreens.admin) {
      return
    }

    let cancelled = false

    async function loadAdminOverview() {
      setAdminOverviewState((previousState) => ({
        ...previousState,
        status: 'loading',
        error: '',
      }))

      try {
        const response = await fetch('/api/admin/overview', { headers: buildAuthHeaders(user) })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload.error || `Request failed with status ${response.status}`)
        }

        if (!cancelled) {
          setAdminOverviewState({
            status: 'success',
            crons: Array.isArray(payload.crons) ? payload.crons : [],
            totalActors: typeof payload?.totals?.actors === 'number' ? payload.totals.actors : 0,
            totalBooks: typeof payload?.totals?.books === 'number' ? payload.totals.books : 0,
            totalGames: typeof payload?.totals?.games === 'number' ? payload.totals.games : 0,
            totalMovies: typeof payload?.totals?.movies === 'number' ? payload.totals.movies : 0,
            totalNewsArticles: typeof payload?.totals?.newsArticles === 'number' ? payload.totals.newsArticles : 0,
            storedDataBytes: typeof payload?.totals?.storedDataBytes === 'number' ? payload.totals.storedDataBytes : 0,
            totalTvShows: typeof payload?.totals?.tvShows === 'number' ? payload.totals.tvShows : 0,
            filelist: { configured: Boolean(payload?.filelist?.configured), updatedAt: payload?.filelist?.updatedAt ?? null },
            igdb: { configured: Boolean(payload?.igdb?.configured), updatedAt: payload?.igdb?.updatedAt ?? null },
            rssSources: Array.isArray(payload?.rssSources) ? payload.rssSources : [],
            sections: { enabled: normalizeEnabledSections(payload?.sections?.enabled) },
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setAdminOverviewState((previousState) => ({
            ...previousState,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unable to load admin details right now.',
          }))
        }
      }
    }

    loadAdminOverview()

    return () => {
      cancelled = true
    }
  }, [currentScreen, adminRefreshKey, user])

  async function handleRunAdminJob(jobKey) {
    const currentRunState = adminRunState[jobKey] ?? adminRunIdleState

    if (currentRunState.status === 'loading') {
      return
    }

    setAdminRunState((previousState) => ({
      ...previousState,
      [jobKey]: {
        status: 'loading',
        message: '',
      },
    }))

    try {
      const response = await fetch(`/api/admin/jobs/${jobKey}/run`, {
        method: 'POST',
        headers: buildAuthHeaders(user),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      if (typeof payload.activeTheme === 'string') {
        const scheduledTheme = applyActiveTheme(payload.activeTheme)
        setActiveTheme(scheduledTheme)
        const scheduledThemeName = scheduledTheme === defaultThemeKey ? 'the default theme' : seasonalThemes.find((theme) => theme.key === scheduledTheme)?.name ?? scheduledTheme
        setAdminRunState((previousState) => ({
          ...previousState,
          [jobKey]: {
            status: 'success',
            message: payload.changed ? `Scheduler applied ${scheduledThemeName}.` : `Scheduler kept ${scheduledThemeName}.`,
          },
        }))
        setAdminRefreshKey((value) => value + 1)
        return
      }

      const isRssJob = jobKey === 'entertainment-news'
      const isNewsCleanupJob = jobKey === 'news-cleanup'
      setAdminRunState((previousState) => ({
        ...previousState,
        [jobKey]: {
          status: 'success',
          message: isNewsCleanupJob
            ? `Removed ${payload.deletedCount ?? 0} expired unlinked, unsaved article${payload.deletedCount === 1 ? '' : 's'}.`
            : isRssJob
            ? `Fetched ${payload.fetchedCount} articles from ${payload.activeSourceCount ?? 0} active source${payload.activeSourceCount === 1 ? '' : 's'}: ${payload.insertedCount} new, ${payload.updatedCount} refreshed.`
            : `Imported ${payload.fetchedCount} titles: ${payload.insertedCount} new, ${payload.updatedCount} refreshed.`,
        },
      }))
      setAdminRefreshKey((value) => value + 1)
    } catch (error) {
      setAdminRunState((previousState) => ({
        ...previousState,
        [jobKey]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to run this job right now.',
        },
      }))
    }
  }

  async function handleSetRssSourceEnabled(sourceKey, enabled) {
    const response = await fetch(`/api/admin/rss-sources/${sourceKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
      body: JSON.stringify({ enabled }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
    setAdminOverviewState((previousState) => ({
      ...previousState,
      rssSources: previousState.rssSources.map((source) => source.key === sourceKey ? payload : source),
    }))
    setAdminRefreshKey((value) => value + 1)
    return payload
  }

  async function handleSaveFilelistSettings({ username, passkey }) {
    const response = await fetch('/api/admin/filelist', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify({ username, passkey }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
    setAdminRefreshKey((value) => value + 1)
  }

  async function handleClearFilelistSettings() {
    const response = await fetch('/api/admin/filelist', { method: 'DELETE', headers: buildAuthHeaders(user) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
    setAdminRefreshKey((value) => value + 1)
  }

  async function handleSaveIgdbSettings({ clientId, privateKey }) {
    const response = await fetch('/api/admin/igdb', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) }, body: JSON.stringify({ clientId, privateKey }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
    setAdminRefreshKey((value) => value + 1)
  }

  async function handleClearIgdbSettings() {
    const response = await fetch('/api/admin/igdb', { method: 'DELETE', headers: buildAuthHeaders(user) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
    setAdminRefreshKey((value) => value + 1)
  }

  async function handleSaveEnabledSections(nextEnabledSections) {
    const response = await fetch('/api/admin/preferences/sections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
      body: JSON.stringify({ enabledSections: nextEnabledSections }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
    const enabled = normalizeEnabledSections(payload.enabled)
    setEnabledSections(enabled)
    setAdminOverviewState((previousState) => ({ ...previousState, sections: { enabled } }))
    return enabled
  }

  async function handleSetActiveTheme(nextTheme) {
    const pendingTheme = nextTheme === defaultThemeKey ? activeTheme : nextTheme
    setThemeState({ status: 'loading', pendingTheme, error: '', message: '' })
    try {
      const response = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
        body: JSON.stringify({ activeTheme: nextTheme }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      const savedTheme = applyActiveTheme(payload.activeTheme)
      setActiveTheme(savedTheme)
      setThemeState({
        status: 'success',
        pendingTheme: null,
        error: '',
        message: savedTheme === defaultThemeKey ? 'Seasonal theme deactivated.' : 'Autumn theme activated for everyone.',
      })
      return savedTheme
    } catch (error) {
      setThemeState({ status: 'error', pendingTheme: null, error: error instanceof Error ? error.message : 'Unable to update the site theme.', message: '' })
      return null
    }
  }

  useEffect(() => {
    tmdbSearchRequestId.current += 1
    tmdbSearchStartedQueryRef.current = ''
    setTmdbSearchState({ status: 'idle', movies: [], shows: [], error: '' })
    googleBooksSearchRequestId.current += 1
    googleBooksSearchStartedQueryRef.current = ''
    setGoogleBooksSearchState({ status: 'idle', books: [], error: '', persistingBookId: null })
    igdbSearchRequestId.current += 1
    igdbSearchStartedQueryRef.current = ''
    setIgdbSearchState({ status: 'idle', games: [], error: '' })
    setActiveSearchSource('watchvault')

    if (currentRoute.kind !== routeKinds.search || !currentRoute.query) {
      setSearchResultsState({
        status: 'idle',
        movies: [],
        shows: [],
        actors: [],
        books: [],
        games: [],
        error: '',
      })
      return
    }

    let cancelled = false

    async function loadSearchResults() {
      setSearchResultsState({
        status: 'loading',
        movies: [],
        shows: [],
        actors: [],
        books: [],
        games: [],
        error: '',
      })

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(currentRoute.query)}`)
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload.error || `Request failed with status ${response.status}`)
        }

        if (!cancelled) {
          setSearchResultsState({
            status: 'success',
            movies: Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : [],
            shows: Array.isArray(payload.shows) ? payload.shows.map(mapTvRowToCard) : [],
            actors: Array.isArray(payload.actors) ? payload.actors.map(mapSearchActorPayload) : [],
            books: Array.isArray(payload.books) ? payload.books.map(mapBookRowToCard) : [],
            games: Array.isArray(payload.games) ? payload.games.map(mapGamePayload) : [],
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setSearchResultsState({
            status: 'error',
            movies: [],
            shows: [],
            actors: [],
            books: [],
            games: [],
            error: error instanceof Error ? error.message : 'Unable to search right now.',
          })
        }
      }
    }

    loadSearchResults()

    return () => {
      cancelled = true
    }
  }, [currentRoute])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.movieDetail) {
      setMovieDetailState({
        status: 'hidden',
        movie: null,
        error: '',
      })
      setSimilarMoviesState({
        status: 'hidden',
        movies: [],
        error: '',
      })
      return
    }

    let cancelled = false

    async function loadMovieDetail() {
      setMovieDetailState({
        status: 'loading',
        movie: null,
        error: '',
      })

      try {
        const response = await fetch(`/api/movies/${currentRoute.movieId}`, { headers: buildAuthHeaders(user) })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          if (response.status === 404) {
            const previewMovie = readMoviePreviewFromHistory(currentRoute.movieId)

            if (previewMovie && !cancelled) {
              setMovieDetailState({
                status: 'success',
                movie: mapMoviePreviewToDetail(previewMovie),
                error: '',
              })
              return
            }
          }

          throw new Error(payload.error || `Request failed with status ${response.status}`)
        }

        if (!cancelled) {
          setMovieDetailState({
            status: 'success',
            movie: mapMovieDetailPayload(payload.movie),
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setMovieDetailState({
            status: 'error',
            movie: null,
            error: error instanceof Error ? error.message : 'Unable to load the movie detail right now.',
          })
        }
      }
    }

    loadMovieDetail()

    return () => {
      cancelled = true
    }
  }, [currentRoute, user])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.gameDetail) {
      setGameDetailState({ status: 'hidden', game: null, error: '' })
      return
    }
    let cancelled = false
    async function loadGameDetail() {
      setGameDetailState({ status: 'loading', game: null, error: '' })
      try {
        const response = await fetch(`/api/games/${currentRoute.gameId}`, { headers: buildAuthHeaders(user) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) setGameDetailState({ status: 'success', game: mapGameDetailPayload(payload.game), error: '' })
      } catch (error) {
        if (!cancelled) setGameDetailState({ status: 'error', game: null, error: error instanceof Error ? error.message : 'Unable to load the game detail right now.' })
      }
    }
    loadGameDetail()
    return () => { cancelled = true }
  }, [currentRoute, user])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.gameDetail) {
      setSimilarGamesState({ status: 'hidden', games: [], source: null, error: '' })
      return
    }
    if (gameDetailState.status !== 'success' || Number(gameDetailState.game?.id) !== Number(currentRoute.gameId)) {
      setSimilarGamesState({ status: 'idle', games: [], source: null, error: '' })
      return
    }
    let cancelled = false
    async function loadSimilarGames() {
      setSimilarGamesState({ status: 'loading', games: [], source: null, error: '' })
      try {
        const response = await fetch(`/api/games/${currentRoute.gameId}/similar`)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) setSimilarGamesState({ status: 'success', games: Array.isArray(payload.games) ? payload.games.map(mapSimilarGamePayload) : [], source: payload.source || null, error: '' })
      } catch (error) {
        if (!cancelled) setSimilarGamesState({ status: 'error', games: [], source: null, error: error instanceof Error ? error.message : 'Unable to load similar games right now.' })
      }
    }
    loadSimilarGames()
    return () => { cancelled = true }
  }, [currentRoute, gameDetailState.game?.id, gameDetailState.status])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.bookDetail) {
      setRelatedBooksState({ status: 'hidden', books: [], error: '', persistingBookId: null })
      return
    }

    let cancelled = false
    async function loadRelatedBooks() {
      setRelatedBooksState({ status: 'loading', books: [], error: '', persistingBookId: null })
      try {
        const response = await fetch(`/api/books/${encodeURIComponent(currentRoute.bookId)}/related`)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) setRelatedBooksState({ status: 'success', books: Array.isArray(payload.books) ? payload.books.map(mapGoogleBookToCard) : [], error: '', persistingBookId: null })
      } catch (error) {
        if (!cancelled) setRelatedBooksState({ status: 'error', books: [], error: error instanceof Error ? error.message : 'Unable to load related books right now.', persistingBookId: null })
      }
    }
    loadRelatedBooks()
    return () => { cancelled = true }
  }, [currentRoute])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.movieDetail) {
      return
    }

    let cancelled = false

    async function loadSimilarMovies() {
      setSimilarMoviesState({
        status: 'loading',
        movies: [],
        error: '',
      })

      try {
        const response = await fetch(`/api/movies/${currentRoute.movieId}/similar`)
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          if (response.status === 404) {
            const fallbackMovies = await loadFallbackSimilarMovies(currentRoute.movieId)

            if (!cancelled) {
              setSimilarMoviesState({
                status: 'success',
                movies: fallbackMovies,
                error: '',
              })
            }
            return
          }

          throw new Error(payload.error || `Request failed with status ${response.status}`)
        }

        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToSimilarCard) : []

        if (!cancelled) {
          setSimilarMoviesState({
            status: 'success',
            movies,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setSimilarMoviesState({
            status: 'error',
            movies: [],
            error: error instanceof Error ? error.message : 'Unable to load related movies right now.',
          })
        }
      }
    }

    loadSimilarMovies()

    return () => {
      cancelled = true
    }
  }, [currentRoute])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.personDetail) {
      setPersonDetailState({
        status: 'hidden',
        person: null,
        knownFor: [],
        filmography: [],
        coStars: [],
        facts: [],
        personalHistory: null,
        error: '',
      })
      return
    }

    let cancelled = false

    async function loadPersonDetail() {
      setPersonDetailState((previousState) => ({
        ...previousState,
        status: 'loading',
        error: '',
      }))

      try {
        const response = await fetch(`/api/people/${currentRoute.personId}`, { headers: buildAuthHeaders(user) })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          const previewPerson = readPersonPreviewFromHistory(currentRoute.personId)

          if (previewPerson && !cancelled) {
            setPersonDetailState({
              status: 'success',
              person: mapPersonPreview(previewPerson),
              knownFor: [],
              filmography: [],
              coStars: [],
              facts: [],
              personalHistory: null,
              error: '',
            })
            return
          }

          throw new Error(payload.error || `Request failed with status ${response.status}`)
        }

        if (!cancelled) {
          setPersonDetailState({
            status: 'success',
            person: mapPersonDetailPayload(payload.person),
            knownFor: Array.isArray(payload.knownFor) ? payload.knownFor.map(mapPersonMovieCredit) : [],
            filmography: Array.isArray(payload.filmography) ? payload.filmography.map(mapPersonFilmographyRow) : [],
            coStars: Array.isArray(payload.coStars) ? payload.coStars.map(mapPersonCoStar) : [],
            facts: Array.isArray(payload.facts) ? payload.facts : [],
            personalHistory: mapPersonHistoryPayload(payload.personalHistory),
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setPersonDetailState({
            status: 'error',
            person: null,
            knownFor: [],
            filmography: [],
            coStars: [],
            facts: [],
            personalHistory: null,
            error: error instanceof Error ? error.message : 'Unable to load the person detail right now.',
          })
        }
      }
    }

    loadPersonDetail()

    return () => {
      cancelled = true
    }
  }, [currentRoute, user, personDetailRefreshKey])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.tvDetail) {
      setTvDetailState({ status: 'hidden', show: null, error: '' })
      return
    }
    let cancelled = false
    setTvDetailState({ status: 'loading', show: null, error: '' })
    fetch(`/api/tv/${currentRoute.showId}`, { headers: buildAuthHeaders(user) })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Unable to load TV show detail')
        if (!cancelled) setTvDetailState({ status: 'success', show: mapTvDetailPayload(payload.show), error: '' })
      })
      .catch((error) => { if (!cancelled) setTvDetailState({ status: 'error', show: null, error: error.message }) })
    return () => { cancelled = true }
  }, [currentRoute, user])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.tvDetail) return
    let cancelled = false
    setTvReviewsState({ status: 'loading', reviews: [], error: '' })
    fetch(`/api/tv/${currentRoute.showId}/reviews`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Unable to load reviews')
        if (!cancelled) setTvReviewsState({ status: 'success', reviews: Array.isArray(payload.reviews) ? payload.reviews : [], error: '' })
      })
      .catch((error) => { if (!cancelled) setTvReviewsState({ status: 'error', reviews: [], error: error.message }) })
    return () => { cancelled = true }
  }, [currentRoute])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.calendar) {
      setCalendarState({ status: 'idle', events: [], upcoming: [], error: '' })
      return
    }

    if (!user) {
      setCalendarState({ status: 'signed-out', events: [], upcoming: [], error: '' })
      return
    }

    let cancelled = false

    async function loadCalendar() {
      setCalendarState({ status: 'loading', events: [], upcoming: [], error: '' })
      try {
        const response = await fetch(`/api/calendar?month=${encodeURIComponent(calendarMonth)}&mediaType=${calendarMediaType}&today=${getLocalIsoDate()}`, {
          headers: buildAuthHeaders(user),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) {
          const events = Array.isArray(payload.events) ? payload.events.map(mapCalendarEventPayload) : []
          setCalendarState({
            status: 'success',
            events,
            upcoming: Array.isArray(payload.upcoming) ? payload.upcoming.map(mapCalendarEventPayload) : [],
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) setCalendarState({ status: 'error', events: [], upcoming: [], error: error instanceof Error ? error.message : 'Unable to load your calendar.' })
      }
    }

    loadCalendar()
    return () => { cancelled = true }
  }, [calendarMediaType, calendarMonth, currentRoute, user])

  useEffect(() => {
    let cancelled = false

    async function loadGenres() {
      setGenresState((previousState) => ({
        ...previousState,
        status: 'loading',
        error: '',
      }))

      try {
        const response = await fetch('/api/genres')

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const genres = Array.isArray(payload.genres) ? payload.genres.map(mapGenrePayload) : []

        if (!cancelled) {
          setGenresState({
            status: 'success',
            genres,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setGenresState({
            status: 'error',
            genres: [],
            error: error instanceof Error ? error.message : 'Unable to load genres right now.',
          })
        }
      }
    }

    loadGenres()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeView !== primaryViews.movies && activeView !== primaryViews.home) {
      return
    }

    let cancelled = false

    async function loadPopularMovies() {
      setPopularMoviesState(createMovieCollectionLoadingState({ page: popularMoviesPage, includeFeaturedMovie: true }))
      const hideWatched = Boolean(user) && hideWatchedMovies && activeView === primaryViews.movies && moviesScreenMode === movieScreenModes.popularList

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies', popularMoviesPage, moviesPageSize, { hideWatched: hideWatched ? 'true' : undefined }), { headers: buildAuthHeaders(user) })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []
        const featuredMovie = payload.featuredMovie ? mapFeaturedMoviePayload(payload.featuredMovie) : null
        const pagination = mapPaginationPayload(payload.pagination, popularMoviesPage)

        if (!cancelled) {
          setPopularMoviesState({
            status: 'success',
            movies,
            featuredMovie,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setPopularMoviesState({
            status: 'error',
            movies: [],
            featuredMovie: null,
            pagination: createPaginationState(popularMoviesPage),
            error: error instanceof Error ? error.message : 'Unable to load movies right now.',
          })
        }
      }
    }

    loadPopularMovies()

    return () => {
      cancelled = true
    }
  }, [activeView, hideWatchedMovies, moviesScreenMode, popularMoviesPage, user, watchedState.movies])

  useEffect(() => {
    if (activeView !== primaryViews.books) return
    let cancelled = false
    async function loadBooks() {
      setBooksState(createBookCollectionLoadingState(booksPage))
      try {
        const response = await fetch(buildMoviesApiPath('/api/books', booksPage))
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) setBooksState({ status: 'success', books: Array.isArray(payload.books) ? payload.books.map(mapBookRowToCard) : [], pagination: mapPaginationPayload(payload.pagination, booksPage), error: '' })
      } catch (error) {
        if (!cancelled) setBooksState({ status: 'error', books: [], pagination: createPaginationState(booksPage), error: error instanceof Error ? error.message : 'Unable to load books right now.' })
      }
    }
    loadBooks()
    return () => { cancelled = true }
  }, [activeView, booksPage])

  useEffect(() => {
    if (activeView !== primaryViews.games) return

    let cancelled = false
    if (activeGamesTab === 'favorites') return () => { cancelled = true }

    if (activeGamesTab === 'all') {
      async function loadGamesDashboard() {
        setGamesDashboardState(createGamesDashboardLoadingState())
        try {
          const [popularResponse, recentResponse, upcomingResponse] = await Promise.all([
            fetch(buildMoviesApiPath('/api/games', 1, 6)),
            fetch(buildMoviesApiPath('/api/games/recently-released', 1, 6)),
            fetch(buildMoviesApiPath('/api/games/upcoming', 1, 6)),
          ])
          const responses = [popularResponse, recentResponse, upcomingResponse]
          const payloads = await Promise.all(responses.map((response) => response.json().catch(() => ({}))))
          const failedResponse = responses.find((response) => !response.ok)
          if (failedResponse) throw new Error(payloads[responses.indexOf(failedResponse)]?.error || `Request failed with status ${failedResponse.status}`)
          if (!cancelled) setGamesDashboardState({
            status: 'success',
            popularGames: Array.isArray(payloads[0].games) ? payloads[0].games.map(mapGamePayload) : [],
            recentGames: Array.isArray(payloads[1].games) ? payloads[1].games.map(mapGamePayload) : [],
            upcomingGames: Array.isArray(payloads[2].games) ? payloads[2].games.map(mapUpcomingGamePayload) : [],
            error: '',
          })
        } catch (error) {
          if (!cancelled) setGamesDashboardState({
            status: 'error',
            popularGames: [],
            recentGames: [],
            upcomingGames: [],
            error: error instanceof Error ? error.message : 'Unable to load the games dashboard right now.',
          })
        }
      }
      loadGamesDashboard()
      return () => { cancelled = true }
    }

    const gamesApiPaths = {
      popular: '/api/games',
      recent: '/api/games/recently-released',
      upcoming: '/api/games/upcoming',
    }
    const activeTabLabel = activeGamesTab === 'recent' ? 'recent games' : activeGamesTab === 'upcoming' ? 'upcoming games' : 'popular games'

    async function loadGames() {
      setGamesState(createGameCollectionLoadingState(gamesPage))
      try {
        const response = await fetch(buildMoviesApiPath(gamesApiPaths[activeGamesTab], gamesPage, moviesPageSize))
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        const mapGame = activeGamesTab === 'upcoming' ? mapUpcomingGamePayload : mapGamePayload
        if (!cancelled) setGamesState({
          status: 'success',
          games: Array.isArray(payload.games) ? payload.games.map(mapGame) : [],
          pagination: mapPaginationPayload(payload.pagination, gamesPage),
          error: '',
        })
      } catch (error) {
        if (!cancelled) setGamesState({
          status: 'error',
          games: [],
          pagination: createPaginationState(gamesPage),
          error: error instanceof Error ? error.message : `Unable to load ${activeTabLabel} right now.`,
        })
      }
    }

    loadGames()
    return () => { cancelled = true }
  }, [activeGamesTab, activeView, gamesPage])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.bookDetail) {
      setBookDetailState({ status: 'hidden', book: null, error: '' })
      return
    }
    let cancelled = false
    async function loadBookDetail() {
      setBookDetailState({ status: 'loading', book: null, error: '' })
      try {
        const response = await fetch(`/api/books/${encodeURIComponent(currentRoute.bookId)}`, { headers: buildAuthHeaders(user) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) setBookDetailState({ status: 'success', book: mapBookDetailPayload(payload.book), error: '' })
      } catch (error) {
        if (!cancelled) setBookDetailState({ status: 'error', book: null, error: error instanceof Error ? error.message : 'Unable to load the book detail right now.' })
      }
    }
    loadBookDetail()
    return () => { cancelled = true }
  }, [currentRoute, user])

  useEffect(() => {
    if (activeView !== primaryViews.home) {
      return
    }

    let cancelled = false

    async function loadLatestEpisodes() {
      setLatestEpisodesState(createTvCollectionLoadingState())

      try {
        const response = await fetch('/api/tv/latest-episodes')
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)

        if (!cancelled) {
          setLatestEpisodesState({
            status: 'success',
            shows: Array.isArray(payload.shows) ? payload.shows.map(mapLatestEpisodeTvShowPayload) : [],
            pagination: createPaginationState(),
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setLatestEpisodesState({
            status: 'error',
            shows: [],
            pagination: createPaginationState(),
            error: error instanceof Error ? error.message : 'Unable to load the latest TV episodes right now.',
          })
        }
      }
    }

    loadLatestEpisodes()

    return () => {
      cancelled = true
    }
  }, [activeView])

  useEffect(() => {
    if (activeView !== primaryViews.movies) {
      return
    }

    let cancelled = false

    async function loadUpcomingMovies() {
      setUpcomingMoviesState(createMovieCollectionLoadingState({ page: upcomingMoviesPage }))
      const hideWatched = Boolean(user) && hideWatchedMovies && moviesScreenMode === movieScreenModes.upcomingList

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies/upcoming', upcomingMoviesPage, moviesPageSize, { hideWatched: hideWatched ? 'true' : undefined }), { headers: buildAuthHeaders(user) })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []
        const pagination = mapPaginationPayload(payload.pagination, upcomingMoviesPage)

        if (!cancelled) {
          setUpcomingMoviesState({
            status: 'success',
            movies,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setUpcomingMoviesState({
            status: 'error',
            movies: [],
            pagination: createPaginationState(upcomingMoviesPage),
            error: error instanceof Error ? error.message : 'Unable to load upcoming movies right now.',
          })
        }
      }
    }

    loadUpcomingMovies()

    return () => {
      cancelled = true
    }
  }, [activeView, hideWatchedMovies, moviesScreenMode, upcomingMoviesPage, user, watchedState.movies])

  useEffect(() => {
    if (activeView !== primaryViews.movies) {
      return
    }

    let cancelled = false

    async function loadRecentMovies() {
      setRecentMoviesState(createMovieCollectionLoadingState({ page: recentMoviesPage }))
      const hideWatched = Boolean(user) && hideWatchedMovies && moviesScreenMode === movieScreenModes.nowPlayingList

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies/recently-released', recentMoviesPage, moviesPageSize, { hideWatched: hideWatched ? 'true' : undefined }), { headers: buildAuthHeaders(user) })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []
        const pagination = mapPaginationPayload(payload.pagination, recentMoviesPage)

        if (!cancelled) {
          setRecentMoviesState({
            status: 'success',
            movies,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setRecentMoviesState({
            status: 'error',
            movies: [],
            pagination: createPaginationState(recentMoviesPage),
            error: error instanceof Error ? error.message : 'Unable to load recently released movies right now.',
          })
        }
      }
    }

    loadRecentMovies()

    return () => {
      cancelled = true
    }
  }, [activeView, hideWatchedMovies, moviesScreenMode, recentMoviesPage, user, watchedState.movies])

  useEffect(() => {
    if (activeView !== primaryViews.movies) {
      return
    }

    let cancelled = false

    async function loadTopRatedMovies() {
      setTopRatedMoviesState(createMovieCollectionLoadingState({ page: topRatedMoviesPage }))
      const hideWatched = Boolean(user) && hideWatchedMovies && moviesScreenMode === movieScreenModes.topRatedList

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies/top-rated', topRatedMoviesPage, moviesPageSize, { hideWatched: hideWatched ? 'true' : undefined }), { headers: buildAuthHeaders(user) })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []
        const pagination = mapPaginationPayload(payload.pagination, topRatedMoviesPage)

        if (!cancelled) {
          setTopRatedMoviesState({
            status: 'success',
            movies,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setTopRatedMoviesState({
            status: 'error',
            movies: [],
            pagination: createPaginationState(topRatedMoviesPage),
            error: error instanceof Error ? error.message : 'Unable to load top rated movies right now.',
          })
        }
      }
    }

    loadTopRatedMovies()

    return () => {
      cancelled = true
    }
  }, [activeView, hideWatchedMovies, moviesScreenMode, topRatedMoviesPage, user, watchedState.movies])

  useEffect(() => {
    if (activeView !== primaryViews.tvShows) {
      return
    }

    let cancelled = false

    async function loadPopularTvShows() {
      setPopularTvState(createTvCollectionLoadingState({ page: popularTvPage, includeFeaturedShow: true }))

      try {
        const response = await fetch(buildTvApiPath('/api/tv', popularTvPage))

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const shows = Array.isArray(payload.shows) ? payload.shows.map(mapTvRowToCard) : []
        const featuredShow = payload.featuredShow ? mapFeaturedTvPayload(payload.featuredShow) : null
        const pagination = mapPaginationPayload(payload.pagination, popularTvPage)

        if (!cancelled) {
          setPopularTvState({
            status: 'success',
            shows,
            featuredShow,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setPopularTvState({
            status: 'error',
            shows: [],
            featuredShow: null,
            pagination: createPaginationState(popularTvPage),
            error: error instanceof Error ? error.message : 'Unable to load TV shows right now.',
          })
        }
      }
    }

    loadPopularTvShows()

    return () => {
      cancelled = true
    }
  }, [activeView, popularTvPage])

  useEffect(() => {
    if (activeView !== primaryViews.tvShows) {
      return
    }

    let cancelled = false

    async function loadRecentTvShows() {
      setRecentTvState(createTvCollectionLoadingState({ page: recentTvPage }))

      try {
        const response = await fetch(buildTvApiPath('/api/tv/recently-released', recentTvPage))

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const shows = Array.isArray(payload.shows) ? payload.shows.map(mapTvRowToCard) : []
        const pagination = mapPaginationPayload(payload.pagination, recentTvPage)

        if (!cancelled) {
          setRecentTvState({
            status: 'success',
            shows,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setRecentTvState({
            status: 'error',
            shows: [],
            pagination: createPaginationState(recentTvPage),
            error: error instanceof Error ? error.message : 'Unable to load recently aired TV shows right now.',
          })
        }
      }
    }

    loadRecentTvShows()

    return () => {
      cancelled = true
    }
  }, [activeView, recentTvPage])

  useEffect(() => {
    if (activeView !== primaryViews.tvShows) {
      return
    }

    let cancelled = false

    async function loadUpcomingTvShows() {
      setUpcomingTvState(createTvCollectionLoadingState({ page: upcomingTvPage }))

      try {
        const response = await fetch(buildTvApiPath('/api/tv/upcoming', upcomingTvPage))

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const shows = Array.isArray(payload.shows) ? payload.shows.map(mapTvRowToCard) : []
        const pagination = mapPaginationPayload(payload.pagination, upcomingTvPage)

        if (!cancelled) {
          setUpcomingTvState({
            status: 'success',
            shows,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setUpcomingTvState({
            status: 'error',
            shows: [],
            pagination: createPaginationState(upcomingTvPage),
            error: error instanceof Error ? error.message : 'Unable to load upcoming TV shows right now.',
          })
        }
      }
    }

    loadUpcomingTvShows()

    return () => {
      cancelled = true
    }
  }, [activeView, upcomingTvPage])

  useEffect(() => {
    if (activeView !== primaryViews.tvShows) {
      return
    }

    let cancelled = false

    async function loadTopRatedTvShows() {
      setTopRatedTvState(createTvCollectionLoadingState({ page: topRatedTvPage }))

      try {
        const response = await fetch(buildTvApiPath('/api/tv/top-rated', topRatedTvPage))

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const shows = Array.isArray(payload.shows) ? payload.shows.map(mapTvRowToCard) : []
        const pagination = mapPaginationPayload(payload.pagination, topRatedTvPage)

        if (!cancelled) {
          setTopRatedTvState({
            status: 'success',
            shows,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setTopRatedTvState({
            status: 'error',
            shows: [],
            pagination: createPaginationState(topRatedTvPage),
            error: error instanceof Error ? error.message : 'Unable to load top rated TV shows right now.',
          })
        }
      }
    }

    loadTopRatedTvShows()

    return () => {
      cancelled = true
    }
  }, [activeView, topRatedTvPage])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.continueWatching) {
      return
    }

    if (!user?.username) {
      setContinueWatchingPageState(createTvCollectionState())
      return
    }

    let cancelled = false

    async function loadContinueWatchingShows() {
      setContinueWatchingPageState(createTvCollectionLoadingState({ page: continueWatchingPage }))

      try {
        const response = await fetch(buildTvApiPath('/api/tv/continue-watching', continueWatchingPage), {
          headers: buildAuthHeaders(user),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)

        if (!cancelled) {
          setContinueWatchingPageState({
            status: 'success',
            shows: Array.isArray(payload.shows) ? payload.shows.map(mapContinueWatchingTvShowPayload) : [],
            pagination: mapPaginationPayload(payload.pagination, continueWatchingPage),
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setContinueWatchingPageState({
            status: 'error',
            shows: [],
            pagination: createPaginationState(continueWatchingPage),
            error: error instanceof Error ? error.message : 'Unable to load your TV progress right now.',
          })
        }
      }
    }

    loadContinueWatchingShows()

    return () => {
      cancelled = true
    }
  }, [continueWatchingPage, currentRoute.kind, user])

  useEffect(() => {
    if (activeView !== primaryViews.movies || moviesScreenMode !== movieScreenModes.genreList || !selectedGenre?.name) {
      return
    }

    let cancelled = false

    async function loadGenreMovies() {
      setGenreMoviesState(createMovieCollectionLoadingState({ page: genreMoviesPage }))
      const hideWatched = Boolean(user) && hideWatchedMovies

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies', genreMoviesPage, moviesPageSize, {
          genre: selectedGenre.name,
          hideWatched: hideWatched ? 'true' : undefined,
        }), { headers: buildAuthHeaders(user) })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies)
          ? payload.movies.map(mapMovieRowToCard)
          : []
        const pagination = mapPaginationPayload(payload.pagination, genreMoviesPage)

        if (!cancelled) {
          setGenreMoviesState({
            status: 'success',
            movies,
            pagination,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setGenreMoviesState({
            status: 'error',
            movies: [],
            pagination: createPaginationState(genreMoviesPage),
            error: error instanceof Error ? error.message : 'Unable to load genre movies right now.',
          })
        }
      }
    }

    loadGenreMovies()

    return () => {
      cancelled = true
    }
  }, [activeView, genreMoviesPage, hideWatchedMovies, moviesScreenMode, selectedGenre, user, watchedState.movies])

  useEffect(() => {
    if (currentRoute.kind !== routeKinds.authorDetail) {
      setAuthorDetailState({ status: 'hidden', author: null, books: [], error: '' })
      return
    }

    let cancelled = false
    async function loadAuthorDetail() {
      setAuthorDetailState((state) => ({ ...state, status: 'loading', error: '' }))
      try {
        const response = await fetch(`/api/authors/${currentRoute.authorId}`)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (!cancelled) {
          setAuthorDetailState({
            status: 'success',
            author: payload.author ?? null,
            books: Array.isArray(payload.books) ? payload.books.map(mapBookRowToCard) : [],
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) setAuthorDetailState({ status: 'error', author: null, books: [], error: error instanceof Error ? error.message : 'Unable to load this author right now.' })
      }
    }
    loadAuthorDetail()
    return () => { cancelled = true }
  }, [currentRoute])

  const watchlistMovieIds = new Set(watchlistState.movies.map((movie) => Number(movie.id)))
  const watchlistBookIds = new Set(watchlistState.books.map((book) => book.id))
  const readBookIds = new Set(readBooksState.books.map((book) => book.id))
  const watchedMovieIds = new Set(watchedState.movies.map((movie) => Number(movie.id)))
  const homeStats = buildMoviesPageStats({
    stats: movieStatsState.stats,
  })
  const moviesPageStats = buildMoviesPageStats({
    stats: movieStatsState.stats,
  })

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />

        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.filter(({ view }) => isPrimaryViewEnabled(view, enabledSections)).map(({ label, icon: Icon, view }) => (
            <button
              key={label}
              type="button"
              className={`nav-item${view === activeView ? ' active' : ''}`}
              onClick={view ? () => handleMovieViewSelection(view) : undefined}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-divider" />

        <div className="genres">
          <div className="sidebar-section-title">
            <span>Genres</span>
            <ChevronRight />
          </div>
          {genresState.status === 'loading' ? <SectionMessage message="Loading genres..." /> : null}
          {genresState.status === 'error' ? <SectionMessage message={genresState.error} tone="error" /> : null}
          {genresState.genres.map((genre, index) => (
            <button
              key={genre.name}
              type="button"
              className={`genre-item${selectedGenre?.name === genre.name && moviesScreenMode === movieScreenModes.genreList ? ' active' : ''}`}
              onClick={() => handleOpenGenre(genre)}
            >
              <span className="genre-dot" style={{ '--dot': genre.color || pickGenreAccentColor(genre.name, index) }} />
              <span>{genre.name}</span>
            </button>
          ))}
        </div>

      </aside>

      <main className="dashboard">
        {currentScreen === appScreens.login ? (
          <LoginScreen
            authError={authError}
            authStatus={authStatus}
            onCancel={handleCloseLogin}
            onSubmit={handleLogin}
          />
        ) : (
          <>
            <DesktopTopbar
              activeView={activeView}
              currentScreen={currentScreen}
              searchError={searchError}
              searchInput={searchInput}
              onSearchInputChange={(value) => {
                setSearchInput(value)
                if (searchError) setSearchError('')
              }}
              onSearchSubmit={handleSearchSubmit}
              onSearchSuggestionSelect={handleOpenSearchSuggestion}
              onOpenAdmin={handleOpenAdmin}
              onOpenAccount={handleOpenAccount}
              onOpenLogin={handleOpenLogin}
              onLogout={handleLogout}
              alertsState={alertsState}
              onOpenAlert={handleOpenAlert}
              onOpenAlerts={handleOpenAlerts}
              onRespondToWatchTogetherRequest={handleWatchTogetherRequestResponse}
              user={user}
            />
            <MobileHeader
              onOpenAccount={handleOpenAccount}
              onOpenLogin={handleOpenLogin}
              searchError={searchError}
              searchInput={searchInput}
              onSearchInputChange={(value) => {
                setSearchInput(value)
                if (searchError) setSearchError('')
              }}
              onSearchSubmit={handleSearchSubmit}
              onSearchSuggestionSelect={handleOpenSearchSuggestion}
              alertsState={alertsState}
              onOpenAlert={handleOpenAlert}
              onOpenAlerts={handleOpenAlerts}
              onRespondToWatchTogetherRequest={handleWatchTogetherRequestResponse}
              user={user}
            />

            {currentScreen === appScreens.admin ? (
              <AdminScreen
                activeTheme={activeTheme}
                adminOverviewState={adminOverviewState}
                adminRunState={adminRunState}
                onBack={handleOpenDashboard}
                onRunJob={handleRunAdminJob}
                onSaveFilelistSettings={handleSaveFilelistSettings}
                onClearFilelistSettings={handleClearFilelistSettings}
                onSaveIgdbSettings={handleSaveIgdbSettings}
                onClearIgdbSettings={handleClearIgdbSettings}
                onSaveEnabledSections={handleSaveEnabledSections}
                onSetRssSourceEnabled={handleSetRssSourceEnabled}
                onSetActiveTheme={handleSetActiveTheme}
                themeState={themeState}
              />
            ) : currentScreen === appScreens.account ? (
              <AccountScreen
                changePasswordState={changePasswordState}
                onBack={handleOpenDashboard}
                onSubmit={handleChangePassword}
                user={user}
              />
            ) : currentRoute.kind === routeKinds.search ? (
              <SearchResultsPage
                booksEnabled={enabledSections.includes('books')}
                gamesEnabled={enabledSections.includes('games')}
                query={currentRoute.query}
                searchResultsState={searchResultsState}
                tmdbSearchState={tmdbSearchState}
                googleBooksSearchState={googleBooksSearchState}
                igdbSearchState={igdbSearchState}
                activeSearchSource={activeSearchSource}
                onSelectSearchSource={(source) => {
                  setActiveSearchSource(source)
                  if (source === 'tmdb') void handleSearchTmdb()
                  if (source === 'books') void handleSearchGoogleBooks()
                  if (source === 'igdb') void handleSearchIgdb()
                }}
                onOpenMovie={handleOpenMovieDetail}
                onOpenTvShow={handleOpenTvDetail}
                onOpenPerson={handleOpenPersonDetail}
                onOpenBook={handleOpenBookDetail}
                onOpenGoogleBook={handleOpenGoogleBookDetail}
                onOpenGame={handleOpenGameDetail}
                favoriteGameIds={new Set(favoriteGames.map((game) => game.id))}
                onToggleGameFavorite={handleToggleGameFavorite}
                watchedMovieIds={watchedMovieIds}
                watchlistMovieIds={watchlistMovieIds}
                watchedTvIds={tvWatchedIds}
                watchlistTvIds={tvWatchlistIds}
                favoriteActorIds={new Set(favoriteActorsState.actors.map((actor) => Number(actor.id)))}
                onToggleMovieWatchlist={handleToggleMovieInWatchlist}
                onToggleMovieWatched={handleToggleMovieWatched}
                onToggleTvWatchlist={handleToggleTvWatchlist}
                onToggleTvWatched={handleToggleTvWatched}
                onToggleFavoriteActor={handleToggleFavoriteActor}
                onOpenDiscover={handleOpenDiscover}
                onSearchQuery={handleSearchSubmit}
              />
            ) : currentRoute.kind === routeKinds.seasonalMovies ? (
              <SeasonalMoviesPage
                state={seasonalMoviesState}
                activeTheme={getSeasonalThemeWithMovies(activeTheme)}
                onBack={() => handleNavigateToPath('/', { kind: routeKinds.home })}
                onOpenMovie={handleOpenMovieDetail}
              />
            ) : currentRoute.kind === routeKinds.discover ? (
              <DiscoverScreen
                user={user}
                onOpenMovie={handleOpenMovieDetail}
                onOpenTvShow={handleOpenTvDetail}
              />
            ) : currentRoute.kind === routeKinds.tvDetail ? (
              <TvDetailPage
                tvDetailState={tvDetailState}
                tvReviewsState={tvReviewsState}
                user={user}
                onBackToTv={() => handleMovieViewSelection(primaryViews.tvShows)}
                onToggleWatchlist={handleToggleTvWatchlist}
                onUpdateEpisodes={handleUpdateTvEpisodes}
                onSubmitEpisodeRating={handleSubmitTvEpisodeRating}
                onOpenTv={handleOpenTvDetail}
                onOpenPerson={handleOpenPersonDetail}
                onOpenLogin={handleOpenLogin}
                isSignedIn={Boolean(user)}
                watchlistIds={tvWatchlistIds}
                tvEpisodeRatingActionState={tvEpisodeRatingActionState}
                onOpenTvShow={handleOpenTvDetail}
              />
            ) : currentRoute.kind === routeKinds.continueWatching ? (
              <ContinueWatchingPage
                isSignedIn={Boolean(user)}
                pageState={continueWatchingPageState}
                onOpenLogin={handleOpenLogin}
                onOpenTvShow={handleOpenTvDetail}
                onPageChange={setContinueWatchingPage}
              />
            ) : currentRoute.kind === routeKinds.calendar ? (
              <CalendarScreen
                calendarMonth={calendarMonth}
                mediaType={calendarMediaType}
                selectedDate={selectedCalendarDate}
                calendarState={calendarState}
                onMonthChange={(nextMonth) => {
                  setCalendarMonth(nextMonth)
                  setSelectedCalendarDate(`${nextMonth}-01`)
                }}
                onMediaTypeChange={setCalendarMediaType}
                onSelectDate={setSelectedCalendarDate}
                onOpenMovie={handleOpenMovieDetail}
                onOpenTvShow={handleOpenTvDetail}
                onOpenLogin={handleOpenLogin}
              />
            ) : activeView === primaryViews.achievements ? (
              <AchievementsScreen isSignedIn={Boolean(user)} state={achievementsState} />
            ) : activeView === primaryViews.stats ? (
              <StatsScreen
                initialTab={statsInitialTab}
                movieStats={movieStatsState.stats}
                movieStatsStatus={movieStatsState.status}
                watchedState={watchedState}
                readBooksState={readBooksState}
                tvWatchedHistoryState={tvWatchedHistoryState}
                playedGamesState={playedGamesState}
                isSignedIn={Boolean(user)}
                statsPeriod={statsPeriod}
                tvStats={tvStatsState.stats}
                tvStatsStatus={tvStatsState.status}
                onStatsPeriodChange={setStatsPeriod}
                insightsState={statsInsightsState}
                bookStatsState={bookStatsState}
                bookAchievementsState={bookAchievementsState}
                gameAchievementsState={gameAchievementsState}
                achievementsState={achievementsState}
                onOpenMovie={handleOpenMovieDetail}
                onOpenPerson={handleOpenPersonDetail}
                onOpenTvShow={handleOpenTvDetail}
                onOpenGame={handleOpenGameDetail}
                onOpenBook={handleOpenBookDetail}
                achievements={achievementsState.achievements}
                onOpenAchievements={() => setActiveView(primaryViews.achievements)}
                enabledSections={enabledSections}
              />
            ) : activeView === primaryViews.news ? (
              <NewsScreen
                route={currentRoute}
                user={user}
                onOpenLogin={handleOpenLogin}
                onNavigateNews={(filters, tab = currentRoute.tab) => handleNavigateToPath(buildNewsPath(filters, tab), { kind: routeKinds.news, filters, tab }, primaryViews.news)}
              />
            ) : activeView === primaryViews.home ? (
              <HomeScreen
                user={user}
                onOpenMovie={handleOpenMovieDetail}
                onOpenPopularMovies={handleOpenPopularMovies}
                onOpenWatchlist={handleOpenWatchlistCta}
                onOpenDiscover={handleOpenDiscover}
                seasonalTheme={getSeasonalThemeWithMovies(activeTheme)}
                onOpenSeasonalMovies={handleOpenSeasonalMovies}
                stats={homeStats}
                statsPeriod={statsPeriod}
                onStatsPeriodChange={setStatsPeriod}
                watchlistState={watchlistState}
                popularMoviesState={popularMoviesState}
                continueWatchingState={continueWatchingState}
                onOpenContinueWatching={handleOpenContinueWatching}
                onOpenTvShow={handleOpenTvDetail}
                onOpenBook={handleOpenBookDetail}
                latestEpisodesState={latestEpisodesState}
                onOpenLatestEpisodes={handleOpenRecentlyAiredTvShows}
                tvWatchlistShows={tvWatchlistShows}
                tvWatchlistIds={tvWatchlistIds}
                tvWatchedIds={tvWatchedIds}
                watchedMovieIds={watchedMovieIds}
                readBookIds={readBookIds}
                onToggleMovieWatchlist={handleToggleMovieInWatchlist}
                onToggleMovieWatched={handleToggleMovieWatched}
                onToggleTvWatchlist={handleToggleTvWatchlist}
                onToggleTvWatched={handleToggleTvWatched}
                onToggleBookWatchlist={handleToggleBookInWatchlist}
                onToggleBookRead={handleToggleBookRead}
              />
            ) : activeView === primaryViews.games && currentRoute.kind !== routeKinds.gameDetail ? (
              <GamesScreen
                activeTab={activeGamesTab}
                dashboardState={gamesDashboardState}
                gameActivityState={gameActivityState}
                gameAchievementsState={gameAchievementsState}
                favoriteGames={favoriteGames}
                gamesState={gamesState}
                onPageChange={setGamesPage}
                onTabChange={(tab) => { setActiveGamesTab(tab); setGamesPage(1) }}
                onToggleFavorite={handleToggleGameFavorite}
                onOpenGameAchievements={() => { setStatsInitialTab('Game achievements'); setActiveView(primaryViews.stats) }}
                onOpenGame={handleOpenGameDetail}
              />
            ) : activeView === primaryViews.watchlist ? (
              <WatchlistScreen
                booksEnabled={enabledSections.includes('books')}
                activeTab={activeWatchlistTab}
                availability={watchlistAvailability}
                sort={watchlistSort}
                isSignedIn={Boolean(user)}
                onTabChange={handleWatchlistTabChange}
                onViewChange={handleWatchlistViewChange}
                onOpenLogin={handleOpenLogin}
                onOpenMovie={handleOpenMovieDetail}
                onOpenTvShow={handleOpenTvDetail}
                onOpenBook={handleOpenBookDetail}
                onOpenPerson={handleOpenPersonDetail}
                favoriteActorsState={favoriteActorsState}
                favoriteAuthorsState={favoriteAuthorsState}
                watchlistState={watchlistState}
                tvWatchlistShows={tvWatchlistShows}
                onOpenAuthor={handleOpenAuthorDetail}
                onRemoveMovie={handleRemoveMovieFromWatchlist}
                onRemoveBook={handleToggleBookInWatchlist}
                onToggleTvWatchlist={handleToggleTvWatchlist}
                onMarkMovieWatched={handleToggleMovieWatched}
                onMarkBookRead={handleToggleBookRead}
                onMarkTvWatched={handleToggleTvWatched}
                onSetPriority={handleSetWatchlistPriority}
              />
            ) : activeView === primaryViews.watchTogether ? (
              <WatchTogetherScreen
                isSignedIn={Boolean(user)}
                state={watchTogetherState}
                search={watchTogetherSearch}
                action={watchTogetherAction}
                activeTab={watchTogetherTab}
                onOpenLogin={handleOpenLogin}
                onChoosePartner={handleChooseWatchTogetherPartner}
                onReset={handleResetWatchTogether}
                onSearchChange={(patch) => setWatchTogetherSearch((state) => ({ ...state, ...patch }))}
                onSearch={handleWatchTogetherSearch}
                onItemAction={handleWatchTogetherItem}
                onTabChange={setWatchTogetherTab}
                onMarkWatched={(movie, watchService) => handleAddMovieToWatched(movie, watchService, { watchTogether: true })}
                onMarkEpisodeWatched={handleWatchTogetherEpisodeWatched}
                watchedActionState={watchedActionState}
                onSubmitMovieRating={handleSubmitMovieRating}
                movieRatingActionState={movieRatingActionState}
                onSubmitEpisodeRating={handleSubmitTvEpisodeRating}
                tvEpisodeRatingActionState={tvEpisodeRatingActionState}
                onOpenMovie={handleOpenMovieDetail}
                onOpenTvShow={handleOpenTvDetail}
                onRefresh={() => loadWatchTogetherForUser(user)}
                achievementsState={watchTogetherAchievementsState}
                statsState={watchTogetherStatsState}
                onSaveSession={handleSaveWatchTogetherSession}
              />
            ) : activeView === primaryViews.tvShows ? (
              <TvShowsScreen
                activeTab={activeTvTab}
                popularTvState={popularTvState}
                recentTvState={recentTvState}
                upcomingTvState={upcomingTvState}
                topRatedTvState={topRatedTvState}
                onSelectShow={handleSelectTvShow}
                onTabChange={handleTvTabChange}
                onToggleWatchlist={handleToggleTvWatchlist}
                onOpenPopularTvShows={handleOpenPopularTvShows}
                onOpenRecentlyAiredTvShows={handleOpenRecentlyAiredTvShows}
                onOpenUpcomingTvShows={handleOpenUpcomingTvShows}
                onOpenTopRatedTvShows={handleOpenTopRatedTvShows}
                onChangePopularPage={setPopularTvPage}
                onChangeRecentPage={setRecentTvPage}
                onChangeUpcomingPage={setUpcomingTvPage}
                onChangeTopRatedPage={setTopRatedTvPage}
                onOpenWatchlist={handleOpenWatchlistCta}
                selectedShowId={selectedTvShowId}
                watchedIds={tvWatchedIds}
                watchlistIds={tvWatchlistIds}
                stats={tvStatsState.stats}
                statsPeriod={statsPeriod}
                onStatsPeriodChange={setStatsPeriod}
              />
            ) : currentRoute.kind === routeKinds.bookDetail ? (
              <BookDetailPage
                bookDetailState={bookDetailState}
                relatedBooksState={relatedBooksState}
                onBack={() => handleMovieViewSelection(primaryViews.books)}
                onToggleWatchlist={handleToggleBookInWatchlist}
                onToggleRead={handleToggleBookRead}
                onMarkUnread={handleMarkBookUnread}
                onSubmitRating={handleSubmitBookRating}
                onOpenLogin={handleOpenLogin}
                isSignedIn={Boolean(user)}
                isInWatchlist={watchlistBookIds.has(bookDetailState.book?.id)}
                isRead={readBookIds.has(bookDetailState.book?.id)}
                readBook={readBooksState.books.find((book) => book.id === bookDetailState.book?.id) ?? null}
                watchlistActionState={bookWatchlistActionState}
                readActionState={bookReadActionState}
                ratingActionState={bookRatingActionState}
                onOpenRelatedBook={handleOpenRelatedBookDetail}
                onOpenAuthor={handleOpenAuthorDetail}
              />
            ) : currentRoute.kind === routeKinds.authorDetail ? (
              <AuthorDetailPage
                authorDetailState={authorDetailState}
                onBack={() => handleMovieViewSelection(primaryViews.books)}
                onOpenBook={handleOpenBookDetail}
                onOpenLogin={handleOpenLogin}
                isSignedIn={Boolean(user)}
                favoriteAuthorIds={new Set(favoriteAuthorsState.authors.map((author) => Number(author.id)))}
                onToggleFavorite={handleToggleFavoriteAuthor}
              />
            ) : activeView === primaryViews.books ? (
              <BooksScreen booksState={booksState} onPageChange={setBooksPage} onOpenBook={handleOpenBookDetail} />
            ) : currentRoute.kind === routeKinds.personDetail ? (
              <PersonDetailPage
                personDetailState={personDetailState}
                onBackToMovies={() => handleMovieViewSelection(primaryViews.movies)}
                onOpenMovie={handleOpenMovieDetail}
                onOpenTv={handleOpenTvDetail}
                onOpenPerson={handleOpenPersonDetail}
                isSignedIn={Boolean(user)}
                onOpenLogin={handleOpenLogin}
                onToggleMovieWatchlist={handleToggleMovieInWatchlist}
                onToggleMovieWatched={handleToggleMovieWatched}
                onToggleTvWatchlist={handleToggleTvWatchlist}
                onToggleTvWatched={handleToggleTvWatched}
                favoriteActorIds={new Set(favoriteActorsState.actors.map((actor) => Number(actor.id)))}
                onToggleFavorite={handleToggleFavoriteActor}
              />
            ) : currentRoute.kind === routeKinds.movieDetail ? (
              <MovieDetailPage
                movieDetailState={movieDetailState}
                similarMoviesState={similarMoviesState}
                onBackToMovies={() => handleMovieViewSelection(primaryViews.movies)}
                onOpenPerson={handleOpenPersonDetail}
                onToggleWatched={handleToggleMovieWatched}
                onToggleWatchlist={handleToggleMovieInWatchlist}
                onToggleReleaseReminder={handleToggleMovieReleaseReminder}
                onSubmitMovieRating={handleSubmitMovieRating}
                onOpenLogin={handleOpenLogin}
                onOpenMovie={handleOpenMovieDetail}
                isSignedIn={Boolean(user)}
                user={user}
                movieRatingActionState={movieRatingActionState}
                movieReleaseReminderActionState={movieReleaseReminderActionState}
                watchedActionState={watchedActionState}
                watchedMovieIds={watchedMovieIds}
                watchedMovies={watchedState.movies}
                watchlistActionState={watchlistActionState}
                watchlistMovieIds={watchlistMovieIds}
              />
            ) : currentRoute.kind === routeKinds.gameDetail ? (
              <GameDetailPage
                state={gameDetailState}
                similarGamesState={similarGamesState}
                favoriteGameIds={new Set(favoriteGames.map((game) => game.id))}
                onBack={() => handleMovieViewSelection(primaryViews.games)}
                onToggleFavorite={handleToggleGameFavorite}
                onTogglePlayed={handleToggleGamePlayed}
                onSubmitRating={handleSubmitGameRating}
                onSaveTracking={handleSaveGameTracking}
                onSaveSession={handleSaveGameSession}
                onOpenGame={handleOpenGameDetail}
                onOpenLogin={handleOpenLogin}
                isSignedIn={Boolean(user)}
                playedActionState={gamePlayedActionState}
                ratingActionState={gameRatingActionState}
                trackingActionState={gameTrackingActionState}
              />
            ) : (
              <MoviesScreen
                activeTab={activeMovieTab}
                setActiveTab={handleMovieTabChange}
                screenMode={moviesScreenMode}
                selectedGenre={selectedGenre}
                genreMoviesState={genreMoviesState}
                onChangeGenrePage={setGenreMoviesPage}
                popularMoviesState={popularMoviesState}
                onChangePopularPage={setPopularMoviesPage}
                recentMoviesState={recentMoviesState}
                onChangeRecentPage={setRecentMoviesPage}
                topRatedMoviesState={topRatedMoviesState}
                onChangeTopRatedPage={setTopRatedMoviesPage}
                upcomingMoviesState={upcomingMoviesState}
                onChangeUpcomingPage={setUpcomingMoviesPage}
                isSignedIn={Boolean(user)}
                hideWatched={hideWatchedMovies}
                onHideWatchedChange={handleHideWatchedMoviesChange}
                movieStats={moviesPageStats}
                statsPeriod={statsPeriod}
                onStatsPeriodChange={setStatsPeriod}
                watchedActionState={watchedActionState}
                watchedMovieIds={watchedMovieIds}
                watchlistActionState={watchlistActionState}
                watchlistMovies={watchlistState.movies}
                onToggleWatched={handleToggleMovieWatched}
                onToggleWatchlist={handleToggleMovieInWatchlist}
                onOpenPopularMovies={handleOpenPopularMovies}
                onOpenRecentlyReleasedMovies={handleOpenRecentlyReleasedMovies}
                onOpenTopRatedMovies={handleOpenTopRatedMovies}
                onOpenUpcomingMovies={handleOpenUpcomingMovies}
                onOpenWatchlist={() => handleMovieViewSelection(primaryViews.watchlist)}
                onOpenMovie={handleOpenMovieDetail}
              />
            )}

            {currentScreen === appScreens.dashboard ? (
              <MobileNav activeView={activeView} enabledSections={enabledSections} setActiveView={handleMovieViewSelection} />
            ) : null}
          </>
        )}
      </main>
      {achievementToast ? <div className="achievement-toast" role="status"><TrophyIcon /><div><b>Achievement unlocked</b><span>{achievementToast.name}</span></div></div> : null}
      {bookReadingFormatDialogBook ? <BookReadingFormatDialog book={bookReadingFormatDialogBook} isSaving={bookReadActionState.status === 'loading' && bookReadActionState.bookId === bookReadingFormatDialogBook.id} onCancel={() => setBookReadingFormatDialogBook(null)} onSelect={(readingFormat, metadata) => handleToggleBookRead({ ...bookReadingFormatDialogBook, metadata }, readingFormat)} /> : null}
    </div>
  )
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <PlayLogo />
      </div>
      <div>
        <p className="brand-name">Watch<span>Vault</span></p>
      </div>
    </div>
  )
}

function DesktopTopbar({ alertsState, onOpenAdmin, onOpenAccount, onOpenAlert, onOpenAlerts, onOpenLogin, onLogout, onRespondToWatchTogetherRequest, onSearchInputChange, onSearchSubmit, onSearchSuggestionSelect, searchError, searchInput, user }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [menuOpen])

  function handleOpenAdminMenuItem() {
    setMenuOpen(false)
    onOpenAdmin()
  }

  function handleOpenAccountMenuItem() {
    setMenuOpen(false)
    onOpenAccount()
  }

  function handleLogoutMenuItem() {
    setMenuOpen(false)
    onLogout()
  }

  return (
    <header className="topbar desktop-only">
      <form className="topbar-search" onSubmit={(event) => { event.preventDefault(); onSearchSubmit() }}>
        <SearchAutocomplete inputId="desktop-search" onChange={onSearchInputChange} onSelect={onSearchSuggestionSelect} onSubmit={onSearchSubmit} searchError={searchError} value={searchInput} />
        <button type="submit" className="search-submit-button">Search</button>
        {searchError ? <span id="desktop-search-error" className="search-error" role="alert">{searchError}</span> : null}
      </form>

      <div className="topbar-actions">
        <AlertInbox alertsState={alertsState} onOpenAlert={onOpenAlert} onOpenAlerts={onOpenAlerts} onOpenLogin={onOpenLogin} onRespondToWatchTogetherRequest={onRespondToWatchTogetherRequest} user={user} />

        {user ? (
          <div className={`profile-menu${menuOpen ? ' open' : ''}`} ref={menuRef}>
            <button
              type="button"
              className="profile-button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <div className="avatar">{getUserInitial(user.fullName)}</div>
              <span>{user.fullName}</span>
              <ChevronDown />
            </button>

            {menuOpen ? (
              <div className="profile-dropdown" role="menu" aria-label="Profile options">
                <div className="profile-dropdown-user">
                  <strong>{user.fullName}</strong>
                  <span>@{user.username}</span>
                </div>
                <button type="button" className="profile-dropdown-item" onClick={handleOpenAccountMenuItem} role="menuitem">
                  <UserIcon />
                  <span>Change Password</span>
                </button>
                <button type="button" className="profile-dropdown-item" onClick={handleOpenAdminMenuItem} role="menuitem">
                  <ShieldIcon />
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  className="profile-dropdown-item profile-dropdown-item-logout"
                  onClick={handleLogoutMenuItem}
                  role="menuitem"
                >
                  <LogoutIcon />
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button type="button" className="profile-button sign-in-trigger" onClick={onOpenLogin}>
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  )
}

function MobileHeader({ alertsState, onOpenAccount, onOpenAlert, onOpenAlerts, onOpenLogin, onRespondToWatchTogetherRequest, onSearchInputChange, onSearchSubmit, onSearchSuggestionSelect, searchError, searchInput, user }) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="mobile-only">
      <header className="mobile-header">
        <Brand />

        <div className="mobile-actions">
          <button type="button" className="icon-button" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen((value) => !value)}>
            <SearchIcon />
          </button>
          <AlertInbox alertsState={alertsState} onOpenAlert={onOpenAlert} onOpenAlerts={onOpenAlerts} onOpenLogin={onOpenLogin} onRespondToWatchTogetherRequest={onRespondToWatchTogetherRequest} user={user} />
          {user ? (
            <button type="button" className="avatar-button" aria-label={`Open ${user.fullName}'s profile`} onClick={onOpenAccount}>
              <div className="avatar small">{getUserInitial(user.fullName)}</div>
            </button>
          ) : (
            <button type="button" className="mobile-sign-in-button" onClick={onOpenLogin}>
              Sign In
            </button>
          )}
        </div>
      </header>

      {searchOpen ? (
        <form className="mobile-search-form" onSubmit={(event) => { event.preventDefault(); if (onSearchSubmit()) setSearchOpen(false) }}>
          <SearchAutocomplete autoFocus inputId="mobile-search" onChange={onSearchInputChange} onSelect={onSearchSuggestionSelect} onSubmit={onSearchSubmit} searchError={searchError} value={searchInput} />
          <button type="submit" className="search-submit-button">Search</button>
          {searchError ? <span id="mobile-search-error" className="search-error" role="alert">{searchError}</span> : null}
        </form>
      ) : null}
    </div>
  )
}

function SearchAutocomplete({ autoFocus = false, inputId, onChange, onSelect, onSubmit, searchError, value }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [suggestionState, setSuggestionState] = useState({ status: 'idle', titles: [], people: [], error: '' })
  const [popularState, setPopularState] = useState({ status: 'idle', titles: [], error: '' })
  const requestId = useRef(0)
  const recentSearches = readRecentSearches()
  const menuItems = value.trim().length >= 2
    ? [...suggestionState.titles, ...suggestionState.people]
    : [...recentSearches.map((label) => ({ kind: 'recent', label, meta: 'Recent search' })), ...popularState.titles.map((item) => ({ ...item, searchOnly: true }))]

  useEffect(() => {
    const query = value.trim()
    if (query.length < 2) {
      requestId.current += 1
      setSuggestionState({ status: 'idle', titles: [], people: [], error: '' })
      return
    }
    const currentRequestId = ++requestId.current
    const timeout = window.setTimeout(async () => {
      setSuggestionState({ status: 'loading', titles: [], people: [], error: '' })
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
        if (currentRequestId === requestId.current) setSuggestionState({ status: 'success', titles: Array.isArray(payload.titles) ? payload.titles : [], people: Array.isArray(payload.people) ? payload.people : [], error: '' })
      } catch (error) {
        if (currentRequestId === requestId.current) setSuggestionState({ status: 'error', titles: [], people: [], error: error instanceof Error ? error.message : 'Unable to load suggestions.' })
      }
    }, 200)
    return () => window.clearTimeout(timeout)
  }, [value])

  useEffect(() => {
    if (!open || value.trim()) return
    if (popularState.status !== 'idle') return
    let cancelled = false
    setPopularState({ status: 'loading', titles: [], error: '' })
    fetch('/api/search/popular').then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      if (!cancelled) setPopularState({ status: 'success', titles: Array.isArray(payload.titles) ? payload.titles : [], error: '' })
    }).catch((error) => { if (!cancelled) setPopularState({ status: 'error', titles: [], error: error instanceof Error ? error.message : 'Unable to load popular searches.' }) })
    return () => { cancelled = true }
  }, [open, popularState.status, value])

  const showTypedSuggestions = value.trim().length >= 2
  const selectItem = (item) => {
    setOpen(false)
    setActiveIndex(-1)
    if (item.kind === 'recent' || item.searchOnly) {
      onChange(item.label)
      onSubmit(item.label)
      return
    }
    onSelect(item)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); setActiveIndex(-1); return }
    if (!open || !menuItems.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : menuItems.length - 1)) % menuItems.length)
    }
    if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); selectItem(menuItems[activeIndex]) }
  }

  return <div className="search-autocomplete">
    <label className="searchbar" aria-label="Search movies, shows, books, and actors">
      <SearchIcon />
      <input id={inputId} type="text" autoFocus={autoFocus} value={value} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => { onChange(event.target.value); setOpen(true); setActiveIndex(-1) }} onKeyDown={handleKeyDown} placeholder="Search movies, shows, books, actors..." role="combobox" aria-expanded={open} aria-controls={`${inputId}-suggestions`} aria-autocomplete="list" aria-activedescendant={activeIndex >= 0 ? `${inputId}-suggestion-${activeIndex}` : undefined} aria-invalid={Boolean(searchError)} aria-describedby={searchError ? `${inputId}-error` : undefined} />
    </label>
    {open ? <div className="search-suggestions" id={`${inputId}-suggestions`} role="listbox">
      {showTypedSuggestions ? <SearchSuggestionGroups activeIndex={activeIndex} inputId={inputId} onSelect={selectItem} people={suggestionState.people} status={suggestionState.status} titles={suggestionState.titles} /> : <>
        {recentSearches.length ? <SearchSuggestionGroup heading="Recent searches" items={recentSearches.map((label) => ({ kind: 'recent', label, meta: 'Recent search' }))} inputId={inputId} offset={0} activeIndex={activeIndex} onSelect={selectItem} /> : null}
        <SearchSuggestionGroup heading="Popular searches" items={popularState.titles.map((item) => ({ ...item, searchOnly: true }))} inputId={inputId} offset={recentSearches.length} activeIndex={activeIndex} onSelect={selectItem} />
      </>}
      {showTypedSuggestions && suggestionState.status === 'loading' ? <p className="search-suggestions-message">Loading suggestions…</p> : null}
      {showTypedSuggestions && suggestionState.status === 'error' ? <p className="search-suggestions-message error">{suggestionState.error}</p> : null}
      {!showTypedSuggestions && popularState.status === 'loading' ? <p className="search-suggestions-message">Loading popular searches…</p> : null}
    </div> : null}
  </div>
}

function readRecentSearches() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(recentSearchesStorageKey) || '[]')
    return Array.isArray(stored) ? stored.filter((item) => typeof item === 'string' && item.trim()).slice(0, maxRecentSearches) : []
  } catch {
    return []
  }
}

function SearchSuggestionGroups({ activeIndex, inputId, onSelect, people, status, titles }) {
  if (status === 'success' && !titles.length && !people.length) return <p className="search-suggestions-message">No suggestions found.</p>
  return <><SearchSuggestionGroup heading="Titles" items={titles} inputId={inputId} offset={0} activeIndex={activeIndex} onSelect={onSelect} /><SearchSuggestionGroup heading="People" items={people} inputId={inputId} offset={titles.length} activeIndex={activeIndex} onSelect={onSelect} /></>
}

function SearchSuggestionGroup({ activeIndex, heading, inputId, items, offset, onSelect }) {
  if (!items.length) return null
  return <section className="search-suggestion-group"><p>{heading}</p>{items.map((item, index) => <button key={`${item.kind}-${item.id || item.label}`} id={`${inputId}-suggestion-${offset + index}`} type="button" role="option" aria-selected={activeIndex === offset + index} className={activeIndex === offset + index ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)}><span className={`search-suggestion-image${item.imageUrl ? ' has-image' : ''}`}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <SearchIcon />}</span><span><b>{item.label}</b><small>{item.meta}</small></span></button>)}</section>
}

function AlertInbox({ alertsState, onOpenAlert, onOpenAlerts, onOpenLogin, onRespondToWatchTogetherRequest, user }) {
  const [open, setOpen] = useState(false)
  const inboxRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (inboxRef.current && !inboxRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  async function handleToggle() {
    if (!user) return onOpenLogin()
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) await onOpenAlerts()
  }

  return (
    <div className={`alert-inbox${open ? ' open' : ''}`} ref={inboxRef}>
      <button type="button" className="icon-button" aria-label="Alerts" aria-expanded={open} aria-haspopup="dialog" onClick={handleToggle}>
        <BellIcon />
        {user && alertsState.unreadCount > 0 ? <span className="notification-dot" /> : null}
      </button>
      {open ? (
        <section className="alert-dropdown" role="dialog" aria-label="Alerts">
          <header><strong>Alerts</strong><span>{alertsState.unreadCount ? `${alertsState.unreadCount} unread` : 'All caught up'}</span></header>
          {alertsState.status === 'loading' ? <p className="alert-empty">Loading alerts...</p> : null}
          {alertsState.status === 'error' ? <p className="alert-empty alert-error">{alertsState.error}</p> : null}
          {alertsState.status !== 'loading' && alertsState.status !== 'error' && !alertsState.alerts.length ? <p className="alert-empty">No alerts yet.</p> : null}
          <div className="alert-list">
            {alertsState.alerts.map((alert) => {
              const actionable = alert.kind === 'watch_together_request' && alert.watchTogetherRequestStatus === 'pending' && alert.watchTogetherRequestId
              return <div key={alert.id} className="alert-item">
                <button type="button" className="alert-item-main" onClick={() => { if (!actionable) { setOpen(false); onOpenAlert(alert) } }}><strong>{alert.title}</strong><span>{alert.message}</span><small>{formatAlertTime(alert.createdAt)}</small></button>
                {actionable ? <div className="alert-item-actions"><button type="button" className="secondary-button" onClick={() => onRespondToWatchTogetherRequest(alert.watchTogetherRequestId, 'deny')}>Deny</button><button type="button" className="primary-button" onClick={() => onRespondToWatchTogetherRequest(alert.watchTogetherRequestId, 'accept')}>Accept</button></div> : null}
              </div>
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function SearchResultsPage({
  activeSearchSource,
  booksEnabled,
  gamesEnabled,
  favoriteActorIds,
  favoriteGameIds,
  googleBooksSearchState,
  igdbSearchState,
  onOpenBook,
  onOpenGame,
  onOpenGoogleBook,
  onOpenDiscover,
  onOpenMovie,
  onOpenPerson,
  onSelectSearchSource,
  onSearchQuery,
  onOpenTvShow,
  onToggleFavoriteActor,
  onToggleGameFavorite,
  onToggleMovieWatched,
  onToggleMovieWatchlist,
  onToggleTvWatched,
  onToggleTvWatchlist,
  query,
  searchResultsState,
  tmdbSearchState,
  watchedMovieIds,
  watchedTvIds,
  watchlistMovieIds,
  watchlistTvIds,
}) {
  if (!query) {
    return (
      <section className="search-results-page">
        <div className="search-results-heading">
          <p className="eyebrow">Search</p>
          <h1>Find something to watch</h1>
          <p>Enter a movie, show, book, game, or actor in the search field above.</p>
        </div>
      </section>
    )
  }

  const sourceTabs = [
    { id: 'watchvault', label: 'WatchVault', state: searchResultsState },
    { id: 'tmdb', label: 'TMDB', state: tmdbSearchState },
    ...(booksEnabled ? [{ id: 'books', label: 'Google Books', state: googleBooksSearchState }] : []),
    ...(gamesEnabled ? [{ id: 'igdb', label: 'IGDB', state: igdbSearchState }] : []),
  ]
  const activeSourceState = sourceTabs.find((source) => source.id === activeSearchSource)?.state ?? searchResultsState
  const isLoading = activeSourceState.status === 'loading' || activeSourceState.status === 'idle'
  const hasError = activeSourceState.status === 'error'
  const showingWatchVaultResults = activeSearchSource === 'watchvault'
  const showingTmdbResults = activeSearchSource === 'tmdb'
  const showingGoogleBooksResults = activeSearchSource === 'books'
  const showingIgdbResults = activeSearchSource === 'igdb'
  const titleMovies = showingTmdbResults ? tmdbSearchState.movies : searchResultsState.movies
  const titleShows = showingTmdbResults ? tmdbSearchState.shows : searchResultsState.shows
  const titleBooks = booksEnabled ? (showingGoogleBooksResults ? googleBooksSearchState.books : searchResultsState.books) : []
  const titleGames = gamesEnabled ? (showingIgdbResults ? igdbSearchState.games : searchResultsState.games) : []
  const localSearchResults = { ...searchResultsState, books: booksEnabled ? searchResultsState.books : [] }
  const localClusters = showingWatchVaultResults ? buildAmbiguousSearchClusters(localSearchResults) : []
  const clusteredMovieIds = new Set(localClusters.flatMap((cluster) => cluster.items.filter((item) => item.kind === 'movie').map((item) => item.id)))
  const clusteredShowIds = new Set(localClusters.flatMap((cluster) => cluster.items.filter((item) => item.kind === 'tv').map((item) => item.id)))
  const clusteredBookIds = new Set(localClusters.flatMap((cluster) => cluster.items.filter((item) => item.kind === 'book').map((item) => item.id)))
  const visibleMovies = showingWatchVaultResults ? titleMovies.filter((item) => !clusteredMovieIds.has(item.id)) : titleMovies
  const visibleShows = showingWatchVaultResults ? titleShows.filter((item) => !clusteredShowIds.has(item.id)) : titleShows
  const visibleBooks = showingWatchVaultResults ? titleBooks.filter((item) => !clusteredBookIds.has(item.id)) : titleBooks
  const hasNoLocalMatches = showingWatchVaultResults && !isLoading && !hasError && !searchResultsState.movies.length && !searchResultsState.shows.length && !titleBooks.length && !titleGames.length && !searchResultsState.actors.length

  return (
    <section className="search-results-page">
      <div className="search-results-heading">
        <p className="eyebrow">Search results</p>
        <h1>Results for “{query}”</h1>
        <div className="search-source-tabs" role="tablist" aria-label="Search source">
          {sourceTabs.map((source) => {
            const isActive = source.id === activeSearchSource
            const isLoading = source.state.status === 'loading'
            return (
              <button
                key={source.id}
                id={`search-source-tab-${source.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`search-source-panel-${source.id}`}
                className={isActive ? 'active' : ''}
                onClick={() => onSelectSearchSource(source.id)}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                  event.preventDefault()
                  const currentIndex = sourceTabs.findIndex((item) => item.id === source.id)
                  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? sourceTabs.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + sourceTabs.length) % sourceTabs.length
                  const nextSource = sourceTabs[nextIndex]
                  onSelectSearchSource(nextSource.id)
                  document.getElementById(`search-source-tab-${nextSource.id}`)?.focus()
                }}
              >
                {source.label}{isLoading ? <span className="search-source-tab-status"> · Searching…</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div id={`search-source-panel-${activeSearchSource}`} role="tabpanel" aria-labelledby={`search-source-tab-${activeSearchSource}`}>
        {showingGoogleBooksResults && googleBooksSearchState.error ? <p className="search-source-error" role="alert">Could not save this Google Books title. {googleBooksSearchState.error}</p> : null}
        {hasNoLocalMatches ? <LocalSearchEmptyState booksEnabled={booksEnabled} gamesEnabled={gamesEnabled} query={query} onOpenDiscover={onOpenDiscover} onSearchQuery={onSearchQuery} onSelectSource={onSelectSearchSource} /> : null}
        {showingWatchVaultResults && localClusters.length ? <SearchResultGroup title="Shared title matches" isLoading={false} error="" items={localClusters}>
          <div className="search-result-clusters">{localClusters.map((cluster) => <article className="search-result-cluster" key={cluster.key}><header><h3><HighlightedText text={cluster.title} query={query} /></h3><span>{cluster.items.length} formats</span></header><div className="search-result-cluster-items">{cluster.items.map((item) => item.kind === 'movie' ? <MovieCard key={`movie-${item.id}`} movie={item} matchQuery={query} onOpenMovie={onOpenMovie} isWatched={watchedMovieIds.has(Number(item.id))} isInWatchlist={watchlistMovieIds.has(Number(item.id))} onToggleWatchlist={onToggleMovieWatchlist} onToggleWatched={onToggleMovieWatched} /> : item.kind === 'tv' ? <TvShowPosterCard key={`tv-${item.id}`} show={item} matchQuery={query} onSelectShow={onOpenTvShow} isWatched={watchedTvIds.has(Number(item.id))} isInWatchlist={watchlistTvIds.has(Number(item.id))} onToggleWatchlist={onToggleTvWatchlist} onToggleWatched={onToggleTvWatched} /> : <BookCard key={`book-${item.id}`} book={item} matchQuery={query} onOpenBook={onOpenBook} />)}</div></article>)}</div>
        </SearchResultGroup> : null}
        {!hasNoLocalMatches && !showingGoogleBooksResults ? <SearchResultGroup title="Movies" isLoading={isLoading} error={hasError ? activeSourceState.error : ''} items={visibleMovies} emptyMessage={showingTmdbResults ? 'No TMDB movies matched this search.' : 'No movies matched this search.'}>
          <div className="movie-card-grid popular-movies-catalog">
            {visibleMovies.map((movie) => <MovieCard key={movie.id} movie={movie} matchQuery={query} onOpenMovie={onOpenMovie} isWatched={watchedMovieIds.has(Number(movie.id))} isInWatchlist={watchlistMovieIds.has(Number(movie.id))} onToggleWatchlist={showingWatchVaultResults ? onToggleMovieWatchlist : null} onToggleWatched={showingWatchVaultResults ? onToggleMovieWatched : null} />)}
          </div>
        </SearchResultGroup> : null}

        {!hasNoLocalMatches && !showingGoogleBooksResults ? <SearchResultGroup title="TV Shows" isLoading={isLoading} error={hasError ? activeSourceState.error : ''} items={visibleShows} emptyMessage={showingTmdbResults ? 'No TMDB TV shows matched this search.' : 'No TV shows matched this search.'}>
          <div className="tv-show-card-grid popular-movies-catalog">
            {visibleShows.map((show) => <TvShowPosterCard key={show.id} show={show} matchQuery={query} onSelectShow={onOpenTvShow} isWatched={watchedTvIds.has(Number(show.id))} isInWatchlist={watchlistTvIds.has(Number(show.id))} onToggleWatchlist={showingWatchVaultResults ? onToggleTvWatchlist : null} onToggleWatched={showingWatchVaultResults ? onToggleTvWatched : null} />)}
          </div>
        </SearchResultGroup> : null}

        {booksEnabled && !hasNoLocalMatches && !showingTmdbResults ? <SearchResultGroup title="Books" isLoading={isLoading} error={hasError ? activeSourceState.error : ''} items={visibleBooks} emptyMessage={showingGoogleBooksResults ? 'No Google Books matched this search.' : 'No locally stored books matched this search.'}>
          <div className="movie-card-grid popular-movies-catalog">
            {visibleBooks.map((book) => <BookCard key={book.id} book={book} matchQuery={query} onOpenBook={showingGoogleBooksResults ? onOpenGoogleBook : onOpenBook} disabled={googleBooksSearchState.persistingBookId === book.id} />)}
          </div>
        </SearchResultGroup> : null}

        {gamesEnabled && !hasNoLocalMatches && !showingTmdbResults && !showingGoogleBooksResults ? <SearchResultGroup title="Games" isLoading={isLoading} error={hasError ? activeSourceState.error : ''} items={titleGames} emptyMessage={showingIgdbResults ? 'No IGDB games matched this search.' : 'No locally stored games matched this search.'}>
          <GameCardsGrid className="games-card-grid popular-movies-catalog" games={titleGames} label={showingIgdbResults ? 'IGDB' : 'Local'} favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleGameFavorite} onOpenGame={onOpenGame} />
        </SearchResultGroup> : null}

        {showingWatchVaultResults && !hasNoLocalMatches ? <SearchResultGroup title="Actors" isLoading={isLoading} error={hasError ? activeSourceState.error : ''} items={searchResultsState.actors} emptyMessage="No actors matched this search.">
          <div className="favorite-actors-grid">
            {searchResultsState.actors.map((actor) => <FavoriteActorCard key={actor.id} actor={actor} matchQuery={query} onOpenPerson={onOpenPerson} isFavorite={favoriteActorIds.has(Number(actor.id))} onToggleFavorite={onToggleFavoriteActor} />)}
          </div>
        </SearchResultGroup> : null}
      </div>
    </section>
  )
}

function LocalSearchEmptyState({ booksEnabled, gamesEnabled, onOpenDiscover, onSearchQuery, onSelectSource, query }) {
  const [state, setState] = useState({ status: 'loading', alternatives: [] })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', alternatives: [] })
    fetch(`/api/search/alternatives?q=${encodeURIComponent(query)}`).then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      if (!cancelled) setState({ status: 'success', alternatives: Array.isArray(payload.alternatives) ? payload.alternatives : [] })
    }).catch(() => { if (!cancelled) setState({ status: 'error', alternatives: [] }) })
    return () => { cancelled = true }
  }, [query])

  return <section className="local-search-empty-state">
    <SearchIcon />
    <div>
      <h2>No local matches for “{query}”</h2>
      <p>Try a broader search across our external sources, or let Discover find something for you.</p>
      {state.status === 'success' && state.alternatives.length ? <div className="local-search-alternatives"><span>Did you mean</span>{state.alternatives.map((alternative) => <button key={alternative} type="button" onClick={() => onSearchQuery(alternative)}>{alternative}</button>)}</div> : null}
      <div className="local-search-empty-actions"><button type="button" className="secondary-button" onClick={() => onSelectSource('tmdb')}>Search TMDB</button>{booksEnabled ? <button type="button" className="secondary-button" onClick={() => onSelectSource('books')}>Search Google Books</button> : null}{gamesEnabled ? <button type="button" className="secondary-button" onClick={() => onSelectSource('igdb')}>Search IGDB</button> : null}<button type="button" className="primary-button" onClick={onOpenDiscover}>Open Discover</button></div>
    </div>
  </section>
}

function SearchResultGroup({ children, emptyMessage, error, isLoading, items, title }) {
  if (!isLoading && !error && items.length === 0) return null
  return (
    <section className="content-section search-results-group">
      <div className="section-header"><h2>{title}</h2><span className="search-result-count">{isLoading ? '' : items.length}</span></div>
      {isLoading ? <SearchResultSkeleton title={title} /> : error ? <SectionMessage tone="error" message={`Could not search ${title.toLowerCase()}. ${error}`} /> : items.length ? children : <SectionMessage message={emptyMessage} />}
    </section>
  )
}

function SearchResultSkeleton({ title }) {
  const actorSkeleton = title === 'Actors'
  return <div className={actorSkeleton ? 'search-skeleton-grid actors' : 'search-skeleton-grid'}>{Array.from({ length: actorSkeleton ? 4 : 5 }, (_value, index) => <div className="search-skeleton-card" key={index}><i /><span /><span /></div>)}</div>
}

function HighlightedText({ text, query }) {
  const value = String(text || '')
  const match = String(query || '').trim()
  if (!match) return value
  const parts = value.split(new RegExp(`(${escapeRegExp(match)})`, 'ig'))
  return <>{parts.map((part, index) => part.toLocaleLowerCase() === match.toLocaleLowerCase() ? <mark key={index}>{part}</mark> : part)}</>
}

function SearchMatchLabel({ person = false, query, text }) {
  if (!query) return null
  const exact = normalizeSearchLabel(text) === normalizeSearchLabel(query)
  return <span className={`search-match-label ${person ? 'person' : exact ? 'exact' : 'close'}`}>{person ? 'Person' : exact ? 'Exact match' : 'Close match'}</span>
}

function buildAmbiguousSearchClusters({ books = [], movies = [], shows = [] }) {
  const grouped = new Map()
  for (const item of [...movies.map((item) => ({ ...item, kind: 'movie' })), ...shows.map((item) => ({ ...item, kind: 'tv' })), ...books.map((item) => ({ ...item, kind: 'book' }))]) {
    const key = String(item.title || '').trim().toLocaleLowerCase()
    if (!key) continue
    grouped.set(key, [...(grouped.get(key) || []), item])
  }
  return [...grouped.entries()].filter(([, items]) => items.length > 1).map(([key, items]) => ({ key, title: items[0].title, items }))
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeSearchLabel(value) {
  return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

function NewsScreen({ route, user, onNavigateNews, onOpenLogin }) {
  const filters = route?.filters ?? emptyNewsFilters
  const tab = route?.tab === 'saved' ? 'saved' : 'news'
  const [feed, setFeed] = useState({ status: 'loading', articles: [], hasNextPage: true, error: '' })
  const [likeAction, setLikeAction] = useState({ articleId: null, errorArticleId: null, error: '' })
  const [saveAction, setSaveAction] = useState({ articleId: null, errorArticleId: null, error: '' })
  const sentinelRef = useRef(null)
  const loadingRef = useRef(false)
  const nextPageRef = useRef(1)
  const mountedRef = useRef(true)
  const requestControllerRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; requestControllerRef.current?.abort() }
  }, [])

  const filterKey = `${tab}:${filters.actor ?? ''}:${filters.movie ?? ''}:${filters.show ?? ''}`
  const loadPage = useCallback(async (page) => {
    if (loadingRef.current || !mountedRef.current) return
    if (tab === 'saved' && !user) {
      setFeed({ status: 'success', articles: [], hasNextPage: false, error: '' })
      return
    }
    const controller = new AbortController()
    requestControllerRef.current = controller
    loadingRef.current = true
    setFeed((current) => ({
      ...current,
      status: current.articles.length === 0 ? 'loading' : 'loading-more',
      error: '',
    }))

    try {
      const response = await fetch(`${buildNewsApiPath(page, filters, tab)}`, { signal: controller.signal, headers: user ? buildAuthHeaders(user) : undefined })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      const incomingArticles = (Array.isArray(payload.articles) ? payload.articles : [])
        .filter((article) => article?.id && article?.title && article?.link)

      if (!mountedRef.current || requestControllerRef.current !== controller) return
      setFeed((current) => {
        const articlesById = new Map(current.articles.map((article) => [article.id, article]))
        incomingArticles.forEach((article) => articlesById.set(article.id, article))
        return {
          status: 'success',
          articles: [...articlesById.values()],
          hasNextPage: Boolean(payload.pagination?.hasNextPage),
          error: '',
        }
      })
      nextPageRef.current = page + 1
    } catch (error) {
      if (!mountedRef.current || error?.name === 'AbortError' || requestControllerRef.current !== controller) return
      setFeed((current) => ({
        ...current,
        status: current.articles.length === 0 ? 'error' : 'load-more-error',
        error: error instanceof Error ? error.message : 'Unable to load news right now.',
      }))
    } finally {
      if (requestControllerRef.current === controller) loadingRef.current = false
    }
  }, [filters, tab, user])

  useEffect(() => {
    requestControllerRef.current?.abort()
    nextPageRef.current = 1
    loadingRef.current = false
    setFeed({ status: 'loading', articles: [], hasNextPage: true, error: '' })
    void loadPage(1)
  }, [filterKey, loadPage])

  async function handleLike(article) {
    if (!user) {
      onOpenLogin()
      return
    }
    if (likeAction.articleId !== null) return

    setLikeAction({ articleId: article.id, errorArticleId: null, error: '' })
    try {
      const response = await fetch(`/api/news/${article.id}/like`, {
        method: article.likedByCurrentUser ? 'DELETE' : 'POST',
        headers: buildAuthHeaders(user),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setFeed((current) => ({
        ...current,
        articles: current.articles.map((currentArticle) => currentArticle.id === article.id
          ? { ...currentArticle, likeCount: Number(payload.likeCount) || 0, likedByCurrentUser: Boolean(payload.likedByCurrentUser) }
          : currentArticle),
      }))
      setLikeAction({ articleId: null, errorArticleId: null, error: '' })
    } catch (error) {
      setLikeAction({ articleId: null, errorArticleId: article.id, error: error instanceof Error ? error.message : 'Unable to update article like.' })
    }
  }

  async function handleSave(article) {
    if (!user) {
      onOpenLogin()
      return
    }
    if (saveAction.articleId !== null) return

    setSaveAction({ articleId: article.id, errorArticleId: null, error: '' })
    try {
      const response = await fetch(`/api/news/${article.id}/save`, {
        method: article.savedByCurrentUser ? 'DELETE' : 'POST',
        headers: buildAuthHeaders(user),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}`)
      setFeed((current) => ({
        ...current,
        articles: current.articles
          .map((currentArticle) => currentArticle.id === article.id ? { ...currentArticle, savedByCurrentUser: Boolean(payload.savedByCurrentUser) } : currentArticle)
          .filter((currentArticle) => tab !== 'saved' || currentArticle.savedByCurrentUser),
      }))
      setSaveAction({ articleId: null, errorArticleId: null, error: '' })
    } catch (error) {
      setSaveAction({ articleId: null, errorArticleId: article.id, error: error instanceof Error ? error.message : 'Unable to update saved article.' })
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !feed.hasNextPage || feed.status !== 'success') return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadPage(nextPageRef.current)
    }, { rootMargin: '320px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [feed.hasNextPage, feed.status, loadPage])

  if (feed.status === 'error') {
    return (
      <section className="news-page">
        <NewsHeading />
        <NewsTabs activeTab={tab} onChange={(nextTab) => onNavigateNews(filters, nextTab)} />
        <NewsFilters filters={filters} onChange={onNavigateNews} />
        <div className="news-feed-message error" role="alert">
          <p>Could not load the news feed. {feed.error}</p>
          <button type="button" className="secondary-button" onClick={() => loadPage(1)}>Retry</button>
        </div>
      </section>
    )
  }

  return (
    <section className="news-page">
      <NewsHeading />
      <NewsTabs activeTab={tab} onChange={(nextTab) => onNavigateNews(filters, nextTab)} />
      <NewsFilters filters={filters} onChange={onNavigateNews} />
      {tab === 'saved' && !user ? <div className="news-feed-message"><p>Sign in to view and manage your saved articles.</p><button type="button" className="secondary-button" onClick={onOpenLogin}>Sign in</button></div> : null}
      {tab !== 'saved' || user ? <>{feed.status === 'loading' ? <NewsFeedSkeleton /> : null}
      {feed.status !== 'loading' && feed.articles.length === 0 ? <SectionMessage message={filters.actor || filters.movie || filters.show ? 'No articles match these filters.' : tab === 'saved' ? 'You have no saved articles yet.' : 'No stored news articles are available yet.'} /> : null}</> : null}
      {feed.articles.length > 0 ? (
        <div className="news-feed" aria-live="polite">
          {feed.articles.map((article, index) => <NewsArticleCard key={article.id} article={article} featured={index === 0} filters={filters} onFilter={onNavigateNews} isLikePending={likeAction.articleId === article.id} likeError={likeAction.errorArticleId === article.id ? likeAction.error : ''} onLike={handleLike} isSavePending={saveAction.articleId === article.id} saveError={saveAction.errorArticleId === article.id ? saveAction.error : ''} onSave={handleSave} />)}
        </div>
      ) : null}
      {feed.status === 'loading-more' ? <div className="news-loading-more"><SpinnerIcon /><span>Loading more news…</span></div> : null}
      {feed.status === 'load-more-error' ? (
        <div className="news-feed-message error" role="alert">
          <p>Could not load more articles. {feed.error}</p>
          <button type="button" className="secondary-button" onClick={() => loadPage(nextPageRef.current)}>Retry</button>
        </div>
      ) : null}
      {feed.articles.length > 0 && !feed.hasNextPage && feed.status === 'success' ? <p className="news-feed-end">You’re all caught up.</p> : null}
      <div ref={sentinelRef} className="news-feed-sentinel" aria-hidden="true" />
    </section>
  )
}

function NewsHeading() {
  return <header className="news-heading"><p className="eyebrow">Entertainment news</p><h1>News Feed</h1><p>Latest movie, TV, and celebrity updates from trusted entertainment publishers.</p></header>
}

function NewsTabs({ activeTab, onChange }) {
  return <div className="news-tabs" role="tablist" aria-label="News views">
    <button type="button" role="tab" aria-selected={activeTab === 'news'} className={activeTab === 'news' ? 'is-active' : ''} onClick={() => onChange('news')}>News</button>
    <button type="button" role="tab" aria-selected={activeTab === 'saved'} className={activeTab === 'saved' ? 'is-active' : ''} onClick={() => onChange('saved')}><BookmarkIcon />Saved</button>
  </div>
}

function NewsFilters({ filters, onChange }) {
  const [options, setOptions] = useState({ actors: [], titles: [], selected: { actor: null, movie: null, show: null } })
  const [actorQuery, setActorQuery] = useState('')
  const [titleQuery, setTitleQuery] = useState('')
  const requestId = useRef(0)
  const selectionKey = `${filters.actor ?? ''}:${filters.movie ?? ''}:${filters.show ?? ''}`

  useEffect(() => {
    const controller = new AbortController()
    const id = ++requestId.current
    const params = new URLSearchParams()
    if (actorQuery.trim()) params.set('q', actorQuery.trim())
    if (filters.actor) params.set('actor', filters.actor)
    if (filters.movie) params.set('movie', filters.movie)
    if (filters.show) params.set('show', filters.show)
    fetch(`/api/news/filters?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Unable to load filters')
        if (id === requestId.current) setOptions({ actors: Array.isArray(payload.actors) ? payload.actors : [], titles: Array.isArray(payload.titles) ? payload.titles : [], selected: payload.selected || {} })
      })
      .catch((error) => { if (error.name !== 'AbortError' && id === requestId.current) setOptions((current) => ({ ...current, actors: [], titles: [] })) })
    return () => controller.abort()
  }, [actorQuery, filters.actor, filters.movie, filters.show, selectionKey])

  useEffect(() => {
    if (!titleQuery.trim()) return undefined
    const controller = new AbortController()
    const params = new URLSearchParams({ q: titleQuery.trim() })
    if (filters.actor) params.set('actor', filters.actor)
    if (filters.movie) params.set('movie', filters.movie)
    if (filters.show) params.set('show', filters.show)
    fetch(`/api/news/filters?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Unable to load filters')
        setOptions((current) => ({ ...current, titles: Array.isArray(payload.titles) ? payload.titles : [], selected: payload.selected || current.selected }))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [titleQuery, filters.actor, filters.movie, filters.show, selectionKey])

  const selectedActor = options.selected?.actor
  const selectedTitle = options.selected?.movie ?? options.selected?.show
  const clear = (key) => {
    const next = { ...filters, [key]: null }
    if (key === 'movie' || key === 'show') { next.movie = null; next.show = null }
    onChange(next)
  }
  return <div className="news-filters" aria-label="Filter news">
    <div className="news-filter-control"><label htmlFor="news-actor-filter">Actor</label><input id="news-actor-filter" value={actorQuery} onChange={(event) => setActorQuery(event.target.value)} placeholder={selectedActor?.name || 'Search linked actors'} />{actorQuery.trim() ? <div className="news-filter-options">{options.actors.map((actor) => <button type="button" key={actor.id} onClick={() => { onChange({ ...filters, actor: actor.id }); setActorQuery('') }}>{actor.name}</button>)}</div> : null}{selectedActor ? <button type="button" className="news-active-filter" onClick={() => clear('actor')}>{selectedActor.name} <span aria-hidden="true">×</span></button> : null}</div>
    <div className="news-filter-control"><label htmlFor="news-title-filter">Movie or show</label><input id="news-title-filter" value={titleQuery} onChange={(event) => setTitleQuery(event.target.value)} placeholder={selectedTitle?.name || 'Search linked titles'} />{titleQuery.trim() ? <div className="news-filter-options">{options.titles.map((title) => <button type="button" key={`${title.kind}-${title.id}`} onClick={() => { onChange({ ...filters, movie: title.kind === 'movie' ? title.id : null, show: title.kind === 'show' ? title.id : null }); setTitleQuery('') }}><span>{title.name}</span><small>{title.kind === 'movie' ? 'Movie' : 'TV show'}</small></button>)}</div> : null}{selectedTitle ? <button type="button" className="news-active-filter" onClick={() => clear('movie')}>{selectedTitle.name} <span aria-hidden="true">×</span></button> : null}</div>
    {(filters.actor || filters.movie || filters.show) ? <button type="button" className="news-clear-filters" onClick={() => onChange(emptyNewsFilters)}>Clear filters</button> : null}
  </div>
}

function NewsArticleCard({ article, featured = false, filters, onFilter, isLikePending, likeError, onLike, isSavePending, saveError, onSave }) {
  const [imageUnavailable, setImageUnavailable] = useState(false)
  const showImage = Boolean(article.photoUrl) && !imageUnavailable
  const source = getNewsSource(article.link)
  return (
    <article className={`news-card${featured ? ' featured' : ''}`}>
      <div className="news-card-primary">
        <a className="news-card-art" href={article.link} target="_blank" rel="noopener noreferrer" aria-label={`Read ${article.title} on ${source}`}>
          {showImage ? <img src={article.photoUrl} alt="" loading="lazy" onError={() => setImageUnavailable(true)} /> : <NewsIcon />}
          <span className={`news-card-badge${featured ? ' featured' : ''}`}>{featured ? 'Featured' : 'News'}</span>
        </a>
        <div className="news-card-copy">
          <a className="news-card-content-link" href={article.link} target="_blank" rel="noopener noreferrer" aria-label={`Read ${article.title} on ${source}`}>
            <p className="news-card-meta"><span>{source}</span><i aria-hidden="true" />{article.publishedAt ? <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time> : <span>Date unavailable</span>}</p>
            <h2>{article.title}</h2>
            {article.description ? <p className="news-card-description">{article.description}</p> : null}
            <span className="news-read-link"><GlobeIcon />Read article</span>
          </a>
          {(article.actors?.length || article.movies?.length || article.shows?.length) ? <div className="news-article-links" aria-label="Related people and titles">
            {article.actors?.map((actor) => <button type="button" className="news-article-link actor" key={`actor-${actor.id}`} onClick={() => onFilter({ ...filters, actor: actor.id })}>{actor.name}</button>)}
            {article.movies?.map((movie) => <button type="button" className="news-article-link movie" key={`movie-${movie.id}`} onClick={() => onFilter({ ...filters, movie: movie.id, show: null })}>{movie.name}</button>)}
            {article.shows?.map((show) => <button type="button" className="news-article-link show" key={`show-${show.id}`} onClick={() => onFilter({ ...filters, movie: null, show: show.id })}>{show.name}</button>)}
          </div> : null}
        </div>
      </div>
      <div className="news-future-actions" aria-label="Article actions">
        <button type="button" className={`news-article-like${article.likedByCurrentUser ? ' is-liked' : ''}`} aria-pressed={Boolean(article.likedByCurrentUser)} aria-label={`${article.likedByCurrentUser ? 'Remove like from' : 'Like'} ${article.title}; ${article.likeCount || 0} ${(article.likeCount || 0) === 1 ? 'like' : 'likes'}`} disabled={isLikePending} onClick={() => onLike(article)}><HeartIcon /><span>{article.likedByCurrentUser ? 'Liked' : 'Like'}</span><strong aria-hidden="true">{article.likeCount || 0}</strong></button>
        <button type="button" className={`news-article-save${article.savedByCurrentUser ? ' is-saved' : ''}`} aria-pressed={Boolean(article.savedByCurrentUser)} aria-label={`${article.savedByCurrentUser ? 'Remove' : 'Save'} ${article.title} ${article.savedByCurrentUser ? 'from' : 'to'} saved articles`} disabled={isSavePending} onClick={() => onSave(article)}><BookmarkIcon /><span>{article.savedByCurrentUser ? 'Saved' : 'Save'}</span></button>
      </div>
      {likeError ? <p className="news-like-error" role="alert">Could not update like. {likeError}</p> : null}
      {saveError ? <p className="news-like-error" role="alert">Could not update saved article. {saveError}</p> : null}
    </article>
  )
}

function NewsFeedSkeleton() {
  return <div className="news-feed" aria-label="Loading news">{Array.from({ length: 4 }, (_value, index) => <div key={index} className="news-card news-card-skeleton"><i /><div><span /><strong /><strong /><small /></div></div>)}</div>
}

function SeasonalMoviesPage({ state, activeTheme, onBack, onOpenMovie }) {
  const theme = state.theme || activeTheme
  const themeName = getSeasonalThemeLabel(theme)

  return (
    <section className="seasonal-movies-page">
      <div className="seasonal-movies-heading">
        <div>
          <p className="eyebrow">{theme?.emoji || '🍿'} Seasonal picks</p>
          <h1>{themeName} movies</h1>
          <p>Twenty popular movies selected from TMDB for the current seasonal theme.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onBack}>Back home</button>
      </div>
      {state.status === 'loading' ? <SectionMessage message={`Finding ${themeName.toLocaleLowerCase()} movies...`} /> : null}
      {state.status === 'error' ? <SectionMessage tone="error" message={state.error} /> : null}
      {state.status === 'success' && state.movies.length === 0 ? <SectionMessage message={`No ${themeName.toLocaleLowerCase()} movies are available from TMDB right now.`} /> : null}
      {state.status === 'success' && state.movies.length > 0 ? <div className="movie-card-grid seasonal-movies-grid">{state.movies.map((movie) => <MovieCard key={movie.id} movie={movie} onOpenMovie={onOpenMovie} />)}</div> : null}
    </section>
  )
}

function DiscoverScreen({ user, onOpenMovie, onOpenTvShow }) {
  const [step, setStep] = useState(1)
  const [type, setType] = useState(null)
  const [runtime, setRuntime] = useState(null)
  const [actorQuery, setActorQuery] = useState('')
  const [actorState, setActorState] = useState({ status: 'idle', actors: [], error: '' })
  const [actor, setActor] = useState(null)
  const [keywordQuery, setKeywordQuery] = useState('')
  const [keywordState, setKeywordState] = useState({ status: 'idle', keywords: [], error: '' })
  const [keywords, setKeywords] = useState([])
  const [resultsState, setResultsState] = useState({ status: 'idle', results: [], error: '' })

  useEffect(() => {
    if (step !== 3 || !actorQuery.trim()) {
      setActorState({ status: 'idle', actors: [], error: '' })
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setActorState({ status: 'loading', actors: [], error: '' })
      try {
        const response = await fetch(`/api/discover/actors?q=${encodeURIComponent(actorQuery.trim())}`)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Unable to look up actors.')
        if (!cancelled) setActorState({ status: 'success', actors: Array.isArray(payload.actors) ? payload.actors : [], error: '' })
      } catch (error) {
        if (!cancelled) setActorState({ status: 'error', actors: [], error: error instanceof Error ? error.message : 'Unable to look up actors.' })
      }
    }, 1000)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [actorQuery, step])

  useEffect(() => {
    if (step !== 4 || !keywordQuery.trim() || keywords.length >= 3) {
      setKeywordState({ status: 'idle', keywords: [], error: '' })
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setKeywordState({ status: 'loading', keywords: [], error: '' })
      try {
        const response = await fetch(`/api/discover/keywords?q=${encodeURIComponent(keywordQuery.trim())}`)
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Unable to look up keywords.')
        if (!cancelled) setKeywordState({ status: 'success', keywords: Array.isArray(payload.keywords) ? payload.keywords : [], error: '' })
      } catch (error) {
        if (!cancelled) setKeywordState({ status: 'error', keywords: [], error: error instanceof Error ? error.message : 'Unable to look up keywords.' })
      }
    }, 1000)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [keywordQuery, keywords.length, step])

  function chooseType(nextType) {
    setType(nextType)
    setRuntime(null)
    setStep(2)
  }

  function chooseRuntime(nextRuntime) {
    setRuntime(nextRuntime)
    setStep(3)
  }

  function chooseActor(nextActor) {
    setActor(nextActor)
    setActorQuery('')
    setStep(4)
  }

  function addKeyword(keyword) {
    if (keywords.length >= 3 || keywords.some((item) => item.id === keyword.id)) return
    setKeywords((items) => [...items, keyword])
    setKeywordQuery('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!type || !runtime || resultsState.status === 'loading') return
    setResultsState({ status: 'loading', results: [], error: '' })
    const params = new URLSearchParams({ type, runtime })
    if (actor?.id) params.set('actorId', String(actor.id))
    if (keywords.length) params.set('keywordIds', keywords.map((keyword) => keyword.id).join(','))
    try {
      const response = await fetch(`/api/discover?${params.toString()}`, { headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to find tailored picks.')
      setResultsState({ status: 'success', results: Array.isArray(payload.results) ? payload.results : [], error: '' })
    } catch (error) {
      setResultsState({ status: 'error', results: [], error: error instanceof Error ? error.message : 'Unable to find tailored picks.' })
    }
  }

  function startOver() {
    setStep(1); setType(null); setRuntime(null); setActor(null); setActorQuery(''); setKeywords([]); setKeywordQuery(''); setResultsState({ status: 'idle', results: [], error: '' })
  }

  if (resultsState.status !== 'idle') {
    const [bestMatch, ...otherResults] = resultsState.results
    return (
      <section className="discover-page">
        <div className="discover-heading"><div><p className="eyebrow">Your tailored watchlist</p><h1>We found your next great watch.</h1><p>Popular {type === 'tv' ? 'shows' : 'movies'} matched to your mood.</p></div><button type="button" className="secondary-button" onClick={startOver}>Start over</button></div>
        {resultsState.status === 'loading' ? <SectionMessage message="Finding your best matches..." /> : null}
        {resultsState.status === 'error' ? <SectionMessage tone="error" message={resultsState.error} /> : null}
        {resultsState.status === 'success' && !bestMatch ? <SectionMessage message="No matches landed this time. Try a different combination." /> : null}
        {resultsState.status === 'success' && bestMatch ? <><button type="button" className="discover-best-match" onClick={() => type === 'tv' ? onOpenTvShow(bestMatch) : onOpenMovie(bestMatch)}><span className="discover-best-label"><SparklesIcon /> Best fit for you</span><DiscoverResultArt item={bestMatch} /><div><h2>{bestMatch.title}</h2><p>{bestMatch.year} · {bestMatch.meta}</p><span className="star-rating"><StarIcon /> {bestMatch.rating}</span></div></button><div className="discover-results-grid">{otherResults.map((item) => <DiscoverResultCard key={item.id} item={item} onOpen={() => type === 'tv' ? onOpenTvShow(item) : onOpenMovie(item)} />)}</div></> : null}
      </section>
    )
  }

  const durationCopy = type === 'tv'
    ? { prompt: 'How long can you stay glued to the couch?', short: 'Quick episode bite (under 30 min)', long: 'Settle in for 35+ minutes' }
    : { prompt: 'How much time have you got before the popcorn runs out?', short: 'A tight under-two-hour ride', long: 'I’m ready for 2+ hours' }

  return (
    <section className="discover-page">
      <div className="discover-heading"><div><p className="eyebrow">Discover</p><h1>Let’s find your perfect next watch.</h1><p>Answer a few quick questions, then we’ll do the digging.</p></div></div>
      <form className="discover-wizard" onSubmit={submit}>
        <div className="discover-progress" aria-label={`Question ${step} of 4`}>{[1, 2, 3, 4].map((number) => <span key={number} className={number <= step ? 'active' : ''} />)}</div>
        {step === 1 ? <div className="discover-question"><p className="discover-step">Question 1 of 4</p><h2>What kind of escape are you after?</h2><div className="discover-choice-grid"><button type="button" onClick={() => chooseType('movie')}><ClapperIcon /><strong>Movie</strong><span>One brilliant story, one sitting.</span></button><button type="button" onClick={() => chooseType('tv')}><TvIcon /><strong>TV Show</strong><span>A world you can keep coming back to.</span></button></div></div> : null}
        {step === 2 ? <div className="discover-question"><p className="discover-step">Question 2 of 4</p><h2>{durationCopy.prompt}</h2><div className="discover-choice-grid"><button type="button" onClick={() => chooseRuntime('short')}><ClockIcon /><strong>{durationCopy.short}</strong><span>Perfect for tonight.</span></button><button type="button" onClick={() => chooseRuntime('long')}><ClockIcon /><strong>{durationCopy.long}</strong><span>Make a proper event of it.</span></button></div><button type="button" className="secondary-button discover-previous" onClick={() => setStep(1)}>Previous</button></div> : null}
        {step === 3 ? <div className="discover-question"><p className="discover-step">Question 3 of 4 · Optional</p><h2>Any performer you’d happily watch in anything?</h2><p>Type a name and choose a suggestion, or keep it wide open.</p><input className="discover-input" value={actorQuery} onChange={(event) => setActorQuery(event.target.value)} placeholder="Start typing an actor’s name" autoFocus />{actorState.status === 'loading' ? <small>Searching after your typing pause…</small> : null}{actorState.error ? <p className="discover-error">{actorState.error}</p> : null}{actorState.actors.length ? <div className="discover-suggestions">{actorState.actors.map((item) => <button type="button" className="discover-actor-suggestion" key={item.id} onClick={() => chooseActor(item)}><ActorSuggestionAvatar actor={item} /><span><b>{item.name}</b><small>{item.knownFor.length ? item.knownFor.join(' · ') : 'Performer'}</small></span></button>)}</div> : null}<div className="discover-actions discover-optional-actions"><button type="button" className="secondary-button" onClick={() => setStep(2)}>Previous</button><button type="button" className="secondary-button" onClick={() => setStep(4)}>Skip for now</button></div></div> : null}
        {step === 4 ? <div className="discover-question"><p className="discover-step">Question 4 of 4 · Optional</p><h2>What should the story whisper to you?</h2><p>Choose up to three keywords. We’ll mix them together, not narrow them down.</p><div className="discover-chip-row">{keywords.map((item) => <button type="button" key={item.id} onClick={() => setKeywords((items) => items.filter((keyword) => keyword.id !== item.id))}>{item.name} ×</button>)}</div><input className="discover-input" value={keywordQuery} disabled={keywords.length >= 3} onChange={(event) => setKeywordQuery(event.target.value)} placeholder={keywords.length >= 3 ? 'Three keywords selected' : 'Try “time travel” or “heist”'} autoFocus />{keywordState.status === 'loading' ? <small>Searching after your typing pause…</small> : null}{keywordState.error ? <p className="discover-error">{keywordState.error}</p> : null}{keywordState.keywords.length ? <div className="discover-suggestions">{keywordState.keywords.filter((item) => !keywords.some((keyword) => keyword.id === item.id)).map((item) => <button type="button" key={item.id} onClick={() => addKeyword(item)}>{item.name}</button>)}</div> : null}<div className="discover-actions"><button type="button" className="secondary-button" onClick={() => setStep(3)}>Previous</button><button type="button" className="secondary-button" onClick={submit}>Skip</button><button type="submit" className="primary-button">Show my matches <SparklesIcon /></button></div></div> : null}
      </form>
    </section>
  )
}

function DiscoverResultArt({ item }) {
  const [unavailable, setUnavailable] = useState(false)
  return <div className={`discover-result-art${item.posterUrl && !unavailable ? ' has-image' : ''}`}>{item.posterUrl && !unavailable ? <img src={item.posterUrl} alt="" onError={() => setUnavailable(true)} /> : null}</div>
}

function ActorSuggestionAvatar({ actor }) {
  const [unavailable, setUnavailable] = useState(false)
  const initials = String(actor.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className="discover-actor-avatar">{actor.profileUrl && !unavailable ? <img src={actor.profileUrl} alt="" onError={() => setUnavailable(true)} /> : initials}</span>
}

function DiscoverResultCard({ item, onOpen }) {
  return <button type="button" className="discover-result-card" onClick={onOpen}><DiscoverResultArt item={item} /><div><h3>{item.title}</h3><p>{item.year} · {item.meta}</p><span className="star-rating"><StarIcon /> {item.rating}</span></div></button>
}

function HomeScreen({ user, onOpenMovie, onOpenPopularMovies, onOpenWatchlist, onOpenDiscover, seasonalTheme, onOpenSeasonalMovies, stats, statsPeriod, onStatsPeriodChange, watchlistState, popularMoviesState, continueWatchingState, onOpenContinueWatching, onOpenTvShow, onOpenBook, latestEpisodesState, onOpenLatestEpisodes, tvWatchlistShows, tvWatchlistIds, tvWatchedIds, watchedMovieIds, readBookIds, onToggleMovieWatchlist, onToggleMovieWatched, onToggleTvWatchlist, onToggleTvWatched, onToggleBookWatchlist, onToggleBookRead }) {
  const greeting = user ? `Good evening, ${getFirstName(user.fullName)}! 🍿` : 'Good evening! 🍿'
  const homeWatchlistMovies = watchlistState.movies.slice(0, 5)
  const homeWatchlistItems = [
    watchlistState.movies[0] ? { ...watchlistState.movies[0], kind: 'movie' } : null,
    tvWatchlistShows[0] ? { ...tvWatchlistShows[0], kind: 'tv' } : null,
    watchlistState.books[0] ? { ...watchlistState.books[0], kind: 'book' } : null,
    ...watchlistState.movies.slice(1).map((item) => ({ ...item, kind: 'movie' })),
    ...tvWatchlistShows.slice(1).map((item) => ({ ...item, kind: 'tv' })),
    ...watchlistState.books.slice(1).map((item) => ({ ...item, kind: 'book' })),
  ].filter(Boolean).slice(0, 8)
  const trendingMovies = popularMoviesState.movies.slice(0, 5)
  const unfinishedShow = continueWatchingState.shows[0]
  const watchlistMovie = homeWatchlistMovies[0]
  const trendingMovie = popularMoviesState.featuredMovie
  const tonightPick = unfinishedShow
    ? {
        ...unfinishedShow,
        kind: 'tv',
        reason: 'Continue where you left off',
        detail: `${unfinishedShow.latestWatchedEpisodeLabel} · ${unfinishedShow.progress}% complete`,
        artworkUrl: unfinishedShow.posterUrl || unfinishedShow.backdropUrl,
      }
    : watchlistMovie
      ? {
          ...watchlistMovie,
          kind: 'movie',
          reason: 'From your watchlist',
          detail: watchlistMovie.meta,
          artworkUrl: watchlistMovie.posterUrl || watchlistMovie.backdropUrl,
        }
      : trendingMovie
        ? {
            ...trendingMovie,
            kind: 'movie',
            reason: user ? 'A popular pick for tonight' : 'Popular tonight',
            detail: trendingMovie.genreLabel,
            streamingService: 'Streaming TBA',
            artworkUrl: trendingMovie.posterUrl || trendingMovie.backdropUrl,
          }
        : null

  function openTonightPick() {
    if (!tonightPick) {
      onOpenDiscover()
      return
    }

    if (tonightPick.kind === 'tv') {
      onOpenTvShow(tonightPick)
      return
    }

    onOpenMovie(tonightPick)
  }

  return (
    <>
      <section className={`hero-panel${tonightPick ? ' has-tonight-pick' : ''}`}>
        <div className="hero-copy">
          <p className="eyebrow">{greeting}</p>
          <p className="tonight-pick-label"><SparklesIcon /> Tonight&apos;s pick</p>
          <h1>{tonightPick?.title || 'Find something great for tonight.'}</h1>
          <p className="hero-subcopy">{tonightPick ? `${tonightPick.reason}. ${tonightPick.detail}.` : 'Tell us your mood and available time for a tailored recommendation.'}</p>

          {tonightPick ? (
            <div className="tonight-pick-meta" aria-label="Tonight's pick details">
              <span><ClockIcon />{tonightPick.runtime || 'Runtime TBA'}</span>
              <span className="tonight-pick-service"><span aria-hidden="true">▶</span>{tonightPick.streamingService || 'Streaming TBA'}</span>
            </div>
          ) : null}

          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={openTonightPick}>
              <PlayIcon />
              <span>{tonightPick ? 'Watch / details' : 'Find tonight’s pick'}</span>
            </button>
            <button type="button" className="secondary-button" onClick={onOpenDiscover}>
              <SparklesIcon />
              <span>Find a movie</span>
            </button>
            {seasonalTheme ? <button type="button" className="secondary-button seasonal-movies-button" onClick={onOpenSeasonalMovies}>
              <span aria-hidden="true">{seasonalTheme.emoji}</span>
              <span>Explore {getSeasonalThemeLabel(seasonalTheme)} movies</span>
            </button> : null}
            <button type="button" className="secondary-button" onClick={onOpenWatchlist}>
              <BookmarkIcon />
              <span>Open watchlist</span>
            </button>
          </div>
        </div>

        <TonightPickArtwork key={tonightPick ? `${tonightPick.kind}-${tonightPick.id}` : 'empty'} pick={tonightPick} />

        <StatsPanel title="Your Stats" items={stats} period={statsPeriod} onPeriodChange={onStatsPeriodChange} />
      </section>

      <NextUpSection
        isSignedIn={Boolean(user)}
        continueWatchingState={continueWatchingState}
        movies={watchlistState.movies}
        shows={tvWatchlistShows}
        books={watchlistState.books}
        onOpenMovie={onOpenMovie}
        onOpenTvShow={onOpenTvShow}
        onOpenBook={onOpenBook}
        onOpenWatchlist={onOpenWatchlist}
      />

      <section className="mobile-stats mobile-only">
        {stats.map(({ label, value, tone, icon: Icon }) => (
          <article key={label} className="mini-stat">
            <div className={`stat-icon ${tone}`}>
              <Icon />
            </div>
            <strong>{value}</strong>
            <span>{label.replace('Time Watched', 'Time').replace('Movies Watched', 'Movies').replace('In Watchlist', 'Watchlist')}</span>
          </article>
        ))}
      </section>

      <ContentSection title="Continue Watching" action="See all" onAction={onOpenContinueWatching} className="home-secondary-section">
        {continueWatchingState.status === 'loading' ? <SectionMessage message="Loading your TV progress..." /> : null}
        {continueWatchingState.status === 'error' ? <SectionMessage message={continueWatchingState.error} tone="error" /> : null}
        {continueWatchingState.status === 'idle' ? <SectionMessage message="Sign in to view shows you are watching." /> : null}
        {continueWatchingState.status === 'success' && continueWatchingState.shows.length === 0 ? <SectionMessage message="Start watching a TV show to see it here." /> : null}
        {continueWatchingState.shows.length > 0 ? <div className="feature-grid home-secondary-rail">{continueWatchingState.shows.map((item) => <ProgressCard key={item.id} item={item} onOpenTvShow={onOpenTvShow} isInWatchlist={tvWatchlistIds.has(Number(item.id))} isWatched={tvWatchedIds.has(Number(item.id))} onToggleWatchlist={onToggleTvWatchlist} onToggleWatched={onToggleTvWatched} />)}</div> : null}
      </ContentSection>

      <section className="home-tertiary-stack" aria-label="More to explore">
        <ContentSection title="Watchlist" action="See all" onAction={onOpenWatchlist} compact className="home-tertiary-section">
          {watchlistState.status === 'loading' ? <SectionMessage message="Loading your watchlist..." /> : null}
          {watchlistState.status === 'error' ? <SectionMessage message={watchlistState.error} tone="error" /> : null}
          {watchlistState.status !== 'loading' && watchlistState.status !== 'error' && homeWatchlistItems.length === 0 ? (
            <SectionMessage message={user ? 'Your watchlist is empty for now.' : 'Sign in to view your watchlist.'} />
          ) : null}
          {homeWatchlistItems.length > 0 ? (
            <div className="home-tertiary-rail" aria-label="Watchlist">
              {homeWatchlistItems.map((item) => (
                <HomeWatchlistCard
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  onOpenMovie={onOpenMovie}
                  onOpenTvShow={onOpenTvShow}
                  onOpenBook={onOpenBook}
                  isInWatchlist
                  isWatched={item.kind === 'movie' ? watchedMovieIds.has(Number(item.id)) : item.kind === 'tv' ? tvWatchedIds.has(Number(item.id)) : readBookIds.has(item.id)}
                  onToggleWatchlist={item.kind === 'movie' ? onToggleMovieWatchlist : item.kind === 'tv' ? onToggleTvWatchlist : onToggleBookWatchlist}
                  onToggleWatched={item.kind === 'movie' ? onToggleMovieWatched : item.kind === 'tv' ? onToggleTvWatched : onToggleBookRead}
                />
              ))}
            </div>
          ) : null}
        </ContentSection>

        <ContentSection title="Trending Now" action="See all" onAction={onOpenPopularMovies} compact className="home-tertiary-section">
          {popularMoviesState.status === 'loading' || popularMoviesState.status === 'idle' ? (
            <SectionMessage message="Loading trending movies from your local database..." />
          ) : null}
          {popularMoviesState.status === 'error' ? (
            <SectionMessage message={`Could not load trending movies. ${popularMoviesState.error}`} tone="error" />
          ) : null}
          {popularMoviesState.status === 'success' && trendingMovies.length === 0 ? (
            <SectionMessage message="No trending movies are available in the local database yet." />
          ) : null}
          {trendingMovies.length > 0 ? (
            <div className="home-tertiary-rail" aria-label="Trending movies">
              {trendingMovies.map((item) => (
                <RatingCard key={item.id} item={item} onOpenMovie={onOpenMovie} isInWatchlist={watchlistState.movies.some((movie) => Number(movie.id) === Number(item.id))} isWatched={watchedMovieIds.has(Number(item.id))} onToggleWatchlist={onToggleMovieWatchlist} onToggleWatched={onToggleMovieWatched} />
              ))}
            </div>
          ) : null}
        </ContentSection>

        <ContentSection title="New Episodes" action="See all" onAction={onOpenLatestEpisodes} className="home-tertiary-section">
          <TvShowsGrid tvState={latestEpisodesState} onSelectShow={onOpenTvShow} watchedIds={tvWatchedIds} watchlistIds={tvWatchlistIds} onToggleWatchlist={onToggleTvWatchlist} onToggleWatched={onToggleTvWatched} />
        </ContentSection>
      </section>
    </>
  )
}

function NextUpSection({ isSignedIn, continueWatchingState, movies, shows, books, onOpenMovie, onOpenTvShow, onOpenBook, onOpenWatchlist }) {
  const continueShow = continueWatchingState.shows[0]
  const priorityShow = shows.find((show) => Number(show.id) !== Number(continueShow?.id))
  const priorityItems = [
    movies[0] ? {
      ...movies[0],
      kind: 'movie',
      kicker: 'High-priority movie',
      detail: [movies[0].runtime, movies[0].streamingService].filter((value) => value && !value.includes('TBA')).join(' · ') || movies[0].meta,
      actionLabel: 'Start movie',
      artworkUrl: movies[0].posterUrl || movies[0].backdropUrl,
    } : null,
    priorityShow ? {
        ...priorityShow,
        kind: 'tv',
        kicker: 'High-priority show',
        detail: priorityShow.meta,
        actionLabel: 'Start show',
        artworkUrl: priorityShow.posterUrl || priorityShow.backdropUrl,
      } : null,
    books[0] ? {
      ...books[0],
      kind: 'book',
      kicker: 'High-priority book',
      detail: `${books[0].meta} · ${books[0].categoriesLabel}`,
      actionLabel: 'Start reading',
      artworkUrl: books[0].posterUrl,
    } : null,
  ].filter(Boolean).sort((left, right) => new Date(right.watchlistedAt || 0) - new Date(left.watchlistedAt || 0))
  const items = [
    continueShow ? {
      ...continueShow,
      kind: 'tv',
      kicker: 'Continue next episode',
      detail: `${continueShow.nextEpisodeLabel} · ${continueShow.nextEpisodeTitle}`,
      actionLabel: 'Continue',
      artworkUrl: continueShow.backdropUrl || continueShow.posterUrl,
      featured: true,
    } : null,
    ...priorityItems,
  ].filter(Boolean)

  function openItem(item) {
    if (item.kind === 'movie') onOpenMovie(item)
    else if (item.kind === 'book') onOpenBook(item)
    else onOpenTvShow(item)
  }

  return (
    <section className="next-up-section" aria-labelledby="next-up-heading">
      <div className="next-up-heading">
        <div>
          <p className="next-up-eyebrow">Ready when you are</p>
          <h2 id="next-up-heading">Next up</h2>
          <p>Continue a story or start a priority pick from your watchlist.</p>
        </div>
        <button type="button" className="section-link" onClick={onOpenWatchlist}>Open watchlist</button>
      </div>
      {!isSignedIn ? <SectionMessage message="Sign in to build your cross-media Next up queue." /> : null}
      {isSignedIn && continueWatchingState.status === 'loading' ? <SectionMessage message="Building your Next up queue..." /> : null}
      {isSignedIn && continueWatchingState.status !== 'loading' && items.length === 0 ? <SectionMessage message="Add a movie, show, or book to your watchlist to build this queue." /> : null}
      {items.length ? <div className="next-up-grid">{items.map((item) => <NextUpCard key={`${item.featured ? 'continue' : item.kind}-${item.id}`} item={item} onOpen={() => openItem(item)} />)}</div> : null}
    </section>
  )
}

function NextUpCard({ item, onOpen }) {
  const [artworkUnavailable, setArtworkUnavailable] = useState(false)
  const showArtwork = Boolean(item.artworkUrl) && !artworkUnavailable
  const KindIcon = item.kind === 'movie' ? ClapperIcon : item.kind === 'book' ? BookmarkIcon : TvIcon

  return (
    <article className={`next-up-card${item.featured ? ' featured' : ''}`}>
      <button type="button" className="next-up-card-button" onClick={onOpen} aria-label={`${item.actionLabel}: ${item.title}`}>
        <div className={`next-up-art${showArtwork ? ' has-image' : ''}`}>
          {showArtwork ? <img src={item.artworkUrl} alt="" loading="lazy" onError={() => setArtworkUnavailable(true)} /> : <KindIcon />}
          <span><KindIcon />{item.kicker}</span>
        </div>
        <div className="next-up-copy">
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
          <strong>{item.actionLabel}<ChevronRight /></strong>
        </div>
      </button>
    </article>
  )
}

function TonightPickArtwork({ pick }) {
  const [artworkUnavailable, setArtworkUnavailable] = useState(false)
  const showArtwork = Boolean(pick?.artworkUrl) && !artworkUnavailable

  return (
    <div className={`hero-art tonight-pick-art${showArtwork ? ' has-image' : ''}`} aria-hidden="true">
      {showArtwork ? <img src={pick.artworkUrl} alt="" onError={() => setArtworkUnavailable(true)} /> : null}
      <div className="tonight-pick-art-glow" />
      <span className="tonight-pick-art-badge">Selected for you</span>
      {pick ? <strong>{pick.kind === 'tv' ? 'Continue watching' : 'Movie night'}</strong> : <SparklesIcon />}
    </div>
  )
}

function LoginScreen({ authError, authStatus, onCancel, onSubmit }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    await onSubmit({
      username: username.trim(),
      password,
    })
  }

  return (
    <section className="login-screen">
      <div className="login-card">
        <div className="login-copy">
          <p className="login-kicker">Account Access</p>
          <h1>Sign in to your WatchVault profile</h1>
          <p>Use the seeded demo account for now to unlock your personalized name across the app.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Username</span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="florind"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="test"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {authError ? <p className="login-error">{authError}</p> : null}

          <div className="login-actions">
            <button type="submit" className="primary-button" disabled={authStatus === 'loading'}>
              <span>{authStatus === 'loading' ? 'Signing In...' : 'Sign In'}</span>
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              <span>Back to app</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

function AdminScreen({ activeTheme, adminOverviewState, adminRunState, onBack, onRunJob, onSaveFilelistSettings, onClearFilelistSettings, onSaveIgdbSettings, onClearIgdbSettings, onSaveEnabledSections, onSetActiveTheme, onSetRssSourceEnabled, themeState }) {
  const [filelistUsername, setFilelistUsername] = useState('')
  const [filelistPasskey, setFilelistPasskey] = useState('')
  const [filelistState, setFilelistState] = useState({ status: 'idle', error: '' })
  const [igdbClientId, setIgdbClientId] = useState('')
  const [igdbPrivateKey, setIgdbPrivateKey] = useState('')
  const [igdbState, setIgdbState] = useState({ status: 'idle', error: '' })
  const [sectionState, setSectionState] = useState({ status: 'idle', error: '' })
  const [rssSourceState, setRssSourceState] = useState({ pendingKey: null, error: '' })
  const [selectedSections, setSelectedSections] = useState(() => normalizeEnabledSections(adminOverviewState.sections?.enabled))

  useEffect(() => {
    setSelectedSections(normalizeEnabledSections(adminOverviewState.sections?.enabled))
  }, [adminOverviewState.sections?.enabled])

  async function handleFilelistSave(event) {
    event.preventDefault()
    setFilelistState({ status: 'loading', error: '' })
    try {
      await onSaveFilelistSettings({ username: filelistUsername, passkey: filelistPasskey })
      setFilelistPasskey('')
      setFilelistState({ status: 'success', error: '' })
    } catch (error) { setFilelistState({ status: 'error', error: error instanceof Error ? error.message : 'Unable to save Filelist settings.' }) }
  }

  async function handleFilelistClear() {
    setFilelistState({ status: 'loading', error: '' })
    try {
      await onClearFilelistSettings()
      setFilelistUsername('')
      setFilelistPasskey('')
      setFilelistState({ status: 'success', error: '' })
    } catch (error) { setFilelistState({ status: 'error', error: error instanceof Error ? error.message : 'Unable to clear Filelist settings.' }) }
  }

  async function handleIgdbSave(event) {
    event.preventDefault()
    setIgdbState({ status: 'loading', error: '' })
    try {
      await onSaveIgdbSettings({ clientId: igdbClientId, privateKey: igdbPrivateKey })
      setIgdbPrivateKey('')
      setIgdbState({ status: 'success', error: '' })
    } catch (error) { setIgdbState({ status: 'error', error: error instanceof Error ? error.message : 'Unable to save IGDB settings.' }) }
  }

  async function handleIgdbClear() {
    setIgdbState({ status: 'loading', error: '' })
    try {
      await onClearIgdbSettings()
      setIgdbClientId('')
      setIgdbPrivateKey('')
      setIgdbState({ status: 'success', error: '' })
    } catch (error) { setIgdbState({ status: 'error', error: error instanceof Error ? error.message : 'Unable to clear IGDB settings.' }) }
  }

  async function handleSectionChange(section) {
    const nextSections = selectedSections.includes(section)
      ? selectedSections.filter((selectedSection) => selectedSection !== section)
      : [...selectedSections, section]
    setSelectedSections(nextSections)
    setSectionState({ status: 'loading', error: '' })
    try {
      const savedSections = await onSaveEnabledSections(nextSections)
      setSelectedSections(savedSections)
      setSectionState({ status: 'success', error: '' })
    } catch (error) {
      setSelectedSections(normalizeEnabledSections(adminOverviewState.sections?.enabled))
      setSectionState({ status: 'error', error: error instanceof Error ? error.message : 'Unable to save section preferences.' })
    }
  }

  async function handleRssSourceToggle(source) {
    setRssSourceState({ pendingKey: source.key, error: '' })
    try {
      await onSetRssSourceEnabled(source.key, !source.enabled)
      setRssSourceState({ pendingKey: null, error: '' })
    } catch (error) {
      setRssSourceState({ pendingKey: null, error: error instanceof Error ? error.message : 'Unable to update RSS source.' })
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div>
          <p className="admin-kicker">Admin Panel</p>
          <h1>Import Control Center</h1>
          <p>Inspect the current importer loops, manually run a job, and monitor the totals stored in the database.</p>
        </div>
        <button type="button" className="secondary-button admin-back-button" onClick={onBack}>
          <ChevronLeftIcon />
          <span>Back to dashboard</span>
        </button>
      </div>

      <section className="admin-summary-grid">
        <article className="admin-summary-card">
          <span>Total Movies Stored</span>
          <strong>{adminOverviewState.status === 'success' ? formatAdminTotal(adminOverviewState.totalMovies) : '--'}</strong>
          <p>Imported movies currently available in the local database.</p>
        </article>
        <article className="admin-summary-card">
          <span>Total Books Stored</span>
          <strong>{adminOverviewState.status === 'success' ? formatAdminTotal(adminOverviewState.totalBooks) : '--'}</strong>
          <p>Imported books currently available in the local database.</p>
        </article>
        <article className="admin-summary-card">
          <span>Total Games Stored</span>
          <strong>{adminOverviewState.status === 'success' ? formatAdminTotal(adminOverviewState.totalGames) : '--'}</strong>
          <p>Imported IGDB games currently available in the local database.</p>
        </article>
        <article className="admin-summary-card">
          <span>Total TV Shows Stored</span>
          <strong>{adminOverviewState.status === 'success' ? formatAdminTotal(adminOverviewState.totalTvShows) : '--'}</strong>
          <p>Imported TV shows currently available in the local database.</p>
        </article>
        <article className="admin-summary-card">
          <span>Total Actors Stored</span>
          <strong>{adminOverviewState.status === 'success' ? formatAdminTotal(adminOverviewState.totalActors) : '--'}</strong>
          <p>Cast members currently stored in the local database.</p>
        </article>
        <article className="admin-summary-card">
          <span>Total News Articles Stored</span>
          <strong>{adminOverviewState.status === 'success' ? formatAdminTotal(adminOverviewState.totalNewsArticles) : '--'}</strong>
          <p>Entertainment-news articles currently stored in the local database.</p>
        </article>
        <article className="admin-summary-card">
          <span>Stored Data Size</span>
          <strong>{adminOverviewState.status === 'success' ? formatAdminBytes(adminOverviewState.storedDataBytes) : '--'}</strong>
          <p>Total size used by the app tables currently stored in the database.</p>
        </article>
      </section>

      <section className="content-section admin-content-section rss-sources-section">
        <div className="section-header"><div><h2>RSS Sources</h2><span>Choose which publishers the hourly Entertainment News Import reads. Changes apply to its next scheduled or manual run.</span></div></div>
        <div className="rss-sources-list" aria-label="RSS sources">
          {adminOverviewState.rssSources.map((source) => {
            const pending = rssSourceState.pendingKey === source.key
            return <article key={source.key} className={`rss-source-row${source.enabled ? ' active' : ''}`}>
              <div><strong>{source.name}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a></div>
              <span className={`rss-source-status${source.enabled ? ' active' : ''}`}>{source.enabled ? 'Active' : 'Inactive'}</span>
              <button type="button" className={source.enabled ? 'secondary-button' : 'primary-button'} aria-pressed={source.enabled} aria-label={`${source.enabled ? 'Deactivate' : 'Activate'} ${source.name} RSS source`} disabled={pending} onClick={() => handleRssSourceToggle(source)}>{pending ? 'Saving…' : source.enabled ? 'Deactivate' : 'Activate'}</button>
            </article>
          })}
        </div>
        {rssSourceState.error ? <p className="filelist-settings-error" role="alert">{rssSourceState.error}</p> : null}
      </section>

      <section className="content-section admin-content-section">
        <div className="section-header">
          <h2>Current Jobs</h2>
        </div>

        {adminOverviewState.status === 'loading' || adminOverviewState.status === 'idle' ? (
          <SectionMessage message="Loading admin jobs and database totals..." />
        ) : null}

        {adminOverviewState.status === 'error' ? (
          <SectionMessage message={`Could not load admin data. ${adminOverviewState.error}`} tone="error" />
        ) : null}

        {adminOverviewState.status === 'success' ? (
          <div className="admin-jobs-list" role="table" aria-label="Admin jobs">
            <div className="admin-jobs-header" role="row">
              <span role="columnheader">Name</span>
              <span role="columnheader">Execution</span>
              <span role="columnheader">Frequency</span>
              <span role="columnheader">Last execution date</span>
              <span role="columnheader">Action</span>
            </div>

            {adminOverviewState.crons.map((job) => {
              const runState = adminRunState[job.key] ?? adminRunIdleState
              const isRunning = runState.status === 'loading'

              return (
                <article key={job.key} className="admin-job-row" role="row">
                  <div className="admin-job-cell">
                    <strong>{job.name}</strong>
                    <p>{runState.message || 'Ready to run manually.'}</p>
                  </div>
                  <div className="admin-job-cell">
                    <span>{job.execution}</span>
                  </div>
                  <div className="admin-job-cell">
                    <span>{job.frequency}</span>
                  </div>
                  <div className="admin-job-cell">
                    <time dateTime={job.lastExecutedAt || undefined}>{formatAdminJobExecutionDate(job.lastExecutedAt)}</time>
                  </div>
                  <div className="admin-job-action-cell">
                    <button
                      type="button"
                      className={`admin-run-button${runState.status === 'error' ? ' error' : ''}${runState.status === 'success' ? ' success' : ''}`}
                      onClick={() => onRunJob(job.key)}
                      disabled={isRunning}
                      aria-label={`Run ${job.name} manually`}
                    >
                      {isRunning ? <SpinnerIcon /> : <RunJobIcon />}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>

      <section className="content-section admin-content-section seasonal-themes-section">
        <div className="section-header">
          <div>
            <h2>Seasonal Themes</h2>
            <span>Preview upcoming website themes and their suggested activation windows.</span>
          </div>
        </div>
        <div className="seasonal-themes-list" role="table" aria-label="Seasonal themes">
          <div className="seasonal-themes-header" role="row">
            <span role="columnheader">Event / Theme</span>
            <span role="columnheader">Date in 2026</span>
            <span role="columnheader">Suggested website theme period</span>
            <span role="columnheader">Action</span>
          </div>
          {seasonalThemes.map((theme) => {
            const isActive = theme.key === activeTheme
            const isPending = themeState.status === 'loading' && themeState.pendingTheme === theme.key
            const label = !theme.available ? 'Coming soon' : isPending ? (isActive ? 'Deactivating…' : 'Activating…') : isActive ? 'Deactivate' : 'Activate'
            return (
            <article key={theme.key} className={`seasonal-theme-row${isActive ? ' active' : ''}`} role="row">
              <div className="seasonal-theme-cell seasonal-theme-name" role="cell">
                <span className="seasonal-theme-mobile-label">Event / Theme</span>
                <span aria-hidden="true">{theme.emoji}</span>
                <strong>{theme.name}</strong>{isActive ? <em>Active</em> : null}
              </div>
              <div className="seasonal-theme-cell" role="cell">
                <span className="seasonal-theme-mobile-label">Date in 2026</span>
                <span>{theme.date}</span>
              </div>
              <div className="seasonal-theme-cell" role="cell">
                <span className="seasonal-theme-mobile-label">Suggested website theme period</span>
                <span>{theme.period}</span>
              </div>
              <div className="seasonal-theme-action-cell" role="cell">
                <button
                  type="button"
                  className={isActive ? 'secondary-button' : 'primary-button'}
                  aria-label={theme.available ? `${isActive ? 'Deactivate' : 'Activate'} ${theme.name} theme` : `${theme.name} is coming soon`}
                  aria-pressed={isActive}
                  disabled={!theme.available || themeState.status === 'loading'}
                  onClick={() => onSetActiveTheme(isActive ? defaultThemeKey : theme.key)}
                >{label}</button>
              </div>
            </article>
            )
          })}
        </div>
        {themeState.message ? <p className="filelist-settings-success" role="status">{themeState.message}</p> : null}
        {themeState.error ? <p className="filelist-settings-error" role="alert">{themeState.error}</p> : null}
      </section>

      <section className="content-section admin-content-section section-preferences-section">
        <div className="section-header"><div><h2>Visible sections</h2><span>Choose which primary sections appear in your navigation. Movies and TV Shows are always available.</span></div></div>
        <fieldset className="section-preferences-control" disabled={sectionState.status === 'loading'}>
          <legend>Enabled sections</legend>
          <div className="section-preferences-options">
            {[['movies', 'Movies'], ['tv', 'TV Shows'], ['books', 'Books'], ['games', 'Games'], ['calendar', 'Calendar']].map(([section, label]) => {
              const required = requiredEnabledSections.includes(section)
              const selected = selectedSections.includes(section)
              return <label key={section} className={`section-preference-option${selected ? ' selected' : ''}${required ? ' required' : ''}`}>
                <input type="checkbox" checked={selected} disabled={required} onChange={() => handleSectionChange(section)} />
                <span>{label}</span>
                {required ? <small>Required</small> : null}
              </label>
            })}
          </div>
        </fieldset>
        {sectionState.status === 'success' ? <p className="filelist-settings-success" role="status">Section preferences saved.</p> : null}
        {sectionState.status === 'error' ? <p className="filelist-settings-error" role="alert">{sectionState.error}</p> : null}
      </section>

      <section className="content-section admin-content-section filelist-settings-section">
        <div className="section-header"><div><h2>Filelist</h2><span>{adminOverviewState.filelist?.configured ? 'Your encrypted credentials are saved.' : 'Configure your credentials to search from movie pages.'}</span></div></div>
        <form className="filelist-settings-form" onSubmit={handleFilelistSave}>
          <label>Filelist username<input value={filelistUsername} onChange={(event) => setFilelistUsername(event.target.value)} required placeholder={adminOverviewState.filelist?.configured ? 'Saved — enter to replace' : 'Username'} /></label>
          <label>Filelist passkey<input type="password" value={filelistPasskey} onChange={(event) => setFilelistPasskey(event.target.value)} required placeholder={adminOverviewState.filelist?.configured ? 'Saved — enter to replace' : 'Passkey'} /></label>
          <div className="filelist-settings-actions"><button type="submit" className="primary-button" disabled={filelistState.status === 'loading'}>{filelistState.status === 'loading' ? 'Saving...' : adminOverviewState.filelist?.configured ? 'Replace credentials' : 'Save credentials'}</button>{adminOverviewState.filelist?.configured ? <button type="button" className="secondary-button" disabled={filelistState.status === 'loading'} onClick={handleFilelistClear}>Clear credentials</button> : null}</div>
        </form>
        {filelistState.status === 'success' ? <p className="filelist-settings-success" role="status">Filelist settings saved.</p> : null}
        {filelistState.status === 'error' ? <p className="filelist-settings-error" role="alert">{filelistState.error}</p> : null}
      </section>

      <section className="content-section admin-content-section filelist-settings-section">
        <div className="section-header"><div><h2>IGDB API</h2><span>{adminOverviewState.igdb?.configured ? 'Encrypted app-wide IGDB credentials are saved.' : 'Add app-wide credentials for future IGDB-powered game data.'}</span></div></div>
        <form className="filelist-settings-form" onSubmit={handleIgdbSave}>
          <label>IGDB client ID<input value={igdbClientId} onChange={(event) => setIgdbClientId(event.target.value)} required placeholder={adminOverviewState.igdb?.configured ? 'Saved — enter to replace' : 'Client ID'} /></label>
          <label>IGDB private key<input type="password" value={igdbPrivateKey} onChange={(event) => setIgdbPrivateKey(event.target.value)} required placeholder={adminOverviewState.igdb?.configured ? 'Saved — enter to replace' : 'Private key'} /></label>
          <div className="filelist-settings-actions"><button type="submit" className="primary-button" disabled={igdbState.status === 'loading'}>{igdbState.status === 'loading' ? 'Saving...' : adminOverviewState.igdb?.configured ? 'Replace credentials' : 'Save credentials'}</button>{adminOverviewState.igdb?.configured ? <button type="button" className="secondary-button" disabled={igdbState.status === 'loading'} onClick={handleIgdbClear}>Clear credentials</button> : null}</div>
        </form>
        {igdbState.status === 'success' ? <p className="filelist-settings-success" role="status">IGDB settings saved.</p> : null}
        {igdbState.status === 'error' ? <p className="filelist-settings-error" role="alert">{igdbState.error}</p> : null}
      </section>
    </section>
  )
}

function AccountScreen({ changePasswordState, onBack, onSubmit, user }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (changePasswordState.status === 'success') {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [changePasswordState.status])

  async function handleSubmit(event) {
    event.preventDefault()
    await onSubmit({
      currentPassword,
      newPassword,
      confirmPassword,
    })
  }

  return (
    <section className="account-page">
      <div className="account-page-header">
        <div>
          <p className="admin-kicker">Account</p>
          <h1>Change your password</h1>
          <p>
            {user?.fullName
              ? `Update the password for ${user.fullName}'s WatchVault account.`
              : 'Update your WatchVault password.'}
          </p>
        </div>
        <button type="button" className="secondary-button admin-back-button" onClick={onBack}>
          <ChevronLeftIcon />
          <span>Back to dashboard</span>
        </button>
      </div>

      <div className="account-card">
        <div className="account-card-copy">
          <p className="login-kicker">Security</p>
          <h2>Confirm your current password, then set a new one.</h2>
          <p>Your signed-in session stays active after the change. Use the new password the next time you sign in.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Current Password</span>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <span>New Password</span>
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>

          <label className="login-field">
            <span>Confirm New Password</span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          {changePasswordState.error ? <p className="login-error">{changePasswordState.error}</p> : null}
          {changePasswordState.message ? <p className="account-success">{changePasswordState.message}</p> : null}

          <div className="login-actions">
            <button type="submit" className="primary-button" disabled={changePasswordState.status === 'loading'}>
              <span>{changePasswordState.status === 'loading' ? 'Updating...' : 'Update Password'}</span>
            </button>
            <button type="button" className="secondary-button" onClick={onBack}>
              <span>Cancel</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

function CalendarScreen({ calendarMonth, mediaType, selectedDate, calendarState, onMonthChange, onMediaTypeChange, onSelectDate, onOpenMovie, onOpenTvShow, onOpenLogin }) {
  const eventsByDate = new Map()
  for (const event of calendarState.events) {
    const current = eventsByDate.get(event.date) ?? []
    current.push(event)
    eventsByDate.set(event.date, current)
  }
  const selectedEvents = eventsByDate.get(selectedDate) ?? []
  const today = getLocalIsoDate()
  const monthDays = getCalendarMonthDays(calendarMonth)
  const openEvent = (event) => event.mediaType === 'tv' ? onOpenTvShow({ id: event.mediaId, title: event.title }) : onOpenMovie({ id: event.mediaId, title: event.title })

  if (calendarState.status === 'signed-out') {
    return <section className="calendar-page"><CalendarPageHeading /><div className="calendar-message"><CalendarIcon /><h2>Sign in to see your schedule</h2><p>Your Calendar is built from your movie and TV watchlist.</p><button type="button" className="primary-button" onClick={onOpenLogin}>Sign in</button></div></section>
  }

  return (
    <section className="calendar-page">
      <CalendarPageHeading />
      <div className="calendar-filters" role="tablist" aria-label="Calendar media type">
        {[['all', 'All'], ['tv', 'TV Shows'], ['movie', 'Movies']].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={mediaType === value} className={mediaType === value ? 'active' : ''} onClick={() => onMediaTypeChange(value)}>{label}</button>
        ))}
      </div>

      {calendarState.status === 'loading' ? <div className="calendar-message compact"><p>Loading your release schedule…</p></div> : null}
      {calendarState.status === 'error' ? <div className="calendar-message compact" role="alert"><p>{calendarState.error}</p></div> : null}
      {calendarState.status === 'success' ? (
        <div className="calendar-layout">
          <div className="calendar-main-panel">
            <div className="calendar-month-header">
              <button type="button" className="calendar-month-button" aria-label="Previous month" onClick={() => onMonthChange(shiftIsoMonth(calendarMonth, -1))}><ChevronLeftIcon /></button>
              <h2>{formatCalendarMonth(calendarMonth)}</h2>
              <button type="button" className="calendar-month-button" aria-label="Next month" onClick={() => onMonthChange(shiftIsoMonth(calendarMonth, 1))}><ChevronRight /></button>
            </div>
            <div className="calendar-weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-grid">
              {monthDays.map((day) => {
                const events = eventsByDate.get(day.isoDate) ?? []
                return <button key={day.isoDate} type="button" className={`calendar-day${day.isOutsideMonth ? ' outside' : ''}${selectedDate === day.isoDate ? ' selected' : ''}${day.isoDate === today ? ' today' : ''}`} onClick={() => onSelectDate(day.isoDate)}>
                  <span className="calendar-day-number">{day.day}</span>
                  <span className="calendar-day-events">{events.slice(0, 2).map((event) => <span key={`${event.mediaType}-${event.mediaId}-${event.episodeId ?? ''}`} className={`calendar-event-chip ${event.mediaType}`}><span className="calendar-event-art" style={event.posterUrl ? { backgroundImage: `url(${event.backdropUrl || event.posterUrl})` } : undefined} /><span>{event.mediaType === 'tv' ? event.episodeLabel : event.title}</span></span>)}</span>
                  {events.length > 2 ? <small>+{events.length - 2} more</small> : null}
                </button>
              })}
            </div>
          </div>

          <aside className="calendar-upcoming-panel">
            <div className="calendar-panel-heading"><h2>Upcoming This Week</h2><span>{calendarState.upcoming.length}</span></div>
            {calendarState.upcoming.length ? <div className="calendar-upcoming-list">{calendarState.upcoming.map((event) => <CalendarEventRow key={`${event.date}-${event.mediaType}-${event.mediaId}-${event.episodeId ?? ''}`} event={event} onOpen={() => openEvent(event)} />)}</div> : <p className="calendar-empty-copy">Nothing scheduled this week.</p>}
          </aside>
        </div>
      ) : null}

      {calendarState.status === 'success' ? <section className="calendar-agenda-panel">
        <div className="calendar-panel-heading"><div><h2>{formatCalendarDate(selectedDate)}</h2><p>{selectedDate === today ? 'Today' : 'Selected day'}</p></div><span>{selectedEvents.length}</span></div>
        {selectedEvents.length ? <div className="calendar-agenda-list">{selectedEvents.map((event) => <CalendarEventRow key={`${event.mediaType}-${event.mediaId}-${event.episodeId ?? ''}`} event={event} onOpen={() => openEvent(event)} agenda />)}</div> : <p className="calendar-empty-copy">No eligible movie releases or episodes on this day.</p>}
      </section> : null}
    </section>
  )
}

function CalendarPageHeading() {
  return <div className="calendar-page-heading"><h1>Calendar</h1><p>Keep up with watchlist releases and the next episodes in your shows.</p></div>
}

function CalendarEventRow({ event, onOpen, agenda = false }) {
  return <button type="button" className={`calendar-event-row${agenda ? ' agenda' : ''}`} onClick={onOpen}>
    <span className="calendar-event-row-art" style={event.posterUrl ? { backgroundImage: `url(${event.backdropUrl || event.posterUrl})` } : undefined} />
    <span className="calendar-event-row-copy"><b>{event.mediaType === 'tv' ? event.episodeTitle || event.title : event.title}</b><small>{event.mediaType === 'tv' ? `${event.title} · ${event.episodeLabel}` : 'Movie premiere'}</small></span>
    <time dateTime={event.date}>{formatCalendarShortDate(event.date)}</time>
  </button>
}

function MoviesScreen({
  activeTab,
  setActiveTab,
  screenMode,
  selectedGenre,
  genreMoviesState,
  onChangeGenrePage,
  popularMoviesState,
  onChangePopularPage,
  recentMoviesState,
  onChangeRecentPage,
  topRatedMoviesState,
  onChangeTopRatedPage,
  upcomingMoviesState,
  onChangeUpcomingPage,
  isSignedIn,
  hideWatched,
  onHideWatchedChange,
  movieStats,
  statsPeriod,
  onStatsPeriodChange,
  watchedActionState,
  watchedMovieIds,
  watchlistActionState,
  watchlistMovies,
  onToggleWatched,
  onToggleWatchlist,
  onOpenPopularMovies,
  onOpenRecentlyReleasedMovies,
  onOpenTopRatedMovies,
  onOpenUpcomingMovies,
  onOpenWatchlist,
  onOpenMovie,
}) {
  const [catalogSort, setCatalogSort] = useState('featured')
  const isGenreListMode = screenMode === movieScreenModes.genreList && Boolean(selectedGenre?.name)
  const isPopularListMode = screenMode === movieScreenModes.popularList && activeTab === 'Popular'
  const isNowPlayingListMode = screenMode === movieScreenModes.nowPlayingList && activeTab === 'Now Playing'
  const isTopRatedListMode = screenMode === movieScreenModes.topRatedList && activeTab === 'Top Rated'
  const isUpcomingListMode = screenMode === movieScreenModes.upcomingList && activeTab === 'Upcoming'
  const isCatalogListMode = isGenreListMode || isPopularListMode || isNowPlayingListMode || isTopRatedListMode || isUpcomingListMode
  const watchlistMovieIds = new Set(watchlistMovies.map((movie) => Number(movie.id)))

  return (
    <section className="movies-page">
      <div className="movies-browse-toolbar">
        <div className="movies-heading">
          <h1>{isCatalogListMode ? 'Browse movies' : 'Discover movies'}</h1>
        <p>
          {isGenreListMode
            ? `Browse all ${selectedGenre.name} movies in your local database, 30 titles at a time.`
            : isPopularListMode
            ? 'Browse popular movies imported from your local database, 30 titles at a time.'
            : isNowPlayingListMode
              ? 'Browse recently released movies from your local database, 30 titles at a time.'
              : isTopRatedListMode
                ? 'Browse top rated movies ordered by score, 30 titles at a time.'
              : isUpcomingListMode
                ? 'Browse upcoming releases from the next 30 days, 30 titles at a time.'
            : 'Discover, track, and organize your favorite films.'}
        </p>
        </div>

        <section className="movies-toolbar-controls" aria-label="Movie browsing controls">
          <button
            type="button"
            className={`movies-discover-button${!isCatalogListMode ? ' active' : ''}`}
            onClick={() => setActiveTab('All Movies')}
            aria-current={!isCatalogListMode ? 'page' : undefined}
          >
            Discover
          </button>
          <div className="tab-row movies-tab-row" aria-label="Movie catalog categories">
        {movieTabs.filter((tab) => tab !== 'All Movies').map((tab) => (
          <button
            key={tab}
            type="button"
            className={`filter-pill${tab === activeTab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
          </div>
          {isCatalogListMode ? <label className="movies-sort-control">Sort
            <select value={catalogSort} onChange={(event) => setCatalogSort(event.target.value)}>
              <option value="featured">Featured</option>
              <option value="rating">Rating</option>
              <option value="release">Release date</option>
            </select>
          </label> : null}
        {isSignedIn && isCatalogListMode ? (
          <button type="button" className={`filter-pill movies-hide-watched-filter${hideWatched ? ' active' : ''}`} aria-pressed={hideWatched} onClick={() => onHideWatchedChange(!hideWatched)}>
            <CheckIcon />
            <span>Hide watched</span>
          </button>
        ) : null}
        </section>
      </div>

      {isGenreListMode ? (
        <ContentSection title={`${selectedGenre.name} Movies`}>
          <GenreMoviesGrid
            genreMoviesState={genreMoviesState}
            onOpenMovie={onOpenMovie}
            watchedMovieIds={watchedMovieIds}
            watchlistMovieIds={watchlistMovieIds}
            onToggleWatchlist={onToggleWatchlist}
            onToggleWatched={onToggleWatched}
            sort={catalogSort}
          />
          <PaginationControls pagination={genreMoviesState.pagination} onPageChange={onChangeGenrePage} />
        </ContentSection>
      ) : isPopularListMode ? (
        <ContentSection title="Popular Right Now">
          <PopularMoviesGrid
            popularMoviesState={popularMoviesState}
            layout="catalog"
            onOpenMovie={onOpenMovie}
            watchedMovieIds={watchedMovieIds}
            watchlistMovieIds={watchlistMovieIds}
            onToggleWatchlist={onToggleWatchlist}
            onToggleWatched={onToggleWatched}
            sort={catalogSort}
          />
          <PaginationControls pagination={popularMoviesState.pagination} onPageChange={onChangePopularPage} />
        </ContentSection>
      ) : isNowPlayingListMode ? (
        <ContentSection title="Now Playing">
          <RecentlyReleasedSlider
            recentMoviesState={recentMoviesState}
            layout="catalog"
            onOpenMovie={onOpenMovie}
            watchedMovieIds={watchedMovieIds}
            watchlistMovieIds={watchlistMovieIds}
            onToggleWatchlist={onToggleWatchlist}
            onToggleWatched={onToggleWatched}
            sort={catalogSort}
          />
          <PaginationControls pagination={recentMoviesState.pagination} onPageChange={onChangeRecentPage} />
        </ContentSection>
      ) : isTopRatedListMode ? (
        <ContentSection title="Top Rated">
          <TopRatedMoviesGrid
            topRatedMoviesState={topRatedMoviesState}
            layout="catalog"
            onOpenMovie={onOpenMovie}
            watchedMovieIds={watchedMovieIds}
            watchlistMovieIds={watchlistMovieIds}
            onToggleWatchlist={onToggleWatchlist}
            onToggleWatched={onToggleWatched}
            sort={catalogSort}
          />
          <PaginationControls pagination={topRatedMoviesState.pagination} onPageChange={onChangeTopRatedPage} />
        </ContentSection>
      ) : isUpcomingListMode ? (
        <ContentSection title="Upcoming Soon">
          <UpcomingMoviesGrid
            upcomingMoviesState={upcomingMoviesState}
            layout="catalog"
            onOpenMovie={onOpenMovie}
            watchedMovieIds={watchedMovieIds}
            watchlistMovieIds={watchlistMovieIds}
            onToggleWatchlist={onToggleWatchlist}
            onToggleWatched={onToggleWatched}
            sort={catalogSort}
          />
          <PaginationControls pagination={upcomingMoviesState.pagination} onPageChange={onChangeUpcomingPage} />
        </ContentSection>
      ) : (
        <>
          <div className="movies-layout">
            <div className="movies-main">
              <FeaturedMovieCard
                popularMoviesState={popularMoviesState}
                onToggleWatched={onToggleWatched}
                onToggleWatchlist={onToggleWatchlist}
                onOpenMovie={onOpenMovie}
                watchedActionState={watchedActionState}
                watchedMovieIds={watchedMovieIds}
                watchlistActionState={watchlistActionState}
                watchlistMovieIds={watchlistMovieIds}
              />

              <ContentSection title="Popular Right Now" action="View all" onAction={onOpenPopularMovies}>
                <PopularMoviesGrid
                  popularMoviesState={popularMoviesState}
                  onOpenMovie={onOpenMovie}
                  watchedMovieIds={watchedMovieIds}
                  watchlistMovieIds={watchlistMovieIds}
                  onToggleWatchlist={onToggleWatchlist}
                  onToggleWatched={onToggleWatched}
                />
              </ContentSection>

              <ContentSection title="Recently Released" action="View all" onAction={onOpenRecentlyReleasedMovies}>
                <RecentlyReleasedSlider
                  recentMoviesState={recentMoviesState}
                  onOpenMovie={onOpenMovie}
                  watchedMovieIds={watchedMovieIds}
                  watchlistMovieIds={watchlistMovieIds}
                  onToggleWatchlist={onToggleWatchlist}
                  onToggleWatched={onToggleWatched}
                />
              </ContentSection>

              <ContentSection title="Upcoming Soon" action="View all" onAction={onOpenUpcomingMovies}>
                <UpcomingMoviesGrid
                  upcomingMoviesState={upcomingMoviesState}
                  onOpenMovie={onOpenMovie}
                  watchedMovieIds={watchedMovieIds}
                  watchlistMovieIds={watchlistMovieIds}
                  onToggleWatchlist={onToggleWatchlist}
                  onToggleWatched={onToggleWatched}
                />
              </ContentSection>

              <ContentSection title="Top Rated" action="View all" onAction={onOpenTopRatedMovies}>
                <TopRatedMoviesGrid
                  topRatedMoviesState={topRatedMoviesState}
                  onOpenMovie={onOpenMovie}
                  watchedMovieIds={watchedMovieIds}
                  watchlistMovieIds={watchlistMovieIds}
                  onToggleWatchlist={onToggleWatchlist}
                  onToggleWatched={onToggleWatched}
                />
              </ContentSection>
            </div>

            <aside className="movies-rail">
              <StatsPanel title="Your Movie Stats" items={movieStats} period={statsPeriod} onPeriodChange={onStatsPeriodChange} />
              <MovieWatchlistPanel
                items={watchlistMovies.slice(0, 4)}
                onOpenMovie={onOpenMovie}
                onOpenWatchlist={onOpenWatchlist}
              />
            </aside>
          </div>

          <section className="movie-mobile-stats mobile-only">
            {movieStats.map(({ label, value, tone, icon: Icon }) => (
              <article key={label} className="mini-stat">
                <div className={`stat-icon ${tone}`}>
                  <Icon />
                </div>
                <strong>{value}</strong>
                <span>{label.replace('Movies Watched', 'Watched').replace('In Watchlist', 'Watchlist').replace('Hours Watched', 'Hours')}</span>
              </article>
            ))}
          </section>
        </>
      )}
    </section>
  )
}

function BooksScreen({ booksState, onPageChange, onOpenBook }) {
  return (
    <section className="movies-page">
      <div className="movies-heading"><h1>Books</h1><p>Discover books imported from your local catalog.</p></div>
      <ContentSection title="Books">
        <BooksGrid booksState={booksState} onOpenBook={onOpenBook} />
        <PaginationControls pagination={booksState.pagination} onPageChange={onPageChange} />
      </ContentSection>
    </section>
  )
}

const gameTabs = [
  { id: 'all', label: 'All Games' },
  { id: 'popular', label: 'Popular' },
  { id: 'recent', label: 'Recent' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'favorites', label: 'Favorites' },
]

function GamesScreen({ activeTab, dashboardState, favoriteGames, gameActivityState, gameAchievementsState, gamesState, onTabChange, onPageChange, onToggleFavorite, onOpenGame, onOpenGameAchievements }) {
  const activeTabLabel = gameTabs.find((tab) => tab.id === activeTab)?.label || 'Popular'
  const favoriteGameIds = new Set(favoriteGames.map((game) => game.id))

  return (
    <section className="games-page">
      <header className="games-heading">
        <h1>Games</h1>
        <p>Play, compete, and discover movie &amp; TV inspired games.</p>
      </header>

      <div className="games-tabs" role="tablist" aria-label="Game collections">
        {gameTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => onTabChange(tab.id)}>{tab.label}</button>)}
      </div>

      <div className="games-layout">
        <div className="games-main">
          {activeTab === 'all' ? <GamesDashboard dashboardState={dashboardState} gameAchievementsState={gameAchievementsState} favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleFavorite} onOpenGame={onOpenGame} onOpenGameAchievements={onOpenGameAchievements} /> : activeTab === 'favorites' ? <section className="games-catalog">
            <div className="games-shelf-heading"><h2>Favorite Games</h2></div>
            {favoriteGames.length ? <GameCardsGrid className="games-catalog-grid" games={favoriteGames} label="Favorite" favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleFavorite} onOpenGame={onOpenGame} /> : <SectionMessage message="No favorite games yet. Use the heart on a game to add it here." />}
          </section> : <section className="games-catalog">
            <div className="games-shelf-heading"><h2>{activeTabLabel} Games</h2></div>
            {gamesState.status === 'loading' || gamesState.status === 'idle' ? <SectionMessage message={`Loading ${activeTabLabel.toLowerCase()} games from your local database...`} /> : null}
            {gamesState.status === 'error' ? <SectionMessage message={`Could not load ${activeTabLabel.toLowerCase()} games. ${gamesState.error}`} tone="error" /> : null}
            {gamesState.status === 'success' && gamesState.games.length === 0 ? <SectionMessage message={`No ${activeTabLabel.toLowerCase()} games are available in the local database yet.`} /> : null}
            {gamesState.status === 'success' && gamesState.games.length ? <><GameCardsGrid className="games-catalog-grid" games={gamesState.games} label={activeTabLabel} favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleFavorite} onOpenGame={onOpenGame} /><PaginationControls pagination={gamesState.pagination} onPageChange={onPageChange} /></> : null}
          </section>}
        </div>

        <aside className="games-sidebar">
          <GameActivityPanel state={gameActivityState} />
        </aside>
      </div>
    </section>
  )
}

function GameActivityPanel({ state }) {
  const isSignedIn = state.status !== 'idle'
  const activity = state.activity || emptyGameActivity
  const isLoading = state.status === 'loading'
  const value = (resolved) => isLoading ? '—' : resolved
  return <section className="games-side-card"><h2>Your Game Activity</h2><GameMetric icon={<GamepadIcon />} label="Games Played" value={value(String(activity.gamesPlayed))} detail={isSignedIn ? 'Games marked played' : 'Sign in to see activity'} /><GameMetric icon={<ClockIcon />} label="Hours Played" value={value(formatMinutesAsHoursAndMinutes(activity.playtimeMinutes))} detail={isSignedIn ? 'From your game tracker' : 'Sign in to see activity'} /><GameMetric icon={<CalendarIcon />} label="Last Completed" value={value(activity.lastCompletedAt ? formatLongDate(activity.lastCompletedAt) : '—')} detail={isSignedIn ? (activity.lastCompletedAt ? 'Latest completed game' : 'No completed games yet') : 'Sign in to see activity'} /></section>
}

function GamesDashboard({ dashboardState, gameAchievementsState, favoriteGameIds, onToggleFavorite, onOpenGame, onOpenGameAchievements }) {
  const featuredGame = dashboardState.popularGames[0]
  if (dashboardState.status === 'loading' || dashboardState.status === 'idle') return <SectionMessage message="Loading games from your local database..." />
  if (dashboardState.status === 'error') return <SectionMessage message={`Could not load the games dashboard. ${dashboardState.error}`} tone="error" />
  if (!featuredGame) return <SectionMessage message="No games are available in the local database yet." />
  return <><article className="games-featured-card"><div className="games-featured-copy"><span className="games-kicker">Featured game</span><h2>{featuredGame.title}</h2><p style={{ display: '-webkit-box', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 4 }}>{featuredGame.summary}</p><div className="games-featured-meta"><span><StarIcon /> {featuredGame.rating}</span><span>◉ {featuredGame.playersLabel}</span></div><div className="games-featured-actions"><button type="button" className="games-play-button" onClick={() => onOpenGame(featuredGame)}><PlayIcon /> View game</button><button type="button" className="games-favorite-button" onClick={() => onToggleFavorite(featuredGame)}><HeartIcon /> {favoriteGameIds.has(featuredGame.id) ? 'Remove Favorite' : 'Add to Favorites'}</button></div></div><button type="button" className="games-featured-art-button" onClick={() => onOpenGame(featuredGame)} aria-label={`Open ${featuredGame.title}`}><GameArt game={featuredGame} featured /></button></article><GamesShelf title="Popular Right Now" games={dashboardState.popularGames} label="Popular" favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleFavorite} onOpenGame={onOpenGame} />{dashboardState.recentGames.length ? <GamesShelf title="Recently Released" games={dashboardState.recentGames} label="Recent" favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleFavorite} onOpenGame={onOpenGame} /> : null}{dashboardState.upcomingGames.length ? <GamesShelf title="Upcoming Games" games={dashboardState.upcomingGames} label="Upcoming" favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleFavorite} onOpenGame={onOpenGame} /> : null}<GameAchievementsPanel state={gameAchievementsState} onViewAll={onOpenGameAchievements} /></>
}

function GamesShelf({ title, games, label, favoriteGameIds, onToggleFavorite, onOpenGame }) {
  return <section className="games-shelf"><div className="games-shelf-heading"><h2>{title}</h2></div><GameCardsGrid className="games-card-grid" games={games} label={label} favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleFavorite} onOpenGame={onOpenGame} /></section>
}

function GameCardsGrid({ className, games, label, favoriteGameIds, onToggleFavorite, onOpenGame }) {
  return <div className={className}>{games.map((game) => <article className={`games-card games-art-${game.art || 'trivia'}`} key={game.id || game.title}><button type="button" className={`games-favorite-toggle${favoriteGameIds.has(game.id) ? ' active' : ''}`} onClick={() => onToggleFavorite(game)} aria-label={favoriteGameIds.has(game.id) ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}><HeartIcon /></button><button type="button" className="games-card-open" onClick={() => onOpenGame(game)} aria-label={`Open ${game.title}`}><GameArt game={game} showLabel /><h3>{game.title}</h3><small>{game.playersLabel || game.meta}</small><div><span><StarIcon /> {game.rating}</span><em>{label}</em></div></button></article>)}</div>
}

function GameArt({ game, featured = false, showLabel = true }) {
  const fallbackLabel = game.art === 'television' ? 'TV SHOW\nTRIVIA' : game.art === 'character' ? 'GUESS THE\nCHARACTER' : game.art === 'poster' ? 'POSTER\nPUZZLE' : game.art === 'quote' ? 'QUOTE\nMATCH' : game.art === 'choice' ? 'THIS OR\nTHAT' : game.title
  const className = featured ? 'games-neon-art' : 'games-card-art'
  return <div className={`${className}${game.coverUrl ? ' has-cover' : ''}`} style={game.coverUrl ? { backgroundImage: `linear-gradient(rgba(12, 10, 28, .2), rgba(12, 10, 28, .6)), url(${game.coverUrl})`, backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundSize: 'cover' } : undefined} aria-hidden="true">{showLabel ? <span>{fallbackLabel}</span> : null}{featured ? <i>✦</i> : null}</div>
}

function GameMetric({ icon, label, value, detail }) {
  return <div className="games-metric"><span>{typeof icon === 'string' ? icon : icon}</span><p>{label}<b>{value}</b><small>{detail}</small></p></div>
}

function GameAchievementsPanel({ state, onViewAll }) {
  const achievements = Array.isArray(state?.achievements) ? state.achievements : []
  const latest = achievements.filter((achievement) => achievement.unlocked && achievement.unlockedAt).sort((left, right) => new Date(right.unlockedAt) - new Date(left.unlockedAt)).slice(0, 4)
  return <section className="games-achievements"><div className="games-shelf-heading"><h2>Achievements</h2><button type="button" onClick={onViewAll}>View All</button></div>{state?.status === 'loading' || state?.status === 'idle' ? <SectionMessage message="Loading achievements..." /> : state?.status === 'error' ? <SectionMessage tone="error" message={state.error || 'Unable to load achievements right now.'} /> : latest.length ? <div>{latest.map((achievement) => <GameBadge key={achievement.id} achievement={achievement} />)}</div> : <SectionMessage message="No game achievements earned yet." />}</section>
}

function GameBadge({ achievement }) {
  return <span className="games-badge"><i><TrophyIcon /></i><b>{achievement.name}</b><small>Unlocked {formatLongDate(achievement.unlockedAt)}</small></span>
}

function GameDetailPage({ state, similarGamesState, favoriteGameIds, onBack, onToggleFavorite, onSubmitRating, onSaveTracking, onSaveSession, onOpenLogin, onOpenGame, isSignedIn, playedActionState, ratingActionState, trackingActionState }) {
  const [ratingOpen, setRatingOpen] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5)
  const [trailerState, setTrailerState] = useState({ status: 'idle', trailer: null, error: '' })
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)

  useEffect(() => {
    setTrailerState({ status: 'idle', trailer: null, error: '' })
  }, [state.game?.id])

  if (state.status === 'loading' || state.status === 'idle') return <section className="movie-detail-page"><SectionMessage message="Loading game detail from your local database..." /></section>
  if (state.status === 'error') return <section className="movie-detail-page"><SectionMessage tone="error" message={`Could not load the game detail. ${state.error}`} /></section>
  if (!state.game) return <section className="movie-detail-page"><SectionMessage message="Game detail is not available yet." /></section>
  const game = state.game
  const communityRating = game.communityRating ?? emptyCommunityRating
  const isFavorite = favoriteGameIds.has(game.id)
  const isUpdatingPlayed = playedActionState.status === 'loading' && playedActionState.gameId === game.id
  const isSavingRating = ratingActionState.status === 'loading' && ratingActionState.gameId === game.id
  const coverStyle = game.coverUrl ? { backgroundImage: `linear-gradient(90deg, rgba(7, 10, 18, .96) 0%, rgba(7, 10, 18, .74) 38%, rgba(7, 10, 18, .42) 100%), url(${game.coverUrl})` } : undefined
  const openRating = () => { if (!isSignedIn) return onOpenLogin(); setSelectedRating(communityRating.yourScore ?? 5); setRatingOpen(true) }
  const isTrailerLoading = trailerState.status === 'loading'

  async function handleOpenTrailer() {
    setTrailerState({ status: 'loading', trailer: null, error: '' })
    try {
      const response = await fetch(`/api/games/${game.id}/trailer`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load a trailer right now.')
      setTrailerState({ status: 'success', trailer: payload.trailer, error: '' })
    } catch (error) {
      setTrailerState({ status: 'error', trailer: null, error: error instanceof Error ? error.message : 'Unable to load a trailer right now.' })
    }
  }

  return <section className="movie-detail-page game-detail-page">
    <nav className="movie-detail-breadcrumb desktop-only" aria-label="Breadcrumb"><button type="button" onClick={onBack}>Games</button><span className="movie-detail-breadcrumb-separator">/</span><span className="movie-detail-breadcrumb-current">{game.title}</span></nav>
    <button type="button" className="movie-detail-back mobile-only" onClick={onBack}><ChevronLeftIcon /></button>
    <article className="movie-detail-hero game-detail-hero" style={coverStyle}>
      <div className="movie-detail-hero-overlay" />
      <div className="movie-detail-poster-wrap"><div className="movie-detail-poster game-detail-cover">{game.coverUrl ? <img className="movie-detail-poster-image" src={game.coverUrl} alt={`${game.title} cover`} /> : <GamepadIcon />}</div></div>
      <div className="movie-detail-main"><h1>{game.title}</h1><div className="movie-detail-meta"><span>{game.releaseDate ? formatGameReleaseDate(game.releaseDate) : 'Release date TBA'}</span><span>{game.genres.length ? game.genres.join(', ') : 'Genre TBA'}</span></div>
        <div className="movie-score-comparison"><div className="movie-score-source tmdb"><StarIcon /><div><span>IGDB</span><strong>{game.rating === null ? 'N/A' : game.rating.toFixed(1)}</strong></div><small>{game.ratingCount.toLocaleString()} ratings</small></div><div className="movie-score-source audience"><TrophyIcon /><div><span>Aggregate</span><strong>{game.aggregatedRating === null ? 'N/A' : game.aggregatedRating.toFixed(1)}</strong></div><small>{game.aggregatedRatingCount.toLocaleString()} ratings</small></div><div className="movie-score-source watchvault"><UserRatingIcon /><div><span>WatchVault</span><strong>{formatCommunityRating(communityRating.average)}</strong></div><small>{communityRating.voteCount} {communityRating.voteCount === 1 ? 'rating' : 'ratings'}</small></div></div>
        <p className="movie-detail-summary">{game.summary}</p>
        <div className="movie-detail-actions"><button type="button" className="primary-button movie-detail-primary" disabled={isUpdatingPlayed} onClick={() => isSignedIn ? setTrackingOpen(true) : onOpenLogin()}><CheckIcon /><span>{game.tracking?.status === 'completed' ? 'Update completion' : 'Log game progress'}</span></button><button type="button" className="secondary-button movie-detail-secondary ghost" onClick={() => isSignedIn ? setSessionOpen(true) : onOpenLogin()}>Log session</button><button type="button" className={`secondary-button movie-detail-secondary ghost${isFavorite ? ' is-active' : ''}`} onClick={() => onToggleFavorite(game)}><HeartIcon /><span>{isFavorite ? 'Remove Favorite' : 'Add to Favorites'}</span></button><button type="button" className="secondary-button movie-detail-secondary ghost" onClick={openRating}><StarOutlineIcon /><span>{communityRating.yourScore === null ? 'Rate' : 'Update Rating'}</span></button><button type="button" className="secondary-button movie-detail-secondary ghost" onClick={handleOpenTrailer} disabled={isTrailerLoading}><PlayIcon /><span>{isTrailerLoading ? 'Loading...' : 'Trailer'}</span></button>{game.igdbUrl ? <a className="secondary-button movie-detail-secondary ghost" href={game.igdbUrl} target="_blank" rel="noreferrer">IGDB</a> : null}</div>
        {trailerState.status === 'error' ? <p className="movie-trailer-error" role="alert">{trailerState.error}</p> : null}
      </div>
      <aside className="movie-detail-status desktop-only"><h2>Your Status</h2><div className="movie-detail-status-list"><div className="movie-detail-status-item"><span className="movie-detail-status-icon"><HeartIcon /></span><div><span>Favorite</span><strong>{isFavorite ? 'Saved' : 'Not yet'}</strong></div></div><div className="movie-detail-status-item movie-detail-status-item-watched"><span className="movie-detail-status-icon"><CheckIcon /></span><div><span>Played</span><strong>{game.played ? 'Played' : 'Not yet'}</strong></div></div><div className="movie-detail-status-item movie-detail-status-item-rating"><span className="movie-detail-status-icon"><StarOutlineIcon /></span><div><span>Your rating</span><strong>{formatCommunityRating(communityRating.yourScore)}</strong></div></div><div className="movie-detail-status-item"><span className="movie-detail-status-icon"><GamepadIcon /></span><div><span>Platforms</span><strong>{game.platforms.length ? game.platforms.join(', ') : 'TBA'}</strong></div></div></div></aside>
    </article>
    <div className="movie-detail-grid game-detail-grid"><section className="content-section movie-detail-panel game-detail-facts"><div className="game-detail-fact"><CalendarIcon /><span>Release date</span><strong>{game.releaseDate ? formatLongDate(game.releaseDate) : 'TBA'}</strong></div><div className="game-detail-fact"><GamepadIcon /><span>Platforms</span><strong>{game.platforms.length ? game.platforms.join(', ') : 'TBA'}</strong></div><div className="game-detail-fact"><StarIcon /><span>Steam activity</span><strong>{game.steamPeakPlayers === null ? 'Unavailable' : formatGamePlayerCount(game.steamPeakPlayers)}</strong></div></section><section className="content-section movie-detail-panel game-detail-genres"><div className="section-header"><h2>Genres</h2></div><div className="movie-detail-tags">{game.genres.length ? game.genres.map((genre) => <span key={genre} className="movie-detail-tag">{genre}</span>) : <span className="movie-detail-tag">Genre TBA</span>}</div></section><GameTimeToBeatPanel timeToBeat={game.timeToBeat} /><section className="content-section movie-detail-panel game-detail-similar"><div className="section-header"><div><h2>Similar Games</h2><span>{similarGamesState.source === 'local' ? 'Based on shared genres' : 'Curated by IGDB'}</span></div></div>{similarGamesState.status === 'loading' ? <SectionMessage message="Finding similar games..." /> : null}{similarGamesState.status === 'error' ? <SectionMessage tone="error" message={similarGamesState.error} /> : null}{similarGamesState.status === 'success' && similarGamesState.games.length ? <GameCardsGrid className="games-card-grid game-detail-similar-carousel" games={similarGamesState.games} label="Similar" favoriteGameIds={favoriteGameIds} onToggleFavorite={onToggleFavorite} onOpenGame={onOpenGame} /> : null}{similarGamesState.status === 'success' && !similarGamesState.games.length ? <SectionMessage message="No similar games are available yet." /> : null}</section></div>
    {trackingOpen ? <GameTrackingDialog game={game} initial={game.tracking} saving={trackingActionState.status === 'loading' && trackingActionState.gameId === game.id} error={trackingActionState.status === 'error' && trackingActionState.gameId === game.id ? trackingActionState.error : ''} onCancel={() => setTrackingOpen(false)} onSave={async (tracking) => { if (await onSaveTracking(game, tracking)) setTrackingOpen(false) }} /> : null}
    {sessionOpen ? <GameSessionDialog game={game} saving={trackingActionState.status === 'loading' && trackingActionState.gameId === game.id} error={trackingActionState.status === 'error' && trackingActionState.gameId === game.id ? trackingActionState.error : ''} onCancel={() => setSessionOpen(false)} onSave={async (session) => { if (await onSaveSession(game, session)) setSessionOpen(false) }} /> : null}
    {ratingOpen ? <MovieRatingDialog movie={game} selectedRating={selectedRating} onSelectRating={setSelectedRating} onCancel={() => setRatingOpen(false)} onSubmit={async () => { if (await onSubmitRating(game, selectedRating)) setRatingOpen(false) }} isSaving={isSavingRating} error={ratingActionState.status === 'error' && ratingActionState.gameId === game.id ? ratingActionState.error : ''} kicker="Your Game Rating" /> : null}
    {trailerState.status === 'success' && trailerState.trailer ? <MovieTrailerDialog movie={game} trailer={trailerState.trailer} onClose={() => setTrailerState({ status: 'idle', trailer: null, error: '' })} /> : null}
  </section>
}

function GameTimeToBeatPanel({ timeToBeat }) {
  const estimates = [
    ['Main Story', timeToBeat?.mainStory],
    ['Main + Extras', timeToBeat?.mainAndExtras],
    ['Completionist', timeToBeat?.completionist],
  ].filter(([, seconds]) => seconds !== null && seconds !== undefined)

  return <section className="content-section movie-detail-panel game-detail-time-to-beat"><div className="section-header"><h2><ClockIcon />Time to Beat</h2></div>{estimates.length ? <div className="game-time-to-beat-estimates">{estimates.map(([label, seconds]) => <div key={label}><span>{label}</span><strong>{formatGameTimeToBeat(seconds)}</strong></div>)}</div> : <p className="game-time-to-beat-empty">No time-to-beat estimate is available.</p>}</section>
}

const gameManualTags = ['coop', 'no_assists', 'no_damage_boss', 'one_life', 'all_platform_trophies', 'platinum', 'all_collectibles', 'all_side_quests', 'all_optional_objectives', 'secret_ending', 'random_pick', 'recommendation', 'full_saga', 'credits', 'no_guide', 'bad_ending', 'good_ending', 'customization']
function GameTrackingDialog({ game, initial, saving, error, onCancel, onSave }) {
  const [status, setStatus] = useState(initial?.status || 'playing'); const [platform, setPlatform] = useState(initial?.platform || game.platforms?.[0] || ''); const [difficulty, setDifficulty] = useState(initial?.difficulty || 'normal'); const [playtime, setPlaytime] = useState(String(initial?.playtimeMinutes || '')); const [percent, setPercent] = useState(String(initial?.completionPercent || '')); const [review, setReview] = useState(initial?.review || ''); const [tags, setTags] = useState(initial?.metadata?.tags || {})
  const toggle = (key) => setTags((current) => ({ ...current, [key]: !current[key] }))
  return <div className="movie-rating-dialog-backdrop"><section className="movie-rating-dialog game-tracking-dialog" role="dialog" aria-modal="true"><p className="movie-rating-dialog-kicker">Game tracker</p><h2>{game.title}</h2><div className="game-tracking-fields"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{['played','backlog','playing','dropped','completed'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Platform<input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="PC, PS5, Switch..." /></label><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>{['easy','normal','hard','highest'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Playtime (minutes)<input type="number" min="0" value={playtime} onChange={(event) => setPlaytime(event.target.value)} /></label><label>Completion %<input type="number" min="0" max="100" value={percent} onChange={(event) => setPercent(event.target.value)} /></label></div><label className="game-tracking-review">Review (optional)<textarea value={review} onChange={(event) => setReview(event.target.value)} placeholder="This counts toward review achievements." /></label><details><summary>Advanced, user-recorded achievement facts</summary><div className="watch-together-session-badges">{gameManualTags.map((tag) => <label key={tag}><input type="checkbox" checked={Boolean(tags[tag])} onChange={() => toggle(tag)} />{tag.replaceAll('_', ' ')}</label>)}</div></details>{error ? <p className="tmdb-search-error">{error}</p> : null}<div className="movie-rating-dialog-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button><button type="button" className="primary-button" onClick={() => onSave({ status, platform, difficulty, playtimeMinutes: playtime === '' ? null : Number(playtime), completionPercent: percent === '' ? null : Number(percent), review, metadata: { tags } })} disabled={saving}>{saving ? 'Saving…' : 'Save tracking'}</button></div></section></div>
}

function GameSessionDialog({ game, saving, error, onCancel, onSave }) {
  const [durationMinutes, setDurationMinutes] = useState('60'); const [mode, setMode] = useState('solo'); const [location, setLocation] = useState(''); const [coplayer, setCoplayer] = useState(''); const [tags, setTags] = useState({})
  return <div className="movie-rating-dialog-backdrop"><section className="movie-rating-dialog game-tracking-dialog" role="dialog" aria-modal="true"><p className="movie-rating-dialog-kicker">Log session</p><h2>{game.title}</h2><div className="game-tracking-fields"><label>Minutes<input type="number" min="1" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} /></label><label>Mode<select value={mode} onChange={(event) => setMode(event.target.value)}>{['solo','coop','versus'].map((item) => <option key={item}>{item}</option>)}</select></label><label>Location<select value={location} onChange={(event) => setLocation(event.target.value)}><option value="">Not specified</option><option value="local">Local</option><option value="online">Online</option></select></label><label>Co-player<input value={coplayer} onChange={(event) => setCoplayer(event.target.value)} placeholder="Optional name" /></label></div><details><summary>Advanced session facts</summary><div className="watch-together-session-badges">{gameManualTags.slice(0, 10).map((tag) => <label key={tag}><input type="checkbox" checked={Boolean(tags[tag])} onChange={() => setTags((current) => ({ ...current, [tag]: !current[tag] }))} />{tag.replaceAll('_', ' ')}</label>)}</div></details>{error ? <p className="tmdb-search-error">{error}</p> : null}<div className="movie-rating-dialog-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button><button type="button" className="primary-button" onClick={() => onSave({ durationMinutes: Number(durationMinutes), mode, location: location || null, coplayer, metadata: { tags } })} disabled={saving}>{saving ? 'Saving…' : 'Save session'}</button></div></section></div>
}

function BooksGrid({ booksState, onOpenBook }) {
  if (booksState.status === 'loading' || booksState.status === 'idle') return <SectionMessage message="Loading books from your local database..." />
  if (booksState.status === 'error') return <SectionMessage message={`Could not load books. ${booksState.error}`} tone="error" />
  if (booksState.books.length === 0) return <SectionMessage message="No books are available in the local database yet." />
  return <div className="movie-card-grid popular-movies-catalog" aria-label="Books catalog">{booksState.books.map((book) => <BookCard key={book.id} book={book} onOpenBook={onOpenBook} />)}</div>
}

function AuthorDetailPage({ authorDetailState, onBack, onOpenBook, onOpenLogin, isSignedIn, favoriteAuthorIds, onToggleFavorite }) {
  if (authorDetailState.status === 'loading' || authorDetailState.status === 'idle') return <section className="person-detail-page"><SectionMessage message="Loading author detail from your local catalog..." /></section>
  if (authorDetailState.status === 'error') return <section className="person-detail-page"><SectionMessage message={`Could not load the author detail. ${authorDetailState.error}`} tone="error" /></section>
  const author = authorDetailState.author
  if (!author) return <section className="person-detail-page"><SectionMessage message="Author detail is not available yet." /></section>
  const isFavorite = favoriteAuthorIds.has(Number(author.id))
  return (
    <section className="person-detail-page author-detail-page">
      <button type="button" className="movie-detail-back" onClick={onBack} aria-label="Back to Books"><ChevronLeftIcon /></button>
      <article className="person-detail-hero author-detail-hero">
        <div className="person-detail-portrait-wrap"><div className="person-detail-portrait author-detail-portrait"><span>{getMovieCreditInitials(author.name)}</span></div></div>
        <div className="person-detail-main">
          <div className="person-detail-title-row"><h1>{author.name}</h1></div>
          <div className="person-detail-role-list"><span>Author</span></div>
          <div className="person-detail-stat-row"><MetricBadge icon={BookmarkIcon} value={String(authorDetailState.books.length)} label="Catalog Books" tone="violet" /></div>
          <p className="person-detail-summary">Browse books by {author.name} available in your local catalog.</p>
          <div className="movie-detail-actions">
            <button type="button" className="secondary-button movie-detail-secondary" onClick={() => isSignedIn ? onToggleFavorite(author) : onOpenLogin()}>
              <StarOutlineIcon /><span>{isFavorite ? 'Favorited' : isSignedIn ? 'Favorite' : 'Sign in to Favorite'}</span>
            </button>
          </div>
        </div>
      </article>
      <section className="content-section movie-detail-panel">
        <div className="section-header"><h2>Books by {author.name}</h2></div>
        {authorDetailState.books.length > 0 ? <div className="movie-card-grid popular-movies-catalog">{authorDetailState.books.map((book) => <BookCard key={book.id} book={book} onOpenBook={onOpenBook} />)}</div> : <SectionMessage message="No books by this author are in the local catalog yet." />}
      </section>
    </section>
  )
}

function BookCard({ book, disabled = false, matchQuery, onOpenBook }) {
  const [coverUnavailable, setCoverUnavailable] = useState(false)
  return (
    <button type="button" className="movie-card movie-card-button" onClick={() => onOpenBook(book)} aria-label={`Open ${book.title}`} disabled={disabled}>
      <div className={`movie-card-poster ${book.coverUrl && !coverUnavailable ? 'has-image' : 'theme-catalog'}`}>
        {book.coverUrl && !coverUnavailable ? <img src={book.coverUrl} alt={`${book.title} cover`} className="movie-card-poster-image" loading="lazy" onError={() => setCoverUnavailable(true)} /> : null}
      </div>
      <div className="movie-card-copy"><h3><HighlightedText text={book.title} query={matchQuery} /></h3><SearchMatchLabel text={book.title} query={matchQuery} /><p><HighlightedText text={book.authorsLabel} query={matchQuery} /></p><div className="rating-row"><span>{book.year}</span><span><HighlightedText text={book.categoriesLabel} query={matchQuery} /></span></div></div>
    </button>
  )
}

function BookDetailPage({ bookDetailState, relatedBooksState, onBack, onToggleWatchlist, onToggleRead, onMarkUnread, onSubmitRating, onOpenLogin, isSignedIn, isInWatchlist, isRead, readBook, watchlistActionState, readActionState, ratingActionState, onOpenRelatedBook, onOpenAuthor }) {
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5)
  if (bookDetailState.status === 'loading' || bookDetailState.status === 'idle') return <section className="movie-detail-page"><SectionMessage message="Loading book detail from your local database..." /></section>
  if (bookDetailState.status === 'error') return <section className="movie-detail-page"><SectionMessage message={`Could not load the book detail. ${bookDetailState.error}`} tone="error" /></section>
  const book = bookDetailState.book
  if (!book) return <section className="movie-detail-page"><SectionMessage message="Book detail is not available yet." /></section>
  const isUpdatingWatchlist = watchlistActionState.status === 'loading' && watchlistActionState.bookId === book.id
  const isUpdatingRead = readActionState.status === 'loading' && readActionState.bookId === book.id
  const communityRating = book.communityRating ?? emptyCommunityRating
  const isRatingSaving = ratingActionState.status === 'loading' && ratingActionState.bookId === book.id
  const selectedReadingDetails = getSelectedReadingDetails(readBook?.completionMetadata)
  return (
    <section className="movie-detail-page">
      <button type="button" className="movie-detail-back" onClick={onBack} aria-label="Back to Books"><ChevronLeftIcon /></button>
      <article className="movie-detail-hero">
        <div className="movie-detail-poster-wrap"><div className={`movie-card-poster ${book.coverUrl ? 'has-image' : 'theme-catalog'}`}>{book.coverUrl ? <img src={book.coverUrl} alt={`${book.title} cover`} className="movie-card-poster-image" /> : null}</div></div>
        <div className="movie-detail-main">
          <h1>{book.title}</h1>
          <div className="movie-detail-meta">
            {book.authorProfiles?.length > 0 ? book.authorProfiles.map((author) => <button key={author.id} type="button" className="book-author-link" onClick={() => onOpenAuthor(author)}>{author.name}</button>) : <span>{book.authorsLabel}</span>}
            <span>{book.publishedDate || 'Publication date TBA'}</span><span>{book.languageLabel}</span>
          </div>
          <div className="movie-detail-score-row"><MetricBadge icon={UserRatingIcon} value={formatCommunityRating(communityRating.average)} label={`${communityRating.voteCount} ${communityRating.voteCount === 1 ? 'vote' : 'votes'}`} tone="violet" /></div>
          <div className="movie-detail-actions">
            <button
              type="button"
              className={`primary-button movie-detail-primary${isInWatchlist ? ' is-active' : ''}`}
              onClick={() => isSignedIn ? onToggleWatchlist(book) : onOpenLogin()}
              disabled={isUpdatingWatchlist || isRead}
            >
              <PlusIcon />
              <span>{isUpdatingWatchlist ? 'Updating...' : isRead ? 'Read' : isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
            </button>
            <button type="button" className={`secondary-button movie-detail-secondary${isRead ? ' is-active' : ''}`} onClick={() => isSignedIn ? onToggleRead(book) : onOpenLogin()} disabled={isUpdatingRead}>
              <CheckIcon />
              <span>{isUpdatingRead ? 'Updating...' : isRead ? 'Log reread' : 'Mark as Read'}</span>
            </button>
            {isRead ? <button type="button" className="secondary-button movie-detail-secondary ghost" onClick={() => onMarkUnread(book)} disabled={isUpdatingRead}><span>Mark unread</span></button> : null}
            <button type="button" className="secondary-button movie-detail-secondary ghost" onClick={() => { if (!isSignedIn) return onOpenLogin(); setSelectedRating(communityRating.yourScore ?? 5); setIsRatingDialogOpen(true) }}>
              <StarOutlineIcon />
              <span>{communityRating.yourScore === null ? 'Rate' : 'Update Rating'}</span>
            </button>
          </div>
          {isRead ? <><p className="movie-detail-summary">Read on {formatLongDate(readBook?.readAt)}</p>{selectedReadingDetails.length > 0 ? <div className="book-detail-tropes"><span>Your selections</span><div>{selectedReadingDetails.map((detail) => <span key={detail} className="book-detail-trope">{detail}</span>)}</div></div> : null}</> : null}
          {watchlistActionState.status === 'error' && watchlistActionState.bookId === book.id ? <p className="tmdb-search-error" role="alert">{watchlistActionState.error}</p> : null}
          {readActionState.status === 'error' && readActionState.bookId === book.id ? <p className="tmdb-search-error" role="alert">{readActionState.error}</p> : null}
          {ratingActionState.status === 'error' && ratingActionState.bookId === book.id ? <p className="tmdb-search-error" role="alert">{ratingActionState.error}</p> : null}
          <div className="movie-detail-facts">
            <div><span>Categories</span><strong>{book.categoriesLabel}</strong></div>
            <div><span>Publisher</span><strong>{book.publisher || 'TBA'}</strong></div>
            <div><span>Pages</span><strong>{book.pageCount ? String(book.pageCount) : 'TBA'}</strong></div>
            <div><span>ISBN-10</span><strong>{book.isbn10 || 'TBA'}</strong></div>
            <div><span>ISBN-13</span><strong>{book.isbn13 || 'TBA'}</strong></div>
            <div><span>Your Rating</span><strong>{formatCommunityRating(communityRating.yourScore)}</strong></div>
          </div>
        </div>
        <p className="book-detail-description">{book.description || 'Description not available yet.'}</p>
      </article>
      <section className="content-section movie-detail-panel book-detail-related">
        <div className="section-header"><h2>Related books</h2></div>
        <RelatedBooksSlider relatedBooksState={relatedBooksState} onOpenBook={onOpenRelatedBook} />
      </section>
      {isRatingDialogOpen ? <MovieRatingDialog movie={book} selectedRating={selectedRating} onSelectRating={setSelectedRating} onCancel={() => setIsRatingDialogOpen(false)} onSubmit={async () => { if (await onSubmitRating(book, selectedRating)) setIsRatingDialogOpen(false) }} isSaving={isRatingSaving} error={ratingActionState.status === 'error' && ratingActionState.bookId === book.id ? ratingActionState.error : ''} /> : null}
    </section>
  )
}

function RelatedBooksSlider({ relatedBooksState, onOpenBook }) {
  if (relatedBooksState.status === 'loading' || relatedBooksState.status === 'idle') return <SectionMessage message="Loading related books from Google Books..." />
  if (relatedBooksState.status === 'error') return <SectionMessage message={`Could not load related books. ${relatedBooksState.error}`} tone="error" />
  if (relatedBooksState.books.length === 0) return <SectionMessage message="No related books are available for this category." />

  return (
    <div className="movie-detail-similar" aria-label="Related books">
      {relatedBooksState.books.map((book) => {
        const isPersisting = relatedBooksState.persistingBookId === book.id
        return (
          <button key={book.id} type="button" className="movie-detail-similar-card book-detail-related-card" onClick={() => onOpenBook(book)} disabled={Boolean(relatedBooksState.persistingBookId)}>
            <div className={`movie-detail-similar-poster ${book.coverUrl ? 'has-image' : 'theme-catalog'}`}>{book.coverUrl ? <img src={book.coverUrl} alt={`${book.title} cover`} /> : null}</div>
            <div className="movie-detail-similar-copy"><span>{book.authorsLabel}</span><strong>{isPersisting ? 'Opening...' : book.title}</strong><span>{book.year}</span></div>
          </button>
        )
      })}
    </div>
  )
}

function ContinueWatchingPage({ isSignedIn, pageState, onOpenLogin, onOpenTvShow, onPageChange }) {
  if (!isSignedIn) {
    return (
      <section className="continue-watching-page">
        <div className="movies-heading">
          <h1>Continue Watching</h1>
          <p>Pick up where you left off in your TV shows.</p>
        </div>
        <section className="content-section">
          <SectionMessage message="Sign in to view shows you are watching." />
          <button type="button" className="primary-button" onClick={onOpenLogin}>Sign In</button>
        </section>
      </section>
    )
  }

  return (
    <section className="continue-watching-page">
      <div className="movies-heading">
        <h1>Continue Watching</h1>
        <p>Pick up where you left off in your TV shows.</p>
      </div>
      <section className="content-section">
        {pageState.status === 'loading' || pageState.status === 'idle' ? <SectionMessage message="Loading your TV progress..." /> : null}
        {pageState.status === 'error' ? <SectionMessage message={pageState.error} tone="error" /> : null}
        {pageState.status === 'success' && pageState.shows.length === 0 ? <SectionMessage message="Start watching a TV show to see it here." /> : null}
        {pageState.status === 'success' && pageState.shows.length > 0 ? (
          <div className="continue-watching-grid">
            {pageState.shows.map((item) => <ProgressCard key={item.id} item={item} onOpenTvShow={onOpenTvShow} />)}
          </div>
        ) : null}
        <PaginationControls pagination={pageState.pagination} onPageChange={onPageChange} />
      </section>
    </section>
  )
}

function TvShowsScreen({
  activeTab,
  popularTvState,
  recentTvState,
  upcomingTvState,
  topRatedTvState,
  onSelectShow,
  onTabChange,
  onToggleWatchlist,
  onOpenPopularTvShows,
  onOpenRecentlyAiredTvShows,
  onOpenUpcomingTvShows,
  onOpenTopRatedTvShows,
  onChangePopularPage,
  onChangeRecentPage,
  onChangeUpcomingPage,
  onChangeTopRatedPage,
  onOpenWatchlist,
  selectedShowId,
  watchedIds,
  watchlistIds,
  stats,
  statsPeriod,
  onStatsPeriodChange,
}) {
  const tvCatalog = collectTvCatalog([popularTvState, recentTvState, upcomingTvState, topRatedTvState])
  const favoriteShows = tvCatalog.filter((show) => watchlistIds.has(Number(show.id)))
  const selectedShow =
    tvCatalog.find((show) => Number(show.id) === Number(selectedShowId))
    ?? null
  const featuredShow = selectedShow ?? popularTvState.featuredShow ?? tvCatalog[0] ?? null
  const watchlistShows = favoriteShows.slice(0, 4)
  const tvStats = buildTvStats(stats)
  const isPopularListMode = activeTab === 'Popular'
  const isAiringNowListMode = activeTab === 'Airing Now'
  const isUpcomingListMode = activeTab === 'Upcoming'
  const isTopRatedListMode = activeTab === 'Top Rated'

  return (
    <section className="tv-shows-page">
      <div className="movies-heading tv-shows-heading">
        <h1>TV Shows</h1>
        <p>
          {isPopularListMode
            ? 'Browse popular TV shows imported from your local database, 30 titles at a time.'
            : isAiringNowListMode
              ? 'Browse recently aired TV shows from your local database, 30 titles at a time.'
              : isUpcomingListMode
                ? 'Browse upcoming TV premieres from the next 30 days, 30 titles at a time.'
                : isTopRatedListMode
                  ? 'Browse top rated TV shows ordered by score, 30 titles at a time.'
                    : 'Discover, track, and organize your favorite series.'}
        </p>
      </div>

      <section className="tab-row movies-tab-row" aria-label="TV show filters">
        {tvShowTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`filter-pill${tab === activeTab ? ' active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </section>

      {isPopularListMode ? (
        <ContentSection title="Popular Right Now">
          <TvShowsGrid
            tvState={popularTvState}
            layout="catalog"
            onSelectShow={onSelectShow}
            watchedIds={watchedIds}
            watchlistIds={watchlistIds}
            activeShowId={selectedShowId}
          />
          <PaginationControls pagination={popularTvState.pagination} onPageChange={onChangePopularPage} />
        </ContentSection>
      ) : isAiringNowListMode ? (
        <ContentSection title="Airing Now">
          <TvShowsGrid
            tvState={recentTvState}
            layout="catalog"
            onSelectShow={onSelectShow}
            watchedIds={watchedIds}
            watchlistIds={watchlistIds}
            activeShowId={selectedShowId}
          />
          <PaginationControls pagination={recentTvState.pagination} onPageChange={onChangeRecentPage} />
        </ContentSection>
      ) : isUpcomingListMode ? (
        <ContentSection title="Upcoming Soon">
          <TvShowsGrid
            tvState={upcomingTvState}
            layout="catalog"
            onSelectShow={onSelectShow}
            watchedIds={watchedIds}
            watchlistIds={watchlistIds}
            activeShowId={selectedShowId}
          />
          <PaginationControls pagination={upcomingTvState.pagination} onPageChange={onChangeUpcomingPage} />
        </ContentSection>
      ) : isTopRatedListMode ? (
        <ContentSection title="Top Rated">
          <TvShowsGrid
            tvState={topRatedTvState}
            layout="catalog"
            onSelectShow={onSelectShow}
            watchedIds={watchedIds}
            watchlistIds={watchlistIds}
            activeShowId={selectedShowId}
          />
          <PaginationControls pagination={topRatedTvState.pagination} onPageChange={onChangeTopRatedPage} />
        </ContentSection>
      ) : (
        <>
          <div className="tv-dashboard-hero-layout">
            <TvFeaturedCard
              show={featuredShow}
              isWatched={watchedIds.has(Number(featuredShow?.id))}
              isInWatchlist={watchlistIds.has(Number(featuredShow?.id))}
              onToggleWatchlist={onToggleWatchlist}
              onOpenShow={onSelectShow}
            />
            <TvWatchlistPanel items={watchlistShows} onOpenWatchlist={onOpenWatchlist} onSelectShow={onSelectShow} />
          </div>

          <TvDashboardStats items={tvStats} period={statsPeriod} onPeriodChange={onStatsPeriodChange} />

          <div className="tv-dashboard-rails">
            <ContentSection title="Popular Right Now" action="View all" onAction={onOpenPopularTvShows}>
              <TvShowsGrid
                tvState={popularTvState}
                onSelectShow={onSelectShow}
                watchedIds={watchedIds}
                watchlistIds={watchlistIds}
                activeShowId={selectedShowId}
              />
            </ContentSection>
            <ContentSection title="Recently Aired" action="View all" onAction={onOpenRecentlyAiredTvShows}>
              <TvShowsGrid
                tvState={recentTvState}
                onSelectShow={onSelectShow}
                watchedIds={watchedIds}
                watchlistIds={watchlistIds}
                activeShowId={selectedShowId}
              />
            </ContentSection>
            <ContentSection title="Upcoming Soon" action="View all" onAction={onOpenUpcomingTvShows}>
              <TvShowsGrid
                tvState={upcomingTvState}
                onSelectShow={onSelectShow}
                watchedIds={watchedIds}
                watchlistIds={watchlistIds}
                activeShowId={selectedShowId}
              />
            </ContentSection>
            <ContentSection title="Top Rated" action="View all" onAction={onOpenTopRatedTvShows}>
              <TvShowsGrid
                tvState={topRatedTvState}
                onSelectShow={onSelectShow}
                watchedIds={watchedIds}
                watchlistIds={watchlistIds}
                activeShowId={selectedShowId}
              />
            </ContentSection>
          </div>
        </>
      )}
    </section>
  )
}

function WatchTogetherScreen({ isSignedIn, state, search, action, activeTab, onOpenLogin, onChoosePartner, onReset, onSearchChange, onSearch, onItemAction, onTabChange, onMarkWatched, onMarkEpisodeWatched, watchedActionState, onSubmitMovieRating, movieRatingActionState, onSubmitEpisodeRating, tvEpisodeRatingActionState, onOpenTvShow, onOpenMovie, onRefresh, achievementsState, statsState, onSaveSession }) {
  const [resetOpen, setResetOpen] = useState(false)
  const [historyTab, setHistoryTab] = useState('movies')
  const [movieHistoryPage, setMovieHistoryPage] = useState(1)
  const [showHistoryPage, setShowHistoryPage] = useState(1)
  const movieHistoryPageCount = Math.max(1, Math.ceil(state.watchedMovies.length / watchTogetherHistoryPageSize))
  const showHistoryPageCount = Math.max(1, Math.ceil(state.watchedEpisodes.length / watchTogetherHistoryPageSize))

  useEffect(() => {
    setMovieHistoryPage((page) => Math.min(page, movieHistoryPageCount))
  }, [movieHistoryPageCount])

  useEffect(() => {
    setShowHistoryPage((page) => Math.min(page, showHistoryPageCount))
  }, [showHistoryPageCount])

  if (!isSignedIn) return <section className="watch-together-screen"><div className="watch-together-hero"><div><h1>Watch Together</h1><p>Sign in to choose a partner and build a shared shortlist.</p></div></div><SectionMessage message="Sign in to start watching together." /><button type="button" className="primary-button" onClick={onOpenLogin}>Sign In</button></section>

  const selected = state.items.find((item) => item.selected)
  const pendingPick = state.items.find((item) => item.pickVoteStatus)
  const movieItems = state.items.filter((item) => item.mediaType === 'movie')
  const tvItems = state.items.filter((item) => item.mediaType === 'tv')
  const tabItems = activeTab === 'movies' ? movieItems : tvItems
  const searchItems = search.items.filter((item) => activeTab === 'movies' ? item.mediaType === 'movie' : item.mediaType === 'tv')
  const saved = new Set(tabItems.map((item) => `${item.mediaType}-${item.id}`))
  const pending = state.pendingRequest
  const isBusy = state.status === 'loading' || action.status === 'loading'
  const historyItems = historyTab === 'movies' ? state.watchedMovies : state.watchedEpisodes
  const historyPage = historyTab === 'movies' ? movieHistoryPage : showHistoryPage
  const historyPageCount = historyTab === 'movies' ? movieHistoryPageCount : showHistoryPageCount
  const visibleHistoryItems = historyItems.slice((historyPage - 1) * watchTogetherHistoryPageSize, historyPage * watchTogetherHistoryPageSize)
  const historyPagination = {
    page: historyPage,
    pageSize: watchTogetherHistoryPageSize,
    hasPreviousPage: historyPage > 1,
    hasNextPage: historyPage < historyPageCount,
  }
  return <section className="watch-together-screen">
    <div className="watch-together-hero">
      <div><span className="watch-together-eyebrow">ONE-ON-ONE</span><h1>Watch Together</h1><p>{state.partner ? `Build your next watch night with ${state.partner.fullName}.` : pending?.direction === 'outgoing' ? `Waiting for ${pending.user.fullName} to respond to your request.` : pending ? `${pending.user.fullName} invited you to Watch Together. Respond in Alerts.` : 'Choose someone to start a shared movie and TV shortlist.'}</p></div>
      {state.partner ? <button type="button" className="secondary-button watch-together-reset" disabled={isBusy} onClick={() => setResetOpen(true)}>Reset</button> : <label className="watch-together-partner"><span>Your partner</span><select value="" disabled={isBusy || Boolean(pending)} onChange={(event) => event.target.value && onChoosePartner(event.target.value)}><option value="">{pending ? 'Request pending…' : 'Choose a user…'}</option>{state.users.map((candidate) => <option key={candidate.username} value={candidate.username}>{candidate.fullName} (@{candidate.username})</option>)}</select></label>}
    </div>
    {state.status === 'loading' ? <SectionMessage message="Loading your shared watchlist..." /> : null}
    {state.status === 'error' ? <SectionMessage tone="error" message={state.error} /> : null}
    {action.status === 'error' ? <SectionMessage tone="error" message={action.error} /> : null}
    {!state.partner && state.status === 'success' ? <section className="watch-together-empty"><UserIcon /><h2>{pending?.direction === 'outgoing' ? 'Request sent' : pending ? 'Request awaiting your choice' : 'Pick your watch partner'}</h2><p>{pending?.direction === 'outgoing' ? `${pending.user.fullName} will receive an alert with options to accept or deny.` : pending ? `Open Alerts to accept or deny ${pending.user.fullName}'s request.` : 'Select another WatchVault user above to send them a Watch Together request.'}</p></section> : null}
    {state.partner ? <>
      <section className="watch-together-picked">
        <div><span>Tonight’s pick</span>{selected ? <><strong>{selected.title}</strong><p>{selected.mediaType === 'tv' ? `${formatWatchTogetherEpisode(selected)} · TV Episode` : `Movie · ${selected.year}`}</p></> : pendingPick ? <><strong>{pendingPick.title}</strong><p>{pendingPick.pickVoteStatus === 'proposed_by_current_user' ? 'Waiting for your partner to vote.' : 'Your partner proposed this title.'}</p></> : <p>No title selected yet.</p>}</div>
        <div className="watch-together-picked-actions">{selected?.mediaType === 'movie' ? <WatchTogetherMarkWatched movie={selected} onMarkWatched={onMarkWatched} watchedActionState={watchedActionState} onSubmitMovieRating={onSubmitMovieRating} movieRatingActionState={movieRatingActionState} onRefresh={onRefresh} /> : null}{selected?.mediaType === 'tv' ? <WatchTogetherMarkEpisode episode={selected} onMarkWatched={onMarkEpisodeWatched} action={action} onSubmitRating={onSubmitEpisodeRating} ratingActionState={tvEpisodeRatingActionState} onRefresh={onRefresh} /> : null}{pendingPick?.pickVoteStatus === 'awaiting_current_user' ? <><button type="button" className="secondary-button" disabled={action.status === 'loading'} onClick={() => onItemAction('deny', pendingPick)}>Deny</button><button type="button" className="primary-button" disabled={action.status === 'loading'} onClick={() => onItemAction('accept', pendingPick)}>Accept</button></> : null}{(selected || pendingPick?.pickVoteStatus === 'proposed_by_current_user') ? <button type="button" className="secondary-button" disabled={action.status === 'loading'} onClick={() => onItemAction('clear')}>{selected ? 'Clear pick' : 'Cancel proposal'}</button> : null}</div>
      </section>
      <div className="watch-together-tabs" role="tablist" aria-label="Watch Together content"><button type="button" className={activeTab === 'movies' ? 'active' : ''} onClick={() => { onTabChange('movies'); onSearchChange({ type: 'movie' }) }}>Movies <span>{movieItems.length}</span></button><button type="button" className={activeTab === 'tv' ? 'active' : ''} onClick={() => { onTabChange('tv'); onSearchChange({ type: 'tv' }) }}>TV Episodes <span>{tvItems.length}</span></button><button type="button" className={activeTab === 'history' ? 'active' : ''} onClick={() => onTabChange('history')}>History <span>{state.watchedMovies.length + state.watchedEpisodes.length}</span></button><button type="button" className={activeTab === 'stats' ? 'active' : ''} onClick={() => onTabChange('stats')}>Stats</button><button type="button" className={activeTab === 'achievements' ? 'active' : ''} onClick={() => onTabChange('achievements')}>Achievements <span>{achievementsState?.achievements?.filter((item) => item.unlocked).length || 0}</span></button></div>
      {activeTab === 'stats' ? <WatchTogetherStatsTab state={statsState} onOpenMovie={onOpenMovie} onOpenTvShow={onOpenTvShow} /> : activeTab === 'achievements' ? <WatchTogetherAchievementsTab state={achievementsState} /> : activeTab === 'history' ? <section className="watch-together-history"><div className="section-heading"><div><h2>History</h2><p>Titles and episodes you both confirmed watching.</p></div></div><div className="watch-together-history-tabs" role="tablist" aria-label="Watch Together history"><button type="button" role="tab" aria-selected={historyTab === 'movies'} className={historyTab === 'movies' ? 'active' : ''} onClick={() => { setHistoryTab('movies'); setMovieHistoryPage(1) }}>Movies <span>{state.watchedMovies.length}</span></button><button type="button" role="tab" aria-selected={historyTab === 'shows'} className={historyTab === 'shows' ? 'active' : ''} onClick={() => { setHistoryTab('shows'); setShowHistoryPage(1) }}>Shows <span>{state.watchedEpisodes.length}</span></button></div>{visibleHistoryItems.length ? <><div className="watch-together-results">{visibleHistoryItems.map((item) => <WatchTogetherHistoryRow key={historyTab === 'movies' ? `movie-${item.id}` : `episode-${item.episodeId}`} item={item} achievements={achievementsState?.achievements || []} onLogSession={(ids, details) => onSaveSession(item, ids, details)} />)}</div><PaginationControls pagination={historyPagination} onPageChange={historyTab === 'movies' ? setMovieHistoryPage : setShowHistoryPage} /></> : <SectionMessage message={historyTab === 'movies' ? 'No shared movies yet.' : 'No shared episodes yet.'} />}</section> : <section className="watch-together-workspace">
        <div className="watch-together-search-panel"><div className="section-heading"><div><h2>Find a {activeTab === 'movies' ? 'movie' : 'TV show'}</h2><p>{activeTab === 'movies' ? 'Add movies to your shared shortlist.' : 'Add a show to select your next shared episode.'}</p></div></div><form className="watch-together-search-form" onSubmit={(event) => { event.preventDefault(); onSearch() }}><input value={search.query} onChange={(event) => onSearchChange({ query: event.target.value, type: activeTab === 'movies' ? 'movie' : 'tv' })} placeholder={activeTab === 'movies' ? 'Search movies' : 'Search TV shows'} /><button type="submit" className="primary-button" disabled={!search.query.trim() || search.status === 'loading'}>{search.status === 'loading' ? 'Searching...' : 'Search'}</button></form>{search.status === 'error' ? <SectionMessage tone="error" message={search.error} /> : null}<div className="watch-together-results">{searchItems.map((item) => <WatchTogetherTitleRow key={`${item.mediaType}-${item.id}`} item={item} actionLabel={saved.has(`${item.mediaType}-${item.id}`) ? 'Added' : 'Add'} disabled={saved.has(`${item.mediaType}-${item.id}`) || action.status === 'loading'} onAction={() => onItemAction('add', item)} />)}</div></div>
        <div className="watch-together-shortlist"><div className="section-heading"><div><h2>{activeTab === 'movies' ? 'Movie shortlist' : 'TV episode shortlist'}</h2><p>{activeTab === 'tv' ? 'Each entry is the next episode you can watch together.' : `${movieItems.length} movie${movieItems.length === 1 ? '' : 's'} to choose from.`}</p></div></div>{tabItems.length ? <div className="watch-together-results">{tabItems.map((item) => <WatchTogetherTitleRow key={`${item.mediaType}-${item.id}`} item={item} selected={item.selected} actionLabel={item.selected ? null : item.pickVoteStatus ? 'Proposal pending' : 'Propose tonight'} disabled={action.status === 'loading' || Boolean(selected) || Boolean(pendingPick)} onAction={() => onItemAction('select', item)} onRemove={!item.selected && !item.pickVoteStatus ? () => onItemAction('remove', item) : null} />)}</div> : <SectionMessage message={activeTab === 'movies' ? 'Search for a movie to start the shortlist.' : 'Search for a show to choose your next shared episode.'} />}</div>
        {activeTab === 'tv' ? <section className="watch-together-in-progress"><div className="section-heading"><div><h2>Jointly in progress</h2><p>Shows with at least one episode watched together.</p></div></div>{state.inProgressShows.length ? <div className="watch-together-results">{state.inProgressShows.map((show) => <WatchTogetherInProgressShowRow key={show.id} show={show} onOpen={() => onOpenTvShow(show)} />)}</div> : <SectionMessage message="Shared TV shows will appear here after your first episode together." />}</section> : null}
      </section>}
    </> : null}
    {resetOpen ? <WatchTogetherResetDialog isSaving={action.status === 'loading' && action.key === 'reset'} onCancel={() => setResetOpen(false)} onConfirm={async () => { if (await onReset()) setResetOpen(false) }} /> : null}
  </section>
}

function WatchTogetherResetDialog({ isSaving, onCancel, onConfirm }) {
  return <div className="movie-rating-dialog-backdrop" role="presentation" onMouseDown={isSaving ? undefined : onCancel}>
    <section className="movie-rating-dialog" role="dialog" aria-modal="true" aria-labelledby="watch-together-reset-title" onMouseDown={(event) => event.stopPropagation()}>
      <p className="movie-rating-dialog-kicker">Reset Watch Together</p><h2 id="watch-together-reset-title">Disconnect your partner?</h2><p>This permanently deletes your shared shortlist and Watched Together history for both users.</p>
      <div className="movie-rating-dialog-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>Cancel</button><button type="button" className="primary-button" onClick={onConfirm} disabled={isSaving}>{isSaving ? 'Resetting...' : 'Reset connection'}</button></div>
    </section>
  </div>
}

function WatchTogetherStatsTab({ state, onOpenMovie, onOpenTvShow }) {
  const [tab, setTab] = useState('movies')
  if (state?.status === 'idle' || state?.status === 'loading') return <section className="watch-together-history"><SectionMessage message="Loading shared stats..." /></section>
  if (state?.status === 'error') return <section className="watch-together-history"><SectionMessage tone="error" message={state.error || 'Unable to load shared stats.'} /></section>
  const dashboard = tab === 'movies' ? state.stats?.movies : state.stats?.shows
  if (!dashboard) return <section className="watch-together-history"><SectionMessage message="Connect with a partner to view shared stats." /></section>
  const { metrics, activity, genres, habits, topRated, streamingPlatforms, recentHistory, yearInReview, actors = [] } = dashboard
  const maxActivity = Math.max(...activity.buckets.map((bucket) => bucket.totalMinutes), 0)
  const maxGenre = Math.max(...genres.map((genre) => genre.minutes), 0)
  const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const openItem = (item) => item.mediaType === 'tv' ? onOpenTvShow(item) : onOpenMovie(item)
  const cards = tab === 'movies'
    ? [{ label: 'Shared Movies', value: metrics.titlesWatched, tone: 'violet', icon: ClapperIcon }, { label: 'Hours Together', value: formatMinutesAsHoursAndMinutes(metrics.timeWatchedMinutes), tone: 'blue', icon: ClockIcon }, { label: 'Average Rating', value: metrics.averageRating?.toFixed(1) ?? '—', suffix: '/5', tone: 'gold', icon: StarOutlineIcon }]
    : [{ label: 'Shared Shows', value: metrics.titlesWatched, tone: 'violet', icon: TvIcon }, { label: 'Episodes Together', value: metrics.episodesWatched, tone: 'teal', icon: TvIcon }, { label: 'Hours Together', value: formatMinutesAsHoursAndMinutes(metrics.timeWatchedMinutes), tone: 'blue', icon: ClockIcon }, { label: 'Average Rating', value: metrics.averageRating?.toFixed(1) ?? '—', suffix: '/5', tone: 'gold', icon: StarOutlineIcon }]
  return <section className="watch-together-history watch-together-stats"><div className="section-heading"><div><h2>Shared Stats</h2><p>All-time stats for titles you both confirmed watching.</p></div></div><div className="watch-together-history-tabs" role="tablist" aria-label="Shared statistics"><button type="button" role="tab" aria-selected={tab === 'movies'} className={tab === 'movies' ? 'active' : ''} onClick={() => setTab('movies')}>Movies</button><button type="button" role="tab" aria-selected={tab === 'shows'} className={tab === 'shows' ? 'active' : ''} onClick={() => setTab('shows')}>Shows</button></div>{metrics.titlesWatched === 0 ? <SectionMessage message={tab === 'movies' ? 'No shared movies yet.' : 'No shared episodes yet.'} /> : <div className="stats-page watch-together-stats-dashboard"><div className="stats-metric-grid">{cards.map(({ icon: Icon, label, value, suffix, tone }) => <article key={label} className={`stats-metric-card ${tone}`}><div className="stats-metric-icon"><Icon /></div><div><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div></article>)}</div><div className="stats-insights-grid"><section className="stats-surface stats-activity-card"><StatsSectionTitle title="Watch Activity" /><div className="stats-chart-axis">{buildActivityAxisLabels(maxActivity).map((label) => <span key={label}>{label}</span>)}</div><div className="stats-activity-bars watch-together-activity-bars" style={{ '--bar-count': activity.buckets.length }}>{activity.buckets.map((bucket) => <div key={bucket.label} className="stats-activity-bar-wrap"><span style={{ height: `${Math.max(3, (bucket.totalMinutes / maxActivity) * 100)}%` }} title={`${bucket.label}: ${formatMinutesAsHoursAndMinutes(bucket.totalMinutes)}`} /><small>{bucket.label}</small></div>)}</div></section><section className="stats-surface stats-genres-card"><StatsSectionTitle title="Top Genres" />{genres.length ? <div className="stats-genre-list">{genres.map((genre) => <div key={genre.name}><span>{genre.name}</span><div><i style={{ width: `${(genre.minutes / maxGenre) * 100}%` }} /></div><b>{formatCompactMinutes(genre.minutes)}</b></div>)}</div> : <SectionMessage message="No genre data yet." />}</section><section className="stats-surface stats-habits-card"><StatsSectionTitle title="Weekly Habits" />{habits.bestWeekdayIndex === null ? <SectionMessage message="No watch habits yet." /> : <><p className="stats-label-copy">Best Days</p><div className="stats-weekdays">{weekdayLabels.map((day, index) => <span key={`${day}-${index}`} className={index === habits.bestWeekdayIndex ? 'active' : ''}>{day}</span>)}</div><p className="stats-highlight-copy">{weekdayNames[habits.bestWeekdayIndex]} is your top day!</p><p className="stats-label-copy">Peak Watch Time</p><strong className="stats-peak-time"><ClockIcon />{formatPeakWatchWindow(habits.peakWindow)}</strong></>}</section></div><div className="stats-detail-grid"><section className="stats-surface stats-rated-card"><StatsSectionTitle title="Top Rated Together" />{topRated.length ? <div className="stats-rated-list">{topRated.map((item) => <StatsTitleRow key={`${item.mediaType}-${item.id}-${item.episodeId || ''}`} item={item} onOpenMovie={onOpenMovie} onOpenTvShow={onOpenTvShow} />)}</div> : <SectionMessage message="No shared ratings yet." />}</section><section className="stats-surface stats-actors-card"><StatsSectionTitle title="Most Watched Actors" />{actors.length ? <div className="stats-actors-list">{actors.map((actor, index) => <div key={actor.personId}><span className={`stats-actor-avatar${actor.profileUrl ? ' has-image' : ''}`} style={actor.profileUrl ? { backgroundImage: `url(${actor.profileUrl})` } : { '--avatar-color': statsActorColors[index % statsActorColors.length] }}>{actor.profileUrl ? null : actor.name.split(' ').map((part) => part[0]).join('').slice(0,2)}</span><p><b>{actor.name}</b><small>{actor.titleCount} {actor.titleCount === 1 ? 'title' : 'titles'}</small></p><em>#{index + 1}</em></div>)}</div> : <SectionMessage message="No shared cast data yet." />}</section><section className="stats-surface stats-platforms-card"><StatsSectionTitle title="Streaming Platforms" />{streamingPlatforms.length ? <div className="stats-platform-list">{streamingPlatforms.map((platform) => <div key={platform.name}><span className="stats-platform-mark">{platform.name.slice(0,1)}</span><p><b>{platform.name}</b><i><span style={{ width: `${platform.percent}%` }} /></i></p><strong>{formatMinutesAsHoursAndMinutes(platform.minutes)}<small>{platform.percent}%</small></strong></div>)}</div> : <SectionMessage message="No watch services recorded yet." />}</section><section className="stats-surface stats-history-card"><StatsSectionTitle title="Recent Shared History" />{recentHistory.length ? <div className="stats-history-list">{recentHistory.map((item) => <button type="button" className="stats-history-item" key={`${item.mediaType}-${item.id}-${item.episodeId || ''}`} onClick={() => openItem(item)}><div className="stats-title-art">{item.posterUrl ? <img src={item.posterUrl} alt={`${item.title} poster`} loading="lazy" /> : null}</div><b>{item.title}</b><small>{item.mediaType === 'tv' ? `S${item.seasonNumber} E${item.episodeNumber}` : 'Movie'}</small><em>{formatRelativeTime(item.watchedAt)}</em></button>)}</div> : null}</section></div><div className="stats-bottom-grid"><section className="stats-surface stats-review-card"><StatsSectionTitle title="All-Time Review" /><div className="stats-review-metrics"><span>Titles Watched<b>{yearInReview.titlesWatched}</b></span><span>Hours Watched<b>{formatCompactMinutes(yearInReview.minutes)}</b></span><span>Episodes Watched<b>{yearInReview.episodesWatched}</b></span><span>Avg Rating<b>{yearInReview.averageRating?.toFixed(1) ?? '—'}<small>/5</small></b></span></div><div className="stats-review-highlights"><span>Top Genre<b>{yearInReview.topGenre || '—'}</b></span><span>Longest Streak<b>{yearInReview.longestStreak ? `${yearInReview.longestStreak} days` : '—'}</b></span><span>Most Watched Month<b>{yearInReview.mostWatchedMonth || '—'}</b></span><span>New Favorites<b>{yearInReview.newFavorites}</b></span></div></section></div></div>}</section>
}

function WatchTogetherTitleRow({ item, selected = false, actionLabel, disabled, onAction, onRemove }) {
  const pending = item.pickVoteStatus === 'proposed_by_current_user' ? ' · Waiting for partner' : item.pickVoteStatus === 'awaiting_current_user' ? ' · Your vote is needed' : ''
  return <article className={`watch-together-title${selected ? ' selected' : ''}`}><div className="watch-together-title-main"><span className={`watch-together-art${item.posterUrl ? ' has-image' : ''}`} style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})` } : undefined} /><span><b>{item.title}</b><small>{item.mediaType === 'tv' && item.episodeId ? `${formatWatchTogetherEpisode(item)} · ${item.episodeTitle}` : item.mediaType === 'tv' ? 'TV Show' : `Movie · ${item.year || 'TBA'}`}{pending}</small></span></div><div className="watch-together-title-actions">{actionLabel ? <button type="button" className={selected ? 'primary-button' : 'secondary-button'} disabled={disabled} onClick={onAction}>{actionLabel}</button> : null}{onRemove ? <button type="button" className="watch-together-remove" disabled={disabled} onClick={onRemove} aria-label={`Remove ${item.title}`}>×</button> : null}</div></article>
}

function formatWatchTogetherEpisode(item) {
  return `S${item?.seasonNumber || 0} E${item?.episodeNumber || 0}`
}

function WatchTogetherMarkWatched({ movie, onMarkWatched, watchedActionState, onSubmitMovieRating, movieRatingActionState, onRefresh }) {
  const [watchServiceOpen, setWatchServiceOpen] = useState(false)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5)
  const waitingForPartner = movie.confirmedByCurrentUser && !movie.confirmedByPartner
  const isWatchingUpdate = watchedActionState.status === 'loading' && Number(watchedActionState.movieId) === Number(movie.id)
  const isRatingSaving = movieRatingActionState?.status === 'loading' && Number(movieRatingActionState.movieId) === Number(movie.id)
  const closeRating = () => { setRatingOpen(false); onRefresh?.() }
  return <><button type="button" className="secondary-button" disabled={isWatchingUpdate || waitingForPartner} onClick={() => setWatchServiceOpen(true)}>{isWatchingUpdate ? 'Updating...' : waitingForPartner ? 'Waiting for partner' : 'Mark watched'}</button>{watchServiceOpen ? <WatchServiceDialog title={movie.title} onCancel={() => setWatchServiceOpen(false)} onSelect={async (watchService) => { const saved = await onMarkWatched(movie, watchService); setWatchServiceOpen(false); if (saved) { setSelectedRating(5); setRatingOpen(true) } }} /> : null}{ratingOpen ? <MovieRatingDialog movie={movie} selectedRating={selectedRating} onSelectRating={setSelectedRating} onCancel={closeRating} onSubmit={async () => { if (await onSubmitMovieRating(movie, selectedRating)) closeRating() }} isSaving={isRatingSaving} error={movieRatingActionState?.status === 'error' && Number(movieRatingActionState.movieId) === Number(movie.id) ? movieRatingActionState.error : ''} cancelLabel="Skip" /> : null}</>
}

function WatchTogetherMarkEpisode({ episode, onMarkWatched, action, onSubmitRating, ratingActionState, onRefresh }) {
  const [open, setOpen] = useState(false)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5)
  const waiting = episode.confirmedByCurrentUser && !episode.confirmedByPartner
  const saving = action.status === 'loading' && action.key === `watch-tv-${episode.episodeId}`
  const ratingEpisode = { id: episode.episodeId, name: `${episode.title} · ${episode.episodeTitle}` }
  function closeRating() { setRatingOpen(false); onRefresh?.() }
  return <>{action.status === 'error' && action.key === `watch-tv-${episode.episodeId}` ? <span className="tmdb-search-error">{action.error}</span> : null}<button type="button" className="secondary-button" disabled={saving || waiting} onClick={() => setOpen(true)}>{saving ? 'Updating...' : waiting ? 'Waiting for partner' : 'Mark watched'}</button>{open ? <WatchServiceDialog title={`${episode.title} · ${formatWatchTogetherEpisode(episode)}`} onCancel={() => setOpen(false)} onSelect={async (service) => { const status = await onMarkWatched(episode, service); if (status) { setOpen(false); setSelectedRating(5); setRatingOpen(true) } }} /> : null}{ratingOpen ? <MovieRatingDialog movie={ratingEpisode} selectedRating={selectedRating} onSelectRating={setSelectedRating} onCancel={closeRating} onSubmit={async () => { if (await onSubmitRating(ratingEpisode, selectedRating)) closeRating() }} isSaving={ratingActionState?.status === 'loading' && Number(ratingActionState.episodeId) === Number(episode.episodeId)} error={ratingActionState?.status === 'error' && Number(ratingActionState.episodeId) === Number(episode.episodeId) ? ratingActionState.error : ''} kicker="Your Episode Rating" cancelLabel="Skip" /> : null}</>
}

function WatchTogetherHistoryRow({ item, onLogSession, achievements = [] }) {
  const [logging, setLogging] = useState(false)
  const isEpisode = item.mediaType === 'tv'
  return <><article className="watch-together-title watched"><div className="watch-together-title-main"><span className={`watch-together-art${item.posterUrl ? ' has-image' : ''}`} style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})` } : undefined} /><span><b>{isEpisode ? `${item.title} · ${item.episodeTitle}` : item.title}</b><small>{isEpisode ? `${formatWatchTogetherEpisode(item)} · ` : `Movie · ${item.year || 'TBA'} · `}Watched together {formatLongDate(item.watchedTogetherAt)}{item.sessionDetails ? ' · Session logged' : ''}</small></span></div><button type="button" className="secondary-button" onClick={() => setLogging(true)}>{item.sessionDetails ? 'Edit session' : 'Log session'}</button><CheckCircleIcon /></article>{logging ? <WatchTogetherSessionDialog item={item} achievements={achievements} onCancel={() => setLogging(false)} onSave={async (ids, details) => { await onLogSession(ids, details); setLogging(false) }} /> : null}</>
}

function WatchTogetherSessionDialog({ item, achievements, onCancel, onSave }) {
  const [selected, setSelected] = useState(() => Array.isArray(item.sessionAchievementIds) ? item.sessionAchievementIds : []); const [notes, setNotes] = useState(() => item.sessionDetails?.notes || ''); const [saving, setSaving] = useState(false)
  const manualAchievements = achievements.filter((achievement) => achievement.tracking !== 'automatic')
  return <div className="movie-rating-dialog-backdrop"><section className="movie-rating-dialog watch-together-session-dialog" role="dialog" aria-modal="true"><p className="movie-rating-dialog-kicker">Shared session</p><h2>What happened during {item.title}?</h2><p>Record any shared moments. The watch itself is already confirmed by both partners; progress for objective achievements updates automatically.</p><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes, mood, snack, location, quiz or prediction details" /><div className="watch-together-session-badges">{manualAchievements.map((achievement) => <label key={achievement.id}><input type="checkbox" checked={selected.includes(achievement.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, achievement.id] : ids.filter((id) => id !== achievement.id))} />{achievement.name}</label>)}</div><div className="movie-rating-dialog-actions"><button type="button" className="secondary-button" disabled={saving} onClick={onCancel}>Cancel</button><button type="button" className="primary-button" disabled={saving} onClick={async () => { setSaving(true); try { await onSave(selected, { notes }); } finally { setSaving(false) } }}>{saving ? 'Saving…' : 'Save session'}</button></div></section></div>
}

function WatchTogetherAchievementsTab({ state }) {
  const [category, setCategory] = useState('All'); const [status, setStatus] = useState('all')
  if (state?.status === 'loading' || state?.status === 'idle') return <SectionMessage message="Loading shared achievements..." />
  if (state?.status === 'error') return <SectionMessage tone="error" message={state.error} />
  const items = Array.isArray(state?.achievements) ? state.achievements : []; const categories = ['All', ...new Set(items.map((item) => item.category))]; const visible = items.filter((item) => (category === 'All' || item.category === category) && (status === 'all' || (status === 'unlocked' ? item.unlocked : !item.unlocked)))
  return <section className="watch-together-history"><div className="section-heading"><div><h2>Achievements</h2><p>{items.filter((item) => item.unlocked).length} of {items.length} shared achievements unlocked.</p></div></div><div className="achievement-filters"><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All badges</option><option value="unlocked">Unlocked</option><option value="locked">Locked</option></select></div><div className="achievement-grid">{visible.map((item) => <AchievementCard key={item.id} item={item} />)}</div></section>
}

function WatchTogetherInProgressShowRow({ show, onOpen }) {
  return <button type="button" className="watch-together-title watch-together-in-progress-row" onClick={onOpen} aria-label={`Open ${show.title}`}><span className="watch-together-title-main"><span className={`watch-together-art${show.posterUrl ? ' has-image' : ''}`} style={show.posterUrl ? { backgroundImage: `url(${show.posterUrl})` } : undefined} /><span><b>{show.title}</b><small>{show.watchedEpisodeCount} shared {show.watchedEpisodeCount === 1 ? 'episode' : 'episodes'} · Latest: S{show.latestSeasonNumber} E{show.latestEpisodeNumber} · {show.latestEpisodeTitle}</small></span></span><ChevronRight /></button>
}

function WatchlistScreen({
  activeTab,
  booksEnabled,
  availability,
  sort,
  isSignedIn,
  onTabChange,
  onViewChange,
  onOpenLogin,
  onOpenMovie,
  onOpenPerson,
  onOpenTvShow,
  onOpenBook,
  favoriteActorsState,
  favoriteAuthorsState,
  watchlistState,
  tvWatchlistShows,
  onOpenAuthor,
  onRemoveMovie,
  onRemoveBook,
  onToggleTvWatchlist,
  onMarkMovieWatched,
  onMarkBookRead,
  onMarkTvWatched,
  onSetPriority,
}) {
  const [watchlistQuery, setWatchlistQuery] = useState('')
  const visibleTab = !booksEnabled && activeTab === 'Books' ? 'All' : activeTab
  const allItems = [...watchlistState.movies, ...tvWatchlistShows, ...(booksEnabled ? watchlistState.books : [])]
  const filteredItems = getFilteredWatchlistItems({
    items: allItems,
    activeTab: visibleTab,
    availability,
    sort,
  }).filter((item) => `${item.title} ${item.meta} ${item.categoriesLabel || ''}`.toLocaleLowerCase().includes(watchlistQuery.trim().toLocaleLowerCase()))

  function renderWatchlistCard(item) {
    return <WatchlistCard key={`${item.type}-${item.id}`} item={item} compact onOpenItem={item.type === 'TV Shows' ? onOpenTvShow : item.type === 'Books' ? onOpenBook : onOpenMovie} onRemove={item.type === 'TV Shows' ? onToggleTvWatchlist : item.type === 'Books' ? onRemoveBook : onRemoveMovie} onMarkComplete={item.type === 'TV Shows' ? onMarkTvWatched : item.type === 'Books' ? onMarkBookRead : onMarkMovieWatched} onSetPriority={onSetPriority} />
  }

  const watchlistGroups = [
    { title: 'Continue watching / reading', detail: 'Pick up where you left off', items: filteredItems.filter((item) => item.progress > 0) },
    { title: 'Watch next', detail: 'Your Top picks and queue', items: filteredItems.filter((item) => item.topSlot || item.queuePosition) },
    { title: 'Upcoming releases', detail: 'What is arriving soon', items: filteredItems.filter((item) => item.nextEpisodeDate || (item.releaseDate && new Date(`${item.releaseDate}T00:00:00`).valueOf() > Date.now())) },
  ]
  const groupedItemKeys = new Set(watchlistGroups.flatMap((group) => group.items.map((item) => `${item.type}-${item.id}`)))
  watchlistGroups.push({ title: 'Everything else', detail: 'The rest of your saved titles', items: filteredItems.filter((item) => !groupedItemKeys.has(`${item.type}-${item.id}`)) })

  if (!isSignedIn) {
    return (
      <section className="watchlist-screen">
        <div className="watchlist-hero">
          <div className="watchlist-heading">
            <h1>My Watchlist</h1>
            <p>Sign in to keep your watchlist personal to your account.</p>
          </div>
        </div>

        <section className="content-section">
          <SectionMessage message="Sign in to view and manage your watchlist." />
          <button type="button" className="primary-button" onClick={onOpenLogin}>
            <span>Sign In</span>
          </button>
        </section>
      </section>
    )
  }

  return (
    <section className="watchlist-screen">
      <div className="watchlist-hero">
        <div className="watchlist-heading">
          <h1>My Watchlist</h1>
          <p>Organize everything you want to watch or read next.</p>
        </div>

        <section className="watchlist-stats-panel" aria-label="Watchlist summary">
          {[
            { label: 'Total', value: String(allItems.length), caption: 'In Watchlist' },
            { label: 'Movies', value: String(watchlistState.movies.length), caption: 'Titles' },
            { label: 'TV Shows', value: String(tvWatchlistShows.length), caption: 'Series' },
            ...(booksEnabled ? [{ label: 'Books', value: String(watchlistState.books.length), caption: 'Titles' }] : []),
            { label: 'Actors', value: String(favoriteActorsState.actors.length), caption: 'Favorites' },
            { label: 'Authors', value: String(favoriteAuthorsState.authors.length), caption: 'Favorites' },
          ].map((item) => (
            <article key={item.label} className={`watchlist-stat${item.accent ? ' accent' : ''}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.caption}</p>
            </article>
          ))}
        </section>
      </div>

      <div className="watchlist-tabs" role="tablist" aria-label="Watchlist categories">
        {watchlistTabs.filter((tab) => booksEnabled || tab !== 'Books').map((tab) => (
          <button
            key={tab}
            type="button"
            className={`watchlist-pill${tab === visibleTab ? ' active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {visibleTab !== 'Actors' && visibleTab !== 'Authors' ? <div className="watchlist-toolbar" aria-label="Watchlist controls">
        <label className="watchlist-search"><SearchIcon /><span className="sr-only">Search watchlist</span><input value={watchlistQuery} onChange={(event) => setWatchlistQuery(event.target.value)} placeholder="Search your watchlist" /></label>
        <label className="watchlist-select"><span>Availability</span><select value={availability} onChange={(event) => onViewChange({ availability: event.target.value })}><option value="all">All availability</option><option value="streaming">Streaming now</option><option value="upcoming">Upcoming</option></select></label>
        <label className="watchlist-select"><span>Sort</span><select value={sort} onChange={(event) => onViewChange({ sort: event.target.value })}><option value="recently-added">Recently added</option><option value="priority">Priority</option><option value="release-date">Release date</option><option value="rating">Rating</option><option value="runtime-or-pages">Runtime / pages</option><option value="alphabetical">Alphabetical</option></select></label>
      </div> : null}

      {visibleTab === 'Actors' ? (
        <div className="favorite-actors-grid">
          {favoriteActorsState.actors.map((actor) => <FavoriteActorCard key={actor.id} actor={actor} onOpenPerson={onOpenPerson} />)}
        </div>
      ) : visibleTab === 'Authors' ? (
        <div className="favorite-actors-grid">
          {favoriteAuthorsState.authors.map((author) => <FavoriteAuthorCard key={author.id} author={author} onOpenAuthor={onOpenAuthor} />)}
        </div>
      ) : (
        visibleTab === 'All' && availability === 'all' && !watchlistQuery.trim() ? <div className="watchlist-groups">{watchlistGroups.filter((group) => group.items.length > 0).map((group) => <section key={group.title} className="watchlist-group"><div className="watchlist-group-heading"><div><h2>{group.title}</h2><p>{group.detail}</p></div><span>{group.items.length}</span></div><div className="watchlist-grid-mobile">{group.items.map(renderWatchlistCard)}</div></section>)}</div> : <div className="watchlist-grid-mobile">{filteredItems.map(renderWatchlistCard)}</div>
      )}

      {watchlistState.status === 'loading' ? <SectionMessage message="Loading your watchlist..." /> : null}
      {watchlistState.status === 'error' ? <SectionMessage message={watchlistState.error} tone="error" /> : null}
      {visibleTab === 'Actors' && favoriteActorsState.status === 'loading' ? <SectionMessage message="Loading favorite actors..." /> : null}
      {visibleTab === 'Actors' && favoriteActorsState.status === 'error' ? <SectionMessage message={favoriteActorsState.error} tone="error" /> : null}
      {visibleTab === 'Authors' && favoriteAuthorsState.status === 'loading' ? <SectionMessage message="Loading favorite authors..." /> : null}
      {visibleTab === 'Authors' && favoriteAuthorsState.status === 'error' ? <SectionMessage message={favoriteAuthorsState.error} tone="error" /> : null}
      {visibleTab === 'Actors' && favoriteActorsState.status !== 'loading' && favoriteActorsState.status !== 'error' && favoriteActorsState.actors.length === 0
        ? <SectionMessage message="Favorite actors will appear here." />
        : null}
      {visibleTab === 'Authors' && favoriteAuthorsState.status !== 'loading' && favoriteAuthorsState.status !== 'error' && favoriteAuthorsState.authors.length === 0
        ? <SectionMessage message="Favorite authors will appear here." />
        : null}
      {visibleTab !== 'Actors' && visibleTab !== 'Authors' && watchlistState.status !== 'loading' && watchlistState.status !== 'error' && filteredItems.length === 0
        ? <SectionMessage message="No watchlist titles match this section yet." />
        : null}
    </section>
  )
}

function FavoriteActorCard({ actor, isFavorite = false, matchQuery, onOpenPerson, onToggleFavorite }) {
  const [imageUnavailable, setImageUnavailable] = useState(false)
  const showImage = Boolean(actor.profileUrl) && !imageUnavailable
  const cardContent = <>
    <div className={`favorite-actor-portrait${showImage ? ' has-image' : ''}`}>
      {showImage ? <img src={actor.profileUrl} alt={`${actor.name} portrait`} loading="lazy" onError={() => setImageUnavailable(true)} /> : <span>{getMovieCreditInitials(actor.name)}</span>}
    </div>
    <div><h2><HighlightedText text={actor.name} query={matchQuery} /></h2><SearchMatchLabel text={actor.name} query={matchQuery} person /><p><HighlightedText text={actor.role || 'Actor'} query={matchQuery} /></p></div>
  </>

  if (!onToggleFavorite) return <button type="button" className="favorite-actor-card" onClick={() => onOpenPerson(actor)} aria-label={`Open ${actor.name}`}>{cardContent}</button>

  return <article className="favorite-actor-card favorite-actor-card-with-action">
    <button type="button" className="favorite-actor-card-open" onClick={() => onOpenPerson(actor)} aria-label={`Open ${actor.name}`}>{cardContent}</button>
    <button type="button" className={`favorite-actor-quick-action${isFavorite ? ' is-active' : ''}`} onClick={() => onToggleFavorite(actor)} aria-label={`${isFavorite ? 'Remove' : 'Add'} ${actor.name} ${isFavorite ? 'from' : 'to'} favorite actors`} title={isFavorite ? 'Remove from favorite actors' : 'Add to favorite actors'}><StarIcon /></button>
  </article>
}

function FavoriteAuthorCard({ author, onOpenAuthor }) {
  return (
    <button type="button" className="favorite-actor-card favorite-author-card" onClick={() => onOpenAuthor(author)} aria-label={`Open ${author.name}`}>
      <div className="favorite-actor-portrait"><span>{getMovieCreditInitials(author.name)}</span></div>
      <div><h2>{author.name}</h2><p>Author</p></div>
    </button>
  )
}

function TvFeaturedCard({ show, isWatched, isInWatchlist, onToggleWatchlist, onOpenShow }) {
  if (!show) {
    return <SectionMessage message="No TV show is available for this filter yet." />
  }

  const showBackdropImage = Boolean(show.backdropUrl)
  const artStyle = showBackdropImage
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(10, 13, 24, 0.12), rgba(8, 11, 19, 0.24)), url(${show.backdropUrl})`,
      }
    : undefined

  return (
    <section className="tv-feature-card">
      <div className="tv-feature-copy">
        <span className="feature-label">Featured</span>
        <h2>{show.title}</h2>
        <div className="featured-movie-meta tv-feature-meta">
          <span>{show.year}</span>
          <span>{show.genreLabel}</span>
          <span>{show.maturityRating}</span>
          <span>{show.meta}</span>
        </div>
        <div className="featured-movie-scores tv-feature-scores">
          <span className="movie-score">
            <StarIcon />
            {show.rating}
          </span>
          <span className="movie-score tomato-score">
            <TomatoIcon />
            {show.audience}
          </span>
        </div>
        <p>{show.description}</p>

        <div className="hero-actions movie-actions tv-feature-actions">
          <button type="button" className="primary-button" onClick={() => onToggleWatchlist(show)} disabled={isWatched}>
            <PlusIcon />
            <span>{isWatched ? 'Watched' : isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span>
          </button>
          <button type="button" className="secondary-button tv-feature-details" onClick={() => onOpenShow(show)}>
            <span>View details</span>
            <ChevronRight />
          </button>
        </div>
      </div>

      <div
        className={`tv-feature-art${showBackdropImage ? ' has-image' : ` ${show.theme}`}`}
        style={artStyle}
        aria-hidden="true"
      >
      </div>
    </section>
  )
}

function TvShowPosterCard({ show, matchQuery, onSelectShow, isActive = false, isInWatchlist = false, isWatched = false, onToggleWatchlist, onToggleWatched }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(show.posterUrl) && !posterUnavailable
  const hasQuickActions = Boolean(onToggleWatchlist || onToggleWatched)

  if (hasQuickActions) {
    return (
      <article className={`tv-show-card quick-media-card${isActive ? ' active' : ''}`}>
        <button type="button" className="quick-media-card-open" onClick={() => onSelectShow(show)} aria-label={`Show details for ${show.title}`} />
        <div className={`tv-show-poster ${show.theme}${showPosterImage ? ' has-image' : ''}`}>
          {isWatched ? <span className="movie-card-watched-badge" aria-hidden="true"><CheckCircleIcon /></span> : null}
          {isInWatchlist ? <span className="movie-card-watchlist-badge" aria-hidden="true"><BookmarkStatusIcon /></span> : null}
          {showPosterImage ? <img src={show.posterUrl} alt={`${show.title} poster`} className="movie-card-poster-image" loading="lazy" onError={() => setPosterUnavailable(true)} /> : null}
          <QuickMediaActions title={show.title} isInWatchlist={isInWatchlist} isWatched={isWatched} onOpen={() => onSelectShow(show)} onToggleWatchlist={onToggleWatchlist ? () => onToggleWatchlist(show) : null} onToggleWatched={onToggleWatched ? () => onToggleWatched(show) : null} />
        </div>
        <div className="tv-show-card-copy">
          <h3><HighlightedText text={show.title} query={matchQuery} /></h3><SearchMatchLabel text={show.title} query={matchQuery} />
          <p>{show.year}</p>
          <div className="rating-row"><span className="star-rating"><StarIcon />{show.rating}</span><span><HighlightedText text={show.seasonMeta} query={matchQuery} /></span></div>
        </div>
      </article>
    )
  }

  return (
    <button
      type="button"
      className={`tv-show-card${isActive ? ' active' : ''}`}
      onClick={() => onSelectShow(show)}
      aria-label={`Show details for ${show.title}`}
    >
      <div className={`tv-show-poster ${show.theme}${showPosterImage ? ' has-image' : ''}`}>
        {isWatched ? (
          <span className="movie-card-watched-badge" aria-hidden="true">
            <CheckCircleIcon />
          </span>
        ) : null}
        {isInWatchlist ? (
          <span className="movie-card-watchlist-badge" aria-hidden="true">
            <BookmarkStatusIcon />
          </span>
        ) : null}
        {showPosterImage ? (
          <img
            src={show.posterUrl}
            alt={`${show.title} poster`}
            className="movie-card-poster-image"
            loading="lazy"
            onError={() => setPosterUnavailable(true)}
          />
        ) : null}
      </div>
      <div className="tv-show-card-copy">
        <h3><HighlightedText text={show.title} query={matchQuery} /></h3><SearchMatchLabel text={show.title} query={matchQuery} />
        <p>{show.year}</p>
        <div className="rating-row">
          <span className="star-rating">
            <StarIcon />
            {show.rating}
          </span>
          <span><HighlightedText text={show.seasonMeta} query={matchQuery} /></span>
        </div>
      </div>
    </button>
  )
}

function TvShowsGrid({
  tvState,
  layout = 'slider',
  onSelectShow,
  watchedIds = new Set(),
  watchlistIds = new Set(),
  activeShowId = null,
  onToggleWatchlist,
  onToggleWatched,
}) {
  if (tvState.status === 'loading' || tvState.status === 'idle') {
    return <SectionMessage message="Loading TV shows from your local database..." />
  }

  if (tvState.status === 'error') {
    return <SectionMessage message={`Could not load TV shows. ${tvState.error}`} tone="error" />
  }

  if (tvState.shows.length === 0) {
    return <SectionMessage message="No TV shows are available in the local database yet." />
  }

  const shows = layout === 'catalog' ? tvState.shows : tvState.shows.slice(0, 10)

  return (
    <div className={`tv-show-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}>
      {shows.map((show) => (
        <TvShowPosterCard
          key={show.id}
          isActive={Number(show.id) === Number(activeShowId)}
          isInWatchlist={watchlistIds.has(Number(show.id))}
          isWatched={watchedIds.has(Number(show.id))}
          onSelectShow={onSelectShow}
          show={show}
          onToggleWatchlist={onToggleWatchlist}
          onToggleWatched={onToggleWatched}
        />
      ))}
    </div>
  )
}

function TvDashboardStats({ items, period = 'month', onPeriodChange }) {
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false)
  const activePeriod = statsPeriods.find((option) => option.value === period) ?? statsPeriods[1]

  return (
    <section className="tv-dashboard-stats" aria-label="Your TV statistics">
      <div className="tv-dashboard-stats-heading">
        <span>Your TV Stats</span>
        <div className="stats-period-control">
          <button
            type="button"
            className="month-button"
            aria-haspopup="menu"
            aria-expanded={isPeriodMenuOpen}
            onClick={() => setIsPeriodMenuOpen((open) => !open)}
          >
            {activePeriod.label}
            <ChevronDown />
          </button>
          {isPeriodMenuOpen ? (
            <div className="stats-period-menu" role="menu" aria-label="TV stats period">
              {statsPeriods.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.value === period}
                  className={option.value === period ? 'active' : ''}
                  onClick={() => {
                    onPeriodChange(option.value)
                    setIsPeriodMenuOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="tv-dashboard-stat-grid">
        {items.map(({ label, value, tone, icon: Icon }) => (
          <article key={label} className={`tv-dashboard-stat-card ${tone}`}>
            <div className="stat-icon"><Icon /></div>
            <div><span>{label}</span><strong>{value}</strong></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function TvWatchlistPanel({ items, onOpenWatchlist, onSelectShow }) {
  return (
    <section className="movie-watchlist-panel tv-watchlist-panel">
      <div className="section-header">
        <h2>Your Watchlist</h2>
        <button type="button" className="section-link" onClick={onOpenWatchlist}>
          View all
        </button>
      </div>

      {items.length === 0 ? <SectionMessage message="Save a few shows to fill your TV watchlist." /> : null}

      <div className="movie-watchlist-list tv-watchlist-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="movie-watchlist-item movie-watchlist-item-button tv-watchlist-item"
            onClick={() => onSelectShow(item)}
            aria-label={`Feature ${item.title}`}
          >
            <div
              className={`movie-watchlist-poster tv-watchlist-poster ${item.theme}${item.posterUrl ? ' has-image' : ''}`}
              style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})` } : undefined}
            />
            <div className="movie-watchlist-copy tv-watchlist-copy">
              <h3>{item.title}</h3>
              <p>{item.railMeta}</p>
              <span className="star-rating">
                <StarIcon />
                {item.rating}
              </span>
            </div>
            <span className="tv-watchlist-bookmark" aria-hidden="true">
              <BookmarkStatusIcon />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function TvDetailPage({ tvDetailState, tvReviewsState, user, onBackToTv, onToggleWatchlist, onUpdateEpisodes, onSubmitEpisodeRating, onOpenTv, onOpenPerson, onOpenLogin, isSignedIn, watchlistIds, tvEpisodeRatingActionState }) {
  const [seasonNumber, setSeasonNumber] = useState(null)
  const [trailer, setTrailer] = useState(null)
  const [catchUpEpisode, setCatchUpEpisode] = useState(null)
  const [pendingWatchRequest, setPendingWatchRequest] = useState(null)
  const [ratingEpisode, setRatingEpisode] = useState(null)
  const [selectedRating, setSelectedRating] = useState(5)
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false)
  const [isUpdatingEpisodes, setIsUpdatingEpisodes] = useState(false)
  const [filelistState, setFilelistState] = useState({ open: false, status: 'idle', results: [], error: '', minutesUntilReset: null, episode: null })
  useEffect(() => { setSeasonNumber(null); setTrailer(null); setCatchUpEpisode(null); setPendingWatchRequest(null); setRatingEpisode(null); setIsOverviewExpanded(false); setIsUpdatingEpisodes(false); setFilelistState({ open: false, status: 'idle', results: [], error: '', minutesUntilReset: null, episode: null }) }, [tvDetailState.show?.id])
  if (tvDetailState.status === 'loading' || tvDetailState.status === 'idle') return <section className="movie-detail-page"><SectionMessage message="Loading TV series detail..." /></section>
  if (tvDetailState.status === 'error' || !tvDetailState.show) return <section className="movie-detail-page"><SectionMessage tone="error" message={tvDetailState.error || 'TV series detail is not available.'} /></section>
  const show = tvDetailState.show
  const season = show.seasons.find((item) => item.seasonNumber === seasonNumber) ?? show.seasons.find((item) => item.seasonNumber > 0) ?? show.seasons[0]
  const episodes = season?.episodes ?? []
  const airedEpisodes = show.seasons.flatMap((item) => item.episodes).filter((episode) => episode.isAired)
  const watchedCount = airedEpisodes.filter((episode) => episode.watched).length
  const totalEpisodes = airedEpisodes.length
  const isWatchlist = watchlistIds.has(Number(show.id))
  const backdropStyle = show.backdropUrl ? { backgroundImage: `linear-gradient(90deg, rgba(7, 10, 18, .96), rgba(7, 10, 18, .46)), url(${show.backdropUrl})` } : undefined
  const seasonAiredEpisodes = episodes.filter((episode) => episode.isAired)
  const isSeasonWatched = seasonAiredEpisodes.length > 0 && seasonAiredEpisodes.every((episode) => episode.watched)
  const yourEpisodeRating = show.yourEpisodeRating ?? { average: null, ratingCount: 0 }
  const filelistTarget = getFilelistTvEpisodeTarget(show)

  async function updateEpisodes(request, episodeToRate = null) {
    setIsUpdatingEpisodes(true)
    try {
      await onUpdateEpisodes(show.id, request)
      setCatchUpEpisode(null)
      if (episodeToRate) {
        setSelectedRating(episodeToRate.yourScore ?? 5)
        setRatingEpisode(episodeToRate)
      }
    } finally {
      setIsUpdatingEpisodes(false)
    }
  }

  function requestEpisodeWatch(request, episodeToRate = null) {
    setPendingWatchRequest({ request, episodeToRate })
  }

  function handleEpisodeToggle(episode) {
    if (!isSignedIn) return onOpenLogin()
    if (episode.watched) {
      void updateEpisodes({ action: 'unmark_episode', episodeId: episode.id })
      return
    }
    const earlierUnwatchedEpisodes = show.seasons
      .flatMap((item) => item.episodes.map((itemEpisode) => ({ seasonNumber: item.seasonNumber, episode: itemEpisode })))
      .filter(({ seasonNumber: itemSeasonNumber, episode: itemEpisode }) => itemEpisode.isAired && !itemEpisode.watched && (itemSeasonNumber < season.seasonNumber || (itemSeasonNumber === season.seasonNumber && itemEpisode.episodeNumber < episode.episodeNumber)))
    if (earlierUnwatchedEpisodes.length > 0) {
      setCatchUpEpisode({ episode, earlierCount: earlierUnwatchedEpisodes.length })
      return
    }
    requestEpisodeWatch({ action: 'mark_episode', episodeId: episode.id }, episode)
  }

  function handleMarkSeasonWatched() {
    if (!isSignedIn) return onOpenLogin()
    if (!season || isSeasonWatched) return
    requestEpisodeWatch({ action: 'mark_season', seasonId: season.id })
  }
  function handleOpenEpisodeRating(episode) {
    if (!isSignedIn) return onOpenLogin()
    setSelectedRating(episode.yourScore ?? 5)
    setRatingEpisode(episode)
  }
  async function handleOpenFilelist() {
    if (!isSignedIn) return onOpenLogin()
    if (!filelistTarget) return
    setFilelistState({ open: true, status: 'loading', results: [], error: '', minutesUntilReset: null, episode: filelistTarget })
    try {
      const response = await fetch(`/api/tv/${show.id}/filelist`, { headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setFilelistState({ open: true, status: response.status === 429 ? 'rate-limit' : 'error', results: [], error: payload.error || `Request failed with status ${response.status}`, minutesUntilReset: payload.minutesUntilReset ?? null, episode: filelistTarget })
        return
      }
      setFilelistState({ open: true, status: 'success', results: Array.isArray(payload.results) ? payload.results : [], error: '', minutesUntilReset: null, episode: payload.episode ?? filelistTarget })
    } catch (error) { setFilelistState({ open: true, status: 'error', results: [], error: error instanceof Error ? error.message : 'Unable to search Filelist right now.', minutesUntilReset: null, episode: filelistTarget }) }
  }
  const watchedPercentage = totalEpisodes ? Math.round((watchedCount / totalEpisodes) * 100) : 0
  const scrollToSection = (sectionId) => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return <section className="movie-detail-page tv-detail-page tv-detail-redesign">
    <article className="tv-detail-hero" style={backdropStyle}>
      <div className="tv-detail-hero-overlay" />
      <button type="button" className="tv-detail-back" onClick={onBackToTv}><ChevronLeftIcon /><span>Back to TV Shows</span></button>
      <div className="tv-detail-hero-content">
        <div className="tv-detail-poster-wrap"><div className="tv-detail-poster">{show.posterUrl ? <img src={show.posterUrl} alt={`${show.title} poster`} /> : null}</div></div>
        <div className="tv-detail-main"><h1>{show.title}</h1><div className="tv-detail-meta"><span>{show.year}</span><span>{show.genresLabel}</span><span>{show.maturityRating}</span></div>
          <div className="tv-detail-statline"><span className="tv-detail-rating"><StarIcon /> {show.voteAverage}<small>TMDB</small></span><span>{totalEpisodes} Episodes</span><span>{show.seasons.length} {show.seasons.length === 1 ? 'Season' : 'Seasons'}</span><span><TvIcon /> {show.network || 'TBA'}</span></div>
          <p className={`tv-detail-summary${isOverviewExpanded ? ' expanded' : ''}`}>{show.overview}</p>{show.overview?.length > 150 ? <button type="button" className="tv-detail-more" onClick={() => setIsOverviewExpanded((expanded) => !expanded)}>{isOverviewExpanded ? 'Less' : 'More'}</button> : null}
          <div className="tv-detail-actions"><button type="button" className={`primary-button tv-detail-primary${isWatchlist ? ' is-active' : ''}`} onClick={() => onToggleWatchlist(show)}><PlusIcon /><span>{isWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span></button><div className="tv-detail-secondary-actions">{show.trailer ? <button type="button" className="secondary-button" onClick={() => setTrailer(show.trailer)}><PlayIcon /><span>Trailer</span></button> : null}<button type="button" className="secondary-button" onClick={handleOpenFilelist} disabled={!filelistTarget} title={!filelistTarget ? 'You are caught up on all aired episodes.' : undefined}><BarsIcon /><span>Filelist</span></button></div></div>
        </div>
      </div>
    </article>
    <nav className="tv-detail-tabs" aria-label="TV show sections"><button type="button" className="active" onClick={() => scrollToSection('tv-episodes')}>Episodes</button><button type="button" onClick={() => scrollToSection('tv-cast')}>Cast &amp; Crew</button><button type="button" onClick={() => scrollToSection('tv-recommendations')}>More Like This</button><button type="button" onClick={() => scrollToSection('tv-reviews')}>Reviews</button></nav>
    <div className="tv-detail-layout">
      <section id="tv-episodes" className="content-section tv-detail-panel tv-detail-episodes"><div className="tv-detail-section-heading"><h2>Episodes</h2></div><div className="tv-detail-season-controls"><label><span className="sr-only">Season</span><select value={season?.seasonNumber ?? ''} onChange={(event) => setSeasonNumber(Number(event.target.value))}>{show.seasons.map((item) => <option key={item.id} value={item.seasonNumber}>{item.name}</option>)}</select></label><span>{episodes.length} Episodes</span><button type="button" className="secondary-button tv-season-watch-button" disabled={isUpdatingEpisodes || isSeasonWatched || seasonAiredEpisodes.length === 0} onClick={handleMarkSeasonWatched}><CheckIcon /><span>{isSeasonWatched ? 'Season watched' : isUpdatingEpisodes ? 'Updating...' : 'Mark season watched'}</span></button></div><div className="tv-detail-episode-grid">{episodes.map((episode) => <article className="tv-detail-episode-card" key={episode.id}><div className="tv-detail-episode-still">{episode.stillUrl ? <img src={episode.stillUrl} alt="" /> : null}<span>E{episode.episodeNumber}</span></div><div className="tv-detail-episode-copy"><h3>{episode.name}</h3><p>{episode.overview || 'Episode overview is not available.'}</p></div><div className="tv-detail-episode-actions"><span>{episode.runtimeLabel}</span>{episode.watched ? <button type="button" className="tv-episode-rate" onClick={() => handleOpenEpisodeRating(episode)} aria-label={`${episode.yourScore === null ? 'Rate' : 'Update rating for'} ${episode.name}`}><StarOutlineIcon /></button> : null}<button type="button" disabled={!episode.isAired || isUpdatingEpisodes} className={`tv-episode-toggle${episode.watched ? ' watched' : ''}`} aria-label={episode.isAired ? `${episode.watched ? 'Mark unwatched' : 'Mark watched'} ${episode.name}` : `${episode.name} has not aired yet`} onClick={() => handleEpisodeToggle(episode)}><CheckIcon /></button></div></article>)}</div></section>
      <aside className="tv-detail-side"><section className="content-section tv-detail-panel tv-detail-activity"><div className="section-header"><h2>Your Activity</h2><span>{watchedCount} of {totalEpisodes} watched</span></div><div className="tv-detail-progress"><span style={{ width: `${watchedPercentage}%` }} /></div><div className="tv-detail-activity-footer"><span><StarOutlineIcon /> {yourEpisodeRating.ratingCount ? `${formatCommunityRating(yourEpisodeRating.average)} · Rated` : 'Not rated'}</span><button type="button" onClick={() => scrollToSection('tv-reviews')}>Rate show</button></div></section><section id="tv-cast" className="content-section tv-detail-panel tv-detail-cast"><div className="section-header"><h2>Cast &amp; Crew</h2><span>View all</span></div><div className="tv-detail-cast-list">{show.credits.map((member) => <button type="button" className="tv-detail-cast-card" key={`${member.id}-${member.role}`} aria-label={`Open ${member.name}`} onClick={() => onOpenPerson?.(member)} disabled={!Number.isInteger(Number(member.id))}><div className="tv-detail-cast-avatar" style={buildMovieCreditAvatarStyle(member.profileUrl)}>{!member.profileUrl ? getMovieCreditInitials(member.name) : null}</div><strong>{member.name}</strong><small>{member.role}</small></button>)}</div></section></aside>
      <section id="tv-recommendations" className="content-section tv-detail-panel tv-detail-recommendations"><div className="section-header"><h2>More Like This</h2><span>View all</span></div><div className="tv-detail-recommendation-list">{show.recommendations.map((item) => <button key={item.id} type="button" onClick={() => onOpenTv(item)} className="tv-detail-recommendation"><img src={item.posterUrl} alt="" /><span>{item.title}</span><small>{item.rating}</small></button>)}</div></section>
      <section className="content-section tv-detail-panel tv-detail-facts"><DetailFactRow icon={DirectorIcon} label="Created by" value={show.creatorsLabel} /><DetailFactRow icon={LanguageIcon} label="Language" value={show.languagesLabel} /><DetailFactRow icon={TvIcon} label="Status" value={show.status} /><DetailFactRow icon={CalendarIcon} label="First air date" value={show.firstAirDateLabel} /></section>
      <section id="tv-reviews" className="content-section tv-detail-panel tv-detail-reviews"><div className="section-header"><h2>Community Reviews</h2></div>{tvReviewsState.status === 'loading' ? <SectionMessage message="Loading live community reviews..." /> : tvReviewsState.status === 'error' ? <SectionMessage tone="error" message={tvReviewsState.error} /> : tvReviewsState.reviews.length ? <div className="movie-detail-review-grid">{tvReviewsState.reviews.map((review) => <article key={review.id} className="movie-detail-review-card"><strong>{review.author}</strong><span className="movie-detail-stars">{review.rating ? `★ ${review.rating}` : 'No score'}</span><p>{review.copy}</p><small>{review.date}</small></article>)}</div> : <SectionMessage message="No community reviews available right now." />}</section></div>
    {trailer ? <MovieTrailerDialog movie={{ title: show.title }} trailer={trailer} onClose={() => setTrailer(null)} /> : null}
    {filelistState.open ? <FilelistDialog title={show.title} subtitle={filelistState.episode ? formatFilelistEpisodeLabel(filelistState.episode) : null} emptyMessage="No Filelist results found for this episode." state={filelistState} onClose={() => setFilelistState((state) => ({ ...state, open: false }))} /> : null}
    {catchUpEpisode ? <TvEpisodeCatchUpDialog episode={catchUpEpisode.episode} earlierCount={catchUpEpisode.earlierCount} isSaving={isUpdatingEpisodes} onCancel={() => setCatchUpEpisode(null)} onMarkCurrent={() => { setCatchUpEpisode(null); requestEpisodeWatch({ action: 'mark_episode', episodeId: catchUpEpisode.episode.id }, catchUpEpisode.episode) }} onMarkEarlier={() => { setCatchUpEpisode(null); requestEpisodeWatch({ action: 'mark_through_episode', episodeId: catchUpEpisode.episode.id }, catchUpEpisode.episode) }} /> : null}
    {pendingWatchRequest ? <WatchServiceDialog title={pendingWatchRequest.episodeToRate?.name || show.title} onCancel={() => setPendingWatchRequest(null)} onSelect={(watchService) => { const pending = pendingWatchRequest; setPendingWatchRequest(null); void updateEpisodes({ ...pending.request, watchService }, pending.episodeToRate) }} /> : null}
    {ratingEpisode ? <MovieRatingDialog movie={{ title: ratingEpisode.name }} selectedRating={selectedRating} onSelectRating={setSelectedRating} onCancel={() => setRatingEpisode(null)} onSubmit={async () => { if (await onSubmitEpisodeRating(ratingEpisode, selectedRating)) setRatingEpisode(null) }} isSaving={tvEpisodeRatingActionState.status === 'loading' && Number(tvEpisodeRatingActionState.episodeId) === Number(ratingEpisode.id)} error={tvEpisodeRatingActionState.status === 'error' && Number(tvEpisodeRatingActionState.episodeId) === Number(ratingEpisode.id) ? tvEpisodeRatingActionState.error : ''} kicker="Your Episode Rating" cancelLabel="Skip" /> : null}
  </section>
}

function WatchlistCard({ item, compact = false, onOpenItem, onRemove, onMarkComplete, onSetPriority }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const showPoster = Boolean(item.posterUrl) && !posterUnavailable
  const availabilitySignal = getWatchlistAvailabilitySignal(item)
  const decisionMeta = getWatchlistDecisionMeta(item)

  return (
    <article className={`watchlist-card${compact ? ' compact' : ''}`}>
      <button type="button" className="watchlist-card-button watchlist-card-open" onClick={() => onOpenItem(item)} aria-label={`Open ${item.title}`}>
      <div className={`watchlist-poster accent-${item.accent}${showPoster ? ' has-image' : ''}`}>
        {showPoster ? (
          <img
            src={item.posterUrl}
            alt={`${item.title} poster`}
            loading="lazy"
            onError={() => setPosterUnavailable(true)}
          />
        ) : null}
        <div className="watchlist-card-overlay" />
        <div className="watchlist-poster-top">
          <span className={`poster-badge${item.topSlot ? ' priority-rank' : ''}${item.checked ? ' checked' : ''}`}>{item.topSlot || (item.queuePosition ? `#${item.queuePosition}` : item.checked ? <CheckCircleIcon /> : <StarIcon />)}</span>
        </div>
        {item.seasonTag ? <span className="watchlist-season-tag">{item.seasonTag}</span> : null}
      </div>

      <div className="watchlist-card-copy">
        <span className={`watchlist-media-badge ${item.type === 'Movies' ? 'movie' : item.type === 'TV Shows' ? 'tv' : 'book'}`}>{item.type === 'Movies' ? 'Movie' : item.type === 'TV Shows' ? 'TV' : 'Book'}</span>
        <h3>{item.title}</h3>
        <p>
          {item.year} <span>•</span> {item.meta}
        </p>
        {availabilitySignal ? <p className="watchlist-availability-signal">{availabilitySignal}</p> : null}
        {decisionMeta ? <p className="watchlist-decision-meta">{decisionMeta}</p> : null}

        {item.progress ? (
          <div className="watchlist-progress-wrap">
            <div className="watchlist-progress-track">
              <span style={{ width: `${item.progress}%` }} />
            </div>
            <strong>{item.progressLabel}</strong>
          </div>
        ) : item.type === 'Books' ? (
          <div className="watchlist-card-footer"><span>{item.categoriesLabel}</span></div>
        ) : (
          <div className="watchlist-card-footer">
            <span className="star-rating">
              <StarIcon />
              {item.rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>
      </button>
      <div className="watchlist-card-hover-actions" aria-label={`Quick actions for ${item.title}`}>
        <button type="button" onClick={() => onMarkComplete(item)} title={item.type === 'Books' ? 'Mark read' : 'Mark watched'}><CheckIcon /></button>
        <div className="watchlist-card-priority">
          <button type="button" onClick={() => setPriorityOpen((open) => !open)} title="Set priority" aria-expanded={priorityOpen} aria-haspopup="menu">{item.topSlot || '★'}</button>
          {priorityOpen ? <div className="watchlist-card-priority-menu" role="menu">{[1, 2, 3].map((slot) => <button key={slot} type="button" role="menuitem" onClick={() => { setPriorityOpen(false); void onSetPriority(item, { topSlot: item.topSlot === slot ? null : slot }) }} aria-label={`${item.topSlot === slot ? 'Remove' : 'Set'} Top ${slot}`}>{slot}</button>)}</div> : null}
        </div>
        <button type="button" onClick={() => onRemove(item)} title="Remove from watchlist">×</button>
      </div>
    </article>
  )
}

function MovieDetailPage({
  movieDetailState,
  similarMoviesState,
  onBackToMovies,
  onOpenPerson,
  onOpenMovie,
  onToggleWatched,
  onToggleWatchlist,
  onToggleReleaseReminder,
  watchedActionState,
  watchedMovieIds,
  watchedMovies,
  watchlistActionState,
  watchlistMovieIds,
  onSubmitMovieRating,
  onOpenLogin,
  isSignedIn,
  user,
  movieRatingActionState,
  movieReleaseReminderActionState,
}) {
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false)
  const [isWatchServiceDialogOpen, setIsWatchServiceDialogOpen] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5)
  const [trailerState, setTrailerState] = useState({ status: 'idle', trailer: null, error: '' })
  const [filelistState, setFilelistState] = useState({ open: false, status: 'idle', results: [], error: '', minutesUntilReset: null })
  const [isOverflowOpen, setIsOverflowOpen] = useState(false)
  const [isCastExpanded, setIsCastExpanded] = useState(false)
  const [isStickyHeaderVisible, setIsStickyHeaderVisible] = useState(false)
  const heroRef = useRef(null)
  const overflowRef = useRef(null)

  useEffect(() => {
    setTrailerState({ status: 'idle', trailer: null, error: '' })
    setIsWatchServiceDialogOpen(false)
    setFilelistState({ open: false, status: 'idle', results: [], error: '', minutesUntilReset: null })
    setIsOverflowOpen(false)
    setIsCastExpanded(false)
    setIsStickyHeaderVisible(false)
  }, [movieDetailState.movie?.id])

  useEffect(() => {
    const heroElement = heroRef.current
    if (!movieDetailState.movie?.id || !heroElement || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => setIsStickyHeaderVisible(!entry.isIntersecting), { threshold: 0.08 })
    observer.observe(heroElement)
    return () => observer.disconnect()
  }, [movieDetailState.movie?.id])

  useEffect(() => {
    if (!isOverflowOpen) return undefined
    function handleDismiss(event) {
      if (event.type === 'keydown' && event.key === 'Escape') setIsOverflowOpen(false)
      if (event.type === 'mousedown' && !overflowRef.current?.contains(event.target)) setIsOverflowOpen(false)
    }
    document.addEventListener('keydown', handleDismiss)
    document.addEventListener('mousedown', handleDismiss)
    return () => {
      document.removeEventListener('keydown', handleDismiss)
      document.removeEventListener('mousedown', handleDismiss)
    }
  }, [isOverflowOpen])

  if (movieDetailState.status === 'loading' || movieDetailState.status === 'idle') {
    return (
      <section className="movie-detail-page">
        <SectionMessage message="Loading movie detail from your local database..." />
      </section>
    )
  }

  if (movieDetailState.status === 'hidden' || !movieDetailState.movie) {
    return (
      <section className="movie-detail-page">
        <SectionMessage message="Movie detail is not available yet." />
      </section>
    )
  }

  if (movieDetailState.status === 'error') {
    return (
      <section className="movie-detail-page">
        <SectionMessage message={`Could not load the movie detail. ${movieDetailState.error}`} tone="error" />
      </section>
    )
  }

  const movie = movieDetailState.movie
  const creditCards = buildMovieCreditCards(movie)
  const reviews = Array.isArray(movie.reviews) ? movie.reviews : []
  const detailYear = formatMovieYear(movie.releaseDate) !== 'Release TBA' ? formatMovieYear(movie.releaseDate) : movie.year
  const isInWatchlist = watchlistMovieIds.has(Number(movie.id))
  const watchedMovie = watchedMovies.find((item) => Number(item.id) === Number(movie.id)) ?? null
  const isWatched = watchedMovieIds.has(Number(movie.id))
  const isWatchlistUpdating = watchlistActionState.status === 'loading' && Number(watchlistActionState.movieId) === Number(movie.id)
  const isWatchedUpdating = watchedActionState.status === 'loading' && Number(watchedActionState.movieId) === Number(movie.id)
  const watchedLabel = watchedMovie?.watchedAt ? formatLongDate(watchedMovie.watchedAt) : 'Not yet'
  const communityRating = movie.communityRating ?? emptyCommunityRating
  const communityRatingLabel = formatCommunityRating(communityRating.average)
  const yourRatingLabel = formatCommunityRating(communityRating.yourScore)
  const isRatingSaving = movieRatingActionState.status === 'loading' && Number(movieRatingActionState.movieId) === Number(movie.id)
  const isUpcoming = Boolean(movie.releaseDate && movie.releaseDate > getCurrentIsoDate())
  const isReleaseReminderUpdating = movieReleaseReminderActionState.status === 'loading' && Number(movieReleaseReminderActionState.movieId) === Number(movie.id)
  const releaseReminderTiming = isUpcoming ? `${movie.releaseDateLabel} · ${formatMovieCountdown(movie.releaseDate)}` : ''
  const releaseContext = isUpcoming ? `Releases ${releaseReminderTiming}` : movie.releaseDate ? `Released ${movie.releaseDateLabel}` : 'Release date TBA'
  const visibleCreditCards = isCastExpanded ? creditCards : creditCards.slice(0, 5)
  const backdropStyle = movie.backdropUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(7, 10, 18, 0.96) 0%, rgba(7, 10, 18, 0.74) 30%, rgba(7, 10, 18, 0.34) 62%, rgba(7, 10, 18, 0.68) 100%), url(${movie.backdropUrl})`,
      }
    : undefined

  async function handleOpenTrailer() {
    setTrailerState({ status: 'loading', trailer: null, error: '' })

    try {
      const response = await fetch(`/api/movies/${movie.id}/trailer`)
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load a trailer right now.')
      }

      setTrailerState({ status: 'success', trailer: payload.trailer, error: '' })
    } catch (error) {
      setTrailerState({
        status: 'error',
        trailer: null,
        error: error instanceof Error ? error.message : 'Unable to load a trailer right now.',
      })
    }
  }

  function closeTrailer() {
    setTrailerState({ status: 'idle', trailer: null, error: '' })
  }

  function openRating() {
    if (!isSignedIn) {
      onOpenLogin()
      return
    }

    setSelectedRating(communityRating.yourScore ?? 5)
    setIsRatingDialogOpen(true)
  }

  function handlePrimaryAction() {
    if (!isInWatchlist) {
      onToggleWatchlist(movie)
      return
    }

    if (!isWatched) {
      setIsWatchServiceDialogOpen(true)
      return
    }

    openRating()
  }

  function scrollToMovieSection(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleOpenFilelist() {
    setFilelistState({ open: true, status: 'loading', results: [], error: '', minutesUntilReset: null })
    try {
      const response = await fetch(`/api/movies/${movie.id}/filelist`, { headers: buildAuthHeaders(user) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setFilelistState({ open: true, status: response.status === 429 ? 'rate-limit' : 'error', results: [], error: payload.error || `Request failed with status ${response.status}`, minutesUntilReset: payload.minutesUntilReset ?? null })
        return
      }
      setFilelistState({ open: true, status: 'success', results: Array.isArray(payload.results) ? payload.results : [], error: '', minutesUntilReset: null })
    } catch (error) { setFilelistState({ open: true, status: 'error', results: [], error: error instanceof Error ? error.message : 'Unable to search Filelist right now.', minutesUntilReset: null }) }
  }

  const isTrailerLoading = trailerState.status === 'loading'
  const primaryActionLabel = !isInWatchlist
    ? isWatchlistUpdating ? 'Updating...' : 'Add to Watchlist'
    : !isWatched
      ? isWatchedUpdating ? 'Updating...' : 'Mark as Watched'
      : communityRating.yourScore === null ? 'Rate' : 'Update Rating'
  const isPrimaryActionDisabled = !isInWatchlist ? isWatchlistUpdating : !isWatched ? isWatchedUpdating : false


  return (
    <section className="movie-detail-page">
      <nav className="movie-detail-breadcrumb desktop-only" aria-label="Breadcrumb">
        <button type="button" onClick={onBackToMovies}>Movies</button>
        <span className="movie-detail-breadcrumb-separator" aria-hidden="true">/</span>
        <span className="movie-detail-breadcrumb-current" aria-current="page" title={movie.title}>{movie.title}</span>
      </nav>
      <button type="button" className="movie-detail-back mobile-only" onClick={onBackToMovies}>
        <ChevronLeftIcon />
      </button>

      <article ref={heroRef} id="movie-details" className="movie-detail-hero" style={backdropStyle}>
        <div className="movie-detail-hero-overlay" />

        <div className="movie-detail-poster-wrap">
          <MoviePosterFrame movie={movie} />
          <button type="button" className="movie-detail-trailer-badge" aria-label={isTrailerLoading ? 'Loading trailer...' : `Play trailer for ${movie.title}`} onClick={handleOpenTrailer} disabled={isTrailerLoading}>
            <PlayIcon />
          </button>
        </div>

        <div className="movie-detail-main">
          <h1>{movie.title}</h1>
          <div className="movie-detail-meta">
            <span>{detailYear}</span>
            <span>{movie.genresLabel}</span>
            <span>{movie.certification}</span>
            <span>{movie.runtime}</span>
          </div>

          <div className="movie-score-comparison" aria-label="Movie ratings">
            <div className="movie-score-source tmdb"><StarIcon /><div><span>TMDB</span><strong>{movie.score}</strong></div><small>{movie.audience}</small></div>
            <div className="movie-score-source audience"><TomatoIcon /><div><span>Audience score</span><strong>{movie.tomatoScore}</strong></div><small>Derived from TMDB</small></div>
            <div className="movie-score-source watchvault"><UserRatingIcon /><div><span>WatchVault</span><strong>{communityRatingLabel}</strong></div><small>{communityRating.voteCount} {communityRating.voteCount === 1 ? 'rating' : 'ratings'}</small></div>
          </div>

          <button type="button" className="movie-review-preview" onClick={() => scrollToMovieSection('movie-reviews')}>
            <StarOutlineIcon />
            <span>{communityRating.voteCount ? `${communityRatingLabel} from ${communityRating.voteCount} WatchVault ${communityRating.voteCount === 1 ? 'rating' : 'ratings'}` : 'No WatchVault ratings yet — be the first to rate'}</span>
          </button>

          <p className="movie-detail-summary">{movie.overview}</p>

          <section className="movie-why-watch" aria-labelledby="movie-why-watch-title">
            <h2 id="movie-why-watch-title">Why watch?</h2>
            <div className="movie-why-watch-list">
              <div><span>Genre</span><strong>{movie.genresLabel}</strong></div>
              <div><span>Runtime</span><strong>{movie.runtime}</strong></div>
              <div><span>Release</span><strong>{releaseContext}</strong></div>
              <div><span>Availability</span><strong>{movie.availability}</strong></div>
            </div>
          </section>

          <div className="movie-detail-actions">
            <button
              type="button"
              className="primary-button movie-detail-primary"
              onClick={handlePrimaryAction}
              disabled={isPrimaryActionDisabled}
            >
              {!isInWatchlist ? <PlusIcon /> : !isWatched ? <CheckIcon /> : <StarOutlineIcon />}
              <span>{primaryActionLabel}</span>
            </button>
            <button type="button" className="secondary-button movie-detail-secondary ghost desktop-only" onClick={handleOpenTrailer} disabled={isTrailerLoading}>
              <PlayIcon />
              <span>{isTrailerLoading ? 'Loading...' : 'Trailer'}</span>
            </button>
            <div ref={overflowRef} className="movie-action-overflow">
              <button type="button" className="secondary-button movie-detail-secondary ghost movie-action-overflow-trigger" aria-expanded={isOverflowOpen} aria-haspopup="menu" onClick={() => setIsOverflowOpen((open) => !open)}><MoreIcon /><span>More</span></button>
              {isOverflowOpen ? <div className="movie-action-overflow-menu" role="menu">
                <button type="button" role="menuitem" className="mobile-only" onClick={() => { setIsOverflowOpen(false); void handleOpenTrailer() }} disabled={isTrailerLoading}><PlayIcon /><span>{isTrailerLoading ? 'Loading trailer...' : 'Trailer'}</span></button>
                {isInWatchlist && !isWatched ? <button type="button" role="menuitem" onClick={() => { setIsOverflowOpen(false); onToggleWatchlist(movie) }}><BookmarkIcon /><span>Remove from Watchlist</span></button> : null}
                {isWatched ? <button type="button" role="menuitem" onClick={() => { setIsOverflowOpen(false); onToggleWatched(movie) }}><ReplayIcon /><span>Mark as Unwatched</span></button> : null}
                {isUpcoming ? <button type="button" role="menuitem" onClick={() => { setIsOverflowOpen(false); onToggleReleaseReminder(movie) }} disabled={isReleaseReminderUpdating}><BellIcon /><span>{isReleaseReminderUpdating ? 'Updating...' : `${movie.hasReleaseReminder ? 'Cancel reminder' : 'Remind me'} · ${releaseReminderTiming}`}</span></button> : null}
                <button type="button" role="menuitem" className="movie-filelist-menu-action" onClick={() => { setIsOverflowOpen(false); void handleOpenFilelist() }}><span>Filelist</span></button>
              </div> : null}
            </div>
          </div>
          {trailerState.status === 'error' ? <p className="movie-trailer-error" role="alert">{trailerState.error}</p> : null}
        </div>

        <aside className="movie-detail-status desktop-only">
          <h2>Your timeline</h2>
          <div className="movie-detail-timeline">
            <div className="movie-detail-timeline-item movie-detail-status-item-watchlist">
              <span className="movie-detail-status-icon" aria-hidden="true"><BookmarkStatusIcon /></span>
              <div>
                <span>Watchlist</span>
                <strong>{isInWatchlist ? 'Saved' : 'Not yet'}</strong>
              </div>
            </div>
            <div className="movie-detail-timeline-item movie-detail-status-item-watched">
              <span className="movie-detail-status-icon" aria-hidden="true"><WatchedStatusIcon /></span>
              <div>
                <span>Watched</span>
                <strong>{watchedLabel}</strong>
              </div>
            </div>
            <div className="movie-detail-timeline-item movie-detail-status-item-rating">
              <span className="movie-detail-status-icon" aria-hidden="true"><StarOutlineIcon /></span>
              <div>
                <span>Your Rating</span>
                <strong>{yourRatingLabel}</strong>
              </div>
            </div>
          </div>
        </aside>
      </article>

      {isStickyHeaderVisible ? <div className="movie-detail-sticky-header" role="region" aria-label={`${movie.title} quick actions`}>
        <div className={`movie-detail-sticky-poster${movie.posterUrl ? ' has-image' : ''}`} style={movie.posterUrl ? { backgroundImage: `url(${movie.posterUrl})` } : undefined} />
        <div className="movie-detail-sticky-copy"><strong>{movie.title}</strong><span>{communityRatingLabel} WatchVault</span></div>
        <button type="button" className="primary-button movie-detail-sticky-action" onClick={handlePrimaryAction} disabled={isPrimaryActionDisabled}>{!isInWatchlist ? <PlusIcon /> : !isWatched ? <CheckIcon /> : <StarOutlineIcon />}<span>{primaryActionLabel}</span></button>
      </div> : null}

      {isRatingDialogOpen ? (
        <MovieRatingDialog
          movie={movie}
          selectedRating={selectedRating}
          onSelectRating={setSelectedRating}
          onCancel={() => setIsRatingDialogOpen(false)}
          onSubmit={async () => {
            const saved = await onSubmitMovieRating(movie, selectedRating)
            if (saved) setIsRatingDialogOpen(false)
          }}
          isSaving={isRatingSaving}
          error={movieRatingActionState.status === 'error' && Number(movieRatingActionState.movieId) === Number(movie.id) ? movieRatingActionState.error : ''}
        />
      ) : null}

      {isWatchServiceDialogOpen ? <WatchServiceDialog title={movie.title} onCancel={() => setIsWatchServiceDialogOpen(false)} onSelect={async (watchService) => { const saved = await onToggleWatched(movie, watchService); setIsWatchServiceDialogOpen(false); if (saved) { setSelectedRating(communityRating.yourScore ?? 5); setIsRatingDialogOpen(true) } }} /> : null}

      {trailerState.status === 'success' && trailerState.trailer ? (
        <MovieTrailerDialog movie={movie} trailer={trailerState.trailer} onClose={closeTrailer} />
      ) : null}

      {filelistState.open ? <FilelistDialog title={movie.title} state={filelistState} onClose={() => setFilelistState((state) => ({ ...state, open: false }))} /> : null}

      <div className="movie-detail-grid">
        <section id="movie-cast" className="content-section movie-detail-panel movie-detail-cast-panel">
          <div className="section-header">
            <h2>Cast &amp; Crew</h2>
            {creditCards.length > 5 ? <button type="button" className="section-link" onClick={() => setIsCastExpanded((expanded) => !expanded)}>{isCastExpanded ? 'Show less' : `View full cast (${creditCards.length})`}</button> : null}
          </div>
          <div className="movie-detail-cast">
            {creditCards.length > 0 ? (
              visibleCreditCards.map((member) => (
                <button
                  key={`${member.name}-${member.role}`}
                  type="button"
                  className="movie-detail-cast-card movie-detail-cast-card-button"
                  aria-label={`Open ${member.name}`}
                  onClick={() => onOpenPerson?.(member)}
                  disabled={!Number.isInteger(Number(member.id))}
                >
                  <div
                    className="movie-detail-cast-avatar"
                    style={buildMovieCreditAvatarStyle(member.profileUrl)}
                    aria-label={member.name}
                  >
                    {!member.profileUrl ? getMovieCreditInitials(member.name) : null}
                  </div>
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </button>
              ))
            ) : (
              <p className="movie-detail-cast-empty">Cast details are not available for this movie yet.</p>
            )}
          </div>
        </section>

        <section id="movie-activity" className="content-section movie-detail-panel movie-detail-activity">
          <div className="section-header">
            <h2>Your Activity</h2>
          </div>
          {isWatched ? <div className="movie-detail-activity-grid">
            <div className="movie-detail-activity-item">
              <CalendarIcon />
              <div>
                <span>Watched on</span>
                <strong>{watchedLabel}</strong>
              </div>
            </div>
            <div className="movie-detail-activity-item">
              <ProgressIcon />
              <div>
                <span>Progress</span>
                <div className="movie-detail-progress">
                  <span style={{ width: isWatched ? '100%' : '0%' }} />
                </div>
              </div>
              <strong>{isWatched ? '100%' : '0%'}</strong>
            </div>
            <div className="movie-detail-activity-item">
              <ReplayIcon />
              <div>
                <span>Rewatch Count</span>
                <strong>{isWatched ? '1 time' : '0 times'}</strong>
              </div>
            </div>
            <div className="movie-detail-activity-item">
              <NotesIcon />
              <div>
                <span>Notes</span>
                <strong>Completed and saved to your watch history.</strong>
              </div>
            </div>
          </div> : <div className="movie-detail-activity-empty"><ProgressIcon /><div><strong>Ready when you are</strong><span>Mark watched to start your history and keep your rating close at hand.</span></div><button type="button" className="secondary-button" onClick={() => setIsWatchServiceDialogOpen(true)}>Mark as Watched</button></div>}
        </section>

        <section id="movie-similar" className="content-section movie-detail-panel movie-detail-more-like-this">
          <div className="section-header">
            <h2>More Like This</h2>
          </div>
          <SimilarMoviesGrid similarMoviesState={similarMoviesState} onOpenMovie={onOpenMovie} />
        </section>

        <section id="movie-reviews" className="content-section movie-detail-panel movie-detail-reviews">
          <div className="section-header">
            <h2>Community Reviews</h2>
          </div>
          {reviews.length > 0 ? (
            <div className="movie-detail-review-grid">
              {reviews.map((review) => (
                <article key={review.id || `${review.author}-${review.date}`} className="movie-detail-review-card">
                  <div className="movie-detail-review-header">
                    <div className="movie-detail-review-author">
                      <div className="avatar small">{review.author.charAt(0)}</div>
                      <span>{review.author}</span>
                    </div>
                    <div className="movie-detail-review-rating">
                      <span className="movie-detail-stars">{review.rating ? '★★★★★' : 'No score'}</span>
                      {review.rating ? <strong>{review.rating}</strong> : null}
                    </div>
                  </div>
                  <p>{review.copy}</p>
                  <div className="movie-detail-review-meta">
                    <span>{review.date}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="movie-detail-cast-empty">No community reviews available right now.</p>
          )}
        </section>
      </div>
    </section>
  )
}

function getFilelistTvEpisodeTarget(show) {
  const episodes = (show?.seasons ?? [])
    .filter((season) => Number(season.seasonNumber) > 0)
    .flatMap((season) => (season.episodes ?? []).map((episode) => ({ ...episode, seasonNumber: Number(season.seasonNumber) })))
    .sort((left, right) => left.seasonNumber - right.seasonNumber || Number(left.episodeNumber) - Number(right.episodeNumber))
  if (!episodes.some((episode) => episode.watched)) return episodes.find((episode) => episode.seasonNumber === 1 && Number(episode.episodeNumber) === 1) ?? null
  return episodes.find((episode) => episode.isAired && !episode.watched) ?? null
}

function formatFilelistEpisodeLabel(episode) {
  return `S${episode.seasonNumber} E${episode.episodeNumber}${episode.name ? ` · ${episode.name}` : ''}`
}

function FilelistDialog({ title, subtitle = null, emptyMessage = 'No Filelist results found for this movie.', state, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return <div className="movie-rating-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="movie-rating-dialog filelist-dialog" role="dialog" aria-modal="true" aria-labelledby="filelist-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="movie-trailer-dialog-header"><div><p className="movie-rating-dialog-kicker">Filelist</p><h2 id="filelist-dialog-title">{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div><button type="button" className="movie-trailer-close" onClick={onClose} aria-label="Close Filelist results">×</button></div>
      {state.status === 'loading' ? <SectionMessage message="Searching Filelist..." /> : null}
      {state.status === 'rate-limit' ? <p className="filelist-dialog-error" role="alert">Wait {state.minutesUntilReset} minutes until the next reset.</p> : null}
      {state.status === 'error' ? <p className="filelist-dialog-error" role="alert">{state.error}</p> : null}
      {state.status === 'success' && !state.results.length ? <SectionMessage message={emptyMessage} /> : null}
      {state.status === 'success' && state.results.length ? <div className="filelist-result-list">{state.results.map((result, index) => <article className="filelist-result" key={`${result.downloadLink}-${index}`}><div><strong>{result.name}</strong><span>{result.category} · {result.uploadDate || 'Upload date unavailable'}</span></div><a className="secondary-button" href={result.downloadLink}>Download</a></article>)}</div> : null}
    </section>
  </div>
}

function MovieTrailerDialog({ movie, trailer, onClose }) {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1`

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="movie-trailer-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="movie-trailer-dialog" role="dialog" aria-modal="true" aria-labelledby="movie-trailer-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="movie-trailer-dialog-header">
          <div>
            <p className="movie-rating-dialog-kicker">{trailer.provider}</p>
            <h2 id="movie-trailer-dialog-title">{trailer.name} — {movie.title}</h2>
          </div>
          <button type="button" className="movie-trailer-close" onClick={onClose} aria-label="Close trailer">×</button>
        </div>
        <iframe
          className="movie-trailer-player"
          src={embedUrl}
          title={`${movie.title} trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </section>
    </div>
  )
}

function TvEpisodeCatchUpDialog({ episode, earlierCount, isSaving, onCancel, onMarkCurrent, onMarkEarlier }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSaving) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onCancel])

  return (
    <div className="movie-rating-dialog-backdrop" role="presentation" onMouseDown={isSaving ? undefined : onCancel}>
      <section className="movie-rating-dialog tv-catch-up-dialog" role="dialog" aria-modal="true" aria-labelledby="tv-catch-up-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="movie-rating-dialog-kicker">Catch up on this series</p>
        <h2 id="tv-catch-up-dialog-title">Mark earlier episodes too?</h2>
        <p>There {earlierCount === 1 ? 'is' : 'are'} {earlierCount} earlier aired {earlierCount === 1 ? 'episode' : 'episodes'} not yet marked watched before “{episode.name}”.</p>
        <div className="movie-rating-dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>Cancel</button>
          <button type="button" className="secondary-button" onClick={onMarkCurrent} disabled={isSaving}>This episode only</button>
          <button type="button" className="primary-button" onClick={onMarkEarlier} disabled={isSaving}><CheckIcon /><span>{isSaving ? 'Updating...' : 'Mark earlier episodes too'}</span></button>
        </div>
      </section>
    </div>
  )
}

function WatchServiceDialog({ title, onCancel, onSelect }) {
  const [service, setService] = useState('')
  const [isOther, setIsOther] = useState(false)

  return <div className="movie-rating-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
    <section className="movie-rating-dialog" role="dialog" aria-modal="true" aria-labelledby="watch-service-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <p className="movie-rating-dialog-kicker">Watch service</p>
      <h2 id="watch-service-dialog-title">Where did you watch {title}?</h2>
      <p>This is optional and helps build your streaming stats.</p>
      <div className="movie-rating-options" role="radiogroup" aria-label="Watch service">
        {watchServiceOptions.map((option) => <button key={option} type="button" className={`movie-rating-option${service === option && !isOther ? ' selected' : ''}`} role="radio" aria-checked={service === option && !isOther} onClick={() => { setService(option); setIsOther(false) }}>{option}</button>)}
        <button type="button" className={`movie-rating-option${isOther ? ' selected' : ''}`} role="radio" aria-checked={isOther} onClick={() => { setService(''); setIsOther(true) }}>Other</button>
      </div>
      {isOther ? <input className="watch-service-other-input" autoFocus value={service} maxLength={80} placeholder="Service name" onChange={(event) => setService(event.target.value)} /> : null}
      <div className="movie-rating-dialog-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="button" className="secondary-button" onClick={() => onSelect(null)}>Skip</button><button type="button" className="primary-button" onClick={() => onSelect(service)} disabled={!service.trim()}><CheckIcon /><span>Mark watched</span></button></div>
    </section>
  </div>
}

function BookReadingFormatDialog({ book, isSaving, onCancel, onSelect }) {
  const [readingFormat, setReadingFormat] = useState('')
  const [metadata, setMetadata] = useState({})
  const [tropes, setTropes] = useState('')
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSaving) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSaving, onCancel])

  return <div className="movie-rating-dialog-backdrop" role="presentation" onMouseDown={isSaving ? undefined : onCancel}>
    <section className="movie-rating-dialog" role="dialog" aria-modal="true" aria-labelledby="book-reading-format-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <p className="movie-rating-dialog-kicker">Reading format</p>
      <h2 id="book-reading-format-dialog-title">What format did you read {book.title} in?</h2>
      <p>Choose a format and optionally record details that count toward your book achievements.</p>
      <div className="movie-rating-options" role="radiogroup" aria-label="Reading format">
        {[['physical', 'Physical'], ['ebook', 'Ebook'], ['audiobook', 'Audiobook']].map(([value, label]) => <button key={value} type="button" className={`movie-rating-option${readingFormat === value ? ' selected' : ''}`} role="radio" aria-checked={readingFormat === value} onClick={() => setReadingFormat(value)} disabled={isSaving}>{label}</button>)}
      </div>
      <div className="book-completion-checklist">{bookCompletionFields.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(metadata[key])} onChange={(event) => setMetadata((state) => ({ ...state, [key]: event.target.checked }))} />{label}</label>)}</div>
      <input className="book-completion-tropes" value={tropes} maxLength={300} placeholder="Tropes (optional, comma separated)" onChange={(event) => setTropes(event.target.value)} />
      <div className="movie-rating-dialog-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>Cancel</button><button type="button" className="primary-button" onClick={() => onSelect(readingFormat, { ...metadata, tropes: tropes.split(',').map((item) => item.trim()).filter(Boolean) })} disabled={isSaving || !readingFormat}><CheckIcon /><span>{isSaving ? 'Saving...' : 'Save'}</span></button></div>
    </section>
  </div>
}

function MovieRatingDialog({ movie, selectedRating, onSelectRating, onCancel, onSubmit, isSaving, error, kicker = 'Your WatchVault Rating', cancelLabel = 'Cancel' }) {
  return (
    <div className="movie-rating-dialog-backdrop" role="presentation" onMouseDown={isSaving ? undefined : onCancel}>
      <section className="movie-rating-dialog" role="dialog" aria-modal="true" aria-labelledby="movie-rating-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="movie-rating-dialog-kicker">{kicker}</p>
        <h2 id="movie-rating-dialog-title">Rate {movie.title}</h2>
        <p>Select a score from 1 to 5.</p>
        <div className="movie-rating-options" role="radiogroup" aria-label="Rating score">
          {movieRatingOptions.map((score) => (
            <button
              key={score}
              type="button"
              className={`movie-rating-option${selectedRating === score ? ' selected' : ''}`}
              role="radio"
              aria-checked={selectedRating === score}
              onClick={() => onSelectRating(score)}
              disabled={isSaving}
            >
              <StarIcon />
              {score.toFixed(1)}
            </button>
          ))}
        </div>
        {error ? <p className="movie-rating-dialog-error" role="alert">{error}</p> : null}
        <div className="movie-rating-dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>{cancelLabel}</button>
          <button type="button" className="primary-button" onClick={onSubmit} disabled={isSaving}>
            <StarIcon />
            <span>{isSaving ? 'Saving...' : 'Save Rating'}</span>
          </button>
        </div>
      </section>
    </div>
  )
}

function MoviePosterFrame({ movie }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(movie.posterUrl) && !posterUnavailable

  return (
    <div className={`movie-detail-poster ${showPosterImage ? 'has-image' : 'theme-dune-hero'}`}>
      {showPosterImage ? (
        <img
          src={movie.posterUrl}
          alt={`${movie.title} poster`}
          className="movie-detail-poster-image"
          onError={() => setPosterUnavailable(true)}
        />
      ) : null}
    </div>
  )
}

function PersonDetailPage({ personDetailState, onBackToMovies, onOpenMovie, onOpenTv, onOpenPerson, isSignedIn, onOpenLogin, onToggleMovieWatchlist, onToggleMovieWatched, onToggleTvWatchlist, onToggleTvWatched, favoriteActorIds, onToggleFavorite }) {
  const filmographyPageSize = 5
  const [filmographyRole, setFilmographyRole] = useState('all')
  const [filmographyMedia, setFilmographyMedia] = useState('all')
  const [filmographyDecade, setFilmographyDecade] = useState('all')
  const [filmographySort, setFilmographySort] = useState('popular')
  const [visibleFilmographyCount, setVisibleFilmographyCount] = useState(filmographyPageSize)
  const [isLinkCopied, setIsLinkCopied] = useState(false)
  const shareFeedbackTimer = useRef(null)
  const personId = personDetailState.person?.id
  const filmography = personDetailState.filmography ?? []

  useEffect(() => {
    setFilmographyRole('all')
    setFilmographyMedia('all')
    setFilmographyDecade('all')
    setFilmographySort('popular')
  }, [personId])

  useEffect(() => {
    setVisibleFilmographyCount(filmographyPageSize)
  }, [personId, filmographyRole, filmographyMedia, filmographyDecade, filmographySort])

  useEffect(() => () => window.clearTimeout(shareFeedbackTimer.current), [])

  if (personDetailState.status === 'loading' || personDetailState.status === 'idle') {
    return (
      <section className="person-detail-page">
        <SectionMessage message="Loading actor and director detail from TMDB..." />
      </section>
    )
  }

  if (personDetailState.status === 'hidden' || !personDetailState.person) {
    return (
      <section className="person-detail-page">
        <SectionMessage message="Person detail is not available yet." />
      </section>
    )
  }

  if (personDetailState.status === 'error') {
    return (
      <section className="person-detail-page">
        <SectionMessage message={`Could not load the person detail. ${personDetailState.error}`} tone="error" />
      </section>
    )
  }

  const { person, knownFor, coStars, facts, personalHistory } = personDetailState
  const isFavorite = favoriteActorIds.has(Number(person.id))
  const decades = [...new Set(filmography.map((item) => item.decade).filter(Boolean))].sort((left, right) => Number(right.slice(0, 4)) - Number(left.slice(0, 4)))
  const filteredFilmography = filmography
    .filter((item) => filmographyRole === 'all' || item.creditCategories.includes(filmographyRole))
    .filter((item) => filmographyMedia === 'all' || item.mediaType === filmographyMedia)
    .filter((item) => filmographyDecade === 'all' || item.decade === filmographyDecade)
    .sort((left, right) => comparePersonFilmography(left, right, filmographySort, isSignedIn))
  const visibleFilmography = filteredFilmography.slice(0, visibleFilmographyCount)
  const hasMoreFilmography = filteredFilmography.length > visibleFilmography.length
  const heroStyle = person.heroBackdropUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(7, 10, 18, 0.98) 0%, rgba(7, 10, 18, 0.78) 28%, rgba(7, 10, 18, 0.4) 62%, rgba(7, 10, 18, 0.84) 100%), url(${person.heroBackdropUrl})`,
      }
    : undefined

  async function handleShare() {
    const shareData = {
      title: `${person.name} | WatchVault`,
      text: `Check out ${person.name} on WatchVault.`,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }

      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable')
      await navigator.clipboard.writeText(shareData.url)
      setIsLinkCopied(true)
      window.clearTimeout(shareFeedbackTimer.current)
      shareFeedbackTimer.current = window.setTimeout(() => setIsLinkCopied(false), 2000)
    } catch {
      // Dismissing the native share dialog should not affect the detail page.
    }
  }

  return (
    <section className="person-detail-page">
      <nav className="movie-detail-breadcrumb desktop-only" aria-label="Breadcrumb">
        <button type="button" onClick={onBackToMovies}>Movies</button>
        <span className="movie-detail-breadcrumb-separator" aria-hidden="true">/</span>
        <span>Actors</span>
        <span className="movie-detail-breadcrumb-separator" aria-hidden="true">/</span>
        <span className="movie-detail-breadcrumb-current" aria-current="page">{person.name}</span>
      </nav>
      <button type="button" className="movie-detail-back mobile-only" onClick={onBackToMovies}>
        <ChevronLeftIcon />
      </button>

      <article className="person-detail-hero" style={heroStyle}>
        <div className="movie-detail-hero-overlay" />

        <div className="person-detail-portrait-wrap">
          <div className="person-detail-portrait" style={buildMovieCreditAvatarStyle(person.profileUrl)}>
            {!person.profileUrl ? <span>{getMovieCreditInitials(person.name)}</span> : null}
          </div>
        </div>

        <div className="person-detail-main">
          <div className="person-detail-title-row">
            <h1>{person.name}</h1>
          </div>

          <div className="person-detail-role-list">
            {(Array.isArray(person.roles) && person.roles.length > 0 ? person.roles : [person.knownForDepartment]).map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>

          <div className="person-detail-stat-row">
            <MetricBadge icon={GlobeIcon} value={person.knownForDepartment} label="Career role" tone="gold" />
            <MetricBadge icon={AwardIcon} value={String(filmography.length)} label="Credits" tone="tomato" />
            <MetricBadge icon={CheckIcon} value={isSignedIn ? String(personalHistory?.titlesWatched ?? 0) : '—'} label={isSignedIn ? 'Titles watched' : 'Sign in for history'} tone="violet" />
          </div>

          <p className="person-detail-summary">{person.biography}</p>

          <div className="movie-detail-actions">
            <button type="button" className="secondary-button movie-detail-secondary" onClick={() => onToggleFavorite(person)}>
              <StarOutlineIcon />
              <span>{isFavorite ? 'Favorited' : isSignedIn ? 'Favorite' : 'Sign in to Favorite'}</span>
            </button>
            <button type="button" className="secondary-button movie-detail-secondary ghost" onClick={handleShare}>
              <ShareIcon />
              <span>{isLinkCopied ? 'Link copied' : 'Share'}</span>
            </button>
            {isLinkCopied ? <span className="person-share-feedback" role="status">Link copied</span> : null}
          </div>
        </div>

        <aside className="person-detail-facts">
          <h2>Quick Facts</h2>
          <div className="person-detail-facts-list">
            {facts.map((fact) => (
              <div key={fact.label} className="person-detail-fact">
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </aside>
      </article>

      <section className="content-section movie-detail-panel person-history-panel">
        <div className="section-header">
          <h2>Your history with {person.name}</h2>
        </div>
        {!isSignedIn ? (
          <div className="person-history-empty"><p>Sign in to see the titles, ratings, and watch time you share with {person.name}.</p><button type="button" className="secondary-button" onClick={onOpenLogin}>Sign in</button></div>
        ) : personalHistory ? (
          <div className="person-history-layout">
            <div className="person-history-metrics">
              <div><span>Titles watched</span><strong>{personalHistory.titlesWatched}</strong></div>
              <div><span>Average rating</span><strong>{personalHistory.averageRating === null ? 'Not rated' : `${personalHistory.averageRating.toFixed(1)} / 5`}</strong></div>
              <div><span>Hours watched</span><strong>{personalHistory.hoursWatched.toFixed(1)} h</strong></div>
            </div>
            {personalHistory.nextRecommendation ? (
              <button type="button" className="person-history-recommendation" onClick={() => personalHistory.nextRecommendation.mediaType === 'tv' ? onOpenTv?.(personalHistory.nextRecommendation) : onOpenMovie?.(personalHistory.nextRecommendation)}>
                <div className={`person-history-recommendation-poster${personalHistory.nextRecommendation.posterUrl ? ' has-image' : ''}`}>{personalHistory.nextRecommendation.posterUrl ? <img src={personalHistory.nextRecommendation.posterUrl} alt="" /> : null}</div>
                <span><small>Next unwatched pick</small><strong>{personalHistory.nextRecommendation.title}</strong><em>{personalHistory.nextRecommendation.year} · {personalHistory.nextRecommendation.mediaType === 'tv' ? 'TV' : 'Movie'}</em></span>
                <ChevronRight />
              </button>
            ) : <div className="person-history-empty"><p>You have watched every released title currently available for this person.</p></div>}
          </div>
        ) : <SectionMessage message="Your history is not available yet." />}
      </section>

      <div className="person-detail-grid">
        <section className="content-section movie-detail-panel">
          <div className="section-header">
            <h2>Known For</h2>
          </div>
          <div className="person-detail-known-for">
            {knownFor.length > 0 ? (
              knownFor.map((item) => (
                <MovieCard key={`known-${item.mediaType}-${item.id}`} movie={{ ...item, meta: `${item.mediaType === 'tv' ? 'TV' : 'Movie'} · ${item.knownForReason}`, genreLabel: item.meta }} onOpenMovie={item.mediaType === 'tv' ? onOpenTv : onOpenMovie} />
              ))
            ) : (
              <div className="person-discovery-empty"><p>{filmography[0] ? `Explore other actors from ${filmography[0].title}.` : 'Explore movies to discover more actors.'}</p><button type="button" className="secondary-button" onClick={() => filmography[0] ? (filmography[0].mediaType === 'tv' ? onOpenTv?.(filmography[0]) : onOpenMovie?.(filmography[0])) : onBackToMovies()}>{filmography[0] ? `Explore ${filmography[0].title}` : 'Browse movies'}</button></div>
            )}
          </div>
        </section>

        <div className="person-detail-split">
          <section className="content-section movie-detail-panel">
            <div className="section-header">
              <h2>Filmography <span className="person-detail-filmography-count">{visibleFilmography.length} of {filteredFilmography.length}</span></h2>
            </div>
            {filmography.length > 0 ? (
              <>
                <div className="person-detail-filmography-filters" aria-label="Filmography filters">
                  <div className="person-detail-filter-tabs" role="group" aria-label="Credit type">
                    {[['all', 'All'], ['acting', 'Acting'], ['directing', 'Directing'], ['producing', 'Producing']].map(([value, label]) => <button key={value} type="button" className={filmographyRole === value ? 'active' : ''} onClick={() => setFilmographyRole(value)}>{label}</button>)}
                  </div>
                  <div className="person-detail-filter-tabs" role="group" aria-label="Media type">
                    {[['all', 'All'], ['movie', 'Movies'], ['tv', 'TV']].map(([value, label]) => <button key={value} type="button" className={filmographyMedia === value ? 'active' : ''} onClick={() => setFilmographyMedia(value)}>{label}</button>)}
                  </div>
                  <label className="person-detail-filter-select"><span>Decade</span><select value={filmographyDecade} onChange={(event) => setFilmographyDecade(event.target.value)}><option value="all">All decades</option>{decades.map((decade) => <option key={decade} value={decade}>{decade}</option>)}</select></label>
                  <label className="person-detail-filter-select"><span>Sort</span><select value={filmographySort} onChange={(event) => setFilmographySort(event.target.value)}><option value="popular">Most popular</option><option value="newest">Newest</option><option value="rated">Highest rated</option><option value="oldest">Oldest</option><option value="unwatched">Unwatched by me</option></select></label>
                </div>
                <div className="person-detail-filmography">
                  {visibleFilmography.map((item) => (
                    <article
                      key={`film-${item.mediaType}-${item.id}`}
                      className="person-detail-filmography-row"
                    >
                      <div className="person-filmography-timeline-marker"><span>{item.year}</span><i /></div>
                      <button type="button" className="person-detail-filmography-title" onClick={() => item.mediaType === 'tv' ? onOpenTv?.(item) : onOpenMovie?.(item)}>
                        <div className={`person-detail-filmography-poster${item.posterUrl ? ' has-image' : ` ${item.theme}`}`}>
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt={`${item.title} poster`}
                              className="movie-card-poster-image"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="person-detail-filmography-copy">
                          <strong>{item.title}</strong>
                          <span className="person-filmography-media-badge">{item.mediaType === 'tv' ? <TvIcon /> : <ClapperIcon />}{item.mediaType === 'tv' ? 'TV' : 'Movie'}</span>
                        </div>
                      </button>
                      <span className="person-detail-filmography-role">{item.role}</span>
                      <span className="star-rating person-detail-filmography-rating">
                        <StarIcon />
                        {item.rating}
                      </span>
                      <div className="person-detail-filmography-personal" aria-label={`Your status for ${item.title}`}>
                        {item.personal.watchlisted ? <span className="person-filmography-state saved">Saved</span> : null}
                        {item.personal.watched ? <span className="person-filmography-state watched">Watched</span> : null}
                        {item.personal.yourScore !== null ? <span className="person-filmography-state rated">{item.mediaType === 'tv' ? `${item.personal.yourScore.toFixed(1)} · ${item.personal.ratingCount} eps` : `${item.personal.yourScore.toFixed(1)} rated`}</span> : null}
                      </div>
                      <div className="person-detail-filmography-quick-actions">
                        <button type="button" className={`quick-media-action${item.personal.watchlisted ? ' is-active' : ''}`} onClick={() => { if (!isSignedIn) return onOpenLogin(); return item.mediaType === 'tv' ? onToggleTvWatchlist(item) : onToggleMovieWatchlist(item) }} aria-label={`${item.personal.watchlisted ? 'Remove' : 'Save'} ${item.title}`} title={item.personal.watchlisted ? 'Remove from watchlist' : 'Save to watchlist'}><BookmarkIcon /></button>
                        <button type="button" className={`quick-media-action${item.personal.watched ? ' is-active watched' : ''}`} onClick={() => { if (!isSignedIn) return onOpenLogin(); return item.mediaType === 'tv' ? onToggleTvWatched(item) : onToggleMovieWatched(item) }} aria-label={`${item.personal.watched ? 'Mark' : 'Mark'} ${item.title} as ${item.personal.watched ? 'unwatched' : 'watched'}`} title={item.personal.watched ? 'Mark as unwatched' : 'Mark as watched'}><CheckIcon /></button>
                      </div>
                    </article>
                  ))}
                </div>
                {visibleFilmography.length === 0 ? <SectionMessage message="No credits match these filters." /> : null}
                {hasMoreFilmography ? <div className="person-detail-filmography-actions"><button type="button" className="secondary-button" onClick={() => setVisibleFilmographyCount((count) => count + filmographyPageSize)}>Load 5 more</button></div> : null}
              </>
            ) : (
              <div className="person-discovery-empty"><p>{knownFor[0] ? `Explore other actors from ${knownFor[0].title}.` : 'Explore movies to discover more actors.'}</p><button type="button" className="secondary-button" onClick={() => knownFor[0] ? (knownFor[0].mediaType === 'tv' ? onOpenTv?.(knownFor[0]) : onOpenMovie?.(knownFor[0])) : onBackToMovies()}>{knownFor[0] ? `Explore ${knownFor[0].title}` : 'Browse movies'}</button></div>
            )}
          </section>

          <section className="content-section movie-detail-panel">
            <div className="section-header">
              <h2>Co-stars</h2>
            </div>
            <div className="person-detail-costars person-detail-costars-rail">
              {coStars.length > 0 ? (
                coStars.map((member) => (
                  <button
                    key={`co-${member.id}`}
                    type="button"
                    className="movie-detail-cast-card movie-detail-cast-card-button"
                    aria-label={`Open ${member.name}`}
                    onClick={() => onOpenPerson?.(member)}
                    disabled={!Number.isInteger(Number(member.id))}
                  >
                    <div
                      className="movie-detail-cast-avatar"
                      style={buildMovieCreditAvatarStyle(member.profileUrl)}
                      aria-label={member.name}
                    >
                      {!member.profileUrl ? getMovieCreditInitials(member.name) : null}
                    </div>
                    <h3>{member.name}</h3>
                    <p>{member.sharedCredits} shared {member.sharedCredits === 1 ? 'film' : 'films'}{member.sharedTitles.length ? ` · ${member.sharedTitles.join(', ')}` : ''}</p>
                  </button>
                ))
              ) : (
                <div className="person-discovery-empty"><p>{knownFor[0] ? `Explore other actors from ${knownFor[0].title}.` : 'Explore more actors from the movie catalog.'}</p><button type="button" className="secondary-button" onClick={() => knownFor[0] ? (knownFor[0].mediaType === 'tv' ? onOpenTv?.(knownFor[0]) : onOpenMovie?.(knownFor[0])) : onBackToMovies()}>{knownFor[0] ? `Explore ${knownFor[0].title}` : 'Browse movies'}</button></div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}

function comparePersonFilmography(left, right, sort, isSignedIn) {
  const date = (item) => Date.parse(item.releaseDate || '') || 0
  const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : -1
  if (sort === 'newest') return date(right) - date(left) || numeric(right.popularity) - numeric(left.popularity)
  if (sort === 'oldest') return date(left) - date(right) || numeric(right.popularity) - numeric(left.popularity)
  if (sort === 'rated') return numeric(right.voteAverage) - numeric(left.voteAverage) || date(right) - date(left)
  if (sort === 'unwatched' && isSignedIn) return Number(left.personal.watched) - Number(right.personal.watched) || date(right) - date(left)
  return numeric(right.popularity) - numeric(left.popularity) || date(right) - date(left)
}

function MetricBadge({ icon: Icon, value, label, tone }) {
  return (
    <div className={`movie-detail-metric ${tone}`}>
      <div className="movie-detail-metric-value">
        <Icon />
        <strong>{value}</strong>
      </div>
      <span>{label}</span>
    </div>
  )
}

function DetailFactRow({ icon: Icon, label, value }) {
  return (
    <div className="movie-detail-fact-row">
      <div className="movie-detail-fact-label">
        <Icon />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <ChevronRight />
    </div>
  )
}

function AchievementsScreen({ isSignedIn, state }) {
  const [category, setCategory] = useState('All')
  const [status, setStatus] = useState('all')
  if (!isSignedIn) return <section className="achievements-page"><h1>Achievements</h1><SectionMessage message="Sign in to start tracking achievements." /></section>
  const categories = ['All', ...new Set(state.achievements.map((item) => item.category))]
  const visible = state.achievements.filter((item) => (category === 'All' || item.category === category) && (status === 'all' || (status === 'unlocked' ? item.unlocked : !item.unlocked)))
  return <section className="achievements-page"><div className="achievements-heading"><div><h1>Achievements</h1><p>Only activity recorded after achievement tracking began counts toward progress.</p></div><b>{state.achievements.filter((item) => item.unlocked).length} unlocked</b></div><div className="achievement-filters"><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All badges</option><option value="unlocked">Unlocked</option><option value="locked">Locked</option></select></div>{state.status === 'loading' ? <SectionMessage message="Loading achievements..." /> : state.status === 'error' ? <SectionMessage tone="error" message={state.error} /> : <div className="achievement-grid">{visible.map((item) => <article key={item.id} className={`achievement-card${item.unlocked ? ' unlocked' : ''}${item.availability === 'coming_soon' ? ' coming-soon' : ''}`}><div className="achievement-card-icon">{item.unlocked ? <TrophyIcon /> : <LockIcon />}</div><div><span className="achievement-category">{item.category} · {item.rarity}</span><h2>{item.secret && !item.unlocked ? item.name : item.name}</h2><p>{item.secret && !item.unlocked ? 'Keep watching to discover this secret achievement.' : item.description}</p>{item.availability === 'coming_soon' ? <em>Coming soon</em> : <><div className="achievement-progress"><i style={{ width: `${Math.min(100, ((item.progress?.current ?? 0) / Math.max(1, item.progress?.target ?? 1)) * 100)}%` }} /></div><small>{item.unlocked ? `Unlocked ${formatLongDate(item.unlockedAt)}` : `${item.progress?.current ?? 0} / ${item.progress?.target ?? 0}`}</small></>}</div></article>)}</div>}</section>
}

function StatsAchievementsTab({ isSignedIn, state }) {
  if (!isSignedIn) return <section className="stats-achievements-tab"><SectionMessage message="Sign in to track your achievements." /></section>
  if (state?.status === 'loading' || state?.status === 'idle') return <section className="stats-achievements-tab"><SectionMessage message="Loading achievements..." /></section>
  if (state?.status === 'error') return <section className="stats-achievements-tab"><SectionMessage tone="error" message={state.error || 'Unable to load achievements right now.'} /></section>

  const items = Array.isArray(state?.achievements) ? state.achievements : []
  const inProgress = items.filter((item) => item.availability === 'active' && !item.unlocked && Number(item.progress?.current) > 0)
  const incomplete = items.filter((item) => !item.unlocked && !inProgress.includes(item))
  const completed = items.filter((item) => item.unlocked)
  const sections = [
    { title: 'In Progress', description: 'Achievements you are actively working toward.', items: inProgress, empty: 'No achievements are in progress yet.' },
    { title: 'Incomplete', description: 'Start these next, including badges coming in a future update.', items: incomplete, empty: 'No incomplete achievements right now.' },
    { title: 'Completed', description: 'Your unlocked achievements.', items: completed, empty: 'No achievements completed yet.' },
  ]

  return <section className="stats-achievements-tab">{sections.map((section) => <section className="stats-achievement-section" key={section.title}><div className="stats-watched-movies-heading"><div><h2>{section.title}</h2><p>{section.description}</p></div><span>{section.items.length}</span></div>{section.items.length ? <div className="achievement-grid stats-achievement-grid">{section.items.map((item) => <AchievementCard key={item.id} item={item} />)}</div> : <SectionMessage message={section.empty} />}</section>)}</section>
}

function BookAchievementsTab({ isSignedIn, state }) {
  return <StatsAchievementsTab isSignedIn={isSignedIn} state={state} />
}

function AchievementCard({ item }) {
  const progress = item.progress ?? { current: 0, target: 0 }
  const progressPercent = Math.min(100, (Number(progress.current) / Math.max(1, Number(progress.target))) * 100)
  return <article className={`achievement-card${item.unlocked ? ' unlocked' : ''}${item.availability === 'coming_soon' ? ' coming-soon' : ''}`}><div className="achievement-card-icon">{item.unlocked ? <TrophyIcon /> : <LockIcon />}</div><div><span className="achievement-category">{item.category} · {item.rarity}</span><h2>{item.name}</h2><p>{item.secret && !item.unlocked ? 'Keep watching to discover this secret achievement.' : item.description}</p>{item.availability === 'coming_soon' ? <em>Coming soon</em> : <><div className="achievement-progress"><i style={{ width: `${progressPercent}%` }} /></div><small>{item.unlocked ? `Unlocked ${formatLongDate(item.unlockedAt)}` : `${progress.current} / ${progress.target}`}</small></>}</div></article>
}

function StatsScreen({ initialTab = 'Overview', movieStats, movieStatsStatus, watchedState, readBooksState, tvWatchedHistoryState, playedGamesState, isSignedIn, statsPeriod, tvStats, tvStatsStatus, onStatsPeriodChange, insightsState, bookStatsState, achievementsState, bookAchievementsState, gameAchievementsState, onOpenMovie, onOpenPerson, onOpenTvShow, onOpenGame, onOpenBook, achievements = [], onOpenAchievements, enabledSections = defaultEnabledSections }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [movieHistoryPage, setMovieHistoryPage] = useState(1)
  const [tvHistoryPage, setTvHistoryPage] = useState(1)
  const [gameHistoryPage, setGameHistoryPage] = useState(1)
  const [bookHistoryPage, setBookHistoryPage] = useState(1)
  const tabs = statsTabs.filter((tab) => !tab.section || enabledSections.includes(tab.section))
  const period = statsPeriods.find((option) => option.value === statsPeriod) ?? statsPeriods[1]
  const metricCards = buildStatsDashboardMetrics({ movieStats, tvStats })
  const isLoading = movieStatsStatus === 'loading' || tvStatsStatus === 'loading'
  const insights = insightsState.insights
  const activityBuckets = insights.activity.buckets
  const activityMaxMinutes = Math.max(...activityBuckets.map((bucket) => bucket.totalMinutes), 0)
  const activityAxisLabels = buildActivityAxisLabels(activityMaxMinutes)
  const mediaEventTotal = insights.mediaSplit.movieEvents + insights.mediaSplit.tvEpisodeEvents
  const movieShare = mediaEventTotal ? Math.round((insights.mediaSplit.movieEvents / mediaEventTotal) * 100) : null
  const topGenreMinutes = Math.max(...insights.genres.map((genre) => genre.minutes), 0)
  const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const watchedMovies = watchedState.movies
  const movieHistoryPageCount = Math.max(1, Math.ceil(watchedMovies.length / statsWatchedMoviesPageSize))
  const visibleWatchedMovies = watchedMovies.slice((movieHistoryPage - 1) * statsWatchedMoviesPageSize, movieHistoryPage * statsWatchedMoviesPageSize)
  const movieHistoryPagination = {
    page: movieHistoryPage,
    pageSize: statsWatchedMoviesPageSize,
    hasPreviousPage: movieHistoryPage > 1,
    hasNextPage: movieHistoryPage < movieHistoryPageCount,
  }
  const tvHistoryPageCount = Math.max(1, Math.ceil(tvWatchedHistoryState.episodes.length / statsWatchedMoviesPageSize))
  const visibleTvHistoryEpisodes = tvWatchedHistoryState.episodes.slice((tvHistoryPage - 1) * statsWatchedMoviesPageSize, tvHistoryPage * statsWatchedMoviesPageSize)
  const tvHistoryPagination = {
    page: tvHistoryPage,
    pageSize: statsWatchedMoviesPageSize,
    hasPreviousPage: tvHistoryPage > 1,
    hasNextPage: tvHistoryPage < tvHistoryPageCount,
  }
  const playedGames = playedGamesState.games
  const gameHistoryPageCount = Math.max(1, Math.ceil(playedGames.length / statsWatchedMoviesPageSize))
  const visiblePlayedGames = playedGames.slice((gameHistoryPage - 1) * statsWatchedMoviesPageSize, gameHistoryPage * statsWatchedMoviesPageSize)
  const gameHistoryPagination = {
    page: gameHistoryPage,
    pageSize: statsWatchedMoviesPageSize,
    hasPreviousPage: gameHistoryPage > 1,
    hasNextPage: gameHistoryPage < gameHistoryPageCount,
  }
  const readBooks = readBooksState.books
  const bookHistoryPageCount = Math.max(1, Math.ceil(readBooks.length / statsWatchedMoviesPageSize))
  const visibleReadBooks = readBooks.slice((bookHistoryPage - 1) * statsWatchedMoviesPageSize, bookHistoryPage * statsWatchedMoviesPageSize)
  const bookHistoryPagination = {
    page: bookHistoryPage,
    pageSize: statsWatchedMoviesPageSize,
    hasPreviousPage: bookHistoryPage > 1,
    hasNextPage: bookHistoryPage < bookHistoryPageCount,
  }

  useEffect(() => {
    setMovieHistoryPage((page) => Math.min(page, movieHistoryPageCount))
  }, [movieHistoryPageCount])

  useEffect(() => {
    setTvHistoryPage((page) => Math.min(page, tvHistoryPageCount))
  }, [tvHistoryPageCount])

  useEffect(() => {
    setGameHistoryPage((page) => Math.min(page, gameHistoryPageCount))
  }, [gameHistoryPageCount])

  useEffect(() => {
    setBookHistoryPage((page) => Math.min(page, bookHistoryPageCount))
  }, [bookHistoryPageCount])

  useEffect(() => {
    if (!statsTabs.some((tab) => tab.label === activeTab && (!tab.section || enabledSections.includes(tab.section)))) setActiveTab('Overview')
  }, [activeTab, enabledSections])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  return (
    <section className="stats-page">
      <div className="stats-page-heading">
        <div>
          <h1>Stats</h1>
          <p>Track your watching habits, trends, and milestones.</p>
        </div>
        <div className="stats-page-period">
          <button type="button" className="stats-period-button" aria-haspopup="menu" aria-expanded={periodOpen} onClick={() => setPeriodOpen((open) => !open)}>
            {period.label}<CalendarIcon />
          </button>
          {periodOpen ? (
            <div className="stats-page-period-menu" role="menu">
              {statsPeriods.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === period.value} className={option.value === period.value ? 'active' : ''} onClick={() => { onStatsPeriodChange(option.value); setPeriodOpen(false) }}>{option.label}</button>)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="stats-tabs" role="tablist" aria-label="Stats categories">
        {tabs.map((tab) => <button key={tab.label} type="button" role="tab" aria-selected={tab.label === activeTab} className={tab.label === activeTab ? 'active' : ''} onClick={() => { setActiveTab(tab.label); if (tab.label === 'Movies') setMovieHistoryPage(1); if (tab.label === 'TV Shows') setTvHistoryPage(1); if (tab.label === 'Games') setGameHistoryPage(1); if (tab.label === 'Books') setBookHistoryPage(1) }}>{tab.label}</button>)}
      </div>

      {activeTab === 'Achievements' ? <StatsAchievementsTab isSignedIn={isSignedIn} state={achievementsState} /> : activeTab === 'Book achievements' ? <BookAchievementsTab isSignedIn={isSignedIn} state={bookAchievementsState} /> : activeTab === 'Game achievements' ? <StatsAchievementsTab isSignedIn={isSignedIn} state={gameAchievementsState} /> : activeTab === 'Movies' ? (
        <section className="stats-watched-movies">
          <div className="stats-watched-movies-heading">
            <div>
              <h2>Watched Movies</h2>
              <p>Every movie you have marked as watched, newest first.</p>
            </div>
            {watchedState.status === 'success' ? <span>{watchedMovies.length} {watchedMovies.length === 1 ? 'movie' : 'movies'}</span> : null}
          </div>
          {watchedState.status === 'loading' || watchedState.status === 'idle' ? <SectionMessage message="Loading watched movies..." /> : null}
          {watchedState.status === 'error' ? <SectionMessage tone="error" message={watchedState.error || 'Unable to load your watched movies right now.'} /> : null}
          {watchedState.status === 'success' && watchedMovies.length === 0 ? <SectionMessage message="You have not marked any movies as watched yet." /> : null}
          {watchedState.status === 'success' && watchedMovies.length > 0 ? <>
            <div className="popular-movies-catalog stats-watched-movies-grid">
              {visibleWatchedMovies.map((movie) => <StatsWatchedMovieCard key={movie.id} movie={movie} onOpenMovie={onOpenMovie} />)}
            </div>
            <PaginationControls pagination={movieHistoryPagination} onPageChange={setMovieHistoryPage} />
          </> : null}
        </section>
      ) : activeTab === 'TV Shows' ? (
        <section className="stats-watched-tv">
          <div className="stats-watched-movies-heading">
            <div>
              <h2>Watched Episodes</h2>
              <p>Every episode you have marked as watched, newest first.</p>
            </div>
            {tvWatchedHistoryState.status === 'success' ? <span>{tvWatchedHistoryState.episodes.length} {tvWatchedHistoryState.episodes.length === 1 ? 'episode' : 'episodes'}</span> : null}
          </div>
          {!isSignedIn ? <SectionMessage message="Sign in to view your watched episode history." /> : null}
          {isSignedIn && (tvWatchedHistoryState.status === 'loading' || tvWatchedHistoryState.status === 'idle') ? <SectionMessage message="Loading watched episodes..." /> : null}
          {isSignedIn && tvWatchedHistoryState.status === 'error' ? <SectionMessage tone="error" message={tvWatchedHistoryState.error || 'Unable to load your watched episode history right now.'} /> : null}
          {isSignedIn && tvWatchedHistoryState.status === 'success' && tvWatchedHistoryState.episodes.length === 0 ? <SectionMessage message="You have not marked any TV episodes as watched yet." /> : null}
          {isSignedIn && tvWatchedHistoryState.status === 'success' && visibleTvHistoryEpisodes.length > 0 ? <>
            <div className="stats-tv-history-list">
              {visibleTvHistoryEpisodes.map((episode) => <StatsWatchedTvEpisode key={episode.episodeId} episode={episode} onOpenTvShow={onOpenTvShow} />)}
            </div>
            <PaginationControls pagination={tvHistoryPagination} onPageChange={setTvHistoryPage} />
          </> : null}
        </section>
      ) : activeTab === 'Games' ? (
        <section className="stats-watched-movies">
          <div className="stats-watched-movies-heading">
            <div><h2>Played Games</h2><p>Every game you have marked as played, newest first.</p></div>
            {playedGamesState.status === 'success' ? <span>{playedGames.length} {playedGames.length === 1 ? 'game' : 'games'}</span> : null}
          </div>
          {!isSignedIn ? <SectionMessage message="Sign in to view your played game history." /> : null}
          {isSignedIn && (playedGamesState.status === 'loading' || playedGamesState.status === 'idle') ? <SectionMessage message="Loading played games..." /> : null}
          {isSignedIn && playedGamesState.status === 'error' ? <SectionMessage tone="error" message={playedGamesState.error || 'Unable to load your played games right now.'} /> : null}
          {isSignedIn && playedGamesState.status === 'success' && playedGames.length === 0 ? <SectionMessage message="You have not marked any games as played yet." /> : null}
          {isSignedIn && playedGamesState.status === 'success' && visiblePlayedGames.length > 0 ? <>
            <div className="games-card-grid stats-watched-games-grid">{visiblePlayedGames.map((game) => <StatsPlayedGameCard key={game.id} game={game} onOpenGame={onOpenGame} />)}</div>
            <PaginationControls pagination={gameHistoryPagination} onPageChange={setGameHistoryPage} />
          </> : null}
        </section>
      ) : activeTab === 'Books' ? (
        <section className="stats-watched-movies">
          <div className="stats-watched-movies-heading">
            <div><h2>Read Books</h2><p>Every book you have marked as read, newest first.</p></div>
            {readBooksState.status === 'success' ? <span>{readBooks.length} {readBooks.length === 1 ? 'book' : 'books'}</span> : null}
          </div>
          {!isSignedIn ? <SectionMessage message="Sign in to view your read book history." /> : null}
          {isSignedIn && (readBooksState.status === 'loading' || readBooksState.status === 'idle') ? <SectionMessage message="Loading read books..." /> : null}
          {isSignedIn && readBooksState.status === 'error' ? <SectionMessage tone="error" message={readBooksState.error || 'Unable to load your read books right now.'} /> : null}
          {isSignedIn && readBooksState.status === 'success' && readBooks.length === 0 ? <SectionMessage message="You have not marked any books as read yet." /> : null}
          {isSignedIn && readBooksState.status === 'success' && visibleReadBooks.length > 0 ? <>
            <div className="movie-card-grid popular-movies-catalog stats-watched-movies-grid">{visibleReadBooks.map((book) => <StatsReadBookCard key={book.id} book={book} onOpenBook={onOpenBook} />)}</div>
            <PaginationControls pagination={bookHistoryPagination} onPageChange={setBookHistoryPage} />
          </> : null}
        </section>
      ) : activeTab === 'Book stats' ? (
        <BookStatsDashboard isSignedIn={isSignedIn} state={bookStatsState} onOpenBook={onOpenBook} />
      ) : <>
      <div className="stats-metric-grid">
        {metricCards.map(({ icon: Icon, label, value, suffix, tone }) => (
          <article key={label} className={`stats-metric-card ${tone}`}>
            <div className="stats-metric-icon"><Icon /></div>
            <div><span>{label}</span><strong>{value}<small>{suffix}</small></strong>{isLoading ? <p>Loading stats...</p> : null}</div>
          </article>
        ))}
      </div>

      <div className="stats-insights-grid">
        <section className="stats-surface stats-activity-card">
          <StatsSectionTitle title="Watching Activity" />
          {insightsState.status === 'loading' ? <SectionMessage message="Loading watching activity..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : activityMaxMinutes === 0 ? <SectionMessage message="No watch activity in this period yet." /> : <><div className="stats-chart-axis">{activityAxisLabels.map((label) => <span key={label}>{label}</span>)}</div><div className="stats-activity-bars" style={{ '--bar-count': activityBuckets.length }}>{activityBuckets.map((bucket) => <div key={bucket.label} className="stats-activity-bar-wrap"><span style={{ height: `${Math.max(3, (bucket.totalMinutes / activityMaxMinutes) * 100)}%` }} title={`${bucket.label}: ${formatMinutesAsHoursAndMinutes(bucket.totalMinutes)}`} /><small>{bucket.label}</small></div>)}</div></>}
        </section>

        <section className="stats-surface stats-donut-card">
          <StatsSectionTitle title="Movies vs TV Shows" />
          {insightsState.status === 'loading' ? <SectionMessage message="Loading media split..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : <><div className={`stats-donut${mediaEventTotal ? '' : ' empty'}`} aria-label={mediaEventTotal ? `${movieShare} percent movies, ${100 - movieShare} percent TV episodes` : 'No watch events in this period'} style={mediaEventTotal ? { '--movie-share': `${movieShare}%` } : undefined}><span>{movieShare === null ? '—' : `${movieShare}%`}</span></div><div className="stats-donut-legend"><span><i className="movies" />Movies <b>{insights.mediaSplit.movieEvents}</b></span><span><i className="shows" />TV Episodes <b>{insights.mediaSplit.tvEpisodeEvents}</b></span></div></>}
        </section>

        <section className="stats-surface stats-genres-card">
          <StatsSectionTitle title="Top Genres" />
          {insightsState.status === 'loading' ? <SectionMessage message="Loading genres..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : insights.genres.length === 0 ? <SectionMessage message="No genre data in this period yet." /> : <div className="stats-genre-list">{insights.genres.map((genre) => <div key={genre.name}><span>{genre.name}</span><div><i style={{ width: `${(genre.minutes / topGenreMinutes) * 100}%` }} /></div><b>{formatCompactMinutes(genre.minutes)}</b></div>)}</div>}
        </section>

        <section className="stats-surface stats-habits-card">
          <StatsSectionTitle title="Weekly Habits" />
          {insightsState.status === 'loading' ? <SectionMessage message="Loading watch habits..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : insights.habits.bestWeekdayIndex === null ? <SectionMessage message="No watch habits in this period yet." /> : <><p className="stats-label-copy">Best Days</p><div className="stats-weekdays">{weekdayLabels.map((day, index) => <span key={`${day}-${index}`} className={index === insights.habits.bestWeekdayIndex ? 'active' : ''}>{day}</span>)}</div><p className="stats-highlight-copy">{weekdayNames[insights.habits.bestWeekdayIndex]} is your top day!</p><p className="stats-label-copy">Peak Watch Time</p><strong className="stats-peak-time"><ClockIcon />{formatPeakWatchWindow(insights.habits.peakWindow)}</strong><p className="stats-small-copy">That’s your prime time.</p></>}
        </section>
      </div>

      <div className="stats-detail-grid">
        <section className="stats-surface stats-rated-card">
          <StatsSectionTitle title="Top Rated This Month" />
          {insightsState.status === 'loading' ? <SectionMessage message="Loading your top-rated titles..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : insights.topRatedThisMonth.length === 0 ? <SectionMessage message="No ratings this month yet." /> : <div className="stats-rated-list">{insights.topRatedThisMonth.map((item) => <StatsTitleRow key={`${item.mediaType}-${item.id}`} item={item} onOpenMovie={onOpenMovie} onOpenTvShow={onOpenTvShow} />)}</div>}
        </section>
        <section className="stats-surface stats-actors-card"><StatsSectionTitle title="Most Watched Actors" />{insightsState.status === 'loading' ? <SectionMessage message="Loading watched actors..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : insights.mostWatchedActors.length === 0 ? <SectionMessage message="No watched cast data in this period yet." /> : <div className="stats-actors-list">{insights.mostWatchedActors.map((actor, index) => <button type="button" className="stats-actor-row" key={actor.personId} onClick={() => onOpenPerson(actor)} aria-label={`Open ${actor.name}`}><span className={`stats-actor-avatar${actor.profileUrl ? ' has-image' : ''}`} style={actor.profileUrl ? { backgroundImage: `url(${actor.profileUrl})` } : { '--avatar-color': statsActorColors[index % statsActorColors.length] }}>{!actor.profileUrl ? actor.name.split(' ').map((name) => name[0]).join('').slice(0, 2) : null}</span><p><b>{actor.name}</b><small>{actor.titleCount} {actor.titleCount === 1 ? 'title' : 'titles'}</small></p><em>#{index + 1}</em></button>)}</div>}</section>
        <section className="stats-surface stats-platforms-card"><StatsSectionTitle title="Streaming Platforms" />{insightsState.status === 'loading' ? <SectionMessage message="Loading streaming platforms..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : insights.streamingPlatforms.length === 0 ? <SectionMessage message="No watch services recorded in this period yet." /> : <div className="stats-platform-list">{insights.streamingPlatforms.map((platform) => <div key={platform.name}><span className="stats-platform-mark">{platform.name.slice(0, 1).toUpperCase()}</span><p><b>{platform.name}</b><i><span style={{ width: `${platform.percent}%` }} /></i></p><strong>{formatMinutesAsHoursAndMinutes(platform.minutes)}<small>{platform.percent}%</small></strong></div>)}</div>}</section>
        <section className="stats-surface stats-achievements-card"><StatsSectionTitle title="Achievements" action="View all" onAction={onOpenAchievements} /><div className="stats-achievement-list">{achievements.filter((item) => item.unlocked || item.availability === 'active').slice(0, 3).map((achievement) => <div key={achievement.id}><span className="stats-achievement-icon"><TrophyIcon /></span><p><b>{achievement.unlocked ? achievement.name : 'In progress'}</b><small>{achievement.unlocked ? achievement.description : achievement.name}</small></p><strong>{achievement.unlocked ? 'Unlocked' : `${achievement.progress?.current ?? 0} / ${achievement.progress?.target ?? '—'}`}</strong>{achievement.unlocked ? <CheckIcon /> : null}</div>)}{achievements.length === 0 ? <SectionMessage message="Start watching to begin earning achievements." /> : null}</div></section>
      </div>

      <div className="stats-bottom-grid">
        <section className="stats-surface stats-history-card"><StatsSectionTitle title="Recent History" action="View all" />{insightsState.status === 'loading' ? <SectionMessage message="Loading recent history..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : insights.recentHistory.length === 0 ? <SectionMessage message="No watch history yet." /> : <div className="stats-history-list">{insights.recentHistory.map((item) => <button type="button" className="stats-history-item" key={`${item.mediaType}-${item.id}-${item.watchedAt}`} onClick={() => item.mediaType === 'tv' ? onOpenTvShow(item) : onOpenMovie(item)} aria-label={`Open ${item.title}`}><div className="stats-title-art">{item.posterUrl ? <img src={item.posterUrl} alt={`${item.title} poster`} loading="lazy" /> : null}</div><b>{item.title}</b><small>{item.mediaType === 'tv' ? `TV Episode · S${item.seasonNumber} E${item.episodeNumber}` : 'Movie'}</small><em>{formatRelativeTime(item.watchedAt)}</em></button>)}</div>}</section>
        <section className="stats-surface stats-review-card"><StatsSectionTitle title="Year in Review" />{insightsState.status === 'loading' ? <SectionMessage message="Loading your year in review..." /> : insightsState.status === 'error' ? <SectionMessage tone="error" message={insightsState.error} /> : <><div className="stats-review-metrics"><span>Titles Watched<b>{insights.yearInReview.titlesWatched}</b></span><span>Hours Watched<b>{formatCompactMinutes(insights.yearInReview.minutes)}</b></span><span>Episodes Watched<b>{insights.yearInReview.episodesWatched}</b></span><span>Avg Rating<b>{insights.yearInReview.averageRating?.toFixed(1) ?? '—'} <small>/5</small></b></span></div><div className="stats-review-highlights"><span>Top Genre<b>{insights.yearInReview.topGenre || '—'}</b></span><span>Longest Streak<b>{insights.yearInReview.longestStreak ? `${insights.yearInReview.longestStreak} days` : '—'}</b></span><span>Most Watched Month<b>{insights.yearInReview.mostWatchedMonth || '—'}</b></span><span>New Favorites<b>{insights.yearInReview.newFavorites}</b></span></div><p>{insights.yearInReview.titlesWatched ? 'Keep watching, you’re building an amazing year.' : 'Start watching to build your year in review.'}</p></>}</section>
      </div>
      </>}
    </section>
  )
}

function BookStatsDashboard({ isSignedIn, state, onOpenBook }) {
  if (!isSignedIn) return <section className="book-stats-dashboard"><SectionMessage message="Sign in to view your reading stats." /></section>
  if (state.status === 'loading' || state.status === 'idle') return <section className="book-stats-dashboard"><SectionMessage message="Loading your book stats..." /></section>
  if (state.status === 'error') return <section className="book-stats-dashboard"><SectionMessage tone="error" message={state.error || 'Unable to load your book stats right now.'} /></section>
  const { metrics, formats, activity, categories, authors, topRated, recentReads } = state.stats
  const maxPages = Math.max(...activity.buckets.map((bucket) => bucket.pagesRead), 0)
  const maxCategoryBooks = Math.max(...categories.map((category) => category.bookCount), 0)
  const metricCards = [
    { label: 'Books Read', value: String(metrics.booksRead), tone: 'violet', icon: BookmarkIcon },
    { label: 'Pages Read', value: metrics.pagesRead.toLocaleString(), tone: 'blue', icon: BarsIcon },
    { label: 'In Reading List', value: String(metrics.watchlistCount), tone: 'orange', icon: BookmarkStackIcon },
    { label: 'Average Rating', value: metrics.averageRating === null ? '—' : metrics.averageRating.toFixed(1), suffix: '/5', tone: 'gold', icon: StarOutlineIcon },
  ]
  return <section className="book-stats-dashboard">
    <div className="stats-metric-grid">{metricCards.map(({ icon: Icon, label, value, suffix, tone }) => <article key={label} className={`stats-metric-card ${tone}`}><div className="stats-metric-icon"><Icon /></div><div><span>{label}</span><strong>{value}<small>{suffix}</small></strong></div></article>)}</div>
    <div className="book-stats-main-grid">
      <section className="stats-surface stats-activity-card"><StatsSectionTitle title="Reading Activity" />{maxPages === 0 ? <SectionMessage message="No books read in this period yet." /> : <><div className="stats-chart-axis">{buildBookActivityAxisLabels(maxPages).map((label) => <span key={label}>{label}</span>)}</div><div className="stats-activity-bars" style={{ '--bar-count': activity.buckets.length }}>{activity.buckets.map((bucket) => <div key={bucket.label} className="stats-activity-bar-wrap"><span style={{ height: `${Math.max(3, (bucket.pagesRead / maxPages) * 100)}%` }} title={`${bucket.label}: ${bucket.pagesRead.toLocaleString()} pages across ${bucket.booksRead} ${bucket.booksRead === 1 ? 'book' : 'books'}`} /><small>{bucket.label}</small></div>)}</div></>}</section>
      <section className="stats-surface stats-genres-card"><StatsSectionTitle title="Top Categories" />{categories.length === 0 ? <SectionMessage message="No category data in this period yet." /> : <div className="stats-genre-list">{categories.map((category) => <div key={category.name}><span>{category.name}</span><div><i style={{ width: `${(category.bookCount / maxCategoryBooks) * 100}%` }} /></div><b>{category.bookCount} {category.bookCount === 1 ? 'book' : 'books'}</b></div>)}</div>}</section>
    </div>
    <section className="stats-surface book-stats-format-card"><StatsSectionTitle title="Reading Formats" /><div className="book-stats-format-list"><div><span>Physical</span><b>{formats.physical}</b></div><div><span>Ebook</span><b>{formats.ebook}</b></div><div><span>Audiobook</span><b>{formats.audiobook}</b></div></div></section>
    <div className="book-stats-detail-grid">
      <section className="stats-surface stats-rated-card"><StatsSectionTitle title="Top Rated Books" />{topRated.length === 0 ? <SectionMessage message="No book ratings in this period yet." /> : <div className="stats-rated-list">{topRated.map((book) => <StatsBookRow key={book.id} book={book} onOpenBook={onOpenBook} />)}</div>}</section>
      <section className="stats-surface stats-authors-card"><StatsSectionTitle title="Favorite Authors" />{authors.length === 0 ? <SectionMessage message="No author data in this period yet." /> : <div className="book-stats-author-list">{authors.map((author, index) => <div key={author.name}><span>{author.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><p><b>{author.name}</b><small>{author.bookCount} {author.bookCount === 1 ? 'book' : 'books'} read</small></p><em>#{index + 1}</em></div>)}</div>}</section>
    </div>
    <section className="stats-surface stats-history-card"><StatsSectionTitle title="Recent Reads" />{recentReads.length === 0 ? <SectionMessage message="No books read in this period yet." /> : <div className="stats-history-list">{recentReads.map((book) => <StatsBookHistoryItem key={book.id} book={book} onOpenBook={onOpenBook} />)}</div>}</section>
  </section>
}

function StatsBookRow({ book, onOpenBook }) {
  return <button type="button" className="stats-title-row" onClick={() => onOpenBook(book)} aria-label={`Open ${book.title}`}><div className="stats-title-art">{book.coverUrl ? <img src={book.coverUrl} alt={`${book.title} cover`} loading="lazy" /> : null}</div><p><b>{book.title}</b><small>{book.authorsLabel}</small></p><span><StarIcon />{book.score?.toFixed(1) ?? '—'}</span></button>
}

function StatsBookHistoryItem({ book, onOpenBook }) {
  return <button type="button" className="stats-history-item" onClick={() => onOpenBook(book)} aria-label={`Open ${book.title}`}><div className="stats-title-art">{book.coverUrl ? <img src={book.coverUrl} alt={`${book.title} cover`} loading="lazy" /> : null}</div><b>{book.title}</b><small>{book.authorsLabel}</small><em>{book.readAt ? `Read ${formatRelativeTime(book.readAt)}` : 'Recently read'}</em></button>
}

function StatsWatchedMovieCard({ movie, onOpenMovie }) {
  return (
    <div className="stats-watched-movie-card">
      <MovieCard movie={movie} onOpenMovie={onOpenMovie} isWatched />
      <p>Watched on {formatLongDate(movie.watchedAt)}</p>
    </div>
  )
}

function StatsPlayedGameCard({ game, onOpenGame }) {
  return <div className="stats-watched-movie-card"><article className={`games-card games-art-${game.art || 'trivia'}`}><button type="button" className="games-card-open" onClick={() => onOpenGame(game)} aria-label={`Open ${game.title}`}><GameArt game={game} showLabel /><h3>{game.title}</h3><small>{game.playersLabel || game.meta}</small><div><span><StarIcon /> {game.rating}</span><em>Played</em></div></button></article><p>Played on {formatLongDate(game.playedAt)}</p></div>
}

function StatsReadBookCard({ book, onOpenBook }) {
  return <div className="stats-watched-movie-card"><BookCard book={book} onOpenBook={onOpenBook} /><p>Read on {formatLongDate(book.readAt)}</p></div>
}

function StatsWatchedTvEpisode({ episode, onOpenTvShow }) {
  const show = { id: episode.showId, title: episode.showTitle, posterUrl: episode.showPosterUrl }
  return (
    <button type="button" className="stats-tv-history-item" onClick={() => onOpenTvShow(show)} aria-label={`Open ${episode.showTitle}`}>
      <span className={`stats-tv-history-poster${episode.showPosterUrl ? ' has-image' : ''}`} style={episode.showPosterUrl ? { backgroundImage: `url(${episode.showPosterUrl})` } : undefined} />
      <span className="stats-tv-history-copy"><b>{episode.showTitle}</b><strong>{episode.episodeTitle}</strong><small>S{episode.seasonNumber} E{episode.episodeNumber}</small></span>
      <time dateTime={episode.watchedAt}>{formatLongDate(episode.watchedAt)}</time>
    </button>
  )
}

function StatsSectionTitle({ title, action, onAction }) {
  return <div className="stats-section-title"><h2>{title}</h2>{action ? <button type="button" onClick={onAction}>{action}</button> : null}</div>
}

function StatsTitleRow({ item, onOpenMovie, onOpenTvShow }) {
  const kind = item.mediaType === 'tv' ? `TV Show · ${item.episodeCount} ${item.episodeCount === 1 ? 'episode' : 'episodes'} rated` : 'Movie'
  return <button type="button" className="stats-title-row" onClick={() => item.mediaType === 'tv' ? onOpenTvShow(item) : onOpenMovie(item)} aria-label={`Open ${item.title}`}><div className={`stats-title-art${item.posterUrl ? ' has-image' : ''}`} style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})` } : undefined} /><p><b>{item.title}</b><small>{kind}</small></p><span><StarIcon />{item.score.toFixed(1)}</span></button>
}

function MobileNav({ activeView, enabledSections, setActiveView }) {
  return (
    <nav className="mobile-nav mobile-only" aria-label="Bottom navigation">
      {mobileNavItems.filter(({ view }) => isPrimaryViewEnabled(view, enabledSections)).map(({ label, icon: Icon, view }) => (
        <button
          key={label}
          type="button"
          className={`mobile-nav-item${view === activeView ? ' active' : ''}`}
          onClick={view ? () => setActiveView(view) : undefined}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

function StatsPanel({ className = '', title, items, period = 'month', onPeriodChange }) {
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false)
  const activePeriod = statsPeriods.find((option) => option.value === period) ?? statsPeriods[1]
  return (
    <div className={`stats-panel${className ? ` ${className}` : ''}`}>
      <div className="stats-header">
        <span>{title}</span>
        <div className="stats-period-control">
          <button
            type="button"
            className="month-button"
            aria-haspopup="menu"
            aria-expanded={isPeriodMenuOpen}
            onClick={onPeriodChange ? () => setIsPeriodMenuOpen((open) => !open) : undefined}
          >
            {activePeriod.label}
            <ChevronDown />
          </button>
          {isPeriodMenuOpen && onPeriodChange ? (
            <div className="stats-period-menu" role="menu" aria-label="Stats period">
              {statsPeriods.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.value === period}
                  className={option.value === period ? 'active' : ''}
                  onClick={() => {
                    onPeriodChange?.(option.value)
                    setIsPeriodMenuOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="stats-list">
        {items.map(({ label, value, trend, tone, icon: Icon }) => (
          <article key={label} className="stat-card">
            <div>
              <p className="stat-label">{label}</p>
              <div className="stat-row">
                <strong>{value}</strong>
                {trend ? <span className="trend">{trend}</span> : null}
              </div>
            </div>
            <div className={`stat-icon ${tone}`}>
              <Icon />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function MovieWatchlistPanel({ items, onOpenMovie, onOpenWatchlist }) {
  return (
    <section className="movie-watchlist-panel">
      <div className="section-header">
        <h2>Your Watchlist</h2>
        <button type="button" className="section-link" onClick={onOpenWatchlist}>
          View all
        </button>
      </div>

      {items.length === 0 ? <SectionMessage message="Your watchlist is empty for now." /> : null}

      <div className="movie-watchlist-list">
        {items.map((item) => (
          <MovieWatchlistPanelItem key={item.id} item={item} onOpenMovie={onOpenMovie} />
        ))}
      </div>
    </section>
  )
}

function MovieWatchlistPanelItem({ item, onOpenMovie }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(item.posterUrl) && !posterUnavailable

  return (
    <button
      type="button"
      className="movie-watchlist-item movie-watchlist-item-button"
      onClick={() => onOpenMovie(item)}
      aria-label={`Open ${item.title}`}
    >
      <div className={`movie-watchlist-poster ${showPosterImage ? 'has-image' : 'theme-catalog'}`}>
        {showPosterImage ? (
          <img
            src={item.posterUrl}
            alt={`${item.title} poster`}
            className="movie-card-poster-image"
            loading="lazy"
            onError={() => setPosterUnavailable(true)}
          />
        ) : null}
      </div>
      <div className="movie-watchlist-copy">
        <h3>{item.title}</h3>
        <p>{item.year}</p>
        <span>{item.meta}</span>
      </div>
      <span className="movie-watchlist-meta star-rating">
        <StarIcon />
        {item.rating.toFixed(1)}
      </span>
    </button>
  )
}

function ContentSection({ title, action, onAction, compact = false, className = '', children }) {
  return (
    <section className={`content-section${compact ? ' compact-section' : ''}${className ? ` ${className}` : ''}`}>
      <div className="section-header">
        <h2>{title}</h2>
        {action ? (
          <button type="button" className="section-link" onClick={onAction}>
            {action}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function QuickMediaActions({ title, isInWatchlist = false, isWatched = false, onOpen, onToggleWatchlist, onToggleWatched, watchedLabel = 'watched' }) {
  return (
    <div className="quick-media-actions" aria-label={`Quick actions for ${title}`}>
      <button type="button" className="quick-media-action" onClick={onOpen} aria-label={`Open details for ${title}`} title="Details"><ChevronRight /></button>
      {onToggleWatchlist ? <button type="button" className={`quick-media-action${isInWatchlist ? ' is-active' : ''}`} onClick={onToggleWatchlist} aria-label={`${isInWatchlist ? 'Remove' : 'Add'} ${title} ${isInWatchlist ? 'from' : 'to'} watchlist`} title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}><BookmarkIcon /></button> : null}
      {onToggleWatched ? <button type="button" className={`quick-media-action${isWatched ? ' is-active watched' : ''}`} onClick={onToggleWatched} aria-label={`${isWatched ? 'Mark' : 'Mark'} ${title} as ${isWatched ? `not ${watchedLabel}` : watchedLabel}`} title={isWatched ? `Mark as not ${watchedLabel}` : `Mark as ${watchedLabel}`}><CheckIcon /></button> : null}
    </div>
  )
}

function ProgressCard({ item, onOpenTvShow, isInWatchlist = false, isWatched = false, onToggleWatchlist, onToggleWatched }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(item.backdropUrl || item.posterUrl) && !posterUnavailable

  return (
    <article className="media-card progress-card quick-media-card">
      <button type="button" className="quick-media-card-open" onClick={() => onOpenTvShow?.(item)} aria-label={`Open ${item.title}`} />
      <div className={`media-poster wide ${showPosterImage ? 'has-image theme-catalog' : 'theme-catalog'}`}>
        {showPosterImage ? <img src={item.backdropUrl || item.posterUrl} alt={`${item.title} artwork`} className="movie-card-poster-image" loading="lazy" onError={() => setPosterUnavailable(true)} /> : null}
        <QuickMediaActions title={item.title} isInWatchlist={isInWatchlist} isWatched={isWatched} onOpen={() => onOpenTvShow?.(item)} onToggleWatchlist={onToggleWatchlist ? () => onToggleWatchlist(item) : null} onToggleWatched={onToggleWatched ? () => onToggleWatched(item) : null} />
      </div>
      <div className="media-copy">
        <h3>{item.title}</h3>
        <p>{item.latestWatchedEpisodeLabel} · {item.watchedEpisodeCount} of {item.airedEpisodeCount} episodes</p>
        <div className="progress-row">
          <div className="progress-track">
            <span style={{ width: `${item.progress}%` }} />
          </div>
          <span className="progress-value">{item.progress}%</span>
        </div>
      </div>
    </article>
  )
}

function RatingCard({ item, onOpenMovie, isInWatchlist = false, isWatched = false, onToggleWatchlist, onToggleWatched }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(item.posterUrl) && !posterUnavailable
  const ratingLabel = typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating

  return (
    <article className="media-card rating-card quick-media-card">
      <button type="button" className="quick-media-card-open" onClick={() => onOpenMovie?.(item)} aria-label={`Open ${item.title}`} />
      <div className={`media-poster tall ${showPosterImage ? 'has-image theme-catalog' : item.theme || 'theme-catalog'}`}>
        {showPosterImage ? (
          <img
            src={item.posterUrl}
            alt={`${item.title} poster`}
            className="movie-card-poster-image"
            loading="lazy"
            onError={() => setPosterUnavailable(true)}
          />
        ) : null}
        <QuickMediaActions title={item.title} isInWatchlist={isInWatchlist} isWatched={isWatched} onOpen={() => onOpenMovie?.(item)} onToggleWatchlist={onToggleWatchlist ? () => onToggleWatchlist(item) : null} onToggleWatched={onToggleWatched ? () => onToggleWatched(item) : null} />
      </div>
      <div className="media-copy">
        <h3>{item.title}</h3>
        <div className="rating-row">
          <span className="star-rating">
            <StarIcon />
            {ratingLabel}
          </span>
          <span>{item.subtitle ?? item.year ?? ''}</span>
        </div>
      </div>
    </article>
  )
}

function HomeWatchlistCard({ item, onOpenMovie, onOpenTvShow, onOpenBook, isInWatchlist, isWatched, onToggleWatchlist, onToggleWatched }) {
  const [artworkUnavailable, setArtworkUnavailable] = useState(false)
  const artworkUrl = item.kind === 'book' ? item.coverUrl : item.posterUrl || item.backdropUrl
  const hasArtwork = Boolean(artworkUrl) && !artworkUnavailable
  const meta = item.kind === 'book' ? item.authorsLabel : item.kind === 'tv' ? item.seasonMeta || item.meta : item.meta
  const onOpen = () => {
    if (item.kind === 'book') onOpenBook?.(item)
    else if (item.kind === 'tv') onOpenTvShow?.(item)
    else onOpenMovie?.(item)
  }

  return (
    <article className="media-card rating-card quick-media-card home-watchlist-card">
      <button type="button" className="quick-media-card-open" onClick={onOpen} aria-label={`Open ${item.title}`} />
      <div className={`media-poster tall ${hasArtwork ? 'has-image theme-catalog' : item.theme || 'theme-catalog'}`}>
        {hasArtwork ? <img src={artworkUrl} alt={`${item.title} ${item.kind === 'book' ? 'cover' : 'poster'}`} className="movie-card-poster-image" loading="lazy" onError={() => setArtworkUnavailable(true)} /> : null}
        <span className="home-media-kind" aria-hidden="true">{item.kind === 'book' ? 'Book' : item.kind === 'tv' ? 'TV' : 'Movie'}</span>
        <QuickMediaActions title={item.title} isInWatchlist={isInWatchlist} isWatched={isWatched} watchedLabel={item.kind === 'book' ? 'read' : 'watched'} onOpen={onOpen} onToggleWatchlist={() => onToggleWatchlist?.(item)} onToggleWatched={() => onToggleWatched?.(item)} />
      </div>
      <div className="media-copy"><h3>{item.title}</h3><p>{meta || item.year}</p></div>
    </article>
  )
}

function MovieCard({ movie, matchQuery, onOpenMovie, isInWatchlist = false, isWatched = false, onToggleWatchlist, onToggleWatched, railKind, railIndex }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(movie.posterUrl) && !posterUnavailable
  const hasQuickActions = Boolean(onToggleWatchlist || onToggleWatched)
  const cardContent = (
    <>
      <div className={`movie-card-poster ${showPosterImage ? 'has-image' : movie.theme}`}>
        {railKind === 'popular' ? <span className="movie-card-rank" aria-label={`Rank ${railIndex + 1}`}>{railIndex + 1}</span> : null}
        {railKind === 'recent' ? <span className="movie-card-rail-chip">{movie.releaseDate ? formatShortMovieDate(movie.releaseDate) : 'New release'}</span> : null}
        {railKind === 'upcoming' ? <span className="movie-card-rail-chip upcoming">{formatMovieCountdown(movie.releaseDate)}</span> : null}
        {isWatched ? (
          <span className="movie-card-watched-badge" aria-label={`${movie.title} is watched`}>
            <CheckCircleIcon />
          </span>
        ) : null}
        {isInWatchlist ? (
          <span className="movie-card-watchlist-badge" aria-label={`${movie.title} is in your watchlist`}>
            <StarIcon />
          </span>
        ) : null}
        {showPosterImage ? (
          <img
            src={movie.posterUrl}
            alt={`${movie.title} poster`}
            className="movie-card-poster-image"
            loading="lazy"
            onError={() => setPosterUnavailable(true)}
          />
        ) : null}
        {hasQuickActions ? (
          <QuickMediaActions
            title={movie.title}
            isInWatchlist={isInWatchlist}
            isWatched={isWatched}
            onOpen={() => onOpenMovie(movie)}
            onToggleWatchlist={onToggleWatchlist ? () => onToggleWatchlist(movie) : null}
            onToggleWatched={onToggleWatched ? () => onToggleWatched(movie) : null}
          />
        ) : null}
      </div>
      <div className="movie-card-copy">
        <h3><HighlightedText text={movie.title} query={matchQuery} /></h3><SearchMatchLabel text={movie.title} query={matchQuery} />
        <p>{movie.year} · <HighlightedText text={movie.meta || 'Catalog title'} query={matchQuery} /></p>
        <div className="rating-row">
          <span className="star-rating">
            <StarIcon />
            {movie.rating}
          </span>
          {railKind === 'top-rated' ? <strong className="movie-card-score">{movie.rating}<small>/10</small></strong> : <span><HighlightedText text={movie.genreLabel || 'Movie'} query={matchQuery} /></span>}
        </div>
      </div>
    </>
  )

  if (!hasQuickActions) return <button type="button" className="movie-card movie-card-button" onClick={() => onOpenMovie(movie)} aria-label={`Open ${movie.title}`}>{cardContent}</button>

  return <article className="movie-card quick-media-card"><button type="button" className="quick-media-card-open" onClick={() => onOpenMovie(movie)} aria-label={`Open ${movie.title}`} />{cardContent}</article>
}

function FeaturedMovieCard({
  popularMoviesState,
  onToggleWatched,
  onToggleWatchlist,
  onOpenMovie,
  watchedActionState,
  watchedMovieIds,
  watchlistActionState,
  watchlistMovieIds,
}) {
  if (popularMoviesState.status === 'loading' || popularMoviesState.status === 'idle') {
    return <SectionMessage message="Loading featured movie from your local database..." />
  }

  if (popularMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load the featured movie. ${popularMoviesState.error}`} tone="error" />
  }

  if (!popularMoviesState.featuredMovie) {
    return <SectionMessage message="No featured movie is available in the local database yet." />
  }

  const movie = popularMoviesState.featuredMovie
  const showBackdropImage = Boolean(movie.backdropUrl)
  const artStyle = showBackdropImage
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(10, 13, 24, 0.12), rgba(8, 11, 19, 0.24)), url(${movie.backdropUrl})`,
      }
    : undefined
  const isSaved = watchlistMovieIds.has(Number(movie.id))
  const isWatched = watchedMovieIds.has(Number(movie.id))
  const isSaving = watchlistActionState.status === 'loading' && Number(watchlistActionState.movieId) === Number(movie.id)
  const isWatchedUpdating = watchedActionState.status === 'loading' && Number(watchedActionState.movieId) === Number(movie.id)

  return (
    <button type="button" className="featured-movie-card featured-movie-card-button" onClick={() => onOpenMovie(movie)} aria-label={`Open ${movie.title}`}>
      <div className="featured-movie-copy">
        <span className="feature-label">Featured</span>
        <h2>{movie.title}</h2>
        <div className="featured-movie-meta">
          <span>{movie.year}</span>
          <span>{movie.genreLabel}</span>
          <span>{movie.rating}</span>
          <span>{movie.runtime}</span>
        </div>
        <div className="featured-movie-scores">
          <span className="movie-score">
            <StarIcon />
            {movie.score}
          </span>
          <span className="movie-score tomato-score">
            <TomatoIcon />
            {movie.audience}
          </span>
        </div>
        <p>{movie.summary}</p>

        <div className="hero-actions movie-actions">
          <button
            type="button"
            className="primary-button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleWatchlist(movie)
            }}
            disabled={isSaving || isWatched}
          >
            <PlusIcon />
            <span>{isSaving ? 'Updating...' : isWatched ? 'Watched' : isSaved ? 'In Watchlist' : 'Add to Watchlist'}</span>
          </button>
          <button
            type="button"
            className={`secondary-button${isWatched ? ' is-active' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggleWatched(movie)
            }}
            disabled={isWatchedUpdating}
          >
            <CheckIcon />
            <span>{isWatchedUpdating ? 'Updating...' : isWatched ? 'Watched' : 'Mark as Watched'}</span>
          </button>
        </div>
      </div>

      <div
        className={`featured-movie-art${showBackdropImage ? ' has-image' : ' theme-catalog'}`}
        style={artStyle}
        aria-hidden="true"
      >
      </div>
    </button>
  )
}

function MoviePosterSkeletons({ count = 5 }) {
  return <div className="movie-card-grid popular-movies-slider movie-skeleton-grid" aria-label="Loading movies">{Array.from({ length: count }, (_, index) => <div className="movie-card movie-skeleton-card" key={index}><div className="movie-card-poster" /><div className="movie-card-copy"><i /><i /></div></div>)}</div>
}

function sortMovieCards(movies, sort) {
  if (sort === 'rating') return [...movies].sort((left, right) => Number(right.rating) - Number(left.rating))
  if (sort === 'release') return [...movies].sort((left, right) => new Date(right.releaseDate || 0) - new Date(left.releaseDate || 0))
  return movies
}

function HorizontalMovieRail({ movies, ariaLabel, kind, onOpenMovie, watchedMovieIds, watchlistMovieIds, onToggleWatchlist, onToggleWatched }) {
  const railRef = useRef(null)
  const scrollRail = (direction) => railRef.current?.scrollBy({ left: direction * Math.max(railRef.current.clientWidth * 0.8, 260), behavior: 'smooth' })
  return <div className="movie-rail-wrap"><div className="movie-rail-navigation" aria-label={`${ariaLabel} navigation`}><button type="button" onClick={() => scrollRail(-1)} aria-label={`Previous ${ariaLabel}`}><ChevronLeftIcon /></button><button type="button" onClick={() => scrollRail(1)} aria-label={`Next ${ariaLabel}`}><ChevronRight /></button></div><div ref={railRef} className="movie-card-grid popular-movies-slider" aria-label={ariaLabel}>{movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} railKind={kind} railIndex={index} onOpenMovie={onOpenMovie} isWatched={watchedMovieIds.has(Number(movie.id))} isInWatchlist={watchlistMovieIds.has(Number(movie.id))} onToggleWatchlist={onToggleWatchlist} onToggleWatched={onToggleWatched} />)}</div></div>
}

function PopularMoviesGrid({ popularMoviesState, layout = 'slider', onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set(), onToggleWatchlist, onToggleWatched, sort = 'featured' }) {
  if (popularMoviesState.status === 'loading' || popularMoviesState.status === 'idle') {
    return <MoviePosterSkeletons />
  }

  if (popularMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load popular movies. ${popularMoviesState.error}`} tone="error" />
  }

  if (popularMoviesState.movies.length === 0) {
    return <SectionMessage message="No movies are available in the local database yet." />
  }

  const movies = sortMovieCards(layout === 'catalog' ? popularMoviesState.movies : popularMoviesState.movies.slice(0, 10), sort)

  if (layout !== 'catalog') return <HorizontalMovieRail movies={movies} ariaLabel="Popular movies" kind="popular" onOpenMovie={onOpenMovie} watchedMovieIds={watchedMovieIds} watchlistMovieIds={watchlistMovieIds} onToggleWatchlist={onToggleWatchlist} onToggleWatched={onToggleWatched} />

  return (
    <div
      className={`movie-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}
      aria-label={layout === 'catalog' ? 'Popular movies list' : 'Popular movies slider'}
    >
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
          onToggleWatchlist={onToggleWatchlist}
          onToggleWatched={onToggleWatched}
          railKind="popular"
          railIndex={index}
        />
      ))}
    </div>
  )
}

function RecentlyReleasedSlider({ recentMoviesState, layout = 'slider', onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set(), onToggleWatchlist, onToggleWatched, sort = 'featured' }) {
  if (recentMoviesState.status === 'loading' || recentMoviesState.status === 'idle') {
    return <MoviePosterSkeletons />
  }

  if (recentMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load recently released movies. ${recentMoviesState.error}`} tone="error" />
  }

  if (recentMoviesState.movies.length === 0) {
    return <SectionMessage message="No recently released movies are available in the local database yet." />
  }

  const movies = sortMovieCards(layout === 'catalog' ? recentMoviesState.movies : recentMoviesState.movies.slice(0, 10), sort)
  if (layout !== 'catalog') return <HorizontalMovieRail movies={movies} ariaLabel="Recently released movies" kind="recent" onOpenMovie={onOpenMovie} watchedMovieIds={watchedMovieIds} watchlistMovieIds={watchlistMovieIds} onToggleWatchlist={onToggleWatchlist} onToggleWatched={onToggleWatched} />

  return (
    <div
      className={`movie-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}
      aria-label={layout === 'catalog' ? 'Now playing movies list' : 'Recently released movies slider'}
    >
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
          onToggleWatchlist={onToggleWatchlist}
          onToggleWatched={onToggleWatched}
          railKind="recent"
          railIndex={index}
        />
      ))}
    </div>
  )
}

function UpcomingMoviesGrid({ upcomingMoviesState, layout = 'slider', onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set(), onToggleWatchlist, onToggleWatched, sort = 'featured' }) {
  if (upcomingMoviesState.status === 'loading' || upcomingMoviesState.status === 'idle') {
    return <MoviePosterSkeletons />
  }

  if (upcomingMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load upcoming movies. ${upcomingMoviesState.error}`} tone="error" />
  }

  if (upcomingMoviesState.movies.length === 0) {
    return <SectionMessage message="No upcoming movies are available in the local database yet." />
  }

  const movies = sortMovieCards(layout === 'catalog' ? upcomingMoviesState.movies : upcomingMoviesState.movies.slice(0, 10), sort)
  if (layout !== 'catalog') return <HorizontalMovieRail movies={movies} ariaLabel="Upcoming movies" kind="upcoming" onOpenMovie={onOpenMovie} watchedMovieIds={watchedMovieIds} watchlistMovieIds={watchlistMovieIds} onToggleWatchlist={onToggleWatchlist} onToggleWatched={onToggleWatched} />

  return (
    <div
      className={`movie-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}
      aria-label={layout === 'catalog' ? 'Upcoming movies list' : 'Upcoming movies slider'}
    >
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
          onToggleWatchlist={onToggleWatchlist}
          onToggleWatched={onToggleWatched}
          railKind="upcoming"
          railIndex={index}
        />
      ))}
    </div>
  )
}

function TopRatedMoviesGrid({ topRatedMoviesState, layout = 'slider', onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set(), onToggleWatchlist, onToggleWatched, sort = 'featured' }) {
  if (topRatedMoviesState.status === 'loading' || topRatedMoviesState.status === 'idle') {
    return <MoviePosterSkeletons />
  }

  if (topRatedMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load top rated movies. ${topRatedMoviesState.error}`} tone="error" />
  }

  if (topRatedMoviesState.movies.length === 0) {
    return <SectionMessage message="No top rated movies are available in the local database yet." />
  }

  const movies = sortMovieCards(layout === 'catalog' ? topRatedMoviesState.movies : topRatedMoviesState.movies.slice(0, 10), sort)
  if (layout !== 'catalog') return <HorizontalMovieRail movies={movies} ariaLabel="Top rated movies" kind="top-rated" onOpenMovie={onOpenMovie} watchedMovieIds={watchedMovieIds} watchlistMovieIds={watchlistMovieIds} onToggleWatchlist={onToggleWatchlist} onToggleWatched={onToggleWatched} />

  return (
    <div
      className={`movie-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}
      aria-label={layout === 'catalog' ? 'Top rated movies list' : 'Top rated movies slider'}
    >
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
          onToggleWatchlist={onToggleWatchlist}
          onToggleWatched={onToggleWatched}
          railKind="top-rated"
          railIndex={index}
        />
      ))}
    </div>
  )
}

function SimilarMoviesGrid({ similarMoviesState, onOpenMovie }) {
  if (similarMoviesState.status === 'loading' || similarMoviesState.status === 'idle') {
    return <SectionMessage message="Loading related movies from your local database..." />
  }

  if (similarMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load related movies. ${similarMoviesState.error}`} tone="error" />
  }

  if (similarMoviesState.movies.length === 0) {
    return <SectionMessage message="No related movies with matching genres are available in the local database yet." />
  }

  return (
    <div className="movie-detail-similar">
      {similarMoviesState.movies.map((item) => {
        const posterStyle = item.posterUrl ? { backgroundImage: `url(${item.posterUrl})` } : undefined

        return (
          <button
            key={item.id}
            type="button"
            className="movie-detail-similar-card"
            onClick={() => onOpenMovie(item)}
          >
            <div className="movie-detail-similar-poster" style={posterStyle} />
            <div className="movie-detail-similar-copy">
              <span>{item.year}</span>
              <strong>{item.title}</strong>
              <div className="star-rating">
                <StarIcon />
                {item.rating}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SectionMessage({ message, tone = 'neutral' }) {
  return <p className={`section-message${tone === 'error' ? ' error' : ''}`}>{message}</p>
}

function PaginationControls({ pagination, onPageChange }) {
  if (!pagination || (!pagination.hasNextPage && !pagination.hasPreviousPage)) {
    return null
  }

  return (
    <div className="pagination-controls" aria-label="Pagination">
      <button
        type="button"
        className="secondary-button pagination-button"
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={!pagination.hasPreviousPage}
      >
        <ChevronLeftIcon />
        <span>Previous</span>
      </button>
      <span className="pagination-label">Page {pagination.page}</span>
      <button
        type="button"
        className="secondary-button pagination-button"
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={!pagination.hasNextPage}
      >
        <span>Next</span>
      </button>
    </div>
  )
}

function GenreMoviesGrid({ genreMoviesState, onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set(), onToggleWatchlist, onToggleWatched }) {
  if (genreMoviesState.status === 'loading' || genreMoviesState.status === 'idle') {
    return <MoviePosterSkeletons />
  }

  if (genreMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load genre movies. ${genreMoviesState.error}`} tone="error" />
  }

  if (genreMoviesState.movies.length === 0) {
    return <SectionMessage message="No movies in this genre are available in the local database yet." />
  }

  return (
    <div className="movie-card-grid popular-movies-catalog">
      {genreMoviesState.movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
          onToggleWatchlist={onToggleWatchlist}
          onToggleWatched={onToggleWatched}
        />
      ))}
    </div>
  )
}

function getFilteredWatchlistItems({ items, activeTab, availability = 'all', sort = 'recently-added' }) {
  const filtered = items.filter((item) => {
    if (activeTab === 'Movies' && item.type !== 'Movies') {
      return false
    }

    if (activeTab === 'TV Shows' && item.type !== 'TV Shows') {
      return false
    }

    if (activeTab === 'Books' && item.type !== 'Books') {
      return false
    }

    if (availability === 'streaming') return Boolean(item.streamingService && item.streamingService !== 'Streaming TBA')
    if (availability === 'upcoming') return Boolean(item.nextEpisodeDate || (item.releaseDate && new Date(`${item.releaseDate}T00:00:00`).valueOf() > Date.now()))
    return true
  })
  const missingLast = (left, right) => (left === null || left === undefined) - (right === null || right === undefined)
  return filtered.sort((left, right) => {
    const titleTie = left.title.localeCompare(right.title)
    if (sort === 'priority') {
      const leftRank = left.topSlot ? left.topSlot : left.queuePosition ? left.queuePosition + 3 : Number.MAX_SAFE_INTEGER
      const rightRank = right.topSlot ? right.topSlot : right.queuePosition ? right.queuePosition + 3 : Number.MAX_SAFE_INTEGER
      return leftRank - rightRank || titleTie
    }
    if (sort === 'alphabetical') return titleTie
    if (sort === 'rating') return missingLast(left.rating, right.rating) || (right.rating ?? -Infinity) - (left.rating ?? -Infinity) || titleTie
    if (sort === 'runtime-or-pages') {
      const leftLength = left.type === 'Books' ? left.pageCount : left.runtimeMinutes
      const rightLength = right.type === 'Books' ? right.pageCount : right.runtimeMinutes
      return missingLast(leftLength, rightLength) || (leftLength ?? Infinity) - (rightLength ?? Infinity) || titleTie
    }
    if (sort === 'release-date') {
      const leftDate = left.nextEpisodeDate || left.releaseDate
      const rightDate = right.nextEpisodeDate || right.releaseDate
      return missingLast(leftDate, rightDate) || String(leftDate || '').localeCompare(String(rightDate || '')) || titleTie
    }
    return missingLast(left.watchlistedAt, right.watchlistedAt) || String(right.watchlistedAt || '').localeCompare(String(left.watchlistedAt || '')) || titleTie
  })
}

function getWatchlistAvailabilitySignal(item) {
  if (item.type === 'TV Shows' && item.nextEpisodeDate) {
    const date = new Date(`${item.nextEpisodeDate}T00:00:00`)
    const tomorrow = new Date(); tomorrow.setHours(0, 0, 0, 0); tomorrow.setDate(tomorrow.getDate() + 1)
    return date.valueOf() === tomorrow.valueOf() ? 'New episode tomorrow' : `New episode ${date.toLocaleDateString(undefined, { weekday: 'long' })}`
  }
  if (item.type === 'Movies' && item.releaseDate && new Date(`${item.releaseDate}T00:00:00`).valueOf() > Date.now()) return `Releases ${new Date(`${item.releaseDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}`
  return item.streamingService && item.streamingService !== 'Streaming TBA' ? `On ${item.streamingService}` : null
}

function getWatchlistDecisionMeta(item) {
  if (item.type === 'Books') return item.pageCount ? `${item.pageCount} pages · ${item.meta}` : item.meta
  if (item.type === 'TV Shows') return item.nextEpisodeDate ? `Next: ${item.nextEpisodeName || 'episode'} · ${new Date(`${item.nextEpisodeDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : item.runtimeMinutes ? `${item.runtimeMinutes} min episodes` : null
  return item.runtimeMinutes ? `${item.runtimeMinutes} min runtime` : null
}

function collectTvCatalog(collectionStates = []) {
  const catalog = new Map()

  collectionStates.forEach((state) => {
    if (!state || !Array.isArray(state.shows)) {
      return
    }

    state.shows.forEach((show) => {
      if (!catalog.has(Number(show.id))) {
        catalog.set(Number(show.id), show)
      }
    })
  })

  return Array.from(catalog.values())
}

function buildTvStats(stats) {
  return [
    {
      label: 'Shows Watched',
      value: String(stats.showsWatched),
      tone: 'violet',
      icon: TvIcon,
    },
    {
      label: 'Episodes Watched',
      value: String(stats.episodesWatched),
      tone: 'gold',
      icon: PlayIcon,
    },
    {
      label: 'Hours Watched',
      value: formatMinutesAsHoursAndMinutes(stats.timeWatchedMinutes),
      tone: 'blue',
      icon: ClockIcon,
    },
    {
      label: 'In Watchlist',
      value: String(stats.watchlistCount),
      tone: 'orange',
      icon: BookmarkStackIcon,
    },
  ]
}

function buildStatsDashboardMetrics({ movieStats, tvStats }) {
  const averageRating = typeof movieStats.averageRating === 'number' ? movieStats.averageRating.toFixed(1) : '—'

  return [
    { label: 'Titles Watched', value: String(movieStats.moviesWatched), tone: 'violet', icon: ClapperIcon },
    { label: 'Hours Watched', value: formatMinutesAsHoursAndMinutes(movieStats.timeWatchedMinutes + tvStats.timeWatchedMinutes), tone: 'blue', icon: ClockIcon },
    { label: 'Episodes Watched', value: String(tvStats.episodesWatched), tone: 'teal', icon: TvIcon },
    { label: 'Average Rating', value: averageRating, suffix: '/5', tone: 'gold', icon: StarOutlineIcon },
  ]
}

function buildAuthHeaders(user) {
  if (!user?.username) {
    return {}
  }

  return {
    'x-watchvault-username': user.username,
  }
}

function normalizeEnabledSections(sections) {
  const selected = Array.isArray(sections) ? sections : defaultEnabledSections
  return defaultEnabledSections.filter((section) => requiredEnabledSections.includes(section) || selected.includes(section))
}

function isPrimaryViewEnabled(view, enabledSections) {
  const section = sectionByPrimaryView[view]
  return !section || enabledSections.includes(section)
}

function formatAlertTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function mapMovieStatsPayload(stats) {
  return {
    moviesWatched: typeof stats?.moviesWatched === 'number' ? stats.moviesWatched : 0,
    timeWatchedMinutes: typeof stats?.timeWatchedMinutes === 'number' ? stats.timeWatchedMinutes : 0,
    watchlistCount: typeof stats?.watchlistCount === 'number' ? stats.watchlistCount : 0,
    averageRating: typeof stats?.averageRating === 'number' ? stats.averageRating : null,
  }
}

function mapTvStatsPayload(stats) {
  return {
    showsWatched: typeof stats?.showsWatched === 'number' ? stats.showsWatched : 0,
    episodesWatched: typeof stats?.episodesWatched === 'number' ? stats.episodesWatched : 0,
    timeWatchedMinutes: typeof stats?.timeWatchedMinutes === 'number' ? stats.timeWatchedMinutes : 0,
    watchlistCount: typeof stats?.watchlistCount === 'number' ? stats.watchlistCount : 0,
  }
}

function mapWatchedTvEpisodePayload(episode) {
  return {
    showId: Number.isInteger(episode?.showId) ? episode.showId : null,
    showTitle: typeof episode?.showTitle === 'string' ? episode.showTitle : 'TV Show',
    showPosterUrl: typeof episode?.showPosterUrl === 'string' ? episode.showPosterUrl : null,
    episodeId: Number.isInteger(episode?.episodeId) ? episode.episodeId : null,
    episodeTitle: typeof episode?.episodeTitle === 'string' ? episode.episodeTitle : 'Episode',
    seasonNumber: Number.isInteger(episode?.seasonNumber) ? episode.seasonNumber : 0,
    episodeNumber: Number.isInteger(episode?.episodeNumber) ? episode.episodeNumber : 0,
    watchedAt: typeof episode?.watchedAt === 'string' ? episode.watchedAt : null,
  }
}

function mapStatsInsightsPayload(payload) {
  return {
    activity: {
      buckets: Array.isArray(payload?.activity?.buckets) ? payload.activity.buckets.map((bucket) => ({
        label: typeof bucket?.label === 'string' ? bucket.label : '',
        movieMinutes: typeof bucket?.movieMinutes === 'number' ? bucket.movieMinutes : 0,
        tvMinutes: typeof bucket?.tvMinutes === 'number' ? bucket.tvMinutes : 0,
        totalMinutes: typeof bucket?.totalMinutes === 'number' ? bucket.totalMinutes : 0,
      })) : [],
    },
    mediaSplit: {
      movieEvents: typeof payload?.mediaSplit?.movieEvents === 'number' ? payload.mediaSplit.movieEvents : 0,
      tvEpisodeEvents: typeof payload?.mediaSplit?.tvEpisodeEvents === 'number' ? payload.mediaSplit.tvEpisodeEvents : 0,
    },
    genres: Array.isArray(payload?.genres) ? payload.genres.filter((genre) => typeof genre?.name === 'string' && typeof genre?.minutes === 'number') : [],
    habits: {
      weekdayMinutes: Array.isArray(payload?.habits?.weekdayMinutes) ? payload.habits.weekdayMinutes.slice(0, 7).map((minutes) => typeof minutes === 'number' ? minutes : 0) : Array(7).fill(0),
      bestWeekdayIndex: Number.isInteger(payload?.habits?.bestWeekdayIndex) ? payload.habits.bestWeekdayIndex : null,
      peakWindow: Number.isInteger(payload?.habits?.peakWindow?.startHour) && Number.isInteger(payload?.habits?.peakWindow?.endHour) ? payload.habits.peakWindow : null,
    },
    topRatedThisMonth: Array.isArray(payload?.topRatedThisMonth) ? payload.topRatedThisMonth
      .filter((item) => typeof item?.title === 'string' && (item?.mediaType === 'movie' || item?.mediaType === 'tv') && Number.isFinite(item?.score))
      .slice(0, 4)
      .map((item) => ({
        id: Number.isInteger(item.id) ? item.id : null,
        title: item.title,
        mediaType: item.mediaType,
        score: item.score,
        posterUrl: resolveMoviePosterUrl(item.posterPath),
        episodeCount: item.mediaType === 'tv' && Number.isInteger(item.episodeCount) && item.episodeCount > 0 ? item.episodeCount : 0,
      })) : [],
    mostWatchedActors: Array.isArray(payload?.mostWatchedActors) ? payload.mostWatchedActors
      .filter((actor) => typeof actor?.personId === 'string' && typeof actor?.name === 'string' && Number.isInteger(actor?.titleCount) && actor.titleCount > 0)
      .slice(0, 4)
      .map((actor) => ({ ...actor, id: Number(actor.personId), profileUrl: resolveMoviePosterUrl(actor.profilePath) })) : [],
    streamingPlatforms: Array.isArray(payload?.streamingPlatforms) ? payload.streamingPlatforms
      .filter((platform) => typeof platform?.name === 'string' && Number.isFinite(platform?.minutes) && Number.isFinite(platform?.percent))
      .slice(0, 5) : [],
    recentHistory: Array.isArray(payload?.recentHistory) ? payload.recentHistory.filter((item) => Number.isInteger(item?.id) && typeof item?.title === 'string' && typeof item?.watchedAt === 'string').slice(0, 5).map((item) => ({ ...item, posterUrl: resolveMoviePosterUrl(item.posterPath) })) : [],
    yearInReview: {
      titlesWatched: Number.isInteger(payload?.yearInReview?.titlesWatched) ? payload.yearInReview.titlesWatched : 0,
      minutes: Number.isFinite(payload?.yearInReview?.minutes) ? payload.yearInReview.minutes : 0,
      episodesWatched: Number.isInteger(payload?.yearInReview?.episodesWatched) ? payload.yearInReview.episodesWatched : 0,
      averageRating: Number.isFinite(payload?.yearInReview?.averageRating) ? payload.yearInReview.averageRating : null,
      topGenre: typeof payload?.yearInReview?.topGenre === 'string' ? payload.yearInReview.topGenre : null,
      longestStreak: Number.isInteger(payload?.yearInReview?.longestStreak) ? payload.yearInReview.longestStreak : 0,
      mostWatchedMonth: typeof payload?.yearInReview?.mostWatchedMonth === 'string' ? payload.yearInReview.mostWatchedMonth : null,
      newFavorites: Number.isInteger(payload?.yearInReview?.newFavorites) ? payload.yearInReview.newFavorites : 0,
    },
  }
}

function mapBookStatsPayload(payload) {
  const metrics = payload?.metrics || {}
  return {
    metrics: {
      booksRead: Number.isInteger(metrics.booksRead) ? metrics.booksRead : 0,
      pagesRead: Number.isFinite(metrics.pagesRead) ? metrics.pagesRead : 0,
      watchlistCount: Number.isInteger(metrics.watchlistCount) ? metrics.watchlistCount : 0,
      averageRating: Number.isFinite(metrics.averageRating) ? metrics.averageRating : null,
    },
    formats: {
      physical: Number.isInteger(payload?.formats?.physical) ? payload.formats.physical : 0,
      ebook: Number.isInteger(payload?.formats?.ebook) ? payload.formats.ebook : 0,
      audiobook: Number.isInteger(payload?.formats?.audiobook) ? payload.formats.audiobook : 0,
    },
    activity: { buckets: Array.isArray(payload?.activity?.buckets) ? payload.activity.buckets.map((bucket) => ({ label: typeof bucket?.label === 'string' ? bucket.label : '', pagesRead: Number.isFinite(bucket?.pagesRead) ? bucket.pagesRead : 0, booksRead: Number.isInteger(bucket?.booksRead) ? bucket.booksRead : 0 })) : [] },
    categories: Array.isArray(payload?.categories) ? payload.categories.filter((item) => typeof item?.name === 'string').slice(0, 5).map((item) => ({ name: item.name, bookCount: Number.isInteger(item.bookCount) ? item.bookCount : 0, pages: Number.isFinite(item.pages) ? item.pages : 0 })) : [],
    authors: Array.isArray(payload?.authors) ? payload.authors.filter((item) => typeof item?.name === 'string').slice(0, 4).map((item) => ({ name: item.name, bookCount: Number.isInteger(item.bookCount) ? item.bookCount : 0 })) : [],
    topRated: mapBookStatsItems(payload?.topRated, true),
    recentReads: mapBookStatsItems(payload?.recentReads, false),
  }
}

function mapBookStatsItems(items, withScore) {
  return Array.isArray(items) ? items.filter((item) => typeof item?.id === 'string' && typeof item?.title === 'string').slice(0, 5).map((item) => ({ id: item.id, title: item.title, authorsLabel: Array.isArray(item.authors) && item.authors.length ? item.authors.filter(Boolean).join(', ') : 'Author TBA', coverUrl: item.coverUrl || null, ...(withScore ? { score: Number.isFinite(item.score) ? item.score : null } : { readAt: item.readAt || null }) })) : []
}

function formatRelativeTime(value) {
  const date = new Date(value); const minutes = Math.floor((Date.now() - date.valueOf()) / 60000)
  if (Number.isNaN(date.valueOf()) || minutes < 0) return 'Recently'
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  if (minutes < 2880) return 'Yesterday'
  return `${Math.floor(minutes / 1440)} days ago`
}

function resolveBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function buildActivityAxisLabels(maxMinutes) {
  return [maxMinutes, maxMinutes * 0.75, maxMinutes * 0.5, maxMinutes * 0.25].map((minutes) => formatCompactMinutes(minutes))
}

function buildBookActivityAxisLabels(maxPages) {
  return [maxPages, maxPages * 0.75, maxPages * 0.5, maxPages * 0.25].map((pages) => `${Math.round(pages).toLocaleString()} p`)
}

function formatCompactMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0h'
  const hours = minutes / 60
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(hours % 1 ? 1 : 0)}h`
}

function formatPeakWatchWindow(peakWindow) {
  if (!peakWindow) return '—'
  return `${formatStatsHour(peakWindow.startHour)} – ${formatStatsHour(peakWindow.endHour)}`
}

function formatStatsHour(hour) {
  const normalizedHour = ((hour % 24) + 24) % 24
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM'
  const displayHour = normalizedHour % 12 || 12
  return `${displayHour}:00 ${suffix}`
}

function mapGenrePayload(genre, index = 0) {
  return {
    id: genre.id,
    name: genre.name,
    movieCount: typeof genre.movieCount === 'number' ? genre.movieCount : 0,
    color: pickGenreAccentColor(genre.name, index),
  }
}

function mapWatchlistMoviePayload(movie, index = 0) {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || 'Release TBA',
    meta: movie.meta || 'Genre TBA',
    rating: typeof movie.rating === 'number' ? movie.rating : 0,
    type: movie.type || 'Movies',
    posterUrl: movie.posterUrl || null,
    backdropUrl: movie.backdropUrl || null,
    runtime: movie.runtime || 'Runtime TBA',
    streamingService: movie.streamingService || 'Streaming TBA',
    watchlistedAt: movie.watchlistedAt || null,
    releaseDate: movie.releaseDate || null,
    runtimeMinutes: Number.isInteger(movie.runtimeMinutes) ? movie.runtimeMinutes : null,
    topSlot: Number.isInteger(movie.topSlot) ? movie.topSlot : null,
    queuePosition: Number.isInteger(movie.queuePosition) ? movie.queuePosition : null,
    hasReleaseReminder: Boolean(movie.hasReleaseReminder),
    accent: watchlistAccentOptions[index % watchlistAccentOptions.length],
    bookmarked: true,
  }
}

function mapWatchlistBookPayload(book, index = 0) {
  return {
    id: String(book.id || ''),
    title: book.title || 'Untitled',
    year: book.year || 'Publication TBA',
    meta: book.meta || 'Author TBA',
    categoriesLabel: book.categoriesLabel || 'Category TBA',
    type: 'Books',
    posterUrl: book.posterUrl || null,
    watchlistedAt: book.watchlistedAt || null,
    releaseDate: book.releaseDate || null,
    pageCount: Number.isInteger(book.pageCount) ? book.pageCount : null,
    topSlot: Number.isInteger(book.topSlot) ? book.topSlot : null,
    queuePosition: Number.isInteger(book.queuePosition) ? book.queuePosition : null,
    accent: watchlistAccentOptions[index % watchlistAccentOptions.length],
    bookmarked: true,
  }
}

function mapReadBookPayload(book, index = 0) {
  return {
    ...mapWatchlistBookPayload(book, index),
    readAt: book.readAt || null,
    coverUrl: book.posterUrl || null,
    authorsLabel: book.meta || 'Author TBA',
    readingFormat: ['physical', 'ebook', 'audiobook'].includes(book.readingFormat) ? book.readingFormat : 'physical',
    completionMetadata: book.completionMetadata && typeof book.completionMetadata === 'object' && !Array.isArray(book.completionMetadata) ? book.completionMetadata : {},
  }
}

function getSelectedReadingDetails(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const selectedFields = bookCompletionFields.filter(([key]) => metadata[key] === true).map(([, label]) => label)
  const tropes = Array.isArray(metadata.tropes) ? metadata.tropes.filter((trope) => typeof trope === 'string' && trope.trim()).map((trope) => trope.trim()) : []
  return [...new Set([...selectedFields, ...tropes])]
}

function mapBookToWatchlistItem(book) {
  return {
    id: String(book?.id || ''),
    title: book?.title || 'Untitled',
    year: book?.year || 'Publication TBA',
    meta: book?.authorsLabel || 'Author TBA',
    categoriesLabel: book?.categoriesLabel || 'Category TBA',
    type: 'Books',
    posterUrl: book?.coverUrl || null,
    accent: watchlistAccentOptions[0],
    bookmarked: true,
  }
}

function mapCalendarEventPayload(event) {
  const seasonNumber = Number(event?.seasonNumber)
  const episodeNumber = Number(event?.episodeNumber)
  const episodeLabel = typeof event?.episodeLabel === 'string' && event.episodeLabel
    ? event.episodeLabel
    : Number.isInteger(seasonNumber) && Number.isInteger(episodeNumber) ? `S${seasonNumber} E${episodeNumber}` : null
  return {
    date: typeof event?.date === 'string' ? event.date.slice(0, 10) : '',
    mediaType: event?.mediaType === 'tv' ? 'tv' : 'movie',
    mediaId: Number(event?.mediaId),
    episodeId: Number.isInteger(Number(event?.episodeId)) ? Number(event.episodeId) : null,
    title: event?.title || 'Untitled',
    episodeTitle: event?.episodeTitle || null,
    episodeLabel,
    posterUrl: event?.posterUrl || null,
    backdropUrl: event?.backdropUrl || null,
  }
}

function mapTvWatchlistShowPayload(show, index = 0) {
  return {
    id: show.id,
    title: show.title,
    year: show.year || 'Release TBA',
    meta: show.meta || 'Genre TBA',
    rating: typeof show.rating === 'number' ? show.rating : 0,
    type: 'TV Shows',
    posterUrl: show.posterUrl || null,
    backdropUrl: show.backdropUrl || null,
    watchlistedAt: show.watchlistedAt || null,
    releaseDate: show.releaseDate || null,
    runtimeMinutes: Number.isInteger(show.runtimeMinutes) ? show.runtimeMinutes : null,
    streamingService: show.streamingService || 'Streaming TBA',
    nextEpisodeDate: show.nextEpisodeDate || null,
    nextEpisodeName: show.nextEpisodeName || null,
    topSlot: Number.isInteger(show.topSlot) ? show.topSlot : null,
    queuePosition: Number.isInteger(show.queuePosition) ? show.queuePosition : null,
    accent: watchlistAccentOptions[index % watchlistAccentOptions.length],
    bookmarked: true,
  }
}

function mapContinueWatchingTvShowPayload(show) {
  return {
    id: show.id,
    title: show.title,
    posterUrl: show.posterUrl || null,
    backdropUrl: show.backdropUrl || null,
    watchedEpisodeCount: Number(show.watchedEpisodeCount) || 0,
    airedEpisodeCount: Number(show.airedEpisodeCount) || 0,
    progress: Number(show.progress) || 0,
    latestWatchedEpisodeLabel: show.latestWatchedEpisodeLabel || 'Latest episode',
    nextEpisodeLabel: show.nextEpisodeLabel || 'Next episode',
    nextEpisodeTitle: show.nextEpisodeTitle || 'Next episode',
    runtime: show.runtime || 'Runtime TBA',
    streamingService: show.streamingService || 'Streaming TBA',
  }
}

function mapLatestEpisodeTvShowPayload(show) {
  const episode = show.latestEpisode ?? {}
  const seasonNumber = Number(episode.seasonNumber)
  const episodeNumber = Number(episode.episodeNumber)
  const episodeLabel = Number.isInteger(seasonNumber) && Number.isInteger(episodeNumber) ? `S${seasonNumber} E${episodeNumber}` : 'Latest episode'

  return {
    id: show.id,
    title: show.title,
    year: episode.airDate ? formatLongDate(episode.airDate) : 'Recently aired',
    rating: typeof show.popularity === 'number' ? Math.round(show.popularity) : 0,
    meta: episodeLabel,
    seasonMeta: episode.title ? `${episodeLabel} · ${episode.title}` : episodeLabel,
    posterUrl: show.posterUrl || null,
    backdropUrl: show.backdropUrl || null,
    theme: 'theme-catalog',
  }
}

function mapWatchedMoviePayload(movie) {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || 'Release TBA',
    meta: movie.meta || 'Genre TBA',
    rating: typeof movie.rating === 'number' ? movie.rating : 0,
    type: movie.type || 'Movies',
    posterUrl: movie.posterUrl || null,
    watchedAt: movie.watchedAt || null,
    runtimeMinutes: typeof movie.runtimeMinutes === 'number' ? movie.runtimeMinutes : 0,
  }
}

function mapMovieRowToCard(movie) {
  return {
    id: movie.tmdb_id,
    title: movie.title,
    year: formatMovieYear(movie.release_date),
    rating: formatMovieRating(movie.vote_average),
    meta: formatMovieMeta(movie),
    releaseDate: movie.release_date || null,
    posterUrl: resolveMoviePosterUrl(movie.poster_path),
    theme: 'theme-catalog',
  }
}

function mapGamePayload(game) {
  const rating = Number.isFinite(game.rating) ? game.rating : Number.isFinite(game.aggregated_rating) ? game.aggregated_rating : null
  return {
    id: game.igdb_id,
    title: game.title || 'Untitled',
    summary: game.summary || 'Description not available yet.',
    coverUrl: game.cover_image_url || null,
    rating: rating === null ? 'N/A' : rating.toFixed(1),
    playersLabel: Number.isFinite(game.steam_peak_players) ? formatGamePlayerCount(game.steam_peak_players) : '',
    meta: game.release_date ? `Released ${formatGameReleaseDate(game.release_date)}` : 'Release date unavailable',
    rank: Number.isInteger(game.import_rank) ? game.import_rank : null,
  }
}

function mapUpcomingGamePayload(game) {
  const mappedGame = mapGamePayload(game)
  return {
    ...mappedGame,
    meta: game.release_date ? `Releases ${formatGameReleaseDate(game.release_date)}` : 'Release date unavailable',
  }
}

function mapPlayedGamePayload(game) {
  const rating = Number.isFinite(Number(game.rating)) ? Number(game.rating) : null
  return {
    id: Number(game.id),
    title: game.title || 'Untitled',
    coverUrl: game.coverUrl || null,
    rating: rating === null ? 'N/A' : rating.toFixed(1),
    playersLabel: Number.isFinite(Number(game.steamPeakPlayers)) ? formatGamePlayerCount(Number(game.steamPeakPlayers)) : '',
    meta: game.releaseDate ? `Released ${formatGameReleaseDate(game.releaseDate)}` : 'Release date unavailable',
    playedAt: game.playedAt || null,
  }
}

function mapGameDetailPayload(game) {
  return {
    id: Number(game.id), title: game.title || 'Untitled', summary: game.summary || 'Description not available yet.', coverUrl: game.coverUrl || null,
    releaseDate: game.releaseDate || null, rating: Number.isFinite(Number(game.rating)) ? Number(game.rating) : null,
    ratingCount: Number(game.ratingCount) || 0, aggregatedRating: Number.isFinite(Number(game.aggregatedRating)) ? Number(game.aggregatedRating) : null,
    aggregatedRatingCount: Number(game.aggregatedRatingCount) || 0, steamPeakPlayers: Number.isFinite(Number(game.steamPeakPlayers)) ? Number(game.steamPeakPlayers) : null,
    platforms: Array.isArray(game.platforms) ? game.platforms.filter(Boolean) : [], genres: Array.isArray(game.genres) ? game.genres.filter(Boolean) : [],
    igdbUrl: game.igdbUrl || null, timeToBeat: mapGameTimeToBeatPayload(game.timeToBeat), communityRating: mapCommunityRatingPayload(game.communityRating), played: Boolean(game.played), tracking: game.tracking || null,
  }
}

function mapGameTimeToBeatPayload(timeToBeat) {
  if (!timeToBeat || typeof timeToBeat !== 'object') return null
  const normalized = {
    mainStory: normalizeGameTimeToBeatSeconds(timeToBeat.mainStory),
    mainAndExtras: normalizeGameTimeToBeatSeconds(timeToBeat.mainAndExtras),
    completionist: normalizeGameTimeToBeatSeconds(timeToBeat.completionist),
  }
  return Object.values(normalized).some((value) => value !== null) ? normalized : null
}

function normalizeGameTimeToBeatSeconds(value) {
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : null
}

function mapGamePreviewToDetail(game) {
  return mapGameDetailPayload({ ...game, releaseDate: game.releaseDate || null, communityRating: emptyCommunityRating, platforms: [], genres: [] })
}

function mapSimilarGamePayload(game) {
  const rating = Number.isFinite(Number(game.rating)) ? Number(game.rating) : null
  return {
    id: Number(game.id),
    title: game.title || 'Untitled',
    coverUrl: game.coverUrl || null,
    rating: rating === null ? 'N/A' : rating.toFixed(1),
    playersLabel: game.releaseDate ? formatGameReleaseDate(game.releaseDate) : (Array.isArray(game.genres) && game.genres.length ? game.genres.join(', ') : 'Game'),
    meta: game.releaseDate ? `Released ${formatGameReleaseDate(game.releaseDate)}` : 'Release date unavailable',
  }
}

function mapBookRowToCard(book) {
  const authors = Array.isArray(book.authors) ? book.authors.filter(Boolean) : []
  const categories = Array.isArray(book.categories) ? book.categories.filter(Boolean).slice(0, 1) : []
  return {
    id: book.google_books_id,
    title: book.title || 'Untitled',
    authorsLabel: authors.length ? authors.join(', ') : 'Author TBA',
    categoriesLabel: categories.length ? categories.join(', ') : 'Category TBA',
    year: book.published_date ? String(book.published_date).slice(0, 4) : 'Publication TBA',
    coverUrl: book.cover_image_url || null,
  }
}

function mapGoogleBookToCard(book) {
  const authors = Array.isArray(book.authors) ? book.authors.filter(Boolean) : []
  const categories = Array.isArray(book.categories) ? book.categories.filter(Boolean).slice(0, 1) : []
  return {
    id: book.googleBooksId,
    title: book.title || 'Untitled',
    authorsLabel: authors.length ? authors.join(', ') : 'Author TBA',
    categoriesLabel: categories.length ? categories.join(', ') : 'Category TBA',
    year: book.publishedDate ? String(book.publishedDate).slice(0, 4) : 'Publication TBA',
    coverUrl: book.coverImageUrl || null,
  }
}

function mapBookDetailPayload(book) {
  const card = mapBookRowToCard(book)
  const identifiers = Array.isArray(book.isbn_identifiers) ? book.isbn_identifiers : []
  return {
    ...card,
    description: stripHtml(book.description),
    publisher: book.publisher || null,
    publishedDate: book.published_date || null,
    pageCount: Number.isInteger(book.page_count) ? book.page_count : null,
    languageLabel: book.language ? String(book.language).toUpperCase() : 'Language TBA',
    authorProfiles: Array.isArray(book.authorProfiles) ? book.authorProfiles.filter((author) => Number.isInteger(Number(author?.id)) && author?.name) : [],
    isbn10: identifiers.find((item) => item?.type === 'ISBN_10')?.identifier || null,
    isbn13: identifiers.find((item) => item?.type === 'ISBN_13')?.identifier || null,
    communityRating: mapCommunityRatingPayload(book.communityRating),
  }
}

function stripHtml(value) {
  if (typeof value !== 'string') return null
  const container = document.createElement('div')
  container.innerHTML = value.replace(/<(?:br\s*\/?>|\/p\s*>|\/div\s*>|\/li\s*>)/gi, '\n')
  const text = container.textContent?.replace(/\n{3,}/g, '\n\n').trim()
  return text || null
}

function mapTvRowToCard(show) {
  const details = show.detail_payload ?? {}

  return {
    id: show.tmdb_id,
    title: show.name,
    year: formatMovieYear(show.first_air_date),
    rating: formatMovieRating(show.vote_average),
    meta: formatTvMeta(show),
    seasonMeta: formatEpisodeCount(details),
    genreLabel: Array.isArray(show.genre_names) && show.genre_names.length > 0 ? show.genre_names.join(', ') : 'Genre TBA',
    maturityRating: readTvMaturityRating(details),
    audience: formatTvAudience(show.vote_average),
    description: show.overview || 'Overview not available yet.',
    posterUrl: resolveMoviePosterUrl(show.poster_path),
    backdropUrl: resolveMovieBackdropUrl(show.backdrop_path),
    railMeta: formatTvRailMeta(show),
    theme: 'theme-catalog',
  }
}

function mapSearchActorPayload(actor) {
  return {
    id: actor.tmdb_person_id,
    name: actor.name,
    profileUrl: resolveMoviePosterUrl(actor.profile_path),
    role: actor.known_for_department || 'Actor',
    popularity: typeof actor.popularity === 'number' ? actor.popularity : 0,
  }
}

function mapTvDetailPayload(show) {
  return {
    id: show.id,
    title: show.title,
    overview: show.overview,
    year: formatMovieYear(show.firstAirDate),
    firstAirDateLabel: show.firstAirDate ? formatLongDate(show.firstAirDate) : 'TBA',
    genresLabel: Array.isArray(show.genres) && show.genres.length ? show.genres.join(', ') : 'Genre TBA',
    maturityRating: show.maturityRating || 'TV Series',
    voteAverage: show.voteAverage || 'N/A',
    voteCount: show.voteCount || '0 votes',
    posterUrl: resolveMoviePosterUrl(show.posterPath),
    backdropUrl: resolveMovieBackdropUrl(show.backdropPath),
    status: show.status || 'Unknown', network: show.network,
    creatorsLabel: Array.isArray(show.creators) && show.creators.length ? show.creators.join(', ') : 'TBA',
    languagesLabel: Array.isArray(show.languages) && show.languages.length ? show.languages.join(', ') : 'TBA',
    communityRating: {
      average: typeof show.communityRating?.average === 'number' ? show.communityRating.average : null,
      voteCount: Number.isInteger(show.communityRating?.voteCount) ? show.communityRating.voteCount : 0,
    },
    yourEpisodeRating: {
      average: typeof show.yourEpisodeRating?.average === 'number' ? show.yourEpisodeRating.average : null,
      ratingCount: Number.isInteger(show.yourEpisodeRating?.ratingCount) ? show.yourEpisodeRating.ratingCount : 0,
    },
    trailer: Array.isArray(show.trailers) ? show.trailers[0] ?? null : null,
    seasons: (Array.isArray(show.seasons) ? show.seasons : []).filter((season) => Number(season.seasonNumber) > 0).map((season) => ({ ...season, episodes: (season.episodes ?? []).map((episode) => ({ ...episode, isAired: Boolean(episode.isAired), yourScore: typeof episode.yourScore === 'number' ? episode.yourScore : null, stillUrl: resolveMovieBackdropUrl(episode.stillPath), airDateLabel: episode.airDate ? formatLongDate(episode.airDate) : 'TBA', runtimeLabel: episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : 'Runtime TBA' })) })),
    credits: Array.isArray(show.credits) ? show.credits.map((credit) => ({ ...credit, profileUrl: resolveMoviePosterUrl(credit.profilePath) })) : [],
    recommendations: Array.isArray(show.recommendations) ? show.recommendations.map((item) => ({ ...item, posterUrl: resolveMoviePosterUrl(item.posterPath) })) : [],
  }
}

function mapFeaturedTvPayload(show) {
  return {
    id: show.id,
    title: show.title,
    year: show.year || 'Release TBA',
    genreLabel: Array.isArray(show.genres) && show.genres.length > 0 ? show.genres.join(', ') : 'Genre TBA',
    maturityRating: show.rating || 'TV Series',
    meta: show.episodesLabel || show.runtime || 'Episodes TBA',
    seasonMeta: show.episodesLabel || 'Episodes TBA',
    rating: show.score || 'N/A',
    audience: show.audience || '0 votes',
    description: show.summary || 'Overview not available yet.',
    posterUrl: resolveMoviePosterUrl(show.posterPath),
    backdropUrl: resolveMovieBackdropUrl(show.backdropPath),
    railMeta: formatFeaturedTvRailMeta(show),
    theme: 'theme-catalog',
  }
}

function mapMovieRowToSimilarCard(movie) {
  return {
    id: movie.tmdb_id,
    title: movie.title,
    year: formatMovieYear(movie.release_date),
    rating: formatMovieRating(movie.vote_average),
    posterUrl: resolveMoviePosterUrl(movie.poster_path),
  }
}

async function loadFallbackSimilarMovies(movieId) {
  const detailResponse = await fetch(`/api/movies/${movieId}`)
  const detailPayload = await detailResponse.json().catch(() => ({}))

  if (!detailResponse.ok) {
    throw new Error(detailPayload.error || `Request failed with status ${detailResponse.status}`)
  }

  const sourceGenres = Array.isArray(detailPayload.movie?.genres)
    ? detailPayload.movie.genres.map((genre) => String(genre).trim()).filter(Boolean)
    : []

  if (sourceGenres.length === 0) {
    return []
  }

  const listPayloads = await Promise.all([
    fetchMovieCollection('/api/movies'),
    fetchMovieCollection('/api/movies/recently-released?limit=30'),
    fetchMovieCollection('/api/movies/top-rated?limit=30'),
    fetchMovieCollection('/api/movies/upcoming?limit=30'),
  ])

  const dedupedMovies = new Map()

  for (const movies of listPayloads) {
    for (const movie of movies) {
      if (Number(movie.tmdb_id) === Number(movieId)) {
        continue
      }

      if (!dedupedMovies.has(movie.tmdb_id)) {
        dedupedMovies.set(movie.tmdb_id, movie)
      }
    }
  }

  return Array.from(dedupedMovies.values())
    .map((movie) => ({
      movie,
      sharedGenreCount: countSharedGenres(sourceGenres, movie.genre_names),
    }))
    .filter(({ sharedGenreCount }) => sharedGenreCount > 0)
    .sort((left, right) => {
      if (right.sharedGenreCount !== left.sharedGenreCount) {
        return right.sharedGenreCount - left.sharedGenreCount
      }

      const releasePriorityDifference = getReleasedMoviePriority(left.movie.release_date) - getReleasedMoviePriority(right.movie.release_date)

      if (releasePriorityDifference !== 0) {
        return releasePriorityDifference
      }

      const popularityDifference = (right.movie.popularity ?? Number.NEGATIVE_INFINITY) - (left.movie.popularity ?? Number.NEGATIVE_INFINITY)

      if (popularityDifference !== 0) {
        return popularityDifference
      }

      const ratingDifference = (right.movie.vote_average ?? Number.NEGATIVE_INFINITY) - (left.movie.vote_average ?? Number.NEGATIVE_INFINITY)

      if (ratingDifference !== 0) {
        return ratingDifference
      }

      return left.movie.tmdb_id - right.movie.tmdb_id
    })
    .slice(0, 10)
    .map(({ movie }) => mapMovieRowToSimilarCard(movie))
}

async function fetchMovieCollection(path) {
  const response = await fetch(path)
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`)
  }

  return Array.isArray(payload.movies) ? payload.movies : []
}

function createMovieCollectionState({ includeFeaturedMovie = false } = {}) {
  return {
    status: 'idle',
    movies: [],
    pagination: createPaginationState(),
    ...(includeFeaturedMovie ? { featuredMovie: null } : {}),
    error: '',
  }
}

function createGameCollectionState() {
  return { status: 'idle', games: [], pagination: createPaginationState(), error: '' }
}

function createGameCollectionLoadingState(page = 1) {
  return { status: 'loading', games: [], pagination: createPaginationState(page), error: '' }
}

function createGamesDashboardState() {
  return { status: 'idle', popularGames: [], recentGames: [], upcomingGames: [], error: '' }
}

function createGamesDashboardLoadingState() {
  return { status: 'loading', popularGames: [], recentGames: [], upcomingGames: [], error: '' }
}

function readStoredGameFavorites() {
  if (typeof window === 'undefined') return []
  try {
    const storedFavorites = JSON.parse(window.localStorage.getItem('watchvault-game-favorites') || '[]')
    return Array.isArray(storedFavorites) ? storedFavorites.filter((game) => game?.id) : []
  } catch {
    return []
  }
}

function storeGameFavorites(games) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('watchvault-game-favorites', JSON.stringify(games))
}

function createBookCollectionState() {
  return { status: 'idle', books: [], pagination: createPaginationState(), error: '' }
}

function createBookCollectionLoadingState(page = 1) {
  return { status: 'loading', books: [], pagination: createPaginationState(page), error: '' }
}

function createTvCollectionState({ includeFeaturedShow = false } = {}) {
  return {
    status: 'idle',
    shows: [],
    pagination: createPaginationState(),
    ...(includeFeaturedShow ? { featuredShow: null } : {}),
    error: '',
  }
}

function createMovieCollectionLoadingState({ page = 1, includeFeaturedMovie = false } = {}) {
  return {
    status: 'loading',
    movies: [],
    pagination: createPaginationState(page),
    ...(includeFeaturedMovie ? { featuredMovie: null } : {}),
    error: '',
  }
}

function createTvCollectionLoadingState({ page = 1, includeFeaturedShow = false } = {}) {
  return {
    status: 'loading',
    shows: [],
    pagination: createPaginationState(page),
    ...(includeFeaturedShow ? { featuredShow: null } : {}),
    error: '',
  }
}

function createPaginationState(page = 1) {
  return {
    page,
    pageSize: moviesPageSize,
    hasNextPage: false,
    hasPreviousPage: page > 1,
  }
}

function mapPaginationPayload(pagination, fallbackPage = 1) {
  if (!pagination || typeof pagination !== 'object') {
    return createPaginationState(fallbackPage)
  }

  return {
    page: Number.isInteger(pagination.page) && pagination.page > 0 ? pagination.page : fallbackPage,
    pageSize: Number.isInteger(pagination.pageSize) && pagination.pageSize > 0 ? pagination.pageSize : moviesPageSize,
    hasNextPage: Boolean(pagination.hasNextPage),
    hasPreviousPage: Boolean(pagination.hasPreviousPage),
  }
}

function buildMoviesApiPath(basePath, page, pageSize = moviesPageSize, extraParams = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  })

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value))
    }
  })

  return `${basePath}?${params.toString()}`
}

function buildTvApiPath(basePath, page, pageSize = moviesPageSize) {
  return buildMoviesApiPath(basePath, page, pageSize)
}

function pickGenreAccentColor(name, index = 0) {
  if (typeof name !== 'string' || name.length === 0) {
    return genreAccentPalette[index % genreAccentPalette.length]
  }

  const hash = Array.from(name).reduce((total, character) => total + character.charCodeAt(0), 0)
  return genreAccentPalette[hash % genreAccentPalette.length]
}

function countSharedGenres(sourceGenres, candidateGenres) {
  if (!Array.isArray(candidateGenres) || candidateGenres.length === 0) {
    return 0
  }

  const sourceGenreSet = new Set(sourceGenres.map((genre) => String(genre).trim().toLowerCase()))

  return candidateGenres.reduce((count, genre) => {
    return sourceGenreSet.has(String(genre).trim().toLowerCase()) ? count + 1 : count
  }, 0)
}

function getReleasedMoviePriority(releaseDate) {
  if (!releaseDate) {
    return 1
  }

  return releaseDate <= getCurrentIsoDate() ? 0 : 1
}

function getCurrentIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function mapFeaturedMoviePayload(movie) {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || 'Release TBA',
    genreLabel: Array.isArray(movie.genres) && movie.genres.length > 0 ? movie.genres.join(', ') : 'Genre TBA',
    rating: movie.rating || 'NR',
    runtime: movie.runtime || 'Runtime TBA',
    score: movie.score || 'N/A',
    audience: movie.audience || 'No votes',
    summary: movie.summary || 'Overview not available yet.',
    posterUrl: resolveMoviePosterUrl(movie.posterPath),
    backdropUrl: resolveMovieBackdropUrl(movie.backdropPath),
  }
}

function mapMovieDetailPayload(movie) {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || 'Release TBA',
    overview: movie.overview || 'Overview not available yet.',
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    genresLabel: Array.isArray(movie.genres) && movie.genres.length > 0 ? movie.genres.join(', ') : 'Genre TBA',
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

function mapPersonDetailPayload(person) {
  return {
    id: person.id,
    name: person.name,
    biography: person.biography || 'Biography not available yet.',
    profileUrl: person.profileUrl || null,
    knownForDepartment: person.knownForDepartment || 'Performer',
    birthday: person.birthday || null,
    birthdayLabel: formatLongDate(person.birthday),
    deathday: person.deathday || null,
    ageLabel: person.ageLabel || 'Unknown',
    placeOfBirth: person.placeOfBirth || 'Unknown',
    popularity: person.popularity || 'N/A',
    roles: Array.isArray(person.roles) ? person.roles : [],
    heroBackdropUrl: person.heroBackdropUrl || null,
  }
}

function mapPersonPreview(person) {
  return {
    id: person.id,
    name: person.name,
    biography: person.role ? `${person.role} in your WatchVault credits.` : 'Biography not available yet.',
    profileUrl: person.profileUrl || null,
    knownForDepartment: person.role || 'Performer',
    birthday: null,
    birthdayLabel: 'Unknown',
    deathday: null,
    ageLabel: 'Unknown',
    placeOfBirth: 'Unknown',
    popularity: 'N/A',
    roles: person.role ? [person.role] : [],
    heroBackdropUrl: null,
  }
}

function mapPersonMovieCredit(movie) {
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

function mapPersonFilmographyRow(movie) {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || 'Release TBA',
    mediaType: movie.mediaType === 'tv' ? 'tv' : 'movie',
    releaseDate: movie.releaseDate || null,
    decade: movie.decade || null,
    roles: Array.isArray(movie.roles) ? movie.roles : [movie.role || 'Credit'],
    role: movie.role || 'Credit',
    creditCategories: Array.isArray(movie.creditCategories) ? movie.creditCategories : [],
    popularity: Number.isFinite(Number(movie.popularity)) ? Number(movie.popularity) : null,
    voteAverage: Number.isFinite(Number(movie.voteAverage)) ? Number(movie.voteAverage) : null,
    rating: movie.rating || 'N/A',
    posterUrl: movie.posterUrl || null,
    personal: {
      watchlisted: Boolean(movie.personal?.watchlisted),
      watched: Boolean(movie.personal?.watched),
      yourScore: Number.isFinite(Number(movie.personal?.yourScore)) ? Number(movie.personal.yourScore) : null,
      ratingCount: Number(movie.personal?.ratingCount) || 0,
    },
    theme: 'theme-catalog',
  }
}

function mapPersonHistoryPayload(history) {
  if (!history || typeof history !== 'object') return null
  const next = history.nextRecommendation
  return {
    titlesWatched: Number(history.titlesWatched) || 0,
    averageRating: Number.isFinite(Number(history.averageRating)) ? Number(history.averageRating) : null,
    hoursWatched: Number(history.hoursWatched) || 0,
    nextRecommendation: next && Number.isInteger(Number(next.id)) ? mapPersonFilmographyRow(next) : null,
  }
}

function mapPersonCoStar(person) {
  return {
    id: person.id,
    name: person.name,
    profileUrl: person.profileUrl || null,
    sharedCredits: person.sharedCredits || 0,
    sharedTitles: Array.isArray(person.sharedTitles) ? person.sharedTitles : [],
  }
}

function mapMoviePreviewToDetail(movie) {
  return {
    id: movie.id,
    title: movie.title,
    year: movie.year || 'Release TBA',
    overview: movie.summary || movie.overview || 'Overview not available yet.',
    genres: movie.genreLabel ? movie.genreLabel.split(',').map((genre) => genre.trim()).filter(Boolean) : [],
    genresLabel: movie.genreLabel || movie.meta || 'Genre TBA',
    certification: movie.rating || movie.certification || 'NR',
    runtime: movie.runtime || 'Runtime TBA',
    score: movie.score || `${movie.rating || 'N/A'}/10`,
    tomatoScore: formatTomatoScore(movie.score || `${movie.rating || 'N/A'}/10`),
    audience: movie.audience || 'No votes',
    originalLanguage: movie.originalLanguage || 'Unknown',
    releaseDate: movie.releaseDate || null,
    releaseDateLabel: formatLongDate(movie.releaseDate),
    posterUrl: movie.posterUrl || null,
    backdropUrl: movie.backdropUrl || null,
    director: null,
    cast: [],
    reviews: [],
    communityRating: emptyCommunityRating,
  }
}

function mapCommunityRatingPayload(communityRating) {
  return {
    average: typeof communityRating?.average === 'number' ? communityRating.average : null,
    voteCount: Number.isInteger(communityRating?.voteCount) ? communityRating.voteCount : 0,
    yourScore: typeof communityRating?.yourScore === 'number' ? communityRating.yourScore : null,
  }
}

function formatCommunityRating(score) {
  return typeof score === 'number' ? `${score.toFixed(1)}/5` : 'Not rated'
}

function buildMovieCreditCards(movie) {
  const cards = []

  if (movie?.director?.name) {
    cards.push({
      id: movie.director.id,
      name: movie.director.name,
      role: 'Director',
      profileUrl: movie.director.profileUrl || null,
    })
  }

  if (Array.isArray(movie?.cast)) {
    for (const castMember of movie.cast) {
      if (!castMember?.name) {
        continue
      }

      cards.push({
        id: castMember.id,
        name: castMember.name,
        role: castMember.role || 'Role TBA',
        profileUrl: castMember.profileUrl || null,
      })
    }
  }

  return cards
}

function buildMovieCreditAvatarStyle(profileUrl) {
  if (!profileUrl) {
    return undefined
  }

  return {
    backgroundImage: `linear-gradient(180deg, rgba(8, 11, 20, 0.08), rgba(8, 11, 20, 0.44)), url(${profileUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}

function getMovieCreditInitials(name) {
  if (!name) {
    return '?'
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

function getSeasonalThemeWithMovies(themeKey) {
  return seasonalThemes.find((theme) => theme.key === themeKey && typeof theme.tmdbKeyword === 'string' && theme.tmdbKeyword.trim()) ?? null
}

function getSeasonalThemeLabel(theme) {
  return String(theme?.name || 'Seasonal').replace(/\s+Theme$/i, '')
}

function readAppRoute(pathname = window.location.pathname, search = window.location.search) {
  if (/^\/news\/?$/.test(pathname)) {
    const params = new URLSearchParams(search)
    const readId = (key) => {
      const value = params.get(key)
      return value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null
    }
    const movie = readId('movie')
    const tab = params.get('tab') === 'saved' ? 'saved' : 'news'
    return { kind: routeKinds.news, tab, filters: { actor: readId('actor'), movie, show: movie ? null : readId('show') } }
  }

  if (/^\/stats\/?$/.test(pathname)) {
    return { kind: routeKinds.stats }
  }

  if (/^\/calendar\/?$/.test(pathname)) {
    return { kind: routeKinds.calendar }
  }

  if (/^\/watchlist\/?$/.test(pathname)) {
    return { kind: routeKinds.watchlist }
  }

  if (/^\/search\/?$/.test(pathname)) {
    return { kind: routeKinds.search, query: new URLSearchParams(search).get('q')?.trim() || '' }
  }

  if (/^\/discover\/?$/.test(pathname)) {
    return { kind: routeKinds.discover }
  }

  if (/^\/seasonal\/?$/.test(pathname)) {
    return { kind: routeKinds.seasonalMovies }
  }

  if (/^\/tv\/continue-watching\/?$/.test(pathname)) {
    return { kind: routeKinds.continueWatching }
  }

  const tvDetailMatch = pathname.match(/^\/tv\/(\d+)\/?$/)
  const bookDetailMatch = pathname.match(/^\/books\/([^/]+)\/?$/)
  const authorDetailMatch = pathname.match(/^\/authors\/(\d+)\/?$/)
  const personDetailMatch = pathname.match(/^\/people\/(\d+)\/?$/)
  const gameDetailMatch = pathname.match(/^\/games\/(\d+)\/?$/)
  const detailMatch = pathname.match(/^\/movies\/(\d+)\/?$/)

  if (tvDetailMatch) {
    return { kind: routeKinds.tvDetail, showId: Number.parseInt(tvDetailMatch[1], 10) }
  }

  if (bookDetailMatch) {
    return { kind: routeKinds.bookDetail, bookId: decodeURIComponent(bookDetailMatch[1]) }
  }

  if (authorDetailMatch) {
    return { kind: routeKinds.authorDetail, authorId: Number.parseInt(authorDetailMatch[1], 10) }
  }

  if (personDetailMatch) {
    return {
      kind: routeKinds.personDetail,
      personId: Number.parseInt(personDetailMatch[1], 10),
    }
  }

  if (gameDetailMatch) {
    return { kind: routeKinds.gameDetail, gameId: Number.parseInt(gameDetailMatch[1], 10) }
  }

  if (detailMatch) {
    return {
      kind: routeKinds.movieDetail,
      movieId: Number.parseInt(detailMatch[1], 10),
    }
  }

  return { kind: routeKinds.home }
}

const watchlistTabValues = { all: 'All', movies: 'Movies', tv: 'TV Shows', books: 'Books', actors: 'Actors', authors: 'Authors' }
const watchlistTabKeys = Object.fromEntries(Object.entries(watchlistTabValues).map(([key, value]) => [value, key]))

function readWatchlistViewState(search = window.location.search) {
  const params = new URLSearchParams(search)
  const tab = watchlistTabValues[params.get('tab')] || 'All'
  const availability = ['all', 'streaming', 'upcoming'].includes(params.get('availability')) ? params.get('availability') : 'all'
  const sort = ['recently-added', 'priority', 'release-date', 'rating', 'runtime-or-pages', 'alphabetical'].includes(params.get('sort')) ? params.get('sort') : 'recently-added'
  return { tab, availability, sort }
}

function buildWatchlistPath({ tab, availability, sort }) {
  const params = new URLSearchParams({ tab: watchlistTabKeys[tab] || 'all', availability, sort })
  return `/watchlist?${params.toString()}`
}

function buildNewsPath(filters = emptyNewsFilters, tab = 'news') {
  const params = new URLSearchParams()
  if (tab === 'saved') params.set('tab', 'saved')
  if (Number.isInteger(filters.actor) && filters.actor > 0) params.set('actor', filters.actor)
  if (Number.isInteger(filters.movie) && filters.movie > 0) params.set('movie', filters.movie)
  if (Number.isInteger(filters.show) && filters.show > 0 && !params.has('movie')) params.set('show', filters.show)
  const query = params.toString()
  return query ? `/news?${query}` : '/news'
}

function buildNewsApiPath(page, filters = emptyNewsFilters, tab = 'news') {
  const params = new URLSearchParams({ page: String(page), limit: String(newsPageSize) })
  if (tab === 'saved') params.set('saved', 'true')
  if (Number.isInteger(filters.actor) && filters.actor > 0) params.set('actor', filters.actor)
  if (Number.isInteger(filters.movie) && filters.movie > 0) params.set('movie', filters.movie)
  if (Number.isInteger(filters.show) && filters.show > 0 && !params.has('movie')) params.set('show', filters.show)
  return `/api/news?${params.toString()}`
}

function buildSearchPath(query) {
  return `/search?q=${encodeURIComponent(query)}`
}

function buildMovieDetailPath(movieId) {
  return `/movies/${movieId}`
}

function buildGameDetailPath(gameId) {
  return `/games/${gameId}`
}

function buildBookDetailPath(bookId) {
  return `/books/${encodeURIComponent(bookId)}`
}

function buildAuthorDetailPath(authorId) {
  return `/authors/${authorId}`
}

function buildPersonDetailPath(personId) {
  return `/people/${personId}`
}

function readMoviePreviewFromHistory(movieId) {
  const preview = window.history.state?.moviePreview

  if (!preview || Number(preview.id) !== Number(movieId)) {
    return null
  }

  return preview
}

function readPersonPreviewFromHistory(personId) {
  const preview = window.history.state?.personPreview

  if (!preview || Number(preview.id) !== Number(personId)) {
    return null
  }

  return preview
}

function formatMovieYear(releaseDate) {
  if (!releaseDate) {
    return 'Release TBA'
  }

  return String(releaseDate).slice(0, 4)
}

function formatShortMovieDate(releaseDate) {
  if (!releaseDate) return 'New release'
  const date = new Date(releaseDate)
  if (Number.isNaN(date.getTime())) return 'New release'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function formatMovieCountdown(releaseDate) {
  if (!releaseDate) return 'Coming soon'
  const date = new Date(releaseDate)
  if (Number.isNaN(date.getTime())) return 'Coming soon'
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000)
  if (days <= 0) return 'Out now'
  return days === 1 ? '1 day' : `${days} days`
}

function formatMovieRating(voteAverage) {
  if (typeof voteAverage !== 'number') {
    return 'N/A'
  }

  return voteAverage.toFixed(1)
}

function formatMovieMeta(movie) {
  const details = []

  if (typeof movie.vote_count === 'number') {
    details.push(formatVoteCount(movie.vote_count))
  }

  if (details.length === 0) {
    return 'From local DB'
  }

  return details.join(' • ')
}

function formatTvMeta(show) {
  const details = show.detail_payload ?? {}
  const pieces = [formatEpisodeCount(details)]

  if (typeof show.vote_count === 'number') {
    pieces.push(formatVoteCount(show.vote_count))
  }

  return pieces.filter(Boolean).join(' • ') || 'From local DB'
}

function formatTvRailMeta(show) {
  const year = formatMovieYear(show.first_air_date)
  const genreLabel = Array.isArray(show.genre_names) && show.genre_names.length > 0 ? show.genre_names.join(', ') : 'Genre TBA'

  return `${year} • ${genreLabel}`
}

function formatFeaturedTvRailMeta(show) {
  const year = show.year || 'Release TBA'
  const genreLabel = Array.isArray(show.genres) && show.genres.length > 0 ? show.genres.join(', ') : 'Genre TBA'

  return `${year} • ${genreLabel}`
}

function formatEpisodeCount(details) {
  const { episodeCount, seasonCount } = getRegularTvCounts(details)

  if (seasonCount && episodeCount) {
    return `S${seasonCount} • ${episodeCount} Episodes`
  }

  if (episodeCount) {
    return `${episodeCount} Episodes`
  }

  if (seasonCount) {
    return `${seasonCount} Seasons`
  }

  return 'Episodes TBA'
}

function getRegularTvCounts(details) {
  const seasons = Array.isArray(details?.seasons) ? details.seasons.filter((season) => Number(season?.season_number) > 0) : []
  if (!Array.isArray(details?.seasons)) {
    return {
      episodeCount: typeof details?.number_of_episodes === 'number' ? details.number_of_episodes : null,
      seasonCount: typeof details?.number_of_seasons === 'number' ? details.number_of_seasons : null,
    }
  }
  if (!seasons.length) return { episodeCount: null, seasonCount: null }
  const episodeCounts = seasons.map((season) => Number(season?.episode_count))
  return {
    episodeCount: episodeCounts.every(Number.isFinite) ? episodeCounts.reduce((total, count) => total + count, 0) : null,
    seasonCount: seasons.length,
  }
}

function readTvMaturityRating(details) {
  const contentRatings = Array.isArray(details?.content_ratings?.results) ? details.content_ratings.results : []
  const usRating = contentRatings.find((entry) => entry?.iso_3166_1 === 'US' && typeof entry?.rating === 'string' && entry.rating.trim())

  return usRating?.rating?.trim() || 'TV Series'
}

function formatTvAudience(voteAverage) {
  const score = formatMovieRating(voteAverage)
  if (score === 'N/A') {
    return 'N/A'
  }

  return formatTomatoScore(`${score}/10`)
}

function formatVoteCount(voteCount) {
  if (voteCount >= 1000) {
    return `${(voteCount / 1000).toFixed(1)}k votes`
  }

  return `${voteCount} votes`
}

function formatTomatoScore(score) {
  const match = typeof score === 'string' ? score.match(/^(\d+(?:\.\d+)?)\/10$/) : null

  if (!match) {
    return '92%'
  }

  return `${Math.round(Number.parseFloat(match[1]) * 10)}%`
}

function formatLongDate(releaseDate) {
  if (!releaseDate) {
    return 'Release TBA'
  }

  const value = typeof releaseDate === 'string' && releaseDate.includes('T') ? releaseDate : `${releaseDate}T00:00:00.000Z`
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Release TBA'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsedDate)
}

function formatNewsDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getNewsSource(link) {
  try {
    const hostname = new URL(link).hostname.replace(/^www\./, '')
    if (hostname === 'variety.com' || hostname.endsWith('.variety.com')) return 'Variety'
    if (hostname === 'deadline.com' || hostname.endsWith('.deadline.com')) return 'Deadline'
    if (hostname === 'hollywoodreporter.com' || hostname.endsWith('.hollywoodreporter.com')) return 'The Hollywood Reporter'
    return hostname
  } catch {
    return 'Original publisher'
  }
}

function formatAdminJobExecutionDate(value) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not yet'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getLocalIsoDate(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 10)
}

function getLocalIsoMonth(date = new Date()) {
  return getLocalIsoDate(date).slice(0, 7)
}

function shiftIsoMonth(month, amount) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function getCalendarMonthDays(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1))
  const start = new Date(firstDay)
  start.setUTCDate(1 - firstDay.getUTCDay())
  return Array.from({ length: 42 }, (_value, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return {
      isoDate: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      isOutsideMonth: date.getUTCMonth() !== monthNumber - 1,
    }
  })
}

function formatCalendarMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}

function formatCalendarDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00.000Z`))
}

function formatCalendarShortDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00.000Z`))
}

function resolveMoviePosterUrl(posterPath) {
  if (!posterPath) {
    return null
  }

  return `https://image.tmdb.org/t/p/w500${posterPath}`
}

function resolveMovieBackdropUrl(backdropPath) {
  if (!backdropPath) {
    return null
  }

  return `https://image.tmdb.org/t/p/w780${backdropPath}`
}

function formatMinutesAsHoursAndMinutes(minutes) {
  if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes <= 0) {
    return '0h 0m'
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours}h ${remainingMinutes}m`
}

function buildMoviesPageStats({ stats }) {
  return [
    { label: 'Movies Watched', value: String(stats.moviesWatched), tone: 'violet', icon: ClapperIcon },
    { label: 'In Watchlist', value: String(stats.watchlistCount), tone: 'orange', icon: BookmarkStackIcon },
    { label: 'Hours Watched', value: formatMinutesAsHoursAndMinutes(stats.timeWatchedMinutes), tone: 'blue', icon: ClockIcon },
  ]
}

function getFirstName(fullName) {
  if (!fullName) {
    return 'there'
  }

  return fullName.trim().split(/\s+/)[0] || 'there'
}

function getUserInitial(fullName) {
  if (!fullName) {
    return '?'
  }

  return fullName.trim().charAt(0).toUpperCase() || '?'
}

function formatAdminTotal(value) {
  if (typeof value !== 'number') {
    return '--'
  }

  return new Intl.NumberFormat().format(value)
}

function formatGamePlayerCount(value) {
  if (!Number.isFinite(value) || value < 0) return 'Player count unavailable'
  return `24h Steam peak: ${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`
}

function formatGameTimeToBeat(seconds) {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours && minutes) return `${hours}h ${minutes}m`
  if (hours) return `${hours}h`
  return `${minutes}m`
}

function formatGameReleaseDate(value) {
  if (!value) return 'Release date TBA'
  const normalized = typeof value === 'string' && value.includes('T') ? value : `${value}T00:00:00.000Z`
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return 'Release date TBA'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsed)
}

function formatAdminBytes(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return '--'
  }

  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`
}

function IconBase({ children, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

function PlayLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="brand-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--brand-gradient-start, #bf6fff)" />
          <stop offset="1" stopColor="var(--brand-gradient-end, #6e40ff)" />
        </linearGradient>
      </defs>
      <path d="M7 5.5C7 4 8.64 3.05 9.96 3.8l15.8 8.96c1.36.77 1.36 2.73 0 3.5L9.96 25.2C8.64 25.95 7 25 7 23.5V5.5Z" fill="url(#brand-grad)" />
      <path d="M14 10.2L21 14L14 17.8V10.2Z" fill="var(--brand-mark-cutout, #1b1234)" fillOpacity=".85" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <IconBase>
      <path d="M3.5 10.5 12 3l8.5 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </IconBase>
  )
}

function ClapperIcon() {
  return (
    <IconBase>
      <rect x="4" y="8" width="16" height="11" rx="2.5" />
      <path d="M7 8 9.5 5.5" />
      <path d="M11 8 13.5 5.5" />
      <path d="M15 8 17.5 5.5" />
      <path d="M7.5 13h2" />
      <path d="M11 13h2" />
      <path d="M14.5 13h2" />
    </IconBase>
  )
}

function TvIcon() {
  return (
    <IconBase>
      <rect x="4" y="5.5" width="16" height="11.5" rx="2.5" />
      <path d="M10 20h4" />
      <path d="M12 17v3" />
    </IconBase>
  )
}

function NewsIcon() {
  return (
    <IconBase>
      <path d="M5 5.5h11.5v13H6.8A1.8 1.8 0 0 1 5 16.7V5.5Z" />
      <path d="M16.5 8.5H19v8.2a1.8 1.8 0 0 1-1.8 1.8h-.7" />
      <path d="M8 9h5.5M8 12h5.5M8 15h3.2" />
    </IconBase>
  )
}

function BookmarkIcon() {
  return (
    <IconBase>
      <path d="M7 5.5h10a1 1 0 0 1 1 1v13l-6-3-6 3v-13a1 1 0 0 1 1-1Z" />
    </IconBase>
  )
}

function GamepadIcon() {
  return <IconBase><path d="M7.1 9h9.8a3.6 3.6 0 0 1 3.4 4.8l-1 2.9a2.1 2.1 0 0 1-3.4.8l-1.7-1.6h-4.4l-1.7 1.6a2.1 2.1 0 0 1-3.4-.8l-1-2.9A3.6 3.6 0 0 1 7.1 9Z" /><path d="M8 12v3M6.5 13.5h3M16.7 12.7h.01M18.5 14.4h.01" /></IconBase>
}

function HeartIcon() {
  return <IconBase><path d="M20 8.8c0 5.3-8 10-8 10s-8-4.7-8-10a4.2 4.2 0 0 1 7.3-2.9L12 6.7l.7-.8A4.2 4.2 0 0 1 20 8.8Z" /></IconBase>
}

function CalendarIcon() {
  return (
    <IconBase>
      <rect x="4.5" y="6" width="15" height="13.5" rx="2.4" />
      <path d="M8 4.5v3" />
      <path d="M16 4.5v3" />
      <path d="M4.5 10.5h15" />
    </IconBase>
  )
}

function UserIcon() {
  return (
    <IconBase>
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </IconBase>
  )
}

function ShieldIcon() {
  return (
    <IconBase>
      <path d="M12 3.8 18.5 6v4.75c0 4.14-2.68 7.94-6.5 9.45-3.82-1.51-6.5-5.31-6.5-9.45V6L12 3.8Z" />
      <path d="m9.6 12 1.65 1.65L14.6 10.3" />
    </IconBase>
  )
}

function TrophyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v1a4 4 0 0 0 4 4" /><path d="M16 6h3v1a4 4 0 0 1-4 4" /><path d="M12 13v4" /><path d="M8 21h8" /><path d="M10 17h4" /></svg>
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
}

function LogoutIcon() {
  return (
    <IconBase>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </IconBase>
  )
}

function RunJobIcon() {
  return (
    <IconBase>
      <path d="m9 7 7 5-7 5Z" />
    </IconBase>
  )
}

function SpinnerIcon() {
  return (
    <IconBase className="spin-icon">
      <path d="M12 4.5a7.5 7.5 0 1 1-7.5 7.5" />
    </IconBase>
  )
}

function ChevronLeftIcon() {
  return (
    <IconBase>
      <path d="m14.5 6.5-6 5.5 6 5.5" />
    </IconBase>
  )
}

function BarsIcon() {
  return (
    <IconBase>
      <path d="M6.5 19V9.5" />
      <path d="M12 19V5.5" />
      <path d="M17.5 19v-7" />
    </IconBase>
  )
}

function MoreIcon() {
  return (
    <IconBase>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

function BellIcon() {
  return (
    <IconBase>
      <path d="M8.5 18h7" />
      <path d="M6.5 15.5h11l-1.2-1.9V10a4.3 4.3 0 1 0-8.6 0v3.6l-1.2 1.9Z" />
      <path d="M10.5 18a1.5 1.5 0 0 0 3 0" />
    </IconBase>
  )
}

function SearchIcon() {
  return (
    <IconBase>
      <circle cx="11" cy="11" r="5.5" />
      <path d="m15.5 15.5 4 4" />
    </IconBase>
  )
}

function PlusIcon() {
  return (
    <IconBase>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  )
}

function SparklesIcon() {
  return (
    <IconBase>
      <path d="M12 4.5 13.9 10 19.5 12l-5.6 2-1.9 5.5-1.9-5.5L4.5 12l5.6-2L12 4.5Z" />
    </IconBase>
  )
}

function ClockIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8.5v4l2.8 1.8" />
    </IconBase>
  )
}

function CheckIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="7" />
      <path d="m9.2 12.2 1.9 2 3.8-4.1" />
    </IconBase>
  )
}

function BookmarkStackIcon() {
  return (
    <IconBase>
      <path d="M8 5.5h8a1 1 0 0 1 1 1v10l-5-2.6-5 2.6v-10a1 1 0 0 1 1-1Z" />
      <path d="M6 8.5H5a1 1 0 0 0-1 1v9l5-2.5" />
    </IconBase>
  )
}

function ChevronRight(props) {
  return (
    <IconBase {...props}>
      <path d="m9 6 6 6-6 6" />
    </IconBase>
  )
}

function ChevronDown() {
  return (
    <IconBase>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  )
}

function TomatoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 6.4c4 0 7 2.8 7 6.8s-3 6.8-7 6.8-7-2.8-7-6.8 3-6.8 7-6.8Z" fill="#ff7a45" />
      <path d="M12 6.4c.7-1.4 2-2.5 3.6-3" stroke="#6ddc91" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 6.4c-.9-1.2-2.2-2-3.9-2.4" stroke="#7dea9b" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 8c1.1-.7 2.1-1 3-1s2 .3 3 1" stroke="#ffd3c0" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 4 2.1 4.4 4.9.7-3.5 3.4.8 4.8L12 15l-4.3 2.3.8-4.8L5 9.1l4.9-.7L12 4Z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8.8 5.2 3.2-5.2 3.2Z" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

function UserRatingIcon() {
  return (
    <IconBase>
      <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M6.5 18a5.5 5.5 0 0 1 11 0" />
    </IconBase>
  )
}

function StarOutlineIcon() {
  return (
    <IconBase>
      <path d="m12 4.8 1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L6.2 9.1l4-.6L12 4.8Z" />
    </IconBase>
  )
}

function BookmarkStatusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 5.5h10a1 1 0 0 1 1 1v13l-6-3-6 3v-13a1 1 0 0 1 1-1Z" fill="#a755ff" />
    </svg>
  )
}

function WatchedStatusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="#51d17f" strokeWidth="2" />
      <path d="m8.8 12.3 2 2.1 4.4-4.7" stroke="#51d17f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ProgressIcon() {
  return (
    <IconBase>
      <path d="M5 12h14" />
      <path d="M5 12a7 7 0 0 1 14 0" />
    </IconBase>
  )
}

function ReplayIcon() {
  return (
    <IconBase>
      <path d="M7 8H4v3" />
      <path d="M4.5 11a7 7 0 0 1 12-2.6" />
      <path d="M17 16h3v-3" />
      <path d="M19.5 13a7 7 0 0 1-12 2.6" />
    </IconBase>
  )
}

function NotesIcon() {
  return (
    <IconBase>
      <path d="M8 17h8" />
      <path d="M8 12.5h8" />
      <path d="M8 8h5" />
      <rect x="5" y="4.5" width="14" height="15" rx="2" />
    </IconBase>
  )
}

function DirectorIcon() {
  return (
    <IconBase>
      <rect x="4.5" y="6.5" width="10" height="10" rx="2" />
      <path d="m15 9 4-2v10l-4-2" />
    </IconBase>
  )
}

function LanguageIcon() {
  return (
    <IconBase>
      <path d="M4.5 7h8" />
      <path d="M8.5 7c0 5-2.2 8-4 9.5" />
      <path d="M8.5 7c0 3.4 1.9 6.3 4.2 8.4" />
      <path d="M15 9.5h4.5" />
      <path d="m16 19 2.2-6 2.3 6" />
      <path d="M16.7 17h3" />
    </IconBase>
  )
}

function AwardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 5.5h8v2.2a4 4 0 0 1-8 0V5.5Z" fill="#f5c24b" />
      <path d="M9.5 14.5h5l1.8 5-4.3-2.2-4.3 2.2 1.8-5Z" fill="#f5c24b" />
      <path d="M8 6H5.5A1.5 1.5 0 0 0 4 7.5v.4A3.6 3.6 0 0 0 7.6 11.5H8" stroke="#f5c24b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 6h2.5A1.5 1.5 0 0 1 20 7.5v.4a3.6 3.6 0 0 1-3.6 3.6H16" stroke="#f5c24b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="rgba(14, 18, 30, 0.84)" />
      <circle cx="12" cy="12" r="7.4" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" />
      <path d="m9.2 12.4 1.8 1.9 3.9-4.1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <IconBase>
      <path d="M9 12h6" />
      <path d="m12.5 8.5 3.5 3.5-3.5 3.5" />
      <path d="M7 19h9a2 2 0 0 0 2-2v-2" />
      <path d="M7 5h9a2 2 0 0 1 2 2v2" />
    </IconBase>
  )
}

function GlobeIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 12h15" />
      <path d="M12 4c2 2.1 3.2 5 3.2 8S14 17.9 12 20" />
      <path d="M12 4C10 6.1 8.8 9 8.8 12s1.2 5.9 3.2 8" />
    </IconBase>
  )
}

export default App
