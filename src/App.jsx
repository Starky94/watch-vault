import { useEffect, useState } from 'react'
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

const featuredMovie = {
  title: 'Dune: Part Two',
  year: '2024',
  genres: ['Adventure', 'Sci-Fi'],
  rating: 'PG-13',
  runtime: '2h 46m',
  score: '8.7/10',
  audience: '92%',
  summary: 'Paul Atreides unites with the Fremen and seeks revenge against the conspirators who destroyed his family.',
  theme: 'theme-dune-hero',
}

const movieStats = [
  { label: 'Movies Watched', value: '28', trend: '+27%', tone: 'violet', icon: TicketIcon },
  { label: 'Average Rating', value: '4.2', trend: '+0.3', tone: 'gold', icon: StarBadgeIcon },
  { label: 'In Watchlist', value: '56', trend: '+12%', tone: 'orange', icon: BookmarkStackIcon },
  { label: 'Hours Watched', value: '48h 32m', trend: '+16%', tone: 'blue', icon: ClockIcon },
]

const recentMovies = [
  { title: 'IF', year: '2024', rating: '6.5', meta: '1h 44m', theme: 'theme-if' },
  { title: 'Furiosa', year: '2024', rating: '7.7', meta: '2h 28m', theme: 'theme-furiosa' },
  { title: 'Inside Out 2', year: '2024', rating: '8.2', meta: '1h 36m', theme: 'theme-inside-out' },
  { title: 'The Garfield Movie', year: '2024', rating: '5.6', meta: '1h 41m', theme: 'theme-garfield' },
  { title: 'Bad Boys: Ride or Die', year: '2024', rating: '6.6', meta: '1h 55m', theme: 'theme-bad-boys' },
  { title: 'A Quiet Place: Day One', year: '2024', rating: '6.7', meta: '1h 39m', theme: 'theme-quiet-place' },
]

const movieWatchlist = [
  { title: 'Oppenheimer', year: '2023', meta: 'Drama, Biography', rating: '4.6', theme: 'theme-oppenheimer' },
  { title: 'Interstellar', year: '2014', meta: 'Sci-Fi, Adventure', rating: '4.8', theme: 'theme-interstellar' },
  { title: 'The Dark Knight', year: '2008', meta: 'Action, Crime', rating: '4.7', theme: 'theme-dark-knight' },
  { title: 'Inception', year: '2010', meta: 'Sci-Fi, Thriller', rating: '4.6', theme: 'theme-inception' },
]

const mobileNavItems = [
  { label: 'Home', icon: HomeIcon, view: primaryViews.home },
  { label: 'Search', icon: SearchIcon, view: primaryViews.movies },
  { label: 'Watchlist', icon: BookmarkIcon },
  { label: 'Stats', icon: BarsIcon },
  { label: 'More', icon: MoreIcon },
]

function App() {
  const [activeView, setActiveView] = useState(primaryViews.home)
  const [activeTab, setActiveTab] = useState(homeTabs[0])
  const [activeMovieTab, setActiveMovieTab] = useState(movieTabs[0])
  const [moviesScreenMode, setMoviesScreenMode] = useState(movieScreenModes.overview)
  const [popularMoviesState, setPopularMoviesState] = useState({
    status: 'idle',
    movies: [],
    error: '',
  })

  function handleMovieViewSelection(view) {
    setActiveView(view)

    if (view !== primaryViews.movies) {
      return
    }

    if (activeMovieTab === 'Popular') {
      setMoviesScreenMode(movieScreenModes.popularList)
      return
    }

    setMoviesScreenMode(movieScreenModes.overview)
  }

  function handleMovieTabChange(tab) {
    setActiveMovieTab(tab)
    setMoviesScreenMode(tab === 'Popular' ? movieScreenModes.popularList : movieScreenModes.overview)
  }

  function handleOpenPopularMovies() {
    setActiveView(primaryViews.movies)
    setActiveMovieTab('Popular')
    setMoviesScreenMode(movieScreenModes.popularList)
  }

  useEffect(() => {
    if (activeView !== primaryViews.movies || popularMoviesState.status !== 'idle') {
      return
    }

    let cancelled = false

    async function loadPopularMovies() {
      setPopularMoviesState({
        status: 'loading',
        movies: [],
        error: '',
      })

      try {
        const response = await fetch('/api/movies')

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        const movies = Array.isArray(payload.movies) ? payload.movies.map(mapMovieRowToCard) : []

        if (!cancelled) {
          setPopularMoviesState({
            status: 'success',
            movies,
            error: '',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setPopularMoviesState({
            status: 'error',
            movies: [],
            error: error instanceof Error ? error.message : 'Unable to load movies right now.',
          })
        }
      }
    }

    loadPopularMovies()

    return () => {
      cancelled = true
    }
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
        <DesktopTopbar activeView={activeView} />
        <MobileHeader />

        {activeView === primaryViews.home ? (
          <HomeScreen activeTab={activeTab} setActiveTab={setActiveTab} />
        ) : (
          <MoviesScreen
            activeTab={activeMovieTab}
            setActiveTab={handleMovieTabChange}
            screenMode={moviesScreenMode}
            popularMoviesState={popularMoviesState}
            onOpenPopularMovies={handleOpenPopularMovies}
          />
        )}

        <MobileNav activeView={activeView} setActiveView={handleMovieViewSelection} />
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

function DesktopTopbar({ activeView }) {
  return (
    <header className="topbar desktop-only">
      <label className="searchbar" aria-label="Search">
        <SearchIcon />
        <input
          type="text"
          placeholder={
            activeView === primaryViews.movies
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

        <button type="button" className="profile-button">
          <div className="avatar">A</div>
          <span>Alex Morgan</span>
          <ChevronDown />
        </button>
      </div>
    </header>
  )
}

function MobileHeader() {
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
        <button type="button" className="avatar-button">
          <div className="avatar small">A</div>
        </button>
      </div>
    </header>
  )
}

function HomeScreen({ activeTab, setActiveTab }) {
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
          <p className="eyebrow">Good evening, Alex! 🍿</p>
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

function MoviesScreen({ activeTab, setActiveTab, screenMode, popularMoviesState, onOpenPopularMovies }) {
  const isPopularListMode = screenMode === movieScreenModes.popularList && activeTab === 'Popular'

  return (
    <section className="movies-page">
      <div className="movies-heading">
        <h1>Movies</h1>
        <p>
          {isPopularListMode
            ? 'Browse the 30 most popular movies imported from your local database.'
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
          <PopularMoviesGrid popularMoviesState={popularMoviesState} layout="catalog" />
        </ContentSection>
      ) : (
        <>
          <div className="movies-layout">
            <div className="movies-main">
              <article className="featured-movie-card">
                <div className="featured-movie-copy">
                  <span className="feature-label">Featured</span>
                  <h2>{featuredMovie.title}</h2>
                  <div className="featured-movie-meta">
                    <span>{featuredMovie.year}</span>
                    <span>{featuredMovie.genres.join(', ')}</span>
                    <span>{featuredMovie.rating}</span>
                    <span>{featuredMovie.runtime}</span>
                  </div>
                  <div className="featured-movie-scores">
                    <span className="movie-score">
                      <StarIcon />
                      {featuredMovie.score}
                    </span>
                    <span className="movie-score tomato-score">
                      <TomatoIcon />
                      {featuredMovie.audience}
                    </span>
                  </div>
                  <p>{featuredMovie.summary}</p>

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

                <div className={`featured-movie-art ${featuredMovie.theme}`} aria-hidden="true">
                  <button type="button" className="feature-arrow" aria-label="Next featured movie">
                    <ChevronRight />
                  </button>
                  <div className="feature-dots">
                    <span className="active" />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </article>

              <ContentSection title="Popular Right Now" action="View all" onAction={onOpenPopularMovies}>
                <PopularMoviesGrid popularMoviesState={popularMoviesState} />
              </ContentSection>

              <ContentSection title="Recently Released" action="View all">
                <div className="movie-card-grid">
                  {recentMovies.map((movie) => (
                    <MovieCard key={movie.title} movie={movie} />
                  ))}
                </div>
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

function MovieCard({ movie }) {
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const showPosterImage = Boolean(movie.posterUrl) && !posterUnavailable

  return (
    <article className="movie-card">
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
    </article>
  )
}

function PopularMoviesGrid({ popularMoviesState, layout = 'slider' }) {
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
        <MovieCard key={movie.id} movie={movie} />
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
    posterUrl: resolveMoviePosterUrl(movie.poster_path),
    theme: 'theme-catalog',
  }
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

function resolveMoviePosterUrl(posterPath) {
  if (!posterPath) {
    return null
  }

  return `https://image.tmdb.org/t/p/w500${posterPath}`
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

export default App
