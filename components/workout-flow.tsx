'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX, X } from 'lucide-react'
import { completeWorkout, startWorkout, updateWorkoutSet, type ActiveWorkoutState, type WorkoutSetState } from '@/app/actions/fitness'
import { labelForExperience, type ExerciseVisualGender, type ExperienceLevel, type FitnessProfile } from '@/lib/fitness-data'
import { ExerciseVideoSearch } from '@/components/exercise-video-search'
import { ExerciseVisualGenderToggle } from '@/components/exercise-visual-gender-toggle'
import { useVoiceCoach } from '@/lib/use-voice-coach'

const TUTORIAL_SECONDS = 9
const WORK_SECONDS = 40

type PlayerStage = 'checkin' | 'tutorial' | 'ready' | 'active' | 'rest' | 'all-done' | 'finished'
type TimerKind = 'tutorial' | 'work' | 'rest'
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

function playTimerCue(context: AudioContext, isFinalCue: boolean) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(isFinalCue ? 880 : 620, context.currentTime)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.17)
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
}: {
  profile: FitnessProfile
  visualGender: ExerciseVisualGender
  onVisualGenderChange: (gender: ExerciseVisualGender) => void
  initialWeightKg: number
  initialWorkout: ActiveWorkoutState | null
  onClose: () => void
  onStarted: (workout: ActiveWorkoutState) => void
  onCompleted: () => void
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
  const [tutorialCueIndex, setTutorialCueIndex] = useState(0)
  const timerSequence = useRef(0)
  const timerFinished = useRef<(() => void) | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const lastAudioCue = useRef('')
  const tutor = getTutor(visualGender)
  const currentExercise = position && workout ? workout.exercises[position.exerciseIndex] : null
  const currentSet = currentExercise && position ? currentExercise.workoutSets[position.setIndex] : null
  const allSets = workout?.exercises.flatMap((exercise) => exercise.workoutSets) ?? []
  const completedCount = allSets.filter((set) => set.completed).length
  const timerId = timer?.id
  const timerPaused = timer?.paused
  const { enabled: voiceCoachEnabled, supported: voiceCoachSupported, toggle: toggleVoiceCoach, stop: stopVoiceCoach } = useVoiceCoach({
    gender: visualGender,
    announcementId: workout && position && currentExercise ? `${workout.id}:${position.exerciseIndex}:${currentExercise.id}` : '',
    exerciseName: currentExercise?.name ?? '',
    targetGroup: currentExercise?.focus ?? '',
    repCount: currentSet?.targetReps ?? 0,
    shouldAnnounce: stage === 'tutorial' && Boolean(currentExercise && currentSet),
  })
  const closePlayer = useCallback(() => {
    stopVoiceCoach()
    if (workout && stage !== 'finished') onStarted(workout)
    onClose()
  }, [onClose, onStarted, stage, stopVoiceCoach, workout])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !busySetId) closePlayer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, busySetId, closePlayer])

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

  useEffect(() => {
    if (!timer || timer.paused || timer.seconds > 3) return
    const context = audioContext.current
    if (!context || context.state !== 'running') return
    const cueKey = `${timer.id}:${timer.seconds}`
    if (lastAudioCue.current === cueKey) return
    lastAudioCue.current = cueKey
    playTimerCue(context, timer.seconds === 1)
  }, [timer?.id, timer?.kind, timer?.paused, timer?.seconds])

  useEffect(() => () => {
    if (audioContext.current && audioContext.current.state !== 'closed') void audioContext.current.close()
  }, [])

  useEffect(() => {
    if (timer?.kind !== 'tutorial' || !currentExercise) return
    const elapsed = TUTORIAL_SECONDS - timer.seconds
    setTutorialCueIndex(Math.min(currentExercise.instructions.length - 1, Math.floor(elapsed / 3)))
  }, [currentExercise, timer])

  function enableTimerAudio() {
    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) return
    const context = audioContext.current ?? new AudioContextConstructor()
    audioContext.current = context
    if (context.state === 'suspended') void context.resume().catch(() => {})
  }

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
    enableTimerAudio()
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
    enableTimerAudio()
    setStage('tutorial')
    setTutorialCueIndex(0)
    startTimer('tutorial', TUTORIAL_SECONDS, () => setStage('ready'))
  }

  function beginInterval() {
    enableTimerAudio()
    setStage('active')
    setWorkIntervalFinished(false)
    startTimer('work', WORK_SECONDS, () => setWorkIntervalFinished(true))
  }

  function finishIntervalEarly() {
    cancelTimer()
    setWorkIntervalFinished(true)
  }

  function updateCurrentSet(update: Partial<WorkoutSetState>) {
    if (!workout || !currentExercise || !currentSet) return
    setWorkout((current) => current ? patchWorkoutSet(current, currentExercise.id, currentSet.id, update) : current)
  }

  async function completeCurrentSet() {
    if (!workout || !currentExercise || !currentSet || busySetId) return
    const repsCompleted = currentSet.repsCompleted ?? currentSet.targetReps
    if (repsCompleted < 1) {
      setError('Record at least one rep before saving this set.')
      return
    }
    setBusySetId(currentSet.id)
    setError('')
    try {
      await updateWorkoutSet({ sessionId: workout.id, setId: currentSet.id, completed: true, repsCompleted, weightKg: currentSet.weightKg })
      const updatedWorkout = patchWorkoutSet(workout, currentExercise.id, currentSet.id, { completed: true, repsCompleted })
      setWorkout(updatedWorkout)
      onStarted(updatedWorkout)
      const nextPosition = getNextSetPosition(updatedWorkout)
      if (!nextPosition) {
        setPosition(null)
        setStage('all-done')
        return
      }
      const nextMovement = nextPosition.exerciseIndex !== position?.exerciseIndex
      const restStage: PlayerStage = nextMovement ? 'tutorial' : 'ready'
      setPosition(nextPosition)
      setAfterRestStage(restStage)
      setStage('rest')
      startTimer('rest', currentExercise.restSeconds, () => setStage(restStage))
    } catch (cause) {
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

  const timerLabel = timer?.kind === 'tutorial' ? 'Tutorial preview' : timer?.kind === 'work' ? 'Movement interval' : timer?.kind === 'rest' ? 'Rest interval' : ''
  const currentStepNumber = position ? position.exerciseIndex + 1 : 0
  const totalSteps = workout?.exercises.length ?? 0

  return <div className="modal-backdrop" role="presentation">
    <section className="workout-dialog workout-player-dialog" role="dialog" aria-modal="true" aria-labelledby="workout-dialog-title">
      <header className="dialog-header"><div><span className="eyebrow">{workout ? 'GUIDED SESSION' : 'BEFORE YOU BEGIN'}</span><h2 id="workout-dialog-title">{stage === 'finished' ? 'Nice work, ' + profile.name + '.' : workout ? workout.sessionName : 'Quick check-in'}</h2></div><div className="dialog-header-actions">{workout && stage !== 'finished' && <button type="button" className="voice-coach-toggle" onClick={toggleVoiceCoach} disabled={!voiceCoachSupported} aria-pressed={voiceCoachEnabled} aria-label={voiceCoachSupported ? `${voiceCoachEnabled ? 'Mute' : 'Unmute'} Voice Coach` : 'Voice Coach unavailable in this browser'} title={voiceCoachSupported ? undefined : 'Voice coaching is not supported in this browser'}>{voiceCoachEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}<span className="voice-coach-toggle-label">Voice Coach</span><span className="voice-coach-mobile-label">Voice</span><strong>{voiceCoachSupported ? voiceCoachEnabled ? 'Mute' : 'Unmute' : 'Unavailable'}</strong></button>}<button type="button" className="modal-close" onClick={closePlayer} aria-label="Close workout"><X size={20} /></button></div></header>
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
              <div className="tutorial-heading"><div><span className="eyebrow">EXERCISE INSTRUCTIONS</span><h4>Follow these form cues</h4></div>{stage === 'tutorial' && <span className="tutorial-length">{TUTORIAL_SECONDS}s preview</span>}</div>
              <ol className="tutorial-cues">{currentExercise.instructions.map((instruction, index) => <li className={tutorialCueIndex === index && timer?.kind === 'tutorial' ? 'tutorial-cue-active' : ''} key={instruction}><span>{String(index + 1).padStart(2, '0')}</span><p>{instruction}</p></li>)}</ol>
              {stage === 'tutorial' && (timer?.kind === 'tutorial' ? <p className="tutorial-status" role="status">{timer.paused ? 'Tutorial paused' : `Showing cue ${tutorialCueIndex + 1} of ${currentExercise.instructions.length}`}</p> : <button type="button" className="primary-button dialog-primary" onClick={playTutorial}><Play size={15} fill="currentColor" /> Play tutorial</button>)}
            </section>
            <aside className="workout-video-panel" aria-label={`${currentExercise.name} video demonstration`}>
              <span className="eyebrow">VISUAL GUIDE</span>
              <h4>Watch the movement</h4>
              <ExerciseVideoSearch key={currentExercise.id} exerciseId={currentExercise.id} exerciseName={currentExercise.name} gender={visualGender} autoLoad />
            </aside>
          </div>
          {stage === 'ready' && <div className="player-action-panel"><p className="dialog-lede">Tutorial complete. Use a comfortable range and stop if you feel sharp pain, dizziness, or unusual shortness of breath.</p><button type="button" className="primary-button dialog-primary" onClick={beginInterval}><Play size={15} fill="currentColor" /> Start {WORK_SECONDS}-second interval</button><button type="button" className="secondary-button dialog-secondary" onClick={playTutorial}><RotateCcw size={15} /> Replay tutorial</button></div>}
          {stage === 'active' && <div className="player-action-panel">
            {timer?.kind === 'work' && <button type="button" className="secondary-button dialog-secondary" aria-label={timer.paused ? 'Resume work interval' : 'Pause work interval'} onClick={toggleTimer}>{timer.paused ? <Play size={15} /> : <Pause size={15} />}{timer.paused ? 'Resume interval' : 'Pause interval'}</button>}
            <div className="set-entry-row"><label className="field"><span>Reps completed</span><input type="number" min={1} max={100} value={currentSet.repsCompleted ?? currentSet.targetReps} onChange={(event) => updateCurrentSet({ repsCompleted: event.target.value === '' ? null : Number(event.target.value) })} /></label><label className="field"><span>Load <b>kg</b></span><input type="number" min={0} max={500} step="0.5" placeholder="Optional" value={currentSet.weightKg ?? ''} onChange={(event) => updateCurrentSet({ weightKg: event.target.value === '' ? null : Number(event.target.value) })} /></label></div>
            {timer?.kind === 'work' && <button type="button" className="secondary-button dialog-secondary" onClick={finishIntervalEarly}><SkipForward size={15} /> Finish interval early</button>}
            {!timer && <p className="form-note" role="status">Interval complete. Record your set, then take your recovery break.</p>}
            <button type="button" className="primary-button dialog-primary" disabled={!workIntervalFinished || Boolean(busySetId)} onClick={completeCurrentSet}>{busySetId ? 'Saving set…' : 'Save set & rest'} <ArrowRight size={16} /></button>
          </div>}
          {stage === 'rest' && <div className="player-action-panel"><p className="dialog-lede">Take the full break if you need it. The next set will begin with a clear cue.</p>{timer?.kind === 'rest' && <button type="button" className="secondary-button dialog-secondary" onClick={() => { cancelTimer(); setStage(afterRestStage) }}><RotateCcw size={15} /> Skip rest</button>}</div>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </>}
      </div>}
      {stage === 'finished' && <div className="workout-finished"><span className="finish-check"><Check size={24} /></span><p role="status">{levelUp ? `You completed this week’s training goal and advanced to ${labelForExperience(levelUp)}. Your updated plan is ready.` : alreadyAdvancedThisWeek ? 'Your session is saved. You have already advanced this week; you can unlock another level in a future training week.' : 'Your session is saved. Strength, consistency, and how you feel all count as progress.'}</p><button type="button" className="primary-button dialog-primary" onClick={closePlayer}>Back to overview <ArrowRight size={17} /></button></div>}
    </section>
  </div>
}
