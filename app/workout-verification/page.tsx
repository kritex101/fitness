'use client'

import { useState } from 'react'
import { WorkoutFlow } from '@/components/workout-flow'
import { buildWorkoutPlan, type FitnessProfile } from '@/lib/fitness-data'
import type { ActiveWorkoutState } from '@/app/actions/fitness'

const profile: FitnessProfile = {
  userId: 'verification-preview-user',
  name: 'Preview Athlete',
  age: 30,
  gender: 'woman',
  weightKg: 68,
  heightCm: 165,
  goal: 'build_muscle',
  experience: 'beginner',
  environment: 'home',
}

const plannedExercise = buildWorkoutPlan(profile, 0)[0]
const initialWorkout: ActiveWorkoutState = {
  id: 'verification-session',
  sessionName: 'Workout verification',
  startedAt: new Date().toISOString(),
  exercises: [{
    ...plannedExercise,
    workoutSets: [1, 2].map((setNumber) => ({
      id: `verification-set-${setNumber}`,
      setNumber,
      targetReps: 10,
      repsCompleted: null,
      weightKg: null,
      completed: false,
    })),
  }],
}

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/media')) {
      return new Response(JSON.stringify({ videoUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', source: 'exercisedb' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Media-Provider-Statuses': JSON.stringify([{ provider: 'exercisedb', stage: 'GIF lookup', status: 200 }]),
        },
      })
    }
    return originalFetch(input, init)
  }
}

export default function WorkoutVerificationPage() {
  const [visualGender, setVisualGender] = useState<'male' | 'female'>('female')

  return <WorkoutFlow
    standalone
    profile={profile}
    visualGender={visualGender}
    onVisualGenderChange={setVisualGender}
    initialWeightKg={profile.weightKg}
    initialWorkout={initialWorkout}
    onClose={() => { window.location.href = '/' }}
    onStarted={() => {}}
    onCompleted={() => {}}
  />
}
