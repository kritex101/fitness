'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Dumbbell, Moon, Sparkles } from 'lucide-react'
import { buildWorkoutPlan, exerciseLibrary, labelForExperience, nextExperienceLevel, weeklySessionTarget, type ExperienceLevel, type FitnessGoal, type TrainingEnvironment } from '@/lib/fitness-data'

type DayKind = 'strength' | 'recovery' | 'rest'
type ScheduleDay = {
  name: string
  shortName: string
  kind: DayKind
  title: string
  detail: string
  exerciseIds: string[]
}

function createSchedule(goal: FitnessGoal, experience: ExperienceLevel, environment: TrainingEnvironment): ScheduleDay[] {
  const workouts = Array.from({ length: weeklySessionTarget(experience) }, (_, index) =>
    buildWorkoutPlan({ goal, experience, environment }, index).map((exercise) => exercise.id),
  )
  const easyRecovery = ['walking', 'stretching']
  const mobilityRecovery = ['cat-cow-stretch', 'child-s-pose']

  if (experience === 'beginner') {
    return [
      { name: 'Monday', shortName: 'Mon', kind: 'strength', title: 'Full-body strength A', detail: 'Begin with 5 minutes of easy movement; use a comfortable load and keep a few good-form reps in reserve.', exerciseIds: workouts[0] },
      { name: 'Tuesday', shortName: 'Tue', kind: 'recovery', title: 'Easy recovery', detail: 'Keep the walk conversational and choose only gentle, comfortable stretches.', exerciseIds: easyRecovery },
      { name: 'Wednesday', shortName: 'Wed', kind: 'rest', title: 'Rest day', detail: 'No structured strength work today. Prioritize sleep, hydration, and recovery.', exerciseIds: [] },
      { name: 'Thursday', shortName: 'Thu', kind: 'strength', title: 'Full-body strength B', detail: 'A different balanced session. Keep every repetition smooth, pain-free, and controlled.', exerciseIds: workouts[1] },
      { name: 'Friday', shortName: 'Fri', kind: 'rest', title: 'Rest day', detail: 'Let your muscles recover. Keep everyday movement comfortable.', exerciseIds: [] },
      { name: 'Saturday', shortName: 'Sat', kind: 'recovery', title: 'Optional light movement', detail: 'Choose a gentle mobility flow and move only through comfortable ranges.', exerciseIds: mobilityRecovery },
      { name: 'Sunday', shortName: 'Sun', kind: 'rest', title: 'Rest and reset', detail: 'Take a full rest day and get ready for the next week.', exerciseIds: [] },
    ]
  }

  return [
    { name: 'Monday', shortName: 'Mon', kind: 'strength', title: 'Full-body strength A', detail: 'Begin with 5 minutes of easy movement, then use a controlled, manageable effort.', exerciseIds: workouts[0] },
    { name: 'Tuesday', shortName: 'Tue', kind: 'recovery', title: 'Active recovery', detail: 'Keep the walk easy and use the stretch only if it feels comfortable.', exerciseIds: easyRecovery },
    { name: 'Wednesday', shortName: 'Wed', kind: 'strength', title: 'Full-body strength B', detail: 'Change the movement variations while keeping the same steady effort.', exerciseIds: workouts[1] },
    { name: 'Thursday', shortName: 'Thu', kind: 'rest', title: 'Rest day', detail: 'No planned strength workout. Recover and return when you feel ready.', exerciseIds: [] },
    { name: 'Friday', shortName: 'Fri', kind: 'strength', title: 'Full-body strength C', detail: 'Finish with another balanced variation; stop before form starts to change.', exerciseIds: workouts[2] },
    { name: 'Saturday', shortName: 'Sat', kind: 'recovery', title: 'Optional easy movement', detail: 'Choose a gentle mobility flow and move only through comfortable ranges.', exerciseIds: mobilityRecovery },
    { name: 'Sunday', shortName: 'Sun', kind: 'rest', title: 'Rest and reset', detail: 'Take a full rest day and plan for a steady week ahead.', exerciseIds: [] },
  ]
}

function kindLabel(kind: DayKind) {
  if (kind === 'strength') return 'Strength'
  if (kind === 'recovery') return 'Recovery'
  return 'Rest'
}

export function WeeklyTrainingSchedule({ goal, experience, environment }: { goal: FitnessGoal; experience: ExperienceLevel; environment: TrainingEnvironment }) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [todayIndex, setTodayIndex] = useState<number | null>(null)
  const schedule = useMemo(() => createSchedule(goal, experience, environment), [environment, experience, goal])
  const selectedDay = schedule[selectedDayIndex]
  const prescription = useMemo(() => buildWorkoutPlan({ goal, experience, environment }), [environment, experience, goal])
  const prescribedSets = prescription[0]?.sets ?? 2
  const repMin = prescription[0]?.repMin ?? 8
  const repMax = prescription[0]?.repMax ?? 12
  const restSeconds = prescription[0]?.restSeconds ?? 90

  useEffect(() => {
    const mondayFirstIndex = (new Date().getDay() + 6) % 7
    setTodayIndex(mondayFirstIndex)
    setSelectedDayIndex(mondayFirstIndex)
  }, [])

  return <section className="weekly-schedule" aria-labelledby="weekly-schedule-heading">
    <div className="weekly-schedule-heading">
      <div>
        <p className="eyebrow">YOUR WEEK AT A GLANCE</p>
        <h2 id="weekly-schedule-heading">Weekly timetable</h2>
        <p>{experience === 'expert' ? 'You’re at the highest level. Keep building consistency and training safely.' : `Complete ${weeklySessionTarget(experience)} strength sessions this week to advance from ${labelForExperience(experience)} to ${labelForExperience(nextExperienceLevel(experience)!)}. One level per week.`}</p>
      </div>
      <span className="weekly-frequency"><Dumbbell size={14} aria-hidden="true" /> {experience === 'beginner' ? '2' : '3'} strength days</span>
    </div>
    <div className="schedule-day-picker" role="group" aria-label="Choose a day to see its plan">
      {schedule.map((day, index) => <button type="button" key={day.name} className={`schedule-day-button ${selectedDayIndex === index ? 'schedule-day-selected' : ''} schedule-day-${day.kind}`} aria-pressed={selectedDayIndex === index} onClick={() => setSelectedDayIndex(index)}>
        <span className="schedule-day-top"><strong>{day.shortName}</strong>{todayIndex === index && <span className="schedule-today-dot" aria-label="Today" />}</span>
        <span className="schedule-day-kind">{kindLabel(day.kind)}</span>
      </button>)}
    </div>
    <div className="schedule-day-detail" aria-live="polite">
      <div className="schedule-detail-heading">
        <div><span className={`schedule-kind-badge schedule-kind-${selectedDay.kind}`}>{selectedDay.kind === 'strength' ? <Dumbbell size={12} aria-hidden="true" /> : selectedDay.kind === 'recovery' ? <Activity size={12} aria-hidden="true" /> : <Moon size={12} aria-hidden="true" />}{selectedDay.name}{todayIndex === selectedDayIndex ? ' · Today' : ''}</span><h3>{selectedDay.title}</h3><p>{selectedDay.detail}</p></div>
        {selectedDay.kind === 'strength' && <span className="schedule-workout-dose">{prescribedSets} sets · {repMin}–{repMax} reps</span>}
      </div>
      {selectedDay.exerciseIds.length > 0 ? <ul className="schedule-exercise-list">{selectedDay.exerciseIds.map((id) => {
        const exercise = exerciseLibrary.find((item) => item.id === id)
        if (!exercise) return null
        const dose = exercise.duration ?? (id.includes('plank') || id.includes('hold') ? `${prescribedSets} × 20–30 sec` : `${prescribedSets} × ${repMin}–${repMax}`)
        return <li key={id}><span className="schedule-exercise-mark"><Dumbbell size={14} aria-hidden="true" /></span><span className="schedule-exercise-copy"><strong>{exercise.name}</strong><small>{exercise.focus}</small></span><span className="schedule-exercise-dose">{dose}</span></li>
      })}</ul> : <div className="schedule-recovery-note"><Sparkles size={16} aria-hidden="true" /><span>{selectedDay.kind === 'rest' ? 'Rest is part of the plan. No workout is scheduled today.' : 'Keep it easy—you should be able to hold a conversation while moving.'}</span></div>}
      {selectedDay.kind === 'strength' && <p className="schedule-rest-note">Rest about {restSeconds} seconds between sets, or longer if you need it.</p>}
    </div>
  </section>
}
