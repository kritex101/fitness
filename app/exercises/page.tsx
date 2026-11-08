import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import { ExerciseLibrary } from '@/components/exercise-library'
import { auth } from '@/lib/auth'
import { exerciseLibrary } from '@/lib/fitness-data'

export const metadata: Metadata = {
  title: 'Exercise Library | FitPilot',
  description: 'Browse every available FitPilot exercise with step-by-step form cues and links to demonstration videos.',
}

export default async function ExerciseLibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  return (
    <main className="exercise-catalog-route">
      <Link className="exercise-catalog-back" href="/">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to FitPilot
      </Link>
      <header className="exercise-catalog-header">
        <div>
          <p className="eyebrow">MOVEMENT REFERENCE</p>
          <h1>Exercise library</h1>
          <p>Explore all {exerciseLibrary.length} available movements, read the form cues, and open a matching demonstration video.</p>
        </div>
        <span className="exercise-catalog-count"><Dumbbell size={16} aria-hidden="true" />{exerciseLibrary.length} exercises</span>
      </header>
      <section aria-label="Browse exercise demonstrations">
        <ExerciseLibrary exercises={[]} initialCollection="all" />
      </section>
    </main>
  )
}
