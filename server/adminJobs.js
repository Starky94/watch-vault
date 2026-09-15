import { importNowPlayingMovies, importPopularMovies, importUpcomingMovies } from './movieImportService.js'
import { importAiringTodayTvShows, importOnTheAirTvShows, importPopularTvShows } from './tvImportService.js'
import { importBooks } from './bookImportService.js'
import { importPopularGames, importRecentlyReleasedGames, importUpcomingGames } from './gameImportService.js'
import { runThemeScheduler } from './themeScheduler.js'
import { importEntertainmentNews } from './newsImportService.js'
import { runNewsCleanup } from './newsCleanupService.js'

export const adminJobs = [
  { key: 'theme-scheduler', name: 'Seasonal Theme Scheduler', execution: 'Daily scheduler worker', frequency: 'Daily at 00:05', source: 'theme-scheduler', run: runThemeScheduler },
  { key: 'books', name: 'Books Import', execution: 'Interval-based loop', frequency: 'Every hour', source: 'google-books', run: importBooks },
  { key: 'entertainment-news', name: 'Entertainment News Import', execution: 'Interval-based loop', frequency: 'Every hour', source: 'rss', run: importEntertainmentNews },
  { key: 'news-cleanup', name: 'News Retention Cleanup', execution: 'Daily scheduler worker', frequency: 'Daily at 00:10', source: 'news-cleanup', run: runNewsCleanup },
  { key: 'games-popular', name: 'Popular Games Import', execution: 'Interval-based loop', frequency: 'Every 24 hours', source: 'igdb', run: importPopularGames },
  { key: 'games-recently-released', name: 'Recently Released Games Import', execution: 'Interval-based loop', frequency: 'Every 24 hours', source: 'igdb', run: importRecentlyReleasedGames },
  { key: 'games-upcoming', name: 'Upcoming Games Import', execution: 'Interval-based loop', frequency: 'Every 24 hours', source: 'igdb', run: importUpcomingGames },
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

export function listAdminJobs(jobs = adminJobs, lastExecutions = new Map()) {
  return jobs.map(({ key, name, execution, frequency }) => ({
    key,
    name,
    execution,
    frequency,
    lastExecutedAt: lastExecutions.get(key) ?? null,
  }))
}

export function findAdminJob(jobKey, jobs = adminJobs) {
  return jobs.find((job) => job.key === jobKey) ?? null
}
