import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QrScanner from 'qr-scanner'
import toast from 'react-hot-toast'
import {
  FiCamera, FiCameraOff, FiCheckCircle, FiAlertTriangle, FiXCircle, FiRefreshCw,
  FiLogOut, FiSearch, FiRotateCcw, FiPhone, FiChevronDown,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { AdminShell, AdminLoginForm, useAdminSession } from '../components/AdminAuth'

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
  if (!session) return <AdminShell><AdminLoginForm /></AdminShell>
  return <Desk email={session.user.email ?? ''} />
}

function Desk({ email }: { email: string }) {
  const [teams, setTeams] = useState<CheckInTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [query, setQuery] = useState('')
  const [manualId, setManualId] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [live, setLive] = useState(false)

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

  // Several volunteers can scan at once — every desk stays in sync
  useEffect(() => {
    const channel = supabase
      .channel('checkin-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => load())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const checkIn = useCallback(async (registrationId: string) => {
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
          <p className="text-galaksi-100 font-semibold">{email} is not an organiser account.</p>
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
          <Link to="/admin" className="px-3 min-h-[44px] flex items-center text-sm text-stone-400 hover:text-galaksi-100">
            Payments
          </Link>
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
  const [running, setRunning] = useState(false)
  const [camError, setCamError] = useState('')

  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => () => { scannerRef.current?.destroy() }, [])

  const start = async () => {
    setCamError('')
    if (!videoRef.current) return
    if (!scannerRef.current) {
      scannerRef.current = new QrScanner(
        videoRef.current,
        (res) => {
          const id = registrationIdFrom(res.data)
          if (!id) {
            toast.error('Not an igniteX ticket QR', { id: 'bad-qr' })
            return
          }
          // The camera sees the same code many times a second — handle it once
          const now = Date.now()
          if (lastRef.current.id === id && now - lastRef.current.at < 4000) return
          lastRef.current = { id, at: now }
          onScanRef.current(id)
        },
        { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, returnDetailedScanResult: true },
      )
    }
    try {
      await scannerRef.current.start()
      setRunning(true)
    } catch {
      setCamError(
        window.isSecureContext
          ? 'Camera blocked. Allow camera access for this site in your browser settings.'
          : 'Camera needs HTTPS — open this page on the live site.',
      )
    }
  }

  const stop = () => {
    scannerRef.current?.stop()
    setRunning(false)
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-ink-line bg-black">
      <div className="relative aspect-square sm:aspect-[4/3] lg:aspect-square">
        <video ref={videoRef} className={`w-full h-full object-cover ${running ? '' : 'invisible'}`} muted playsInline />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <FiCamera className="w-10 h-10 text-galaksi-300" />
            <p className="text-sm text-stone-300">Scan the QR on a team's ticket to mark them present.</p>
            {camError && <p className="text-xs text-red-300">{camError}</p>}
          </div>
        )}
      </div>
      <button
        onClick={running ? stop : start}
        className={`w-full flex items-center justify-center gap-2 min-h-[52px] text-sm font-semibold ${
          running ? 'bg-white/5 text-stone-200' : 'bg-galaksi-500 text-ink'
        }`}
      >
        {running ? <><FiCameraOff /> Stop camera</> : <><FiCamera /> Start scanning</>}
      </button>
    </div>
  )
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
