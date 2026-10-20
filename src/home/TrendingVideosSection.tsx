import { TrendingVideosSection as VideoFeed, type TrendingVideo } from '../video/TrendingVideosSection.tsx'
import type { HomeActions, HomeUi, HomeViewData } from './homeTypes.ts'

export type { TrendingVideo } from '../video/TrendingVideosSection.tsx'

export function TrendingVideosSection({ data, actions, ui }: { data: HomeViewData; actions: HomeActions; ui: HomeUi }) {
  function renderAssociation(video: TrendingVideo) {
    const media = video.media
    if (!media) return null
    const listed = (media.kind === 'movie' ? data.watchlistMovieIds : data.tvWatchlistIds).has(Number(media.id))
    function openMedia() {
      if (!media) return
      if (media.kind === 'movie') actions.onOpenMovie({ ...media, kind: 'movie' })
      else actions.onOpenTvShow({ ...media, kind: 'tv' })
    }
    function toggleWatchlist() {
      if (!media) return
      if (media.kind === 'movie') actions.onToggleMovieWatchlist({ ...media, kind: 'movie' })
      else actions.onToggleTvWatchlist({ ...media, kind: 'tv' })
    }
    return <div className="trending-video-association"><button type="button" className="section-link" onClick={openMedia}>{media.title}</button><button type="button" className={`trending-video-watchlist${listed ? ' is-active' : ''}`} aria-label={`${listed ? 'Remove' : 'Add'} ${media.title} ${listed ? 'from' : 'to'} watchlist`} aria-pressed={listed} onClick={toggleWatchlist}><ui.BookmarkIcon /></button></div>
  }
  return <VideoFeed endpoint="/api/videos/trending" subtitle="Discover the hottest movie and TV videos on YouTube." label="Global movie & TV picks" rankingDescription="A custom ranking from multiple regional charts, official channels, searches, and TMDB. This is not an official global YouTube chart." ui={ui} renderAssociation={renderAssociation} />
}
