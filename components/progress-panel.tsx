'use client'

import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import type { FitnessGoal } from '@/lib/fitness-data'

type Checkin = { id: string; weightKg: number; reflection: string; createdAt: string }
type WorkoutSession = { id: string; sessionName: string; status: string; startedAt: string; endedAt: string | null }

function trendCopy(checkins: Checkin[], goal: FitnessGoal) {
  const ordered = [...checkins].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  if (ordered.length < 3) return 'A few check-ins over time create a more useful trend. Daily weight can shift with hydration, meals, and timing.'
  const first = ordered[0]
  const latest = ordered[ordered.length - 1]
  const days = (new Date(latest.createdAt).getTime() - new Date(first.createdAt).getTime()) / 86_400_000
  if (days < 10) return 'You are building a baseline. Keep check-in conditions consistent and give the trend at least two weeks before changing your plan.'
  const delta = latest.weightKg - first.weightKg
  if (Math.abs(delta) < 0.2) return 'Your recorded weight is broadly steady across this period. Pair the trend with workout performance and how you feel.'
  const weightLossGoal = goal === 'lose_weight' || goal === 'get_lean'
  const movingWithGoal = weightLossGoal ? delta < 0 : delta > 0
  if (movingWithGoal) return `Your ${Math.abs(delta).toFixed(1)} kg change is moving in the direction of your selected goal. Weight alone cannot tell whether changes are muscle, fat, or water.`
  return 'Your recent scale trend is not yet moving toward your selected goal. Keep the routine consistent, review recovery, and avoid reacting to one weigh-in.'
}

export function ProgressPanel({ checkins, sessions, goal }: { checkins: Checkin[]; sessions: WorkoutSession[]; goal: FitnessGoal }) {
  const chartData = useMemo(() => [...checkins].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((checkin) => ({
    date: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(checkin.createdAt)),
    weight: checkin.weightKg,
  })), [checkins])
  const completedSessions = sessions.filter((session) => session.status === 'completed')
  const completedThisWeek = completedSessions.filter((session) => Date.now() - new Date(session.startedAt).getTime() <= 7 * 86_400_000).length
  const latest = [...checkins].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const first = [...checkins].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
  const delta = latest && first ? latest.weightKg - first.weightKg : 0

  return <section className="progress-layout" aria-labelledby="progress-title">
    <div className="panel progress-main">
      <div className="panel-heading"><div><h2 id="progress-title">Your progress, in context</h2><p>Use repeated check-ins and completed sessions—not one number—to spot patterns.</p></div></div>
      <div className="progress-stat-row">
        <div className="progress-stat"><span>Completed sessions</span><strong>{completedSessions.length}</strong><small>{completedThisWeek} in the last 7 days</small></div>
        <div className="progress-stat"><span>Latest check-in</span><strong>{latest ? `${latest.weightKg.toFixed(1)} kg` : '—'}</strong><small>{latest ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(latest.createdAt)) : 'Start a session to log weight'}</small></div>
        <div className="progress-stat"><span>Change since first log</span><strong className="delta-value">{first && latest ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg` : '—'}</strong><small>{checkins.length} total check-ins</small></div>
      </div>
      {chartData.length >= 2 ? <div className="chart-block">
        <ChartContainer config={{ weight: { label: 'Weight', color: 'var(--chart-1)' } }} className="weight-chart">
          <LineChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} minTickGap={18} />
            <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)} kg`} />} />
            <Line dataKey="weight" type="monotone" stroke="var(--color-weight)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-weight)' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartContainer>
        <p className="chart-caption">Weight check-ins are shown in kilograms. The chart is a record, not a body-composition measure.</p>
      </div> : <div className="chart-empty"><span className="chart-empty-line" /><strong>{checkins.length === 1 ? 'Your baseline is saved.' : 'Your first check-in starts the timeline.'}</strong><p>Log weight at the start of each session. A few consistent readings make trends easier to interpret.</p></div>}
      <div className="trend-note"><span className="trend-mark">i</span><p>{trendCopy(checkins, goal)}</p></div>
    </div>
    <div className="panel history-panel">
      <div className="panel-heading"><div><h2>Recent sessions</h2><p>Consistency is the signal.</p></div></div>
      {sessions.length ? <ul className="history-list">{sessions.slice(0, 6).map((session) => <li key={session.id}>
        <span className={`history-status ${session.status === 'completed' ? 'history-done' : ''}`} aria-label={session.status === 'completed' ? 'Completed' : session.status === 'in_progress' ? 'In progress' : 'Not completed'} />
        <div><strong>{session.sessionName}</strong><small>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(session.startedAt))}</small></div>
        <span className="history-label">{session.status === 'completed' ? 'Done' : session.status === 'in_progress' ? 'Active' : 'Paused'}</span>
      </li>)}</ul> : <div className="history-empty"><p>Your completed workouts will appear here.</p></div>}
      <div className="reflection-history"><h3>Recent reflections</h3>{checkins.length ? <ul>{checkins.slice(0, 3).map((checkin) => <li key={checkin.id}><span>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(checkin.createdAt))} · {checkin.weightKg.toFixed(1)} kg</span><p>{checkin.reflection}</p></li>)}</ul> : <p>Your check-in notes will appear here.</p>}</div>
      <div className="evidence-note" id="evidence">
        <span className="eyebrow">GUIDANCE WE USE</span>
        <p>WHO recommends adults build toward 150–300 minutes of moderate activity each week and strengthen major muscle groups on 2 or more days.</p>
        <a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity" target="_blank" rel="noreferrer">WHO physical activity guidance <ArrowUpRight size={13} aria-hidden="true" /></a>
        <a href="https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html" target="_blank" rel="noreferrer">CDC: gradual weight management <ArrowUpRight size={13} aria-hidden="true" /></a>
      </div>
    </div>
  </section>
}
