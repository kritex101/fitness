export type ExerciseMediaResponse = {
  videoUrl: string
  source: 'musclewiki'
  mediaType: 'video'
  posterUrl?: string
  exerciseId?: number
  exerciseName?: string
  gender?: 'male' | 'female'
  angle?: 'front' | 'side'
  instructions?: string[]
}
