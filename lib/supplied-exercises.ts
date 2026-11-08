import type { BodyArea, Exercise, ExerciseCategory } from '@/lib/fitness-data'

type ExerciseGroup = {
  category: ExerciseCategory
  equipment: string
  names: string
}

const groups: ExerciseGroup[] = [
  {
    category: 'without-tools',
    equipment: 'Bodyweight',
    names: `Walking
Jogging
Running
Squats
Jump squats
Sumo squats
Wall squats
Lunges
Forward lunges
Reverse lunges
Side lunges
Walking lunges
Curtsy lunges
Split squats
Push-ups
Knee push-ups
Wide push-ups
Diamond push-ups
Incline push-ups
Pike push-ups
Plank
Side plank
Plank shoulder taps
Plank up-downs
Mountain climbers
Burpees
Half burpees
Jumping jacks
Star jumps
High knees
Butt kicks
Skater jumps
Tuck jumps
Broad jumps
Lateral jumps
Step-ups
Calf raises
Single-leg calf raises
Glute bridges
Single-leg glute bridges
Hip thrusts
Donkey kicks
Fire hydrants
Bird dog
Superman exercise
Dead bug
Bicycle crunches
Crunches
Reverse crunches
Sit-ups
V-ups
Russian twists
Heel touches
Flutter kicks
Leg raises
Side leg raises
Scissor kicks
Hollow body hold
Bear crawl
Crab walk
Inchworm
Shadow boxing
Arm circles
Arm swings
Shoulder rolls
Marching in place
Standing knee raises
Standing side kicks
Standing front kicks
Standing side bends
Torso twists
Neck mobility exercises
Cat-cow stretch
Child's pose
Cobra stretch
Downward dog
Butterfly stretch
Hamstring stretch
Quadriceps stretch
Calf stretch
Hip flexor stretch
Chest stretch
Triceps stretch
Seated forward fold
Pigeon pose
Warrior I pose
Warrior II pose
Tree pose
Chair pose
Bridge pose
Sun salutations
Bear hold
Wall push-ups
Wall plank
Standing calf pulses
Alternating toe touches
Side-to-side hops
Marching glute bridges
Seated knee tucks
Standing cross-body crunches`,
  },
  {
    category: 'equipment',
    equipment: 'Dumbbells',
    names: `Dumbbell bicep curls
Hammer curls
Concentration curls
Zottman curls
Dumbbell shoulder press
Arnold press
Dumbbell lateral raises
Dumbbell front raises
Dumbbell reverse fly
Dumbbell chest press
Dumbbell incline chest press
Dumbbell chest fly
Dumbbell pullover
Dumbbell rows
Single-arm dumbbell rows
Dumbbell shrugs
Dumbbell triceps extensions
Dumbbell kickbacks
Dumbbell goblet squats
Dumbbell lunges`,
  },
  {
    category: 'equipment',
    equipment: 'Barbell and rack',
    names: `Barbell bench press
Incline barbell bench press
Decline barbell bench press
Barbell back squats
Barbell front squats
Barbell deadlifts
Romanian deadlifts
Sumo deadlifts
Barbell lunges
Barbell hip thrusts
Barbell overhead press
Barbell bent-over rows
Barbell shrugs
Barbell curls
Close-grip bench press
Barbell skull crushers
Good mornings
Barbell calf raises
Barbell upright rows
Barbell floor press`,
  },
  {
    category: 'equipment',
    equipment: 'Resistance band',
    names: `Band bicep curls
Band triceps extensions
Band chest press
Band chest fly
Band shoulder press
Band lateral raises
Band pull-aparts
Band rows
Band face pulls
Band-assisted pull-ups
Band squats
Band lateral walks
Band glute bridges
Band hip thrusts
Band kickbacks
Band clamshells
Band leg extensions
Band hamstring curls
Band deadlifts
Band good mornings`,
  },
  {
    category: 'equipment',
    equipment: 'Gym machine or cable station',
    names: `Treadmill walking
Treadmill running
Stationary cycling
Elliptical training
Rowing machine
Stair climber
Lat pulldown
Seated cable rows
Chest press machine
Pec deck machine
Shoulder press machine
Leg press
Leg extension
Hamstring curl
Seated calf raise
Standing calf raise machine
Hip abduction machine
Hip adduction machine
Assisted pull-up machine
Assisted dip machine
Smith machine squats
Smith machine bench press
Cable biceps curls
Cable triceps pushdowns
Cable lateral raises
Cable chest fly
Cable face pulls
Cable woodchoppers
Cable kickbacks
Back extension machine`,
  },
  {
    category: 'equipment',
    equipment: 'Kettlebell',
    names: `Kettlebell swings
Kettlebell goblet squats
Kettlebell deadlifts
Kettlebell lunges
Kettlebell shoulder press`,
  },
  {
    category: 'equipment',
    equipment: 'Medicine ball',
    names: `Medicine ball slams
Medicine ball twists`,
  },
  {
    category: 'equipment',
    equipment: 'Battle ropes',
    names: 'Battle ropes',
  },
  {
    category: 'equipment',
    equipment: 'TRX suspension trainer',
    names: `TRX rows
TRX chest press`,
  },
]

const mobilityPattern = /stretch|pose|mobility|salutation|arm circles|arm swings|shoulder rolls|torso twists/i
const cardioPattern = /^(walking|jogging|running|jump squats|mountain climbers|burpees|half burpees|jumping jacks|star jumps|high knees|butt kicks|skater jumps|tuck jumps|broad jumps|lateral jumps|shadow boxing|marching in place|side-to-side hops|treadmill walking|treadmill running|stationary cycling|elliptical training|rowing machine|stair climber|battle ropes)$/i
const corePattern = /plank|crunch|dead bug|bird dog|twist|hollow|v-up|sit-up|knee tuck|flutter|scissor kick|heel touch|bear hold|bear crawl|crab walk|inchworm|leg raises/i

const focusByArea: Record<BodyArea, string> = {
  'full-body': 'Full body',
  'legs-glutes': 'Legs · glutes',
  chest: 'Chest',
  back: 'Back',
  arms: 'Arms',
  shoulders: 'Shoulders',
  core: 'Core',
}

function areasFor(name: string): BodyArea[] {
  const value = name.toLowerCase()
  let area: BodyArea = 'full-body'

  if (corePattern.test(value)) area = 'core'
  else if (/squat|lunge|step-up|calf|glute|hip|donkey|fire hydrant|deadlift|hamstring|quadriceps|leg press|leg extension|adduction|abduction|good morning/i.test(value)) area = 'legs-glutes'
  else if (/shoulder|arnold press|upright row|lateral raise|front raise|overhead press/i.test(value)) area = 'shoulders'
  else if (/bicep|curl|triceps|kickback|skull crusher|hammer curl|concentration|zottman/i.test(value)) area = 'arms'
  else if (/chest|push-up|bench press|pec deck|chest fly|dip/i.test(value)) area = 'chest'
  else if (/row|pulldown|pull-up|face pull|shrug|back extension|superman/i.test(value)) area = 'back'

  return area === 'full-body' ? ['full-body'] : [area, 'full-body']
}

function getDuration(name: string) {
  if (mobilityPattern.test(name)) return '5–10 min'
  if (!cardioPattern.test(name)) return undefined
  return /walking|running|jogging|cycling|elliptical|rowing machine|stair climber/i.test(name) ? '10–25 min' : '5–10 min'
}

function getInstructions(name: string, category: ExerciseCategory, equipment: string) {
  if (mobilityPattern.test(name)) {
    return [
      'Move into the position slowly and stay within a comfortable range.',
      'Breathe steadily and avoid bouncing or forcing the stretch.',
      'Ease out gradually and stop if you feel pain, tingling, or dizziness.',
    ]
  }

  if (cardioPattern.test(name)) {
    return [
      'Start at an easy pace and make sure the space or equipment is set up safely.',
      'Keep the effort comfortable; reduce speed, resistance, or impact as needed.',
      'Slow down to cool off and stop if you feel sharp pain, dizziness, or unusual shortness of breath.',
    ]
  }

  if (corePattern.test(name)) {
    return [
      'Set a stable position and gently brace without holding your breath.',
      'Move with control, keep your neck relaxed, and use a comfortable range.',
      'Stop the set when you can no longer maintain steady, pain-free form.',
    ]
  }

  if (category === 'equipment') {
    const barbellCues = /barbell|smith machine/i.test(equipment)
      ? 'Use safety stops or a spotter where appropriate, and learn the setup before adding load.'
      : `Check the ${equipment.toLowerCase()} is secure and begin with light resistance.`
    return [
      barbellCues,
      'Move through a comfortable range without swinging or locking your joints.',
      'Return slowly, keep breathing, and stop if you feel pain or lose control.',
    ]
  }

  return [
    'Set a steady stance or position and begin with an easy, comfortable range.',
    'Move smoothly and keep breathing; use a lower-impact option when needed.',
    'Stop if you feel sharp pain, dizziness, or cannot keep steady form.',
  ]
}

function makeExercise(name: string, category: ExerciseCategory, equipment: string): Exercise {
  const areas = areasFor(name)
  const isMobility = mobilityPattern.test(name)
  const isCardio = cardioPattern.test(name)
  const techniqueNeedsCoaching = /barbell|kettlebell swing|battle ropes|snatch|clean|jerk/i.test(`${name} ${equipment}`)

  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name,
    equipment,
    focus: focusByArea[areas[0]],
    areas,
    instructions: getInstructions(name, category, equipment),
    coachingTip: isMobility
      ? 'A gentle stretch is enough; do not force the position.'
      : isCardio
        ? 'Choose a pace you can recover from and scale the impact to how you feel today.'
        : techniqueNeedsCoaching
          ? 'Start with instruction from a qualified coach before attempting heavy or fast repetitions.'
          : 'Use a manageable effort and prioritize comfortable, controlled movement.',
    category,
    duration: getDuration(name),
  }
}

export const suppliedExercises: Exercise[] = groups.flatMap(({ names, category, equipment }) =>
  names.split('\n').map((name) => name.trim()).filter(Boolean).map((name) => makeExercise(name, category, equipment)),
)
