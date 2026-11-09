'use client'

import { Search } from 'lucide-react'
import { useState } from 'react'
import { ExerciseDbBrowser } from '@/components/exercise-db-browser'
import { ExerciseMediaGallery } from '@/components/exercise-media-gallery'
import { ExerciseVisualGenderToggle } from '@/components/exercise-visual-gender-toggle'
import { bodyAreas, type BodyArea, type ExerciseVisualGender, type PlannedExercise } from '@/lib/fitness-data'

type ExerciseCollection = 'plan' | 'all'

export function ExerciseLibrary({ exercises, visualGender: controlledVisualGender, onVisualGenderChange, initialVisualGender = 'male', initialCollection = 'plan' }: { exercises: PlannedExercise[]; visualGender?: ExerciseVisualGender; onVisualGenderChange?: (gender: ExerciseVisualGender) => void; initialVisualGender?: ExerciseVisualGender; initialCollection?: ExerciseCollection }) {
  const [selectedCollection, setSelectedCollection] = useState<ExerciseCollection>(initialCollection)
  const [selectedArea, setSelectedArea] = useState<BodyArea>('full-body')
  const [searchQuery, setSearchQuery] = useState('')
  const [localVisualGender, setLocalVisualGender] = useState<ExerciseVisualGender>(initialVisualGender)
  const visualGender = controlledVisualGender ?? localVisualGender
  const changeVisualGender = onVisualGenderChange ?? setLocalVisualGender
  const plannedById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const areaExercises = selectedArea === 'full-body' ? exercises : exercises.filter((exercise) => exercise.areas.includes(selectedArea))
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleExercises = normalizedQuery
    ? areaExercises.filter((exercise) => `${exercise.name} ${exercise.focus} ${exercise.equipment}`.toLowerCase().includes(normalizedQuery))
    : areaExercises
  const collectionTitle = selectedArea === 'full-body' ? 'Your complete session' : bodyAreas.find((area) => area.value === selectedArea)?.label
  const collectionPicker = (
    <div className="exercise-collection-picker" role="group" aria-label="Choose an exercise collection">
      {exercises.length > 0 && <button type="button" className={`exercise-collection-option ${selectedCollection === 'plan' ? 'exercise-collection-selected' : ''}`} aria-pressed={selectedCollection === 'plan'} onClick={() => setSelectedCollection('plan')}><strong>Your plan</strong><span>{exercises.length} planned movements</span></button>}
      <button type="button" className={`exercise-collection-option ${selectedCollection === 'all' ? 'exercise-collection-selected' : ''}`} aria-pressed={selectedCollection === 'all'} onClick={() => setSelectedCollection('all')}><strong>ExerciseDB catalog</strong><span>Search by target or name</span></button>
    </div>
  )

  if (selectedCollection === 'all') {
    return (
      <div className="exercise-library-wrap">
        {collectionPicker}
        <ExerciseDbBrowser gender={visualGender} onVisualGenderChange={changeVisualGender} />
      </div>
    )
  }

  return (
    <div className="exercise-library-wrap">
      {collectionPicker}
      <div className="body-area-picker" role="group" aria-label="Filter your plan by body area">
        {bodyAreas.map((area) => {
          const count = area.value === 'full-body' ? exercises.length : exercises.filter((exercise) => exercise.areas.includes(area.value)).length
          return <button type="button" key={area.value} className={`body-area-option ${selectedArea === area.value ? 'body-area-selected' : ''}`} aria-pressed={selectedArea === area.value} onClick={() => setSelectedArea(area.value)}>
            <span><strong>{area.label}</strong><small>{area.detail}</small></span><span className="body-area-count">{count}</span>
          </button>
        })}
      </div>
      <label className="exercise-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search planned exercises by name, focus, or equipment</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search your plan" /></label>
      <div className="library-results-heading"><div><p className="eyebrow">YOUR PERSONALIZED PLAN</p><h2>{collectionTitle}</h2></div><ExerciseVisualGenderToggle gender={visualGender} onChange={changeVisualGender} /></div>
      <div className="exercise-library">
        {visibleExercises.length === 0 && <p className="exercise-empty-state" role="status">No planned exercises match that search.</p>}
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
                  <span className="eyebrow">MOVEMENT GUIDE</span>
                  <ExerciseMediaGallery exerciseName={exercise.name} gender={visualGender} />
                </aside>
              </div>
            </div>
          </article>
        })}
      </div>
    </div>
  )
}
