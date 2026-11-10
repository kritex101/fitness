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

  for (const key of ['results', 'data', 'items', 'exercises', 'videos', 'media']) {
    const nested = value[key]
    if (Array.isArray(nested)) return nested.filter(isRecord)
    if (isRecord(nested)) {
      const records = getRecords(nested)
      if (records.length) return records
    }
  }

  return [value]
}

function normalizeName(value: string) {
  return value.toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, '')
}

function findExactExercise(records: Record<string, unknown>[], name: string) {
  const target = normalizeName(name)
  return records.find((record) => {
    const recordName = [record.name, record.exercise_name, record.exerciseName, record.title].find((candidate) => typeof candidate === 'string')
    return typeof recordName === 'string' && normalizeName(recordName) === target
  })
}

function getRecordId(record: Record<string, unknown>) {
  const id = record.id ?? record.exercise_id ?? record.exerciseId ?? record.uuid
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

type MediaType = ExerciseMediaItem['mediaType']
type MediaCandidate = { url: string; mediaType: MediaType }

const mediaUrlFields: Array<[string, MediaType]> = [
  ['video_url', 'video'],
  ['videoUrl', 'video'],
  ['mp4_url', 'video'],
  ['mp4Url', 'video'],
  ['mp4', 'video'],
  ['animation_url', 'video'],
  ['animationUrl', 'video'],
  ['gif_url', 'gif'],
  ['gifUrl', 'gif'],
  ['gif', 'gif'],
  ['video', 'video'],
  ['animation', 'video'],
  ['file_url', 'video'],
  ['fileUrl', 'video'],
]

function normalizeMediaType(url: string, hint: MediaType): MediaType {
  if (/\.gif(?:$|[?#])/i.test(url)) return 'gif'
  if (/\.(?:mp4|m4v|webm|mov)(?:$|[?#])/i.test(url)) return 'video'
  return hint
}

function normalizeMediaCandidate(value: unknown, hint: MediaType, depth: number): MediaCandidate | null {
  const url = safeHttpsUrl(value)
  if (url) return { url, mediaType: normalizeMediaType(url, hint) }
  return findMediaCandidate(value, hint, depth)
}

function findMediaCandidate(value: unknown, hint: MediaType = 'video', depth = 0): MediaCandidate | null {
  if (depth > 6) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findMediaCandidate(item, hint, depth + 1)
      if (candidate) return candidate
    }
    return null
  }
  if (!isRecord(value)) return null

  for (const [field, mediaType] of mediaUrlFields) {
    if (value[field] === undefined) continue
    const candidate = normalizeMediaCandidate(value[field], mediaType, depth + 1)
    if (candidate) return candidate
  }

  for (const field of ['url', 'src']) {
    if (value[field] === undefined) continue
    const candidate = normalizeMediaCandidate(value[field], hint, depth + 1)
    if (candidate) return candidate
  }

  for (const field of ['media', 'videos', 'video', 'animation', 'files', 'assets', 'formats', 'data', 'results', 'items']) {
    const candidate = findMediaCandidate(value[field], hint, depth + 1)
    if (candidate) return candidate
  }
  return null
}

function findPosterUrl(value: unknown, depth = 0): string | null {
  if (depth > 5 || Array.isArray(value) || !isRecord(value)) return null
  for (const field of ['poster_url', 'posterUrl', 'poster', 'thumbnail_url', 'thumbnailUrl', 'thumbnail', 'og_image', 'preview_url', 'preview_image', 'image_url']) {
    const posterUrl = safeHttpsUrl(value[field])
    if (posterUrl) return posterUrl
  }
  for (const field of ['media', 'video', 'animation', 'data']) {
    const posterUrl = findPosterUrl(value[field], depth + 1)
    if (posterUrl) return posterUrl
  }
  return null
}

function matchesGender(record: Record<string, unknown>, gender: ExerciseVisualGender) {
  const value = record.gender ?? record.model ?? record.visual_gender
  return typeof value !== 'string' || value.toLowerCase() === gender
}

async function fetchMuscleWikiMedia(name: string, gender: ExerciseVisualGender, apiKey: string): Promise<ExerciseMediaItem[]> {
  const searchUrl = new URL('/exercises', MUSCLEWIKI_BASE_URL)
  searchUrl.search = new URLSearchParams({ search: name, gender, limit: '20' }).toString()
  const searchResponse = await fetch(searchUrl, { headers: { 'X-API-Key': apiKey }, cache: 'no-store' })
  if (!searchResponse.ok) throw new Error('MuscleWiki exercise search failed.')

  const exercise = findExactExercise(getRecords(await searchResponse.json()), name)
  const exerciseId = exercise ? getRecordId(exercise) : null
  if (!exerciseId) return []

  const videosUrl = new URL(`/exercises/${encodeURIComponent(exerciseId)}/videos`, MUSCLEWIKI_BASE_URL)
  videosUrl.search = new URLSearchParams({ gender }).toString()
  const videosResponse = await fetch(videosUrl, { headers: { 'X-API-Key': apiKey }, cache: 'no-store' })
  if (!videosResponse.ok) throw new Error('MuscleWiki video lookup failed.')

  return getRecords(await videosResponse.json())
    .filter((video) => matchesGender(video, gender))
    .flatMap((video, index) => {
      const media = findMediaCandidate(video)
      if (!media) return []
      const angleValue = video.angle ?? video.view
      const angle = typeof angleValue === 'string' ? angleValue : null
      return [{
        id: `musclewiki-${exerciseId}-${angle ?? index}`,
        provider: 'MuscleWiki' as const,
        kind: media.mediaType === 'gif' ? 'animation' as const : 'demonstration' as const,
        mediaType: media.mediaType,
        videoUrl: media.url,
        posterUrl: findPosterUrl(video),
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
  const exerciseId = exercise ? getRecordId(exercise) : null
  if (!exercise || !exerciseId || !matchesGender(exercise, gender)) return []

  const mediaUrl = new URL(`/exercises/${encodeURIComponent(exerciseId)}/media`, WORKOUTX_BASE_URL)
  mediaUrl.search = new URLSearchParams({ model: gender, gender }).toString()
  const mediaResponse = await fetch(mediaUrl, { headers: { 'X-WorkoutX-Key': apiKey }, cache: 'no-store' })
  if (!mediaResponse.ok) throw new Error('WorkoutX animation lookup failed.')

  return getRecords(await mediaResponse.json())
    .flatMap((record, index) => {
      const media = findMediaCandidate(record)
      if (!media) return []
      return [{
        id: `workoutx-${exerciseId}-${index}`,
        provider: 'WorkoutX' as const,
        kind: 'animation' as const,
        mediaType: media.mediaType,
        videoUrl: media.url,
        posterUrl: findPosterUrl(record),
        angle: null,
      }]
    })
    .slice(0, 2)
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
