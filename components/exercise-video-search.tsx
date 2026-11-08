'use client'

import Image from 'next/image'
import { ExternalLink, LoaderCircle, PlayCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

type YouTubeVideo = {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string | null
}

type YouTubeSearchResponse = {
  videos: YouTubeVideo[]
}

async function fetchVideos(url: string): Promise<YouTubeSearchResponse> {
  const response = await fetch(url)
  const payload = (await response.json()) as YouTubeSearchResponse & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not search for videos.')
  return payload
}

export function ExerciseVideoSearch({ exerciseId, exerciseName, gender }: { exerciseId: string; exerciseName: string; gender: ExerciseVisualGender }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState(exerciseName)
  const [submittedSearch, setSubmittedSearch] = useState(exerciseName)
  const resultsId = `exercise-video-results-${exerciseId}`
  const searchUrl = isOpen ? `/api/youtube/exercise-search?q=${encodeURIComponent(submittedSearch)}&gender=${gender}` : null
  const { data, error, isLoading } = useSWR<YouTubeSearchResponse, Error>(searchUrl, fetchVideos, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })
  const fallbackSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${gender} ${submittedSearch} exercise demonstration proper form`)}`
  const searchInputId = `exercise-video-query-${exerciseId}`

  function searchForExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedSearch = searchTerm.trim()
    if (trimmedSearch.length >= 2 && trimmedSearch.length <= 80) {
      setSubmittedSearch(trimmedSearch)
      setIsOpen(true)
    }
  }

  return (
    <>
      <button
        className="video-tutorial-link"
        type="button"
        aria-expanded={isOpen}
        aria-controls={resultsId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <PlayCircle size={17} aria-hidden="true" />
        {isOpen ? 'Hide video demonstrations' : 'Find video demonstrations'}
      </button>
      {isOpen && (
        <section id={resultsId} className="exercise-video-results" aria-label={`${gender} ${submittedSearch} video demonstrations`} aria-busy={isLoading}>
          <form className="exercise-video-search-form" onSubmit={searchForExercise}>
            <label htmlFor={searchInputId}>Search a specific exercise</label>
            <div className="exercise-video-search-fields">
              <input id={searchInputId} type="search" value={searchTerm} maxLength={80} onChange={(event) => setSearchTerm(event.target.value)} placeholder="e.g. dumbbell row" />
              <button type="submit" disabled={searchTerm.trim().length < 2}>Search</button>
            </div>
          </form>
          {isLoading && <p className="video-search-feedback" role="status"><LoaderCircle size={16} aria-hidden="true" /> Searching YouTube…</p>}
          {error && (
            <p className="video-search-feedback" role="alert">
              {error.message} <a href={fallbackSearchUrl} target="_blank" rel="noopener noreferrer">Open YouTube search</a>
            </p>
          )}
          {data && data.videos.length === 0 && (
            <p className="video-search-feedback" role="status">
              No embeddable matches found. <a href={fallbackSearchUrl} target="_blank" rel="noopener noreferrer">Search YouTube</a>
            </p>
          )}
          {data && data.videos.length > 0 && (
            <>
              <div className="exercise-video-player">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${data.videos[0].videoId}`}
                  title={`${data.videos[0].title} — ${submittedSearch} demonstration`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <div className="exercise-video-caption">
                <div>
                  <h4>{data.videos[0].title}</h4>
                  <p>{data.videos[0].channelTitle}</p>
                </div>
                <a href={`https://www.youtube.com/watch?v=${data.videos[0].videoId}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${data.videos[0].title} on YouTube`}>
                  <ExternalLink size={15} aria-hidden="true" />
                  <span>Open on YouTube</span>
                </a>
              </div>
              {data.videos.length > 1 && (
                <ul className="exercise-video-alternatives" aria-label="More video matches">
                  {data.videos.slice(1, 4).map((video) => (
                    <li key={video.videoId}>
                      <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer">
                        {video.thumbnailUrl && <Image className="exercise-video-thumbnail" src={video.thumbnailUrl} alt="" width={128} height={72} loading="lazy" unoptimized />}
                        <span className="exercise-video-alt-copy"><span>{video.title}</span><small>{video.channelTitle}</small></span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </>
  )
}
