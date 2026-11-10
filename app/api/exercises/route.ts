import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exerciseDbTargets, type ExerciseDbExercise } from '@/lib/exercise-db-types'

const EXERCISE_DB_BASE_URL = 'https://exercisedb.p.rapidapi.com/exercises'
const MAX_LIMIT = 10
const MAX_OFFSET = 500

function normalizeExerciseResults(value: unknown): ExerciseDbExercise[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []

    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' || typeof record.id === 'number' ? String(record.id) : ''
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    const target = typeof record.target === 'string' ? record.target.trim() : ''
    const equipment = typeof record.equipment === 'string' ? record.equipment.trim() : ''
    const instructions = Array.isArray(record.instructions)
      ? record.instructions.filter((instruction): instruction is string => typeof instruction === 'string').map((instruction) => instruction.trim()).filter(Boolean).slice(0, 20)
      : []

    if (!id || !name || !target) return []
    return [{ id, name, target, equipment: equipment || 'Not specified', instructions }]
  })
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to browse the exercise library.' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const name = searchParams.get('name')?.trim().replace(/\s+/g, ' ')
  const target = searchParams.get('target')?.trim().toLowerCase()
  const limitValue = Number.parseInt(searchParams.get('limit') ?? String(MAX_LIMIT), 10)
  const offsetValue = Number.parseInt(searchParams.get('offset') ?? '0', 10)

  if (name && (name.length < 2 || name.length > 80)) {
    return NextResponse.json({ error: 'Search with an exercise name between 2 and 80 characters.' }, { status: 400 })
  }
  if (name && target) {
    return NextResponse.json({ error: 'Search by an exercise name or a target muscle, not both.' }, { status: 400 })
  }
  if (target && !exerciseDbTargets.some((option) => option.value === target)) {
    return NextResponse.json({ error: 'Choose a supported target muscle.' }, { status: 400 })
  }
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > MAX_LIMIT) {
    return NextResponse.json({ error: `Limit must be between 1 and ${MAX_LIMIT}.` }, { status: 400 })
  }
  if (!Number.isInteger(offsetValue) || offsetValue < 0 || offsetValue > MAX_OFFSET) {
    return NextResponse.json({ error: `Offset must be between 0 and ${MAX_OFFSET}.` }, { status: 400 })
  }

  const apiKey = process.env.RAPIDAPI_EXERCISE_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Exercise search is not configured right now.' }, { status: 503 })
  }

  const pagination = new URLSearchParams({ limit: String(limitValue), offset: String(offsetValue) })
  const endpoint = name
    ? `${EXERCISE_DB_BASE_URL}/name/${encodeURIComponent(name)}?${pagination}`
    : target
      ? `${EXERCISE_DB_BASE_URL}/target/${encodeURIComponent(target)}?${pagination}`
      : `${EXERCISE_DB_BASE_URL}?${pagination}`

  try {
    const response = await fetch(endpoint, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
      },
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'ExerciseDB is temporarily unavailable. Please try again.' }, { status: 502 })
    }

    const exercises = normalizeExerciseResults(await response.json())
    return NextResponse.json({ exercises }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'ExerciseDB is temporarily unavailable. Please try again.' }, { status: 502 })
  }
}
