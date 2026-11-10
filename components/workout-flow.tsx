'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { completeWorkout, startWorkout, updateWorkoutSet, type ActiveWorkoutState, type WorkoutSetState } from '@/app/actions/fitness'
import { labelForExperience, type ExerciseVisualGender, type ExperienceLevel, type FitnessProfile } from '@/lib/fitness-data'
import { ExerciseMediaGallery } from '@/components/exercise-media-gallery'
import { ExerciseVisualGenderToggle } from '@/components/exercise-visual-gender-toggle'
import { useVoiceCoach } from '@/lib/use-voice-coach'

const WORK_SECONDS = 40

type PlayerStage = 'checkin' | 'tutorial' | 'ready' | 'active' | 'rest' | 'all-done' | 'finished'
type TimerKind = 'work' | 'rest'
type TimerState = { id: number; kind: TimerKind; seconds: number; paused: boolean; endsAt: number }
type SetPosition = { exerciseIndex: number; setIndex: number }

function getNextSetPosition(workout: ActiveWorkoutState | null): SetPosition | null {
  if (!workout) return null
  for (let exerciseIndex = 0; exerciseIndex < workout.exercises.length; exerciseIndex += 1) {
    const setIndex = workout.exercises[exerciseIndex].workoutSets.findIndex((set) => !set.completed)
    if (setIndex >= 0) return { exerciseIndex, setIndex }
  }
  return null
}

function patchWorkoutSet(workout: ActiveWorkoutState, exerciseId: string, setId: string, update: Partial<WorkoutSetState>): ActiveWorkoutState {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise,
      workoutSets: exercise.workoutSets.map((set) => set.id === setId ? { ...set, ...update } : set),
    }),
  }
}

function getTutor(gender: ExerciseVisualGender) {
  if (gender === 'male') return { name: 'Jordan', label: 'Male demo visuals', image: '/coaches/coach-man.png', alt: 'Jordan demonstrating exercise movements in a bright training studio.' }
  return { name: 'Maya', label: 'Female demo visuals', image: '/coaches/coach-woman.png', alt: 'Maya demonstrating exercise movements in a bright training studio.' }
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function WorkoutFlow({
  profile,
  visualGender,
  onVisualGenderChange,
  initialWeightKg,
  initialWorkout,
  onClose,
  onStarted,
  onCompleted,
  standalone = false,
}: {
  profile: FitnessProfile
  visualGender: ExerciseVisualGender
  onVisualGenderChange: (gender: ExerciseVisualGender) => void
  initialWeightKg: number
  initialWorkout: ActiveWorkoutState | null
  onClose: () => void
  onStarted: (workout: ActiveWorkoutState) => void
  onCompleted: () => void
  standalone?: boolean
}) {
  const [workout, setWorkout] = useState<ActiveWorkoutState | null>(initialWorkout)
  const [position, setPosition] = useState<SetPosition | null>(() => getNextSetPosition(initialWorkout))
  const [stage, setStage] = useState<PlayerStage>(() => initialWorkout ? getNextSetPosition(initialWorkout) ? 'tutorial' : 'all-done' : 'checkin')
  const [weight, setWeight] = useState(String(initialWeightKg))
  const [reflection, setReflection] = useState('')
  const [busy, setBusy] = useState(false)
  const [busySetId, setBusySetId] = useState('')
  const [error, setError] = useState('')
  const [levelUp, setLevelUp] = useState<ExperienceLevel | null>(null)
  const [alreadyAdvancedThisWeek, setAlreadyAdvancedThisWeek] = useState(false)
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [afterRestStage, setAfterRestStage] = useState<PlayerStage>('ready')
  const [workIntervalFinished, setWorkIntervalFinished] = useState(false)
  const [tutorialHasPlayed, setTutorialHasPlayed] = useState(false)
  const timerSequence = useRef(0)
  const timerFinished = useRef<(() => void) | null>(null)
  const tutor = getTutor(visualGender)
  const currentExercise = position && workout ? workout.exercises[position.exerciseIndex] : null
  const currentSet = currentExercise && position ? currentExercise.workoutSets[position.setIndex] : null
  const allSets = workout?.exercises.flatMap((exercise) => exercise.workoutSets) ?? []
  const completedCount = allSets.filter((set) => set.completed).length
  const timerId = timer?.id
  const timerPaused = timer?.paused
  const { enabled: voiceCoachEnabled, supported: voiceCoachSupported, toggle: toggleVoiceCoach, speakText, stop: stopVoiceCoach } = useVoiceCoach({ gender: visualGender })

  const closePlayer = useCallback(() => {
    stopVoiceCoach()
    if (workout && stage !== 'finished') onStarted(workout)
    onClose()
  }, [onClose, onStarted, stage, stopVoiceCoach, workout])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !standalone && !busy && !busySetId) closePlayer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, busySetId, closePlayer, standalone])

  useEffect(() => {
    if (!timerId || timerPaused) return
    const intervalId = window.setInterval(() => {
      setTimer((current) => {
        if (!current || current.id !== timerId) return current
        const seconds = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
        if (seconds === 0) return null
        return seconds === current.seconds ? current : { ...current, seconds }
      })
    }, 200)
    return () => window.clearInterval(intervalId)
  }, [timerId, timerPaused])

  useEffect(() => {
    if (timer || !timerFinished.current) return
    const onFinish = timerFinished.current
    timerFinished.current = null
    onFinish()
  }, [timer])

  function startTimer(kind: TimerKind, seconds: number, onFinish: () => void) {
    timerSequence.current += 1
    timerFinished.current = onFinish
    setTimer({ id: timerSequence.current, kind, seconds, paused: false, endsAt: Date.now() + seconds * 1000 })
  }

  function toggleTimer() {
    if (!timer) return
    if (timer.paused) {
      setTimer({ ...timer, paused: false, endsAt: Date.now() + timer.seconds * 1000 })
      return
    }
    const seconds = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))
    if (seconds === 0) {
      setTimer(null)
      return
    }
    stopVoiceCoach()
    setTimer({ ...timer, seconds, paused: true, endsAt: Date.now() + seconds * 1000 })
  }

  function cancelTimer() {
    stopVoiceCoach()
    timerFinished.current = null
    setTimer(null)
  }

  async function beginSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const started = await startWorkout({ weightKg: Number(weight), reflection })
      setWorkout(started)
      setPosition(getNextSetPosition(started))
      setStage('tutorial')
      onStarted(started)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not start your session. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function playTutorial() {
    if (!currentExercise) return
    speakText(currentExercise.instructions.join(' '))
    setTutorialHasPlayed(true)
  }

  function beginInterval() {
    stopVoiceCoach()
    speakText(`Your ${WORK_SECONDS}-second work interval starts now.`)
    setStage('active')
    setWorkIntervalFinished(false)
    startTimer('work', WORK_SECONDS, () => {
      speakText('Interval complete. Record your set when you are ready.')
      setWorkIntervalFinished(true)
    })
  }

  function finishIntervalEarly() {
    cancelTimer()
    setWorkIntervalFinished(true)
  }

  function skipRest() {
    cancelTimer()
    beginInterval()
  }

  function updateCurrentSet(update: Partial<WorkoutSetState>) {
    if (!workout || !currentExercise || !currentSet) return
    setWorkout((current) => current ? patchWorkoutSet(current, currentExercise.id, currentSet.id, update) : current)
  }

  async function completeCurrentSet() {
    if (!workout || !currentExercise || !currentSet || busySetId) return
    stopVoiceCoach()
    const repsCompleted = currentSet.repsCompleted ?? currentSet.targetReps
    if (repsCompleted < 1) {
      setError('Record at least one rep before saving this set.')
      return
    }

    const updatedWorkout = patchWorkoutSet(workout, currentExercise.id, currentSet.id, { completed: true, repsCompleted })
    const nextPosition = getNextSetPosition(updatedWorkout)
    const nextExercise = nextPosition ? updatedWorkout.exercises[nextPosition.exerciseIndex] : null

    setBusySetId(currentSet.id)
    setError('')
    try {
      await updateWorkoutSet({ sessionId: workout.id, setId: currentSet.id, completed: true, repsCompleted, weightKg: currentSet.weightKg })
      setWorkout(updatedWorkout)
      onStarted(updatedWorkout)
      if (!nextPosition || !nextExercise) {
        setPosition(null)
        setStage('all-done')
        return
      }
      const nextMovement = nextPosition.exerciseIndex !== position?.exerciseIndex
      const restStage: PlayerStage = nextMovement ? 'tutorial' : 'ready'
      if (nextMovement) setTutorialHasPlayed(false)
      setPosition(nextPosition)
      setAfterRestStage(restStage)
      setStage('rest')
      speakText(`Take ${currentExercise.restSeconds} seconds to recover.`)
      startTimer('rest', currentExercise.restSeconds, () => {
        speakText('Rest complete. You are ready for the next set.')
        setStage(restStage)
      })
    } catch (cause) {
      stopVoiceCoach()
      setError(cause instanceof Error ? cause.message : 'This set could not be saved.')
    } finally {
      setBusySetId('')
    }
  }

  async function finishSession() {
    if (!workout) return
    stopVoiceCoach()
    setBusy(true)
    setError('')
    try {
      const result = await completeWorkout(workout.id)
      setLevelUp(result.advancedTo)
      setAlreadyAdvancedThisWeek(result.alreadyAdvancedThisWeek)
      setStage('finished')
      onCompleted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Complete every set before finishing.')
    } finally {
      setBusy(false)
    }
  }

  const timerLabel = timer?.kind === 'work' ? 'Movement interval' : timer?.kind === 'rest' ? 'Rest interval' : ''
  const currentStepNumber = position ? position.exerciseIndex + 1 : 0
  const totalSteps = workout?.exercises.length ?? 0

  return <div className={standalone ? 'training-page-shell' : 'modal-backdrop'} role={standalone ? undefined : 'presentation'}>
    <section className={`workout-dialog workout-player-dialog${standalone ? ' training-page-panel' : ''}`} role={standalone ? undefined : 'dialog'} aria-modal={standalone ? undefined : true} aria-labelledby="workout-dialog-title">
      <header className="dialog-header"><div><span className="eyebrow">{workout ? 'GUIDED SESSION' : 'BEFORE YOU BEGIN'}</span><h2 id="workout-dialog-title">{stage === 'finished' ? 'Nice work, ' + profile.name + '.' : workout ? workout.sessionName : 'Quick check-in'}</h2></div><div className="dialog-header-actions">{workout && stage !== 'finished' && <button type="button" className="voice-coach-toggle" onClick={toggleVoiceCoach} disabled={!voiceCoachSupported} aria-pressed={voiceCoachEnabled} aria-label={voiceCoachSupported ? `${voiceCoachEnabled ? 'Mute' : 'Unmute'} Voice Coach` : 'Voice Coach unavailable in this browser'} title={voiceCoachSupported ? undefined : 'Voice coaching is not supported in this browser'}>{voiceCoachEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}<span className="voice-coach-toggle-label">Voice Coach</span><span className="voice-coach-mobile-label">Voice</span><strong>{voiceCoachSupported ? voiceCoachEnabled ? 'Mute' : 'Unmute' : 'Unavailable'}</strong></button>}<button type="button" className={standalone ? 'training-back-button' : 'modal-close'} onClick={closePlayer} aria-label={standalone ? 'Back to dashboard' : 'Close workout'}>{standalone ? <><ArrowLeft size={16} aria-hidden="true" /><span>Dashboard</span></> : <X size={20} />}</button></div></header>
      {!workout && <form className="checkin-form" onSubmit={beginSession}>
        <p className="dialog-lede">Every workout begins with a fresh check-in. Add your current weight and a short reflection before your guided session.</p>
        <label className="field"><span>Current weight <b>kg</b></span><input type="number" required min={20} max={500} step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
        <label className="field"><span>How are you feeling about your progress today?</span><textarea required minLength={3} maxLength={1000} rows={4} value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Energy, confidence, recovery, or anything you want to remember…" /></label>
        <p className="form-note">This check-in is saved with your session. Rest whenever you need it; you can pause or close the player at any time.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button dialog-primary" disabled={busy}>{busy ? 'Saving check-in…' : 'Save check-in & start'} <Play size={15} fill="currentColor" /></button>
      </form>}
      {workout && stage !== 'finished' && <div className="guided-player">
        <div className="session-progress"><span>{completedCount} of {allSets.length} sets complete</span><span>{Math.round((completedCount / Math.max(allSets.length, 1)) * 100)}%</span></div>
        <div className="session-progress-track"><span style={{ width: `${(completedCount / Math.max(allSets.length, 1)) * 100}%` }} /></div>
        {stage === 'all-done' && <div className="player-complete-state"><span className="finish-check"><Check size={24} /></span><p>Every set is logged. Take a breath, then save your session.</p><button type="button" className="primary-button dialog-primary" disabled={busy} onClick={finishSession}>{busy ? 'Saving session…' : 'Complete workout'} <ArrowRight size={17} /></button></div>}
        {currentExercise && currentSet && stage !== 'all-done' && <>
          <div className="player-title-row"><div><p className="eyebrow">MOVEMENT {currentStepNumber} OF {totalSteps} <span className="player-dot" /> SET {currentSet.setNumber} OF {currentExercise.workoutSets.length}</p><h3>{currentExercise.name}</h3><p>{currentExercise.focus} · {currentExercise.equipment}</p></div><div className="player-media-controls"><ExerciseVisualGenderToggle gender={visualGender} onChange={onVisualGenderChange} compact /><span className="coach-match-pill">{tutor.label}</span></div></div>
          <div className={`trainer-screen ${stage === 'rest' ? 'trainer-screen-rest' : ''}`}>
            <Image src={tutor.image} alt={tutor.alt} width={960} height={720} className="trainer-photo" priority />
            <div className="trainer-scrim" />
            <div className="trainer-badge"><span>YOUR FITPILOT COACH</span><strong>{tutor.name}</strong></div>
            {timer && <div className={`timer-card ${timer.kind === 'work' ? 'timer-card-work' : ''}`}><span>{timerLabel}</span><strong aria-label={`${timer.seconds} seconds remaining`} aria-live="off">{formatTime(timer.seconds)}</strong>{timer.kind !== 'work' && <button type="button" aria-label={timer.paused ? 'Resume timer' : 'Pause timer'} onClick={toggleTimer}>{timer.paused ? <Play size={16} /> : <Pause size={16} />}</button>}</div>}
            {stage === 'rest' && <div className="rest-message"><span>RECOVER AT YOUR PACE</span><strong>Slow breath in.<br />Long breath out.</strong></div>}
          </div>
          <div className="workout-guidance-layout">
            <section className="tutorial-panel" aria-label={`${currentExercise.name} instructions`}>
              <div className="tutorial-heading"><div><span className="eyebrow">EXERCISE INSTRUCTIONS</span><h4>Follow these form cues</h4></div></div>
              <ol className="tutorial-cues">{currentExercise.instructions.map((instruction, index) => <li key={instruction}><span>{String(index + 1).padStart(2, '0')}</span><p>{instruction}</p></li>)}</ol>
              {stage === 'tutorial' && <><p className="tutorial-status" role="status">{tutorialHasPlayed ? 'Procedures read. Continue when you are ready.' : 'Review the procedures, then continue when you are ready.'}</p><button type="button" className="primary-button dialog-primary" onClick={playTutorial}><Play size={15} fill="currentColor" /> {tutorialHasPlayed ? 'Replay spoken procedures' : 'Hear spoken procedures'}</button></>}
            </section>
            <aside className="workout-video-panel" aria-label={`${currentExercise.name} video demonstration`}>
              <span className="eyebrow">VISUAL GUIDE</span>
              <h4>Watch the movement</h4>
              <ExerciseMediaGallery key={`${currentExercise.id}-${visualGender}`} exerciseName={currentExercise.name} gender={visualGender} autoLoad />
            </aside>
          </div>
          {stage === 'tutorial' && <div className="player-action-panel"><p className="dialog-lede">The coach will read only the movement procedures. This session waits here until you choose to continue.</p><button type="button" className="primary-button dialog-primary" onClick={() => setStage('ready')}>Continue when ready <ArrowRight size={16} /></button></div>}
          {stage === 'ready' && <div className="player-action-panel"><p className="dialog-lede">Use a comfortable range and stop if you feel sharp pain, dizziness, or unusual shortness of breath.</p><button type="button" className="primary-button dialog-primary" onClick={beginInterval}><Play size={15} fill="currentColor" /> Start {WORK_SECONDS}-second interval</button><button type="button" className="secondary-button dialog-secondary" onClick={() => { setStage('tutorial'); playTutorial() }}><RotateCcw size={15} /> Review procedures</button></div>}
          {stage === 'active' && <div className="player-action-panel">
            {timer?.kind === 'work' && <button type="button" className="secondary-button dialog-secondary" aria-label={timer.paused ? 'Resume work interval' : 'Pause work interval'} onClick={toggleTimer}>{timer.paused ? <Play size={15} /> : <Pause size={15} />}{timer.paused ? 'Resume interval' : 'Pause interval'}</button>}
            <div className="set-entry-row"><label className="field"><span>Reps completed</span><input type="number" min={1} max={100} value={currentSet.repsCompleted ?? currentSet.targetReps} onChange={(event) => updateCurrentSet({ repsCompleted: event.target.value === '' ? null : Number(event.target.value) })} /></label><label className="field"><span>Load <b>kg</b></span><input type="number" min={0} max={500} step="0.5" placeholder="Optional" value={currentSet.weightKg ?? ''} onChange={(event) => updateCurrentSet({ weightKg: event.target.value === '' ? null : Number(event.target.value) })} /></label></div>
            {timer?.kind === 'work' && <button type="button" className="secondary-button dialog-secondary" onClick={finishIntervalEarly}><SkipForward size={15} /> Finish interval early</button>}
            {!timer && <p className="form-note" role="status">Interval complete. Record your set, then take your recovery break.</p>}
            <button type="button" className="primary-button dialog-primary" disabled={!workIntervalFinished || Boolean(busySetId)} onClick={completeCurrentSet}>{busySetId ? 'Saving set…' : 'Save set & rest'} <ArrowRight size={16} /></button>
          </div>}
          {stage === 'rest' && <div className="player-action-panel"><p className="dialog-lede">Take the full break if you need it. The next set will begin with a clear cue.</p>{timer?.kind === 'rest' && <button type="button" className="secondary-button dialog-secondary" onClick={skipRest}><RotateCcw size={15} /> Skip rest</button>}</div>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </>}
      </div>}
      {stage === 'finished' && <div className="workout-finished"><span className="finish-check"><Check size={24} /></span><p role="status">{levelUp ? `You completed this week’s training goal and advanced to ${labelForExperience(levelUp)}. Your updated plan is ready.` : alreadyAdvancedThisWeek ? 'Your session is saved. You have already advanced this week; you can unlock another level in a future training week.' : 'Your session is saved. Strength, consistency, and how you feel all count as progress.'}</p><button type="button" className="primary-button dialog-primary" onClick={closePlayer}>Back to overview <ArrowRight size={17} /></button></div>}
    </section>
  </div>
}
