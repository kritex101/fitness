export type WorkoutHistoryRecord = {
  id: string
  sessionName: string
  status: 'completed'
  startedAt: string
  endedAt: string
  exerciseCount: number
  setCount: number
  durationSeconds: number
}

const WORKOUT_HISTORY_KEY = 'fitpilot:workout-history:v1'
const MAX_HISTORY_RECORDS = 250

function isWorkoutHistoryRecord(value: unknown): value is WorkoutHistoryRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string'
    && typeof record.sessionName === 'string'
    && record.status === 'completed'
    && typeof record.startedAt === 'string'
    && Number.isFinite(Date.parse(record.startedAt))
    && typeof record.endedAt === 'string'
    && Number.isFinite(Date.parse(record.endedAt))
    && Number.isInteger(record.exerciseCount)
    && Number.isInteger(record.setCount)
    && Number.isInteger(record.durationSeconds)
}

export function readWorkoutHistory(): WorkoutHistoryRecord[] {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(WORKOUT_HISTORY_KEY)
    if (!storedValue) return []
    const parsedValue: unknown = JSON.parse(storedValue)
    if (!Array.isArray(parsedValue)) return []
    return parsedValue.filter(isWorkoutHistoryRecord).slice(0, MAX_HISTORY_RECORDS)
  } catch {
    return []
  }
}

export function saveWorkoutHistory(record: WorkoutHistoryRecord) {
  if (typeof window === 'undefined') return false

  try {
    const records = readWorkoutHistory().filter((existing) => existing.id !== record.id)
    window.localStorage.setItem(WORKOUT_HISTORY_KEY, JSON.stringify([record, ...records].slice(0, MAX_HISTORY_RECORDS)))
    return true
  } catch {
    return false
  }
}
