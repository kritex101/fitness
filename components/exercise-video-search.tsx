'use client'

import { ExternalLink, LoaderCircle, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

type YouTubeVideo = {
  videoId: string
  title: string
  channelTitle: string
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

export function ExerciseVideoSearch({ exerciseId, exerciseName }: { exerciseId: string; exerciseName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const resultsId = `exercise-video-results-${exerciseId}`
  const searchUrl = isOpen ? `/api/youtube/exercise-search?q=${encodeURIComponent(exerciseName)}` : null
  const { data, error, isLoading } = useSWR<YouTubeSearchResponse, Error>(searchUrl, fetchVideos, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })
  const fallbackSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} exercise demonstration proper form`)}`

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
        <section id={resultsId} className="exercise-video-results" aria-label={`${exerciseName} video demonstrations`} aria-busy={isLoading}>
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
                  title={`${data.videos[0].title} — ${exerciseName} demonstration`}
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
                        <span>{video.title}</span>
                        <small>{video.channelTitle}</small>
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
