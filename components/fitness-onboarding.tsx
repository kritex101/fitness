'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Dumbbell, HeartPulse, Ruler, Target } from 'lucide-react'
import { saveOnboarding, type OnboardingInput } from '@/app/actions/fitness'
import { experienceLevels, genderOptions, goals, trainingEnvironments, type ExperienceLevel, type FitnessGoal, type GenderIdentity, type TrainingEnvironment } from '@/lib/fitness-data'

const steps = [
  { title: 'A little about you', icon: HeartPulse },
  { title: 'Your goal', icon: Target },
  { title: 'Your experience', icon: Check },
  { title: 'Your training space', icon: Dumbbell },
]

type Draft = Omit<OnboardingInput, 'age' | 'weightKg' | 'heightCm'> & {
  age: string
  weightKg: string
  heightCm: string
}

export function FitnessOnboarding({ initialName }: { initialName: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>({
    name: initialName,
    age: '',
    gender: 'prefer_not_to_say',
    weightKg: '',
    heightCm: '',
    goal: 'build_muscle',
    experience: 'beginner',
    environment: 'home',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function continueStep() {
    const form = document.getElementById('fitness-onboarding-form') as HTMLFormElement | null
    if (step === 0 && !form?.reportValidity()) return
    setError('')
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    const payload: OnboardingInput = {
      ...draft,
      age: Number(draft.age),
      weightKg: Number(draft.weightKg),
      heightCm: Number(draft.heightCm),
    }

    try {
      await saveOnboarding(payload)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not save your profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const StepIcon = steps[step].icon

  return (
    <main className="onboarding-page">
      <div className="onboarding-topline"><a className="brand" href="/" aria-label="FitPilot home"><span className="brand-mark">F</span><span>fitpilot</span></a><span className="step-count">STEP {step + 1} OF {steps.length}</span></div>
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="step-progress" role="progressbar" aria-label="Profile setup progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className="onboarding-heading"><span className="onboarding-icon"><StepIcon size={19} aria-hidden="true" /></span><p className="eyebrow">YOUR TRAINING, GROUNDED IN YOU</p><h1 id="onboarding-title">{steps[step].title}</h1><p className="onboarding-subtitle">{step === 0 ? 'We use these details to make your plan relevant and safe.' : step === 1 ? 'Choose the result you want your training to support.' : step === 2 ? 'We will match the starting volume to what feels familiar.' : 'Your plan will only use equipment you can access.'}</p></div>
        <form id="fitness-onboarding-form" className="onboarding-form" onSubmit={handleSubmit}>
          {step === 0 && <div className="form-grid">
            <label className="field field-full"><span>Name</span><input autoComplete="name" required maxLength={80} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" /></label>
            <label className="field"><span>Age</span><input type="number" min={18} max={100} step={1} required value={draft.age} onChange={(event) => update('age', event.target.value)} placeholder="18+" /><small>FitPilot uses adult activity guidance and is for adults 18+.</small></label>
            <label className="field"><span>Gender</span><select value={draft.gender} onChange={(event) => update('gender', event.target.value as GenderIdentity)}>{genderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="field"><span>Current weight <b>kg</b></span><input type="number" min={20} max={500} step="0.1" required value={draft.weightKg} onChange={(event) => update('weightKg', event.target.value)} placeholder="e.g. 72" /></label>
            <label className="field"><span>Height <b>cm</b></span><input type="number" min={90} max={250} step="0.1" required value={draft.heightCm} onChange={(event) => update('heightCm', event.target.value)} placeholder="e.g. 170" /><small>Metric units keep check-ins consistent over time.</small></label>
            <div className="field-full privacy-callout"><Ruler size={16} /><span>Your measurements are private to your account. Weight is used to track trends, not to judge progress.</span></div>
          </div>}
          {step === 1 && <fieldset className="choice-fieldset"><legend className="sr-only">Choose your primary goal</legend><div className="choice-grid">{goals.map((goal) => <label key={goal.value} className={`choice-card ${draft.goal === goal.value ? 'choice-selected' : ''}`}><input className="choice-native" type="radio" name="goal" value={goal.value} checked={draft.goal === goal.value} onChange={() => update('goal', goal.value as FitnessGoal)} /><span className="choice-radio" aria-hidden="true">{draft.goal === goal.value && <Check size={12} />}</span><strong>{goal.label}</strong><small>{goal.detail}</small></label>)}</div><p className="form-note">Training supports your goal; body composition and scale weight can change at different rates.</p></fieldset>}
          {step === 2 && <fieldset className="choice-fieldset"><legend className="sr-only">Choose your training experience</legend><div className="choice-grid">{experienceLevels.map((level) => <label key={level.value} className={`choice-card ${draft.experience === level.value ? 'choice-selected' : ''}`}><input className="choice-native" type="radio" name="experience" value={level.value} checked={draft.experience === level.value} onChange={() => update('experience', level.value as ExperienceLevel)} /><span className="choice-radio" aria-hidden="true">{draft.experience === level.value && <Check size={12} />}</span><strong>{level.label}</strong><small>{level.detail}</small></label>)}</div><p className="form-note">A good starting point is one you can recover from. You can adjust as your confidence grows.</p></fieldset>}
          {step === 3 && <fieldset className="choice-fieldset"><legend className="sr-only">Choose your training environment</legend><div className="choice-grid">{trainingEnvironments.map((environment) => <label key={environment.value} className={`choice-card ${draft.environment === environment.value ? 'choice-selected' : ''}`}><input className="choice-native" type="radio" name="environment" value={environment.value} checked={draft.environment === environment.value} onChange={() => update('environment', environment.value as TrainingEnvironment)} /><span className="choice-radio" aria-hidden="true">{draft.environment === environment.value && <Check size={12} />}</span><strong>{environment.label}</strong><small>{environment.detail}</small></label>)}</div><p className="form-note">Your gender does not limit exercise choices. Plans are selected by goal, experience, and available equipment.</p></fieldset>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="onboarding-actions">{step > 0 ? <button type="button" className="secondary-button" onClick={() => { setError(''); setStep((current) => current - 1) }}><ArrowLeft size={16} /> Back</button> : <span />}{step < steps.length - 1 ? <button type="button" className="primary-button" onClick={continueStep}>Continue <ArrowRight size={17} /></button> : <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving your plan…' : 'Build my plan'} <ArrowRight size={17} /></button>}</div>
        </form>
      </section>
      <p className="onboarding-footnote">Evidence-led, not medical advice. If you have a condition or pain, check with a qualified health professional before training.</p>
    </main>
  )
}
