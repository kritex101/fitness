import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessProfiles } from '@/lib/db/schema'
import type { ExerciseMediaResponse } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'
import { fetchWorkoutXApi, findWorkoutXExerciseRecord, getWorkoutXPoster, normalizeWorkoutXExercise } from '@/lib/workoutx-api'

export const dynamic = 'force-dynamic'

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: noStoreHeaders })
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return errorResponse('Sign in to view exercise photo illustrations.', 401)

  const searchParams = new URL(request.url).searchParams
  const name = (searchParams.get('name') ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) {
    return errorResponse('Enter an exercise name between 2 and 80 characters.', 400)
  }

  const [profile] = await db.select({ gender: fitnessProfiles.gender })
    .from(fitnessProfiles)
    .where(eq(fitnessProfiles.userId, session.user.id))
    .limit(1)
  if (!profile) return errorResponse('Complete your profile before viewing exercise photo illustrations.', 403)

  const model: ExerciseVisualGender = profile.gender === 'woman' ? 'female' : 'male'
  const apiKey = process.env.WORKOUTX_API_KEY?.trim() ?? process.env.WORKOUTX_KEY?.trim()
  if (!apiKey) return errorResponse('WorkoutX photo access is not configured right now.', 503)

  const searchParamsForApi = new URLSearchParams({ name, model, limit: '10', media: 'false' })
  const searchResult = await fetchWorkoutXApi('/exercises', searchParamsForApi, apiKey)
  if (!searchResult.ok) {
    const status = searchResult.status === 429 ? 503 : 502
    const message = searchResult.status === 401 || searchResult.status === 403
      ? 'WorkoutX rejected the server API key. Check its access in project settings.'
      : searchResult.status === 429
        ? 'WorkoutX is rate-limiting photo requests. Try again shortly.'
        : 'WorkoutX is temporarily unavailable. Try loading the photo again.'
    return errorResponse(message, status)
  }

  const exerciseRecord = findWorkoutXExerciseRecord(searchResult.data, name)
  const exercise = exerciseRecord ? normalizeWorkoutXExercise(exerciseRecord) : null
  if (!exercise) return errorResponse('WorkoutX has no matching exercise photo for this movement.', 404)

  const mediaParams = new URLSearchParams({ model })
  const mediaResult = await fetchWorkoutXApi(`/exercises/${encodeURIComponent(exercise.id)}/media`, mediaParams, apiKey)
  if (!mediaResult.ok) {
    const status = mediaResult.status === 429 ? 503 : 502
    const message = mediaResult.status === 401 || mediaResult.status === 403
      ? 'WorkoutX rejected the server API key. Check its access in project settings.'
      : mediaResult.status === 429
        ? 'WorkoutX is rate-limiting photo requests. Try again shortly.'
        : 'WorkoutX could not load a photo for this exercise right now.'
    return errorResponse(message, status)
  }

  const imageUrl = getWorkoutXPoster(mediaResult.data)
  if (!imageUrl) return errorResponse('WorkoutX returned no valid photo illustration for this exercise.', 404)

  const result: ExerciseMediaResponse = {
    imageUrl,
    source: 'workoutx',
    mediaType: 'image',
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    gender: model,
    instructions: exercise.instructions,
  }

  return NextResponse.json(result, { headers: noStoreHeaders })
}
