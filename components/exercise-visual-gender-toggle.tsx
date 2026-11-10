'use client'

import type { ExerciseVisualGender } from '@/lib/fitness-data'

export function ExerciseVisualGenderToggle({
  gender,
  onChange,
  compact = false,
}: {
  gender: ExerciseVisualGender
  onChange: (gender: ExerciseVisualGender) => void
  compact?: boolean
}) {
  return (
    <div className={`exercise-visual-gender-toggle ${compact ? 'exercise-visual-gender-compact' : ''}`} role="group" aria-label="Choose gender presentation for exercise visuals">
      <span className="exercise-visual-gender-label">Demo visuals</span>
      <div className="exercise-visual-gender-options">
        <button type="button" aria-pressed={gender === 'male'} onClick={() => onChange('male')}>Male</button>
        <button type="button" aria-pressed={gender === 'female'} onClick={() => onChange('female')}>Female</button>
      </div>
    </div>
  )
}
