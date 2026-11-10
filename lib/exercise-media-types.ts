export type ExerciseMediaSource = 'musclewiki' | 'workoutx' | 'exercisedb' | 'ninjas'
export type ExerciseMediaType = 'video' | 'gif' | 'image'

export type ExerciseMediaResponse = {
  videoUrl: string
  source: ExerciseMediaSource
  mediaType: ExerciseMediaType
  imageUrls?: string[]
  posterUrl?: string
  exerciseId?: number
  exerciseName?: string
  gender?: 'male' | 'female'
  angle?: 'front' | 'side'
  instructions?: string[]
}
