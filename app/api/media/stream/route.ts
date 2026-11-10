import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { ExerciseVisualGender } from '@/lib/fitness-data'
import { getMuscleWikiVideoForVariant } from '@/lib/musclewiki-api'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Range',
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders })
}

function profileGender(value: string | null | undefined): ExerciseVisualGender {
  return value === 'woman' ? 'female' : 'male'
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return errorResponse('Sign in to view exercise demonstrations.', 401)

  const { searchParams } = new URL(request.url)
  const exerciseId = Number(searchParams.get('exerciseId'))
  const angle = searchParams.get('angle')
  const kind = searchParams.get('kind')
  if (!Number.isSafeInteger(exerciseId) || exerciseId < 0 || (angle !== 'front' && angle !== 'side') || (kind !== 'video' && kind !== 'poster')) {
    return errorResponse('The requested exercise media is invalid.', 400)
  }

  const [profile] = await db.select({ gender: fitnessProfiles.gender })
    .from(fitnessProfiles)
    .where(eq(fitnessProfiles.userId, session.user.id))
    .limit(1)
  if (!profile) return errorResponse('Complete your profile before viewing exercise demonstrations.', 403)

  const apiKey = process.env.MUSCLEWIKI_API_KEY
  if (!apiKey) return errorResponse('Exercise media is not configured right now.', 503)

  const gender = profileGender(profile.gender)
  const video = await getMuscleWikiVideoForVariant(exerciseId, gender, angle, apiKey, () => undefined)
  const mediaUrl = kind === 'video' ? video?.url : video?.posterUrl
  if (!mediaUrl) return errorResponse('This matching MuscleWiki media variant is unavailable.', 404)

  const range = kind === 'video' ? request.headers.get('range') : null
  if (range && (range.length > 160 || !/^bytes=\d*-\d*(?:,\d*-\d*)*$/.test(range))) {
    return errorResponse('The requested video range is invalid.', 416)
  }

  try {
    const upstreamHeaders = new Headers({ 'X-API-Key': apiKey })
    if (range) upstreamHeaders.set('Range', range)
    const upstream = await fetch(mediaUrl, {
      headers: upstreamHeaders,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })

    const responseHeaders = new Headers(noStoreHeaders)
    responseHeaders.set('Content-Disposition', 'inline')
    responseHeaders.set('Accept-Ranges', upstream.headers.get('accept-ranges') ?? 'bytes')
    for (const name of ['content-type', 'content-length', 'content-range', 'last-modified', 'etag']) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }

    console.log(`[v0] MuscleWiki streaming proxy HTTP ${upstream.status}`)
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return errorResponse('The MuscleWiki stream could not be reached. Try refreshing the video.', 502)
  }
}
