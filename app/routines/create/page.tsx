import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { CustomRoutineBuilder } from '@/components/custom-routine-builder'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessCustomRoutines, fitnessProfiles } from '@/lib/db/schema'
import { activePlanId, exerciseLibrary } from '@/lib/fitness-data'

export const metadata: Metadata = {
  title: 'Create a routine — FitPilot',
  description: 'Build and save a custom FitPilot workout routine from your exercise library.',
}

export default async function CreateRoutinePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const userId = session.user.id
  const [profile] = await db.select({ userId: fitnessProfiles.userId }).from(fitnessProfiles).where(eq(fitnessProfiles.userId, userId)).limit(1)
  if (!profile) redirect('/')

  const [routineRows, activePlanRows] = await Promise.all([
    db.select().from(fitnessCustomRoutines).where(eq(fitnessCustomRoutines.userId, userId)).orderBy(desc(fitnessCustomRoutines.updatedAt)),
    db.select().from(fitnessCustomRoutines).where(and(eq(fitnessCustomRoutines.id, activePlanId(userId)), eq(fitnessCustomRoutines.userId, userId))).limit(1),
  ])
  const activePlanRow = activePlanRows[0]
  const initialActivePlan = activePlanRow ? {
    id: activePlanRow.id,
    name: activePlanRow.name,
    exercises: activePlanRow.exercises,
    createdAt: activePlanRow.createdAt.toISOString(),
    updatedAt: activePlanRow.updatedAt.toISOString(),
  } : null
  const initialRoutines = routineRows.filter((routine) => routine.id !== activePlanId(userId)).map((routine) => ({
    id: routine.id,
    name: routine.name,
    exercises: routine.exercises,
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
  }))
  const exercises = exerciseLibrary.map(({ id, name, equipment, focus, areas, duration }) => ({ id, name, equipment, focus, areas, duration }))

  return <CustomRoutineBuilder initialRoutines={initialRoutines} initialActivePlan={initialActivePlan} exercises={exercises} />
}
