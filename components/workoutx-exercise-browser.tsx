'use client'

import { useCallback, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import useSWRInfinite from 'swr/infinite'
import { ExerciseMediaGallery } from '@/components/exercise-media-gallery'
import { ExerciseVisualGenderToggle } from '@/components/exercise-visual-gender-toggle'
import { workoutXTargets, type WorkoutXExercise } from '@/lib/workoutx-api'
import type { ExerciseVisualGender } from '@/lib/fitness-data'

const PAGE_SIZE = 6

type WorkoutXPageResponse = { exercises: WorkoutXExercise[]; total?: number }

async function fetchExercisePage(url: string): Promise<WorkoutXExercise[]> {
  const response = await fetch(url)
  const payload = await response.json() as WorkoutXPageResponse & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Could not load WorkoutX exercises.')
  return Array.isArray(payload.exercises) ? payload.exercises : []
}

export function WorkoutXExerciseBrowser({ gender }: { gender: ExerciseVisualGender }) {
  const [selectedTarget, setSelectedTarget] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [submittedName, setSubmittedName] = useState('')

  const getPageKey = useCallback((pageIndex: number, previousPageData: WorkoutXExercise[] | null) => {
    if (previousPageData && previousPageData.length < PAGE_SIZE) return null
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(pageIndex * PAGE_SIZE), model: gender })
    if (submittedName) params.set('name', submittedName)
    else if (selectedTarget) params.set('target', selectedTarget)
    return `/api/exercises?${params.toString()}`
  }, [gender, selectedTarget, submittedName])

  const { data, error, isLoading, isValidating, mutate, setSize, size } = useSWRInfinite<WorkoutXExercise[]>(getPageKey, fetchExercisePage, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  })

  const exercises = data?.flat() ?? []
  const lastPage = data?.[data.length - 1]
  const hasMore = lastPage?.length === PAGE_SIZE
  const targetLabel = workoutXTargets.find((option) => option.value === selectedTarget)?.label
  const resultsTitle = submittedName ? `Matches for “${submittedName}”` : selectedTarget ? `${targetLabel} exercises` : 'All exercises'
  const isLoadingMore = isValidating && Boolean(data?.length) && size > (data?.length ?? 0)

  function selectTarget(target: string) {
    setSelectedTarget(target)
    setSearchTerm('')
    setSubmittedName('')
    void setSize(1)
  }

  function searchByName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = searchTerm.trim().replace(/\s+/g, ' ')
    if (name.length < 2 || name.length > 80) return
    setSelectedTarget('')
    setSubmittedName(name)
    void setSize(1)
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
  }

  return (
    <section className="workoutx-browser" aria-label="WorkoutX exercise catalog">
      <form className="workoutx-search-form" onSubmit={searchByName}>
        <label className="workoutx-search-field">
          <span>Search by exercise name</span>
          <span className="workoutx-search-input"><Search size={16} aria-hidden="true" /><input type="search" value={searchTerm} maxLength={80} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={handleSearchKeyDown} placeholder="e.g. dumbbell row" /></span>
        </label>
        <button className="primary-button" type="submit" disabled={searchTerm.trim().length < 2}>Search exercises</button>
      </form>

      <div className="workoutx-targets" role="group" aria-label="Filter by target muscle">
        <button className={`workoutx-target-option ${!selectedTarget && !submittedName ? 'workoutx-target-selected' : ''}`} type="button" aria-pressed={!selectedTarget && !submittedName} onClick={() => selectTarget('')}>All targets</button>
        {workoutXTargets.map((target) => <button className={`workoutx-target-option ${selectedTarget === target.value ? 'workoutx-target-selected' : ''}`} type="button" key={target.value} aria-pressed={selectedTarget === target.value} onClick={() => selectTarget(target.value)}>{target.label}</button>)}
      </div>

      <div className="library-results-heading"><div><p className="eyebrow">WORKOUTX CATALOG</p><h2>{resultsTitle}</h2></div><div className="workoutx-result-tools"><p className="workoutx-result-count">{exercises.length ? `${exercises.length} loaded` : 'Search by name or target'}</p><ExerciseVisualGenderToggle gender={gender} /></div></div>

      {isLoading && <p className="workoutx-status" role="status"><LoaderCircle size={17} aria-hidden="true" /> Loading WorkoutX exercises…</p>}
      {error && <div className="workoutx-error" role="alert"><p>{error.message}</p><button type="button" onClick={() => { void mutate() }}>Try again</button></div>}
      {!isLoading && !error && exercises.length === 0 && <p className="exercise-empty-state" role="status">No WorkoutX exercises match this search. Try another target or name.</p>}

      <div className="exercise-library">
        {exercises.map((exercise, index) => (
          <article className="library-card" key={exercise.id}>
            <div className="library-copy">
              <div className="library-card-top"><span className="library-number">{String(index + 1).padStart(2, '0')}</span><span className="exercise-focus">{exercise.target}</span></div>
              <h3>{exercise.name}</h3>
              <div className="workoutx-card-meta"><span><strong>Target muscle</strong>{exercise.target}</span><span><strong>Equipment</strong>{exercise.equipment}</span></div>
              <div className="library-exercise-detail">
                <aside className="library-photo-panel" aria-label={`${exercise.name} photo illustration`}>
                  <span className="eyebrow">PHOTO ILLUSTRATION</span>
                  <ExerciseMediaGallery
                    key={`${exercise.id}-${gender}`}
                    exerciseName={exercise.name}
                    gender={gender}
                    fallbackInstructions={exercise.instructions.length ? exercise.instructions : ['Instructions are not available for this exercise.']}
                  />
                </aside>
              </div>
            </div>
          </article>
        ))}
      </div>

      {hasMore && <button className="workoutx-load-more" type="button" disabled={isLoadingMore} onClick={() => { void setSize(size + 1) }}>{isLoadingMore ? 'Loading more exercises…' : 'Load more exercises'}</button>}
    </section>
  )
}
