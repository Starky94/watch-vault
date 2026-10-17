import { useEffect, useState } from 'react'
import { buildCollectionsPath, formatCollectionMovieCount, formatCollectionPopularity, formatCollectionRating, memberMovieRating, sortCollectionParts } from './franchiseCollections.js'
import './FranchiseCollections.css'

const imageUrl = (path, size = 'w342') => path ? `https://image.tmdb.org/t/p/${size}${path}` : null

function Rating({ value, label }) {
  return <span className="franchise-rating" aria-label={`${label}: ${formatCollectionRating(value)}`}>
    <span aria-hidden="true">★</span> {formatCollectionRating(value)}
  </span>
}

function Metrics({ rating, popularity, label }) {
  return <span className="franchise-metrics">
    <Rating value={rating} label={label} />
    <span className="franchise-popularity" aria-label={`Popularity: ${formatCollectionPopularity(popularity)}`} title="Popularity">Popularity {formatCollectionPopularity(popularity)}</span>
  </span>
}

function Poster({ path, name }) {
  const [failedPath, setFailedPath] = useState(null)
  return path && path !== failedPath ? <img src={imageUrl(path)} alt={name} loading="lazy" onError={() => setFailedPath(path)} /> : <span className="franchise-no-art">No artwork</span>
}

export default function FranchiseCollections({ route, tabs, onTabChange, onNavigate, onOpenMovie, isSignedIn, watchedStatus, watchedMovieIds, watchlistMovieIds, onToggleWatchlist, onToggleWatched, ui }) {
  const { QuickMediaActions, CheckCircleIcon, StarIcon } = ui
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const { collectionId, page, query = '', sort = 'popularity', hideWatched = false } = route
  const [searchInput, setSearchInput] = useState(query)
  const completionWatchedIds = !collectionId && (sort === 'completion' || hideWatched) ? watchedMovieIds : null
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', data: null, error: '' })
    const url = collectionId ? `/api/movies/collections/${collectionId}` : `/api${buildCollectionsPath({ page, query, sort, hideWatched })}&limit=30`
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load collections.')
        if (!controller.signal.aborted) setState({ status: 'success', data, error: '' })
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', data: null, error: error.message })
      }
    }
    void load()
    return () => controller.abort()
  }, [collectionId, page, query, sort, hideWatched, isSignedIn, completionWatchedIds])
  const collection = state.data?.collection
  const listPath = buildCollectionsPath({ page, query, sort, hideWatched })
  return <section className="movies-page franchise-page">
    <div className="movies-browse-toolbar">
      <div className="movies-heading"><h1>{collection?.name || 'Collections'}</h1><p>Explore movie collections and their films.</p></div>
      <section className="movies-toolbar-controls" aria-label="Movie browsing controls">
        <button type="button" className="movies-discover-button" onClick={() => onTabChange('All Movies')}>Discover</button>
        <div className="tab-row movies-tab-row" aria-label="Movie catalog categories">
          {tabs.filter((tab) => tab !== 'All Movies').map((tab) => <button key={tab} type="button" className={`filter-pill${tab === 'Collections' ? ' active' : ''}`} aria-current={tab === 'Collections' ? 'page' : undefined} onClick={() => tab === 'Collections' ? onNavigate(listPath) : onTabChange(tab)}>{tab}</button>)}
        </div>
      </section>
    </div>
    {!collectionId ? <form className="franchise-search" role="search" aria-label="Search collections" onSubmit={(event) => {
      event.preventDefault()
      onNavigate(buildCollectionsPath({ query: searchInput, sort, hideWatched }))
    }}>
      <label htmlFor="collection-name-search">Search by name</label>
      <div className="franchise-search-controls">
        <div className="franchise-search-fields">
          <input id="collection-name-search" type="search" placeholder="Search collections…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          <button type="submit" className="primary-button">Search</button>
          {query || searchInput ? <button type="button" className="secondary-button" onClick={() => { setSearchInput(''); onNavigate(buildCollectionsPath({ sort, hideWatched })) }}>Clear</button> : null}
        </div>
        <button type="button" className={`filter-pill franchise-hide-watched${hideWatched ? ' active' : ''}`} aria-pressed={hideWatched} disabled={!isSignedIn} title={!isSignedIn ? 'Sign in to hide watched collections' : undefined} onClick={() => onNavigate(buildCollectionsPath({ query, sort, hideWatched: !hideWatched }))}>Hide watched</button>
      </div>
    </form> : null}
    {!collectionId ? <div className="franchise-sort-bar">
      <label className="franchise-sort-control">Sort by
        <select aria-label="Sort collections by" value={sort} onChange={(event) => onNavigate(buildCollectionsPath({ query, sort: event.target.value, hideWatched }))}>
          <option value="rating">Rating</option>
          <option value="popularity">Popularity</option>
          <option value="completion" disabled={!isSignedIn}>Completion progress{!isSignedIn ? ' (sign in)' : ''}</option>
        </select>
      </label>
      <p className="franchise-sort-label">{sort === 'completion' ? 'Most completed collections first · Your watched percentage' : sort === 'popularity' ? 'Most popular collections first · Average movie popularity' : 'Highest rated collections first · Average of rated movies'}</p>
    </div> : null}
    {collectionId ? <button type="button" className="secondary-button" onClick={() => onNavigate(listPath)}>Back to collections</button> : null}
    {state.status === 'loading' ? <p role="status">Loading collections…</p> : null}
    {state.status === 'error' ? <p role="alert">{state.error}</p> : null}
    {state.status === 'success' && collection ? <>
      <article className="franchise-detail">
        {collection.backdrop_path ? <img className="franchise-backdrop" src={imageUrl(collection.backdrop_path, 'w1280')} alt="" /> : null}
        <div className="franchise-detail-copy"><h2>{collection.name}</h2><p>{collection.overview || 'No description available.'}</p><a href={collection.tmdb_url} target="_blank" rel="noreferrer">View collection on TMDB</a><p>{collection.parts.length} movies</p><Metrics rating={collection.average_rating} popularity={collection.popularity} label="Collection rating" /></div>
      </article>
      <div className="franchise-grid" aria-label="Collection movies">
        {sortCollectionParts(collection.parts).map((movie) => {
          const card = { id: Number(movie.id), title: movie.title || movie.original_title || 'Untitled', posterUrl: imageUrl(movie.poster_path), year: movie.release_date?.slice(0, 4) || '', releaseDate: movie.release_date, rating: memberMovieRating(movie) === null ? '—' : memberMovieRating(movie).toFixed(1) }
          const isWatched = watchedMovieIds.has(card.id)
          const isInWatchlist = watchlistMovieIds.has(card.id)
          return <article className="franchise-card franchise-movie-card quick-media-card" key={card.id}>
            <button type="button" className="quick-media-card-open" onClick={() => onOpenMovie(card)} aria-label={`Open ${card.title}`} />
            <div className="franchise-poster">
              <Poster path={movie.poster_path} name={card.title} />
              {isWatched ? <span className="movie-card-watched-badge" aria-label={`${card.title} is watched`}><CheckCircleIcon /></span> : null}
              {isInWatchlist ? <span className="movie-card-watchlist-badge" aria-label={`${card.title} is in your watchlist`}><StarIcon /></span> : null}
              <QuickMediaActions
                title={card.title}
                isWatched={isWatched}
                isInWatchlist={isInWatchlist}
                onOpen={() => onOpenMovie(card)}
                onToggleWatchlist={() => onToggleWatchlist(card)}
                onToggleWatched={() => onToggleWatched(card)}
              />
            </div>
            <strong>{card.title}</strong><span>{movie.release_date?.slice(0, 4) || 'Release date unknown'}</span><Metrics rating={memberMovieRating(movie)} popularity={movie.popularity} label="TMDB rating" />
          </article>
        })}
      </div>
      {!collection.parts.length ? <p>No movies in this collection yet.</p> : null}
    </> : null}
    {state.status === 'success' && !collectionId ? <>
      <div className="franchise-grid" aria-label="Movie collections">
        {state.data.collections.map((item) => <button type="button" className="franchise-card" key={item.id} onClick={() => onNavigate(buildCollectionsPath({ collectionId: item.id, page, query, sort, hideWatched }))}>
          <div className="franchise-poster"><Poster path={item.poster_path} name={item.name} /></div><strong>{item.name}</strong><span>{formatCollectionMovieCount(item, isSignedIn && watchedStatus === 'success' ? watchedMovieIds : null)}</span><Metrics rating={item.average_rating} popularity={item.popularity} label="Collection rating" />
        </button>)}
      </div>
      {!state.data.collections.length ? <p>{query ? `No collections found for “${query}”.` : hideWatched ? 'No unwatched collections found.' : 'No collections available yet. The daily import will add new collections here.'}</p> : null}
      <nav className="franchise-pagination" aria-label="Collections pagination">
        <button type="button" className="secondary-button" disabled={!state.data.pagination.hasPreviousPage} onClick={() => onNavigate(buildCollectionsPath({ page: page - 1, query, sort, hideWatched }))}>Previous</button>
        <span>Page {page}</span>
        <button type="button" className="secondary-button" disabled={!state.data.pagination.hasNextPage} onClick={() => onNavigate(buildCollectionsPath({ page: page + 1, query, sort, hideWatched }))}>Next</button>
      </nav>
    </> : null}
  </section>
}
