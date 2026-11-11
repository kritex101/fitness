import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { ExerciseMediaResponse } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'
import {
  addMuscleWikiToken,
  createMuscleWikiProxyUrl,
  getMuscleWikiExerciseByName,
  getMuscleWikiMediaToken,
  selectMuscleWikiVideo,
  type MuscleWikiProviderStatus,
} from '@/lib/musclewiki-api'

export const dynamic = 'force-dynamic'

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  'X-Content-Type-Options': 'nosniff',
}

type ProviderStatus = MuscleWikiProviderStatus

function withProviderStatuses(response: NextResponse, statuses: ProviderStatus[]) {
  response.headers.set('Cache-Control', noStoreHeaders['Cache-Control'])
  response.headers.set('X-Content-Type-Options', noStoreHeaders['X-Content-Type-Options'])
  response.headers.set('X-Media-Provider-Statuses', JSON.stringify(statuses))
  return response
}

function profileGender(value: string | null | undefined): ExerciseVisualGender {
  return value === 'woman' ? 'female' : 'male'
}

async function fetchMuscleWikiMedia(
  name: string,
  gender: ExerciseVisualGender,
  apiKey: string,
  statuses: ProviderStatus[],
  forceRefreshToken = false,
): Promise<ExerciseMediaResponse | null> {
  const recordStatus = (status: ProviderStatus) => statuses.push(status)
  const exercise = await getMuscleWikiExerciseByName(name, gender, apiKey, recordStatus)
  if (!exercise) return null

  const video = selectMuscleWikiVideo(exercise.videos)
  if (!video) return null

  const mediaToken = await getMuscleWikiMediaToken(apiKey, recordStatus, forceRefreshToken)
  const canUseServerStream = mediaToken.status === 501 || mediaToken.status === 503 || mediaToken.status === 'network_error'
  if (!mediaToken.token && !canUseServerStream) return null

  const videoUrl = mediaToken.token
    ? addMuscleWikiToken(video.url, mediaToken.token)
    : createMuscleWikiProxyUrl(exercise.id, gender, video.angle, 'video')
  const posterUrl = video.posterUrl
    ? mediaToken.token
      ? addMuscleWikiToken(video.posterUrl, mediaToken.token)
      : createMuscleWikiProxyUrl(exercise.id, gender, video.angle, 'poster')
    : undefined

  return {
    videoUrl,
    posterUrl,
    source: 'musclewiki',
    mediaType: 'video',
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    gender,
    angle: video.angle,
    instructions: exercise.instructions,
  }
}

function resolveProviderFailure(statuses: ProviderStatus[]) {
  const authorizationFailure = statuses.find(({ status }) => status === 401 || status === 403)
  if (authorizationFailure?.status === 401) {
    return { status: 401, message: 'MuscleWiki rejected the API key. Check that it is active and authorized for API access.' }
  }
  if (authorizationFailure?.status === 403) {
    return { status: 403, message: 'MuscleWiki denied direct API access. The API key must have a TESTING plan or higher to stream videos in this app.' }
  }
  if (statuses.some(({ status }) => status === 429)) {
    return { status: 503, message: 'MuscleWiki is rate-limiting video requests. Try again shortly.' }
  }
  if (statuses.some(({ status }) => status === 'network_error' || (typeof status === 'number' && status >= 500))) {
    return { status: 502, message: 'MuscleWiki is temporarily unavailable. Try loading the video again.' }
  }
  return { status: 404, message: 'MuscleWiki has no matching video for this exercise and model.' }
}

function errorResponse(message: string, status: number, statuses: ProviderStatus[] = []) {
  return withProviderStatuses(NextResponse.json({ error: message }, { status }), statuses)
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return errorResponse('Sign in to view exercise videos.', 401)

  const searchParams = new URL(request.url).searchParams
  const name = (searchParams.get('name') ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) {
    return errorResponse('Enter an exercise name between 2 and 80 characters.', 400)
  }

  const [profile] = await db.select({ gender: fitnessProfiles.gender })
    .from(fitnessProfiles)
    .where(eq(fitnessProfiles.userId, session.user.id))
    .limit(1)
  if (!profile) return errorResponse('Complete your profile before viewing exercise videos.', 403)

  const apiKey = process.env.MUSCLEWIKI_API_KEY?.trim()
  if (!apiKey) return errorResponse('MuscleWiki video access is not configured right now.', 503)

  const statuses: ProviderStatus[] = []
  const result = await fetchMuscleWikiMedia(
    name,
    profileGender(profile.gender),
    apiKey,
    statuses,
    Number(searchParams.get('attempt')) > 0,
  )

  if (result) {
    console.log(`[v0] /api/media selected MuscleWiki for ${result.exerciseName}`)
    return withProviderStatuses(NextResponse.json<ExerciseMediaResponse>(result), statuses)
  }

  const failure = resolveProviderFailure(statuses)
  console.log(`[v0] /api/media MuscleWiki unavailable (${failure.status})`)
  return errorResponse(failure.message, failure.status, statuses)
}
