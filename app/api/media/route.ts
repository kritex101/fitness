import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessProfiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { ExerciseMediaResponse, ExerciseMediaSource } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'
import { addMuscleWikiToken, createMuscleWikiProxyUrl, getMuscleWikiExerciseByName, getMuscleWikiMediaToken, selectMuscleWikiVideo, type MuscleWikiProviderStatus } from '@/lib/musclewiki-api'

const WORKOUTX_BASE_URL = 'https://api.workoutxapp.com/v2'
const EXERCISEDB_BASE_URL = 'https://exercisedb.p.rapidapi.com'
const API_NINJAS_BASE_URL = 'https://api.api-ninjas.com'

type ProviderStatus = {
  provider: ExerciseMediaSource
  stage: string
  status: number | 'network_error' | 'not_configured' | 'excluded'
}

const mediaProviderSources: ExerciseMediaSource[] = ['musclewiki', 'workoutx', 'exercisedb', 'ninjas']

function parseExcludedSources(value: string | null) {
  return new Set((value ?? '').split(',').filter((source): source is ExerciseMediaSource => mediaProviderSources.includes(source as ExerciseMediaSource)))
}

type ProviderResponse = ExerciseMediaResponse

type MediaCandidate = { url: string }

function normalizeExerciseName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US')
}

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

function findExactExercise(records: Record<string, unknown>[], name: string, gender?: ExerciseVisualGender) {
  return records.find((record) => {
    const recordName = [record.name, record.exercise_name, record.exerciseName, record.title]
      .find((candidate) => typeof candidate === 'string')
    return typeof recordName === 'string'
      && normalizeExerciseName(recordName) === name
      && (!gender || matchesGender(record, gender))
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

function getVideoMediaType(url: string): 'video' | 'gif' {
  return /\.gif(?:$|[?#])/i.test(url) ? 'gif' : 'video'
}

const mediaUrlFields = [
  'video_url', 'videoUrl', 'mp4_url', 'mp4Url', 'mp4', 'animation_url', 'animationUrl',
  'gif_url', 'gifUrl', 'gif', 'video', 'animation', 'file_url', 'fileUrl', 'url', 'src',
]

function findMediaCandidate(value: unknown, depth = 0): MediaCandidate | null {
  if (depth > 6) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findMediaCandidate(item, depth + 1)
      if (candidate) return candidate
    }
    return null
  }
  if (!isRecord(value)) return null

  for (const field of mediaUrlFields) {
    const url = safeHttpsUrl(value[field])
    if (url) return { url }
  }

  for (const field of ['media', 'videos', 'video', 'animation', 'files', 'assets', 'formats', 'data', 'results', 'items']) {
    const candidate = findMediaCandidate(value[field], depth + 1)
    if (candidate) return candidate
  }
  return null
}

function matchesGender(record: Record<string, unknown>, gender: ExerciseVisualGender, allowUnspecified = false) {
  const value = record.gender ?? record.model ?? record.visual_gender
  if (typeof value !== 'string') return allowUnspecified
  const normalized = value.toLowerCase().trim()
  return gender === 'female'
    ? ['female', 'woman', 'women'].includes(normalized)
    : ['male', 'man', 'men'].includes(normalized)
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function fetchProvider(
  provider: ExerciseMediaSource,
  stage: string,
  url: URL,
  apiHeaders: Record<string, string>,
  statuses: ProviderStatus[],
) {
  try {
    const response = await fetch(url, { headers: apiHeaders, cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    statuses.push({ provider, stage, status: response.status })
    console.log(`[v0] /api/media ${provider} ${stage} HTTP ${response.status}`)
    return response
  } catch {
    statuses.push({ provider, stage, status: 'network_error' })
    console.log(`[v0] /api/media ${provider} ${stage} network error`)
    return null
  }
}

async function fetchMuscleWikiMedia(name: string, gender: ExerciseVisualGender, apiKey: string, statuses: ProviderStatus[], forceRefreshToken = false): Promise<ExerciseMediaResponse | null> {
  const recordStatus = (status: MuscleWikiProviderStatus) => { statuses.push(status) }
  const exercise = await getMuscleWikiExerciseByName(name, gender, apiKey, recordStatus)
  if (!exercise) return null

  const video = selectMuscleWikiVideo(exercise.videos)
  if (!video) return null

  const mediaToken = await getMuscleWikiMediaToken(apiKey, recordStatus, forceRefreshToken)
  const supportsProxyFallback = mediaToken.status === 501 || mediaToken.status === 503 || mediaToken.status === 'network_error'
  if (!mediaToken.token && !supportsProxyFallback) return null

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

async function fetchWorkoutXMedia(name: string, gender: ExerciseVisualGender, apiKey: string, statuses: ProviderStatus[]): Promise<string | null> {
  const searchUrl = new URL('/exercises', WORKOUTX_BASE_URL)
  searchUrl.search = new URLSearchParams({ name, model: gender, gender, limit: '10', media: 'false', lang: 'en' }).toString()
  const searchResponse = await fetchProvider('workoutx', 'exercise search', searchUrl, { 'X-WorkoutX-Key': apiKey }, statuses)
  if (!searchResponse?.ok) return null

  const exercise = findExactExercise(getRecords(await readJson(searchResponse)), name, gender)
  const exerciseId = exercise ? getRecordId(exercise) : null
  if (!exercise || !exerciseId || !matchesGender(exercise, gender)) return null

  const mediaUrl = new URL(`/exercises/${encodeURIComponent(exerciseId)}/media`, WORKOUTX_BASE_URL)
  mediaUrl.search = new URLSearchParams({ model: gender, gender }).toString()
  const mediaResponse = await fetchProvider('workoutx', 'media lookup', mediaUrl, { 'X-WorkoutX-Key': apiKey }, statuses)
  if (!mediaResponse?.ok) return null

  for (const record of getRecords(await readJson(mediaResponse))) {
    if (!matchesGender(record, gender, true)) continue
    const media = findMediaCandidate(record)
    if (media) return media.url
  }
  return null
}

async function fetchExerciseDbMedia(name: string, apiKey: string, statuses: ProviderStatus[]): Promise<string | null> {
  const exerciseUrl = new URL(`/exercises/name/${encodeURIComponent(name)}`, EXERCISEDB_BASE_URL)
  const response = await fetchProvider('exercisedb', 'GIF lookup', exerciseUrl, {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
  }, statuses)
  if (!response?.ok) return null

  const exercise = findExactExercise(getRecords(await readJson(response)), name)
  return exercise ? safeHttpsUrl(exercise.gifUrl) : null
}

async function fetchApiNinjasMedia(name: string, apiKey: string, statuses: ProviderStatus[]) {
  const exerciseUrl = new URL('/v1/exercises', API_NINJAS_BASE_URL)
  exerciseUrl.searchParams.set('name', name)
  const response = await fetchProvider('ninjas', 'exercise image lookup', exerciseUrl, { 'X-Api-Key': apiKey }, statuses)
  if (!response?.ok) return null

  const exercise = findExactExercise(getRecords(await readJson(response)), name)
  const imageUrls = Array.isArray(exercise?.images)
    ? exercise.images.map(safeHttpsUrl).filter((url): url is string => Boolean(url)).slice(0, 2)
    : []
  if (!imageUrls.length) {
    console.log('[v0] /api/media API Ninjas returned no exercise images')
    return null
  }
  return { videoUrl: imageUrls[0], imageUrls }
}

function addStatusesHeader(response: NextResponse, statuses: ProviderStatus[]) {
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Media-Provider-Statuses', JSON.stringify(statuses))
  return response
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to view exercise demonstrations.' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const rawName = searchParams.get('name') ?? ''
  const name = normalizeExerciseName(rawName)
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Enter an exercise name between 2 and 80 characters.' }, { status: 400 })
  }

  const [profile] = await db.select({ gender: fitnessProfiles.gender }).from(fitnessProfiles)
    .where(eq(fitnessProfiles.userId, session.user.id)).limit(1)
  if (!profile) return NextResponse.json({ error: 'Complete your profile before viewing exercise demonstrations.' }, { status: 403 })
  const gender: ExerciseVisualGender = profile.gender === 'woman' ? 'female' : 'male'

  const muscleWikiKey = process.env.MUSCLEWIKI_API_KEY
  const workoutXKey = process.env.WORKOUTX_API_KEY ?? process.env.WORKOUTX_KEY
  const exerciseDbKey = process.env.RAPIDAPI_EXERCISE_KEY
  const ninjasKey = process.env.NINJAS_API_KEY
  const statuses: ProviderStatus[] = []
  const excludedSources = parseExcludedSources(searchParams.get('exclude'))
  let result: ProviderResponse | null = null

  if (excludedSources.has('musclewiki')) {
    statuses.push({ provider: 'musclewiki', stage: 'skipped after playback failure', status: 'excluded' })
  } else if (muscleWikiKey) {
    result = await fetchMuscleWikiMedia(name, gender as ExerciseVisualGender, muscleWikiKey, statuses, searchParams.get('attempt') === '1')
  } else {
    statuses.push({ provider: 'musclewiki', stage: 'exercise search', status: 'not_configured' })
    console.log('[v0] /api/media MuscleWiki not configured')
  }

  if (!result && excludedSources.has('workoutx')) {
    statuses.push({ provider: 'workoutx', stage: 'skipped after playback failure', status: 'excluded' })
  } else if (!result && workoutXKey) {
    const videoUrl = await fetchWorkoutXMedia(name, gender as ExerciseVisualGender, workoutXKey, statuses)
    if (videoUrl) result = { videoUrl, source: 'workoutx', mediaType: getVideoMediaType(videoUrl) }
  } else if (!result) {
    statuses.push({ provider: 'workoutx', stage: 'exercise search', status: 'not_configured' })
    console.log('[v0] /api/media WorkoutX not configured')
  }

  if (!result && excludedSources.has('exercisedb')) {
    statuses.push({ provider: 'exercisedb', stage: 'skipped after playback failure', status: 'excluded' })
  } else if (!result && exerciseDbKey) {
    const videoUrl = await fetchExerciseDbMedia(name, exerciseDbKey, statuses)
    if (videoUrl) result = { videoUrl, source: 'exercisedb', mediaType: 'gif' }
  } else if (!result) {
    statuses.push({ provider: 'exercisedb', stage: 'GIF lookup', status: 'not_configured' })
    console.log('[v0] /api/media ExerciseDB not configured')
  }

  if (!result && excludedSources.has('ninjas')) {
    statuses.push({ provider: 'ninjas', stage: 'skipped after playback failure', status: 'excluded' })
  } else if (!result && ninjasKey) {
    const media = await fetchApiNinjasMedia(name, ninjasKey, statuses)
    if (media) result = { ...media, source: 'ninjas', mediaType: 'image' }
  } else if (!result) {
    statuses.push({ provider: 'ninjas', stage: 'exercise image lookup', status: 'not_configured' })
    console.log('[v0] /api/media API Ninjas not configured')
  }

  if (result) {
    console.log(`[v0] /api/media selected ${result.source}`)
    return addStatusesHeader(NextResponse.json<ExerciseMediaResponse>(result), statuses)
  }

  const anyConfigured = Boolean(muscleWikiKey || workoutXKey || exerciseDbKey || ninjasKey)
  const hasProviderFailure = statuses.some(({ status }) => status === 'network_error' || (typeof status === 'number' && (status < 200 || status >= 300)))
  const status = !anyConfigured ? 503 : hasProviderFailure ? 502 : 404
  const muscleWikiPlanBlocked = statuses.some(({ provider, status: providerStatus }) => provider === 'musclewiki' && providerStatus === 403)
  const message = status === 404
    ? 'No exercise animation is available for this movement.'
    : status === 503
      ? 'Exercise media is not configured right now.'
      : muscleWikiPlanBlocked
        ? 'MuscleWiki direct API access requires a TESTING plan or higher. Update the server-side API key to enable its exercise videos.'
        : 'Exercise media providers are temporarily unavailable.'
  return addStatusesHeader(NextResponse.json({ error: message }, { status }), statuses)
}
