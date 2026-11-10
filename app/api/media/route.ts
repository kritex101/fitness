import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { ExerciseMediaResponse, ExerciseMediaSource } from '@/lib/exercise-media-types'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

const MUSCLEWIKI_BASE_URL = 'https://api.musclewiki.com'
const WORKOUTX_BASE_URL = 'https://api.workoutxapp.com/v2'
const EXERCISEDB_BASE_URL = 'https://exercisedb.p.rapidapi.com'

type ProviderStatus = {
  provider: ExerciseMediaSource
  stage: string
  status: number | 'network_error' | 'not_configured'
}

type ProviderResponse = {
  videoUrl: string
  source: ExerciseMediaSource
}

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

function findExactExercise(records: Record<string, unknown>[], name: string) {
  return records.find((record) => {
    const recordName = [record.name, record.exercise_name, record.exerciseName, record.title]
      .find((candidate) => typeof candidate === 'string')
    return typeof recordName === 'string' && normalizeExerciseName(recordName) === name
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

function matchesGender(record: Record<string, unknown>, gender: ExerciseVisualGender) {
  const value = record.gender ?? record.model ?? record.visual_gender
  return typeof value !== 'string' || value.toLowerCase() === gender
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
    const response = await fetch(url, { headers: apiHeaders, cache: 'no-store' })
    statuses.push({ provider, stage, status: response.status })
    console.log(`[v0] /api/media ${provider} ${stage} HTTP ${response.status}`)
    return response
  } catch {
    statuses.push({ provider, stage, status: 'network_error' })
    console.log(`[v0] /api/media ${provider} ${stage} network error`)
    return null
  }
}

async function fetchMuscleWikiMedia(name: string, gender: ExerciseVisualGender, apiKey: string, statuses: ProviderStatus[]): Promise<string | null> {
  const searchUrl = new URL('/exercises', MUSCLEWIKI_BASE_URL)
  searchUrl.search = new URLSearchParams({ search: name, gender, limit: '20' }).toString()
  const searchResponse = await fetchProvider('musclewiki', 'exercise search', searchUrl, { 'X-API-Key': apiKey }, statuses)
  if (!searchResponse?.ok) return null

  const exercise = findExactExercise(getRecords(await readJson(searchResponse)), name)
  const exerciseId = exercise ? getRecordId(exercise) : null
  if (!exerciseId) return null

  const videosUrl = new URL(`/exercises/${encodeURIComponent(exerciseId)}/videos`, MUSCLEWIKI_BASE_URL)
  videosUrl.search = new URLSearchParams({ gender }).toString()
  const videosResponse = await fetchProvider('musclewiki', 'video lookup', videosUrl, { 'X-API-Key': apiKey }, statuses)
  if (!videosResponse?.ok) return null

  for (const video of getRecords(await readJson(videosResponse))) {
    if (!matchesGender(video, gender)) continue
    const media = findMediaCandidate(video)
    if (media) return media.url
  }
  return null
}

async function fetchWorkoutXMedia(name: string, gender: ExerciseVisualGender, apiKey: string, statuses: ProviderStatus[]): Promise<string | null> {
  const searchUrl = new URL('/exercises', WORKOUTX_BASE_URL)
  searchUrl.search = new URLSearchParams({ name, model: gender, gender, limit: '10', media: 'false', lang: 'en' }).toString()
  const searchResponse = await fetchProvider('workoutx', 'exercise search', searchUrl, { 'X-WorkoutX-Key': apiKey }, statuses)
  if (!searchResponse?.ok) return null

  const exercise = findExactExercise(getRecords(await readJson(searchResponse)), name)
  const exerciseId = exercise ? getRecordId(exercise) : null
  if (!exercise || !exerciseId || !matchesGender(exercise, gender)) return null

  const mediaUrl = new URL(`/exercises/${encodeURIComponent(exerciseId)}/media`, WORKOUTX_BASE_URL)
  mediaUrl.search = new URLSearchParams({ model: gender, gender }).toString()
  const mediaResponse = await fetchProvider('workoutx', 'media lookup', mediaUrl, { 'X-WorkoutX-Key': apiKey }, statuses)
  if (!mediaResponse?.ok) return null

  for (const record of getRecords(await readJson(mediaResponse))) {
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
  const gender = searchParams.get('gender')
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Enter an exercise name between 2 and 80 characters.' }, { status: 400 })
  }
  if (gender !== 'male' && gender !== 'female') {
    return NextResponse.json({ error: 'Choose male or female exercise visuals.' }, { status: 400 })
  }

  const muscleWikiKey = process.env.MUSCLEWIKI_API_KEY
  const workoutXKey = process.env.WORKOUTX_API_KEY ?? process.env.WORKOUTX_KEY
  const exerciseDbKey = process.env.RAPIDAPI_EXERCISE_KEY
  const statuses: ProviderStatus[] = []
  let result: ProviderResponse | null = null

  if (muscleWikiKey) {
    const videoUrl = await fetchMuscleWikiMedia(name, gender as ExerciseVisualGender, muscleWikiKey, statuses)
    if (videoUrl) result = { videoUrl, source: 'musclewiki' }
  } else {
    statuses.push({ provider: 'musclewiki', stage: 'exercise search', status: 'not_configured' })
    console.log('[v0] /api/media MuscleWiki not configured')
  }

  if (!result && workoutXKey) {
    const videoUrl = await fetchWorkoutXMedia(name, gender as ExerciseVisualGender, workoutXKey, statuses)
    if (videoUrl) result = { videoUrl, source: 'workoutx' }
  } else if (!result) {
    statuses.push({ provider: 'workoutx', stage: 'exercise search', status: 'not_configured' })
    console.log('[v0] /api/media WorkoutX not configured')
  }

  if (!result && exerciseDbKey) {
    const videoUrl = await fetchExerciseDbMedia(name, exerciseDbKey, statuses)
    if (videoUrl) result = { videoUrl, source: 'exercisedb' }
  } else if (!result) {
    statuses.push({ provider: 'exercisedb', stage: 'GIF lookup', status: 'not_configured' })
    console.log('[v0] /api/media ExerciseDB not configured')
  }

  if (result) {
    console.log(`[v0] /api/media selected ${result.source}`)
    return addStatusesHeader(NextResponse.json<ExerciseMediaResponse>(result), statuses)
  }

  const anyConfigured = Boolean(muscleWikiKey || workoutXKey || exerciseDbKey)
  const hasProviderFailure = statuses.some(({ status }) => status === 'network_error' || (typeof status === 'number' && (status < 200 || status >= 300)))
  const status = !anyConfigured ? 503 : hasProviderFailure ? 502 : 404
  const message = status === 404
    ? 'No video or animation was found for this exercise.'
    : status === 503
      ? 'Exercise media is not configured right now.'
      : 'Exercise media providers are temporarily unavailable.'
  return addStatusesHeader(NextResponse.json({ error: message }, { status }), statuses)
}
