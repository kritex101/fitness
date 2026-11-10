'use client'

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { LoaderCircle, Maximize2, Minimize2, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'

type CaptionsTrack = {
  src: string
  language: string
  label: string
}

type InlineVideoPlayerProps = {
  src: string
  title: string
  description?: string
  poster?: string
  captions?: CaptionsTrack
  loop?: boolean
  className?: string
  onRetry?: () => void
}

function formatMediaTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export function InlineVideoPlayer({
  src,
  title,
  description,
  poster,
  captions,
  loop = false,
  className = '',
  onRetry,
}: InlineVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLElement>(null)
  const openButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const captionsTrackRef = useRef<HTMLTrackElement>(null)
  const userPausedRef = useRef(false)
  const isInViewRef = useRef(false)
  const wasExpandedRef = useRef(false)
  const refreshAttemptedRef = useRef(false)
  const titleId = useId()
  const descriptionId = useId()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  const [controlMessage, setControlMessage] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const attemptPlayback = useCallback((media: HTMLVideoElement) => {
    void media.play()
      .then(() => setAutoplayBlocked(false))
      .catch(() => setAutoplayBlocked(true))
  }, [])

  const closeExpanded = useCallback(() => setIsExpanded(false), [])

  useEffect(() => {
    const media = videoRef.current
    const frame = frameRef.current
    if (!media) return

    const updateVisibility = (visible: boolean) => {
      isInViewRef.current = visible
      if (visible && document.visibilityState === 'visible' && !userPausedRef.current) {
        media.muted = true
        setIsMuted(true)
        attemptPlayback(media)
      } else if (!visible || document.visibilityState === 'hidden') {
        media.pause()
      }
    }

    const onDocumentVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        media.pause()
      } else if (!userPausedRef.current && (isExpanded || isInViewRef.current)) {
        if (!isExpanded) {
          media.muted = true
          setIsMuted(true)
        }
        attemptPlayback(media)
      }
    }

    document.addEventListener('visibilitychange', onDocumentVisibilityChange)
    if (isExpanded || !frame) return () => document.removeEventListener('visibilitychange', onDocumentVisibilityChange)

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        updateVisibility(entry.isIntersecting && entry.intersectionRatio >= 0.55)
      }, { threshold: [0, 0.55, 1] })
      observer.observe(frame)

      return () => {
        observer.disconnect()
        document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
      }
    }

    updateVisibility(true)
    return () => document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
  }, [attemptPlayback, isExpanded, src])

  useEffect(() => {
    if (!isExpanded) {
      if (wasExpandedRef.current) openButtonRef.current?.focus()
      wasExpandedRef.current = false
      return
    }

    wasExpandedRef.current = true
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isExpanded])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === cardRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const textTrack = captionsTrackRef.current?.track
    if (textTrack) textTrack.mode = captionsEnabled ? 'showing' : 'hidden'
  }, [captionsEnabled, captions])

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && isExpanded) {
      event.preventDefault()
      closeExpanded()
      return
    }

    if (!isExpanded || event.key !== 'Tab') return
    const focusableElements = cardRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"]):not([hidden])',
    )
    if (!focusableElements?.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  function togglePlayback() {
    const media = videoRef.current
    if (!media) return
    if (media.paused) {
      userPausedRef.current = false
      setControlMessage('')
      attemptPlayback(media)
    } else {
      userPausedRef.current = true
      media.pause()
    }
  }

  function replayVideo() {
    const media = videoRef.current
    if (!media) return
    userPausedRef.current = false
    setCurrentTime(0)
    setControlMessage('')
    media.currentTime = 0
    attemptPlayback(media)
  }

  function toggleMute() {
    const media = videoRef.current
    if (!media) return
    const nextMuted = !media.muted
    media.muted = nextMuted
    if (!nextMuted && media.volume === 0) {
      media.volume = 0.6
      setVolume(0.6)
    }
    setIsMuted(nextMuted)
  }

  function changeVolume(nextVolume: number) {
    const media = videoRef.current
    if (!media) return
    media.volume = nextVolume
    media.muted = nextVolume === 0
    setVolume(nextVolume)
    setIsMuted(nextVolume === 0)
  }

  function seekTo(nextTime: number) {
    const media = videoRef.current
    if (!media || !Number.isFinite(nextTime)) return
    media.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  function changePlaybackRate(nextRate: number) {
    const media = videoRef.current
    if (!media) return
    media.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }

  async function toggleFullscreen() {
    const player = cardRef.current
    if (!player) return
    setControlMessage('')
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await player.requestFullscreen()
    } catch {
      setControlMessage('Fullscreen is unavailable in this browser.')
    }
  }

  const progressValue = duration ? Math.min(currentTime, duration) : 0
  const playerClassName = ['inline-video-player', isExpanded && 'inline-video-expanded', className].filter(Boolean).join(' ')

  return (
    <div
      className={playerClassName}
      role={isExpanded ? 'dialog' : undefined}
      aria-modal={isExpanded ? true : undefined}
      aria-labelledby={isExpanded ? titleId : undefined}
      aria-describedby={isExpanded && description ? descriptionId : undefined}
      tabIndex={isExpanded ? -1 : undefined}
      onKeyDown={handleDialogKeyDown}
      onClick={(event) => {
        if (isExpanded && event.target === event.currentTarget) closeExpanded()
      }}
    >
      <article className="inline-video-card" ref={cardRef}>
        <header className="inline-video-heading">
          <div>
            <h2 id={titleId} className="inline-video-title">{title}</h2>
            {description && <p id={descriptionId} className="inline-video-description">{description}</p>}
          </div>
          {isExpanded && (
            <button ref={closeButtonRef} className="inline-video-icon-button" type="button" onClick={closeExpanded} aria-label="Close video player">
              <X size={19} aria-hidden="true" />
            </button>
          )}
        </header>

        <div className="inline-video-stage" ref={frameRef}>
          <video
            ref={videoRef}
            className="inline-video-media"
            src={src}
            poster={poster}
            muted={isMuted}
            playsInline
            preload="metadata"
            loop={loop}
            controls={false}
            aria-label={title}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadStart={() => {
              setIsLoading(true)
              setMediaError(false)
            }}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
              setMediaError(false)
            }}
            onLoadedData={() => setIsLoading(false)}
            onCanPlay={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setMediaError(true)
              if (onRetry && !refreshAttemptedRef.current) {
                refreshAttemptedRef.current = true
                window.setTimeout(onRetry, 0)
              }
            }}
          >
            {captions && <track ref={captionsTrackRef} kind="captions" src={captions.src} srcLang={captions.language} label={captions.label} />}
          </video>

          {isLoading && <div className="inline-video-loading" role="status"><LoaderCircle size={18} aria-hidden="true" /><span>Loading video…</span></div>}

          <button
            ref={openButtonRef}
            className="inline-video-open"
            type="button"
            hidden={isExpanded}
            onClick={() => setIsExpanded(true)}
            aria-label={`Open ${title} in video player`}
          >
            <span className="inline-video-open-chip"><Maximize2 size={17} aria-hidden="true" />Open video</span>
          </button>
        </div>

        {isExpanded ? (
          <div className="inline-video-controls" role="group" aria-label="Video playback controls">
            <div className="inline-video-seek-row">
              <span className="inline-video-time" aria-label="Current time">{formatMediaTime(currentTime)}</span>
              <input
                className="inline-video-seek"
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={progressValue}
                disabled={!duration}
                onChange={(event) => seekTo(Number(event.target.value))}
                aria-label="Seek video"
                aria-valuetext={`${formatMediaTime(currentTime)} of ${formatMediaTime(duration)}`}
              />
              <span className="inline-video-time" aria-label="Video duration">{formatMediaTime(duration)}</span>
            </div>

            <div className="inline-video-control-row">
              <div className="inline-video-control-group">
                <button className="inline-video-icon-button" type="button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause video' : 'Play video'}>
                  {isPlaying ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}
                </button>
                <button className="inline-video-icon-button" type="button" onClick={replayVideo} aria-label="Replay video" disabled={!duration}>
                  <RotateCcw size={19} aria-hidden="true" />
                </button>
                <button className="inline-video-icon-button" type="button" onClick={toggleMute} aria-label={isMuted ? 'Unmute video' : 'Mute video'} aria-pressed={isMuted}>
                  {isMuted || volume === 0 ? <VolumeX size={19} aria-hidden="true" /> : <Volume2 size={19} aria-hidden="true" />}
                </button>
                <input
                  className="inline-video-volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                  aria-label="Video volume"
                />
              </div>

              <div className="inline-video-control-group">
                {captions && <button className="inline-video-caption-button" type="button" onClick={() => setCaptionsEnabled((enabled) => !enabled)} aria-pressed={captionsEnabled} aria-label={captionsEnabled ? 'Hide captions' : 'Show captions'}>CC</button>}
                <label className="sr-only" htmlFor={`${titleId}-speed`}>Playback speed</label>
                <select
                  id={`${titleId}-speed`}
                  className="inline-video-speed"
                  value={playbackRate}
                  onChange={(event) => changePlaybackRate(Number(event.target.value))}
                  aria-label="Playback speed"
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
                </select>
                <button className="inline-video-icon-button" type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                  {isFullscreen ? <Minimize2 size={19} aria-hidden="true" /> : <Maximize2 size={19} aria-hidden="true" />}
                </button>
              </div>
            </div>
            {(controlMessage || mediaError) && (
              <div className="inline-video-status" role={mediaError || controlMessage ? 'alert' : 'status'}>
                <span>{controlMessage || (mediaError ? 'This video could not be loaded. Refresh the media link and try again.' : 'Autoplay was blocked. Press Play to start the video.')}</span>
                {mediaError && onRetry && <button type="button" onClick={onRetry}>Refresh video</button>}
              </div>
            )}
          </div>
        ) : (
          (mediaError || autoplayBlocked) && (
            <div className="inline-video-status" role={mediaError ? 'alert' : 'status'}>
              <span>{mediaError ? 'This video could not be loaded. Refresh the media link and try again.' : 'Muted autoplay is unavailable. Open the player and press Play to start the video.'}</span>
              {mediaError && onRetry && <button type="button" onClick={onRetry}>Refresh video</button>}
            </div>
          )
        )}
      </article>
    </div>
  )
}
