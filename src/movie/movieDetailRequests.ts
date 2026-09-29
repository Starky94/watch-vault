import { mapMovieDetailPayload, mapMoviePreviewToDetail } from './movieMappers.ts'
import { mapPersonCoStar, mapPersonDetailPayload, mapPersonFilmographyRow, mapPersonHistoryPayload, mapPersonMovieCredit, mapPersonPreview } from '../personMappers.ts'
import type { MediaDetailRoute, MovieDetailApi, MovieDetailState, MoviePreview, PersonCoStar, PersonCreditApi, PersonDetailApi, PersonDetailState, PersonFact, PersonFilmographyCreditApi } from './movieTypes.ts'

export function createMovieDetailState(route: MediaDetailRoute | { kind: string }): MovieDetailState {
  return { status: route.kind === 'movieDetail' ? 'idle' : 'hidden', movie: null, error: '' }
}

export function createPersonDetailState(route: MediaDetailRoute | { kind: string }): PersonDetailState {
  return { status: route.kind === 'personDetail' ? 'idle' : 'hidden', person: null, knownFor: [], filmography: [], coStars: [], facts: [], personalHistory: null, error: '' }
}

export function loadingPersonDetailState(previous: PersonDetailState): PersonDetailState {
  return { ...previous, status: 'loading', error: '' }
}

interface ApiError { error?: string }
interface MovieResponse extends ApiError { movie?: MovieDetailApi }
interface PersonResponse extends ApiError {
  person?: PersonDetailApi
  knownFor?: PersonCreditApi[]
  filmography?: PersonFilmographyCreditApi[]
  coStars?: Array<PersonCoStar & { sharedTitles?: string[] }>
  facts?: PersonFact[]
  personalHistory?: Parameters<typeof mapPersonHistoryPayload>[0]
}

export async function loadMovieDetailData(movieId: number, preview: MoviePreview | null, fetchRequest: typeof fetch = fetch): Promise<MovieDetailState> {
  try {
    const response = await fetchRequest(`/api/movies/${movieId}`)
    const payload = await response.json().catch(() => ({})) as MovieResponse
    if (!response.ok) {
      if (response.status === 404 && preview) return { status: 'success', movie: mapMoviePreviewToDetail(preview), error: '' }
      throw new Error(payload.error || `Request failed with status ${response.status}`)
    }
    if (typeof payload.movie?.id !== 'number' || typeof payload.movie.title !== 'string') throw new Error('Movie detail response was missing a movie')
    return { status: 'success', movie: mapMovieDetailPayload(payload.movie), error: '' }
  } catch (error) {
    return { status: 'error', movie: null, error: error instanceof Error ? error.message : 'Unable to load the movie detail right now.' }
  }
}

export async function loadPersonDetailData(personId: number, preview: { id: number; name: string; role?: string | null; profileUrl?: string | null } | null, fetchRequest: typeof fetch = fetch): Promise<PersonDetailState> {
  try {
    const response = await fetchRequest(`/api/people/${personId}`)
    const payload = await response.json().catch(() => ({})) as PersonResponse
    if (!response.ok) {
      if (preview) return { status: 'success', person: mapPersonPreview(preview), knownFor: [], filmography: [], coStars: [], facts: [], personalHistory: null, error: '' }
      throw new Error(payload.error || `Request failed with status ${response.status}`)
    }
    if (typeof payload.person?.id !== 'number' || typeof payload.person.name !== 'string') throw new Error('Person detail response was missing a person')
    return {
      status: 'success',
      person: mapPersonDetailPayload(payload.person),
      knownFor: Array.isArray(payload.knownFor) ? payload.knownFor.map(mapPersonMovieCredit) : [],
      filmography: Array.isArray(payload.filmography) ? payload.filmography.map(mapPersonFilmographyRow) : [],
      coStars: Array.isArray(payload.coStars) ? payload.coStars.map(mapPersonCoStar) : [],
      facts: Array.isArray(payload.facts) ? payload.facts : [],
      personalHistory: mapPersonHistoryPayload(payload.personalHistory),
      error: '',
    }
  } catch (error) {
    return { status: 'error', person: null, knownFor: [], filmography: [], coStars: [], facts: [], personalHistory: null, error: error instanceof Error ? error.message : 'Unable to load the person detail right now.' }
  }
}
