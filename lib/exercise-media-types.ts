export type ExerciseMediaSource = 'musclewiki' | 'workoutx' | 'exercisedb' | 'ninjas'
export type ExerciseMediaType = 'video' | 'gif' | 'image'

export type ExerciseMediaResponse = {
  videoUrl: string
  source: ExerciseMediaSource
  mediaType: ExerciseMediaType
  imageUrls?: string[]
}
