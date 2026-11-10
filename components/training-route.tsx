'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ActiveWorkoutState } from '@/app/actions/fitness'
import { WorkoutFlow } from '@/components/workout-flow'
import type { ExerciseVisualGender, FitnessProfile } from '@/lib/fitness-data'

export function TrainingRoute({ profile, initialWeightKg, initialWorkout }: { profile: FitnessProfile; initialWeightKg: number; initialWorkout: ActiveWorkoutState | null }) {
  const router = useRouter()
  const [visualGender, setVisualGender] = useState<ExerciseVisualGender>(() => profile.gender === 'woman' ? 'female' : 'male')
  const [, setActiveWorkout] = useState(initialWorkout)

  return <WorkoutFlow
    standalone
    profile={profile}
    visualGender={visualGender}
    onVisualGenderChange={setVisualGender}
    initialWeightKg={initialWeightKg}
    initialWorkout={initialWorkout}
    onClose={() => router.push('/')}
    onStarted={setActiveWorkout}
    onCompleted={() => router.refresh()}
  />
}
