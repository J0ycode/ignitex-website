import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import {
  FiCheck, FiX, FiEye, FiDownload, FiRefreshCw, FiLogOut, FiChevronDown, FiSearch,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { MAX_TEAMS } from '../lib/registrationStatus'
import { ENTRY_FEE } from '../lib/payment'

type PaymentStatus = 'pending' | 'ticket_uploaded' | 'verified' | 'rejected'

interface AdminMember {
  name: string
  email: string
  phone: string
  college: string
  is_leader: boolean
}

interface AdminTeam {
  registration_id: string
  team_name: string
  payment_status: PaymentStatus
  payment_txn_id: string | null
  payment_screenshot_url: string | null
  payment_submitted_at: string | null
  members: AdminMember[]
}

const FILTERS: { key: 'review' | PaymentStatus | 'all'; label: string }[] = [
  { key: 'review',   label: 'To review' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'pending',  label: 'Unpaid' },
  { key: 'all',      label: 'All' },
]

const STATUS_STYLE: Record<PaymentStatus, { label: string; cls: string }> = {
  pending:         { label: 'Unpaid',    cls: 'bg-gray-500/20 text-gray-300' },
  ticket_uploaded: { label: 'To review', cls: 'bg-amber-500/20 text-amber-300' },
  verified:        { label: 'Verified',  cls: 'bg-green-500/20 text-green-300' },
  rejected:        { label: 'Rejected',  cls: 'bg-red-500/20 text-red-300' },
}

export default function AdminPage() {
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

  if (checking) return <Shell><p className="text-gray-400 text-sm">Loading…</p></Shell>
  if (!session) return <Shell><LoginForm /></Shell>
  return <Dashboard email={session.user.email ?? ''} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) toast.error(error.message)
  }

  return (
    <form onSubmit={submit} className="glass-card-dark p-6 space-y-4">
      <h1 className="font-display font-extrabold text-2xl text-white">Organiser login</h1>
      <div>
        <label htmlFor="admin-email" className="label-galaksi">Email</label>
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

function Dashboard({ email }: { email: string }) {
  const [teams, setTeams] = useState<AdminTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('review')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_teams')
    setLoading(false)
    if (error) {
      if (error.message.includes('NOT_ADMIN')) setForbidden(true)
      else toast.error('Could not load teams')
      return
    }
    setTeams((data as AdminTeam[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  const setStatus = async (team: AdminTeam, status: PaymentStatus) => {
    const prev = teams
    setTeams((ts) => ts.map((t) => (t.registration_id === team.registration_id ? { ...t, payment_status: status } : t)))
    const { error } = await supabase.rpc('admin_set_payment_status', {
      p_registration_id: team.registration_id,
      p_status: status,
    })
    if (error) {
      setTeams(prev)
      toast.error('Update failed')
    } else {
      toast.success(`${team.team_name}: ${STATUS_STYLE[status].label}`)
    }
  }

  const counts = useMemo(() => {
    const c = { pending: 0, ticket_uploaded: 0, verified: 0, rejected: 0 }
    teams.forEach((t) => { c[t.payment_status] = (c[t.payment_status] ?? 0) + 1 })
    return c
  }, [teams])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teams.filter((t) => {
      const statusOk =
        filter === 'all' ||
        (filter === 'review' ? t.payment_status === 'ticket_uploaded' : t.payment_status === filter)
      if (!statusOk) return false
      if (!q) return true
      return (
        t.team_name.toLowerCase().includes(q) ||
        t.registration_id.toLowerCase().includes(q) ||
        (t.payment_txn_id ?? '').toLowerCase().includes(q) ||
        t.members.some((m) => m.name.toLowerCase().includes(q) || m.phone.includes(q))
      )
    })
  }, [teams, filter, query])

  if (forbidden) {
    return (
      <Shell>
        <div className="glass-card-dark p-6 space-y-4 text-center">
          <p className="text-white font-semibold">{email} is not an organiser account.</p>
          <button onClick={() => supabase.auth.signOut()} className="btn-outline-galaksi w-full">Sign out</button>
        </div>
      </Shell>
    )
  }

  return (
    <div className="min-h-screen px-4 pt-20 pb-16 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-extrabold text-2xl text-white">Payments</h1>
        <div className="flex gap-1">
          <IconButton label="Refresh" onClick={load}><FiRefreshCw className={loading ? 'animate-spin' : ''} /></IconButton>
          <IconButton label="Export CSV" onClick={() => downloadCsv(teams)}><FiDownload /></IconButton>
          <IconButton label="Sign out" onClick={() => supabase.auth.signOut()}><FiLogOut /></IconButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Teams" value={`${teams.length}/${MAX_TEAMS}`} />
        <Stat label="To review" value={String(counts.ticket_uploaded)} />
        <Stat label="Collected" value={`₹${counts.verified * ENTRY_FEE}`} />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team, ID, UTR, name, phone"
          aria-label="Search teams"
          className="input-galaksi pl-11 py-3"
        />
      </div>

      {/* Filter chips — horizontally scrollable on small screens */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-4 min-h-[40px] rounded-full text-sm font-semibold transition-colors ${
              filter === f.key ? 'bg-galaksi-100 text-galaksi-900' : 'bg-white/5 text-gray-300'
            }`}
          >
            {f.label}
            {f.key === 'review' && counts.ticket_uploaded > 0 && ` (${counts.ticket_uploaded})`}
          </button>
        ))}
      </div>

      {loading && teams.length === 0 ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((t) => (
            <TeamCard key={t.registration_id} team={t} onSetStatus={setStatus} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TeamCard({ team, onSetStatus }: { team: AdminTeam; onSetStatus: (t: AdminTeam, s: PaymentStatus) => void }) {
  const [open, setOpen] = useState(false)
  const status = STATUS_STYLE[team.payment_status] ?? STATUS_STYLE.pending
  const leader = team.members.find((m) => m.is_leader) ?? team.members[0]

  const viewProof = async () => {
    const path = storagePath(team.payment_screenshot_url)
    if (!path) return
    // Open the tab synchronously so mobile popup blockers allow it
    const win = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('tickets').createSignedUrl(path, 120)
    if (error || !data) {
      win?.close()
      toast.error('Could not open proof')
      return
    }
    if (win) win.location.href = data.signedUrl
    else window.location.href = data.signedUrl
  }

  return (
    <li className="rounded-2xl p-4" style={{ background: 'rgba(22,22,37,0.85)', border: '1px solid rgba(166,149,227,0.15)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-bold text-white truncate">{team.team_name}</p>
          <p className="font-mono text-xs text-gray-400">{team.registration_id}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </div>

      {team.payment_txn_id && (
        <p className="mt-2 text-sm text-gray-300">
          UTR <span className="font-mono text-white select-all">{team.payment_txn_id}</span>
        </p>
      )}
      {leader && (
        <p className="mt-1 text-sm text-gray-300">
          {leader.name} · <a href={`tel:${leader.phone}`} className="text-galaksi-300 underline">{leader.phone}</a>
        </p>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-2 flex items-center gap-1 text-xs text-gray-400 min-h-[36px]"
        aria-expanded={open}
      >
        {team.members.length} members <FiChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="mt-1 space-y-2 text-xs text-gray-300">
          {team.members.map((m) => (
            <li key={m.email} className="p-2 rounded-lg bg-white/5">
              <p className="text-white font-semibold">{m.name}{m.is_leader && ' 👑'}</p>
              <p className="break-all">{m.email} · {m.phone}</p>
              <p>{m.college}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={viewProof}
          disabled={!team.payment_screenshot_url}
          className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-white/5 text-sm text-white disabled:opacity-30"
        >
          <FiEye /> Proof
        </button>
        <button
          onClick={() => onSetStatus(team, 'verified')}
          disabled={team.payment_status === 'verified'}
          className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-green-500/20 text-sm text-green-200 disabled:opacity-30"
        >
          <FiCheck /> Verify
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Reject payment for ${team.team_name}? They'll be asked to re-upload.`)) {
              onSetStatus(team, 'rejected')
            }
          }}
          disabled={team.payment_status === 'rejected' || team.payment_status === 'pending'}
          className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-red-500/20 text-sm text-red-200 disabled:opacity-30"
        >
          <FiX /> Reject
        </button>
      </div>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 text-center bg-white/5">
      <p className="font-display font-bold text-lg text-white">{value}</p>
      <p className="text-[11px] text-gray-400 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="w-11 h-11 flex items-center justify-center rounded-full text-gray-300 hover:bg-white/10 active:bg-white/10">
      {children}
    </button>
  )
}

/** Older rows stored a full public URL; newer rows store the bucket path. */
function storagePath(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('http')) return value
  const marker = '/tickets/'
  const i = value.indexOf(marker)
  return i >= 0 ? decodeURIComponent(value.slice(i + marker.length)) : null
}

function downloadCsv(teams: AdminTeam[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = ['Registration ID', 'Team', 'Status', 'UTR', 'Submitted', 'Member', 'Leader', 'Email', 'Phone', 'College']
  const rows = teams.flatMap((t) =>
    t.members.map((m) => [
      t.registration_id, t.team_name, t.payment_status, t.payment_txn_id, t.payment_submitted_at,
      m.name, m.is_leader ? 'yes' : '', m.email, m.phone, m.college,
    ]),
  )
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `ignitex-teams-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
