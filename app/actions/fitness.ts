'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, asc, count, desc, eq, gte, like, lt, or } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessCheckins, fitnessMetricSnapshots, fitnessProfiles, workoutSessions, workoutSets } from '@/lib/db/schema'
import { activityLevels, buildWorkoutPlan, calculateBodyMetrics, genderOptions, goals, experienceLevels, nextExperienceLevel, trainingEnvironments, weeklySessionTarget, type ActivityLevel, type FitnessGoal, type GenderIdentity, type ExperienceLevel, type MetricSnapshot, type TrainingEnvironment } from '@/lib/fitness-data'

export type OnboardingInput = {
  name: string
  age: number
  gender: GenderIdentity
  weightKg: number
  heightCm: number
  goal: FitnessGoal
  experience: ExperienceLevel
  environment: TrainingEnvironment
}

export type WorkoutSetState = {
  id: string
  setNumber: number
  targetReps: number
  repsCompleted: number | null
  weightKg: number | null
  completed: boolean
}

export type ActiveWorkoutState = {
  id: string
  sessionName: string
  startedAt: string
  exercises: Array<ReturnType<typeof buildWorkoutPlan>[number] & { workoutSets: WorkoutSetState[] }>
}

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

function isValidNumber(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max
}

export async function saveOnboarding(input: OnboardingInput) {
  const userId = await getUserId()
  if (!input || typeof input !== 'object') throw new Error('Invalid profile details.')
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name.length < 1 || name.length > 80) throw new Error('Enter a name between 1 and 80 characters.')
  if (!Number.isInteger(input.age) || input.age < 18 || input.age > 100) throw new Error('FitPilot uses adult guidance and is for people aged 18 and older.')
  if (!isValidNumber(input.weightKg, 20, 500)) throw new Error('Enter a weight between 20 and 500 kg.')
  if (!isValidNumber(input.heightCm, 90, 250)) throw new Error('Enter a height between 90 and 250 cm.')
  if (!genderOptions.some((option) => option.value === input.gender)) throw new Error('Choose a gender option to continue.')
  if (!goals.some((option) => option.value === input.goal)) throw new Error('Choose a training goal to continue.')
  if (!experienceLevels.some((option) => option.value === input.experience)) throw new Error('Choose an experience level to continue.')
  if (!trainingEnvironments.some((option) => option.value === input.environment)) throw new Error('Choose a training environment to continue.')

  const [existingProfile] = await db.select({ userId: fitnessProfiles.userId }).from(fitnessProfiles).where(eq(fitnessProfiles.userId, userId)).limit(1)
  if (existingProfile) throw new Error('Your profile is already set up. Refresh the page to continue.')

  const checkinId = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(fitnessProfiles).values({
      userId,
      name,
      age: input.age,
      gender: input.gender,
      weightKg: input.weightKg.toFixed(2),
      heightCm: input.heightCm.toFixed(2),
      goal: input.goal,
      experience: input.experience,
      environment: input.environment,
    })
    await tx.insert(fitnessCheckins).values({
      id: checkinId,
      userId,
      sessionId: null,
      weightKg: input.weightKg.toFixed(2),
      reflection: 'Starting point entered during onboarding.',
    })
  })

  revalidatePath('/')
  return { success: true }
}

export async function startWorkout(input: { weightKg: number; reflection: string }): Promise<ActiveWorkoutState> {
  const userId = await getUserId()
  if (!input || typeof input !== 'object') throw new Error('Invalid check-in details.')
  if (!isValidNumber(input.weightKg, 20, 500)) throw new Error('Enter a valid weight in kilograms before starting.')
  const reflection = typeof input.reflection === 'string' ? input.reflection.trim() : ''
  if (reflection.length < 3 || reflection.length > 1000) throw new Error('Add a short progress reflection before starting.')

  const [profileRow] = await db.select().from(fitnessProfiles).where(eq(fitnessProfiles.userId, userId)).limit(1)
  if (!profileRow) throw new Error('Complete your profile before starting a workout.')

  const [unfinished] = await db.select({ id: workoutSessions.id }).from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.status, 'in_progress')))
    .orderBy(desc(workoutSessions.startedAt)).limit(1)
  if (unfinished) throw new Error('Finish or resume your active session before starting another.')

  const profile = {
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
  const startedAt = new Date()
  const weekStart = new Date(startedAt)
  weekStart.setUTCHours(0, 0, 0, 0)
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
  const nextWeekStart = new Date(weekStart)
  nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7)
  const [weeklyCount] = await db.select({ total: count() }).from(workoutSessions).where(and(
    eq(workoutSessions.userId, userId),
    eq(workoutSessions.status, 'completed'),
    gte(workoutSessions.startedAt, weekStart),
    lt(workoutSessions.startedAt, nextWeekStart),
  ))
  const workoutIndex = Number(weeklyCount?.total ?? 0)
  const plan = buildWorkoutPlan(profile, workoutIndex)
  const sessionId = randomUUID()
  const sessionName = `Full-body strength ${String.fromCharCode(65 + (workoutIndex % 3))}`
  const planned = plan.map((exercise) => ({
    ...exercise,
    workoutSets: Array.from({ length: exercise.sets }, (_, index) => ({
      id: randomUUID(),
      setNumber: index + 1,
      targetReps: exercise.repMax,
      repsCompleted: null,
      weightKg: null,
      completed: false,
    })),
  }))

  await db.transaction(async (tx) => {
    await tx.insert(fitnessCheckins).values({
      id: randomUUID(),
      userId,
      sessionId,
      weightKg: input.weightKg.toFixed(2),
      reflection,
    })
    await tx.insert(workoutSessions).values({
      id: sessionId,
      userId,
      programKey: `${profile.goal}:${profile.environment}:${profile.experience}:full-body`,
      sessionName,
      status: 'in_progress',
      startedAt,
    })
    const setRows = planned.flatMap((exercise) => exercise.workoutSets.map((workoutSet) => ({
      id: workoutSet.id,
      userId,
      sessionId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: workoutSet.setNumber,
      targetReps: workoutSet.targetReps,
      completed: false,
    })))
    await tx.insert(workoutSets).values(setRows)
  })

  revalidatePath('/')
  return { id: sessionId, sessionName, startedAt: startedAt.toISOString(), exercises: planned }
}

export async function updateWorkoutSet(input: {
  sessionId: string
  setId: string
  completed: boolean
  repsCompleted: number | null
  weightKg: number | null
}) {
  const userId = await getUserId()
  if (!input || typeof input !== 'object') throw new Error('Invalid workout set.')
  if (typeof input.sessionId !== 'string' || input.sessionId.length > 80 || typeof input.setId !== 'string' || input.setId.length > 80) throw new Error('Invalid workout set.')
  if (typeof input.completed !== 'boolean') throw new Error('Invalid set status.')
  if (input.repsCompleted !== null && (!Number.isInteger(input.repsCompleted) || input.repsCompleted < 0 || input.repsCompleted > 100)) throw new Error('Enter reps from 0 to 100.')
  if (input.weightKg !== null && !isValidNumber(input.weightKg, 0, 500)) throw new Error('Enter a valid load in kilograms.')
  if (input.completed && (!input.repsCompleted || input.repsCompleted < 1)) throw new Error('Record at least one rep before checking off a set.')

  const [active] = await db.select({ id: workoutSessions.id }).from(workoutSessions)
    .where(and(eq(workoutSessions.id, input.sessionId), eq(workoutSessions.userId, userId), eq(workoutSessions.status, 'in_progress')))
    .limit(1)
  if (!active) throw new Error('This workout is no longer active.')

  await db.update(workoutSets).set({
    completed: input.completed,
    actualReps: input.repsCompleted,
    weightKg: input.weightKg === null ? null : input.weightKg.toFixed(2),
    updatedAt: new Date(),
  }).where(and(eq(workoutSets.id, input.setId), eq(workoutSets.sessionId, input.sessionId), eq(workoutSets.userId, userId)))

  revalidatePath('/')
  return { success: true }
}

export async function completeWorkout(sessionId: string) {
  const userId = await getUserId()
  if (typeof sessionId !== 'string' || sessionId.length > 80) throw new Error('Invalid workout session.')
  const [unfinished] = await db.select({ total: count() }).from(workoutSets)
    .where(and(eq(workoutSets.userId, userId), eq(workoutSets.sessionId, sessionId), eq(workoutSets.completed, false)))
  if (Number(unfinished?.total ?? 0) > 0) throw new Error('Check off each set before completing the workout.')

  const progression = await db.transaction(async (tx) => {
    const [profile] = await tx.select({ experience: fitnessProfiles.experience, goal: fitnessProfiles.goal, environment: fitnessProfiles.environment })
      .from(fitnessProfiles).where(eq(fitnessProfiles.userId, userId)).limit(1)
    if (!profile || !experienceLevels.some((level) => level.value === profile.experience)) throw new Error('Your training profile could not be found.')

    const experience = profile.experience as ExperienceLevel
    const completedAt = new Date()
    const weekStart = new Date(Date.UTC(completedAt.getUTCFullYear(), completedAt.getUTCMonth(), completedAt.getUTCDate()))
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
    const nextWeekStart = new Date(weekStart)
    nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7)
    const legacyProgramKey = `${profile.goal}:${profile.environment}:full-body`
    const levelProgramKey = or(
      like(workoutSessions.programKey, `%:${experience}:full-body`),
      eq(workoutSessions.programKey, legacyProgramKey),
    )

    const [session] = await tx.update(workoutSessions).set({ status: 'completed', endedAt: completedAt })
      .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId), eq(workoutSessions.status, 'in_progress')))
      .returning({ id: workoutSessions.id })
    if (!session) throw new Error('This workout is no longer active.')

    const [weeklyCount] = await tx.select({ total: count() }).from(workoutSessions).where(and(
      eq(workoutSessions.userId, userId),
      eq(workoutSessions.status, 'completed'),
      gte(workoutSessions.startedAt, weekStart),
      lt(workoutSessions.startedAt, nextWeekStart),
      levelProgramKey,
    ))
    const sessionsCompletedThisWeek = Number(weeklyCount?.total ?? 0)
    const weeklyTarget = weeklySessionTarget(experience)
    const nextLevel = nextExperienceLevel(experience)
    let alreadyAdvancedThisWeek = false
    if (experience === 'pro') {
      const [previousLevelCount] = await tx.select({ total: count() }).from(workoutSessions).where(and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.status, 'completed'),
        gte(workoutSessions.startedAt, weekStart),
        lt(workoutSessions.startedAt, nextWeekStart),
        like(workoutSessions.programKey, '%:beginner:full-body'),
      ))
      alreadyAdvancedThisWeek = Number(previousLevelCount?.total ?? 0) > 0
    }
    let advancedTo: ExperienceLevel | null = null

    if (nextLevel && !alreadyAdvancedThisWeek && sessionsCompletedThisWeek >= weeklyTarget) {
      const [updatedProfile] = await tx.update(fitnessProfiles)
        .set({ experience: nextLevel, updatedAt: completedAt })
        .where(and(eq(fitnessProfiles.userId, userId), eq(fitnessProfiles.experience, experience)))
        .returning({ userId: fitnessProfiles.userId })

      if (updatedProfile) {
        advancedTo = nextLevel
        await tx.update(workoutSessions).set({ programKey: `${profile.goal}:${profile.environment}:${experience}:full-body` })
          .where(and(
            eq(workoutSessions.userId, userId),
            eq(workoutSessions.status, 'completed'),
            gte(workoutSessions.startedAt, weekStart),
            lt(workoutSessions.startedAt, nextWeekStart),
            eq(workoutSessions.programKey, legacyProgramKey),
          ))
      }
    }

    return { advancedTo, alreadyAdvancedThisWeek, sessionsCompletedThisWeek, weeklyTarget }
  })

  revalidatePath('/')
  return { success: true, ...progression }
}

export async function getRecentWorkoutSets(sessionId: string) {
  const userId = await getUserId()
  return db.select().from(workoutSets)
    .where(and(eq(workoutSets.sessionId, sessionId), eq(workoutSets.userId, userId)))
    .orderBy(asc(workoutSets.setNumber))
}

export async function saveBodyMetrics(input: {
  weightKg: number
  heightCm: number
  age: number
  gender: GenderIdentity
  activityLevel: ActivityLevel
}): Promise<MetricSnapshot> {
  const userId = await getUserId()
  if (!input || typeof input !== 'object') throw new Error('Enter your body metrics to continue.')
  if (!isValidNumber(input.weightKg, 20, 500)) throw new Error('Enter a weight between 20 and 500 kg.')
  if (!isValidNumber(input.heightCm, 90, 250)) throw new Error('Enter a height between 90 and 250 cm.')
  if (!Number.isInteger(input.age) || input.age < 18 || input.age > 100) throw new Error('Enter an age between 18 and 100.')
  if (!genderOptions.some((option) => option.value === input.gender)) throw new Error('Choose a gender option.')
  if (!activityLevels.some((option) => option.value === input.activityLevel)) throw new Error('Choose an activity level.')

  const [profile] = await db.select({ goal: fitnessProfiles.goal }).from(fitnessProfiles)
    .where(eq(fitnessProfiles.userId, userId)).limit(1)
  if (!profile || !goals.some((option) => option.value === profile.goal)) throw new Error('Complete your profile before saving body metrics.')

  const calculated = calculateBodyMetrics(input, profile.goal as FitnessGoal)
  const createdAt = new Date()
  const id = randomUUID()
  const snapshot: MetricSnapshot = {
    id,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    age: input.age,
    gender: input.gender,
    activityLevel: input.activityLevel,
    bmi: calculated.bmi,
    dailyCalorieTarget: calculated.dailyCalorieTarget,
    createdAt: createdAt.toISOString(),
  }

  await db.transaction(async (tx) => {
    await tx.update(fitnessProfiles).set({
      age: input.age,
      gender: input.gender,
      weightKg: input.weightKg.toFixed(2),
      heightCm: input.heightCm.toFixed(2),
      updatedAt: createdAt,
    }).where(eq(fitnessProfiles.userId, userId))
    await tx.insert(fitnessMetricSnapshots).values({
      id,
      userId,
      weightKg: input.weightKg.toFixed(2),
      heightCm: input.heightCm.toFixed(2),
      age: input.age,
      gender: input.gender,
      activityLevel: input.activityLevel,
      bmi: calculated.bmi.toFixed(2),
      dailyCalorieTarget: calculated.dailyCalorieTarget,
      createdAt,
    })
    await tx.insert(fitnessCheckins).values({
      id: randomUUID(),
      userId,
      sessionId: null,
      weightKg: input.weightKg.toFixed(2),
      reflection: 'Body metrics updated from the dashboard calculator.',
      createdAt,
    })
  })

  revalidatePath('/')
  return snapshot
}
