import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

const ownerEmail = import.meta.env.VITE_OWNER_EMAIL

if (!ownerEmail) {
  throw new Error(
    'Missing VITE_OWNER_EMAIL. Set it to your account email in .env.local ' +
      '(and in Vercel → Environment Variables) so the landing page knows ' +
      'which account to try.',
  )
}

export function LoginScreen() {
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!secret || busy) return
    setBusy(true)
    setWrong(false)

    const { error } = await supabase.auth.signInWithPassword({
      email: ownerEmail,
      password: secret,
    })
    // Wrong secret or any other failure looks the same — the page is a lock,
    // not a login form, so it shouldn't hint at emails, accounts, or retries.
    if (error) {
      setWrong(true)
      setSecret('')
    }

    setBusy(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6 text-text">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-[280px] flex-col items-center gap-6"
      >
        <div className="h-2 w-2 rounded-sm bg-accent" />
        <input
          type="password"
          className="input text-center"
          value={secret}
          onChange={(e) => {
            setSecret(e.target.value)
            if (wrong) setWrong(false)
          }}
          autoComplete="current-password"
          autoFocus
          enterKeyHint="go"
          aria-label="Password"
          aria-invalid={wrong}
          disabled={busy}
        />
        {wrong && (
          <div role="alert" className="text-[12px] text-neutral-600">
            No.
          </div>
        )}
        <button type="submit" className="sr-only" disabled={busy}>
          Continue
        </button>
      </form>
    </div>
  )
}
