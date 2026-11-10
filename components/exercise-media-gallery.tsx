'use client'

import Image from 'next/image'
import { LoaderCircle, Play } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'
import type { ExerciseMediaResponse } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

async function fetchExerciseMedia(url: string): Promise<ExerciseMediaResponse> {
  const response = await fetch(url)
  const payload = await response.json().catch(() => null) as (ExerciseMediaResponse & { error?: string }) | null
  if (!response.ok) throw new Error(payload?.error ?? 'Exercise media could not be loaded.')
  if (!payload || !Array.isArray(payload.media) || !Array.isArray(payload.unavailableSources)) {
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
  const [failedMedia, setFailedMedia] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] })
  const mediaKey = `${exerciseName}:${gender}`
  const params = new URLSearchParams({ name: exerciseName, gender })
  const { data, error, isLoading, mutate } = useSWR<ExerciseMediaResponse, Error>(isOpen ? `/api/exercises/media?${params.toString()}` : null, fetchExerciseMedia, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })
  const failedIds = new Set(failedMedia.key === mediaKey ? failedMedia.ids : [])
  const availableMedia = data?.media.filter((item) => !failedIds.has(item.id)) ?? []

  function handleMediaError(id: string) {
    setFailedMedia((current) => ({
      key: mediaKey,
      ids: current.key === mediaKey ? [...new Set([...current.ids, id])] : [id],
    }))
  }

  function retryMedia() {
    setFailedMedia({ key: mediaKey, ids: [] })
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

  if (!data?.media.length) {
    const unavailable = data?.unavailableSources.length ? ` ${data.unavailableSources.join(' and ')} could not be reached.` : ''
    return <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}><MediaStatusFrame message={`No video or animation is available for this movement.${unavailable} Follow the exercise instructions and target muscle badge above.`} /></div>
  }

  if (availableMedia.length === 0) {
    return <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}><MediaStatusFrame role="alert" message="This video source could not be played. Follow the exercise instructions and target muscle badge above." onRetry={retryMedia} /></div>
  }

  return (
    <div className="exercise-media-gallery" aria-label={`${gender}-model exercise demonstrations`}>
      <div className="exercise-media-list">
        {availableMedia.map((item) => (
          <figure className="exercise-media-card" key={item.id}>
            <div className="exercise-media-frame">
              {item.mediaType === 'gif' ? (
                <Image
                  className="exercise-media-player"
                  src={item.videoUrl}
                  alt={`${exerciseName} ${item.kind === 'animation' ? 'animated demonstration' : 'video demonstration'}`}
                  width={640}
                  height={360}
                  unoptimized
                  loading="lazy"
                  onError={() => handleMediaError(item.id)}
                />
              ) : (
                <video
                  className="exercise-media-player"
                  controls
                  playsInline
                  preload="none"
                  poster={item.posterUrl ?? undefined}
                  loop={item.kind === 'animation'}
                  muted={item.kind === 'animation'}
                  autoPlay={item.kind === 'animation'}
                  onError={() => handleMediaError(item.id)}
                  aria-label={`${exerciseName} ${item.kind === 'animation' ? 'looping animation' : 'video demonstration'} (${gender} model${item.angle ? `, ${item.angle} angle` : ''})`}
                >
                  <source src={item.videoUrl} />
                  Your browser does not support embedded video.
                </video>
              )}
            </div>
            <figcaption className="exercise-media-caption">
              <strong>{item.provider}</strong>
              <span>{item.kind === 'animation' ? 'Looping animation' : `${item.angle ? `${item.angle} angle · ` : ''}Video demonstration`}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {(failedIds.size > 0 || data.unavailableSources.length > 0) && (
        <p className="exercise-media-status" role="status">Some media sources could not be played. Other guides remain available.</p>
      )}
    </div>
  )
}
