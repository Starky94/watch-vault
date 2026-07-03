import { useEffect, useRef, useState } from 'react'
import './App.css'

const primaryViews = {
  home: 'Home',
  movies: 'Movies',
  watchlist: 'Watchlist',
}

const navItems = [
  { label: 'Home', icon: HomeIcon, view: primaryViews.home },
  { label: 'Movies', icon: ClapperIcon, view: primaryViews.movies },
  { label: 'TV Shows', icon: TvIcon },
  { label: 'Watchlist', icon: BookmarkIcon, view: primaryViews.watchlist },
  { label: 'Calendar', icon: CalendarIcon },
  { label: 'Stats', icon: BarsIcon },
]

const genres = [
  { label: 'Action', color: '#ff6b7a' },
  { label: 'Adventure', color: '#7c8dff' },
  { label: 'Sci-Fi', color: '#ffd86f' },
  { label: 'Drama', color: '#84b3ff' },
  { label: 'Thriller', color: '#ff6cb6' },
]

const movieTabs = ['All Movies', 'Popular', 'Now Playing', 'Upcoming', 'Top Rated']
const movieScreenModes = {
  overview: 'overview',
  popularList: 'popularList',
  nowPlayingList: 'nowPlayingList',
  topRatedList: 'topRatedList',
  upcomingList: 'upcomingList',
}

const appScreens = {
  dashboard: 'dashboard',
  admin: 'admin',
  login: 'login',
  account: 'account',
}

const routeKinds = {
  home: 'home',
  movieDetail: 'movieDetail',
}

const authStorageKey = 'watchvault.auth.user'
const adminRunIdleState = {
  status: 'idle',
  message: '',
}

const watchlistAccentOptions = ['gold', 'violet', 'silver']

const continueWatching = [
  { title: 'Eclipse Point', meta: 'S1 E6', progress: 72, theme: 'theme-eclipse' },
  { title: 'The Last Harbor', meta: 'S2 E3', progress: 45, theme: 'theme-harbor' },
  { title: 'Silent Code', meta: '2024', progress: 60, theme: 'theme-code' },
  { title: 'Beyond the Ridge', meta: 'S1 E4', progress: 30, theme: 'theme-ridge' },
  { title: 'Neon City', meta: '2023', progress: 80, theme: 'theme-neon' },
]

const watchlist = [
  { title: "Ember's Fall", subtitle: '2024', rating: '4.5', theme: 'theme-ember' },
  { title: 'Starfall', subtitle: '2024', rating: '4.0', theme: 'theme-starfall' },
  { title: 'The Long Road', subtitle: '2023', rating: '4.5', theme: 'theme-road' },
  { title: 'Orbital', subtitle: '2024', rating: '4.2', theme: 'theme-orbital' },
  { title: 'Mindgate', subtitle: '2024', rating: '4.3', theme: 'theme-mindgate' },
]

const trending = [
  { title: 'Void Tide', rating: '4.6', theme: 'theme-void' },
  { title: 'Crimson Lights', rating: '4.4', theme: 'theme-crimson' },
  { title: 'Parallel', rating: '4.3', theme: 'theme-parallel' },
  { title: 'The Observer', rating: '4.2', theme: 'theme-observer' },
  { title: 'Lucid', rating: '4.1', theme: 'theme-lucid' },
]

const newEpisodes = [
  { title: 'Fragments', meta: 'New tonight', copy: 'A memory-bending thriller returns with its mid-season reveal.' },
  { title: 'Astra Division', meta: 'Tomorrow', copy: 'The crew finally reaches the signal source beyond Titan.' },
]

const mobileNavItems = [
  { label: 'Home', icon: HomeIcon, view: primaryViews.home },
  { label: 'Search', icon: SearchIcon, view: primaryViews.movies },
  { label: 'Watchlist', icon: BookmarkIcon, view: primaryViews.watchlist },
  { label: 'Stats', icon: BarsIcon },
  { label: 'More', icon: MoreIcon },
]

const watchlistTabs = ['All', 'Movies', 'TV Shows']
const moviesPageSize = 30

const emptyMovieStats = {
  moviesWatched: 0,
  timeWatchedMinutes: 0,
  watchlistCount: 0,
}

function App() {
  const [currentRoute, setCurrentRoute] = useState(() => readAppRoute())
  const [activeView, setActiveView] = useState(() =>
    readAppRoute().kind === routeKinds.movieDetail ? primaryViews.movies : primaryViews.home
  )
  const [activeMovieTab, setActiveMovieTab] = useState(movieTabs[0])
  const [activeWatchlistTab, setActiveWatchlistTab] = useState(watchlistTabs[0])
  const [moviesScreenMode, setMoviesScreenMode] = useState(movieScreenModes.overview)
  const [currentScreen, setCurrentScreen] = useState(appScreens.dashboard)
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
  const [popularMoviesState, setPopularMoviesState] = useState(() => createMovieCollectionState({ includeFeaturedMovie: true }))
  const [recentMoviesState, setRecentMoviesState] = useState(() => createMovieCollectionState())
  const [upcomingMoviesState, setUpcomingMoviesState] = useState(() => createMovieCollectionState())
  const [topRatedMoviesState, setTopRatedMoviesState] = useState(() => createMovieCollectionState())
  const [movieDetailState, setMovieDetailState] = useState({
    status: currentRoute.kind === routeKinds.movieDetail ? 'idle' : 'hidden',
    movie: null,
    error: '',
  })
  const [similarMoviesState, setSimilarMoviesState] = useState({
    status: currentRoute.kind === routeKinds.movieDetail ? 'idle' : 'hidden',
    movies: [],
    error: '',
  })
  const [adminOverviewState, setAdminOverviewState] = useState({
    status: 'idle',
    crons: [],
    totalMovies: 0,
    storedDataBytes: 0,
    error: '',
  })
  const [adminRunState, setAdminRunState] = useState({})
  const [adminRefreshKey, setAdminRefreshKey] = useState(0)
  const [watchlistState, setWatchlistState] = useState({
    status: 'idle',
    movies: [],
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
  const [movieStatsState, setMovieStatsState] = useState({
    status: 'idle',
    stats: emptyMovieStats,
    error: '',
  })

  useEffect(() => {
    function handlePopState() {
      const nextRoute = readAppRoute()
      setCurrentRoute(nextRoute)
      setCurrentScreen(appScreens.dashboard)
      setActiveView(nextRoute.kind === routeKinds.movieDetail ? primaryViews.movies : primaryViews.home)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

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

    if (currentRoute.kind !== routeKinds.movieDetail) {
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
    if (window.location.pathname !== path) {
      window.history.pushState(historyState, '', path)
    }

    setCurrentRoute(nextRoute)
    setCurrentScreen(appScreens.dashboard)
    setActiveView(nextView)
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
    if (currentRoute.kind === routeKinds.movieDetail) {
      handleNavigateToPath('/', { kind: routeKinds.home }, view)
    } else if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
      setCurrentRoute({ kind: routeKinds.home })
    }

    if (view !== primaryViews.movies) {
      return
    }

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

  function handleMovieTabChange(tab) {
    setActiveMovieTab(tab)

    if (tab === 'All Movies') {
      setPopularMoviesPage(1)
      setRecentMoviesPage(1)
      setTopRatedMoviesPage(1)
      setUpcomingMoviesPage(1)
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
    setPopularMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.popularList)
  }

  function handleOpenRecentlyReleasedMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Now Playing')
    setRecentMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.nowPlayingList)
  }

  function handleOpenUpcomingMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Upcoming')
    setUpcomingMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.upcomingList)
  }

  function handleOpenTopRatedMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Top Rated')
    setTopRatedMoviesPage(1)
    setMoviesScreenMode(movieScreenModes.topRatedList)
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
      const response = await fetch('/api/watched', {
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
  }, [user])

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
      const response = await fetch('/api/watched', {
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
      const response = await fetch(`/api/watched/${normalizedMovieId}`, {
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
            totalMovies: typeof payload?.totals?.movies === 'number' ? payload.totals.movies : 0,
            storedDataBytes: typeof payload?.totals?.storedDataBytes === 'number' ? payload.totals.storedDataBytes : 0,
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
        const response = await fetch(`/api/movies/${currentRoute.movieId}`)
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
    if (activeView !== primaryViews.movies) {
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

  const watchlistMovieIds = new Set(watchlistState.movies.map((movie) => Number(movie.id)))
  const watchedMovieIds = new Set(watchedState.movies.map((movie) => Number(movie.id)))
  const homeStats = buildHomeStats({
    stats: movieStatsState.stats,
    watchlistCount: watchlistState.movies.length,
  })
  const moviesPageStats = buildMoviesPageStats({
    stats: movieStatsState.stats,
    watchlistCount: watchlistState.movies.length,
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
          {genres.map((genre) => (
            <button key={genre.label} type="button" className="genre-item">
              <span className="genre-dot" style={{ '--dot': genre.color }} />
              <span>{genre.label}</span>
            </button>
          ))}
          <button type="button" className="genre-item">
            <ChevronDown />
            <span>More</span>
          </button>
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
              onOpenAdmin={handleOpenAdmin}
              onOpenAccount={handleOpenAccount}
              onOpenLogin={handleOpenLogin}
              onLogout={handleLogout}
              user={user}
            />
            <MobileHeader onOpenLogin={handleOpenLogin} user={user} />

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
            ) : activeView === primaryViews.home ? (
              <HomeScreen user={user} onOpenWatchlistCta={handleOpenWatchlistCta} stats={homeStats} />
            ) : activeView === primaryViews.watchlist ? (
              <WatchlistScreen
                activeTab={activeWatchlistTab}
                isSignedIn={Boolean(user)}
                onTabChange={handleWatchlistTabChange}
                onOpenLogin={handleOpenLogin}
                onOpenMovie={handleOpenMovieDetail}
                watchlistState={watchlistState}
              />
            ) : currentRoute.kind === routeKinds.movieDetail ? (
              <MovieDetailPage
                movieDetailState={movieDetailState}
                similarMoviesState={similarMoviesState}
                onBackToMovies={() => handleMovieViewSelection(primaryViews.movies)}
                onToggleWatched={handleToggleMovieWatched}
                onToggleWatchlist={handleToggleMovieInWatchlist}
                onOpenMovie={handleOpenMovieDetail}
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
                popularMoviesState={popularMoviesState}
                onChangePopularPage={setPopularMoviesPage}
                recentMoviesState={recentMoviesState}
                onChangeRecentPage={setRecentMoviesPage}
                topRatedMoviesState={topRatedMoviesState}
                onChangeTopRatedPage={setTopRatedMoviesPage}
                upcomingMoviesState={upcomingMoviesState}
                onChangeUpcomingPage={setUpcomingMoviesPage}
                movieStats={moviesPageStats}
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

function DesktopTopbar({ activeView, currentScreen, onOpenAdmin, onOpenAccount, onOpenLogin, onLogout, user }) {
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
      <label className="searchbar" aria-label="Search">
        <SearchIcon />
        <input
          type="text"
          placeholder={
            currentScreen === appScreens.admin
              ? 'Search admin tools, jobs, diagnostics...'
              : activeView === primaryViews.movies || activeView === primaryViews.watchlist
              ? 'Search movies, actors, directors...'
              : 'Search movies, shows, people...'
          }
        />
      </label>

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

function MobileHeader({ onOpenLogin, user }) {
  return (
    <header className="mobile-header mobile-only">
      <Brand />

      <div className="mobile-actions">
        <button type="button" className="icon-button">
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
  )
}

function HomeScreen({ user, onOpenWatchlistCta, stats }) {
  const greeting = user ? `Good evening, ${getFirstName(user.fullName)}! 🍿` : 'Good evening! 🍿'

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">{greeting}</p>
          <h1>Track every story. Every screen.</h1>
          <p className="hero-subcopy">Your next favorite is already on your list.</p>

          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={onOpenWatchlistCta}>
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

        <StatsPanel title="Your Stats" items={stats} />
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
        <div className="feature-grid">
          {continueWatching.map((item) => (
            <ProgressCard key={item.title} item={item} />
          ))}
        </div>
      </ContentSection>

      <section className="split-row">
        <ContentSection title="Watchlist" action="See all" compact>
          <div className="compact-grid">
            {watchlist.map((item) => (
              <RatingCard key={item.title} item={item} />
            ))}
          </div>
        </ContentSection>

        <ContentSection title="Trending Now" action="See all" compact>
          <div className="compact-grid compact-grid--trending">
            {trending.map((item) => (
              <RatingCard key={item.title} item={item} />
            ))}
          </div>
        </ContentSection>
      </section>

      <ContentSection title="New Episodes" action="See all">
        <div className="episode-grid">
          {newEpisodes.map((episode) => (
            <article key={episode.title} className="episode-card">
              <div className={`episode-poster ${episode.title === 'Fragments' ? 'theme-fragments' : 'theme-astra'}`} />
              <div className="episode-copy">
                <span className="episode-meta">{episode.meta}</span>
                <h3>{episode.title}</h3>
                <p>{episode.copy}</p>
              </div>
            </article>
          ))}
        </div>
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

        <div className="login-hint">
          <span>Demo accounts</span>
          <strong>florind / test, andreead / test, or alex / test</strong>
        </div>
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
          <p>Inspect the current importer loops, manually run a job, and monitor the total number of stored movies.</p>
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
  popularMoviesState,
  onChangePopularPage,
  recentMoviesState,
  onChangeRecentPage,
  topRatedMoviesState,
  onChangeTopRatedPage,
  upcomingMoviesState,
  onChangeUpcomingPage,
  movieStats,
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
          {isPopularListMode
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

      {isPopularListMode ? (
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
              <StatsPanel title="Your Movie Stats" items={movieStats} monthLabel="This Month" />
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

function WatchlistScreen({
  activeTab,
  isSignedIn,
  onTabChange,
  onOpenLogin,
  onOpenMovie,
  watchlistState,
}) {
  const filteredItems = getFilteredWatchlistItems({
    items: watchlistState.movies,
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
            { label: 'Total', value: String(watchlistState.movies.length), caption: 'In Watchlist' },
            { label: 'Movies', value: String(watchlistState.movies.length), caption: 'Titles' },
            { label: 'TV Shows', value: '0', caption: 'Series' },
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

      <div className="watchlist-grid-mobile">
        {filteredItems.map((item) => (
          <WatchlistCard key={item.id} item={item} compact onOpenMovie={onOpenMovie} />
        ))}
      </div>

      {watchlistState.status === 'loading' ? <SectionMessage message="Loading your watchlist..." /> : null}
      {watchlistState.status === 'error' ? <SectionMessage message={watchlistState.error} tone="error" /> : null}
      {watchlistState.status !== 'loading' && watchlistState.status !== 'error' && filteredItems.length === 0
        ? <SectionMessage message="No watchlist titles match this section yet." />
        : null}
    </section>
  )
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
  onOpenMovie,
  onToggleWatched,
  onToggleWatchlist,
  watchedActionState,
  watchedMovieIds,
  watchedMovies,
  watchlistActionState,
  watchlistMovieIds,
}) {
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
  const backdropStyle = movie.backdropUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(7, 10, 18, 0.96) 0%, rgba(7, 10, 18, 0.74) 30%, rgba(7, 10, 18, 0.34) 62%, rgba(7, 10, 18, 0.68) 100%), url(${movie.backdropUrl})`,
      }
    : undefined

  return (
    <section className="movie-detail-page">
      <button type="button" className="movie-detail-back mobile-only" onClick={onBackToMovies}>
        <ChevronLeftIcon />
      </button>

      <article className="movie-detail-hero" style={backdropStyle}>
        <div className="movie-detail-hero-overlay" />

        <div className="movie-detail-poster-wrap">
          <MoviePosterFrame movie={movie} />
          <button type="button" className="movie-detail-trailer-badge" aria-label={`Play trailer for ${movie.title}`}>
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
            <MetricBadge icon={UserRatingIcon} value="4.5/5" label="Your Rating" tone="violet" />
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
            <button type="button" className="secondary-button movie-detail-secondary ghost">
              <StarOutlineIcon />
              <span>Rate</span>
            </button>
            <button type="button" className="secondary-button movie-detail-secondary ghost desktop-only">
              <PlayIcon />
              <span>Trailer</span>
            </button>
          </div>
        </div>

        <aside className="movie-detail-status desktop-only">
          <h2>Your Status</h2>
          <div className="movie-detail-status-list">
            <div className="movie-detail-status-item">
              <BookmarkStatusIcon />
              <div>
                <span>In Watchlist</span>
                <strong>{isInWatchlist ? 'Saved' : 'Not yet'}</strong>
              </div>
            </div>
            <div className="movie-detail-status-item">
              <WatchedStatusIcon />
              <div>
                <span>Watched</span>
                <strong>{watchedLabel}</strong>
              </div>
            </div>
            <div className="movie-detail-status-item">
              <StarOutlineIcon />
              <div>
                <span>Your Rating</span>
                <strong>4.5 / 5</strong>
              </div>
            </div>
            <div className="movie-detail-status-item">
              <ClockIcon />
              <div>
                <span>Runtime</span>
                <strong>{movie.runtime}</strong>
              </div>
            </div>
            <div className="movie-detail-status-item">
              <CalendarIcon />
              <div>
                <span>Release Date</span>
                <strong>{movie.releaseDateLabel}</strong>
              </div>
            </div>
          </div>
        </aside>
      </article>

      <div className="movie-detail-grid">
        <section className="content-section movie-detail-panel">
          <div className="section-header">
            <h2>Cast &amp; Crew</h2>
          </div>
          <div className="movie-detail-cast">
            {creditCards.length > 0 ? (
              creditCards.map((member) => (
                <article key={`${member.name}-${member.role}`} className="movie-detail-cast-card">
                  <div
                    className="movie-detail-cast-avatar"
                    style={buildMovieCreditAvatarStyle(member.profileUrl)}
                    aria-label={member.name}
                  >
                    {!member.profileUrl ? getMovieCreditInitials(member.name) : null}
                  </div>
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </article>
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

function StatsPanel({ title, items, monthLabel = 'This Month' }) {
  return (
    <div className="stats-panel">
      <div className="stats-header">
        <span>{title}</span>
        <button type="button" className="month-button">
          {monthLabel}
          <ChevronDown />
        </button>
      </div>

      <div className="stats-list">
        {items.map(({ label, value, trend, tone, icon: Icon }) => (
          <article key={label} className="stat-card">
            <div>
              <p className="stat-label">{label}</p>
              <div className="stat-row">
                <strong>{value}</strong>
                <span className="trend">{trend}</span>
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

function ProgressCard({ item }) {
  return (
    <article className="media-card progress-card">
      <div className={`media-poster wide ${item.theme}`}>
        <button type="button" className="poster-menu" aria-label={`More options for ${item.title}`}>
          <MoreIcon />
        </button>
      </div>
      <div className="media-copy">
        <h3>{item.title}</h3>
        <p>{item.meta}</p>
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

function RatingCard({ item }) {
  return (
    <article className="media-card rating-card">
      <div className={`media-poster tall ${item.theme}`} />
      <div className="media-copy">
        <h3>{item.title}</h3>
        <div className="rating-row">
          <span className="star-rating">
            <StarIcon />
            {item.rating}
          </span>
          <span>{item.subtitle ?? ''}</span>
        </div>
      </div>
    </article>
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

function createMovieCollectionLoadingState({ page = 1, includeFeaturedMovie = false } = {}) {
  return {
    status: 'loading',
    movies: [],
    pagination: createPaginationState(page),
    ...(includeFeaturedMovie ? { featuredMovie: null } : {}),
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

function buildMoviesApiPath(basePath, page, pageSize = moviesPageSize) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  })

  return `${basePath}?${params.toString()}`
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
  }
}

function buildMovieCreditCards(movie) {
  const cards = []

  if (movie?.director?.name) {
    cards.push({
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

function readAppRoute(pathname = window.location.pathname) {
  const detailMatch = pathname.match(/^\/movies\/(\d+)\/?$/)

  if (detailMatch) {
    return {
      kind: routeKinds.movieDetail,
      movieId: Number.parseInt(detailMatch[1], 10),
    }
  }

  return { kind: routeKinds.home }
}

function buildMovieDetailPath(movieId) {
  return `/movies/${movieId}`
}

function readMoviePreviewFromHistory(movieId) {
  const preview = window.history.state?.moviePreview

  if (!preview || Number(preview.id) !== Number(movieId)) {
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

function buildHomeStats({ stats, watchlistCount }) {
  return [
    { label: 'Movies Watched', value: String(stats.moviesWatched), tone: 'violet', icon: TicketIcon },
    { label: 'Time Watched', value: formatMinutesAsHoursAndMinutes(stats.timeWatchedMinutes), tone: 'blue', icon: ClockIcon },
    { label: 'In Watchlist', value: String(watchlistCount), tone: 'gold', icon: BookmarkStackIcon },
  ]
}

function buildMoviesPageStats({ stats, watchlistCount }) {
  return [
    { label: 'Movies Watched', value: String(stats.moviesWatched), tone: 'violet', icon: ClapperIcon },
    { label: 'In Watchlist', value: String(watchlistCount), tone: 'orange', icon: BookmarkStackIcon },
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

function TicketIcon() {
  return (
    <IconBase>
      <path d="M6 7h12a1 1 0 0 1 1 1v2.2a1.8 1.8 0 0 0 0 3.6V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2.2a1.8 1.8 0 0 0 0-3.6V8a1 1 0 0 1 1-1Z" />
      <path d="M12 7v10" />
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

function ChevronRight() {
  return (
    <IconBase>
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

export default App
