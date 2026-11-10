import { createHash } from 'node:crypto'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

const MUSCLEWIKI_BASE_URL = 'https://api.musclewiki.com'

type StatusCode = number | 'network_error'

export type MuscleWikiProviderStatus = {
  provider: 'musclewiki'
  stage: string
  status: StatusCode | 'not_configured' | 'excluded'
}

export type MuscleWikiVideo = {
  url: string
  posterUrl: string | null
  gender: ExerciseVisualGender
  angle: 'front' | 'side'
}

export type MuscleWikiExercise = {
  id: number
  name: string
  instructions: string[]
  videos: MuscleWikiVideo[]
}

type JsonResult = {
  status: StatusCode
  ok: boolean
  data: unknown
}

type MediaTokenResult = {
  token: string | null
  expiresIn: number
  status: StatusCode
}

type CachedMediaToken = {
  token: string
  refreshAt: number
  keyFingerprint: string
}

let cachedMediaToken: CachedMediaToken | null = null
let pendingMediaToken: { keyFingerprint: string; promise: Promise<MediaTokenResult> } | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function recordsFrom(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []

  for (const key of ['results', 'data', 'items', 'exercises', 'videos', 'media']) {
    const nested = value[key]
    if (Array.isArray(nested)) return nested.filter(isRecord)
    if (isRecord(nested)) {
      const records = recordsFrom(nested)
      if (records.length) return records
    }
  }

  return [value]
}

function normalizeToken(value: string) {
  const token = value.toLocaleLowerCase('en-US')
  if (token === 'ups') return 'up'
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.length > 4 && /(?:ches|shes|xes|zes|sses)$/.test(token)) return token.slice(0, -2)
  if (token.length > 2 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  return token
}

function normalizeExerciseName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeToken)
    .join(' ')
}

function safeStreamUrl(value: unknown, kind: 'video' | 'poster') {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value)
    const expectedPath = kind === 'video' ? '/stream/videos/branded/' : '/stream/images/og_images/'
    if (url.origin !== MUSCLEWIKI_BASE_URL || !url.pathname.startsWith(expectedPath)) return null
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function parseVideos(value: unknown, gender: ExerciseVisualGender): MuscleWikiVideo[] {
  return recordsFrom(value).flatMap((record) => {
    const recordGender = typeof record.gender === 'string' ? record.gender.toLowerCase() : ''
    if (recordGender !== gender) return []

    const angle = typeof record.angle === 'string' ? record.angle.toLowerCase() : ''
    if (angle !== 'front' && angle !== 'side') return []

    const url = safeStreamUrl(record.url ?? record.video_url ?? record.videoUrl, 'video')
    if (!url) return []

    return [{
      url,
      posterUrl: safeStreamUrl(record.og_image ?? record.ogImage ?? record.poster_url ?? record.posterUrl, 'poster'),
      gender,
      angle,
    }]
  })
}

function exerciseIdFrom(record: Record<string, unknown>) {
  const rawId = record.id ?? record.exercise_id ?? record.exerciseId
  const id = typeof rawId === 'number' ? rawId : typeof rawId === 'string' ? Number(rawId) : NaN
  return Number.isSafeInteger(id) && id >= 0 ? id : null
}

function chooseExercise(records: Record<string, unknown>[], name: string) {
  const expectedName = normalizeExerciseName(name)
  return records.find((record) => {
    const candidateName = [record.name, record.exercise_name, record.exerciseName, record.title]
      .find((candidate) => typeof candidate === 'string')
    return typeof candidateName === 'string' && normalizeExerciseName(candidateName) === expectedName
  }) ?? null
}

function unwrapExercise(value: unknown) {
  if (!isRecord(value)) return null
  if (isRecord(value.exercise)) return value.exercise
  if (isRecord(value.data)) return value.data
  return value
}

async function fetchJson(
  url: URL,
  apiKey: string,
  stage: string,
  recordStatus: (status: MuscleWikiProviderStatus) => void,
  method: 'GET' | 'POST' = 'GET',
): Promise<JsonResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    recordStatus({ provider: 'musclewiki', stage, status: response.status })
    console.log(`[v0] MuscleWiki ${stage} HTTP ${response.status}`)
    return { status: response.status, ok: response.ok, data: await response.json().catch(() => null) }
  } catch {
    recordStatus({ provider: 'musclewiki', stage, status: 'network_error' })
    console.log(`[v0] MuscleWiki ${stage} network error`)
    return { status: 'network_error', ok: false, data: null }
  }
}

export async function getMuscleWikiExerciseByName(
  name: string,
  gender: ExerciseVisualGender,
  apiKey: string,
  recordStatus: (status: MuscleWikiProviderStatus) => void,
): Promise<MuscleWikiExercise | null> {
  const searchUrl = new URL('/exercises', MUSCLEWIKI_BASE_URL)
  searchUrl.search = new URLSearchParams({ search: name, gender, limit: '100' }).toString()
  const searchResult = await fetchJson(searchUrl, apiKey, 'exercise search', recordStatus)
  if (!searchResult.ok) return null

  const listRecord = chooseExercise(recordsFrom(searchResult.data), name)
  const id = listRecord ? exerciseIdFrom(listRecord) : null
  if (!listRecord || id === null) return null

  const detailUrl = new URL(`/exercises/${id}`, MUSCLEWIKI_BASE_URL)
  detailUrl.searchParams.set('gender', gender)
  const detailResult = await fetchJson(detailUrl, apiKey, 'exercise details', recordStatus)
  if (!detailResult.ok) return null

  const details = unwrapExercise(detailResult.data)
  if (!details) return null
  const detailId = exerciseIdFrom(details)
  const exerciseName = typeof details.name === 'string' ? details.name : typeof listRecord.name === 'string' ? listRecord.name : name
  if (detailId !== null && detailId !== id) return null

  let videos = parseVideos(details.videos, gender)
  if (!videos.length) {
    const videosUrl = new URL(`/exercises/${id}/videos`, MUSCLEWIKI_BASE_URL)
    videosUrl.searchParams.set('gender', gender)
    videos = parseVideos((await fetchJson(videosUrl, apiKey, 'video lookup', recordStatus)).data, gender)
  }

  const instructions = Array.isArray(details.steps)
    ? details.steps.filter((step): step is string => typeof step === 'string' && step.trim().length > 0)
    : []

  return { id, name: exerciseName, instructions, videos }
}

export async function getMuscleWikiVideoForVariant(
  exerciseId: number,
  gender: ExerciseVisualGender,
  angle: 'front' | 'side',
  apiKey: string,
  recordStatus: (status: MuscleWikiProviderStatus) => void,
): Promise<MuscleWikiVideo | null> {
  const videosUrl = new URL(`/exercises/${exerciseId}/videos`, MUSCLEWIKI_BASE_URL)
  videosUrl.searchParams.set('gender', gender)
  const result = await fetchJson(videosUrl, apiKey, 'proxy video lookup', recordStatus)
  if (!result.ok) return null
  return parseVideos(result.data, gender).find((video) => video.angle === angle) ?? null
}

async function requestMediaToken(apiKey: string): Promise<MediaTokenResult> {
  try {
    const response = await fetch(new URL('/media/token', MUSCLEWIKI_BASE_URL), {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || !isRecord(data) || typeof data.token !== 'string' || !data.token || typeof data.expires_in !== 'number' || data.expires_in <= 0) {
      return { token: null, expiresIn: 0, status: response.status }
    }
    return { token: data.token, expiresIn: data.expires_in, status: response.status }
  } catch {
    return { token: null, expiresIn: 0, status: 'network_error' }
  }
}

export async function getMuscleWikiMediaToken(apiKey: string, recordStatus: (status: MuscleWikiProviderStatus) => void, forceRefresh = false) {
  const keyFingerprint = createHash('sha256').update(apiKey).digest('hex')
  const now = Date.now()

  if (!forceRefresh && cachedMediaToken?.keyFingerprint === keyFingerprint && cachedMediaToken.refreshAt > now) {
    recordStatus({ provider: 'musclewiki', stage: 'media token cache', status: 200 })
    return { token: cachedMediaToken.token, status: 200 as const }
  }

  let request = pendingMediaToken?.keyFingerprint === keyFingerprint ? pendingMediaToken.promise : null
  if (!request) {
    request = requestMediaToken(apiKey)
    pendingMediaToken = { keyFingerprint, promise: request }
  }

  const result = await request
  recordStatus({ provider: 'musclewiki', stage: 'media token', status: result.status })
  if (result.token) {
    const lifetimeMs = result.expiresIn * 1_000
    const refreshBufferMs = Math.min(60_000, lifetimeMs * 0.2)
    cachedMediaToken = {
      token: result.token,
      refreshAt: Date.now() + lifetimeMs - refreshBufferMs,
      keyFingerprint,
    }
  }
  if (pendingMediaToken?.promise === request) pendingMediaToken = null
  return { token: result.token, status: result.status }
}

export function addMuscleWikiToken(url: string, token: string) {
  const authenticatedUrl = new URL(url)
  authenticatedUrl.searchParams.set('token', token)
  return authenticatedUrl.toString()
}

export function createMuscleWikiProxyUrl(exerciseId: number, gender: ExerciseVisualGender, angle: 'front' | 'side', kind: 'video' | 'poster') {
  const params = new URLSearchParams({ exerciseId: String(exerciseId), gender, angle, kind })
  return `/api/media/stream?${params.toString()}`
}

export function selectMuscleWikiVideo(videos: MuscleWikiVideo[]) {
  return videos.find((video) => video.angle === 'front') ?? videos.find((video) => video.angle === 'side') ?? null
}
