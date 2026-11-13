'use client'

import { Dumbbell, Image as ImageIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import useSWR from 'swr'
import type { ExerciseMediaResponse } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

const localExerciseImages: Record<string, string> = {
  'bicep curl': '/exercises/bicep-curl.png',
  'dumbbell row': '/exercises/dumbbell-row.png',
  'glute bridge': '/exercises/glute-bridge.png',
  'goblet squat': '/exercises/goblet-squat.png',
  'incline push up': '/exercises/incline-push-up.png',
  'lat pulldown': '/exercises/lat-pulldown.png',
  'leg press': '/exercises/leg-press.png',
  'plank': '/exercises/plank.png',
  'romanian deadlift': '/exercises/romanian-deadlift.png',
  'shoulder press': '/exercises/shoulder-press.png',
  'supported dumbbell row': '/exercises/dumbbell-row.png',
  'dumbbell romanian deadlift': '/exercises/romanian-deadlift.png',
  'seated dumbbell shoulder press': '/exercises/shoulder-press.png',
  'dumbbell biceps curl': '/exercises/bicep-curl.png',
}

function getLocalImage(name: string) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return localExerciseImages[normalized]
}

async function fetchExerciseMedia(url: string): Promise<ExerciseMediaResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json().catch(() => null) as (ExerciseMediaResponse & { error?: string }) | null

  if (!response.ok) {
    throw new Error(payload?.error ?? `WorkoutX photo request failed with HTTP ${response.status}.`)
  }

  if (!payload || typeof payload.imageUrl !== 'string' || payload.source !== 'workoutx' || payload.mediaType !== 'image') {
    throw new Error('WorkoutX returned an incomplete photo response.')
  }

  return payload
}

function MovementPreviewPlaceholder({
  loading,
  error,
  onRetry,
}: {
  loading: boolean
  error?: string
  onRetry?: () => void
}) {
  return (
    <div className="exercise-media-frame exercise-media-frame-placeholder" role={error ? 'alert' : 'status'}>
      <div className="exercise-media-placeholder-content">
        <div className="exercise-media-motion-stage" aria-hidden="true">
          <Dumbbell className="exercise-media-motion-icon" size={30} strokeWidth={1.8} />
        </div>
        <div className="exercise-media-placeholder-copy">
          <strong>{loading ? 'Loading exercise photo' : 'Exercise photo unavailable'}</strong>
          <span>{loading ? 'Please wait while we load the image.' : error ?? 'No image is available for this exercise yet.'}</span>
        </div>
        {onRetry && !loading && (
          <button className="exercise-media-retry" type="button" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

function ExerciseInstructions({
  instructions,
  title = 'Instructions',
}: {
  instructions: string[]
  title?: string
}) {
  if (!instructions.length) return null

  return (
    <section className="exercise-media-instructions" aria-label={`${title} for this exercise`}>
      <h4>{title}</h4>
      <ol className="exercise-instructions">
        {instructions.map((instruction, index) => (
          <li key={`${index}-${instruction}`}>{instruction}</li>
        ))}
      </ol>
    </section>
  )
}

function LocalExerciseImage({
  src,
  exerciseName,
}: {
  src: string
  exerciseName: string
}) {
  return (
    <figure className="exercise-media-card">
      <div className="exercise-media-frame">
        <img
          className="exercise-media-player"
          src={src}
          alt={`${exerciseName} exercise illustration`}
          loading="lazy"
          decoding="async"
        />
    </figure>
  )
}

export function ExerciseMediaGallery({
  exerciseName,
  gender,
  autoLoad = false,
  fallbackInstructions = [],
  showInstructions = true,
}: {
  exerciseName: string
  gender: ExerciseVisualGender
  autoLoad?: boolean
  fallbackInstructions?: string[]
  showInstructions?: boolean
}) {
  const [isOpen, setIsOpen] = useState(autoLoad)
  const [retryVersion, setRetryVersion] = useState(0)
  const [imageLoadFailed, setImageLoadFailed] = useState(false)

  const localImage = getLocalImage(exerciseName)

  const params = new URLSearchParams({ name: exerciseName, gender })
  if (retryVersion > 0) params.set('attempt', String(retryVersion))

  const { data, error, isLoading, mutate } = useSWR<ExerciseMediaResponse, Error>(
    isOpen ? `/api/media?${params.toString()}` : null,
    fetchExerciseMedia,
    {
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  )

  const retryMedia = useCallback(() => {
    setImageLoadFailed(false)
    setRetryVersion((version) => version + 1)
    void mutate()
  }, [mutate])

  const instructions = data?.instructions?.length
    ? data.instructions
    : fallbackInstructions

  if (!isOpen && localImage) {
    return (
      <div className="exercise-media-gallery" aria-label={`${exerciseName} exercise image`}>
        <div className="exercise-media-list">
          <LocalExerciseImage src={localImage} exerciseName={exerciseName} />
        </div>
        {showInstructions && <ExerciseInstructions instructions={instructions} />}
        <button
          type="button"
          className="exercise-media-load"
          onClick={() => setIsOpen(true)}
        >
          <ImageIcon size={14} aria-hidden="true" /> Try WorkoutX photo
        </button>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <div className="exercise-media-gallery" aria-label={`${gender}-model exercise illustrations`}>
        <button
          type="button"
          className="exercise-media-load"
          onClick={() => setIsOpen(true)}
        >
          <ImageIcon size={14} aria-hidden="true" /> Load exercise photo
        </button>
        {showInstructions && <ExerciseInstructions instructions={fallbackInstructions} />}
      </div>
    )
  }

  if (!data || imageLoadFailed) {
    return (
      <div className="exercise-media-gallery" aria-label={`${exerciseName} exercise illustrations`}>
        {localImage ? (
          <div className="exercise-media-list">
            <LocalExerciseImage src={localImage} exerciseName={exerciseName} />
          </div>
        ) : (
          <MovementPreviewPlaceholder
            loading={!data && isLoading}
            error={imageLoadFailed ? 'The WorkoutX photo could not be displayed.' : error?.message}
            onRetry={!isLoading ? retryMedia : undefined}
          />
        )}
        {showInstructions && <ExerciseInstructions instructions={instructions} />}
        {localImage && (
          <button type="button" className="exercise-media-load" onClick={retryMedia}>
            <ImageIcon size={14} aria-hidden="true" /> Try WorkoutX photo again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="exercise-media-gallery" aria-label={`${gender}-model exercise illustrations`}>
      <div className="exercise-media-list">
        <figure className="exercise-media-card">
          <div className="exercise-media-frame">
            <img
              key={`${exerciseName}:${gender}:${data.imageUrl}`}
              className="exercise-media-player"
              src={data.imageUrl}
              alt={`${data.exerciseName ?? exerciseName} movement photo illustration`}
              loading={autoLoad ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setImageLoadFailed(false)}
              onError={() => setImageLoadFailed(true)}
            />
          </div>
          <figcaption className="exercise-media-caption">
            <strong>WorkoutX</strong>
            <span>Static exercise photo illustration</span>
          </figcaption>
        </figure>
      </div>
      {showInstructions && <ExerciseInstructions instructions={instructions} />}
    </div>
  )
}
