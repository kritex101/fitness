'use client'

import { LoaderCircle, Play } from 'lucide-react'
import { useState } from 'react'
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
  if (!response.ok) throw new Error(payload?.error ?? 'Exercise media could not be loaded.')
  if (!payload || typeof payload.videoUrl !== 'string' || !validSources.includes(payload.source) || !['video', 'gif', 'image'].includes(payload.mediaType)) {
    throw new Error('Exercise media returned an invalid response.')
  }
  return payload
}

function MediaStatusFrame({ message, role = 'status', loading = false, onRetry }: { message: string; role?: 'status' | 'alert'; loading?: boolean; onRetry?: () => void }) {
  return (
    <div className="exercise-media-frame exercise-media-frame-placeholder">
      <div className="exercise-media-placeholder-content">
        <p className="exercise-media-status" role={role}>
          {loading && <LoaderCircle className="exercise-media-spinner" size={18} aria-hidden="true" />}
          {message}
        </p>
        {onRetry && <button className="exercise-media-retry" type="button" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  )
}

export function ExerciseMediaGallery({ exerciseName, gender, autoLoad = false }: { exerciseName: string; gender: ExerciseVisualGender; autoLoad?: boolean }) {
  const [isOpen, setIsOpen] = useState(autoLoad)
  const [failedMediaKey, setFailedMediaKey] = useState('')
  const mediaKey = `${exerciseName}:${gender}`
  const params = new URLSearchParams({ name: exerciseName, gender })
  const { data, error, isLoading, mutate } = useSWR<ExerciseMediaResponse, Error>(isOpen ? `/api/media?${params.toString()}` : null, fetchExerciseMedia, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })
  const mediaFailed = failedMediaKey === mediaKey
  const isImage = data ? data.mediaType === 'image' || data.source === 'ninjas' : false
  const isGif = data ? data.mediaType === 'gif' || data.source === 'exercisedb' || /\.gif(?:$|[?#])/i.test(data.videoUrl) : false

  function retryMedia() {
    setFailedMediaKey('')
    void mutate()
  }

  if (!isOpen) {
    return <button type="button" className="exercise-media-load" onClick={() => setIsOpen(true)}><Play size={14} aria-hidden="true" /> Load {gender}-model guides</button>
  }

  if (isLoading && !data) {
    return <div className="exercise-media-gallery" aria-busy="true"><MediaStatusFrame loading message={`Loading ${gender}-model video and animation…`} /></div>
  }

  if (error && !data) {
    return <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}><MediaStatusFrame role="alert" message={`Exercise media could not be loaded. Follow the exercise instructions and target muscle badge above. ${error.message}`} onRetry={retryMedia} /></div>
  }

  if (!data) {
    return <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}><MediaStatusFrame message="No video or animation is available for this movement. Follow the exercise instructions and target muscle badge above." /></div>
  }

  if (mediaFailed) {
    return <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}><MediaStatusFrame role="alert" message="This media could not be played. Follow the exercise instructions and target muscle badge above." onRetry={retryMedia} /></div>
  }

  return (
    <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}>
      <div className="exercise-media-list">
        <figure className="exercise-media-card">
          <div className="exercise-media-frame">
            {isImage && data.imageUrls && data.imageUrls.length > 1 ? (
              <div className="exercise-media-image-sequence">
                {data.imageUrls.map((imageUrl, index) => (
                  <img
                    key={imageUrl}
                    className="exercise-media-player"
                    src={imageUrl}
                    alt={`${exerciseName} demonstration frame ${index + 1}`}
                    loading="eager"
                    onError={() => setFailedMediaKey(mediaKey)}
                  />
                ))}
              </div>
            ) : isImage || isGif ? (
              <img
                className="exercise-media-player"
                src={data.videoUrl}
                alt={isGif ? `${exerciseName} animated exercise demonstration` : `${exerciseName} exercise reference image`}
                loading="eager"
                onError={() => setFailedMediaKey(mediaKey)}
              />
            ) : (
              <video
                className="exercise-media-player"
                src={data.videoUrl}
                controls
                playsInline
                preload="auto"
                loop
                muted
                autoPlay
                onError={() => setFailedMediaKey(mediaKey)}
                aria-label={`${exerciseName} looping muted video demonstration`}
              >
                Your browser does not support embedded video.
              </video>
            )}
          </div>
          <figcaption className="exercise-media-caption">
            <strong>{data.source === 'exercisedb' ? 'ExerciseDB' : data.source === 'musclewiki' ? 'MuscleWiki' : data.source === 'ninjas' ? 'API Ninjas' : 'WorkoutX'}</strong>
            <span>{isImage ? 'Movement reference frames (not animated)' : isGif ? 'Animated GIF' : 'Looping video demonstration'}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
