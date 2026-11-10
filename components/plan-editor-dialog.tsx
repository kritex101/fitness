'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Save, X } from 'lucide-react'
import { updateFitnessPlan } from '@/app/actions/fitness'
import { experienceLevels, goals, trainingEnvironments, type ExperienceLevel, type FitnessGoal, type FitnessProfile, type TrainingEnvironment } from '@/lib/fitness-data'

type PlanDraft = Pick<FitnessProfile, 'goal' | 'experience' | 'environment'>

export function PlanEditorDialog({
  profile,
  hasActiveWorkout,
  onClose,
  onSaved,
}: {
  profile: FitnessProfile
  hasActiveWorkout: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<PlanDraft>({ goal: profile.goal, experience: profile.experience, environment: profile.environment })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateFitnessPlan(draft)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your plan could not be updated. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="modal-backdrop" role="presentation">
    <section className="workout-dialog plan-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-editor-title">
      <header className="dialog-header"><div><span className="eyebrow">MY PLAN</span><h2 id="plan-editor-title">Choose a different plan</h2></div><button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Close plan editor"><X size={20} /></button></header>
      <form className="plan-editor-form" onSubmit={handleSubmit}>
        <p className="dialog-lede">Update your goal, experience, or training space. Your new preferences shape future workouts; completed sessions stay in your history.</p>
        <label className="field"><span>Training goal</span><select required value={draft.goal} disabled={saving || hasActiveWorkout} onChange={(event) => setDraft((current) => ({ ...current, goal: event.target.value as FitnessGoal }))}>{goals.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}</select></label>
        <label className="field"><span>Experience level</span><select required value={draft.experience} disabled={saving || hasActiveWorkout} onChange={(event) => setDraft((current) => ({ ...current, experience: event.target.value as ExperienceLevel }))}>{experienceLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></label>
        <label className="field"><span>Training space</span><select required value={draft.environment} disabled={saving || hasActiveWorkout} onChange={(event) => setDraft((current) => ({ ...current, environment: event.target.value as TrainingEnvironment }))}>{trainingEnvironments.map((environment) => <option key={environment.value} value={environment.value}>{environment.label}</option>)}</select></label>
        {hasActiveWorkout && <p className="form-note" role="status">Finish your active workout before changing plans.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="plan-editor-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving || hasActiveWorkout}>{saving ? 'Saving plan…' : 'Save my plan'} {saving ? null : <Save size={15} />}</button></div>
      </form>
    </section>
  </div>
}
