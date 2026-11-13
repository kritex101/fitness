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
  description: 'Browse WorkoutX exercises by target muscle or name and view gender-matched static photo illustrations.',
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
          <p>Search the WorkoutX exercise catalog by target muscle or name. Each movement includes its instructions, equipment details, and a static photo illustration.</p>
          <p className="exercise-catalog-disclosure">Exercise illustrations are loaded directly from WorkoutX. This library displays photos only; it does not play exercise videos.</p>
        </div>
        <span className="exercise-catalog-count"><Dumbbell size={16} aria-hidden="true" />WorkoutX</span>
      </header>
      <section aria-label="Browse exercise demonstrations">
        <ExerciseLibrary exercises={[]} initialCollection="all" initialVisualGender={initialVisualGender} />
      </section>
    </main>
  )
}
