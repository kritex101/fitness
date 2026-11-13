
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exerciseLibrary } from '@/lib/fitness-data'
import { workoutXTargets } from '@/lib/workoutx-api'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 10
const MAX_OFFSET = 500

const targetAreas: Record<string, string[]> = {
  abs: ['core'],
  abductors: ['legs-glutes'],
  adductors: ['legs-glutes'],
  biceps: ['arms'],
  calves: ['legs-glutes'],
  delts: ['shoulders'],
  forearms: ['arms'],
  glutes: ['legs-glutes'],
  hamstrings: ['legs-glutes'],
  lats: ['back'],
  pectorals: ['chest'],
  quads: ['legs-glutes'],
  traps: ['back'],
  triceps: ['arms'],
  'upper back': ['back'],
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return NextResponse.json(
      { error: 'Sign in to browse the exercise library.' },
      { status: 401 }
    )
  }

  const searchParams = new URL(request.url).searchParams
  const name = searchParams.get('name')?.trim().replace(/\s+/g, ' ')
  const target = searchParams.get('target')?.trim().toLowerCase()
  const model = searchParams.get('model')

  const limit = Number.parseInt(searchParams.get('limit') ?? String(MAX_LIMIT), 10)
  const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10)

  if (name && (name.length < 2 || name.length > 80)) {
    return NextResponse.json(
      { error: 'Search with an exercise name between 2 and 80 characters.' },
      { status: 400 }
    )
  }

  if (name && target) {
    return NextResponse.json(
      { error: 'Search by an exercise name or target muscle, not both.' },
      { status: 400 }
    )
  }

  if (target && !workoutXTargets.some((option) => option.value === target)) {
    return NextResponse.json(
      { error: 'Choose a supported target muscle.' },
      { status: 400 }
    )
  }

  if (model !== 'male' && model !== 'female') {
    return NextResponse.json(
      { error: 'Choose a supported exercise model.' },
      { status: 400 }
    )
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `Limit must be between 1 and ${MAX_LIMIT}.` },
      { status: 400 }
    )
  }

  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    return NextResponse.json(
      { error: `Offset must be between 0 and ${MAX_OFFSET}.` },
      { status: 400 }
    )
  }

  let exercises = exerciseLibrary.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    target: exercise.focus,
    equipment: exercise.equipment,
    instructions: exercise.instructions,
    areas: exercise.areas,
  }))

  if (name) {
    const search = name.toLowerCase()
    exercises = exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(search)
    )
  }

  if (target) {
    const matchingAreas = targetAreas[target] ?? []
    exercises = exercises.filter((exercise) =>
      exercise.areas.some((area) => matchingAreas.includes(area))
    )
  }

  const total = exercises.length
  const paginatedExercises = exercises.slice(offset, offset + limit)

  return NextResponse.json(
    {
      exercises: paginatedExercises.map(({ areas, ...exercise }) => exercise),
      total,
    },
    {
      headers: { 'Cache-Control': 'private, no-store' },
    }
  )
}
