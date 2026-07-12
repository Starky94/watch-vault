import { useEffect, useRef, useState } from 'react'
import './App.css'

const primaryViews = {
  home: 'Home',
  movies: 'Movies',
  tvShows: 'TV Shows',
  watchlist: 'Watchlist',
}

const navItems = [
  { label: 'Home', icon: HomeIcon, view: primaryViews.home },
  { label: 'Movies', icon: ClapperIcon, view: primaryViews.movies },
  { label: 'TV Shows', icon: TvIcon, view: primaryViews.tvShows },
  { label: 'Watchlist', icon: BookmarkIcon, view: primaryViews.watchlist },
  { label: 'Calendar', icon: CalendarIcon },
  { label: 'Stats', icon: BarsIcon },
]

const movieTabs = ['All Movies', 'Popular', 'Now Playing', 'Upcoming', 'Top Rated']
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
  search: 'search',
  movieDetail: 'movieDetail',
  tvDetail: 'tvDetail',
  personDetail: 'personDetail',
}

const authStorageKey = 'watchvault.auth.user'
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
  { label: 'Watchlist', icon: BookmarkIcon, view: primaryViews.watchlist },
  { label: 'Stats', icon: BarsIcon },
  { label: 'More', icon: MoreIcon },
]

const watchlistTabs = ['All', 'Movies', 'TV Shows', 'Actors']
const moviesPageSize = 30
const genreAccentPalette = ['#ff6b7a', '#7c8dff', '#ffd86f', '#84b3ff', '#ff6cb6', '#67e8f9', '#9ae66e']

const emptyMovieStats = {
  moviesWatched: 0,
  timeWatchedMinutes: 0,
  watchlistCount: 0,
}
const emptyTvStats = {
  showsWatched: 0,
  episodesWatched: 0,
  timeWatchedMinutes: 0,
  watchlistCount: 0,
}
const emptyCommunityRating = {
  average: null,
  voteCount: 0,
  yourScore: null,
}
const movieRatingOptions = Array.from({ length: 9 }, (_value, index) => 1 + index * 0.5)
const statsPeriods = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

function App() {
  const [currentRoute, setCurrentRoute] = useState(() => readAppRoute())
  const [activeView, setActiveView] = useState(() =>
    readAppRoute().kind === routeKinds.movieDetail || readAppRoute().kind === routeKinds.personDetail || readAppRoute().kind === routeKinds.tvDetail
      ? primaryViews.movies
      : primaryViews.home
  )
  const [activeMovieTab, setActiveMovieTab] = useState(movieTabs[0])
  const [activeTvTab, setActiveTvTab] = useState(tvShowTabs[0])
  const [activeWatchlistTab, setActiveWatchlistTab] = useState(watchlistTabs[0])
  const [moviesScreenMode, setMoviesScreenMode] = useState(movieScreenModes.overview)
  const [currentScreen, setCurrentScreen] = useState(appScreens.dashboard)
  const [searchInput, setSearchInput] = useState(() => readAppRoute().query || '')
  const [searchError, setSearchError] = useState('')
  const [searchResultsState, setSearchResultsState] = useState({
    status: 'idle',
    movies: [],
    shows: [],
    actors: [],
    error: '',
  })
  const [tmdbSearchState, setTmdbSearchState] = useState({
    status: 'idle',
    movies: [],
    shows: [],
    error: '',
  })
  const tmdbSearchRequestId = useRef(0)
  const [user, setUser] = useState(null)
  const [authStatus, setAuthStatus] = useState('idle')
  const [authError, setAuthError] = useState('')
  const [changePasswordState, setChangePasswordState] = useState({
    status: 'idle',
    error: '',
    message: '',
  })
  const [popularMoviesPage, setPopularMoviesPage] = useState(1)
  const [recentMoviesPage, setRecentMoviesPage] = useState(1)
  const [upcomingMoviesPage, setUpcomingMoviesPage] = useState(1)
  const [topRatedMoviesPage, setTopRatedMoviesPage] = useState(1)
  const [popularTvPage, setPopularTvPage] = useState(1)
  const [recentTvPage, setRecentTvPage] = useState(1)
  const [upcomingTvPage, setUpcomingTvPage] = useState(1)
  const [topRatedTvPage, setTopRatedTvPage] = useState(1)
  const [popularMoviesState, setPopularMoviesState] = useState(() => createMovieCollectionState({ includeFeaturedMovie: true }))
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
    error: '',
  })
  const [adminOverviewState, setAdminOverviewState] = useState({
    status: 'idle',
    crons: [],
    totalActors: 0,
    totalMovies: 0,
    storedDataBytes: 0,
    totalTvShows: 0,
    error: '',
  })
  const [adminRunState, setAdminRunState] = useState({})
  const [adminRefreshKey, setAdminRefreshKey] = useState(0)
  const [watchlistState, setWatchlistState] = useState({
    status: 'idle',
    movies: [],
    error: '',
  })
  const [favoriteActorsState, setFavoriteActorsState] = useState({
    status: 'idle',
    actors: [],
    error: '',
  })
  const [watchlistActionState, setWatchlistActionState] = useState({
    status: 'idle',
    movieId: null,
    error: '',
  })
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
  const [movieStatsState, setMovieStatsState] = useState({
    status: 'idle',
    stats: emptyMovieStats,
    error: '',
  })
  const [statsPeriod, setStatsPeriod] = useState('month')
  const [tvStatsState, setTvStatsState] = useState({ status: 'idle', stats: emptyTvStats, error: '' })
  const [continueWatchingState, setContinueWatchingState] = useState({ status: 'idle', shows: [], error: '' })
  const [selectedTvShowId, setSelectedTvShowId] = useState(null)
  const [tvWatchlistIds, setTvWatchlistIds] = useState(() => new Set(initialTvWatchlistIds))
  const [tvWatchlistShows, setTvWatchlistShows] = useState([])
  const [tvWatchedIds, setTvWatchedIds] = useState(() => new Set(initialTvWatchedIds))

  useEffect(() => {
    function handlePopState() {
      const nextRoute = readAppRoute()
      setCurrentRoute(nextRoute)
      setCurrentScreen(appScreens.dashboard)
      setActiveView(
        nextRoute.kind === routeKinds.movieDetail || nextRoute.kind === routeKinds.personDetail || nextRoute.kind === routeKinds.tvDetail
          ? primaryViews.movies
          : primaryViews.home
      )
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

    if (currentRoute.kind !== routeKinds.movieDetail && currentRoute.kind !== routeKinds.personDetail) {
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

  function handleSearchSubmit() {
    const query = searchInput.trim()

    if (!query) {
      setSearchError('Enter a title or actor to search.')
      return false
    }

    setSearchError('')
    handleNavigateToPath(buildSearchPath(query), { kind: routeKinds.search, query })
    return true
  }

  async function handleSearchTmdb() {
    const query = currentRoute.kind === routeKinds.search ? currentRoute.query : ''
    if (!query) return

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

  function handleOpenTvDetail(show) {
    const showId = Number(show?.id)
    if (!Number.isInteger(showId)) return
    handleNavigateToPath(`/tv/${showId}`, { kind: routeKinds.tvDetail, showId }, primaryViews.tvShows, { tvPreview: show })
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
      error: '',
    })

    handleNavigateToPath(buildPersonDetailPath(normalizedPersonId), {
      kind: routeKinds.personDetail,
      personId: normalizedPersonId,
    }, primaryViews.movies, {
      personPreview: person,
    })
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
    setActiveView(view)
    if (currentRoute.kind === routeKinds.movieDetail || currentRoute.kind === routeKinds.personDetail || currentRoute.kind === routeKinds.tvDetail) {
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

  function handleWatchlistTabChange(tab) {
    setActiveWatchlistTab(tab)
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
    } catch (error) {
      setTvStatsState((state) => ({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Unable to update TV library.' }))
    }
  }

  function handleToggleTvWatchlist(show) { return handleToggleTvLibrary(show, 'watchlist') }

  async function handleUpdateTvEpisodes(showId, { action, episodeId, seasonId }) {
    if (!user) return handleOpenLogin()
    const response = await fetch('/api/tv/episodes/watched', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(user) },
      body: JSON.stringify({ showId, action, episodeId, seasonId }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Unable to update episode')
    setTvDetailState({ status: 'success', show: mapTvDetailPayload(payload.show), error: '' })
    await loadTvLibraryForUser(user)
  }

  function handleOpenGenre(genre) {
    if (!genre?.name) {
      return
    }

    setActiveView(primaryViews.movies)
    setActiveMovieTab('All Movies')
    setSelectedGenre(genre)
    setGenreMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.genreList)

    if (currentRoute.kind === routeKinds.movieDetail || currentRoute.kind === routeKinds.personDetail) {
      handleNavigateToPath('/', { kind: routeKinds.home }, primaryViews.movies)
    } else if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
      setCurrentRoute({ kind: routeKinds.home })
    }
  }

  async function loadWatchlistForUser(nextUser) {
    if (!nextUser?.username) {
      setWatchlistState({
        status: 'idle',
        movies: [],
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
        error: '',
      })
    } catch (error) {
      setWatchlistState({
        status: 'error',
        movies: [],
        error: error instanceof Error ? error.message : 'Unable to load your watchlist right now.',
      })
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
          error: '',
        }
      })
      setWatchlistActionState({
        status: 'success',
        movieId: normalizedMovieId,
        error: '',
      })
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
        error: '',
      }))
      setWatchlistActionState({
        status: 'success',
        movieId: normalizedMovieId,
        error: '',
      })
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

  useEffect(() => {
    loadWatchlistForUser(user)
    loadWatchedForUser(user)
    loadTvLibraryForUser(user)
    loadFavoriteActorsForUser(user)
  }, [user, statsPeriod])

  async function handleAddMovieToWatched(movie) {
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
    } catch (error) {
      setWatchedActionState({
        status: 'error',
        movieId: normalizedMovieId,
        error: error instanceof Error ? error.message : 'Unable to mark this movie as watched right now.',
      })
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
    } catch (error) {
      setWatchedActionState({
        status: 'error',
        movieId: normalizedMovieId,
        error: error instanceof Error ? error.message : 'Unable to remove this watched movie right now.',
      })
    }
  }

  async function handleToggleMovieWatched(movie) {
    const normalizedMovieId = Number(movie?.id)

    if (!Number.isInteger(normalizedMovieId)) {
      return
    }

    const isWatched = watchedState.movies.some((watchedMovie) => Number(watchedMovie.id) === normalizedMovieId)

    if (isWatched) {
      await handleRemoveMovieFromWatched(movie)
      return
    }

    await handleAddMovieToWatched(movie)
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
        const response = await fetch('/api/admin/overview')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload.error || `Request failed with status ${response.status}`)
        }

        if (!cancelled) {
          setAdminOverviewState({
            status: 'success',
            crons: Array.isArray(payload.crons) ? payload.crons : [],
            totalActors: typeof payload?.totals?.actors === 'number' ? payload.totals.actors : 0,
            totalMovies: typeof payload?.totals?.movies === 'number' ? payload.totals.movies : 0,
            storedDataBytes: typeof payload?.totals?.storedDataBytes === 'number' ? payload.totals.storedDataBytes : 0,
            totalTvShows: typeof payload?.totals?.tvShows === 'number' ? payload.totals.tvShows : 0,
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
  }, [currentScreen, adminRefreshKey])

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
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || `Request failed with status ${response.status}`)
      }

      setAdminRunState((previousState) => ({
        ...previousState,
        [jobKey]: {
          status: 'success',
          message: `Imported ${payload.fetchedCount} titles: ${payload.insertedCount} new, ${payload.updatedCount} refreshed.`,
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

  useEffect(() => {
    tmdbSearchRequestId.current += 1
    setTmdbSearchState({ status: 'idle', movies: [], shows: [], error: '' })

    if (currentRoute.kind !== routeKinds.search || !currentRoute.query) {
      setSearchResultsState({
        status: 'idle',
        movies: [],
        shows: [],
        actors: [],
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
        const response = await fetch(`/api/people/${currentRoute.personId}`)
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
            error: error instanceof Error ? error.message : 'Unable to load the person detail right now.',
          })
        }
      }
    }

    loadPersonDetail()

    return () => {
      cancelled = true
    }
  }, [currentRoute])

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

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies', popularMoviesPage))

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
  }, [activeView, popularMoviesPage])

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

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies/upcoming', upcomingMoviesPage))

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
  }, [activeView, upcomingMoviesPage])

  useEffect(() => {
    if (activeView !== primaryViews.movies) {
      return
    }

    let cancelled = false

    async function loadRecentMovies() {
      setRecentMoviesState(createMovieCollectionLoadingState({ page: recentMoviesPage }))

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies/recently-released', recentMoviesPage))

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
  }, [activeView, recentMoviesPage])

  useEffect(() => {
    if (activeView !== primaryViews.movies) {
      return
    }

    let cancelled = false

    async function loadTopRatedMovies() {
      setTopRatedMoviesState(createMovieCollectionLoadingState({ page: topRatedMoviesPage }))

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies/top-rated', topRatedMoviesPage))

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
  }, [activeView, topRatedMoviesPage])

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
    if (activeView !== primaryViews.movies || moviesScreenMode !== movieScreenModes.genreList || !selectedGenre?.name) {
      return
    }

    let cancelled = false

    async function loadGenreMovies() {
      setGenreMoviesState(createMovieCollectionLoadingState({ page: genreMoviesPage }))

      try {
        const response = await fetch(buildMoviesApiPath('/api/movies', genreMoviesPage, moviesPageSize, {
          genre: selectedGenre.name,
        }))

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []
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
  }, [activeView, genreMoviesPage, moviesScreenMode, selectedGenre])

  const watchlistMovieIds = new Set(watchlistState.movies.map((movie) => Number(movie.id)))
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
          {navItems.map(({ label, icon: Icon, view }) => (
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
              onOpenAdmin={handleOpenAdmin}
              onOpenAccount={handleOpenAccount}
              onOpenLogin={handleOpenLogin}
              onLogout={handleLogout}
              user={user}
            />
            <MobileHeader
              onOpenLogin={handleOpenLogin}
              searchError={searchError}
              searchInput={searchInput}
              onSearchInputChange={(value) => {
                setSearchInput(value)
                if (searchError) setSearchError('')
              }}
              onSearchSubmit={handleSearchSubmit}
              user={user}
            />

            {currentScreen === appScreens.admin ? (
              <AdminScreen
                adminOverviewState={adminOverviewState}
                adminRunState={adminRunState}
                onBack={handleOpenDashboard}
                onRunJob={handleRunAdminJob}
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
                query={currentRoute.query}
                searchResultsState={searchResultsState}
                tmdbSearchState={tmdbSearchState}
                onSearchTmdb={handleSearchTmdb}
                onOpenMovie={handleOpenMovieDetail}
                onOpenTvShow={handleOpenTvDetail}
                onOpenPerson={handleOpenPersonDetail}
                watchedMovieIds={watchedMovieIds}
                watchlistMovieIds={watchlistMovieIds}
                watchedTvIds={tvWatchedIds}
                watchlistTvIds={tvWatchlistIds}
              />
            ) : currentRoute.kind === routeKinds.tvDetail ? (
              <TvDetailPage
                tvDetailState={tvDetailState}
                tvReviewsState={tvReviewsState}
                onBackToTv={() => handleMovieViewSelection(primaryViews.tvShows)}
                onToggleWatchlist={handleToggleTvWatchlist}
                onUpdateEpisodes={handleUpdateTvEpisodes}
                onOpenTv={handleOpenTvDetail}
                onOpenPerson={handleOpenPersonDetail}
                onOpenLogin={handleOpenLogin}
                isSignedIn={Boolean(user)}
                watchlistIds={tvWatchlistIds}
              />
            ) : activeView === primaryViews.home ? (
              <HomeScreen
                user={user}
                onOpenMovie={handleOpenMovieDetail}
                onOpenPopularMovies={handleOpenPopularMovies}
                onOpenWatchlist={handleOpenWatchlistCta}
                stats={homeStats}
                statsPeriod={statsPeriod}
                onStatsPeriodChange={setStatsPeriod}
                watchlistState={watchlistState}
                popularMoviesState={popularMoviesState}
                continueWatchingState={continueWatchingState}
                onOpenTvShow={handleOpenTvDetail}
                latestEpisodesState={latestEpisodesState}
                onOpenLatestEpisodes={handleOpenRecentlyAiredTvShows}
                tvWatchlistIds={tvWatchlistIds}
                tvWatchedIds={tvWatchedIds}
              />
            ) : activeView === primaryViews.watchlist ? (
              <WatchlistScreen
                activeTab={activeWatchlistTab}
                isSignedIn={Boolean(user)}
                onTabChange={handleWatchlistTabChange}
                onOpenLogin={handleOpenLogin}
                onOpenMovie={handleOpenMovieDetail}
                onOpenTvShow={handleOpenTvDetail}
                onOpenPerson={handleOpenPersonDetail}
                favoriteActorsState={favoriteActorsState}
                watchlistState={watchlistState}
                tvWatchlistShows={tvWatchlistShows}
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
            ) : currentRoute.kind === routeKinds.personDetail ? (
              <PersonDetailPage
                personDetailState={personDetailState}
                onBackToMovies={() => handleMovieViewSelection(primaryViews.movies)}
                onOpenMovie={handleOpenMovieDetail}
                onOpenPerson={handleOpenPersonDetail}
                isSignedIn={Boolean(user)}
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
                onSubmitMovieRating={handleSubmitMovieRating}
                onOpenLogin={handleOpenLogin}
                onOpenMovie={handleOpenMovieDetail}
                isSignedIn={Boolean(user)}
                movieRatingActionState={movieRatingActionState}
                watchedActionState={watchedActionState}
                watchedMovieIds={watchedMovieIds}
                watchedMovies={watchedState.movies}
                watchlistActionState={watchlistActionState}
                watchlistMovieIds={watchlistMovieIds}
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
              <MobileNav activeView={activeView} setActiveView={handleMovieViewSelection} />
            ) : null}
          </>
        )}
      </main>
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
        <p className="brand-name">WatchVault</p>
      </div>
    </div>
  )
}

function DesktopTopbar({ onOpenAdmin, onOpenAccount, onOpenLogin, onLogout, onSearchInputChange, onSearchSubmit, searchError, searchInput, user }) {
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
        <label className="searchbar" aria-label="Search movies, shows, and actors">
          <SearchIcon />
          <input
            type="text"
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Search movies, shows, actors..."
            aria-invalid={Boolean(searchError)}
            aria-describedby={searchError ? 'desktop-search-error' : undefined}
          />
        </label>
        <button type="submit" className="search-submit-button">Search</button>
        {searchError ? <span id="desktop-search-error" className="search-error" role="alert">{searchError}</span> : null}
      </form>

      <div className="topbar-actions">
        <button type="button" className="icon-button">
          <BellIcon />
          <span className="notification-dot" />
        </button>

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

function MobileHeader({ onOpenLogin, onSearchInputChange, onSearchSubmit, searchError, searchInput, user }) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="mobile-only">
      <header className="mobile-header">
        <Brand />

        <div className="mobile-actions">
          <button type="button" className="icon-button" aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen((value) => !value)}>
            <SearchIcon />
          </button>
          <button type="button" className="icon-button">
            <BellIcon />
          </button>
          {user ? (
            <button type="button" className="avatar-button" aria-label={user.fullName}>
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
          <label className="searchbar" aria-label="Search movies, shows, and actors">
            <SearchIcon />
            <input type="text" autoFocus value={searchInput} onChange={(event) => onSearchInputChange(event.target.value)} placeholder="Search movies, shows, actors..." aria-invalid={Boolean(searchError)} aria-describedby={searchError ? 'mobile-search-error' : undefined} />
          </label>
          <button type="submit" className="search-submit-button">Search</button>
          {searchError ? <span id="mobile-search-error" className="search-error" role="alert">{searchError}</span> : null}
        </form>
      ) : null}
    </div>
  )
}

function SearchResultsPage({
  onOpenMovie,
  onOpenPerson,
  onSearchTmdb,
  onOpenTvShow,
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
          <p>Enter a movie, show, or actor in the search field above.</p>
        </div>
      </section>
    )
  }

  const isLoading = searchResultsState.status === 'loading' || searchResultsState.status === 'idle'
  const hasError = searchResultsState.status === 'error'
  const isTmdbLoading = tmdbSearchState.status === 'loading'
  const showingTmdbResults = tmdbSearchState.status === 'success'
  const titleMovies = showingTmdbResults ? tmdbSearchState.movies : searchResultsState.movies
  const titleShows = showingTmdbResults ? tmdbSearchState.shows : searchResultsState.shows

  return (
    <section className="search-results-page">
      <div className="search-results-heading">
        <p className="eyebrow">Search results</p>
        <h1>Results for “{query}”</h1>
        <div className="tmdb-search-action">
          <button type="button" className="search-tmdb-button" onClick={onSearchTmdb} disabled={isTmdbLoading}>
            {isTmdbLoading ? 'Searching TMDB…' : 'Search TMDB'}
          </button>
          {tmdbSearchState.status === 'error' ? <p className="tmdb-search-error" role="alert">Could not search TMDB. {tmdbSearchState.error}</p> : null}
        </div>
      </div>

      <SearchResultGroup title={showingTmdbResults ? 'TMDB Movies' : 'Movies'} isLoading={isLoading || isTmdbLoading} error={hasError ? searchResultsState.error : ''} items={titleMovies} emptyMessage={showingTmdbResults ? 'No TMDB movies matched this search.' : 'No movies matched this search.'}>
        <div className="movie-card-grid popular-movies-catalog">
          {titleMovies.map((movie) => <MovieCard key={movie.id} movie={movie} onOpenMovie={onOpenMovie} isWatched={watchedMovieIds.has(Number(movie.id))} isInWatchlist={watchlistMovieIds.has(Number(movie.id))} />)}
        </div>
      </SearchResultGroup>

      <SearchResultGroup title={showingTmdbResults ? 'TMDB TV Shows' : 'TV Shows'} isLoading={isLoading || isTmdbLoading} error={hasError ? searchResultsState.error : ''} items={titleShows} emptyMessage={showingTmdbResults ? 'No TMDB TV shows matched this search.' : 'No TV shows matched this search.'}>
        <div className="tv-show-card-grid popular-movies-catalog">
          {titleShows.map((show) => <TvShowPosterCard key={show.id} show={show} onSelectShow={onOpenTvShow} isWatched={watchedTvIds.has(Number(show.id))} isInWatchlist={watchlistTvIds.has(Number(show.id))} />)}
        </div>
      </SearchResultGroup>

      <SearchResultGroup title="Actors" isLoading={isLoading} error={hasError ? searchResultsState.error : ''} items={searchResultsState.actors} emptyMessage="No actors matched this search.">
        <div className="favorite-actors-grid">
          {searchResultsState.actors.map((actor) => <FavoriteActorCard key={actor.id} actor={actor} onOpenPerson={onOpenPerson} />)}
        </div>
      </SearchResultGroup>
    </section>
  )
}

function SearchResultGroup({ children, emptyMessage, error, isLoading, items, title }) {
  return (
    <section className="content-section search-results-group">
      <div className="section-header"><h2>{title}</h2><span className="search-result-count">{isLoading ? '' : items.length}</span></div>
      {isLoading ? <SectionMessage message={`Searching ${title.toLowerCase()}...`} /> : error ? <SectionMessage tone="error" message={`Could not search ${title.toLowerCase()}. ${error}`} /> : items.length ? children : <SectionMessage message={emptyMessage} />}
    </section>
  )
}

function HomeScreen({ user, onOpenMovie, onOpenPopularMovies, onOpenWatchlist, stats, statsPeriod, onStatsPeriodChange, watchlistState, popularMoviesState, continueWatchingState, onOpenTvShow, latestEpisodesState, onOpenLatestEpisodes, tvWatchlistIds, tvWatchedIds }) {
  const greeting = user ? `Good evening, ${getFirstName(user.fullName)}! 🍿` : 'Good evening! 🍿'
  const homeWatchlistMovies = watchlistState.movies.slice(0, 5)
  const trendingMovies = popularMoviesState.movies.slice(0, 5)

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">{greeting}</p>
          <h1>Track every story. Every screen.</h1>
          <p className="hero-subcopy">Your next favorite is already on your list.</p>

          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={onOpenWatchlist}>
              <PlusIcon />
              <span>Add to Watchlist</span>
            </button>
            <button type="button" className="secondary-button">
              <SparklesIcon />
              <span>Discover</span>
            </button>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="skyline-glow" />
          <div className="skyline skyline-left" />
          <div className="skyline skyline-right" />
          <div className="couch" />
          <div className="person person-left" />
          <div className="person person-right" />
        </div>

        <StatsPanel title="Your Stats" items={stats} period={statsPeriod} onPeriodChange={onStatsPeriodChange} />
      </section>

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

      <ContentSection title="Continue Watching" action="See all">
        {continueWatchingState.status === 'loading' ? <SectionMessage message="Loading your TV progress..." /> : null}
        {continueWatchingState.status === 'error' ? <SectionMessage message={continueWatchingState.error} tone="error" /> : null}
        {continueWatchingState.status === 'idle' ? <SectionMessage message="Sign in to view shows you are watching." /> : null}
        {continueWatchingState.status === 'success' && continueWatchingState.shows.length === 0 ? <SectionMessage message="Start watching a TV show to see it here." /> : null}
        {continueWatchingState.shows.length > 0 ? <div className="feature-grid">{continueWatchingState.shows.map((item) => <ProgressCard key={item.id} item={item} onOpenTvShow={onOpenTvShow} />)}</div> : null}
      </ContentSection>

      <section className="split-row">
        <ContentSection title="Watchlist" action="See all" onAction={onOpenWatchlist} compact>
          {watchlistState.status === 'loading' ? <SectionMessage message="Loading your watchlist..." /> : null}
          {watchlistState.status === 'error' ? <SectionMessage message={watchlistState.error} tone="error" /> : null}
          {watchlistState.status !== 'loading' && watchlistState.status !== 'error' && homeWatchlistMovies.length === 0 ? (
            <SectionMessage message={user ? 'Your watchlist is empty for now.' : 'Sign in to view your watchlist.'} />
          ) : null}
          {homeWatchlistMovies.length > 0 ? (
            <div className="compact-grid">
              {homeWatchlistMovies.map((item) => (
                <RatingCard key={item.id} item={item} onOpenMovie={onOpenMovie} />
              ))}
            </div>
          ) : null}
        </ContentSection>

        <ContentSection title="Trending Now" action="See all" onAction={onOpenPopularMovies} compact>
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
            <div className="compact-grid compact-grid--trending">
              {trendingMovies.map((item) => (
                <RatingCard key={item.id} item={item} onOpenMovie={onOpenMovie} />
              ))}
            </div>
          ) : null}
        </ContentSection>
      </section>

      <ContentSection title="New Episodes" action="See all" onAction={onOpenLatestEpisodes}>
        <TvShowsGrid tvState={latestEpisodesState} onSelectShow={onOpenTvShow} watchedIds={tvWatchedIds} watchlistIds={tvWatchlistIds} />
      </ContentSection>
    </>
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

function AdminScreen({ adminOverviewState, adminRunState, onBack, onRunJob }) {
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
          <span>Stored Data Size</span>
          <strong>{adminOverviewState.status === 'success' ? formatAdminBytes(adminOverviewState.storedDataBytes) : '--'}</strong>
          <p>Total size used by the app tables currently stored in the database.</p>
        </article>
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
  const isGenreListMode = screenMode === movieScreenModes.genreList && Boolean(selectedGenre?.name)
  const isPopularListMode = screenMode === movieScreenModes.popularList && activeTab === 'Popular'
  const isNowPlayingListMode = screenMode === movieScreenModes.nowPlayingList && activeTab === 'Now Playing'
  const isTopRatedListMode = screenMode === movieScreenModes.topRatedList && activeTab === 'Top Rated'
  const isUpcomingListMode = screenMode === movieScreenModes.upcomingList && activeTab === 'Upcoming'
  const watchlistMovieIds = new Set(watchlistMovies.map((movie) => Number(movie.id)))

  return (
    <section className="movies-page">
      <div className="movies-heading">
        <h1>Movies</h1>
        <p>
          {isGenreListMode
            ? `Browse every locally stored movie tagged with ${selectedGenre.name}.`
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

      <section className="tab-row movies-tab-row" aria-label="Movie filters">
        {movieTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`filter-pill${tab === activeTab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </section>

      {isGenreListMode ? (
        <ContentSection title={`${selectedGenre.name} Movies`}>
          <GenreMoviesGrid
            genreMoviesState={genreMoviesState}
            onOpenMovie={onOpenMovie}
            watchedMovieIds={watchedMovieIds}
            watchlistMovieIds={watchlistMovieIds}
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
                />
              </ContentSection>

              <ContentSection title="Recently Released" action="View all" onAction={onOpenRecentlyReleasedMovies}>
                <RecentlyReleasedSlider
                  recentMoviesState={recentMoviesState}
                  onOpenMovie={onOpenMovie}
                  watchedMovieIds={watchedMovieIds}
                  watchlistMovieIds={watchlistMovieIds}
                />
              </ContentSection>

              <ContentSection title="Upcoming Soon" action="View all" onAction={onOpenUpcomingMovies}>
                <UpcomingMoviesGrid
                  upcomingMoviesState={upcomingMoviesState}
                  onOpenMovie={onOpenMovie}
                  watchedMovieIds={watchedMovieIds}
                  watchlistMovieIds={watchlistMovieIds}
                />
              </ContentSection>

              <ContentSection title="Top Rated" action="View all" onAction={onOpenTopRatedMovies}>
                <TopRatedMoviesGrid
                  topRatedMoviesState={topRatedMoviesState}
                  onOpenMovie={onOpenMovie}
                  watchedMovieIds={watchedMovieIds}
                  watchlistMovieIds={watchlistMovieIds}
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
        <div className="tv-layout">
          <div className="tv-main">
            <TvFeaturedCard
              show={featuredShow}
              isWatched={watchedIds.has(Number(featuredShow?.id))}
              isInWatchlist={watchlistIds.has(Number(featuredShow?.id))}
              onToggleWatchlist={onToggleWatchlist}
            />

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

          <aside className="tv-rail">
            <StatsPanel className="tv-stats-panel" title="Your TV Stats" items={tvStats} period={statsPeriod} onPeriodChange={onStatsPeriodChange} />
            <TvWatchlistPanel items={watchlistShows} onOpenWatchlist={onOpenWatchlist} onSelectShow={onSelectShow} />
          </aside>
        </div>
      )}

      <section className="movie-mobile-stats tv-mobile-stats mobile-only">
        {tvStats.map(({ label, value, tone, icon: Icon }) => (
          <article key={label} className="mini-stat">
            <div className={`stat-icon ${tone}`}>
              <Icon />
            </div>
            <strong>{value}</strong>
            <span>{label.replace('Shows Watched', 'Shows').replace('Episodes Watched', 'Episodes').replace('Hours Watched', 'Hours').replace('In Watchlist', 'Watchlist')}</span>
          </article>
        ))}
      </section>
    </section>
  )
}

function WatchlistScreen({
  activeTab,
  isSignedIn,
  onTabChange,
  onOpenLogin,
  onOpenMovie,
  onOpenPerson,
  onOpenTvShow,
  favoriteActorsState,
  watchlistState,
  tvWatchlistShows,
}) {
  const allItems = [...watchlistState.movies, ...tvWatchlistShows]
  const filteredItems = getFilteredWatchlistItems({
    items: allItems,
    activeTab,
  })

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
          <p>Organize everything you want to watch next.</p>
        </div>

        <section className="watchlist-stats-panel" aria-label="Watchlist summary">
          {[
            { label: 'Total', value: String(allItems.length), caption: 'In Watchlist' },
            { label: 'Movies', value: String(watchlistState.movies.length), caption: 'Titles' },
            { label: 'TV Shows', value: String(tvWatchlistShows.length), caption: 'Series' },
            { label: 'Actors', value: String(favoriteActorsState.actors.length), caption: 'Favorites' },
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
        {watchlistTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`watchlist-pill${tab === activeTab ? ' active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Actors' ? (
        <div className="favorite-actors-grid">
          {favoriteActorsState.actors.map((actor) => <FavoriteActorCard key={actor.id} actor={actor} onOpenPerson={onOpenPerson} />)}
        </div>
      ) : (
        <div className="watchlist-grid-mobile">
          {filteredItems.map((item) => (
            <WatchlistCard key={`${item.type}-${item.id}`} item={item} compact onOpenMovie={item.type === 'TV Shows' ? onOpenTvShow : onOpenMovie} />
          ))}
        </div>
      )}

      {watchlistState.status === 'loading' ? <SectionMessage message="Loading your watchlist..." /> : null}
      {watchlistState.status === 'error' ? <SectionMessage message={watchlistState.error} tone="error" /> : null}
      {activeTab === 'Actors' && favoriteActorsState.status === 'loading' ? <SectionMessage message="Loading favorite actors..." /> : null}
      {activeTab === 'Actors' && favoriteActorsState.status === 'error' ? <SectionMessage message={favoriteActorsState.error} tone="error" /> : null}
      {activeTab === 'Actors' && favoriteActorsState.status !== 'loading' && favoriteActorsState.status !== 'error' && favoriteActorsState.actors.length === 0
        ? <SectionMessage message="Favorite actors will appear here." />
        : null}
      {activeTab !== 'Actors' && watchlistState.status !== 'loading' && watchlistState.status !== 'error' && filteredItems.length === 0
        ? <SectionMessage message="No watchlist titles match this section yet." />
        : null}
    </section>
  )
}

function FavoriteActorCard({ actor, onOpenPerson }) {
  const [imageUnavailable, setImageUnavailable] = useState(false)
  const showImage = Boolean(actor.profileUrl) && !imageUnavailable

  return (
    <button type="button" className="favorite-actor-card" onClick={() => onOpenPerson(actor)} aria-label={`Open ${actor.name}`}>
      <div className={`favorite-actor-portrait${showImage ? ' has-image' : ''}`}>
        {showImage ? <img src={actor.profileUrl} alt={`${actor.name} portrait`} loading="lazy" onError={() => setImageUnavailable(true)} /> : <span>{getMovieCreditInitials(actor.name)}</span>}
      </div>
      <div><h2>{actor.name}</h2><p>{actor.role || 'Actor'}</p></div>
    </button>
  )
}

function TvFeaturedCard({ show, isWatched, isInWatchlist, onToggleWatchlist }) {
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
        </div>
      </div>

      <div
        className={`tv-feature-art${showBackdropImage ? ' has-image' : ` ${show.theme}`}`}
        style={artStyle}
        aria-hidden="true"
      >
        <span className="feature-arrow">
          <ChevronRight />
        </span>
        <div className="feature-dots">
          <span className="active" />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  )
}

function TvShowPosterCard({ show, onSelectShow, isActive = false, isInWatchlist = false, isWatched = false }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(show.posterUrl) && !posterUnavailable

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
        <h3>{show.title}</h3>
        <p>{show.year}</p>
        <div className="rating-row">
          <span className="star-rating">
            <StarIcon />
            {show.rating}
          </span>
          <span>{show.seasonMeta}</span>
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
        />
      ))}
    </div>
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

function TvDetailPage({ tvDetailState, tvReviewsState, onBackToTv, onToggleWatchlist, onUpdateEpisodes, onOpenTv, onOpenPerson, onOpenLogin, isSignedIn, watchlistIds }) {
  const [seasonNumber, setSeasonNumber] = useState(null)
  const [trailer, setTrailer] = useState(null)
  const [catchUpEpisode, setCatchUpEpisode] = useState(null)
  const [isUpdatingEpisodes, setIsUpdatingEpisodes] = useState(false)
  useEffect(() => { setSeasonNumber(null); setTrailer(null); setCatchUpEpisode(null); setIsUpdatingEpisodes(false) }, [tvDetailState.show?.id])
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

  async function updateEpisodes(request) {
    setIsUpdatingEpisodes(true)
    try {
      await onUpdateEpisodes(show.id, request)
      setCatchUpEpisode(null)
    } finally {
      setIsUpdatingEpisodes(false)
    }
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
    void updateEpisodes({ action: 'mark_episode', episodeId: episode.id })
  }

  function handleMarkSeasonWatched() {
    if (!isSignedIn) return onOpenLogin()
    if (!season || isSeasonWatched) return
    void updateEpisodes({ action: 'mark_season', seasonId: season.id })
  }
  return <section className="movie-detail-page tv-detail-page">
    <button type="button" className="movie-detail-back" onClick={onBackToTv} aria-label="Back to TV shows"><ChevronLeftIcon /></button>
    <article className="movie-detail-hero" style={backdropStyle}>
      <div className="movie-detail-hero-overlay" />
      <div className="movie-detail-poster-wrap"><div className="movie-detail-poster">{show.posterUrl ? <img className="movie-detail-poster-image" src={show.posterUrl} alt={`${show.title} poster`} /> : null}</div></div>
      <div className="movie-detail-main"><h1>{show.title}</h1><div className="movie-detail-meta"><span>{show.year}</span><span>{show.genresLabel}</span><span>{show.maturityRating}</span><span>{show.seasons.length} Seasons</span></div>
        <div className="movie-detail-score-row"><MetricBadge icon={StarIcon} value={show.voteAverage} label="TMDB" tone="gold" /><MetricBadge icon={TomatoIcon} value={show.voteCount} label="Votes" tone="tomato" /><MetricBadge icon={ProgressIcon} value={`${watchedCount}/${totalEpisodes}`} label="Episodes watched" tone="violet" /></div>
        <p className="movie-detail-summary">{show.overview}</p><div className="movie-detail-actions"><button type="button" className={`primary-button movie-detail-primary${isWatchlist ? ' is-active' : ''}`} onClick={() => onToggleWatchlist(show)}><PlusIcon /><span>{isWatchlist ? 'In Watchlist' : 'Add to Watchlist'}</span></button>{show.trailer ? <button type="button" className="secondary-button movie-detail-secondary ghost" onClick={() => setTrailer(show.trailer)}><PlayIcon /><span>Trailer</span></button> : null}</div>
      </div>
      <aside className="movie-detail-status desktop-only"><h2>Your Status</h2><div className="movie-detail-status-list"><div className="movie-detail-status-item"><span className="movie-detail-status-icon"><BookmarkStatusIcon /></span><div><span>Watchlist</span><strong>{isWatchlist ? 'Saved' : 'Not yet'}</strong></div></div><div className="movie-detail-status-item"><span className="movie-detail-status-icon"><ProgressIcon /></span><div><span>Progress</span><strong>{watchedCount} of {totalEpisodes}</strong></div></div><div className="movie-detail-status-item"><span className="movie-detail-status-icon"><CalendarIcon /></span><div><span>First air date</span><strong>{show.firstAirDateLabel}</strong></div></div><div className="movie-detail-status-item"><span className="movie-detail-status-icon"><TvIcon /></span><div><span>Network</span><strong>{show.network || 'TBA'}</strong></div></div></div></aside>
    </article>
    <section className="content-section movie-detail-panel tv-episodes-panel">
      <div className="section-header tv-episodes-header">
        <div><h2>Episodes</h2><span>{episodes.length} Episodes</span></div>
        <button type="button" className="secondary-button tv-season-watch-button" disabled={isUpdatingEpisodes || isSeasonWatched || seasonAiredEpisodes.length === 0} onClick={handleMarkSeasonWatched}>
          <CheckIcon /><span>{isSeasonWatched ? 'Season watched' : isUpdatingEpisodes ? 'Updating...' : 'Mark season watched'}</span>
        </button>
      </div>
      <div className="tv-season-tabs">{show.seasons.map((item) => <button type="button" key={item.id} className={`filter-pill${item.seasonNumber === season?.seasonNumber ? ' active' : ''}`} onClick={() => setSeasonNumber(item.seasonNumber)}>{item.name}</button>)}</div>
      <div className="tv-episode-list">{episodes.map((episode) => <article className="tv-episode-row" key={episode.id}><div className="tv-episode-still">{episode.stillUrl ? <img src={episode.stillUrl} alt="" /> : null}</div><div className="tv-episode-copy"><span>S{season?.seasonNumber} E{episode.episodeNumber} · {episode.airDateLabel} · {episode.runtimeLabel}</span><h3>{episode.name}</h3><p>{episode.overview || 'Episode overview is not available.'}</p></div><button type="button" disabled={!episode.isAired || isUpdatingEpisodes} className={`tv-episode-toggle${episode.watched ? ' watched' : ''}`} aria-label={episode.isAired ? `${episode.watched ? 'Mark unwatched' : 'Mark watched'} ${episode.name}` : `${episode.name} has not aired yet`} onClick={() => handleEpisodeToggle(episode)}><CheckIcon /></button></article>)}</div>
    </section>
    <div className="movie-detail-grid"><section className="content-section movie-detail-panel"><div className="section-header"><h2>Cast &amp; Crew</h2></div><div className="movie-detail-cast">{show.credits.map((member) => <button type="button" className="movie-detail-cast-card movie-detail-cast-card-button" key={`${member.id}-${member.role}`} aria-label={`Open ${member.name}`} onClick={() => onOpenPerson?.(member)} disabled={!Number.isInteger(Number(member.id))}><div className="movie-detail-cast-avatar" style={buildMovieCreditAvatarStyle(member.profileUrl)} aria-label={member.name}>{!member.profileUrl ? getMovieCreditInitials(member.name) : null}</div><h3>{member.name}</h3><p>{member.role}</p></button>)}</div></section><section className="content-section movie-detail-panel movie-detail-activity"><div className="section-header"><h2>Your Activity</h2></div><div className="movie-detail-activity-grid"><div className="movie-detail-activity-item"><ProgressIcon /><div><span>Completion</span><div className="movie-detail-progress"><span style={{ width: totalEpisodes ? `${(watchedCount / totalEpisodes) * 100}%` : '0%' }} /></div></div><strong>{totalEpisodes ? Math.round((watchedCount / totalEpisodes) * 100) : 0}%</strong></div><div className="movie-detail-activity-item"><CheckIcon /><div><span>Episodes watched</span><strong>{watchedCount} of {totalEpisodes}</strong></div></div></div></section><section className="content-section movie-detail-panel"><div className="section-header"><h2>More Like This</h2></div><div className="tv-recommendations">{show.recommendations.map((item) => <button key={item.id} type="button" onClick={() => onOpenTv(item)} className="tv-recommendation"><img src={item.posterUrl} alt="" /><span>{item.title}</span><small>{item.rating}</small></button>)}</div></section><section className="content-section movie-detail-panel movie-detail-facts"><div className="movie-detail-facts-list"><DetailFactRow icon={DirectorIcon} label="Created by" value={show.creatorsLabel} /><DetailFactRow icon={LanguageIcon} label="Language" value={show.languagesLabel} /><DetailFactRow icon={TvIcon} label="Status" value={show.status} /></div></section><section className="content-section movie-detail-panel movie-detail-reviews"><div className="section-header"><h2>Community Reviews</h2></div>{tvReviewsState.status === 'loading' ? <SectionMessage message="Loading live community reviews..." /> : tvReviewsState.status === 'error' ? <SectionMessage tone="error" message={tvReviewsState.error} /> : tvReviewsState.reviews.length ? <div className="movie-detail-review-grid">{tvReviewsState.reviews.map((review) => <article key={review.id} className="movie-detail-review-card"><strong>{review.author}</strong><span className="movie-detail-stars">{review.rating ? `★ ${review.rating}` : 'No score'}</span><p>{review.copy}</p><small>{review.date}</small></article>)}</div> : <SectionMessage message="No community reviews available right now." />}</section></div>
    {trailer ? <MovieTrailerDialog movie={{ title: show.title }} trailer={trailer} onClose={() => setTrailer(null)} /> : null}
    {catchUpEpisode ? <TvEpisodeCatchUpDialog episode={catchUpEpisode.episode} earlierCount={catchUpEpisode.earlierCount} isSaving={isUpdatingEpisodes} onCancel={() => setCatchUpEpisode(null)} onMarkCurrent={() => { void updateEpisodes({ action: 'mark_episode', episodeId: catchUpEpisode.episode.id }) }} onMarkEarlier={() => { void updateEpisodes({ action: 'mark_through_episode', episodeId: catchUpEpisode.episode.id }) }} /> : null}
  </section>
}

function WatchlistCard({ item, compact = false, onOpenMovie }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPoster = Boolean(item.posterUrl) && !posterUnavailable

  return (
    <button
      type="button"
      className={`watchlist-card watchlist-card-button${compact ? ' compact' : ''}`}
      onClick={() => onOpenMovie(item)}
      aria-label={`Open ${item.title}`}
    >
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
          <span className={`poster-badge${item.checked ? ' checked' : ''}`}>{item.checked ? <CheckCircleIcon /> : <StarIcon />}</span>
        </div>
        {item.seasonTag ? <span className="watchlist-season-tag">{item.seasonTag}</span> : null}
      </div>

      <div className="watchlist-card-copy">
        <h3>{item.title}</h3>
        <p>
          {item.year} <span>•</span> {item.meta}
        </p>

        {item.progress ? (
          <div className="watchlist-progress-wrap">
            <div className="watchlist-progress-track">
              <span style={{ width: `${item.progress}%` }} />
            </div>
            <strong>{item.progressLabel}</strong>
          </div>
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
  watchedActionState,
  watchedMovieIds,
  watchedMovies,
  watchlistActionState,
  watchlistMovieIds,
  onSubmitMovieRating,
  onOpenLogin,
  isSignedIn,
  movieRatingActionState,
}) {
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5)
  const [trailerState, setTrailerState] = useState({ status: 'idle', trailer: null, error: '' })

  useEffect(() => {
    setTrailerState({ status: 'idle', trailer: null, error: '' })
  }, [movieDetailState.movie?.id])

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

  const isTrailerLoading = trailerState.status === 'loading'

  return (
    <section className="movie-detail-page">
      <button type="button" className="movie-detail-back mobile-only" onClick={onBackToMovies}>
        <ChevronLeftIcon />
      </button>

      <article className="movie-detail-hero" style={backdropStyle}>
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

          <div className="movie-detail-score-row">
            <MetricBadge icon={StarIcon} value={movie.score} label="IMDb" tone="gold" />
            <MetricBadge icon={TomatoIcon} value={movie.tomatoScore} label="Rotten Tomatoes" tone="tomato" />
            <MetricBadge icon={UserRatingIcon} value={communityRatingLabel} label={`${communityRating.voteCount} ${communityRating.voteCount === 1 ? 'vote' : 'votes'}`} tone="violet" />
          </div>

          <p className="movie-detail-summary">{movie.overview}</p>

          <div className="movie-detail-actions">
            <button
              type="button"
              className={`primary-button movie-detail-primary${isInWatchlist ? ' is-active' : ''}`}
              onClick={() => onToggleWatchlist(movie)}
              disabled={isWatchlistUpdating || isWatched}
            >
              <PlusIcon />
              <span>
                {isWatchlistUpdating
                  ? 'Updating...'
                  : isWatched
                    ? 'Watched'
                    : isInWatchlist
                      ? 'In Watchlist'
                      : 'Add to Watchlist'}
              </span>
            </button>
            <button
              type="button"
              className={`secondary-button movie-detail-secondary${isWatched ? ' is-active' : ''}`}
              onClick={() => onToggleWatched(movie)}
              disabled={isWatchedUpdating}
            >
              <CheckIcon />
              <span>
                {isWatchedUpdating
                  ? 'Updating...'
                  : isWatched
                    ? 'Watched'
                    : 'Mark as Watched'}
              </span>
            </button>
            <button
              type="button"
              className="secondary-button movie-detail-secondary ghost"
              onClick={() => {
                if (!isSignedIn) {
                  onOpenLogin()
                  return
                }

                setSelectedRating(communityRating.yourScore ?? 5)
                setIsRatingDialogOpen(true)
              }}
            >
              <StarOutlineIcon />
              <span>{communityRating.yourScore === null ? 'Rate' : 'Update Rating'}</span>
            </button>
            <button type="button" className="secondary-button movie-detail-secondary ghost desktop-only" onClick={handleOpenTrailer} disabled={isTrailerLoading}>
              <PlayIcon />
              <span>{isTrailerLoading ? 'Loading...' : 'Trailer'}</span>
            </button>
          </div>
          {trailerState.status === 'error' ? <p className="movie-trailer-error" role="alert">{trailerState.error}</p> : null}
        </div>

        <aside className="movie-detail-status desktop-only">
          <h2>Your Status</h2>
          <div className="movie-detail-status-list">
            <div className="movie-detail-status-item movie-detail-status-item-watchlist">
              <span className="movie-detail-status-icon" aria-hidden="true"><BookmarkStatusIcon /></span>
              <div>
                <span>In Watchlist</span>
                <strong>{isInWatchlist ? 'Saved' : 'Not yet'}</strong>
              </div>
            </div>
            <div className="movie-detail-status-item movie-detail-status-item-watched">
              <span className="movie-detail-status-icon" aria-hidden="true"><WatchedStatusIcon /></span>
              <div>
                <span>Watched</span>
                <strong>{watchedLabel}</strong>
              </div>
            </div>
            <div className="movie-detail-status-item movie-detail-status-item-rating">
              <span className="movie-detail-status-icon" aria-hidden="true"><StarOutlineIcon /></span>
              <div>
                <span>Your Rating</span>
                <strong>{yourRatingLabel}</strong>
              </div>
            </div>
            <div className="movie-detail-status-item movie-detail-status-item-runtime">
              <span className="movie-detail-status-icon" aria-hidden="true"><ClockIcon /></span>
              <div>
                <span>Runtime</span>
                <strong>{movie.runtime}</strong>
              </div>
            </div>
            <div className="movie-detail-status-item movie-detail-status-item-release">
              <span className="movie-detail-status-icon" aria-hidden="true"><CalendarIcon /></span>
              <div>
                <span>Release Date</span>
                <strong>{movie.releaseDateLabel}</strong>
              </div>
            </div>
          </div>
        </aside>
      </article>

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

      {trailerState.status === 'success' && trailerState.trailer ? (
        <MovieTrailerDialog movie={movie} trailer={trailerState.trailer} onClose={closeTrailer} />
      ) : null}

      <div className="movie-detail-grid">
        <section className="content-section movie-detail-panel">
          <div className="section-header">
            <h2>Cast &amp; Crew</h2>
          </div>
          <div className="movie-detail-cast">
            {creditCards.length > 0 ? (
              creditCards.map((member) => (
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

        <section className="content-section movie-detail-panel movie-detail-activity">
          <div className="section-header">
            <h2>Your Activity</h2>
            <button type="button" className="section-link">
              View all
            </button>
          </div>
          <div className="movie-detail-activity-grid">
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
                <strong>{isWatched ? 'Completed and saved to your watch history.' : 'Mark as watched to start tracking this movie.'}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="content-section movie-detail-panel">
          <div className="section-header">
            <h2>More Like This</h2>
          </div>
          <SimilarMoviesGrid similarMoviesState={similarMoviesState} onOpenMovie={onOpenMovie} />
        </section>

        <section className="content-section movie-detail-panel movie-detail-facts">
          <div className="movie-detail-facts-list">
            <DetailFactRow icon={DirectorIcon} label="Director" value="Denis Villeneuve" />
            <DetailFactRow icon={ScriptIcon} label="Screenplay" value="Jon Spaihts, Denis Villeneuve" />
            <DetailFactRow icon={LanguageIcon} label="Language" value="English" />
            <DetailFactRow icon={AwardIcon} label="Awards" value="6 wins & 34 nominations" />
          </div>
        </section>

        <section className="content-section movie-detail-panel movie-detail-reviews">
          <div className="section-header">
            <h2>Community Reviews</h2>
            <button type="button" className="section-link">
              View all
            </button>
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

function MovieRatingDialog({ movie, selectedRating, onSelectRating, onCancel, onSubmit, isSaving, error }) {
  return (
    <div className="movie-rating-dialog-backdrop" role="presentation" onMouseDown={isSaving ? undefined : onCancel}>
      <section className="movie-rating-dialog" role="dialog" aria-modal="true" aria-labelledby="movie-rating-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="movie-rating-dialog-kicker">Your WatchVault Rating</p>
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
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>Cancel</button>
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

function PersonDetailPage({ personDetailState, onBackToMovies, onOpenMovie, onOpenPerson, isSignedIn, favoriteActorIds, onToggleFavorite }) {
  const filmographyPageSize = 5
  const [visibleFilmographyCount, setVisibleFilmographyCount] = useState(filmographyPageSize)
  const personId = personDetailState.person?.id
  const filmography = personDetailState.filmography ?? []

  useEffect(() => {
    setVisibleFilmographyCount(filmographyPageSize)
  }, [personId])

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

  const { person, knownFor, coStars, facts } = personDetailState
  const isFavorite = favoriteActorIds.has(Number(person.id))
  const visibleFilmography = filmography.slice(0, visibleFilmographyCount)
  const hasMoreFilmography = filmography.length > visibleFilmography.length
  const heroStyle = person.heroBackdropUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(7, 10, 18, 0.98) 0%, rgba(7, 10, 18, 0.78) 28%, rgba(7, 10, 18, 0.4) 62%, rgba(7, 10, 18, 0.84) 100%), url(${person.heroBackdropUrl})`,
      }
    : undefined

  return (
    <section className="person-detail-page">
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
            <span className="person-detail-verified">
              <CheckCircleIcon />
            </span>
          </div>

          <div className="person-detail-role-list">
            {(Array.isArray(person.roles) && person.roles.length > 0 ? person.roles : [person.knownForDepartment]).map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>

          <div className="person-detail-stat-row">
            <MetricBadge icon={CalendarIcon} value={person.birthdayLabel} label="Birthdate" tone="violet" />
            <MetricBadge icon={GlobeIcon} value={person.knownForDepartment} label="Known For" tone="gold" />
            <MetricBadge icon={AwardIcon} value={String(filmography.length)} label="Credits" tone="tomato" />
            <MetricBadge icon={TrendUpIcon} value={person.popularity} label="Popularity" tone="violet" />
          </div>

          <p className="person-detail-summary">{person.biography}</p>

          <div className="movie-detail-actions">
            <button type="button" className="primary-button movie-detail-primary">
              <PlusIcon />
              <span>Follow</span>
            </button>
            <button type="button" className="secondary-button movie-detail-secondary" onClick={() => onToggleFavorite(person)}>
              <StarOutlineIcon />
              <span>{isFavorite ? 'Favorited' : isSignedIn ? 'Favorite' : 'Sign in to Favorite'}</span>
            </button>
            <button type="button" className="secondary-button movie-detail-secondary ghost">
              <ShareIcon />
              <span>Share</span>
            </button>
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

      <div className="person-detail-grid">
        <section className="content-section movie-detail-panel">
          <div className="section-header">
            <h2>Known For</h2>
          </div>
          <div className="person-detail-known-for">
            {knownFor.length > 0 ? (
              knownFor.map((item) => (
                <MovieCard key={`known-${item.id}`} movie={item} onOpenMovie={onOpenMovie} />
              ))
            ) : (
              <SectionMessage message="No known-for movie credits are available yet." />
            )}
          </div>
        </section>

        <div className="person-detail-split">
          <section className="content-section movie-detail-panel">
            <div className="section-header">
              <h2>Filmography</h2>
            </div>
            {filmography.length > 0 ? (
              <>
                <div className="person-detail-filmography">
                  {visibleFilmography.map((item) => (
                    <button
                      key={`film-${item.id}-${item.role}`}
                      type="button"
                      className="person-detail-filmography-row"
                      onClick={() => onOpenMovie?.(item)}
                    >
                      <div className="person-detail-filmography-title">
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
                          <span>{item.year}</span>
                        </div>
                      </div>
                      <span className="person-detail-filmography-role">{item.role}</span>
                      <span className="star-rating person-detail-filmography-rating">
                        <StarIcon />
                        {item.rating}
                      </span>
                      <ChevronRight className="person-detail-filmography-chevron" />
                    </button>
                  ))}
                </div>
                {hasMoreFilmography ? (
                  <div className="person-detail-filmography-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setVisibleFilmographyCount((count) => count + filmographyPageSize)}
                    >
                      Show more
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <SectionMessage message="No filmography entries are available yet." />
            )}
          </section>

          <section className="content-section movie-detail-panel">
            <div className="section-header">
              <h2>Co-stars</h2>
            </div>
            <div className="person-detail-costars">
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
                    <p>{member.sharedCredits} shared credits</p>
                  </button>
                ))
              ) : (
                <SectionMessage message="No local collaborator data is available yet." />
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
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

function MobileNav({ activeView, setActiveView }) {
  return (
    <nav className="mobile-nav mobile-only" aria-label="Bottom navigation">
      {mobileNavItems.map(({ label, icon: Icon, view }) => (
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

function ContentSection({ title, action, onAction, compact = false, children }) {
  return (
    <section className={`content-section${compact ? ' compact-section' : ''}`}>
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

function ProgressCard({ item, onOpenTvShow }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(item.backdropUrl || item.posterUrl) && !posterUnavailable

  return (
    <button type="button" className="media-card progress-card movie-card-button" onClick={() => onOpenTvShow?.(item)} aria-label={`Open ${item.title}`}>
      <div className={`media-poster wide ${showPosterImage ? 'has-image theme-catalog' : 'theme-catalog'}`}>
        {showPosterImage ? <img src={item.backdropUrl || item.posterUrl} alt={`${item.title} artwork`} className="movie-card-poster-image" loading="lazy" onError={() => setPosterUnavailable(true)} /> : null}
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
    </button>
  )
}

function RatingCard({ item, onOpenMovie }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(item.posterUrl) && !posterUnavailable
  const ratingLabel = typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating

  return (
    <button type="button" className="media-card rating-card movie-card-button" onClick={() => onOpenMovie?.(item)} aria-label={`Open ${item.title}`}>
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
    </button>
  )
}

function MovieCard({ movie, onOpenMovie, isInWatchlist = false, isWatched = false }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(movie.posterUrl) && !posterUnavailable

  return (
    <button type="button" className="movie-card movie-card-button" onClick={() => onOpenMovie(movie)} aria-label={`Open ${movie.title}`}>
      <div className={`movie-card-poster ${showPosterImage ? 'has-image' : movie.theme}`}>
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
      </div>
      <div className="movie-card-copy">
        <h3>{movie.title}</h3>
        <p>{movie.year}</p>
        <div className="rating-row">
          <span className="star-rating">
            <StarIcon />
            {movie.rating}
          </span>
          <span>{movie.meta}</span>
        </div>
      </div>
    </button>
  )
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
        <span className="feature-arrow">
          <ChevronRight />
        </span>
        <div className="feature-dots">
          <span className="active" />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </button>
  )
}

function PopularMoviesGrid({ popularMoviesState, layout = 'slider', onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set() }) {
  if (popularMoviesState.status === 'loading' || popularMoviesState.status === 'idle') {
    return <SectionMessage message="Loading popular movies from your local database..." />
  }

  if (popularMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load popular movies. ${popularMoviesState.error}`} tone="error" />
  }

  if (popularMoviesState.movies.length === 0) {
    return <SectionMessage message="No movies are available in the local database yet." />
  }

  const movies = layout === 'catalog' ? popularMoviesState.movies : popularMoviesState.movies.slice(0, 10)

  return (
    <div
      className={`movie-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}
      aria-label={layout === 'catalog' ? 'Popular movies list' : 'Popular movies slider'}
    >
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
        />
      ))}
    </div>
  )
}

function RecentlyReleasedSlider({ recentMoviesState, layout = 'slider', onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set() }) {
  if (recentMoviesState.status === 'loading' || recentMoviesState.status === 'idle') {
    return <SectionMessage message="Loading recently released movies from your local database..." />
  }

  if (recentMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load recently released movies. ${recentMoviesState.error}`} tone="error" />
  }

  if (recentMoviesState.movies.length === 0) {
    return <SectionMessage message="No recently released movies are available in the local database yet." />
  }

  const movies = layout === 'catalog' ? recentMoviesState.movies : recentMoviesState.movies.slice(0, 10)

  return (
    <div
      className={`movie-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}
      aria-label={layout === 'catalog' ? 'Now playing movies list' : 'Recently released movies slider'}
    >
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
        />
      ))}
    </div>
  )
}

function UpcomingMoviesGrid({ upcomingMoviesState, layout = 'slider', onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set() }) {
  if (upcomingMoviesState.status === 'loading' || upcomingMoviesState.status === 'idle') {
    return <SectionMessage message="Loading upcoming movies from your local database..." />
  }

  if (upcomingMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load upcoming movies. ${upcomingMoviesState.error}`} tone="error" />
  }

  if (upcomingMoviesState.movies.length === 0) {
    return <SectionMessage message="No upcoming movies are available in the local database yet." />
  }

  const movies = layout === 'catalog' ? upcomingMoviesState.movies : upcomingMoviesState.movies.slice(0, 10)

  return (
    <div
      className={`movie-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}
      aria-label={layout === 'catalog' ? 'Upcoming movies list' : 'Upcoming movies slider'}
    >
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
        />
      ))}
    </div>
  )
}

function TopRatedMoviesGrid({ topRatedMoviesState, layout = 'slider', onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set() }) {
  if (topRatedMoviesState.status === 'loading' || topRatedMoviesState.status === 'idle') {
    return <SectionMessage message="Loading top rated movies from your local database..." />
  }

  if (topRatedMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load top rated movies. ${topRatedMoviesState.error}`} tone="error" />
  }

  if (topRatedMoviesState.movies.length === 0) {
    return <SectionMessage message="No top rated movies are available in the local database yet." />
  }

  const movies = layout === 'catalog' ? topRatedMoviesState.movies : topRatedMoviesState.movies.slice(0, 10)

  return (
    <div
      className={`movie-card-grid${layout === 'catalog' ? ' popular-movies-catalog' : ' popular-movies-slider'}`}
      aria-label={layout === 'catalog' ? 'Top rated movies list' : 'Top rated movies slider'}
    >
      {movies.map((movie) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onOpenMovie={onOpenMovie}
          isWatched={watchedMovieIds.has(Number(movie.id))}
          isInWatchlist={watchlistMovieIds.has(Number(movie.id))}
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
    <div className="pagination-controls" aria-label="Movie pagination">
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

function GenreMoviesGrid({ genreMoviesState, onOpenMovie, watchedMovieIds = new Set(), watchlistMovieIds = new Set() }) {
  if (genreMoviesState.status === 'loading' || genreMoviesState.status === 'idle') {
    return <SectionMessage message="Loading genre movies..." />
  }

  if (genreMoviesState.status === 'error') {
    return <SectionMessage message={`Could not load genre movies. ${genreMoviesState.error}`} tone="error" />
  }

  if (genreMoviesState.movies.length === 0) {
    return <SectionMessage message="No movies with this genre are available in the local database yet." />
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
        />
      ))}
    </div>
  )
}

function getFilteredWatchlistItems({ items, activeTab }) {
  return items.filter((item) => {
    if (activeTab === 'Movies' && item.type !== 'Movies') {
      return false
    }

    if (activeTab === 'TV Shows' && item.type !== 'TV Shows') {
      return false
    }

    return true
  })
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

function buildAuthHeaders(user) {
  if (!user?.username) {
    return {}
  }

  return {
    'x-watchvault-username': user.username,
  }
}

function mapMovieStatsPayload(stats) {
  return {
    moviesWatched: typeof stats?.moviesWatched === 'number' ? stats.moviesWatched : 0,
    timeWatchedMinutes: typeof stats?.timeWatchedMinutes === 'number' ? stats.timeWatchedMinutes : 0,
    watchlistCount: typeof stats?.watchlistCount === 'number' ? stats.watchlistCount : 0,
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
    accent: watchlistAccentOptions[index % watchlistAccentOptions.length],
    bookmarked: true,
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
    trailer: Array.isArray(show.trailers) ? show.trailers[0] ?? null : null,
    seasons: (Array.isArray(show.seasons) ? show.seasons : []).map((season) => ({ ...season, episodes: (season.episodes ?? []).map((episode) => ({ ...episode, isAired: Boolean(episode.isAired), stillUrl: resolveMovieBackdropUrl(episode.stillPath), airDateLabel: episode.airDate ? formatLongDate(episode.airDate) : 'TBA', runtimeLabel: episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : 'Runtime TBA' })) })),
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
    title: movie.title,
    year: movie.year || 'Release TBA',
    rating: movie.rating || 'N/A',
    meta: movie.meta || 'Credit',
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
    role: movie.role || 'Credit',
    rating: movie.rating || 'N/A',
    posterUrl: movie.posterUrl || null,
    theme: 'theme-catalog',
  }
}

function mapPersonCoStar(person) {
  return {
    id: person.id,
    name: person.name,
    profileUrl: person.profileUrl || null,
    sharedCredits: person.sharedCredits || 0,
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

function readAppRoute(pathname = window.location.pathname, search = window.location.search) {
  if (/^\/search\/?$/.test(pathname)) {
    return { kind: routeKinds.search, query: new URLSearchParams(search).get('q')?.trim() || '' }
  }

  const tvDetailMatch = pathname.match(/^\/tv\/(\d+)\/?$/)
  const personDetailMatch = pathname.match(/^\/people\/(\d+)\/?$/)
  const detailMatch = pathname.match(/^\/movies\/(\d+)\/?$/)

  if (tvDetailMatch) {
    return { kind: routeKinds.tvDetail, showId: Number.parseInt(tvDetailMatch[1], 10) }
  }

  if (personDetailMatch) {
    return {
      kind: routeKinds.personDetail,
      personId: Number.parseInt(personDetailMatch[1], 10),
    }
  }

  if (detailMatch) {
    return {
      kind: routeKinds.movieDetail,
      movieId: Number.parseInt(detailMatch[1], 10),
    }
  }

  return { kind: routeKinds.home }
}

function buildSearchPath(query) {
  return `/search?q=${encodeURIComponent(query)}`
}

function buildMovieDetailPath(movieId) {
  return `/movies/${movieId}`
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
  const episodeCount = typeof details?.number_of_episodes === 'number' ? details.number_of_episodes : null
  const seasonCount = typeof details?.number_of_seasons === 'number' ? details.number_of_seasons : null

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
          <stop stopColor="#bf6fff" />
          <stop offset="1" stopColor="#6e40ff" />
        </linearGradient>
      </defs>
      <path d="M7 5.5C7 4 8.64 3.05 9.96 3.8l15.8 8.96c1.36.77 1.36 2.73 0 3.5L9.96 25.2C8.64 25.95 7 25 7 23.5V5.5Z" fill="url(#brand-grad)" />
      <path d="M14 10.2L21 14L14 17.8V10.2Z" fill="#1b1234" fillOpacity=".85" />
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

function BookmarkIcon() {
  return (
    <IconBase>
      <path d="M7 5.5h10a1 1 0 0 1 1 1v13l-6-3-6 3v-13a1 1 0 0 1 1-1Z" />
    </IconBase>
  )
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

function MoreIcon() {
  return (
    <IconBase>
      <circle cx="6.5" cy="12" r=".9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="12" r=".9" fill="currentColor" stroke="none" />
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

function ScriptIcon() {
  return (
    <IconBase>
      <rect x="6" y="4.5" width="12" height="15" rx="2" />
      <path d="M9 9h6" />
      <path d="M9 12.5h6" />
      <path d="M9 16h4" />
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

function TrendUpIcon() {
  return (
    <IconBase>
      <path d="M5.5 16.5 10 12l3 3 5.5-6" />
      <path d="M14.5 9H18v3.5" />
    </IconBase>
  )
}

export default App
