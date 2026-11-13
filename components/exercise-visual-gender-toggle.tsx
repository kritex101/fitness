'use client'

import type { ExerciseVisualGender } from '@/lib/fitness-data'

export function ExerciseVisualGenderToggle({ gender, compact = false }: { gender: ExerciseVisualGender; compact?: boolean }) {
  const label = gender === 'female' ? 'Female' : 'Male'
  return (
    <div className={`exercise-visual-gender-toggle ${compact ? 'exercise-visual-gender-compact' : ''}`} aria-label={`${label} demonstrations are locked to your account profile`}>
      <span className="exercise-visual-gender-label">Account-locked demos</span>
      <span className="exercise-visual-gender-options" aria-current="true">{label}</span>
    </div>
  )
}
