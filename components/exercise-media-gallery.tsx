'use client'

import { LoaderCircle, Play } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'
import type { ExerciseMediaResponse } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

async function fetchExerciseMedia(url: string): Promise<ExerciseMediaResponse> {
  const response = await fetch(url)
  const payload = await response.json() as ExerciseMediaResponse & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Exercise media could not be loaded.')
  return payload
}

export function ExerciseMediaGallery({ exerciseName, gender, autoLoad = false }: { exerciseName: string; gender: ExerciseVisualGender; autoLoad?: boolean }) {
  const [isOpen, setIsOpen] = useState(autoLoad)
  const params = new URLSearchParams({ name: exerciseName, gender })
  const { data, error, isLoading } = useSWR<ExerciseMediaResponse, Error>(isOpen ? `/api/exercise-media?${params.toString()}` : null, fetchExerciseMedia, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })

  if (!isOpen) {
    return <button type="button" className="exercise-media-load" onClick={() => setIsOpen(true)}><Play size={14} aria-hidden="true" /> Load {gender}-model guides</button>
  }

  if (isLoading) {
    return <p className="exercise-media-status" role="status"><LoaderCircle size={16} aria-hidden="true" /> Loading {gender}-model demonstrations…</p>
  }

  if (error) {
    return <p className="exercise-media-status" role="alert">{error.message}</p>
  }

  if (!data?.media.length) {
    return <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}><p className="exercise-media-status" role="status">No {gender}-model video or animation is available for this movement.</p>{data?.unavailableSources.length ? <p className="exercise-media-status" role="status">{data.unavailableSources.join(' and ')} media is temporarily unavailable.</p> : null}</div>
  }

  return (
    <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}>
      <div className="exercise-media-list">
        {data.media.map((item) => (
          <figure className="exercise-media-card" key={item.id}>
            <video
              className="exercise-media-player"
              controls
              playsInline
              preload="none"
              poster={item.posterUrl ?? undefined}
              loop={item.kind === 'animation'}
              muted={item.kind === 'animation'}
              aria-label={`${exerciseName} ${item.kind === 'animation' ? 'looping animation' : 'video demonstration'} (${gender} model${item.angle ? `, ${item.angle} angle` : ''})`}
            >
              <source src={item.videoUrl} type="video/mp4" />
              Your browser does not support embedded MP4 video.
            </video>
            <figcaption className="exercise-media-caption">
              <strong>{item.provider}</strong>
              <span>{item.kind === 'animation' ? 'Looping 3D animation' : `${item.angle ? `${item.angle} angle · ` : ''}Video demonstration`}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {data.unavailableSources.length > 0 && (
        <p className="exercise-media-status" role="status">{data.unavailableSources.join(' and ')} media is temporarily unavailable.</p>
      )}
    </div>
  )
}
