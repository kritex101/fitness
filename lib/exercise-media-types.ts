export type ExerciseMediaSource = 'musclewiki' | 'workoutx' | 'exercisedb'

export type ExerciseMediaResponse = {
  videoUrl: string
  source: ExerciseMediaSource
}
