import { useEffect, useRef, useState } from 'react'

export interface MediaVideo {
  id: string
  provider: 'YouTube'
  key: string
  name: string
  type: string
  official: boolean
}

export function MediaVideosPanel({ mediaId, mediaType, onPlay }: { mediaId: number; mediaType: 'movie' | 'tv'; onPlay: (video: MediaVideo) => void }) {
  const [state, setState] = useState<{ status: 'loading' | 'success' | 'error'; videos: MediaVideo[] }>({ status: 'loading', videos: [] })
  const [attempt, setAttempt] = useState(0)
  const railRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ previous: false, next: false })
  const sectionId = `${mediaType}-videos`
  const mediaLabel = mediaType === 'movie' ? 'movie' : 'TV show'

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading', videos: [] })
    async function load() {
      try {
        const response = await fetch(`/api/${mediaType === 'movie' ? 'movies' : 'tv'}/${mediaId}/videos`, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok || !Array.isArray(payload.videos)) throw new Error('Unable to load videos')
        if (!controller.signal.aborted) setState({ status: 'success', videos: payload.videos })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error', videos: [] })
      }
    }
    void load()
    return () => controller.abort()
  }, [mediaId, mediaType, attempt])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    function updateScroll() {
      if (!rail) return
      setScroll({ previous: rail.scrollLeft > 1, next: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1 })
    }
    updateScroll()
    const observer = new ResizeObserver(updateScroll)
    observer.observe(rail)
    rail.addEventListener('scroll', updateScroll, { passive: true })
    return () => {
      observer.disconnect()
      rail.removeEventListener('scroll', updateScroll)
    }
  }, [state])

  function move(direction: number) {
    const rail = railRef.current
    if (rail) rail.scrollBy({ left: direction * rail.clientWidth * 0.85, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    <section id={sectionId} className={`content-section movie-detail-videos ${mediaType === 'movie' ? 'movie-detail-panel' : 'tv-detail-panel tv-detail-videos'}`} aria-labelledby={`${sectionId}-title`} aria-busy={state.status === 'loading'}>
      <div className="section-header">
        <h2 id={`${sectionId}-title`}>Trailers &amp; Videos</h2>
        {state.status === 'success' && state.videos.length > 0 ? (
          <div className="movie-video-controls">
            <button type="button" aria-label="Previous videos" aria-controls={`${sectionId}-rail`} disabled={!scroll.previous} onClick={() => move(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg></button>
            <button type="button" aria-label="Next videos" aria-controls={`${sectionId}-rail`} disabled={!scroll.next} onClick={() => move(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
          </div>
        ) : null}
      </div>
      {state.status === 'loading' ? <><p className="movie-video-message" role="status">Loading videos…</p><div className="movie-videos-rail" aria-hidden="true">{[0, 1, 2].map((key) => <div key={key} className="movie-video-skeleton" />)}</div></> : null}
      {state.status === 'error' ? <div className="movie-video-message" role="alert">Unable to load videos right now. <button type="button" className="secondary-button" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div> : null}
      {state.status === 'success' && !state.videos.length ? <p className="movie-video-message">No trailers or videos are available for this {mediaLabel} yet.</p> : null}
      {state.status === 'success' && state.videos.length > 0 ? (
        <div id={`${sectionId}-rail`} className="movie-videos-rail" ref={railRef}>
          {state.videos.map((video) => (
            <button key={video.key} type="button" className="movie-video-card" onClick={() => onPlay(video)} aria-label={`Play ${video.name} (${video.type})`}>
              <span className="movie-video-thumbnail">
                <img src={`https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/hqdefault.jpg`} alt="" loading="lazy" />
                <span className="movie-video-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 11 7-11 7Z" /></svg></span>
              </span>
              <strong>{video.name}</strong>
              <small>{video.type}{video.official ? ' · Official' : ''}</small>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
