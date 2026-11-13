'use client'

import { Dumbbell, Image as ImageIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import useSWR from 'swr'
import type { ExerciseMediaResponse } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

async function fetchExerciseMedia(url: string): Promise<ExerciseMediaResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json().catch(() => null) as (ExerciseMediaResponse & { error?: string }) | null
  if (!response.ok) throw new Error(payload?.error ?? `WorkoutX photo request failed with HTTP ${response.status}.`)
  if (!payload || typeof payload.imageUrl !== 'string' || payload.source !== 'workoutx' || payload.mediaType !== 'image') {
    throw new Error('WorkoutX returned an incomplete photo response.')
  }
  return payload
}

function MovementPreviewPlaceholder({ loading, error, onRetry }: { loading: boolean; error?: string; onRetry?: () => void }) {
  const title = loading ? 'Finding a WorkoutX photo' : error ? 'WorkoutX photo unavailable' : 'Exercise photo illustration'
  const description = loading
    ? 'Loading a static pose illustration for this movement.'
    : error ?? 'Load a WorkoutX photo illustration when you are ready.'

  return (
    <div className="exercise-media-frame exercise-media-frame-placeholder" role={error ? 'alert' : 'status'}>
      <div className="exercise-media-placeholder-content">
        <div className="exercise-media-motion-stage" aria-hidden="true">
          <Dumbbell className="exercise-media-motion-icon" size={30} strokeWidth={1.8} />
        </div>
        <div className="exercise-media-placeholder-copy">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        {onRetry && !loading && <button className="exercise-media-retry" type="button" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  )
}

function ExerciseInstructions({ instructions, title = 'Instructions' }: { instructions: string[]; title?: string }) {
  if (!instructions.length) return null

  return (
    <section className="exercise-media-instructions" aria-label={`${title} for this exercise`}>
      <h4>{title}</h4>
      <ol className="exercise-instructions">
        {instructions.map((instruction, index) => <li key={`${index}-${instruction}`}>{instruction}</li>)}
      </ol>
    </section>
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
  const params = new URLSearchParams({ name: exerciseName, gender })
  if (retryVersion > 0) params.set('attempt', String(retryVersion))

  const { data, error, isLoading, mutate } = useSWR<ExerciseMediaResponse, Error>(isOpen ? `/api/media?${params.toString()}` : null, fetchExerciseMedia, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })

  const retryMedia = useCallback(() => {
    setImageLoadFailed(false)
    setRetryVersion((version) => version + 1)
    void mutate()
  }, [mutate])

  const media = data ?? null
  const instructions = media?.instructions?.length ? media.instructions : fallbackInstructions
  const mediaDescription = `${media?.gender ?? gender} model · static photo illustration`

  if (!isOpen) {
    return (
      <div className="exercise-media-gallery" aria-label={`${gender}-model WorkoutX photo illustrations`}>
        <button type="button" className="exercise-media-load" onClick={() => setIsOpen(true)}><ImageIcon size={14} aria-hidden="true" /> Load WorkoutX photo</button>
        {showInstructions && <ExerciseInstructions instructions={fallbackInstructions} />}
      </div>
    )
  }

  if (!media || imageLoadFailed) {
    return (
      <div className="exercise-media-gallery" aria-label={`${gender}-model WorkoutX photo illustrations`}>
        <MovementPreviewPlaceholder loading={!media && isLoading} error={imageLoadFailed ? 'The WorkoutX photo could not be displayed.' : error?.message} onRetry={!isLoading ? retryMedia : undefined} />
        {showInstructions && <ExerciseInstructions instructions={instructions} />}
      </div>
    )
  }

  return (
    <div className="exercise-media-gallery" aria-label={`${gender}-model WorkoutX photo illustrations`}>
      <div className="exercise-media-list">
        <figure className="exercise-media-card">
          <div className="exercise-media-frame">
            <img
              key={`${exerciseName}:${gender}:${media.imageUrl}`}
              className="exercise-media-player"
              src={media.imageUrl}
              alt={`${media.exerciseName ?? exerciseName} movement photo illustration for a ${media.gender ?? gender} model`}
              loading={autoLoad ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setImageLoadFailed(false)}
              onError={() => setImageLoadFailed(true)}
            />
          </div>
          <figcaption className="exercise-media-caption">
            <strong>WorkoutX</strong>
            <span>{mediaDescription}</span>
          </figcaption>
        </figure>
      </div>
      {showInstructions && <ExerciseInstructions instructions={instructions} />}
    </div>
  )
}
