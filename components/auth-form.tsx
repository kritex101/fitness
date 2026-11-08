'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password })

      if (result.error) {
        setError('We could not complete sign-in with those details. Check them and try again.')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('We could not complete sign-in right now. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Link className="brand auth-brand" href="/" aria-label="FitPilot home">
          <span className="brand-mark">F</span><span>fitpilot</span>
        </Link>
        <div className="auth-icon"><LockKeyhole size={19} aria-hidden="true" /></div>
        <p className="eyebrow">A PRIVATE SPACE FOR YOUR PROGRESS</p>
        <h1 id="auth-title">{isSignUp ? 'Start with your own plan.' : 'Welcome back.'}</h1>
        <p className="auth-intro">{isSignUp ? 'Create a secure account, then we will tailor your training to your goals and equipment.' : 'Sign in to pick up your training plan and progress.'}</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && <label className="field"><span>Your name</span><input autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>}
          <label className="field"><span>Email address</span><input autoComplete="email" inputMode="email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label className="field"><span>Password</span><input autoComplete={isSignUp ? 'new-password' : 'current-password'} type="password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
        </form>
        <p className="auth-switch">{isSignUp ? 'Already have an account?' : 'New to FitPilot?'} <Link href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Sign in' : 'Create an account'}</Link></p>
        <p className="privacy-note">Your measurements and workout history are private to your account.</p>
      </section>
    </main>
  )
}
