'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Check, Clock3, Dumbbell, ListPlus, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { deleteCustomRoutine, saveActiveWorkoutPlan, saveCustomRoutine } from '@/app/actions/routines'
import type { CustomRoutine, CustomRoutineExercise, Exercise } from '@/lib/fitness-data'

type ExerciseOption = Pick<Exercise, 'id' | 'name' | 'equipment' | 'focus' | 'areas' | 'duration'>

type Props = {
  initialRoutines: CustomRoutine[]
  initialActivePlan: CustomRoutine | null
  exercises: ExerciseOption[]
}

const defaultPrescription = { sets: 3, reps: 10, restSeconds: 60 }

function formatRoutineDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function CustomRoutineBuilder({ initialRoutines, initialActivePlan, exercises }: Props) {
  const [routines, setRoutines] = useState(initialRoutines)
  const [activePlan, setActivePlan] = useState(initialActivePlan)
  const [editingActivePlan, setEditingActivePlan] = useState(false)
  const [routineName, setRoutineName] = useState('')
  const [selectedExercises, setSelectedExercises] = useState<CustomRoutineExercise[]>([])
  const [editingRoutineId, setEditingRoutineId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deleteCandidateId, setDeleteCandidateId] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const exerciseById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises])
  const selectedIds = useMemo(() => new Set(selectedExercises.map((exercise) => exercise.exerciseId)), [selectedExercises])
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredExercises = useMemo(() => exercises.filter((exercise) => (
    !normalizedQuery || `${exercise.name} ${exercise.focus} ${exercise.equipment}`.toLowerCase().includes(normalizedQuery)
  )), [exercises, normalizedQuery])

  function startNewRoutine() {
    setRoutineName('')
    setSelectedExercises([])
    setEditingRoutineId(undefined)
    setEditingActivePlan(false)
    setError('')
    setStatus('')
  }

  function addExercise(exerciseId: string) {
    if (selectedIds.has(exerciseId)) return
    setSelectedExercises((current) => [...current, { exerciseId, ...defaultPrescription }])
    setError('')
    setStatus('')
  }

  function updateExercise(index: number, field: keyof Omit<CustomRoutineExercise, 'exerciseId'>, value: number) {
    setSelectedExercises((current) => current.map((exercise, currentIndex) => currentIndex === index ? { ...exercise, [field]: value } : exercise))
  }

  function moveExercise(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= selectedExercises.length) return
    setSelectedExercises((current) => {
      const reordered = [...current]
      ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]
      return reordered
    })
  }

  function editActivePlan() {
    if (!activePlan) return
    setEditingRoutineId(undefined)
    setEditingActivePlan(true)
    setRoutineName(activePlan.name)
    setSelectedExercises(activePlan.exercises.map((exercise) => ({ ...exercise })))
    setError('')
    setStatus('Editing your active workout plan.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editRoutine(routine: CustomRoutine) {
    setEditingRoutineId(routine.id)
    setEditingActivePlan(false)
    setRoutineName(routine.name)
    setSelectedExercises(routine.exercises.map((exercise) => ({ ...exercise })))
    setError('')
    setStatus('Editing a saved routine.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setStatus('')
    try {
      if (editingActivePlan) {
        const savedPlan = await saveActiveWorkoutPlan({ name: routineName, exercises: selectedExercises })
        setActivePlan(savedPlan)
        setStatus('Active workout plan saved to your profile.')
      } else {
        const savedRoutine = await saveCustomRoutine({ id: editingRoutineId, name: routineName, exercises: selectedExercises })
        setRoutines((current) => [savedRoutine, ...current.filter((routine) => routine.id !== savedRoutine.id)])
        setEditingRoutineId(savedRoutine.id)
        setStatus('Routine saved to your profile.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your routine could not be saved. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveDraftAsActivePlan() {
    setIsSaving(true)
    setError('')
    setStatus('')
    try {
      const savedPlan = await saveActiveWorkoutPlan({ name: routineName, exercises: selectedExercises })
      setActivePlan(savedPlan)
      setEditingRoutineId(undefined)
      setEditingActivePlan(true)
      setStatus('This routine is now your active workout plan.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your active plan could not be saved. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(routineId: string) {
    if (deleteCandidateId !== routineId) {
      setDeleteCandidateId(routineId)
      setStatus('Select confirm delete to permanently remove this routine.')
      return
    }
    setError('')
    setStatus('')
    try {
      await deleteCustomRoutine(routineId)
      setRoutines((current) => current.filter((routine) => routine.id !== routineId))
      setDeleteCandidateId('')
      if (editingRoutineId === routineId) startNewRoutine()
      setStatus('Routine deleted from your profile.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This routine could not be deleted.')
      setDeleteCandidateId('')
    }
  }

  return <main className="routine-page-shell">
    <header className="routine-page-header">
      <a className="routine-brand" href="/" aria-label="FitPilot dashboard"><span className="brand-mark">F</span><span>fitpilot</span></a>
      <a className="routine-back-link" href="/"><ArrowLeft size={15} aria-hidden="true" /> Back to dashboard</a>
    </header>
    <div className="routine-page-content">
      <div className="routine-page-intro">
        <p className="eyebrow">YOUR TRAINING, YOUR ORDER</p>
        <h1>Create a routine</h1>
        <p>Choose movements from your exercise library, arrange them into a sequence, and set the work and rest that suit you.</p>
      </div>
      <section className="routine-panel active-plan-callout" aria-labelledby="active-plan-heading">
        <div className="routine-panel-heading"><div><span className="routine-section-kicker">YOUR WORKOUT PLAYER</span><h2 id="active-plan-heading">Active workout plan</h2></div>{activePlan && <button type="button" className="secondary-button" onClick={editActivePlan}><Pencil size={14} aria-hidden="true" /> Edit active plan</button>}</div>
        {activePlan ? <><h3>{activePlan.name}</h3><p>{activePlan.exercises.length} movements · {activePlan.exercises.reduce((total, exercise) => total + exercise.sets, 0)} sets · Updated {formatRoutineDate(activePlan.updatedAt)}</p><ol className="active-plan-exercise-list">{activePlan.exercises.map((item) => <li key={item.exerciseId}>{exerciseById.get(item.exerciseId)?.name ?? 'Exercise'} <span>{item.sets} × {item.reps} · {item.restSeconds}s rest</span></li>)}</ol></> : <p>No custom plan is active yet. Save a routine as your active plan to use it in guided workouts.</p>}
      </section>
      <div className="routine-builder-layout">
        <section className="routine-panel routine-library-panel" aria-labelledby="routine-library-heading">
          <div className="routine-panel-heading">
            <div><span className="routine-section-kicker">EXERCISE LIBRARY</span><h2 id="routine-library-heading">Choose movements</h2></div>
            <span className="routine-count">{exercises.length} available</span>
          </div>
          <label className="routine-search"><span className="sr-only">Search exercises</span><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by name, focus, or equipment" /></label>
          <div className="routine-exercise-list" aria-live="polite">
            {filteredExercises.length === 0 && <p className="routine-empty-state">No exercises match that search.</p>}
            {filteredExercises.map((exercise) => <article className="routine-library-item" key={exercise.id}>
              <span className="routine-exercise-mark"><Dumbbell size={15} aria-hidden="true" /></span>
              <div className="routine-exercise-copy"><strong>{exercise.name}</strong><span>{exercise.focus} · {exercise.equipment}</span></div>
              <button type="button" className="routine-add-button" onClick={() => addExercise(exercise.id)} disabled={selectedIds.has(exercise.id)} aria-label={`${selectedIds.has(exercise.id) ? 'Added' : 'Add'} ${exercise.name}`}>
                {selectedIds.has(exercise.id) ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              </button>
            </article>)}
          </div>
        </section>

        <section className="routine-panel routine-editor-panel" aria-labelledby="routine-editor-heading">
          <div className="routine-panel-heading">
            <div><span className="routine-section-kicker">CUSTOM SESSION</span><h2 id="routine-editor-heading">{editingActivePlan ? 'Edit active plan' : editingRoutineId ? 'Edit your routine' : 'Build your sequence'}</h2></div>
            {(editingRoutineId || editingActivePlan) && <button type="button" className="routine-reset-button" onClick={startNewRoutine}>New routine</button>}
          </div>
          <form className="routine-form" onSubmit={handleSave}>
            <label className="routine-name-field"><span>Routine name</span><input type="text" value={routineName} onChange={(event) => setRoutineName(event.target.value)} maxLength={80} required placeholder="e.g. Monday strength" /></label>
            {selectedExercises.length === 0 ? <div className="routine-builder-empty"><ListPlus size={20} aria-hidden="true" /><strong>Your sequence starts here</strong><span>Add an exercise from the library to begin.</span></div> : <ol className="routine-selected-list">
              {selectedExercises.map((selectedExercise, index) => {
                const exercise = exerciseById.get(selectedExercise.exerciseId)
                if (!exercise) return null
                return <li className="routine-selected-item" key={selectedExercise.exerciseId}>
                  <div className="routine-selected-heading">
                    <span className="routine-order-number">{String(index + 1).padStart(2, '0')}</span>
                    <div className="routine-exercise-copy"><strong>{exercise.name}</strong><span>{exercise.equipment}</span></div>
                    <div className="routine-order-actions">
                      <button type="button" className="routine-icon-button" onClick={() => moveExercise(index, -1)} disabled={index === 0} aria-label={`Move ${exercise.name} up`}><ArrowUp size={15} aria-hidden="true" /></button>
                      <button type="button" className="routine-icon-button" onClick={() => moveExercise(index, 1)} disabled={index === selectedExercises.length - 1} aria-label={`Move ${exercise.name} down`}><ArrowDown size={15} aria-hidden="true" /></button>
                      <button type="button" className="routine-icon-button routine-remove-button" onClick={() => setSelectedExercises((current) => current.filter((item) => item.exerciseId !== exercise.id))} aria-label={`Remove ${exercise.name}`}><Trash2 size={15} aria-hidden="true" /></button>
                    </div>
                  </div>
                  <div className="routine-prescription-grid">
                    <label><span>Sets</span><input type="number" min={1} max={10} value={selectedExercise.sets} onChange={(event) => updateExercise(index, 'sets', Number(event.target.value))} /></label>
                    <label><span>Reps</span><input type="number" min={1} max={100} value={selectedExercise.reps} onChange={(event) => updateExercise(index, 'reps', Number(event.target.value))} /></label>
                    <label><span>Rest (sec)</span><input type="number" min={15} max={600} step={15} value={selectedExercise.restSeconds} onChange={(event) => updateExercise(index, 'restSeconds', Number(event.target.value))} /></label>
                  </div>
                </li>
              })}
            </ol>}
            {error && <p className="routine-message routine-error" role="alert">{error}</p>}
            {status && <p className="routine-message" role="status">{status}</p>}
            <div className="routine-form-footer">
              <span><Clock3 size={14} aria-hidden="true" /> {selectedExercises.length} movements · {selectedExercises.reduce((total, exercise) => total + exercise.sets, 0)} total sets</span>
              {editingActivePlan ? <button type="submit" className="primary-button" disabled={isSaving || selectedExercises.length === 0}>{isSaving ? 'Saving…' : <><Save size={15} aria-hidden="true" /> Save active plan</>}</button> : <><button type="submit" className="primary-button" disabled={isSaving || selectedExercises.length === 0}>{isSaving ? 'Saving…' : <><Save size={15} aria-hidden="true" /> Save routine</>}</button><button type="button" className="secondary-button" onClick={saveDraftAsActivePlan} disabled={isSaving || selectedExercises.length === 0}>{isSaving ? 'Saving…' : 'Use as active plan'}</button></>}
            </div>
          </form>
        </section>
      </div>

      <section className="routine-saved-section" aria-labelledby="saved-routines-heading">
        <div className="routine-saved-heading"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2 id="saved-routines-heading">Saved routines</h2></div><span>{routines.length} in your profile</span></div>
        {routines.length === 0 ? <p className="routine-saved-empty">Your saved routines will appear here.</p> : <div className="routine-saved-list">
          {routines.map((routine) => <article className="routine-saved-card" key={routine.id}>
            <div className="routine-saved-card-copy"><strong>{routine.name}</strong><span>{routine.exercises.length} movements · {routine.exercises.reduce((total, exercise) => total + exercise.sets, 0)} sets · Saved {formatRoutineDate(routine.updatedAt)}</span></div>
            <div className="routine-saved-actions">
              <button type="button" className="secondary-button" onClick={() => editRoutine(routine)}><Pencil size={14} aria-hidden="true" /> Edit</button>
              <button type="button" className="routine-delete-button" onClick={() => handleDelete(routine.id)} aria-label={deleteCandidateId === routine.id ? `Confirm delete ${routine.name}` : `Delete ${routine.name}`}>
                <Trash2 size={14} aria-hidden="true" /> {deleteCandidateId === routine.id ? 'Confirm delete' : 'Delete'}
              </button>
            </div>
          </article>)}
        </div>}
      </section>
    </div>
  </main>
}
