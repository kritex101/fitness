import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import { FitnessOnboarding } from '@/components/fitness-onboarding'
import { FitPilotDashboard } from '@/components/fitpilot-dashboard'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessCheckins, fitnessMetricSnapshots, fitnessProfiles, workoutSessions, workoutSets } from '@/lib/db/schema'
import { buildWorkoutPlan, type ActivityLevel, type FitnessProfile, type GenderIdentity, type FitnessGoal, type ExperienceLevel, type MetricSnapshot, type TrainingEnvironment } from '@/lib/fitness-data'

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const userId = session.user.id
  const [profileRow] = await db.select().from(fitnessProfiles).where(eq(fitnessProfiles.userId, userId)).limit(1)
  if (!profileRow) return <FitnessOnboarding initialName={session.user.name ?? ''} />

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

  const [checkinRows, sessionRows, activeRow, metricRows] = await Promise.all([
    db.select().from(fitnessCheckins).where(eq(fitnessCheckins.userId, userId)).orderBy(desc(fitnessCheckins.createdAt)),
    db.select().from(workoutSessions).where(eq(workoutSessions.userId, userId)).orderBy(desc(workoutSessions.startedAt)),
    db.select().from(workoutSessions).where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.status, 'in_progress'))).orderBy(desc(workoutSessions.startedAt)).limit(1),
    db.select().from(fitnessMetricSnapshots).where(eq(fitnessMetricSnapshots.userId, userId)).orderBy(desc(fitnessMetricSnapshots.createdAt)).limit(90),
  ])

  let activeWorkout = null
  if (activeRow[0]) {
    const activeSession = activeRow[0]
    const savedSets = await db.select().from(workoutSets)
      .where(and(eq(workoutSets.sessionId, activeSession.id), eq(workoutSets.userId, userId)))
      .orderBy(asc(workoutSets.setNumber))
    const plan = buildWorkoutPlan(profile)
    activeWorkout = {
      id: activeSession.id,
      sessionName: activeSession.sessionName,
      startedAt: activeSession.startedAt.toISOString(),
      exercises: plan.map((exercise) => ({
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

  return <FitPilotDashboard
    profile={profile}
    checkins={checkinRows.map((row) => ({ id: row.id, weightKg: Number(row.weightKg), reflection: row.reflection, createdAt: row.createdAt.toISOString() }))}
    sessions={sessionRows.map((row) => ({ id: row.id, sessionName: row.sessionName, status: row.status, startedAt: row.startedAt.toISOString(), endedAt: row.endedAt?.toISOString() ?? null }))}
    metrics={metricRows.map((row): MetricSnapshot => ({
      id: row.id,
      weightKg: Number(row.weightKg),
      heightCm: Number(row.heightCm),
      age: row.age,
      gender: row.gender as GenderIdentity,
      activityLevel: row.activityLevel as ActivityLevel,
      bmi: Number(row.bmi),
      dailyCalorieTarget: row.dailyCalorieTarget,
      createdAt: row.createdAt.toISOString(),
    }))}
    activeWorkout={activeWorkout}
    email={session.user.email}
  />
}
