import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchWorkoutXApi, normalizeWorkoutXExercises, workoutXTargets } from '@/lib/workoutx-api'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 10
const MAX_OFFSET = 500

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to browse the exercise library.' }, { status: 401 })
  }

  const searchParams = new URL(request.url).searchParams
  const name = searchParams.get('name')?.trim().replace(/\s+/g, ' ')
  const target = searchParams.get('target')?.trim().toLowerCase()
  const model = searchParams.get('model')
  const limitValue = Number.parseInt(searchParams.get('limit') ?? String(MAX_LIMIT), 10)
  const offsetValue = Number.parseInt(searchParams.get('offset') ?? '0', 10)

  if (name && (name.length < 2 || name.length > 80)) {
    return NextResponse.json({ error: 'Search with an exercise name between 2 and 80 characters.' }, { status: 400 })
  }
  if (name && target) {
    return NextResponse.json({ error: 'Search by an exercise name or a target muscle, not both.' }, { status: 400 })
  }
  if (target && !workoutXTargets.some((option) => option.value === target)) {
    return NextResponse.json({ error: 'Choose a supported target muscle.' }, { status: 400 })
  }
  if (model !== 'male' && model !== 'female') {
    return NextResponse.json({ error: 'Choose a supported exercise model.' }, { status: 400 })
  }
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > MAX_LIMIT) {
    return NextResponse.json({ error: `Limit must be between 1 and ${MAX_LIMIT}.` }, { status: 400 })
  }
  if (!Number.isInteger(offsetValue) || offsetValue < 0 || offsetValue > MAX_OFFSET) {
    return NextResponse.json({ error: `Offset must be between 0 and ${MAX_OFFSET}.` }, { status: 400 })
  }

  const apiKey = process.env.WORKOUTX_API_KEY?.trim() ?? process.env.WORKOUTX_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'WorkoutX exercise access is not configured right now.' }, { status: 503 })
  }

  const params = new URLSearchParams({ model, limit: String(limitValue), offset: String(offsetValue), media: 'false' })
  if (name) params.set('name', name)
  if (target) params.set('target', target)

  const result = await fetchWorkoutXApi('/exercises', params, apiKey)
  if (!result.ok) {
    const status = result.status === 429 ? 503 : 502
    const message = result.status === 401 || result.status === 403
      ? 'WorkoutX rejected the server API key. Check its access in project settings.'
      : result.status === 429
        ? 'WorkoutX is rate-limiting exercise searches. Try again shortly.'
        : 'WorkoutX is temporarily unavailable. Please try again.'
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } })
  }

  const exercises = normalizeWorkoutXExercises(result.data)
  const total = typeof result.data === 'object' && result.data !== null && 'total' in result.data && typeof result.data.total === 'number'
    ? result.data.total
    : exercises.length

  return NextResponse.json({ exercises, total }, { headers: { 'Cache-Control': 'private, no-store' } })
}
