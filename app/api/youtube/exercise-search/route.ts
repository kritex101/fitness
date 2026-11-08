import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string }
    snippet?: { title?: string; channelTitle?: string }
  }>
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to search for exercise videos.' }, { status: 401 })
  }

  const exercise = new URL(request.url).searchParams.get('q')?.trim().replace(/\s+/g, ' ')
  if (!exercise || exercise.length < 2 || exercise.length > 80) {
    return NextResponse.json({ error: 'Enter an exercise name between 2 and 80 characters.' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Video search is not configured right now.' }, { status: 503 })
  }

  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    q: `${exercise} exercise demonstration proper form`,
    type: 'video',
    maxResults: '5',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
  })

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'YouTube video search is temporarily unavailable.' }, { status: 502 })
    }

    const result = (await response.json()) as YouTubeSearchResponse
    const videos = (result.items ?? []).flatMap((item) => {
      const videoId = item.id?.videoId
      const title = item.snippet?.title
      const channelTitle = item.snippet?.channelTitle
      if (!videoId || !/^[\w-]{11}$/.test(videoId) || !title || !channelTitle) return []
      return [{ videoId, title, channelTitle }]
    })

    return NextResponse.json({ videos }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'YouTube video search is temporarily unavailable.' }, { status: 502 })
  }
}
