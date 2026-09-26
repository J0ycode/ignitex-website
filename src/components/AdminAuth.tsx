import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

/** Current Supabase session for organiser pages (/admin, /registration). */
export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, checking }
}

// ── Sign out after 1 hour without activity (/admin and /registration) ──────────
const IDLE_LIMIT_MS = 60 * 60 * 1000
const ACTIVE_KEY = 'ignitex:last-active'

export function markActive() {
  try { localStorage.setItem(ACTIVE_KEY, String(Date.now())) } catch { /* private mode */ }
}

function lastActive(): number | null {
  try {
    const v = Number(localStorage.getItem(ACTIVE_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch { return null }
}

/** Signs out once the page has been idle for an hour — also after the phone slept or the tab was closed. */
export function useIdleSignOut() {
  useEffect(() => {
    let lastWrite = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastWrite > 15_000) { lastWrite = now; markActive() } // throttle storage writes
    }
    const check = () => {
      const last = lastActive()
      if (last === null) return markActive()
      if (Date.now() - last > IDLE_LIMIT_MS) {
        try { localStorage.removeItem(ACTIVE_KEY) } catch { /* ignore */ }
        supabase.auth.signOut()
        toast('Signed out after 1 hour of inactivity. Please log in again.', { id: 'idle-signout', duration: 8000 })
      }
    }
    check()
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, 30_000)
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity))
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(timer)
    }
  }, [])
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

export function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) toast.error(error.message)
    else markActive()
  }

  return (
    <form onSubmit={submit} className="glass-card-dark p-6 space-y-4">
      <h1 className="font-display font-extrabold text-2xl text-galaksi-100">Organiser login</h1>
      <div>
        <label htmlFor="admin-email" className="label-galaksi">Login ID (email)</label>
        <input id="admin-email" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} className="input-galaksi" />
      </div>
      <div>
        <label htmlFor="admin-password" className="label-galaksi">Password</label>
        <input id="admin-password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} className="input-galaksi" />
      </div>
      <button type="submit" disabled={busy} className="btn-galaksi w-full min-h-[52px] disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
