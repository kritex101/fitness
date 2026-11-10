import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string }
    snippet?: {
      title?: string
      channelTitle?: string
      thumbnails?: { medium?: { url?: string } }
    }
  }>
}

function getSafeThumbnailUrl(url: string | undefined) {
  if (!url) return null
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'i.ytimg.com' ? parsedUrl.toString() : null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to search for exercise videos.' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const exercise = searchParams.get('q')?.trim().replace(/\s+/g, ' ')
  if (!exercise || exercise.length < 2 || exercise.length > 80) {
    return NextResponse.json({ error: 'Enter an exercise name between 2 and 80 characters.' }, { status: 400 })
  }

  const [profile] = await db.select({ gender: fitnessProfiles.gender }).from(fitnessProfiles)
    .where(eq(fitnessProfiles.userId, session.user.id)).limit(1)
  if (!profile) return NextResponse.json({ error: 'Complete your profile before searching for exercise videos.' }, { status: 403 })
  const gender = profile.gender === 'woman' ? 'female' : 'male'

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Video search is not configured right now.' }, { status: 503 })
  }

  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    q: `${gender} ${exercise} exercise demonstration proper form`,
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
      return [{ videoId, title, channelTitle, thumbnailUrl: getSafeThumbnailUrl(item.snippet?.thumbnails?.medium?.url) }]
    })

    return NextResponse.json({ videos }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'YouTube video search is temporarily unavailable.' }, { status: 502 })
  }
}
