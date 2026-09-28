import { useEffect, useState } from 'react'
import { createHomeQueue, selectHomeWatchlistItems, selectNextUpItems, selectTonightPick } from './homeSelectors.ts'
import { loadCollection } from '../collectionLoader.js'
import type { HomeActions, HomeInputData, HomeMovie, HomeUser, HomeViewData, LatestEpisodeApi, LatestEpisodesState, MovieRowApi, FeaturedMovieApi, PopularMoviesState } from './homeTypes.ts'

const emptyLatestEpisodes: LatestEpisodesState = {
  status: 'idle',
  shows: [],
  pagination: { page: 1, pageSize: 30, hasNextPage: false, hasPreviousPage: false },
  error: '',
}

const emptyPopularMovies: PopularMoviesState = { status: 'idle', movies: [], featuredMovie: null, error: '' }

function formatEpisodeDate(value: string): string {
  const date = new Date(typeof value === 'string' && value.includes('T') ? value : `${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return 'Release TBA'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function mapLatestEpisode(show: LatestEpisodeApi) {
  const episode = show.latestEpisode ?? {}
  const seasonNumber = Number(episode.seasonNumber)
  const episodeNumber = Number(episode.episodeNumber)
  const episodeLabel = Number.isInteger(seasonNumber) && Number.isInteger(episodeNumber) ? `S${seasonNumber} E${episodeNumber}` : 'Latest episode'

  return {
    id: show.id,
    title: show.title,
    year: episode.airDate ? formatEpisodeDate(episode.airDate) : 'Recently aired',
    rating: typeof show.popularity === 'number' ? Math.round(show.popularity) : 0,
    meta: episodeLabel,
    seasonMeta: episode.title ? `${episodeLabel} · ${episode.title}` : episodeLabel,
    posterUrl: show.posterUrl || null,
    backdropUrl: show.backdropUrl || null,
    theme: 'theme-catalog',
  }
}


export function useHomePage({ enabled, user, data, actions, mapMovie, mapFeaturedMovie, pageSize }: {
  enabled: boolean
  user: HomeUser | null
  data: HomeInputData
  actions: Omit<HomeActions, 'openTonightPick'>
  mapMovie: (movie: MovieRowApi) => Omit<HomeMovie, 'kind'>
  mapFeaturedMovie: (movie: FeaturedMovieApi) => Omit<HomeMovie, 'kind'>
  pageSize: number
}): { data: HomeViewData; actions: HomeActions } {
  const [latestEpisodesState, setLatestEpisodesState] = useState<LatestEpisodesState>(emptyLatestEpisodes)
  const [popularMoviesState, setPopularMoviesState] = useState<PopularMoviesState>(emptyPopularMovies)

  useEffect(() => {
    if (!enabled) return
    return loadCollection<MovieRowApi, PopularMoviesState, FeaturedMovieApi>({
      url: `/api/movies?page=1&limit=${pageSize}`,
      setState: setPopularMoviesState, loadingState: { ...emptyPopularMovies, status: 'loading' },
      itemsKey: 'movies', mapItem: mapMovie,
      featuredKey: 'featuredMovie', mapFeatured: mapFeaturedMovie,
      errorMessage: 'Unable to load movies right now.',
    })
  }, [enabled, mapMovie, mapFeaturedMovie, pageSize])

  useEffect(() => {
    if (!enabled) return
    return loadCollection<LatestEpisodeApi, LatestEpisodesState>({
      url: '/api/tv/latest-episodes',
      setState: setLatestEpisodesState, loadingState: { ...emptyLatestEpisodes, status: 'loading' },
      itemsKey: 'shows', mapItem: mapLatestEpisode,
      errorMessage: 'Unable to load the latest TV episodes right now.',
    })
  }, [enabled])

  const homeQueue = createHomeQueue({ ...data, popularMoviesState })
  const homeWatchlistItems = selectHomeWatchlistItems(homeQueue)
  const nextUpItems = selectNextUpItems(homeQueue)
  const trendingMovies: HomeMovie[] = popularMoviesState.movies.slice(0, 5).map((movie) => ({ ...movie, kind: 'movie' }))
  const tonightPick = selectTonightPick(homeQueue, user)
  function openTonightPick() {
    if (!tonightPick) actions.onOpenDiscover()
    else if (tonightPick.kind === 'tv') actions.onOpenTvShow(tonightPick)
    else actions.onOpenMovie(tonightPick)
  }

  return {
    data: { ...data, user, popularMoviesState, latestEpisodesState, homeWatchlistItems, nextUpItems, trendingMovies, tonightPick },
    actions: { ...actions, openTonightPick },
  }
}
