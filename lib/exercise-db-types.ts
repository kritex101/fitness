export type ExerciseDbExercise = {
  id: string
  name: string
  target: string
  equipment: string
  instructions: string[]
}

export const exerciseDbTargets = [
  { value: 'abs', label: 'Abs' },
  { value: 'abductors', label: 'Abductors' },
  { value: 'adductors', label: 'Adductors' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'calves', label: 'Calves' },
  { value: 'delts', label: 'Shoulders' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'lats', label: 'Lats' },
  { value: 'pectorals', label: 'Chest' },
  { value: 'quads', label: 'Quads' },
  { value: 'traps', label: 'Traps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'upper back', label: 'Upper back' },
] as const
