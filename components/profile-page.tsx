'use client'

import { ArrowRight, CalendarCheck, Scale, Target, UserRound } from 'lucide-react'
import { ProgressPanel } from '@/components/progress-panel'
import { labelForEnvironment, labelForExperience, labelForGoal, type FitnessProfile } from '@/lib/fitness-data'

type Checkin = { id: string; weightKg: number; reflection: string; createdAt: string }
type WorkoutSession = { id: string; sessionName: string; status: string; startedAt: string; endedAt: string | null }

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'FP'
}

export function ProfilePage({
  profile,
  email,
  checkins,
  sessions,
  hasActiveWorkout,
  onEditPlan,
}: {
  profile: FitnessProfile
  email: string
  checkins: Checkin[]
  sessions: WorkoutSession[]
  hasActiveWorkout: boolean
  onEditPlan: () => void
}) {
  const completedSessions = sessions.filter((session) => session.status === 'completed')
  const orderedCheckins = [...checkins].sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())
  const firstWeight = orderedCheckins[0]?.weightKg
  const latestWeight = orderedCheckins.at(-1)?.weightKg
  const weightChange = orderedCheckins.length > 1 && firstWeight !== undefined && latestWeight !== undefined ? latestWeight - firstWeight : null

  return <section className="page-section profile-page">
    <div className="section-heading">
      <div><p className="eyebrow">YOUR DETAILS, YOUR MOMENTUM</p><h1>Your profile</h1><p>Your training history and personal progress, together in one place.</p></div>
      <button className="primary-button" type="button" onClick={onEditPlan} disabled={hasActiveWorkout} title={hasActiveWorkout ? 'Finish your active workout before changing plans.' : undefined}>Edit my plan <ArrowRight size={16} /></button>
    </div>
    {hasActiveWorkout && <p className="profile-plan-note" role="status">Finish your active workout before changing plans.</p>}
    <div className="profile-overview-grid">
      <section className="panel profile-identity-card" aria-labelledby="profile-identity-heading">
        <div className="profile-identity-header"><span className="profile-avatar" aria-hidden="true">{initials(profile.name)}</span><div><span className="eyebrow"><UserRound size={13} /> ACCOUNT PROFILE</span><h2 id="profile-identity-heading">{profile.name}</h2><p>{email}</p></div></div>
        <div className="profile-detail-grid">
          <div><span>Training goal</span><strong>{labelForGoal(profile.goal)}</strong></div>
          <div><span>Experience</span><strong>{labelForExperience(profile.experience)}</strong></div>
          <div><span>Training space</span><strong>{labelForEnvironment(profile.environment)}</strong></div>
          <div><span>Age</span><strong>{profile.age}</strong></div>
        </div>
      </section>
      <section className="panel profile-highlights" aria-labelledby="profile-highlights-heading">
        <div className="panel-heading"><div><h2 id="profile-highlights-heading">Progress at a glance</h2><p>Keep showing up; the trend builds over time.</p></div><span className="panel-icon"><CalendarCheck size={17} aria-hidden="true" /></span></div>
        <div className="profile-stat-grid">
          <div className="profile-stat"><span>Workouts completed</span><strong>{completedSessions.length}</strong><small>Saved in your training history</small></div>
          <div className="profile-stat"><span>Progress check-ins</span><strong>{checkins.length}</strong><small>Weight and reflection entries</small></div>
          <div className="profile-stat"><span>Weight change</span><strong>{weightChange === null ? '—' : `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg`}</strong><small>{weightChange === null ? 'Add another check-in to see a trend' : 'Since your first recorded check-in'}</small></div>
        </div>
        <div className="profile-plan-current"><span className="profile-plan-icon"><Target size={15} aria-hidden="true" /></span><p><strong>Current focus</strong><span>{labelForGoal(profile.goal)} · {labelForExperience(profile.experience)}</span></p><Scale size={16} aria-hidden="true" /></div>
      </section>
    </div>
    <ProgressPanel checkins={checkins} sessions={sessions} goal={profile.goal} />
  </section>
}
