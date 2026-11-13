'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Flame, Ruler, Save, Scale } from 'lucide-react'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { saveBodyMetrics } from '@/app/actions/fitness'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { activityLevels, calculateBodyMetrics, genderOptions, type ActivityLevel, type BodyMetricsInput, type FitnessProfile, type MetricSnapshot } from '@/lib/fitness-data'

function validMetrics(input: BodyMetricsInput) {
  return Number.isFinite(input.weightKg) && input.weightKg >= 20 && input.weightKg <= 500
    && Number.isFinite(input.heightCm) && input.heightCm >= 90 && input.heightCm <= 250
    && Number.isInteger(input.age) && input.age >= 18 && input.age <= 100
}

export function BodyMetricsPanel({ profile, snapshots }: { profile: FitnessProfile; snapshots: MetricSnapshot[] }) {
  const router = useRouter()
  const [history, setHistory] = useState(snapshots)
  const [values, setValues] = useState({
    weightKg: String(profile.weightKg),
    heightCm: String(profile.heightCm),
    age: String(profile.age),
    gender: profile.gender,
    activityLevel: snapshots[0]?.activityLevel ?? 'lightly_active' as ActivityLevel,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const input: BodyMetricsInput = {
    weightKg: Number(values.weightKg),
    heightCm: Number(values.heightCm),
    age: Number(values.age),
    gender: values.gender,
    activityLevel: values.activityLevel,
  }
  const isValid = validMetrics(input)
  const estimate = isValid ? calculateBodyMetrics(input, profile.goal) : null
  const chartData = useMemo(() => [...history]
    .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime())
    .map((snapshot) => ({
      date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(snapshot.createdAt)),
      bmi: snapshot.bmi,
      calories: snapshot.dailyCalorieTarget,
    })), [history])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const snapshot = await saveBodyMetrics(input)
      setHistory((current) => [snapshot, ...current].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()).slice(0, 90))
      setNotice('Your profile and metric history are up to date.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not save these metrics. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return <section className="panel body-metrics-panel" aria-labelledby="body-metrics-title">
    <div className="body-metrics-heading">
      <div><p className="eyebrow">BODY METRICS</p><h2 id="body-metrics-title">A clearer picture over time</h2><p>Update your details to estimate BMI and a daily calorie target for your selected goal.</p></div>
      <span className="panel-icon"><Activity size={17} aria-hidden="true" /></span>
    </div>
    <div className="body-metrics-layout">
      <form className="body-metrics-form" onSubmit={handleSave}>
        <div className="body-metrics-fields">
          <label className="field"><span>Weight <b>kg</b></span><input type="number" min={20} max={500} step="0.1" required value={values.weightKg} onChange={(event) => setValues((current) => ({ ...current, weightKg: event.target.value }))} /></label>
          <label className="field"><span>Height <b>cm</b></span><input type="number" min={90} max={250} step="0.1" required value={values.heightCm} onChange={(event) => setValues((current) => ({ ...current, heightCm: event.target.value }))} /></label>
          <label className="field"><span>Age</span><input type="number" min={18} max={100} step="1" required value={values.age} onChange={(event) => setValues((current) => ({ ...current, age: event.target.value }))} /></label>
          <label className="field"><span>Gender factor</span><select value={values.gender} onChange={(event) => setValues((current) => ({ ...current, gender: event.target.value as FitnessProfile['gender'] }))}>{genderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="field body-metrics-activity"><span>Activity level</span><select value={values.activityLevel} onChange={(event) => setValues((current) => ({ ...current, activityLevel: event.target.value as ActivityLevel }))}>{activityLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}</select></label>
        </div>
        <p className="body-metrics-disclaimer">These are estimates, not medical advice. BMI is a screening measure and does not assess body composition.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="body-metrics-notice" role="status">{notice}</p>}
        <button className="primary-button body-metrics-save" type="submit" disabled={saving || !isValid}><Save size={15} aria-hidden="true" />{saving ? 'Saving metrics…' : 'Save metrics & update trends'}</button>
      </form>
      <div className="body-metric-results">
        <div className="body-metric-result"><span><Scale size={15} aria-hidden="true" /> Estimated BMI</span><strong>{estimate ? estimate.bmi.toFixed(1) : '—'}</strong><small>Based on height and weight</small></div>
        <div className="body-metric-result"><span><Flame size={15} aria-hidden="true" /> Daily calorie target</span><strong>{estimate ? estimate.dailyCalorieTarget.toLocaleString() : '—'}<small> kcal</small></strong><small>Activity and goal adjusted</small></div>
      </div>
    </div>
    <div className="body-metric-chart-grid">
      <section className="body-metric-chart-card" aria-label="BMI trend chart">
        <div className="body-metric-chart-heading"><div><h3>BMI over time</h3><p>Calculated at each saved check-in</p></div><Ruler size={17} aria-hidden="true" /></div>
        {chartData.length >= 2 ? <ChartContainer config={{ bmi: { label: 'BMI', color: 'var(--chart-1)' } }} className="body-metric-chart">
          <LineChart data={chartData} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} />
            <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip content={<ChartTooltipContent formatter={(value) => Number(value).toFixed(1)} />} />
            <Line dataKey="bmi" type="monotone" stroke="var(--color-bmi)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-bmi)' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartContainer> : <p className="body-metric-chart-empty">Save another check-in to see your BMI trend.</p>}
      </section>
      <section className="body-metric-chart-card" aria-label="Daily calorie target trend chart">
        <div className="body-metric-chart-heading"><div><h3>Daily calorie target</h3><p>Adjusted for activity and selected goal</p></div><Flame size={17} aria-hidden="true" /></div>
        {chartData.length >= 2 ? <ChartContainer config={{ calories: { label: 'Daily target', color: 'var(--chart-2)' } }} className="body-metric-chart">
          <LineChart data={chartData} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={18} />
            <YAxis hide domain={['dataMin - 150', 'dataMax + 150']} />
            <Tooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toLocaleString()} kcal`} />} />
            <Line dataKey="calories" type="monotone" stroke="var(--color-calories)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--color-calories)' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartContainer> : <p className="body-metric-chart-empty">Save another check-in to see your calorie target trend.</p>}
      </section>
    </div>
  </section>
}
