'use client'

import { Search } from 'lucide-react'
import { useState } from 'react'
import { bodyAreas, exerciseLibrary, type BodyArea, type ExerciseCategory, type ExerciseVisualGender, type PlannedExercise } from '@/lib/fitness-data'
import { ExerciseVideoSearch } from '@/components/exercise-video-search'
import { ExerciseVisualGenderToggle } from '@/components/exercise-visual-gender-toggle'

type ExerciseCollection = 'plan' | 'all' | ExerciseCategory

export function ExerciseLibrary({ exercises, visualGender: controlledVisualGender, onVisualGenderChange, initialVisualGender = 'male', initialCollection = 'plan' }: { exercises: PlannedExercise[]; visualGender?: ExerciseVisualGender; onVisualGenderChange?: (gender: ExerciseVisualGender) => void; initialVisualGender?: ExerciseVisualGender; initialCollection?: ExerciseCollection }) {
  const [selectedCollection, setSelectedCollection] = useState<ExerciseCollection>(initialCollection)
  const [selectedArea, setSelectedArea] = useState<BodyArea>('full-body')
  const [searchQuery, setSearchQuery] = useState('')
  const [localVisualGender, setLocalVisualGender] = useState<ExerciseVisualGender>(initialVisualGender)
  const visualGender = controlledVisualGender ?? localVisualGender
  const changeVisualGender = onVisualGenderChange ?? setLocalVisualGender
  const plannedById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const collectionExercises = selectedCollection === 'plan'
    ? exercises
    : selectedCollection === 'all'
      ? exerciseLibrary
      : exerciseLibrary.filter((exercise) => exercise.category === selectedCollection)
  const areaExercises = selectedArea === 'full-body'
    ? collectionExercises
    : collectionExercises.filter((exercise) => exercise.areas.includes(selectedArea))
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleExercises = normalizedQuery
    ? areaExercises.filter((exercise) => `${exercise.name} ${exercise.focus} ${exercise.equipment}`.toLowerCase().includes(normalizedQuery))
    : areaExercises
  const collectionTitle = selectedCollection === 'plan'
    ? 'Your complete session'
    : selectedCollection === 'all' ? 'All available exercises'
      : selectedCollection === 'without-tools' ? 'Personal exercises (without tools)' : 'Exercises using tools / equipment'

  return (
    <div className="exercise-library-wrap">
      <div className="exercise-collection-picker" role="group" aria-label="Choose an exercise collection">
        {exercises.length > 0 && <button type="button" className={`exercise-collection-option ${selectedCollection === 'plan' ? 'exercise-collection-selected' : ''}`} aria-pressed={selectedCollection === 'plan'} onClick={() => { setSelectedCollection('plan'); setSelectedArea('full-body') }}><strong>Your plan</strong><span>{exercises.length} movements</span></button>}
        <button type="button" className={`exercise-collection-option ${selectedCollection === 'all' ? 'exercise-collection-selected' : ''}`} aria-pressed={selectedCollection === 'all'} onClick={() => { setSelectedCollection('all'); setSelectedArea('full-body') }}><strong>All exercises</strong><span>{exerciseLibrary.length} movements</span></button>
        <button type="button" className={`exercise-collection-option ${selectedCollection === 'without-tools' ? 'exercise-collection-selected' : ''}`} aria-pressed={selectedCollection === 'without-tools'} onClick={() => { setSelectedCollection('without-tools'); setSelectedArea('full-body') }}><strong>Personal (without tools)</strong><span>{exerciseLibrary.filter((exercise) => exercise.category === 'without-tools').length} activities</span></button>
        <button type="button" className={`exercise-collection-option ${selectedCollection === 'equipment' ? 'exercise-collection-selected' : ''}`} aria-pressed={selectedCollection === 'equipment'} onClick={() => { setSelectedCollection('equipment'); setSelectedArea('full-body') }}><strong>Using tools / equipment</strong><span>{exerciseLibrary.filter((exercise) => exercise.category === 'equipment').length} activities</span></button>
      </div>
      <div className="body-area-picker" role="group" aria-label="Filter exercises by body area">
        {bodyAreas.map((area) => {
          const count = area.value === 'full-body'
            ? collectionExercises.length
            : collectionExercises.filter((exercise) => exercise.areas.includes(area.value)).length
          return <button type="button" key={area.value} className={`body-area-option ${selectedArea === area.value ? 'body-area-selected' : ''}`} aria-pressed={selectedArea === area.value} onClick={() => setSelectedArea(area.value)}>
            <span><strong>{area.label}</strong><small>{area.detail}</small></span><span className="body-area-count">{count}</span>
          </button>
        })}
      </div>
      <label className="exercise-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search exercises by name, focus, or equipment</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search exercises, equipment, or focus" /></label>
      <div className="library-results-heading"><div><p className="eyebrow">{selectedCollection === 'plan' ? selectedArea === 'full-body' ? 'YOUR COMPLETE SESSION' : 'TARGETED MOVEMENTS' : selectedArea === 'full-body' ? 'ACTIVITY COLLECTION' : 'TARGETED MOVEMENTS'}</p><h2>{selectedArea === 'full-body' ? collectionTitle : bodyAreas.find((area) => area.value === selectedArea)?.label}</h2></div><ExerciseVisualGenderToggle gender={visualGender} onChange={changeVisualGender} /></div>
      <div className="exercise-library">
        {visibleExercises.length === 0 && <p className="exercise-empty-state" role="status">No exercises match that search in this collection.</p>}
        {visibleExercises.map((exercise, index) => {
          const planned = plannedById.get(exercise.id)
          const sets = planned?.sets ?? 2
          const repMin = planned?.repMin ?? 8
          const repMax = planned?.repMax ?? 12
  const restSeconds = planned?.restSeconds ?? 60
  return <article className="library-card" key={exercise.id}>
            <div className="library-copy">
              <div className="library-card-top"><span className="library-number">{String(index + 1).padStart(2, '0')}</span><span className="exercise-focus">{exercise.focus}</span></div>
              <h3>{exercise.name}</h3>
              <p className="exercise-equipment">{exercise.equipment}</p>
              <div className="prescription">{exercise.duration ? <><strong>Suggested</strong><span>{exercise.duration}</span><span>comfortable pace</span></> : <><strong>{sets} sets</strong><span>{repMin}–{repMax} reps</span><span>{restSeconds}s rest</span></>}</div>
              <div className="library-exercise-detail">
                <div className="library-instructions-panel">
                  <ol className="exercise-instructions">{exercise.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
                  <p className="coaching-tip"><strong>Coach&apos;s cue</strong> {exercise.coachingTip}</p>
                  {exercise.homeOption && <p className="home-option">{exercise.homeOption}</p>}
                </div>
                <aside className="library-video-panel" aria-label={`${exercise.name} video demonstration`}>
                  <span className="eyebrow">VIDEO DEMONSTRATION</span>
                  <ExerciseVideoSearch exerciseId={exercise.id} exerciseName={exercise.name} gender={visualGender} />
                </aside>
              </div>
            </div>
          </article>
        })}
      </div>
    </div>
  )
}
