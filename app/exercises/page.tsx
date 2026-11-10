import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { ExerciseLibrary } from '@/components/exercise-library'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { fitnessProfiles } from '@/lib/db/schema'

export const metadata: Metadata = {
  title: 'Exercise Library | FitPilot',
  description: 'Browse exercises by target muscle or name, review form instructions, and watch gender-matched MuscleWiki demonstrations.',
}

export default async function ExerciseLibraryPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const [profile] = await db.select({ gender: fitnessProfiles.gender }).from(fitnessProfiles).where(eq(fitnessProfiles.userId, session.user.id)).limit(1)
  const initialVisualGender = profile?.gender === 'woman' ? 'female' : 'male'

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
          <p>Search live ExerciseDB movements by target muscle or name. Each result pairs its instructions and equipment details with a matching gender-specific demonstration or animation.</p>
          <p className="exercise-catalog-disclosure"><strong>MuscleWiki attribution:</strong> When a demonstration is sourced from MuscleWiki, its video and branded media are provided by MuscleWiki; MuscleWiki retains rights to its content and trademarks.</p>
        </div>
        <span className="exercise-catalog-count"><Dumbbell size={16} aria-hidden="true" />ExerciseDB</span>
      </header>
      <section aria-label="Browse exercise demonstrations">
        <ExerciseLibrary exercises={[]} initialCollection="all" initialVisualGender={initialVisualGender} />
      </section>
    </main>
  )
}
