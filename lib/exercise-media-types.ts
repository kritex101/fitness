export type ExerciseMediaItem = {
  id: string
  provider: 'MuscleWiki' | 'WorkoutX'
  kind: 'demonstration' | 'animation'
  videoUrl: string
  mediaType: 'video' | 'gif'
  posterUrl: string | null
  angle: string | null
}

export type ExerciseMediaResponse = {
  media: ExerciseMediaItem[]
  unavailableSources: Array<'MuscleWiki' | 'WorkoutX'>
}
