import { suppliedExercises } from '@/lib/supplied-exercises'

export const goals = [
  { value: 'build_muscle', label: 'Build muscle', detail: 'Get stronger and add lean muscle.' },
  { value: 'lose_weight', label: 'Lose weight', detail: 'Build consistent habits while reducing body weight.' },
  { value: 'get_lean', label: 'Get lean', detail: 'Improve strength and body composition.' },
  { value: 'gain_muscle_weight', label: 'Build muscle and gain weight', detail: 'Grow stronger while aiming for gradual weight gain.' },
] as const

export const experienceLevels = [
  { value: 'beginner', label: 'Beginner', detail: 'New to structured training or returning after a break.' },
  { value: 'pro', label: 'Pro', detail: 'Comfortable with the main movement patterns and a regular routine.' },
  { value: 'expert', label: 'Expert', detail: 'Experienced and confident adapting training and technique.' },
] as const

export const trainingEnvironments = [
  { value: 'large_gym', label: 'Large, fully equipped gym', detail: 'Machines, cables, benches, and free weights.' },
  { value: 'medium_gym', label: 'Medium-sized facility', detail: 'A practical mix of free weights and common machines.' },
  { value: 'home', label: 'Home workouts', detail: 'Bodyweight first, with household or optional weights.' },
] as const

export const genderOptions = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'another_identity', label: 'Another identity' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

export const activityLevels = [
  { value: 'sedentary', label: 'Mostly sitting', multiplier: 1.2 },
  { value: 'lightly_active', label: 'Light activity', multiplier: 1.375 },
  { value: 'moderately_active', label: 'Moderate activity', multiplier: 1.55 },
  { value: 'very_active', label: 'High activity', multiplier: 1.725 },
] as const

export type FitnessGoal = (typeof goals)[number]['value']
export type ExperienceLevel = (typeof experienceLevels)[number]['value']
export type TrainingEnvironment = (typeof trainingEnvironments)[number]['value']
export type GenderIdentity = (typeof genderOptions)[number]['value']
export type ActivityLevel = (typeof activityLevels)[number]['value']
export type ExerciseVisualGender = 'male' | 'female'

export type FitnessProfile = {
  userId: string
  name: string
  age: number
  gender: GenderIdentity
  weightKg: number
  heightCm: number
  goal: FitnessGoal
  experience: ExperienceLevel
  environment: TrainingEnvironment
}

export type MetricSnapshot = {
  id: string
  weightKg: number
  heightCm: number
  age: number
  gender: GenderIdentity
  activityLevel: ActivityLevel
  bmi: number
  dailyCalorieTarget: number
  createdAt: string
}

export type BodyMetricsInput = Pick<MetricSnapshot, 'weightKg' | 'heightCm' | 'age' | 'gender' | 'activityLevel'>

export function calculateBodyMetrics(input: BodyMetricsInput, goal: FitnessGoal) {
  const heightMeters = input.heightCm / 100
  const bmi = Math.round((input.weightKg / (heightMeters * heightMeters)) * 100) / 100
  const genderAdjustment = input.gender === 'man' ? 5 : input.gender === 'woman' ? -161 : -78
  const activityMultiplier = activityLevels.find((level) => level.value === input.activityLevel)?.multiplier ?? 1.2
  const goalAdjustment = goal === 'lose_weight' ? -300 : goal === 'get_lean' ? -150 : goal === 'gain_muscle_weight' ? 200 : 150
  const basalMetabolicRate = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + genderAdjustment
  const dailyCalorieTarget = Math.max(1200, Math.round(basalMetabolicRate * activityMultiplier + goalAdjustment))

  return { bmi, dailyCalorieTarget }
}

export const bodyAreas = [
  { value: 'full-body', label: 'Full body', detail: 'Balanced movements for a complete session.' },
  { value: 'legs-glutes', label: 'Legs & glutes', detail: 'Squat, hinge, and hip-strengthening movements.' },
  { value: 'chest', label: 'Chest', detail: 'Pressing movements for the chest and upper body.' },
  { value: 'back', label: 'Back', detail: 'Pulling movements for back strength and posture.' },
  { value: 'arms', label: 'Arms', detail: 'Focused arm work and compound upper-body moves.' },
  { value: 'shoulders', label: 'Shoulders', detail: 'Controlled pressing and shoulder stability.' },
  { value: 'core', label: 'Core', detail: 'Bracing and trunk-control exercises.' },
] as const

export type BodyArea = (typeof bodyAreas)[number]['value']

export type ExerciseCategory = 'without-tools' | 'equipment'

export type Exercise = {
  id: string
  name: string
  equipment: string
  focus: string
  areas: BodyArea[]
  instructions: string[]
  coachingTip: string
  category: ExerciseCategory
  duration?: string
  homeOption?: string
}

export type PlannedExercise = Exercise & {
  sets: number
  repMin: number
  repMax: number
  restSeconds: number
}

export type CustomRoutineExercise = {
  exerciseId: string
  sets: number
  reps: number
  restSeconds: number
}

export type CustomRoutine = {
  id: string
  name: string
  exercises: CustomRoutineExercise[]
  createdAt: string
  updatedAt: string
}

const baseExerciseLibrary: Omit<Exercise, 'category'>[] = [
  {
    id: 'goblet-squat',
    name: 'Goblet squat',
    equipment: 'Dumbbell; bodyweight option',
    focus: 'Legs · glutes',
    areas: ['legs-glutes', 'full-body'],
    instructions: ['Stand with feet about shoulder-width apart.', 'Brace gently, sit between your hips, and keep your chest comfortably lifted.', 'Press through the whole foot to stand; keep knees tracking with toes.'],
    coachingTip: 'Use a range that feels controlled and pain-free. Start with bodyweight if you are learning the pattern.',
    homeOption: 'No dumbbell? Use a bodyweight squat or hold a snug backpack close to your chest.',
  },
  {
    id: 'leg-press',
    name: 'Leg press',
    equipment: 'Leg press machine',
    focus: 'Legs · glutes',
    areas: ['legs-glutes', 'full-body'],
    instructions: ['Set the seat so you can lower the platform without your pelvis lifting.', 'Place feet about hip-width apart and unlock the safety handles.', 'Lower smoothly, then press through the whole foot without locking your knees.'],
    coachingTip: 'Begin with a light load and stop the descent before your lower back rounds.',
  },
  {
    id: 'lat-pulldown',
    name: 'Lat pulldown',
    equipment: 'Cable pulldown machine',
    focus: 'Back · arms',
    areas: ['back', 'arms', 'full-body'],
    instructions: ['Secure your thighs under the pad and sit tall.', 'Pull the bar toward your upper chest while keeping shoulders away from your ears.', 'Return the bar slowly until your arms are comfortably extended.'],
    coachingTip: 'Avoid swinging or pulling the bar behind your neck; use a load you can control.',
    homeOption: 'At home, substitute a resistance-band row or a backpack row if you have a secure setup.',
  },
  {
    id: 'dumbbell-row',
    name: 'Supported dumbbell row',
    equipment: 'Dumbbell and bench',
    focus: 'Back · arms',
    areas: ['back', 'arms', 'full-body'],
    instructions: ['Brace one hand on a stable bench and keep your back long.', 'Draw the dumbbell toward your lower ribs without twisting your torso.', 'Lower it slowly until your arm is comfortably extended.'],
    coachingTip: 'Keep the supporting surface stable and choose a weight that does not make you rotate.',
    homeOption: 'Use a stable chair and a lightly loaded backpack if you do not have a dumbbell.',
  },
  {
    id: 'romanian-deadlift',
    name: 'Dumbbell Romanian deadlift',
    equipment: 'Pair of dumbbells',
    focus: 'Hamstrings · glutes',
    areas: ['legs-glutes', 'full-body'],
    instructions: ['Stand tall with a soft bend in your knees and weights near your thighs.', 'Push your hips back while keeping your spine neutral and weights close to your legs.', 'Stop when you feel a comfortable hamstring stretch, then stand by driving hips forward.'],
    coachingTip: 'This is a hip hinge, not a deep squat. Reduce the range if you cannot keep a comfortable back position.',
    homeOption: 'A securely packed backpack can replace dumbbells; practice the hip hinge without load first.',
  },
  {
    id: 'incline-push-up',
    name: 'Incline push-up',
    equipment: 'Stable bench or counter',
    focus: 'Chest · shoulders · arms',
    areas: ['chest', 'shoulders', 'arms', 'full-body'],
    instructions: ['Place hands slightly wider than shoulder-width on a sturdy raised surface.', 'Keep your body in a comfortable straight line as you bend your elbows.', 'Press the surface away to return, keeping your neck relaxed.'],
    coachingTip: 'A higher hand position makes the movement easier. Use only a surface that cannot slide or tip.',
  },
  {
    id: 'glute-bridge',
    name: 'Glute bridge',
    equipment: 'Exercise mat; bodyweight',
    focus: 'Glutes · hips',
    areas: ['legs-glutes', 'full-body'],
    instructions: ['Lie on your back with knees bent and feet about hip-width apart.', 'Gently brace, then lift your hips until your torso and thighs form a comfortable line.', 'Pause briefly and lower with control; avoid arching your lower back.'],
    coachingTip: 'Move through a range that feels comfortable and keep pressure through your whole foot.',
  },
  {
    id: 'forearm-plank',
    name: 'Plank',
    equipment: 'Mat; bodyweight',
    focus: 'Core · trunk stability',
    areas: ['core', 'full-body'],
    instructions: ['Place your forearms on the mat with elbows under your shoulders.', 'Press gently through your forearms and keep your ribs stacked over your hips.', 'Hold a comfortable straight line and keep breathing; stop before your form changes.'],
    coachingTip: 'Start with a shorter hold or elevated surface if you cannot keep a comfortable position.',
    homeOption: 'No equipment needed. A folded towel can make the floor more comfortable.',
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'Seated dumbbell shoulder press',
    equipment: 'Pair of light dumbbells and a stable seat',
    focus: 'Shoulders · arms',
    areas: ['shoulders', 'arms'],
    instructions: ['Sit tall with feet steady and weights near shoulder height.', 'Press overhead through a comfortable range without arching your back.', 'Lower the weights slowly to the starting position.'],
    coachingTip: 'Use a light load and stop below any painful range; a standing wall press is a no-weight alternative.',
    homeOption: 'Use two light household objects only if you can hold them securely.',
  },
  {
    id: 'dumbbell-bicep-curl',
    name: 'Dumbbell biceps curl',
    equipment: 'Pair of light dumbbells',
    focus: 'Arms · biceps',
    areas: ['arms'],
    instructions: ['Stand comfortably with arms by your sides and palms facing forward.', 'Bend your elbows to bring the weights up without swinging your torso.', 'Lower slowly and keep your shoulders relaxed.'],
    coachingTip: 'Choose a light load you can lower with control; stop if your elbows or wrists hurt.',
    homeOption: 'A light, securely held household item can work; bodyweight is also a valid starting point.',
  },
 ]

const withoutToolsExercises: Exercise[] = [
  {
    id: 'walking', name: 'Walking', category: 'without-tools', equipment: 'Comfortable shoes', focus: 'Cardio · endurance', areas: ['full-body'], duration: '15–30 min',
    instructions: ['Choose a route and pace that feel comfortable.', 'Walk tall with relaxed shoulders and let your arms swing naturally.', 'Slow down or stop if you feel pain, dizziness, or unusual shortness of breath.'],
    coachingTip: 'Start with a short, easy walk and build duration gradually. A conversational pace is a good place to begin.',
  },
  {
    id: 'jogging', name: 'Jogging', category: 'without-tools', equipment: 'Comfortable shoes', focus: 'Cardio · endurance', areas: ['full-body'], duration: '10–20 min',
    instructions: ['Warm up with a few minutes of easy walking.', 'Use a relaxed pace with short, light steps.', 'Cool down by walking and stop if you feel unwell or experience sharp pain.'],
    coachingTip: 'Alternate short jogging and walking intervals if continuous jogging feels too difficult.',
  },
  {
    id: 'bodyweight-squat', name: 'Squats', category: 'without-tools', equipment: 'Bodyweight', focus: 'Legs · glutes', areas: ['legs-glutes', 'full-body'],
    instructions: ['Stand with feet about shoulder-width apart and brace gently.', 'Bend your hips and knees, lowering only as far as feels comfortable.', 'Press through your whole foot to stand, keeping your knees aligned with your toes.'],
    coachingTip: 'Use a chair behind you as a depth guide, and stop if you feel pain.',
  },
  {
    id: 'reverse-lunge', name: 'Lunges', category: 'without-tools', equipment: 'Bodyweight', focus: 'Legs · glutes', areas: ['legs-glutes', 'full-body'],
    instructions: ['Stand tall near a wall or sturdy support if you want balance help.', 'Step one foot back and bend both knees only through a comfortable range.', 'Press through the front foot to return, then switch sides.'],
    coachingTip: 'Keep the step short and shallow while learning. Skip the movement if balance or knee comfort is a concern.',
  },
  {
    id: 'push-up', name: 'Push-ups', category: 'without-tools', equipment: 'Bodyweight', focus: 'Chest · shoulders · arms', areas: ['chest', 'shoulders', 'arms', 'full-body'],
    instructions: ['Start on hands and knees or with hands on a stable raised surface.', 'Keep your body comfortably aligned and bend your elbows.', 'Press away from the floor or surface without locking your elbows.'],
    coachingTip: 'Choose a raised hand position or knee variation that lets you keep steady form.',
  },
  {
    id: 'jumping-jacks', name: 'Jumping jacks', category: 'without-tools', equipment: 'Bodyweight', focus: 'Cardio · full body', areas: ['full-body'], duration: '5–10 min',
    instructions: ['Stand with feet comfortably apart and arms by your sides.', 'Step one foot out at a time while raising your arms, then step back in.', 'Keep the movement light and use a no-jump step if needed.'],
    coachingTip: 'Try low-impact side steps instead of jumping if you prefer to keep it gentle.',
  },
  {
    id: 'stretching', name: 'Stretching', category: 'without-tools', equipment: 'Bodyweight', focus: 'Mobility · flexibility', areas: ['full-body'], duration: '5–10 min',
    instructions: ['Choose a few comfortable stretches for the areas that feel tight.', 'Ease into each position slowly and breathe normally.', 'Hold a gentle stretch without bouncing, and release if anything hurts.'],
    coachingTip: 'Stretching should feel mild, never sharp or forced. Avoid pushing through pain.',
  },
  {
    id: 'yoga', name: 'Yoga', category: 'without-tools', equipment: 'Optional mat', focus: 'Mobility · balance', areas: ['full-body'], duration: '10–20 min',
    instructions: ['Choose a beginner-friendly sequence and a clear, non-slip space.', 'Move between positions slowly and keep breathing comfortably.', 'Modify or skip any pose that causes pain, dizziness, or strain.'],
    coachingTip: 'Use a chair or wall for balance and choose a gentle sequence suited to your experience.',
  },
  {
    id: 'bodyweight-circuit', name: 'Bodyweight exercises', category: 'without-tools', equipment: 'Bodyweight', focus: 'Full-body strength', areas: ['full-body'], duration: '10–20 min',
    instructions: ['Choose two or three comfortable movements such as squats, wall push-ups, and glute bridges.', 'Move at a steady pace and pause between movements as needed.', 'Stop each movement before your form changes.'],
    coachingTip: 'Keep the first circuit short and easy. You do not need to exercise to exhaustion to build a habit.',
  },
]

const equipmentExercises: Exercise[] = [
  {
    id: 'treadmill-walking', name: 'Treadmill walking', category: 'equipment', equipment: 'Treadmill', focus: 'Cardio · endurance', areas: ['full-body'], duration: '15–30 min',
    instructions: ['Step onto the side rails before starting and choose a slow speed.', 'Walk with an upright, relaxed posture; use the safety clip when available.', 'Reduce the speed before stepping off and stop if you feel unwell.'],
    coachingTip: 'Begin with a flat, easy walk. Increase speed or incline gradually, not both at once.',
  },
  {
    id: 'stationary-cycling', name: 'Stationary cycling', category: 'equipment', equipment: 'Stationary bike', focus: 'Cardio · legs', areas: ['legs-glutes', 'full-body'], duration: '15–30 min',
    instructions: ['Adjust the seat so your knee stays slightly bent at the bottom of the pedal stroke.', 'Start with low resistance and a smooth, comfortable cadence.', 'Ease off gradually and stop if you feel pain or dizziness.'],
    coachingTip: 'A comfortable pace is enough. Ask staff for help adjusting an unfamiliar bike.',
  },
  {
    id: 'dumbbell-exercises', name: 'Dumbbell exercises', category: 'equipment', equipment: 'Dumbbells', focus: 'Full-body strength', areas: ['full-body'],
    instructions: ['Choose a light pair you can lift and set down securely.', 'Use simple movements such as a row, squat, or floor press with controlled form.', 'Rest between sets and stop if you feel sharp pain or lose control of the weights.'],
    coachingTip: 'Start lighter than you think you need. Ask a qualified coach to check technique for new movements.',
  },
  {
    id: 'barbell-exercises', name: 'Barbell exercises', category: 'equipment', equipment: 'Barbell and safety rack', focus: 'Full-body strength', areas: ['full-body'],
    instructions: ['Use a rack with safety stops and ask staff for a setup check if you are new.', 'Begin with a light or unloaded bar and practice the movement path.', 'Keep each repetition controlled and rerack the bar safely.'],
    coachingTip: 'Barbell training is best learned with in-person coaching. Do not attempt a heavy lift alone.',
  },
  {
    id: 'resistance-band-training', name: 'Resistance band training', category: 'equipment', equipment: 'Resistance band', focus: 'Full-body strength', areas: ['full-body'],
    instructions: ['Check the band for tears and secure it only to a stable anchor.', 'Choose light resistance and keep the band away from your face.', 'Move slowly and release tension with control.'],
    coachingTip: 'Never use a damaged band or an unsecured door, chair, or fixture as an anchor.',
  },
  {
    id: 'kettlebell-exercises', name: 'Kettlebell exercises', category: 'equipment', equipment: 'Kettlebell', focus: 'Full-body strength', areas: ['full-body', 'legs-glutes'],
    instructions: ['Choose a light kettlebell and practice picking it up and setting it down safely.', 'Start with a controlled deadlift pattern before trying dynamic movements.', 'Keep the weight close and stop if you cannot control it smoothly.'],
    coachingTip: 'Learn dynamic kettlebell movements from a qualified coach before practicing them on your own.',
  },
  {
    id: 'chest-press', name: 'Chest press', category: 'equipment', equipment: 'Chest press machine', focus: 'Chest · shoulders · arms', areas: ['chest', 'shoulders', 'arms', 'full-body'],
    instructions: ['Adjust the seat so handles begin around mid-chest height.', 'Choose a light load and press forward without locking your elbows.', 'Return slowly and stop if your shoulders feel uncomfortable.'],
    coachingTip: 'Ask gym staff to show you the adjustment points the first time you use the machine.',
  },
  {
    id: 'rowing-machine', name: 'Rowing machine', category: 'equipment', equipment: 'Indoor rowing machine', focus: 'Cardio · full body', areas: ['full-body'], duration: '10–20 min',
    instructions: ['Set a light resistance and sit with feet secure in the straps.', 'Push with your legs first, then lean back slightly and draw the handle toward your ribs.', 'Return the handle, lean forward, and bend your knees smoothly.'],
    coachingTip: 'Keep the effort easy while learning the sequence. Stop if your back or joints hurt.',
  },
  {
    id: 'cable-exercises', name: 'Cable exercises', category: 'equipment', equipment: 'Cable machine', focus: 'Full-body strength', areas: ['full-body'],
    instructions: ['Check that the attachment is securely clipped in and set a light load.', 'Stand with a stable base and move through a comfortable, controlled range.', 'Return the handle slowly and keep clear of the cable path.'],
    coachingTip: 'Ask staff for a demonstration before changing attachments or using an unfamiliar cable station.',
  },
  {
    id: 'medicine-ball-exercises', name: 'Medicine ball exercises', category: 'equipment', equipment: 'Light medicine ball', focus: 'Full-body strength', areas: ['full-body'],
    instructions: ['Choose a light ball and make sure you have clear space around you.', 'Start with a slow squat-to-reach or controlled standing pass.', 'Keep the ball close and avoid throwing it unless using an appropriate, clear area.'],
    coachingTip: 'Begin with controlled movements. Avoid high-speed throws until you have coaching and a safe space.',
  },
]

const equipmentFreeBaseIds = new Set(['incline-push-up', 'glute-bridge', 'forearm-plank'])

const authoredExerciseLibrary: Exercise[] = [
  ...baseExerciseLibrary.map((exercise) => ({
    ...exercise,
    category: equipmentFreeBaseIds.has(exercise.id) ? 'without-tools' as const : 'equipment' as const,
  })),
  ...withoutToolsExercises,
  ...equipmentExercises,
]

function normalizeExerciseName(name: string) {
  return name.toLowerCase()
    .replace(/\bbiceps\b/g, 'bicep')
    .replace(/\btriceps\b/g, 'tricep')
    .replace(/\bdumbbell goblet\b/g, 'goblet')
    .replace(/\bmachine\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.endsWith('s') && !['press', 'cross'].includes(word) ? word.slice(0, -1) : word)
    .join('')
}

const knownExerciseNames = new Set(authoredExerciseLibrary.map((exercise) => normalizeExerciseName(exercise.name)))
const knownExerciseIds = new Set(authoredExerciseLibrary.map((exercise) => exercise.id))

const additionalExercises = suppliedExercises.flatMap((exercise) => {
  const normalizedName = normalizeExerciseName(exercise.name)
  if (knownExerciseNames.has(normalizedName)) return []
  knownExerciseNames.add(normalizedName)

  let id = exercise.id
  if (knownExerciseIds.has(id)) id = `${id}-variation`
  let suffix = 2
  while (knownExerciseIds.has(id)) id = `${exercise.id}-variation-${suffix++}`
  knownExerciseIds.add(id)

  return [{ ...exercise, id }]
})

export const exerciseLibrary: Exercise[] = [...authoredExerciseLibrary, ...additionalExercises]

const workoutRotations: Record<TrainingEnvironment, string[][]> = {
  large_gym: [
    ['leg-press', 'lat-pulldown', 'incline-push-up', 'romanian-deadlift', 'dead-bug'],
    ['goblet-squat', 'seated-cable-rows', 'chest-press-machine', 'glute-bridge', 'bird-dog'],
    ['step-ups', 'assisted-pull-up-machine', 'dumbbell-shoulder-press', 'hamstring-curl', 'dead-bug'],
  ],
  medium_gym: [
    ['goblet-squat', 'lat-pulldown', 'incline-push-up', 'romanian-deadlift', 'dead-bug'],
    ['leg-press', 'dumbbell-row', 'dumbbell-shoulder-press', 'glute-bridge', 'bird-dog'],
    ['step-ups', 'seated-cable-rows', 'chest-press-machine', 'hamstring-curl', 'dead-bug'],
  ],
  home: [
    ['bodyweight-squat', 'incline-push-up', 'dumbbell-row', 'glute-bridge', 'dead-bug'],
    ['reverse-lunges', 'push-ups', 'romanian-deadlift', 'dumbbell-shoulder-press', 'bird-dog'],
    ['step-ups', 'push-ups', 'dumbbell-row', 'glute-bridge', 'bird-dog']
  ],
}

export function activePlanId(userId: string) {
  return `${userId}:active-plan`
}

export function buildCustomRoutinePlan(routine: Pick<CustomRoutine, 'exercises'> | null | undefined): PlannedExercise[] {
  if (!routine) return []
  return routine.exercises.flatMap((prescription) => {
    const exercise = exerciseLibrary.find((item) => item.id === prescription.exerciseId)
    return exercise ? [{
      ...exercise,
      sets: prescription.sets,
      repMin: prescription.reps,
      repMax: prescription.reps,
      restSeconds: prescription.restSeconds,
    }] : []
  })
}

export function buildWorkoutPlan(profile: Pick<FitnessProfile, 'goal' | 'experience' | 'environment'>, workoutIndex = 0): PlannedExercise[] {
  const sets = profile.experience === 'beginner' ? 2 : 3
  const repMin = 8
  const repMax = 12
  const restSeconds = profile.experience === 'beginner' ? 90 : 120
  const rotation = workoutRotations[profile.environment]
  const selectedWorkout = rotation[((Math.max(0, Math.floor(workoutIndex)) % rotation.length) + rotation.length) % rotation.length]

  return selectedWorkout
    .map((id) => exerciseLibrary.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise))
    .map((exercise) => ({ ...exercise, sets, repMin, repMax, restSeconds }))
}

export function weeklySessionTarget(level: ExperienceLevel) {
  return level === 'beginner' ? 2 : 3
}

export function nextExperienceLevel(level: ExperienceLevel): ExperienceLevel | null {
  if (level === 'beginner') return 'pro'
  if (level === 'pro') return 'expert'
  return null
}

export function labelForGoal(value: FitnessGoal) {
  return goals.find((goal) => goal.value === value)?.label ?? 'Training plan'
}

export function labelForExperience(value: ExperienceLevel) {
  return experienceLevels.find((level) => level.value === value)?.label ?? 'Training level'
}

export function labelForEnvironment(value: TrainingEnvironment) {
  return trainingEnvironments.find((environment) => environment.value === value)?.label ?? 'Training environment'
}
