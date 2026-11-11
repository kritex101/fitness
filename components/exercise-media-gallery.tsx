'use client'

import { Dumbbell, Play } from 'lucide-react'
import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { InlineVideoPlayer } from '@/components/inline-video-player'
import type { ExerciseMediaResponse } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

async function fetchExerciseMedia(url: string): Promise<ExerciseMediaResponse> {
  const response = await fetch(url, { cache: 'no-store' })
  const providerStatuses = response.headers.get('x-media-provider-statuses')
  if (providerStatuses) {
    try {
      const statuses = JSON.parse(providerStatuses) as Array<{ provider: string; stage: string; status: number | string }>
      console.log('[v0] MuscleWiki video API statuses:', statuses.map(({ stage, status }) => `${stage}: ${status}`).join(', '))
    } catch {
      console.log('[v0] MuscleWiki video API status header was invalid')
    }
  }

  const payload = await response.json().catch(() => null) as (ExerciseMediaResponse & { error?: string }) | null
  if (!response.ok) throw new Error(payload?.error ?? `MuscleWiki video request failed with HTTP ${response.status}.`)
  if (!payload || typeof payload.videoUrl !== 'string' || payload.source !== 'musclewiki' || payload.mediaType !== 'video') {
    throw new Error('MuscleWiki returned an incomplete video response.')
  }
  return payload
}

function MovementPreviewPlaceholder({ loading, error, onRetry }: { loading: boolean; error?: string; onRetry?: () => void }) {
  const title = loading ? 'Finding a MuscleWiki video' : error ? 'MuscleWiki video unavailable' : 'Movement preview'
  const description = loading
    ? 'Checking for a matching MuscleWiki exercise video.'
    : error ?? 'Load the matching MuscleWiki video when you are ready.'

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
  const params = new URLSearchParams({ name: exerciseName, gender })
  if (retryVersion > 0) params.set('attempt', String(retryVersion))

  const { data, error, isLoading, mutate } = useSWR<ExerciseMediaResponse, Error>(isOpen ? `/api/media?${params.toString()}` : null, fetchExerciseMedia, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })

  const retryMedia = useCallback(() => {
    setRetryVersion((version) => version + 1)
    void mutate()
  }, [mutate])

  const media = data ?? null
  const instructions = media?.instructions?.length ? media.instructions : fallbackInstructions
  const mediaDescription = media?.angle
    ? `${media.angle} camera angle · ${media.gender ?? gender} model`
    : `${gender} model`

  if (!isOpen) {
    return (
      <div className="exercise-media-gallery" aria-label={`${gender}-model MuscleWiki demonstrations`}>
        <button type="button" className="exercise-media-load" onClick={() => setIsOpen(true)}><Play size={14} aria-hidden="true" /> Load MuscleWiki video</button>
        {showInstructions && <ExerciseInstructions instructions={fallbackInstructions} />}
      </div>
    )
  }

  if (!media) {
    return (
      <div className="exercise-media-gallery" aria-label={`${gender}-model MuscleWiki demonstrations`}>
        <MovementPreviewPlaceholder loading={isLoading} error={error?.message} onRetry={!isLoading ? retryMedia : undefined} />
        {showInstructions && <ExerciseInstructions instructions={fallbackInstructions} />}
      </div>
    )
  }

  return (
    <div className="exercise-media-gallery" aria-label={`${gender}-model MuscleWiki demonstrations`}>
      <div className="exercise-media-list">
        <figure className="exercise-media-card">
          <InlineVideoPlayer
            key={`${exerciseName}:${gender}:${media.videoUrl}`}
            src={media.videoUrl}
            poster={media.posterUrl}
            title={`${media.exerciseName ?? exerciseName} MuscleWiki demonstration`}
            description={mediaDescription}
            className="exercise-inline-player"
            onRetry={retryMedia}
          />
          <figcaption className="exercise-media-caption">
            <strong>MuscleWiki</strong>
            <span>{mediaDescription}</span>
            <small className="exercise-media-attribution">Video and branded media provided by MuscleWiki, which retains rights to its content and trademarks.</small>
          </figcaption>
        </figure>
      </div>
      {showInstructions && <ExerciseInstructions instructions={instructions} />}
    </div>
  )
}
