import { useState } from 'react'
import type { ContinueWatchingState, HomeActions, HomeStatsItem, HomeUi, HomeViewData, NextUpItem, TonightPick } from './homeTypes.ts'

type HomeProps = { data: HomeViewData; actions: HomeActions; ui: HomeUi }

export function HomeScreen({ data, actions, ui }: HomeProps) {
  return (
    <>
      <HomeHero data={data} actions={actions} ui={ui} />
      <NextUpSection
        ui={ui}
        isSignedIn={Boolean(data.user)}
        continueWatchingState={data.continueWatchingState}
        items={data.nextUpItems}
        onOpenMovie={actions.onOpenMovie}
        onOpenTvShow={actions.onOpenTvShow}
        onOpenBook={actions.onOpenBook}
        onOpenWatchlist={actions.onOpenWatchlist}
      />
      <MobileStats stats={data.stats} />
      <ContinueWatchingSection data={data} actions={actions} ui={ui} />
      <HomeExploreSections data={data} actions={actions} ui={ui} />
    </>
  )
}

function HomeHero({ data, actions, ui }: HomeProps) {
  const { SparklesIcon, ClockIcon, PlayIcon, BookmarkIcon, StatsPanel, getFirstName, getSeasonalThemeLabel } = ui
  const { user, seasonalTheme, stats, statsPeriod, tonightPick } = data
  const { onOpenDiscover, onOpenSeasonalMovies, onOpenWatchlist, onStatsPeriodChange, openTonightPick } = actions
  const greeting = user ? `Good evening, ${getFirstName(user.fullName)}! 🍿` : 'Good evening! 🍿'

  return (
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

      <TonightPickArtwork ui={ui} key={tonightPick ? `${tonightPick.kind}-${tonightPick.id}` : 'empty'} pick={tonightPick} />

      <StatsPanel title="Your Stats" items={stats} period={statsPeriod} onPeriodChange={onStatsPeriodChange} />
    </section>
  )
}

function MobileStats({ stats }: { stats: HomeStatsItem[] }) {
  return (
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
  )
}

function ContinueWatchingSection({ data, actions, ui }: HomeProps) {
  const { ContentSection, SectionMessage, ProgressCard } = ui
  const { continueWatchingState, tvWatchlistIds, tvWatchedIds } = data
  const { onOpenContinueWatching, onOpenTvShow, onToggleTvWatchlist } = actions
  return (
    <ContentSection title="Continue Watching" action="See all" onAction={onOpenContinueWatching} className="home-secondary-section">
      {continueWatchingState.status === 'loading' ? <SectionMessage message="Loading your TV progress..." /> : null}
      {continueWatchingState.status === 'error' ? <SectionMessage message={continueWatchingState.error} tone="error" /> : null}
      {continueWatchingState.status === 'idle' ? <SectionMessage message="Sign in to view shows you are watching." /> : null}
      {continueWatchingState.status === 'success' && continueWatchingState.shows.length === 0 ? <SectionMessage message="Start watching a TV show to see it here." /> : null}
      {continueWatchingState.shows.length > 0 ? <div className="feature-grid home-secondary-rail">{continueWatchingState.shows.map((item) => <ProgressCard key={item.id} item={item} onOpenTvShow={onOpenTvShow} isInWatchlist={tvWatchlistIds.has(Number(item.id))} isWatched={tvWatchedIds.has(Number(item.id))} onToggleWatchlist={onToggleTvWatchlist} />)}</div> : null}
    </ContentSection>
  )
}

function HomeExploreSections({ data, actions, ui }: HomeProps) {
  return (
    <section className="home-tertiary-stack" aria-label="More to explore">
      <HomeWatchlistSection data={data} actions={actions} ui={ui} />
      <TrendingMoviesSection data={data} actions={actions} ui={ui} />
      <NewEpisodesSection data={data} actions={actions} ui={ui} />
    </section>
  )
}

function HomeWatchlistSection({ data, actions, ui }: HomeProps) {
  const { ContentSection, SectionMessage, HomeWatchlistCard } = ui
  const { user, watchlistState, tvWatchedIds, watchedMovieIds, readBookIds, homeWatchlistItems } = data
  const { onOpenMovie, onOpenWatchlist, onOpenTvShow, onOpenBook, onToggleMovieWatchlist, onToggleMovieWatched, onToggleTvWatchlist, onToggleBookWatchlist, onToggleBookRead } = actions
  return (
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
              onToggleWatched={item.kind === 'tv' ? null : item.kind === 'movie' ? onToggleMovieWatched : onToggleBookRead}
            />
          ))}
        </div>
      ) : null}
    </ContentSection>
  )
}

function TrendingMoviesSection({ data, actions, ui }: HomeProps) {
  const { ContentSection, SectionMessage, RatingCard } = ui
  const { popularMoviesState, watchlistMovieIds, watchedMovieIds, trendingMovies } = data
  const { onOpenMovie, onOpenPopularMovies, onToggleMovieWatchlist, onToggleMovieWatched } = actions
  return (
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
            <RatingCard key={item.id} item={item} onOpenMovie={onOpenMovie} isInWatchlist={watchlistMovieIds.has(Number(item.id))} isWatched={watchedMovieIds.has(Number(item.id))} onToggleWatchlist={onToggleMovieWatchlist} onToggleWatched={onToggleMovieWatched} />
          ))}
        </div>
      ) : null}
    </ContentSection>
  )
}

function NewEpisodesSection({ data, actions, ui }: HomeProps) {
  const { ContentSection, TvShowsGrid } = ui
  const { latestEpisodesState, tvWatchedIds, tvWatchlistIds } = data
  const { onOpenLatestEpisodes, onOpenTvShow, onToggleTvWatchlist } = actions
  return (
    <ContentSection title="New Episodes" action="See all" onAction={onOpenLatestEpisodes} className="home-tertiary-section">
      <TvShowsGrid tvState={latestEpisodesState} onSelectShow={onOpenTvShow} watchedIds={tvWatchedIds} watchlistIds={tvWatchlistIds} onToggleWatchlist={onToggleTvWatchlist} />
    </ContentSection>
  )
}

function NextUpSection({ ui, isSignedIn, continueWatchingState, items, onOpenMovie, onOpenTvShow, onOpenBook, onOpenWatchlist }: {
  ui: HomeUi
  isSignedIn: boolean
  continueWatchingState: ContinueWatchingState
  items: NextUpItem[]
  onOpenMovie: HomeActions['onOpenMovie']
  onOpenTvShow: HomeActions['onOpenTvShow']
  onOpenBook: HomeActions['onOpenBook']
  onOpenWatchlist: HomeActions['onOpenWatchlist']
}) {
  const { SectionMessage } = ui

  function openItem(item: NextUpItem) {
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
      {items.length ? <div className="next-up-grid">{items.map((item) => <NextUpCard ui={ui} key={`${item.featured ? 'continue' : item.kind}-${item.id}`} item={item} onOpen={() => openItem(item)} />)}</div> : null}
    </section>
  )
}

function NextUpCard({ ui, item, onOpen }: { ui: HomeUi; item: NextUpItem; onOpen: () => void }) {
  const { ClapperIcon, BookmarkIcon, TvIcon, ChevronRight } = ui
  const [artworkUnavailable, setArtworkUnavailable] = useState(false)
  const showArtwork = Boolean(item.artworkUrl) && !artworkUnavailable
  const KindIcon = item.kind === 'movie' ? ClapperIcon : item.kind === 'book' ? BookmarkIcon : TvIcon

  return (
    <article className={`next-up-card${item.featured ? ' featured' : ''}`}>
      <button type="button" className="next-up-card-button" onClick={onOpen} aria-label={`${item.actionLabel}: ${item.title}`}>
        <div className={`next-up-art${showArtwork ? ' has-image' : ''}`}>
          {showArtwork ? <img src={item.artworkUrl ?? undefined} alt="" loading="lazy" onError={() => setArtworkUnavailable(true)} /> : <KindIcon />}
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

function TonightPickArtwork({ ui, pick }: { ui: HomeUi; pick: TonightPick | null }) {
  const { SparklesIcon } = ui
  const [artworkUnavailable, setArtworkUnavailable] = useState(false)
  const showArtwork = Boolean(pick?.artworkUrl) && !artworkUnavailable

  return (
    <div className={`hero-art tonight-pick-art${showArtwork ? ' has-image' : ''}`} aria-hidden="true">
      {showArtwork ? <img src={pick?.artworkUrl ?? undefined} alt="" onError={() => setArtworkUnavailable(true)} /> : null}
      <div className="tonight-pick-art-glow" />
      <span className="tonight-pick-art-badge">Selected for you</span>
      {pick ? <strong>{pick.kind === 'tv' ? 'Continue watching' : 'Movie night'}</strong> : <SparklesIcon />}
    </div>
  )
}
