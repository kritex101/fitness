import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { ActiveWorkoutState } from '@/app/actions/fitness'
import { TrainingRoute } from '@/components/training-route'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessCheckins, fitnessProfiles, workoutSessions, workoutSets } from '@/lib/db/schema'
import { buildWorkoutPlan, type FitnessProfile, type FitnessGoal, type GenderIdentity, type ExperienceLevel, type TrainingEnvironment } from '@/lib/fitness-data'

export const metadata: Metadata = {
  title: 'Training session | FitPilot',
  description: 'Follow your guided FitPilot workout on its own page.',
}

export default async function TrainingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const userId = session.user.id
  const [profileRow] = await db.select().from(fitnessProfiles).where(eq(fitnessProfiles.userId, userId)).limit(1)
  if (!profileRow) redirect('/')

  const profile: FitnessProfile = {
    userId,
    name: profileRow.name,
    age: profileRow.age,
    gender: profileRow.gender as GenderIdentity,
    weightKg: Number(profileRow.weightKg),
    heightCm: Number(profileRow.heightCm),
    goal: profileRow.goal as FitnessGoal,
    experience: profileRow.experience as ExperienceLevel,
    environment: profileRow.environment as TrainingEnvironment,
  }

  const [latestCheckin] = await db.select({ weightKg: fitnessCheckins.weightKg })
    .from(fitnessCheckins)
    .where(eq(fitnessCheckins.userId, userId))
    .orderBy(desc(fitnessCheckins.createdAt))
    .limit(1)
  const [activeSession] = await db.select().from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.status, 'in_progress')))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(1)

  let activeWorkout: ActiveWorkoutState | null = null
  if (activeSession) {
    const savedSets = await db.select().from(workoutSets)
      .where(and(eq(workoutSets.sessionId, activeSession.id), eq(workoutSets.userId, userId)))
      .orderBy(asc(workoutSets.setNumber))
    activeWorkout = {
      id: activeSession.id,
      sessionName: activeSession.sessionName,
      startedAt: activeSession.startedAt.toISOString(),
      exercises: buildWorkoutPlan(profile).map((exercise) => ({
        ...exercise,
        workoutSets: savedSets.filter((set) => set.exerciseId === exercise.id).map((set) => ({
          id: set.id,
          setNumber: set.setNumber,
          targetReps: set.targetReps,
          repsCompleted: set.actualReps,
          weightKg: set.weightKg === null ? null : Number(set.weightKg),
          completed: set.completed,
        })),
      })),
    }
  }

  return <TrainingRoute profile={profile} initialWeightKg={latestCheckin ? Number(latestCheckin.weightKg) : profile.weightKg} initialWorkout={activeWorkout} />
}
