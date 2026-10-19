import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Player = { destroy: () => void }
type YoutubeApi = { Player: new (element: HTMLElement, options: object) => Player }
const youtubeWindow = () => window as unknown as { YT?: YoutubeApi }
let apiPromise: Promise<YoutubeApi> | undefined

function loadPlayerApi(): Promise<YoutubeApi> {
  if (youtubeWindow().YT?.Player) return Promise.resolve(youtubeWindow().YT!)
  if (apiPromise) return apiPromise
  apiPromise = new Promise<YoutubeApi>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.append(script)
    }
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (youtubeWindow().YT?.Player) { clearInterval(timer); resolve(youtubeWindow().YT!) }
      else if (Date.now() - started > 15000) { clearInterval(timer); reject(new Error('YouTube player unavailable')) }
    }, 100)
  }).catch((error: unknown) => { apiPromise = undefined; throw error })
  return apiPromise
}

export function VideoPlayerDialog({ videoId, title, embeddable = true, onClose }: {
  videoId: string; title: string; embeddable?: boolean; onClose: () => void
}) {
  const dialog = useRef<HTMLElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const [unavailable, setUnavailable] = useState(!embeddable)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); close.current() }
      if (event.key !== 'Tab') return
      const elements = dialog.current?.querySelectorAll<HTMLElement>('button, a[href], iframe')
      if (!elements?.length) return
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    let disposed = false, player: Player | undefined
    setUnavailable(!embeddable)
    setReady(false)
    if (!embeddable) return
    const timeout = window.setTimeout(() => { if (!disposed) setUnavailable(true) }, 20000)
    void loadPlayerApi().then((api) => {
      if (disposed || !host.current) return
      const target = document.createElement('div')
      host.current.replaceChildren(target)
      player = new api.Player(target, {
        host: 'https://www.youtube-nocookie.com', videoId,
        playerVars: { autoplay: 1, origin: window.location.origin, playsinline: 1 },
        events: {
          onReady: () => {
            if (disposed) return
            clearTimeout(timeout); setReady(true); setUnavailable(false)
            const frame = host.current?.querySelector('iframe')
            if (frame) { frame.title = title; frame.referrerPolicy = 'strict-origin-when-cross-origin' }
          },
          onError: () => { if (!disposed) { clearTimeout(timeout); setUnavailable(true) } },
        },
      })
    }).catch(() => { if (!disposed) { clearTimeout(timeout); setUnavailable(true) } })
    return () => { disposed = true; clearTimeout(timeout); player?.destroy() }
  }, [videoId, embeddable, title])

  return createPortal(<div className="movie-trailer-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="movie-trailer-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="video-player-title">
      <div className="movie-trailer-dialog-header">
        <div><p className="movie-rating-dialog-kicker">YouTube</p><h2 id="video-player-title">{title}</h2></div>
        <button type="button" className="movie-trailer-close" onClick={onClose} aria-label="Close video">×</button>
      </div>
      {unavailable ? <p className="video-player-message" role="status">This video cannot be played here. It may be unavailable or restricted to YouTube.</p> : !ready ? <p className="video-player-message" role="status">Loading YouTube player…</p> : null}
      <div className="video-player-host" ref={host} hidden={unavailable} />
      <p className="video-player-message"><a className="section-link" href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`} target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></p>
    </section>
  </div>, document.body)
}
