import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'signin' | 'signup'

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) setError(error.message)
      // On success the AuthProvider's onAuthStateChange swaps in the app.
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (data.session) setNotice('Account created. Signing you in…')
      else
        setNotice('Account created. Check your email to confirm, then sign in.')
    }

    setBusy(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6 text-text">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-2 w-2 rounded-sm bg-accent" />
          <div className="font-heading text-base font-medium">Slowstreak</div>
        </div>

        <h1 className="m-0 font-heading text-[28px] font-medium tracking-tight">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>
        <p className="mt-3 mb-8 text-[13px] leading-relaxed text-neutral-500">
          {mode === 'signin'
            ? 'Small amounts, most days. Habits, journal and bills in one place.'
            : 'Start with a habit or two, and add the rest as you go.'}
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
              minLength={8}
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md px-3 py-2.5 text-xs leading-relaxed"
              style={{
                background: 'color-mix(in srgb, #f87171 12%, transparent)',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          )}
          {notice && (
            <div className="text-xs leading-relaxed text-accent-300">
              {notice}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary mt-2 w-full"
            disabled={busy}
          >
            {busy
              ? 'Working…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-xs text-neutral-500">
          {mode === 'signin' ? "Don't have an account? " : 'Already have one? '}
          <button
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setError(null)
              setNotice(null)
            }}
            className="btn btn-ghost text-xs"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
