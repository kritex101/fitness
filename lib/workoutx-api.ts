const WORKOUTX_BASE_URL = 'https://api.workoutxapp.com/v2'
const WORKOUTX_MEDIA_HOST = 'workoutx-media.workoutx-media-worker.workers.dev'

export type WorkoutXApiResult = {
  status: number | 'network_error'
  ok: boolean
  data: unknown
}

export type WorkoutXExercise = {
  id: string
  name: string
  target: string
  equipment: string
  instructions: string[]
}

export const workoutXTargets = [
  { value: 'abs', label: 'Abs' },
  { value: 'abductors', label: 'Abductors' },
  { value: 'adductors', label: 'Adductors' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'calves', label: 'Calves' },
  { value: 'delts', label: 'Shoulders' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'lats', label: 'Lats' },
  { value: 'pectorals', label: 'Chest' },
  { value: 'quads', label: 'Quads' },
  { value: 'traps', label: 'Traps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'upper back', label: 'Upper back' },
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(readString).filter((item): item is string => Boolean(item)).join(', ') || null
  if (!isRecord(value)) return null
  for (const key of ['group', 'name', 'target', 'label', 'text', 'instruction']) {
    const result = readString(value[key])
    if (result) return result
  }
  return null
}

export function getWorkoutXRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return []
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []

  for (const key of ['results', 'data', 'items', 'exercises']) {
    const nested = value[key]
    if (Array.isArray(nested)) return nested.filter(isRecord)
    if (isRecord(nested)) {
      const records = getWorkoutXRecords(nested, depth + 1)
      if (records.length) return records
    }
  }

  return typeof value.id === 'string' || typeof value.id === 'number' ? [value] : []
}

export function normalizeWorkoutXName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US')
}

export function findWorkoutXExerciseRecord(value: unknown, name: string) {
  const searchName = normalizeWorkoutXName(name)
  const records = getWorkoutXRecords(value)
  const namedRecords = records.flatMap((record) => {
    const exerciseName = readString(record.name ?? record.exercise_name ?? record.exerciseName ?? record.title)
    return exerciseName ? [{ record, normalizedName: normalizeWorkoutXName(exerciseName) }] : []
  })

  return namedRecords.find(({ normalizedName }) => normalizedName === searchName)?.record
    ?? namedRecords.find(({ normalizedName }) => normalizedName.startsWith(searchName) || searchName.startsWith(normalizedName))?.record
    ?? null
}

export function normalizeWorkoutXExercise(value: unknown): WorkoutXExercise | null {
  if (!isRecord(value)) return null
  const rawId = value.id ?? value.exercise_id ?? value.exerciseId ?? value.uuid
  const id = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : ''
  const name = readString(value.name ?? value.exercise_name ?? value.exerciseName ?? value.title) ?? ''
  const primaryMuscles = Array.isArray(value.primaryMuscles) ? value.primaryMuscles : []
  const primaryTarget = primaryMuscles.map(readString).find((target): target is string => Boolean(target))
  const target = readString(value.target) ?? readString(value.bodyPart) ?? primaryTarget ?? 'General'
  const equipment = readString(value.equipment) ?? readString(value.equipmentDetail) ?? readString(value.apparatus) ?? 'Not specified'
  const instructions = Array.isArray(value.instructions)
    ? value.instructions.map(readString).filter((instruction): instruction is string => Boolean(instruction)).slice(0, 20)
    : []

  if (!id || !name) return null
  return { id, name, target, equipment, instructions }
}

export function normalizeWorkoutXExercises(value: unknown): WorkoutXExercise[] {
  return getWorkoutXRecords(value)
    .map(normalizeWorkoutXExercise)
    .filter((exercise): exercise is WorkoutXExercise => Boolean(exercise))
}

export function safeWorkoutXPosterUrl(value: unknown) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    const trustedHost = url.hostname === WORKOUTX_MEDIA_HOST
      || url.hostname === 'workoutxapp.com'
      || url.hostname.endsWith('.workoutxapp.com')
    if (url.protocol !== 'https:' || !trustedHost || url.username || url.password) return null
    if (/\.(?:mp4|m4v|mov|webm|m3u8)(?:$|[?#])/i.test(url.pathname + url.search)) return null
    return url.toString()
  } catch {
    return null
  }
}

export function getWorkoutXPoster(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const poster = getWorkoutXPoster(item)
      if (poster) return poster
    }
    return null
  }
  if (!isRecord(value)) return null
  if (isRecord(value.media)) return safeWorkoutXPosterUrl(value.media.poster)
  if (typeof value.poster === 'string') return safeWorkoutXPosterUrl(value.poster)
  for (const key of ['data', 'results', 'items']) {
    const poster = getWorkoutXPoster(value[key])
    if (poster) return poster
  }
  return null
}

export async function fetchWorkoutXApi(path: string, params: URLSearchParams, apiKey: string): Promise<WorkoutXApiResult> {
  const url = new URL(path, WORKOUTX_BASE_URL)
  url.search = params.toString()

  try {
    const response = await fetch(url, {
      headers: { 'X-WorkoutX-Key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    return {
      status: response.status,
      ok: response.ok,
      data: await response.json().catch(() => null),
    }
  } catch {
    return { status: 'network_error', ok: false, data: null }
  }
}
