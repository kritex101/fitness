'use client'

import { Dumbbell, Play } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import type { ExerciseMediaResponse, ExerciseMediaSource } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

const validSources: ExerciseMediaSource[] = ['musclewiki', 'workoutx', 'exercisedb', 'ninjas']

async function fetchExerciseMedia(url: string): Promise<ExerciseMediaResponse> {
  const response = await fetch(url)
  const providerStatuses = response.headers.get('x-media-provider-statuses')
  if (providerStatuses) {
    try {
      const statuses = JSON.parse(providerStatuses) as Array<{ provider: string; stage: string; status: number | string }>
      console.log('[v0] Exercise media provider HTTP statuses:', statuses.map(({ provider, stage, status }) => `${provider} ${stage}: ${status}`).join(', '))
    } catch {
      console.log('[v0] Exercise media provider status header was invalid')
    }
  } else {
    console.log(`[v0] Exercise media proxy HTTP ${response.status}`)
  }

  const payload = await response.json().catch(() => null) as (ExerciseMediaResponse & { error?: string }) | null
  if (!response.ok) throw new Error(payload?.error ?? `Media request failed with HTTP ${response.status}.`)
  if (!payload || typeof payload.videoUrl !== 'string' || !validSources.includes(payload.source) || !['video', 'gif', 'image'].includes(payload.mediaType)) {
    throw new Error('Media response was incomplete.')
  }
  return payload
}

function MovementPreviewPlaceholder({ loading, onRetry }: { loading: boolean; onRetry?: () => void }) {
  return (
    <div className="exercise-media-frame exercise-media-frame-placeholder" role="status">
      <div className="exercise-media-placeholder-content">
        <div className="exercise-media-motion-stage" aria-hidden="true">
          <Dumbbell className="exercise-media-motion-icon" size={30} strokeWidth={1.8} />
        </div>
        <div className="exercise-media-placeholder-copy">
          <strong>{loading ? 'Finding a movement demo' : 'Movement preview'}</strong>
          <span>{loading ? 'Checking available exercise animations.' : 'Keep moving with the instructions and coaching cues above.'}</span>
        </div>
        {onRetry && !loading && <button className="exercise-media-retry" type="button" onClick={onRetry}>Check again</button>}
      </div>
    </div>
  )
}

export function ExerciseMediaGallery({ exerciseName, gender, autoLoad = false }: { exerciseName: string; gender: ExerciseVisualGender; autoLoad?: boolean }) {
  const [isOpen, setIsOpen] = useState(autoLoad)
  const [retryVersion, setRetryVersion] = useState(0)
  const [loadedMediaKey, setLoadedMediaKey] = useState('')
  const [failedMediaState, setFailedMediaState] = useState<{ mediaKey: string; sources: ExerciseMediaSource[] }>({ mediaKey: '', sources: [] })
  const mediaKey = `${exerciseName}:${gender}`
  const failedSources = failedMediaState.mediaKey === mediaKey ? failedMediaState.sources : []
  const params = new URLSearchParams({ name: exerciseName, gender })
  if (failedSources.length) params.set('exclude', failedSources.join(','))
  if (retryVersion > 0) params.set('attempt', String(retryVersion))
  const { data, isLoading } = useSWR<ExerciseMediaResponse, Error>(isOpen ? `/api/media?${params.toString()}` : null, fetchExerciseMedia, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })
  const media = data && !failedSources.includes(data.source) ? data : null
  const mediaRenderKey = media ? `${mediaKey}:${media.source}:${media.videoUrl}` : ''
  const isImage = media ? media.mediaType === 'image' || media.source === 'ninjas' : false
  const isGif = media ? media.mediaType === 'gif' || media.source === 'exercisedb' || /\.gif(?:$|[?#])/i.test(media.videoUrl) : false

  const failSource = useCallback((source: ExerciseMediaSource) => {
    setLoadedMediaKey('')
    setFailedMediaState((current) => {
      const sources = current.mediaKey === mediaKey ? current.sources : []
      if (sources.includes(source)) return current
      return { mediaKey, sources: [...sources, source] }
    })
  }, [mediaKey])

  useEffect(() => {
    if (!media || loadedMediaKey === mediaRenderKey) return
    const timeout = window.setTimeout(() => failSource(media.source), 12_000)
    return () => window.clearTimeout(timeout)
  }, [failSource, loadedMediaKey, media, mediaRenderKey])

  const markMediaLoaded = useCallback(() => {
    if (mediaRenderKey) setLoadedMediaKey(mediaRenderKey)
  }, [mediaRenderKey])

  const retryMedia = useCallback(() => {
    setFailedMediaState({ mediaKey, sources: [] })
    setLoadedMediaKey('')
    setRetryVersion((version) => version + 1)
  }, [mediaKey])

  if (!isOpen) {
    return <button type="button" className="exercise-media-load" onClick={() => setIsOpen(true)}><Play size={14} aria-hidden="true" /> Load {gender}-model guides</button>
  }

  if (!media) {
    return (
      <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}>
        <MovementPreviewPlaceholder loading={isLoading} onRetry={!isLoading ? retryMedia : undefined} />
      </div>
    )
  }

  return (
    <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}>
      <div className="exercise-media-list">
        <figure className="exercise-media-card">
          <div className="exercise-media-frame">
            {isImage && media.imageUrls && media.imageUrls.length > 1 ? (
              <div className="exercise-media-image-sequence">
                {media.imageUrls.map((imageUrl, index) => (
                  <img
                    key={imageUrl}
                    className="exercise-media-player"
                    src={imageUrl}
                    alt={`${exerciseName} demonstration frame ${index + 1}`}
                    loading="eager"
                    onLoad={markMediaLoaded}
                    onError={() => failSource(media.source)}
                  />
                ))}
              </div>
            ) : isImage || isGif ? (
              <img
                className="exercise-media-player"
                src={media.videoUrl}
                alt={isGif ? `${exerciseName} animated exercise demonstration` : `${exerciseName} exercise reference image`}
                loading="eager"
                onLoad={markMediaLoaded}
                onError={() => failSource(media.source)}
              />
            ) : (
              <video
                className="exercise-media-player"
                src={media.videoUrl}
                controls
                playsInline
                preload="auto"
                loop
                muted
                autoPlay
                onLoadedData={markMediaLoaded}
                onCanPlay={markMediaLoaded}
                onError={() => failSource(media.source)}
                aria-label={`${exerciseName} looping muted video demonstration`}
              >
                Your browser does not support embedded video.
              </video>
            )}
          </div>
          <figcaption className="exercise-media-caption">
            <strong>{media.source === 'exercisedb' ? 'ExerciseDB' : media.source === 'musclewiki' ? 'MuscleWiki' : media.source === 'ninjas' ? 'API Ninjas' : 'WorkoutX'}</strong>
            <span>{isImage ? 'Movement reference frames (not animated)' : isGif ? 'Animated GIF' : 'Looping video demonstration'}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
