import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { VideoPlayerDialog } from '../movie/VideoPlayerDialog.tsx'
import type { HomeUi } from '../home/homeTypes.ts'
import './TrendingVideos.css'

export interface TrendingVideo {
  id: string; title: string; thumbnail: string; category: string; channel: string
  views: number | null; publishedAt: string; embeddable: boolean; badge: string | null
  media: { id: number; kind: 'movie' | 'tv'; title: string } | null
}
type Feed = { videos: TrendingVideo[]; updatedAt: string | null; stale: boolean; total: number }

function publicationAge(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000))
  if (!Number.isFinite(minutes)) return 'Publication date unavailable'
  if (minutes < 1) return 'Just now'
  const amount = minutes < 60 ? minutes : minutes < 1440 ? Math.floor(minutes / 60) : Math.floor(minutes / 1440)
  const unit = minutes < 60 ? 'minute' : minutes < 1440 ? 'hour' : 'day'
  return `${amount} ${unit}${amount === 1 ? '' : 's'} ago`
}

export function TrendingVideosSection({ endpoint, subtitle, label, rankingDescription, ui, renderAssociation }: {
  endpoint: string; subtitle: string; label: string; rankingDescription: string
  ui: Pick<HomeUi, 'ContentSection' | 'SectionMessage'>
  renderAssociation?: (video: TrendingVideo) => ReactNode
}) {
  const railId = useId()
  const [feed, setFeed] = useState<Feed>({ videos: [], updatedAt: null, stale: false, total: 0 })
  const [status, setStatus] = useState('loading')
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState<TrendingVideo | null>(null)
  const [scroll, setScroll] = useState({ previous: false, next: false })
  const railRef = useRef<HTMLDivElement>(null)
  const { ContentSection, SectionMessage } = ui
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    void (async () => {
      try {
        const response = await fetch(`${endpoint}?limit=${expanded ? 60 : 12}`, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok || !Array.isArray(payload.videos)) throw new Error('Unable to load videos')
        if (!controller.signal.aborted) { setFeed(payload); setStatus('success') }
      } catch { if (!controller.signal.aborted) setStatus('error') }
    })()
    return () => controller.abort()
  }, [attempt, expanded, endpoint])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const update = () => setScroll({ previous: rail.scrollLeft > 1, next: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1 })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(rail)
    rail.addEventListener('scroll', update, { passive: true })
    return () => { observer.disconnect(); rail.removeEventListener('scroll', update) }
  }, [feed, expanded, status])

  function move(direction: number) {
    const rail = railRef.current
    if (rail) rail.scrollBy({ left: direction * rail.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
  return <ContentSection title="Trending Videos" action={expanded ? 'Show less' : 'See all'} onAction={() => setExpanded((value) => !value)} compact className="home-tertiary-section trending-videos-section">
    <p className="trending-videos-subtitle">{subtitle}</p>
    <div className="trending-videos-toolbar">
      <small title={rankingDescription}>{label}{feed.stale && feed.videos.length ? ' · Refresh delayed' : ''}</small>
      {!expanded && feed.videos.length > 0 ? <div className="movie-video-controls">
        <button type="button" aria-label="Previous trending videos" aria-controls={railId} disabled={!scroll.previous} onClick={() => move(-1)}>‹</button>
        <button type="button" aria-label="Next trending videos" aria-controls={railId} disabled={!scroll.next} onClick={() => move(1)}>›</button>
      </div> : null}
    </div>
    {status === 'loading' ? <><SectionMessage message="Loading trending videos…" /><div className="trending-videos-rail" aria-hidden="true">{[0, 1, 2, 3].map((key) => <div key={key} className="trending-video-skeleton" />)}</div></> : null}
    {status === 'error' ? <div role="alert" className="movie-video-message">Unable to load trending videos. <button type="button" className="section-link" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div> : null}
    {status === 'success' && !feed.videos.length ? <SectionMessage message="Trending videos aren’t available yet. Check back soon." /> : null}
    {status === 'success' && feed.videos.length > 0 ? <div id={railId} className={expanded ? 'trending-videos-grid' : 'trending-videos-rail'} ref={railRef} aria-label="Trending videos">
      {feed.videos.map((video) => {
        return <article key={video.id} className="trending-video-card">
          <button type="button" className="trending-video-play" onClick={() => setPlaying(video)} aria-label={`Play ${video.title}`}>
            <span className="movie-video-thumbnail"><img src={video.thumbnail} alt="" loading="lazy" /><span className="movie-video-play" aria-hidden="true">▶</span>{video.badge ? <span className="trending-video-badge">{video.badge}</span> : null}</span>
            <strong>{video.title}</strong>
          </button>
          <div className="trending-video-category">{video.category}</div>
          {renderAssociation?.(video)}
          <p className="trending-video-channel">{video.channel}</p>
          <p className="trending-video-stats">{video.views != null ? `${compact.format(video.views)} views · ` : ''}<time dateTime={video.publishedAt} title={new Date(video.publishedAt).toLocaleString()}>{publicationAge(video.publishedAt)}</time></p>
        </article>
      })}
    </div> : null}
    {playing ? <VideoPlayerDialog key={playing.id} videoId={playing.id} title={playing.title} embeddable={playing.embeddable} onClose={() => setPlaying(null)} /> : null}
  </ContentSection>
}
