import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QrScanner from 'qr-scanner'
import toast from 'react-hot-toast'
import {
  FiCamera, FiCameraOff, FiCheckCircle, FiAlertTriangle, FiXCircle, FiRefreshCw,
  FiLogOut, FiSearch, FiRotateCcw, FiPhone, FiChevronDown, FiImage,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { AdminShell, useAdminSession } from '../components/AdminAuth'

interface CheckInMember {
  name: string
  phone: string
  college: string
  is_leader: boolean
}

interface CheckInTeam {
  registration_id: string
  team_name: string
  checked_in_at: string | null
  checked_in_by: string | null
  members: CheckInMember[]
}

type ScanResult =
  | { kind: 'ok'; team: string; id: string }
  | { kind: 'already'; team: string; id: string; at: string }
  | { kind: 'error'; message: string }

const ERRORS: Record<string, string> = {
  TEAM_NOT_FOUND: 'No team with this registration ID.',
  NOT_VERIFIED: "This team's payment isn't verified — send them to the payments desk.",
  NOT_ADMIN: 'This account is not an organiser.',
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })

/** Ticket QR holds `https://…/ticket/<ID>`; also accept a bare registration ID. */
function registrationIdFrom(text: string): string | null {
  const t = text.trim()
  const fromUrl = t.match(/\/ticket\/([A-Za-z0-9]{6,10})\/?(?:[?#].*)?$/)
  if (fromUrl) return fromUrl[1].toUpperCase()
  if (/^[A-Za-z0-9]{6,10}$/.test(t)) return t.toUpperCase()
  return null
}

export default function CheckInPage() {
  const { session, checking } = useAdminSession()

  useEffect(() => {
    const prev = document.title
    document.title = 'Registration desk · igniteX'
    return () => { document.title = prev }
  }, [])

  if (checking) return <AdminShell><p className="text-stone-400 text-sm">Loading…</p></AdminShell>
  if (!session) return <AdminShell><DeskLoginForm /></AdminShell>
  return <Desk email={session.user.email ?? ''} />
}

const LOGIN_ERRORS: Record<string, string> = {
  INVALID_LOGIN: 'Wrong login ID or password.',
  TOO_MANY_ATTEMPTS: 'Too many wrong attempts. Wait 15 minutes and try again.',
}

/** Shared volunteer login — checked server-side by the checkin-login Edge Function. */
// ── Sign out after 1 hour without activity (shared volunteer phones) ──────────
const IDLE_LIMIT_MS = 60 * 60 * 1000
const ACTIVE_KEY = 'ignitex:desk-last-active'

function markActive() {
  try { localStorage.setItem(ACTIVE_KEY, String(Date.now())) } catch { /* private mode */ }
}

function lastActive(): number | null {
  try {
    const v = Number(localStorage.getItem(ACTIVE_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch { return null }
}

/** Signs out once the page has been idle for an hour — also after the phone slept or the tab was closed. */
function useIdleSignOut() {
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

function DeskLoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('checkin-login', { body: { username, password } })
    let body: { access_token?: string; refresh_token?: string; error?: string } | null = data
    if (error instanceof FunctionsHttpError) body = await error.context.json().catch(() => null)

    if (body?.access_token && body.refresh_token) {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      })
      if (sessionErr) toast.error('Could not sign in. Try again.')
      else markActive()
    } else {
      toast.error(LOGIN_ERRORS[body?.error ?? ''] ?? 'Could not sign in. Check your connection.')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="glass-card-dark p-6 space-y-4">
      <div>
        <h1 className="font-display font-extrabold text-2xl text-galaksi-100">Registration desk</h1>
        <p className="text-sm text-stone-400 mt-1">Event-day check-in for volunteers.</p>
      </div>
      <div>
        <label htmlFor="desk-id" className="label-galaksi">Login ID</label>
        <input id="desk-id" autoComplete="username" autoCapitalize="none" required
          value={username} onChange={(e) => setUsername(e.target.value)} className="input-galaksi" />
      </div>
      <div>
        <label htmlFor="desk-password" className="label-galaksi">Password</label>
        <input id="desk-password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} className="input-galaksi" />
      </div>
      <button type="submit" disabled={busy} className="btn-galaksi w-full min-h-[52px] disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-xs text-stone-500 text-center">
        Organisers already signed in on <Link to="/admin" className="underline">/admin</Link> are let in automatically.
      </p>
    </form>
  )
}

function Desk({ email }: { email: string }) {
  useIdleSignOut()
  const [teams, setTeams] = useState<CheckInTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [query, setQuery] = useState('')
  const [manualId, setManualId] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [live, setLive] = useState(false)
  // Shared volunteer account (see checkin-login) — no access to payments
  const isDesk = email.endsWith('@ignitex.invalid')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_checkin_list')
    setLoading(false)
    if (error) {
      if (error.message.includes('NOT_ADMIN')) setForbidden(true)
      else toast.error('Could not load teams')
      return
    }
    setTeams((data as CheckInTeam[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  // Desk accounts get no realtime row events (RLS keeps team rows private), so also poll
  useEffect(() => {
    const id = window.setInterval(() => { if (!document.hidden) load() }, 10_000)
    return () => window.clearInterval(id)
  }, [load])

  // Several volunteers can scan at once — every desk stays in sync
  useEffect(() => {
    const channel = supabase
      .channel('checkin-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => load())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const checkIn = useCallback(async (registrationId: string) => {
    markActive()
    const { data, error } = await supabase.rpc('admin_check_in', { p_registration_id: registrationId })
    if (error) {
      const code = Object.keys(ERRORS).find((k) => error.message.includes(k))
      setResult({ kind: 'error', message: code ? ERRORS[code] : 'Check-in failed. Try again.' })
      navigator.vibrate?.([80, 60, 80])
      return
    }
    const r = data as { status: 'checked_in' | 'already'; team_name: string; checked_in_at: string }
    if (r.status === 'already') {
      setResult({ kind: 'already', team: r.team_name, id: registrationId, at: r.checked_in_at })
      navigator.vibrate?.([80, 60, 80])
    } else {
      setResult({ kind: 'ok', team: r.team_name, id: registrationId })
      navigator.vibrate?.(150)
    }
    load()
  }, [load])

  const undo = async (team: CheckInTeam) => {
    if (!window.confirm(`Move ${team.team_name} back to Absent?`)) return
    const { error } = await supabase.rpc('admin_undo_check_in', { p_registration_id: team.registration_id })
    if (error) toast.error('Undo failed')
    else load()
  }

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const id = registrationIdFrom(manualId)
    if (!id) return toast.error('Enter a valid registration ID')
    checkIn(id)
    setManualId('')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((t) =>
      t.team_name.toLowerCase().includes(q) ||
      t.registration_id.toLowerCase().includes(q) ||
      t.members.some((m) => m.name.toLowerCase().includes(q) || m.phone.includes(q)),
    )
  }, [teams, query])

  const present = filtered.filter((t) => t.checked_in_at)
  const absent = filtered.filter((t) => !t.checked_in_at)
  const presentTotal = teams.filter((t) => t.checked_in_at).length

  if (forbidden) {
    return (
      <AdminShell>
        <div className="glass-card-dark p-6 space-y-4 text-center">
          <p className="text-galaksi-100 font-semibold">{email} can't use the registration desk.</p>
          <button onClick={() => supabase.auth.signOut()} className="btn-outline-galaksi w-full">Sign out</button>
        </div>
      </AdminShell>
    )
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-12 pt-20 pb-16 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display font-extrabold text-2xl text-galaksi-100">Registration desk</h1>
          <span
            title={live ? 'Live — synced with other desks' : 'Connecting…'}
            className={`w-2 h-2 rounded-full ${live ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}
          />
        </div>
        <div className="flex items-center gap-1">
          {!isDesk && (
            <Link to="/admin" className="px-3 min-h-[44px] flex items-center text-sm text-stone-400 hover:text-galaksi-100">
              Payments
            </Link>
          )}
          <IconButton label="Refresh" onClick={load}><FiRefreshCw className={loading ? 'animate-spin' : ''} /></IconButton>
          <IconButton label="Sign out" onClick={() => supabase.auth.signOut()}><FiLogOut /></IconButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
        {/* Scanner column */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <Scanner onScan={checkIn} />
          <ResultBanner result={result} onClose={() => setResult(null)} />

          <form onSubmit={submitManual} className="flex gap-2">
            <input
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="Or type registration ID"
              autoCapitalize="characters"
              autoComplete="off"
              className="input-galaksi flex-1 font-mono uppercase"
            />
            <button type="submit" className="btn-galaksi px-5 min-h-[48px]">Check in</button>
          </form>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Present" value={presentTotal} tone="text-green-300" />
            <Stat label="Absent" value={teams.length - presentTotal} tone="text-amber-300" />
            <Stat label="Tickets" value={teams.length} tone="text-galaksi-100" />
          </div>
        </div>

        {/* Lists column */}
        <div className="space-y-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team, ID, member or phone"
              className="input-galaksi pl-10"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <TeamSection title="Present" count={present.length} tone="green" empty="No teams checked in yet.">
              {present.map((t) => (
                <TeamRow key={t.registration_id} team={t}>
                  <span className="text-xs text-green-300">
                    {timeOf(t.checked_in_at!)}{t.checked_in_by && ` · ${t.checked_in_by.split('@')[0]}`}
                  </span>
                  <button
                    onClick={() => undo(t)}
                    title="Undo check-in"
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-stone-400 hover:bg-white/5"
                  >
                    <FiRotateCcw className="w-4 h-4" />
                  </button>
                </TeamRow>
              ))}
            </TeamSection>

            <TeamSection title="Absent" count={absent.length} tone="amber" empty="Everyone is here.">
              {absent.map((t) => (
                <TeamRow key={t.registration_id} team={t}>
                  <button
                    onClick={() => checkIn(t.registration_id)}
                    className="px-3 min-h-[36px] rounded-lg bg-green-500/15 text-xs font-semibold text-green-200"
                  >
                    Mark present
                  </button>
                </TeamRow>
              ))}
            </TeamSection>
          </div>
        </div>
      </div>
    </div>
  )
}

function Scanner({ onScan }: { onScan: (registrationId: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const lastRef = useRef<{ id: string; at: number }>({ id: '', at: 0 })
  const onScanRef = useRef(onScan)
  const [state, setState] = useState<'idle' | 'starting' | 'running'>('idle')
  const [camError, setCamError] = useState('')

  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => () => { scannerRef.current?.destroy() }, [])

  const handleCode = (text: string) => {
    const id = registrationIdFrom(text)
    if (!id) {
      toast.error('Not an igniteX ticket QR', { id: 'bad-qr' })
      return
    }
    // The camera sees the same code many times a second — handle it once
    const now = Date.now()
    if (lastRef.current.id === id && now - lastRef.current.at < 4000) return
    lastRef.current = { id, at: now }
    onScanRef.current(id)
  }

  const start = async () => {
    setCamError('')
    // Browsers only expose the camera on https:// (or localhost)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamError(`Live camera needs the secure site: ${LIVE_URL}. Or use "Scan from photo" below.`)
      return
    }
    if (!videoRef.current) return
    // Show the video before starting — some phones (iOS Safari) won't play a hidden video
    setState('starting')
    try {
      if (!scannerRef.current) {
        scannerRef.current = new QrScanner(videoRef.current, (res) => handleCode(res.data), {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
        })
      }
      await scannerRef.current.start()
      setState('running')
    } catch (e) {
      console.error('Camera start failed', e)
      scannerRef.current?.destroy()
      scannerRef.current = null
      setState('idle')
      setCamError(cameraErrorMessage(e))
    }
  }

  const stop = () => {
    scannerRef.current?.stop()
    setState('idle')
  }

  /** Fallback: take/choose a photo of the ticket and decode it — works on any phone. */
  const scanPhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      const res = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
      lastRef.current = { id: '', at: 0 } // a deliberate photo always counts
      handleCode(res.data)
    } catch {
      toast.error('No QR code found in that photo. Try again closer to the code.')
    }
  }

  const showVideo = state !== 'idle'

  return (
    <div className="rounded-2xl overflow-hidden border border-ink-line bg-black">
      <div className="relative aspect-square sm:aspect-[4/3] lg:aspect-square">
        {/* Own wrapper: qr-scanner adds its overlay next to the video, outside React's children */}
        <div className={`absolute inset-0 ${showVideo ? '' : 'invisible'}`}>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
        </div>
        {state === 'starting' && (
          <p className="absolute inset-x-0 bottom-3 text-center text-xs text-stone-300">Starting camera…</p>
        )}
        {!showVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <FiCamera className="w-10 h-10 text-galaksi-300" />
            <p className="text-sm text-stone-300">Scan the QR on a team's ticket to mark them present.</p>
            {camError && <p className="text-xs text-red-300 break-words">{camError}</p>}
          </div>
        )}
      </div>
      <button
        onClick={state === 'idle' ? start : stop}
        className={`w-full flex items-center justify-center gap-2 min-h-[52px] text-sm font-semibold ${
          state === 'idle' ? 'bg-galaksi-500 text-ink' : 'bg-white/5 text-stone-200'
        }`}
      >
        {state === 'idle' ? <><FiCamera /> Start scanning</> : <><FiCameraOff /> Stop camera</>}
      </button>
      <label className="w-full flex items-center justify-center gap-2 min-h-[48px] text-sm text-stone-300 border-t border-ink-line cursor-pointer active:bg-white/5">
        <FiImage /> Scan from photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => { scanPhoto(e.target.files?.[0]); e.target.value = '' }}
        />
      </label>
    </div>
  )
}

const LIVE_URL = 'https://ignitex-2026.vercel.app/registration'

function cameraErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  const text = e instanceof Error ? e.message : String(e)
  if (name === 'NotAllowedError' || /permission|denied/i.test(text)) {
    return 'Camera permission is blocked. Tap the lock/settings icon next to the address bar → Permissions → Camera → Allow, then reload.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || /not found|no camera/i.test(text)) {
    return 'No camera found on this device. Use "Scan from photo" or type the ID.'
  }
  if (name === 'NotReadableError' || /in use|could not start/i.test(text)) {
    return 'The camera is being used by another app. Close it and try again.'
  }
  return `Camera could not start (${name || text || 'unknown error'}). Use "Scan from photo" below.`
}

function ResultBanner({ result, onClose }: { result: ScanResult | null; onClose: () => void }) {
  if (!result) return null
  const styles = {
    ok:      { cls: 'bg-green-500/15 border-green-500/40 text-green-100', icon: <FiCheckCircle className="w-6 h-6 text-green-300" /> },
    already: { cls: 'bg-amber-500/15 border-amber-500/40 text-amber-100', icon: <FiAlertTriangle className="w-6 h-6 text-amber-300" /> },
    error:   { cls: 'bg-red-500/15 border-red-500/40 text-red-100', icon: <FiXCircle className="w-6 h-6 text-red-300" /> },
  }[result.kind]

  return (
    <button
      onClick={onClose}
      aria-live="polite"
      className={`w-full flex items-start gap-3 p-4 rounded-2xl border text-left ${styles.cls}`}
    >
      <span className="shrink-0">{styles.icon}</span>
      <span className="min-w-0">
        {result.kind === 'ok' && (
          <>
            <span className="block font-display font-bold text-lg truncate">{result.team}</span>
            <span className="block text-sm">Checked in · <span className="font-mono">{result.id}</span></span>
          </>
        )}
        {result.kind === 'already' && (
          <>
            <span className="block font-display font-bold text-lg truncate">{result.team}</span>
            <span className="block text-sm">Already checked in at {timeOf(result.at)} — ticket reused?</span>
          </>
        )}
        {result.kind === 'error' && <span className="block text-sm font-semibold">{result.message}</span>}
      </span>
    </button>
  )
}

function TeamSection({ title, count, tone, empty, children }: {
  title: string
  count: number
  tone: 'green' | 'amber'
  empty: string
  children: React.ReactNode
}) {
  const dot = tone === 'green' ? 'bg-green-400' : 'bg-amber-400'
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 font-display font-bold text-galaksi-100">
        <span className={`w-2 h-2 rounded-full ${dot}`} /> {title}
        <span className="text-sm font-normal text-stone-400">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="p-4 rounded-xl text-sm text-stone-400 border border-dashed border-ink-line">{empty}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  )
}

function TeamRow({ team, children }: { team: CheckInTeam; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const leader = team.members.find((m) => m.is_leader) ?? team.members[0]
  return (
    <li className="rounded-xl p-3" style={{ background: 'rgba(21,20,18,0.85)', border: '1px solid rgba(255,255,255,0.075)' }}>
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 text-left flex-1">
          <p className="font-semibold text-galaksi-100 truncate">{team.team_name}</p>
          <p className="flex items-center gap-1 text-xs text-stone-400">
            <span className="font-mono">{team.registration_id}</span> · {team.members.length} members
            <FiChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </p>
        </button>
        <div className="shrink-0 flex items-center gap-1">{children}</div>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 text-xs text-stone-300">
          {team.members.map((m) => (
            <li key={m.phone} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5">
              <span className="min-w-0">
                <span className="text-galaksi-100">{m.name}{m.is_leader && ' (leader)'}</span>
                <span className="block text-stone-400 truncate">{m.college}</span>
              </span>
              <a href={`tel:${m.phone}`} className="shrink-0 flex items-center gap-1 text-galaksi-300">
                <FiPhone className="w-3 h-3" /> {m.phone}
              </a>
            </li>
          ))}
        </ul>
      )}
      {!open && leader && (
        <a href={`tel:${leader.phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-stone-400">
          <FiPhone className="w-3 h-3" /> {leader.name} · {leader.phone}
        </a>
      )}
    </li>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(21,20,18,0.85)', border: '1px solid rgba(255,255,255,0.075)' }}>
      <p className={`font-display font-extrabold text-2xl ${tone}`}>{value}</p>
      <p className="text-[11px] font-mono uppercase tracking-widest text-stone-400">{label}</p>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-11 h-11 flex items-center justify-center rounded-xl text-stone-300 hover:bg-white/5"
    >
      {children}
    </button>
  )
}
