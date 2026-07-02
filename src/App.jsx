import { useEffect, useRef, useState } from 'react'
import './App.css'

const primaryViews = {
  home: 'Home',
  movies: 'Movies',
}

const navItems = [
  { label: 'Home', icon: HomeIcon, view: primaryViews.home },
  { label: 'Movies', icon: ClapperIcon, view: primaryViews.movies },
  { label: 'TV Shows', icon: TvIcon },
  { label: 'Watchlist', icon: BookmarkIcon },
  { label: 'Favorites', icon: HeartIcon },
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

const homeTabs = ['All', 'Movies', 'TV Shows', 'Watching', 'Completed', 'Plan to Watch', 'Favorites']

const movieTabs = ['All Movies', 'Popular', 'Now Playing', 'Upcoming', 'Top Rated', 'Favorites']
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

const stats = [
  { label: 'Watched', value: '24', trend: '+ 20%', tone: 'violet', icon: TicketIcon },
  { label: 'Time Watched', value: '48h 36m', trend: '+ 15%', tone: 'blue', icon: ClockIcon },
  { label: 'Shows Completed', value: '7', trend: '+ 16%', tone: 'green', icon: CheckIcon },
  { label: 'Movies Watched', value: '17', trend: '+ 13%', tone: 'gold', icon: ClapperIcon },
]

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

const movieStats = [
  { label: 'Movies Watched', value: '28', trend: '+27%', tone: 'violet', icon: TicketIcon },
  { label: 'Average Rating', value: '4.2', trend: '+0.3', tone: 'gold', icon: StarBadgeIcon },
  { label: 'In Watchlist', value: '56', trend: '+12%', tone: 'orange', icon: BookmarkStackIcon },
  { label: 'Hours Watched', value: '48h 32m', trend: '+16%', tone: 'blue', icon: ClockIcon },
]

const movieWatchlist = [
  { title: 'Oppenheimer', year: '2023', meta: 'Drama, Biography', rating: '4.6', theme: 'theme-oppenheimer' },
  { title: 'Interstellar', year: '2014', meta: 'Sci-Fi, Adventure', rating: '4.8', theme: 'theme-interstellar' },
  { title: 'The Dark Knight', year: '2008', meta: 'Action, Crime', rating: '4.7', theme: 'theme-dark-knight' },
  { title: 'Inception', year: '2010', meta: 'Sci-Fi, Thriller', rating: '4.6', theme: 'theme-inception' },
]

const detailFeatureTags = ['Trending', 'Epic', 'Desert Saga']

const detailCast = [
  { name: 'Timothee Chalamet', role: 'Paul Atreides', theme: 'theme-cast-timothee' },
  { name: 'Zendaya', role: 'Chani', theme: 'theme-cast-zendaya' },
  { name: 'Rebecca Ferguson', role: 'Lady Jessica', theme: 'theme-cast-rebecca' },
  { name: 'Austin Butler', role: 'Feyd-Rautha', theme: 'theme-cast-austin' },
  { name: 'Stellan Skarsgard', role: 'Baron Harkonnen', theme: 'theme-cast-stellan' },
  { name: 'Javier Bardem', role: 'Stilgar', theme: 'theme-cast-javier' },
]

const detailMoreLikeThis = [
  { title: 'Dune', year: '2021', rating: '8.0', theme: 'theme-dune' },
  { title: 'Arrival', year: '2016', rating: '7.9', theme: 'theme-arrival' },
  { title: 'Blade Runner 2049', year: '2017', rating: '8.1', theme: 'theme-blade-runner' },
  { title: 'Mad Max: Fury Road', year: '2015', rating: '8.1', theme: 'theme-furiosa' },
  { title: 'The Martian', year: '2015', rating: '8.0', theme: 'theme-martian' },
  { title: 'Interstellar', year: '2014', rating: '8.6', theme: 'theme-interstellar' },
]

const detailReviews = [
  {
    author: 'Cinephile88',
    rating: '4.5',
    date: 'Apr 15, 2024',
    likes: '128',
    copy: 'A stunning continuation that elevates the story to epic proportions. The visuals, the score, the performances absolutely land.',
  },
  {
    author: 'DesertDreamer',
    rating: '5.0',
    date: 'Apr 14, 2024',
    likes: '97',
    copy: 'Denis Villeneuve outdid himself. A masterpiece of world-building and emotional depth that earns every minute of its runtime.',
  },
  {
    author: 'SciFiFanatic',
    rating: '4.0',
    date: 'Apr 13, 2024',
    likes: '63',
    copy: 'Incredible film, though the pacing in the middle lags a bit. Still, the final act is worth the wait.',
  },
]

const mobileNavItems = [
  { label: 'Home', icon: HomeIcon, view: primaryViews.home },
  { label: 'Search', icon: SearchIcon, view: primaryViews.movies },
  { label: 'Watchlist', icon: BookmarkIcon },
  { label: 'Stats', icon: BarsIcon },
  { label: 'More', icon: MoreIcon },
]

function App() {
  const [currentRoute, setCurrentRoute] = useState(() => readAppRoute())
  const [activeView, setActiveView] = useState(() =>
    readAppRoute().kind === routeKinds.movieDetail ? primaryViews.movies : primaryViews.home
  )
  const [activeTab, setActiveTab] = useState(homeTabs[0])
  const [activeMovieTab, setActiveMovieTab] = useState(movieTabs[0])
  const [moviesScreenMode, setMoviesScreenMode] = useState(movieScreenModes.overview)
  const [currentScreen, setCurrentScreen] = useState(appScreens.dashboard)
  const [user, setUser] = useState(null)
  const [authStatus, setAuthStatus] = useState('idle')
  const [authError, setAuthError] = useState('')
  const [popularMoviesState, setPopularMoviesState] = useState({
    status: 'idle',
    movies: [],
    featuredMovie: null,
    error: '',
  })
  const [recentMoviesState, setRecentMoviesState] = useState({
    status: 'idle',
    movies: [],
    error: '',
  })
  const [upcomingMoviesState, setUpcomingMoviesState] = useState({
    status: 'idle',
    movies: [],
    error: '',
  })
  const [topRatedMoviesState, setTopRatedMoviesState] = useState({
    status: 'idle',
    movies: [],
    error: '',
  })
  const [movieDetailState, setMovieDetailState] = useState({
    status: currentRoute.kind === routeKinds.movieDetail ? 'idle' : 'hidden',
    movie: null,
    error: '',
  })
  const [adminOverviewState, setAdminOverviewState] = useState({
    status: 'idle',
    crons: [],
    totalMovies: 0,
    error: '',
  })
  const [adminRunState, setAdminRunState] = useState({})
  const [adminRefreshKey, setAdminRefreshKey] = useState(0)

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

  function handleOpenDashboard() {
    setCurrentScreen(appScreens.dashboard)
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

  function handleMovieTabChange(tab) {
    setActiveMovieTab(tab)

    if (tab === 'Popular') {
      setMoviesScreenMode(movieScreenModes.popularList)
      return
    }

    if (tab === 'Now Playing') {
      setMoviesScreenMode(movieScreenModes.nowPlayingList)
      return
    }

    if (tab === 'Top Rated') {
      setMoviesScreenMode(movieScreenModes.topRatedList)
      return
    }

    if (tab === 'Upcoming') {
      setMoviesScreenMode(movieScreenModes.upcomingList)
      return
    }

    setMoviesScreenMode(movieScreenModes.overview)
  }

  function handleOpenPopularMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Popular')
    setMoviesScreenMode(movieScreenModes.popularList)
  }

  function handleOpenRecentlyReleasedMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Now Playing')
    setMoviesScreenMode(movieScreenModes.nowPlayingList)
  }

  function handleOpenUpcomingMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Upcoming')
    setMoviesScreenMode(movieScreenModes.upcomingList)
  }

  function handleOpenTopRatedMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Top Rated')
    setMoviesScreenMode(movieScreenModes.topRatedList)
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
    if (activeView !== primaryViews.movies || popularMoviesState.status !== 'idle') {
      return
    }

    let cancelled = false

    async function loadPopularMovies() {
        setPopularMoviesState({
          status: 'loading',
          movies: [],
          featuredMovie: null,
          error: '',
        })

      try {
        const response = await fetch('/api/movies')

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []
        const featuredMovie = payload.featuredMovie ? mapFeaturedMoviePayload(payload.featuredMovie) : null

        if (!cancelled) {
          setPopularMoviesState({
            status: 'success',
            movies,
            featuredMovie,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setPopularMoviesState({
            status: 'error',
            movies: [],
            featuredMovie: null,
            error: error instanceof Error ? error.message : 'Unable to load movies right now.',
          })
        }
      }
    }

    loadPopularMovies()

    return () => {
      cancelled = true
    }
    // We only want to kick off the first load when the movies view becomes active.
    // Adding the status dependency would cancel the in-flight request as soon as
    // we switch from idle to loading, which traps the UI in its loading state.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView])

  useEffect(() => {
    if (activeView !== primaryViews.movies || upcomingMoviesState.status !== 'idle') {
      return
    }

    let cancelled = false

    async function loadUpcomingMovies() {
      setUpcomingMoviesState({
        status: 'loading',
        movies: [],
        error: '',
      })

      try {
        const response = await fetch('/api/movies/upcoming?limit=30')

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []

        if (!cancelled) {
          setUpcomingMoviesState({
            status: 'success',
            movies,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setUpcomingMoviesState({
            status: 'error',
            movies: [],
            error: error instanceof Error ? error.message : 'Unable to load upcoming movies right now.',
          })
        }
      }
    }

    loadUpcomingMovies()

    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView])

  useEffect(() => {
    if (activeView !== primaryViews.movies || recentMoviesState.status !== 'idle') {
      return
    }

    let cancelled = false

    async function loadRecentMovies() {
      setRecentMoviesState({
        status: 'loading',
        movies: [],
        error: '',
      })

      try {
        const response = await fetch('/api/movies/recently-released?limit=30')

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []

        if (!cancelled) {
          setRecentMoviesState({
            status: 'success',
            movies,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setRecentMoviesState({
            status: 'error',
            movies: [],
            error: error instanceof Error ? error.message : 'Unable to load recently released movies right now.',
          })
        }
      }
    }

    loadRecentMovies()

    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView])

  useEffect(() => {
    if (activeView !== primaryViews.movies || topRatedMoviesState.status !== 'idle') {
      return
    }

    let cancelled = false

    async function loadTopRatedMovies() {
      setTopRatedMoviesState({
        status: 'loading',
        movies: [],
        error: '',
      })

      try {
        const response = await fetch('/api/movies/top-rated?limit=30')

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []

        if (!cancelled) {
          setTopRatedMoviesState({
            status: 'success',
            movies,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setTopRatedMoviesState({
            status: 'error',
            movies: [],
            error: error instanceof Error ? error.message : 'Unable to load top rated movies right now.',
          })
        }
      }
    }

    loadTopRatedMovies()

    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView])

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

        <div className="premium-card">
          <span className="premium-chip">PRO</span>
          <h3>Go Premium</h3>
          <p>Unlock advanced stats, custom lists and more.</p>
          <button type="button" className="premium-button">
            <span>Upgrade Now</span>
            <ArrowRight />
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
              onOpenLogin={handleOpenLogin}
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
            ) : activeView === primaryViews.home ? (
              <HomeScreen activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
            ) : currentRoute.kind === routeKinds.movieDetail ? (
              <MovieDetailPage movieDetailState={movieDetailState} onBackToMovies={() => handleMovieViewSelection(primaryViews.movies)} />
            ) : (
              <MoviesScreen
                activeTab={activeMovieTab}
                setActiveTab={handleMovieTabChange}
                screenMode={moviesScreenMode}
                popularMoviesState={popularMoviesState}
                recentMoviesState={recentMoviesState}
                topRatedMoviesState={topRatedMoviesState}
                upcomingMoviesState={upcomingMoviesState}
                onOpenPopularMovies={handleOpenPopularMovies}
                onOpenRecentlyReleasedMovies={handleOpenRecentlyReleasedMovies}
                onOpenTopRatedMovies={handleOpenTopRatedMovies}
                onOpenUpcomingMovies={handleOpenUpcomingMovies}
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
        <p className="brand-name">CineTrack</p>
      </div>
    </div>
  )
}

function DesktopTopbar({ activeView, currentScreen, onOpenAdmin, onOpenLogin, user }) {
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

  return (
    <header className="topbar desktop-only">
      <label className="searchbar" aria-label="Search">
        <SearchIcon />
        <input
          type="text"
          placeholder={
            currentScreen === appScreens.admin
              ? 'Search admin tools, jobs, diagnostics...'
              : activeView === primaryViews.movies
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
                <button type="button" className="profile-dropdown-item disabled" disabled role="menuitem">
                  <UserIcon />
                  <span>Profile</span>
                </button>
                <button type="button" className="profile-dropdown-item" onClick={handleOpenAdminMenuItem} role="menuitem">
                  <ShieldIcon />
                  <span>Admin</span>
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

function HomeScreen({ activeTab, setActiveTab, user }) {
  const greeting = user ? `Good evening, ${getFirstName(user.fullName)}! 🍿` : 'Good evening! 🍿'

  return (
    <>
      <section className="tab-row" aria-label="Content filters">
        {homeTabs.map((tab) => (
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

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">{greeting}</p>
          <h1>Track every story. Every screen.</h1>
          <p className="hero-subcopy">Your next favorite is already on your list.</p>

          <div className="hero-actions">
            <button type="button" className="primary-button">
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
            <span>{label.replace('Time Watched', 'Time').replace('Shows Completed', 'Completed').replace('Movies Watched', 'Movies')}</span>
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
          <span>Demo account</span>
          <strong>florind / test</strong>
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

function MoviesScreen({
  activeTab,
  setActiveTab,
  screenMode,
  popularMoviesState,
  recentMoviesState,
  topRatedMoviesState,
  upcomingMoviesState,
  onOpenPopularMovies,
  onOpenRecentlyReleasedMovies,
  onOpenTopRatedMovies,
  onOpenUpcomingMovies,
  onOpenMovie,
}) {
  const isPopularListMode = screenMode === movieScreenModes.popularList && activeTab === 'Popular'
  const isNowPlayingListMode = screenMode === movieScreenModes.nowPlayingList && activeTab === 'Now Playing'
  const isTopRatedListMode = screenMode === movieScreenModes.topRatedList && activeTab === 'Top Rated'
  const isUpcomingListMode = screenMode === movieScreenModes.upcomingList && activeTab === 'Upcoming'

  return (
    <section className="movies-page">
      <div className="movies-heading">
        <h1>Movies</h1>
        <p>
          {isPopularListMode
            ? 'Browse the 30 most popular movies imported from your local database.'
            : isNowPlayingListMode
              ? 'Browse the latest 30 released movies from your local database.'
              : isTopRatedListMode
                ? 'Browse the top 30 released movies ordered by score from your local database.'
              : isUpcomingListMode
                ? 'Browse the next 30 movies releasing in the next 30 days from your local database.'
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
          <PopularMoviesGrid popularMoviesState={popularMoviesState} layout="catalog" onOpenMovie={onOpenMovie} />
        </ContentSection>
      ) : isNowPlayingListMode ? (
        <ContentSection title="Now Playing">
          <RecentlyReleasedSlider recentMoviesState={recentMoviesState} layout="catalog" onOpenMovie={onOpenMovie} />
        </ContentSection>
      ) : isTopRatedListMode ? (
        <ContentSection title="Top Rated">
          <TopRatedMoviesGrid topRatedMoviesState={topRatedMoviesState} layout="catalog" onOpenMovie={onOpenMovie} />
        </ContentSection>
      ) : isUpcomingListMode ? (
        <ContentSection title="Upcoming Soon">
          <UpcomingMoviesGrid upcomingMoviesState={upcomingMoviesState} layout="catalog" onOpenMovie={onOpenMovie} />
        </ContentSection>
      ) : (
        <>
          <div className="movies-layout">
            <div className="movies-main">
              <FeaturedMovieCard popularMoviesState={popularMoviesState} onOpenMovie={onOpenMovie} />

              <ContentSection title="Popular Right Now" action="View all" onAction={onOpenPopularMovies}>
                <PopularMoviesGrid popularMoviesState={popularMoviesState} onOpenMovie={onOpenMovie} />
              </ContentSection>

              <ContentSection title="Recently Released" action="View all" onAction={onOpenRecentlyReleasedMovies}>
                <RecentlyReleasedSlider recentMoviesState={recentMoviesState} onOpenMovie={onOpenMovie} />
              </ContentSection>

              <ContentSection title="Upcoming Soon" action="View all" onAction={onOpenUpcomingMovies}>
                <UpcomingMoviesGrid upcomingMoviesState={upcomingMoviesState} onOpenMovie={onOpenMovie} />
              </ContentSection>

              <ContentSection title="Top Rated" action="View all" onAction={onOpenTopRatedMovies}>
                <TopRatedMoviesGrid topRatedMoviesState={topRatedMoviesState} onOpenMovie={onOpenMovie} />
              </ContentSection>
            </div>

            <aside className="movies-rail">
              <StatsPanel title="Your Movie Stats" items={movieStats} monthLabel="This Month" />
              <MovieWatchlistPanel items={movieWatchlist} />
            </aside>
          </div>

          <section className="movie-mobile-stats mobile-only">
            {movieStats.map(({ label, value, tone, icon: Icon }) => (
              <article key={label} className="mini-stat">
                <div className={`stat-icon ${tone}`}>
                  <Icon />
                </div>
                <strong>{value}</strong>
                <span>{label.replace('Movies Watched', 'Watched').replace('Average Rating', 'Rating').replace('In Watchlist', 'Watchlist').replace('Hours Watched', 'Hours')}</span>
              </article>
            ))}
          </section>
        </>
      )}
    </section>
  )
}

function MovieDetailPage({ movieDetailState, onBackToMovies }) {
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
            <span>{movie.year}</span>
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

          <div className="movie-detail-tags">
            {detailFeatureTags.map((tag) => (
              <span key={tag} className="movie-detail-tag">
                {tag}
              </span>
            ))}
          </div>

          <div className="movie-detail-actions">
            <button type="button" className="primary-button movie-detail-primary">
              <PlusIcon />
              <span>Watchlist</span>
            </button>
            <button type="button" className="secondary-button movie-detail-secondary">
              <CheckIcon />
              <span>Mark as Watched</span>
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
              </div>
            </div>
            <div className="movie-detail-status-item">
              <WatchedStatusIcon />
              <div>
                <span>Watched</span>
                <strong>Apr 14, 2024</strong>
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
            <button type="button" className="section-link">
              View all
            </button>
          </div>
          <div className="movie-detail-cast">
            {detailCast.map((member) => (
              <article key={member.name} className="movie-detail-cast-card">
                <div className={`movie-detail-cast-avatar ${member.theme}`} />
                <h3>{member.name}</h3>
                <p>{member.role}</p>
              </article>
            ))}
            <article className="movie-detail-cast-card more">
              <div className="movie-detail-cast-avatar more-avatar">+8</div>
              <h3>More</h3>
            </article>
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
                <strong>Apr 14, 2024</strong>
              </div>
            </div>
            <div className="movie-detail-activity-item">
              <ProgressIcon />
              <div>
                <span>Progress</span>
                <div className="movie-detail-progress">
                  <span style={{ width: '100%' }} />
                </div>
              </div>
              <strong>100%</strong>
            </div>
            <div className="movie-detail-activity-item">
              <ReplayIcon />
              <div>
                <span>Rewatch Count</span>
                <strong>1 time</strong>
              </div>
            </div>
            <div className="movie-detail-activity-item">
              <NotesIcon />
              <div>
                <span>Notes</span>
                <strong>Incredible world-building and cinematography. 10/10.</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="content-section movie-detail-panel">
          <div className="section-header">
            <h2>More Like This</h2>
            <button type="button" className="section-link">
              View all
            </button>
          </div>
          <div className="movie-detail-similar">
            {detailMoreLikeThis.map((item) => (
              <article key={item.title} className="movie-detail-similar-card">
                <div className={`movie-detail-similar-poster ${item.theme}`} />
                <div className="movie-detail-similar-copy">
                  <span>{item.year}</span>
                  <strong>{item.title}</strong>
                  <div className="star-rating">
                    <StarIcon />
                    {item.rating}
                  </div>
                </div>
              </article>
            ))}
          </div>
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
          <div className="movie-detail-review-grid">
            {detailReviews.map((review) => (
              <article key={review.author} className="movie-detail-review-card">
                <div className="movie-detail-review-header">
                  <div className="movie-detail-review-author">
                    <div className="avatar small">{review.author.charAt(0)}</div>
                    <span>{review.author}</span>
                  </div>
                  <div className="movie-detail-review-rating">
                    <span className="movie-detail-stars">★★★★★</span>
                    <strong>{review.rating}</strong>
                  </div>
                </div>
                <p>{review.copy}</p>
                <div className="movie-detail-review-meta">
                  <span>{review.date}</span>
                  <span>{review.likes}</span>
                </div>
              </article>
            ))}
          </div>
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

function MovieWatchlistPanel({ items }) {
  return (
    <section className="movie-watchlist-panel">
      <div className="section-header">
        <h2>Your Watchlist</h2>
        <button type="button" className="section-link">
          View all
        </button>
      </div>

      <div className="movie-watchlist-list">
        {items.map((item) => (
          <article key={item.title} className="movie-watchlist-item">
            <div className={`movie-watchlist-poster ${item.theme}`} />
            <div className="movie-watchlist-copy">
              <h3>{item.title}</h3>
              <p>{item.year}</p>
              <span>{item.meta}</span>
            </div>
            <div className="movie-watchlist-meta">
              <button type="button" className="poster-menu" aria-label={`More options for ${item.title}`}>
                <MoreIcon />
              </button>
              <span className="star-rating">
                <StarIcon />
                {item.rating}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
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

function MovieCard({ movie, onOpenMovie }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(movie.posterUrl) && !posterUnavailable

  return (
    <button type="button" className="movie-card movie-card-button" onClick={() => onOpenMovie(movie)} aria-label={`Open ${movie.title}`}>
      <div className={`movie-card-poster ${showPosterImage ? 'has-image' : movie.theme}`}>
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

function FeaturedMovieCard({ popularMoviesState, onOpenMovie }) {
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
          <button type="button" className="primary-button">
            <PlusIcon />
            <span>Add to Watchlist</span>
          </button>
          <button type="button" className="secondary-button">
            <CheckIcon />
            <span>Mark as Watched</span>
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

function PopularMoviesGrid({ popularMoviesState, layout = 'slider', onOpenMovie }) {
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
        <MovieCard key={movie.id} movie={movie} onOpenMovie={onOpenMovie} />
      ))}
    </div>
  )
}

function RecentlyReleasedSlider({ recentMoviesState, layout = 'slider', onOpenMovie }) {
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
        <MovieCard key={movie.id} movie={movie} onOpenMovie={onOpenMovie} />
      ))}
    </div>
  )
}

function UpcomingMoviesGrid({ upcomingMoviesState, layout = 'slider', onOpenMovie }) {
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
        <MovieCard key={movie.id} movie={movie} onOpenMovie={onOpenMovie} />
      ))}
    </div>
  )
}

function TopRatedMoviesGrid({ topRatedMoviesState, layout = 'slider', onOpenMovie }) {
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
        <MovieCard key={movie.id} movie={movie} onOpenMovie={onOpenMovie} />
      ))}
    </div>
  )
}

function SectionMessage({ message, tone = 'neutral' }) {
  return <p className={`section-message${tone === 'error' ? ' error' : ''}`}>{message}</p>
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
  }
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

  const parsedDate = new Date(`${releaseDate}T00:00:00.000Z`)

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

function HeartIcon() {
  return (
    <IconBase>
      <path d="M12 19s-6.5-3.95-6.5-8.6A3.9 3.9 0 0 1 12 7.2a3.9 3.9 0 0 1 6.5 3.2C18.5 15.05 12 19 12 19Z" />
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

function StarBadgeIcon() {
  return (
    <IconBase>
      <path d="M12 4.5 13.7 8l3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8L6.5 8.5 10.3 8 12 4.5Z" />
      <path d="M12 15.2V19.5" />
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

function ArrowRight() {
  return (
    <IconBase>
      <path d="M5 12h14" />
      <path d="m13 7 5 5-5 5" />
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

export default App
