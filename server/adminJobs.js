import { importNowPlayingMovies, importPopularMovies, importUpcomingMovies } from './movieImportService.js'
import { importAiringTodayTvShows, importOnTheAirTvShows, importPopularTvShows } from './tvImportService.js'

export const adminJobs = [
  {
    key: 'popular',
    name: 'Popular Movies Import',
    execution: 'Interval-based loop',
    frequency: 'Every 10 minutes',
    run: importPopularMovies,
  },
  {
    key: 'now-playing',
    name: 'Now Playing Import',
    execution: 'Interval-based loop',
    frequency: 'Every 24 hours',
    run: importNowPlayingMovies,
  },
  {
    key: 'upcoming',
    name: 'Upcoming Import',
    execution: 'Interval-based loop',
    frequency: 'Every 24 hours',
    run: importUpcomingMovies,
  },
  {
    key: 'tv-popular',
    name: 'Popular TV Shows Import',
    execution: 'Interval-based loop',
    frequency: 'Every 10 minutes',
    run: importPopularTvShows,
  },
  {
    key: 'tv-airing-today',
    name: 'TV Airing Today Import',
    execution: 'Interval-based loop',
    frequency: 'Every 24 hours',
    run: importAiringTodayTvShows,
  },
  {
    key: 'tv-on-the-air',
    name: 'TV On The Air Import',
    execution: 'Interval-based loop',
    frequency: 'Every 24 hours',
    run: importOnTheAirTvShows,
  },
]

export function listAdminJobs(jobs = adminJobs) {
  return jobs.map(({ key, name, execution, frequency }) => ({
    key,
    name,
    execution,
    frequency,
  }))
}

export function findAdminJob(jobKey, jobs = adminJobs) {
  return jobs.find((job) => job.key === jobKey) ?? null
}
