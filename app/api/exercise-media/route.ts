import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { ExerciseMediaItem } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

const MUSCLEWIKI_BASE_URL = 'https://api.musclewiki.com'
const WORKOUTX_BASE_URL = 'https://api.workoutxapp.com/v2'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  if (Array.isArray(value.results)) return value.results.filter(isRecord)
  if (Array.isArray(value.data)) return value.data.filter(isRecord)
  return []
}

function normalizeName(value: string) {
  return value.toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, '')
}

function findExactExercise(records: Record<string, unknown>[], name: string) {
  const target = normalizeName(name)
  return records.find((record) => typeof record.name === 'string' && normalizeName(record.name) === target)
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

async function fetchMuscleWikiMedia(name: string, gender: ExerciseVisualGender, apiKey: string): Promise<ExerciseMediaItem[]> {
  const searchUrl = new URL('/exercises', MUSCLEWIKI_BASE_URL)
  searchUrl.search = new URLSearchParams({ search: name, gender, limit: '20' }).toString()
  const searchResponse = await fetch(searchUrl, { headers: { 'X-API-Key': apiKey }, cache: 'no-store' })
  if (!searchResponse.ok) throw new Error('MuscleWiki exercise search failed.')

  const exercise = findExactExercise(getRecords(await searchResponse.json()), name)
  if (!exercise || (typeof exercise.id !== 'string' && typeof exercise.id !== 'number')) return []

  const videosUrl = new URL(`/exercises/${encodeURIComponent(String(exercise.id))}/videos`, MUSCLEWIKI_BASE_URL)
  videosUrl.search = new URLSearchParams({ gender }).toString()
  const videosResponse = await fetch(videosUrl, { headers: { 'X-API-Key': apiKey }, cache: 'no-store' })
  if (!videosResponse.ok) throw new Error('MuscleWiki video lookup failed.')

  return getRecords(await videosResponse.json())
    .filter((video) => video.gender === gender)
    .flatMap((video, index) => {
      const videoUrl = safeHttpsUrl(video.url)
      if (!videoUrl) return []
      const angle = typeof video.angle === 'string' ? video.angle : null
      return [{
        id: `musclewiki-${exercise.id}-${angle ?? index}`,
        provider: 'MuscleWiki' as const,
        kind: 'demonstration' as const,
        videoUrl,
        posterUrl: safeHttpsUrl(video.og_image),
        angle,
      }]
    })
    .sort((left, right) => Number(left.angle?.toLowerCase() !== 'front') - Number(right.angle?.toLowerCase() !== 'front'))
    .slice(0, 2)
}

async function fetchWorkoutXMedia(name: string, gender: ExerciseVisualGender, apiKey: string): Promise<ExerciseMediaItem[]> {
  const searchUrl = new URL('/exercises', WORKOUTX_BASE_URL)
  searchUrl.search = new URLSearchParams({ name, model: gender, gender, limit: '10', media: 'false', lang: 'en' }).toString()
  const searchResponse = await fetch(searchUrl, { headers: { 'X-WorkoutX-Key': apiKey }, cache: 'no-store' })
  if (!searchResponse.ok) throw new Error('WorkoutX exercise search failed.')

  const exercise = findExactExercise(getRecords(await searchResponse.json()), name)
  if (!exercise || typeof exercise.id !== 'string' || exercise.model !== gender) return []

  const mediaUrl = new URL(`/exercises/${encodeURIComponent(exercise.id)}/media`, WORKOUTX_BASE_URL)
  mediaUrl.search = new URLSearchParams({ model: gender, gender }).toString()
  const mediaResponse = await fetch(mediaUrl, { headers: { 'X-WorkoutX-Key': apiKey }, cache: 'no-store' })
  if (!mediaResponse.ok) throw new Error('WorkoutX animation lookup failed.')

  const payload: unknown = await mediaResponse.json()
  const media = isRecord(payload) && isRecord(payload.media) ? payload.media : null
  const videoUrl = safeHttpsUrl(media?.mp4)
  if (!videoUrl) return []

  return [{
    id: `workoutx-${exercise.id}`,
    provider: 'WorkoutX',
    kind: 'animation',
    videoUrl,
    posterUrl: safeHttpsUrl(media?.poster),
    angle: null,
  }]
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to view exercise demonstrations.' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const name = searchParams.get('name')?.trim().replace(/\s+/g, ' ')
  const gender = searchParams.get('gender')
  if (!name || name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Enter an exercise name between 2 and 80 characters.' }, { status: 400 })
  }
  if (gender !== 'male' && gender !== 'female') {
    return NextResponse.json({ error: 'Choose male or female exercise visuals.' }, { status: 400 })
  }

  const muscleWikiKey = process.env.MUSCLEWIKI_API_KEY
  const workoutXKey = process.env.WORKOUTX_KEY
  if (!muscleWikiKey && !workoutXKey) {
    return NextResponse.json({ error: 'Exercise media is not configured right now.' }, { status: 503 })
  }

  const providers = await Promise.allSettled([
    muscleWikiKey ? fetchMuscleWikiMedia(name, gender as ExerciseVisualGender, muscleWikiKey) : Promise.reject(new Error('MuscleWiki is not configured.')),
    workoutXKey ? fetchWorkoutXMedia(name, gender as ExerciseVisualGender, workoutXKey) : Promise.reject(new Error('WorkoutX is not configured.')),
  ])
  const unavailableSources: Array<'MuscleWiki' | 'WorkoutX'> = []
  const media: ExerciseMediaItem[] = []

  if (providers[0].status === 'fulfilled') media.push(...providers[0].value)
  else unavailableSources.push('MuscleWiki')
  if (providers[1].status === 'fulfilled') media.push(...providers[1].value)
  else unavailableSources.push('WorkoutX')

  if (unavailableSources.length === 2) {
    return NextResponse.json({ error: 'Exercise video providers are temporarily unavailable.' }, { status: 502 })
  }

  const response = NextResponse.json({ media, unavailableSources })
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
