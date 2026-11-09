'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, ArrowRight, BarChart3, BookOpen, CalendarDays, Check, CircleHelp, Clock3, Dumbbell, House, LogOut, Menu, Pencil, Settings2, Sparkles, Target, UserRound, X } from 'lucide-react'
import { SettingsControls } from '@/components/settings-controls'
import { SettingsDialog } from '@/components/settings-dialog'
import { PwaInstallPrompt } from '@/components/pwa-install-prompt'
import { ExerciseLibrary } from '@/components/exercise-library'
import { WeeklyTrainingSchedule } from '@/components/weekly-training-schedule'
import { ProgressPanel } from '@/components/progress-panel'
import { BodyMetricsPanel } from '@/components/body-metrics-panel'
import { WorkoutFlow } from '@/components/workout-flow'
import { ProfilePage } from '@/components/profile-page'
import { PlanEditorDialog } from '@/components/plan-editor-dialog'
import { authClient } from '@/lib/auth-client'
import { buildWorkoutPlan, labelForEnvironment, labelForExperience, labelForGoal, weeklySessionTarget, type ExerciseVisualGender, type FitnessProfile, type MetricSnapshot } from '@/lib/fitness-data'
import type { ActiveWorkoutState } from '@/app/actions/fitness'

type Checkin = { id: string; weightKg: number; reflection: string; createdAt: string }
type WorkoutSession = { id: string; sessionName: string; status: string; startedAt: string; endedAt: string | null }
type NavItem = 'Overview' | 'Training' | 'Progress' | 'Profile' | 'My plan' | 'Settings'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'FP'
}

function getWeek(date: Date, sessions: WorkoutSession[]) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    const key = current.toDateString()
    const done = sessions.some((session) => session.status === 'completed' && new Date(session.startedAt).toDateString() === key)
    return { label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(current).slice(0, 1), date: current.getDate(), today: current.toDateString() === date.toDateString(), done }
  })
}

function countCompletedThisWeek(sessions: WorkoutSession[]) {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return sessions.filter((session) => {
    const startedAt = new Date(session.startedAt)
    return session.status === 'completed' && startedAt >= start && startedAt < end
  }).length
}

export function FitPilotDashboard({
  profile,
  checkins,
  sessions,
  metrics,
  activeWorkout: initialWorkout,
  email,
}: {
  profile: FitnessProfile
  checkins: Checkin[]
  sessions: WorkoutSession[]
  metrics: MetricSnapshot[]
  activeWorkout: ActiveWorkoutState | null
  email: string
}) {
  const router = useRouter()
  const [activeNav, setActiveNav] = useState<NavItem>('Overview')
  const [workoutOpen, setWorkoutOpen] = useState(false)
  const [planEditorOpen, setPlanEditorOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [visualGender, setVisualGender] = useState<ExerciseVisualGender>(() => profile.gender === 'woman' ? 'female' : 'male')
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutState | null>(initialWorkout)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [week, setWeek] = useState(() => Array.from({ length: 7 }, (_, index) => ({ label: '', date: index + 1, today: false, done: false })))
  const [todayLabel, setTodayLabel] = useState('Today')
  const [signingOut, setSigningOut] = useState(false)
  const trainingGoalDays = weeklySessionTarget(profile.experience)
  const completedSessions = sessions.filter((session) => session.status === 'completed')
  const completedThisWeek = countCompletedThisWeek(completedSessions)
  const plan = useMemo(() => buildWorkoutPlan(profile, completedThisWeek), [completedThisWeek, profile])
  const latestWeight = checkins[0]?.weightKg ?? profile.weightKg

  useEffect(() => {
    const now = new Date()
    setWeek(getWeek(now, sessions))
    setTodayLabel(new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now))
  }, [sessions])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      router.push('/sign-in')
      router.refresh()
    } catch {
      setSigningOut(false)
    }
  }

  function openWorkout() {
    setWorkoutOpen(true)
    setMobileMenuOpen(false)
  }

  const navItems = [
    { name: 'Overview' as const, icon: House },
    { name: 'Training' as const, icon: Dumbbell },
    { name: 'Progress' as const, icon: BarChart3 },
    { name: 'Profile' as const, icon: UserRound },
    { name: 'My plan' as const, icon: CalendarDays },
    { name: 'Settings' as const, icon: Settings2 },
  ]

  return <div className="app-frame">
    <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#overview" aria-label="FitPilot home" onClick={() => setActiveNav('Overview')}><span className="brand-mark">F</span><span>fitpilot</span></a>
      <p className="nav-caption">YOUR WORKSPACE</p>
      <nav className="side-nav" aria-label="Main navigation">{navItems.map(({ name, icon: Icon }) => <button type="button" key={name} className={`nav-item ${activeNav === name ? 'nav-active' : ''}`} aria-current={activeNav === name ? 'page' : undefined} onClick={() => { setActiveNav(name); setMobileMenuOpen(false) }}><Icon size={18} aria-hidden="true" /><span>{name}</span>{name === 'Training' && <span className="nav-count">{plan.length}</span>}</button>)}<a className="nav-item" href="/exercises"><BookOpen size={18} aria-hidden="true" /><span>Exercise library</span></a></nav>
      <div className="sidebar-bottom">
        <div className="coach-card"><span className="coach-icon"><Sparkles size={16} aria-hidden="true" /></span><p>Small steps,<br /><strong>stronger habits.</strong></p></div>
        <button className="profile-row" type="button" onClick={handleSignOut} disabled={signingOut} aria-label={`Sign out ${profile.name}`}><span className="avatar">{initials(profile.name)}</span><span className="profile-copy"><strong>{profile.name}</strong><small>{email}</small></span><LogOut size={17} className="profile-more" aria-hidden="true" /></button>
      </div>
    </aside>
    <main className="main-area" id="overview">
      <header className="topbar">
        <button type="button" className="mobile-menu-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}>{mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <div className="breadcrumb"><span>FitPilot</span><span className="breadcrumb-slash">/</span><strong>{activeNav}</strong></div>
        <div className="topbar-actions"><span className="today-date">{todayLabel}</span><PwaInstallPrompt /><button type="button" className="help-button" aria-label="Open quick settings" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings2 size={18} /></button><button type="button" className="help-button" aria-label="View evidence-based guidance" onClick={() => setActiveNav('Progress')}><CircleHelp size={18} /></button></div>
      </header>
      <div className="dashboard-content">
        {activeNav === 'Overview' && <>
          <section className="welcome-row"><div><p className="eyebrow">{todayLabel.toUpperCase()} <span className="online-indicator"><i /> YOUR PLAN IS READY</span></p><h1>Welcome, {profile.name}<span className="wave">.</span></h1><p className="welcome-subtitle">A consistent session is a win. Let&apos;s meet you where you are today.</p></div><span className="profile-chip"><Activity size={15} /> {labelForExperience(profile.experience)}</span></section>
          <section className="hero-card" aria-labelledby="workout-heading"><div className="hero-copy"><span className="hero-kicker"><span className="hero-dot" /> YOUR NEXT SESSION</span><h2 id="workout-heading">Build your<br className="desktop-break" /> foundation.</h2><p>{activeWorkout ? 'Your current session is ready to continue.' : `${plan.length} movements, matched to your ${labelForEnvironment(profile.environment).toLowerCase()}.`}</p><div className="hero-meta"><span><Clock3 size={15} /> 30–45 min</span><span className="meta-divider" /><span><Dumbbell size={15} /> {plan.length} exercises</span><span className="meta-divider" /><span><Target size={15} /> {labelForGoal(profile.goal)}</span></div><button className="start-button" type="button" onClick={openWorkout}><span>{activeWorkout ? 'Resume session' : 'Start workout'}</span><ArrowRight size={17} /></button></div></section>
          <div className="overview-grid">
            <section className="panel week-panel" aria-labelledby="week-heading"><div className="panel-heading"><div><h2 id="week-heading">Your week</h2><p>{completedSessions.length} sessions completed overall</p></div><span className="panel-icon"><CalendarDays size={17} /></span></div><div className="week-strip" role="list" aria-label="Current week activity">{week.map((day, index) => <div className={`day-cell ${day.today ? 'day-today' : ''}`} key={`${day.label}-${index}`} role="listitem"><span className="day-name">{day.label}</span><span className="day-number">{day.date}</span><span className={`day-check ${day.done ? 'is-done' : ''}`}>{day.done && <Check size={11} strokeWidth={3} />}</span></div>)}</div><div className="week-summary"><span><span className="summary-mark"><Check size={13} /></span> {completedThisWeek} of {trainingGoalDays} weekly sessions</span><strong>{Math.min(100, Math.round((completedThisWeek / trainingGoalDays) * 100))}%</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, (completedThisWeek / trainingGoalDays) * 100)}%` }} /></div></section>
            <section className="panel momentum-panel" aria-labelledby="momentum-heading"><div className="panel-heading"><div><h2 id="momentum-heading">Steady progress</h2><p>Strength is more than the scale.</p></div><button type="button" className="text-link" onClick={() => setActiveNav('Progress')}>See progress <ArrowRight size={14} /></button></div><div className="momentum-main"><span className="momentum-number">{latestWeight.toFixed(1)}<small>kg</small></span><span className="momentum-divider" /><span className="momentum-meta"><strong>{checkins.length} check-ins</strong><small>Latest weight record</small></span></div><div className="momentum-note">{completedSessions.length ? `${completedSessions.length} completed sessions saved to your history.` : 'Your first completed workout will appear in your progress history.'}</div></section>
            <section className="panel lineup-panel" aria-labelledby="lineup-heading"><div className="panel-heading"><div><h2 id="lineup-heading">Next strength session</h2><p>Variation {String.fromCharCode(65 + (completedThisWeek % 3))} · {plan.length} movements</p></div><button type="button" className="text-link" onClick={() => setActiveNav('Training')}>Exercise guide <ArrowRight size={14} /></button></div><div className="lineup-list">{plan.slice(0, 3).map((exercise, index) => <div className="lineup-row" key={exercise.id}><span className="lineup-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{exercise.name}</strong><small>{exercise.equipment}</small></div><span className="lineup-reps">{exercise.repMin}–{exercise.repMax}</span></div>)}</div></section>
            <section className="panel goal-panel"><span className="eyebrow">YOUR FOCUS</span><h2>{labelForGoal(profile.goal)}</h2><p>{labelForEnvironment(profile.environment)} · {labelForExperience(profile.experience)}</p><button type="button" className="text-link" onClick={() => setActiveNav('My plan')}>Review your plan <ArrowRight size={14} /></button>            </section>
          </div>
          <BodyMetricsPanel profile={profile} snapshots={metrics} />
        </>}
        {activeNav === 'Training' && <section className="page-section"><div className="section-heading"><div><p className="eyebrow">BUILT AROUND YOUR GOAL</p><h1>Your training guide</h1><p>{plan.length} exercises for {labelForEnvironment(profile.environment).toLowerCase()}. Start light, focus on control, and progress gradually.</p></div><button className="primary-button" type="button" onClick={openWorkout}>{activeWorkout ? 'Resume session' : 'Start a session'} <ArrowRight size={16} /></button></div><WeeklyTrainingSchedule goal={profile.goal} experience={profile.experience} environment={profile.environment} /><ExerciseLibrary exercises={plan} visualGender={visualGender} onVisualGenderChange={setVisualGender} /></section>}
        {activeNav === 'Progress' && <section className="page-section"><div className="section-heading"><div><p className="eyebrow">YOUR HISTORY, NOT A SCORECARD</p><h1>Progress over time</h1><p>Check-ins, completed sessions, and reflections help you spot meaningful patterns.</p></div><button className="primary-button" type="button" onClick={openWorkout}>{activeWorkout ? 'Resume session' : 'Start a check-in'} <ArrowRight size={16} /></button></div><ProgressPanel checkins={checkins} sessions={sessions} goal={profile.goal} /></section>}
        {activeNav === 'Profile' && <ProfilePage profile={profile} email={email} checkins={checkins} sessions={sessions} hasActiveWorkout={Boolean(activeWorkout)} onEditPlan={() => setPlanEditorOpen(true)} />}
        {activeNav === 'My plan' && <section className="page-section"><div className="section-heading"><div><p className="eyebrow">YOUR STARTING POINT</p><h1>A plan that fits you</h1><p>Built from the choices you made at onboarding—not assumptions about your body.</p></div><button className="primary-button" type="button" onClick={openWorkout}>{activeWorkout ? 'Resume session' : 'Start a session'} <ArrowRight size={16} /></button></div><div className="plan-grid"><section className="panel plan-summary"><div className="plan-summary-heading"><span className="eyebrow">PRIMARY TARGET</span><button type="button" className="secondary-button plan-edit-button" onClick={() => setPlanEditorOpen(true)} disabled={Boolean(activeWorkout)} title={activeWorkout ? 'Finish your active workout before changing plans.' : undefined}><Pencil size={14} /> Edit plan</button></div><h2>{labelForGoal(profile.goal)}</h2><p>Your current plan uses {plan.length} full-body movements and {plan[0]?.sets} sets per movement. Beginners start with two weekly sessions; more experienced users start with three.</p><div className="plan-tags"><span><Target size={14} /> {labelForExperience(profile.experience)}</span><span><Dumbbell size={14} /> {labelForEnvironment(profile.environment)}</span></div><div className="plan-measurements"><div><span>Age</span><strong>{profile.age}</strong></div><div><span>Height</span><strong>{profile.heightCm.toFixed(0)} cm</strong></div><div><span>Starting weight</span><strong>{profile.weightKg.toFixed(1)} kg</strong></div></div></section><section className="panel guidance-panel"><span className="eyebrow">EVIDENCE-LED GUIDANCE</span><h2>Train for the long game.</h2><ul><li>WHO adult guidance: work toward 150–300 minutes of moderate activity weekly, plus muscle strengthening on 2 or more days.</li><li>Use a controlled load and stop if you feel sharp pain, dizziness, or unusual shortness of breath.</li><li>When you reach the top of the rep range for every set with steady form in two sessions, consider a small load increase.</li><li>Scale weight alone cannot distinguish muscle, fat, or normal water changes; trends need repeated, consistent check-ins.</li></ul><a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" target="_blank" rel="noreferrer">Read WHO physical activity guidance <ArrowRight size={14} /></a><a href="https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html" target="_blank" rel="noreferrer">Read CDC gradual weight guidance <ArrowRight size={14} /></a><p className="medical-note">FitPilot offers general fitness education, not medical advice. Talk with a qualified professional about health conditions, pain, pregnancy, or individualized weight targets.</p></section></div></section>}
        {activeNav === 'Settings' && <section className="page-section settings-page"><div className="section-heading"><div><p className="eyebrow">MAKE FITPILOT YOURS</p><h1>Settings</h1><p>Personalize the app&apos;s appearance and the way your Voice Coach guides each session.</p></div><button className="secondary-button settings-open-modal" type="button" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog"><Settings2 size={15} aria-hidden="true" /> Quick settings</button></div><SettingsControls idPrefix="settings-page" /></section>}
        <footer className="app-footer"><span>Made for your long game.</span><span><Activity size={14} /> One step at a time</span></footer>
      </div>
    </main>
    {workoutOpen && <WorkoutFlow profile={profile} visualGender={visualGender} onVisualGenderChange={setVisualGender} initialWeightKg={latestWeight} initialWorkout={activeWorkout} onClose={() => setWorkoutOpen(false)} onStarted={setActiveWorkout} onCompleted={() => { setActiveWorkout(null); router.refresh() }} />}
    {planEditorOpen && <PlanEditorDialog profile={profile} hasActiveWorkout={Boolean(activeWorkout)} onClose={() => setPlanEditorOpen(false)} onSaved={() => { setPlanEditorOpen(false); router.refresh() }} />}
    {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
  </div>
}
