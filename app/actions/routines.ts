'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessCustomRoutines, workoutSessions } from '@/lib/db/schema'
import { activePlanId, exerciseLibrary, type CustomRoutine, type CustomRoutineExercise } from '@/lib/fitness-data'

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

function serializeRoutine(row: typeof fitnessCustomRoutines.$inferSelect): CustomRoutine {
  return {
    id: row.id,
    name: row.name,
    exercises: row.exercises,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function validateRoutine(input: unknown) {
  if (!input || typeof input !== 'object') throw new Error('Add a routine name and at least one exercise.')
  const candidate = input as Record<string, unknown>
  const id = candidate.id
  if (id !== undefined && (typeof id !== 'string' || id.length > 80)) throw new Error('This routine could not be identified.')
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
  if (!name || name.length > 80) throw new Error('Routine names must be between 1 and 80 characters.')
  if (!Array.isArray(candidate.exercises) || candidate.exercises.length < 1 || candidate.exercises.length > 30) {
    throw new Error('Choose between 1 and 30 exercises for your routine.')
  }

  const knownExerciseIds = new Set(exerciseLibrary.map((exercise) => exercise.id))
  const seenExerciseIds = new Set<string>()
  const exercises = candidate.exercises.map((value): CustomRoutineExercise => {
    if (!value || typeof value !== 'object') throw new Error('One of the selected exercises is invalid.')
    const exercise = value as Record<string, unknown>
    const exerciseId = exercise.exerciseId
    if (typeof exerciseId !== 'string' || !knownExerciseIds.has(exerciseId) || seenExerciseIds.has(exerciseId)) {
      throw new Error('Remove invalid or duplicate exercises and try again.')
    }
    if (!Number.isInteger(exercise.sets) || Number(exercise.sets) < 1 || Number(exercise.sets) > 10) {
      throw new Error('Each exercise must have between 1 and 10 sets.')
    }
    if (!Number.isInteger(exercise.reps) || Number(exercise.reps) < 1 || Number(exercise.reps) > 100) {
      throw new Error('Choose a rep target from 1 to 100 for each exercise.')
    }
    if (!Number.isInteger(exercise.restSeconds) || Number(exercise.restSeconds) < 15 || Number(exercise.restSeconds) > 600) {
      throw new Error('Rest periods must be between 15 seconds and 10 minutes.')
    }
    seenExerciseIds.add(exerciseId)
    return {
      exerciseId,
      sets: Number(exercise.sets),
      reps: Number(exercise.reps),
      restSeconds: Number(exercise.restSeconds),
    }
  })

  return { id: typeof id === 'string' ? id : undefined, name, exercises }
}

export async function saveCustomRoutine(input: unknown) {
  const userId = await getUserId()
  const validated = validateRoutine(input)
  const now = new Date()

  if (validated.id === activePlanId(userId)) {
    throw new Error('Use the active plan editor to change your workout plan.')
  }

  if (validated.id) {
    const [updated] = await db.update(fitnessCustomRoutines).set({
      name: validated.name,
      exercises: validated.exercises,
      updatedAt: now,
    }).where(and(eq(fitnessCustomRoutines.id, validated.id), eq(fitnessCustomRoutines.userId, userId))).returning()
    if (!updated) throw new Error('That routine was not found in your profile.')
    revalidatePath('/routines/create')
    return serializeRoutine(updated)
  }

  const [created] = await db.insert(fitnessCustomRoutines).values({
    id: randomUUID(),
    userId,
    name: validated.name,
    exercises: validated.exercises,
    createdAt: now,
    updatedAt: now,
  }).returning()
  revalidatePath('/routines/create')
  revalidatePath('/')
  return serializeRoutine(created)
}

export async function saveActiveWorkoutPlan(input: unknown) {
  const userId = await getUserId()
  const validated = validateRoutine(input)
  const [activeWorkout] = await db.select({ id: workoutSessions.id }).from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.status, 'in_progress'))).limit(1)
  if (activeWorkout) throw new Error('Finish your active workout before changing your plan.')

  const now = new Date()
  const [saved] = await db.insert(fitnessCustomRoutines).values({
    id: activePlanId(userId),
    userId,
    name: validated.name,
    exercises: validated.exercises,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: fitnessCustomRoutines.id,
    set: { name: validated.name, exercises: validated.exercises, updatedAt: now },
  }).returning()

  revalidatePath('/')
  revalidatePath('/routines/create')
  return serializeRoutine(saved)
}

export async function deleteCustomRoutine(id: string) {
  const userId = await getUserId()
  if (typeof id !== 'string' || id.length > 80) throw new Error('This routine could not be identified.')
  if (id === activePlanId(userId)) throw new Error('Your active workout plan cannot be deleted from saved routines.')
  const [deleted] = await db.delete(fitnessCustomRoutines).where(and(
    eq(fitnessCustomRoutines.id, id),
    eq(fitnessCustomRoutines.userId, userId),
  )).returning({ id: fitnessCustomRoutines.id })
  if (!deleted) throw new Error('That routine was not found in your profile.')
  revalidatePath('/routines/create')
  revalidatePath('/')
  return { success: true }
}
