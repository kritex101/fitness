import type { ExerciseVisualGender } from '@/lib/fitness-data'

export type ExerciseMediaResponse = {
  imageUrl: string
  source: 'workoutx'
  mediaType: 'image'
  exerciseId?: string
  exerciseName?: string
  gender?: ExerciseVisualGender
  instructions?: string[]
}
