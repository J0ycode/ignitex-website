import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  FiCheck, FiX, FiEye, FiDownload, FiRefreshCw, FiLogOut, FiChevronDown, FiSearch,
  FiMail, FiMessageCircle, FiBell, FiAlertTriangle, FiMonitor, FiTrash2, FiUserCheck,
} from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { AdminShell as Shell, AdminLoginForm as LoginForm, useAdminSession, useIdleSignOut } from '../components/AdminAuth'
import { MAX_TEAMS } from '../lib/registrationStatus'
import { ENTRY_FEE } from '../lib/payment'
import { alertsPermission, chime, describeUserAgent, enableAdminAlerts, localNotify } from '../lib/adminAlerts'

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
  created_at: string
  team_name: string
  payment_status: PaymentStatus
  payment_txn_id: string | null
  payment_screenshot_url: string | null
  payment_submitted_at: string | null
  ticket_sent_at: string | null
  registered_ip: string | null
  payment_ip: string | null
  registered_user_agent: string | null
  same_device_count: number
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
  pending:         { label: 'Unpaid',    cls: 'bg-gray-500/20 text-stone-300' },
  ticket_uploaded: { label: 'To review', cls: 'bg-amber-500/20 text-amber-300' },
  verified:        { label: 'Verified',  cls: 'bg-green-500/20 text-green-300' },
  rejected:        { label: 'Rejected',  cls: 'bg-red-500/20 text-red-300' },
}

export default function AdminPage() {
  const { session, checking } = useAdminSession()

  // "Add to Home Screen" from here installs an app that opens /admin
  // (needed for push alerts on iPhone, which only work in Home Screen apps)
  useEffect(() => {
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    const prev = { href: manifest?.getAttribute('href'), title: title?.content }
    manifest?.setAttribute('href', '/admin.webmanifest')
    if (title) title.content = 'igniteX Admin'
    return () => {
      if (manifest && prev.href) manifest.setAttribute('href', prev.href)
      if (title && prev.title) title.content = prev.title
    }
  }, [])

  if (checking) return <Shell><p className="text-stone-400 text-sm">Loading…</p></Shell>
  if (!session) return <Shell><LoginForm /></Shell>
  return <Dashboard email={session.user.email ?? ''} />
}

function Dashboard({ email }: { email: string }) {
  useIdleSignOut()
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

  // ── Live updates: new registrations & payment proofs appear instantly ──
  const [live, setLive] = useState(false)
  const [alerts, setAlerts] = useState(alertsPermission())
  const teamsRef = useRef<AdminTeam[]>([])
  useEffect(() => { teamsRef.current = teams }, [teams])

  useEffect(() => {
    const channel = supabase
      .channel('admin-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, (payload) => {
        const row = payload.new as Partial<AdminTeam> | undefined
        if (payload.eventType === 'INSERT' && row?.team_name) {
          toast(`New team registered: ${row.team_name}`)
        }
        if (payload.eventType === 'UPDATE' && row?.payment_status === 'ticket_uploaded') {
          const prev = teamsRef.current.find((t) => t.registration_id === row.registration_id)
          const isNewProof = !prev || prev.payment_status !== 'ticket_uploaded' || prev.payment_txn_id !== row.payment_txn_id
          if (isNewProof) {
            const body = `${row.team_name} · UTR ${row.payment_txn_id ?? '—'}`
            chime()
            toast.success(`New payment proof — ${body}`, { duration: 8000 })
            if (document.hidden) localNotify('New payment proof', body, `payment-${row.registration_id}`)
          }
        }
        load() // refetch (members, device info, counts)
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const turnOnAlerts = async () => {
    try {
      const result = await enableAdminAlerts()
      setAlerts(alertsPermission())
      if (result === 'push') toast.success('Alerts on — this device will be notified even when /admin is closed')
      else if (result === 'in-page-only') toast.success('Alerts on while /admin is open (push not configured yet)')
      else if (result === 'denied') toast.error('Notifications are blocked — allow them in browser settings')
      else toast.error('This browser does not support notifications')
    } catch (e) {
      console.error(e)
      toast.error('Could not enable push on this device')
    }
  }

  /** Deletes the team (frees its slot) and its payment-proof file. */
  const deleteTeam = async (team: AdminTeam) => {
    const { data: proofPath, error } = await supabase.rpc('admin_delete_team', { p_registration_id: team.registration_id })
    if (error) {
      toast.error('Delete failed')
      return
    }
    const path = storagePath(typeof proofPath === 'string' ? proofPath : null)
    if (path) await supabase.storage.from('tickets').remove([path])
    setTeams((ts) => ts.filter((t) => t.registration_id !== team.registration_id))
    toast.success(`Deleted ${team.team_name}`)
  }

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

  /** Marks verified + emails the ticket (server-side, via the send-ticket Edge Function). */
  const verifyAndSend = async (team: AdminTeam) => {
    const t = toast.loading(`Verifying ${team.team_name} & emailing ticket…`)
    const { data, error } = await supabase.functions.invoke('send-ticket', {
      body: { registration_id: team.registration_id },
    })
    let body: { verified?: boolean; emailed?: boolean; error?: string } | null = data
    if (error instanceof FunctionsHttpError) body = await error.context.json().catch(() => null)
    toast.dismiss(t)

    if (body?.verified) {
      setTeams((ts) => ts.map((x) => x.registration_id === team.registration_id
        ? { ...x, payment_status: 'verified', ticket_sent_at: body?.emailed ? new Date().toISOString() : x.ticket_sent_at }
        : x))
    }
    if (body?.emailed) toast.success(`${team.team_name} verified · ticket emailed`)
    else if (body?.verified) toast.error('Verified, but the email failed — tap "Resend email"', { duration: 6000 })
    else if (body?.error === 'NOT_ADMIN') toast.error('Not an organiser account')
    else if (body?.error === 'SLOTS_FULL') toast.error(`${team.team_name}'s slot hold expired and all ${MAX_TEAMS} slots are taken — delete a team first`, { duration: 6000 })
    else toast.error(`Failed: ${body?.error ?? error?.message ?? 'unknown'}`)
  }

  const counts = useMemo(() => {
    const c = { pending: 0, ticket_uploaded: 0, verified: 0, rejected: 0 }
    teams.forEach((t) => { c[t.payment_status] = (c[t.payment_status] ?? 0) + 1 })
    return c
  }, [teams])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return teams
      .filter((t) => {
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
      // Newest registration first; the first team to register sits at the bottom as #1
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [teams, filter, query])

  const serialOf = useMemo(() => {
    const byAge = [...teams].sort((a, b) => a.created_at.localeCompare(b.created_at))
    return new Map(byAge.map((t, i) => [t.registration_id, i + 1]))
  }, [teams])

  if (forbidden) {
    return (
      <Shell>
        <div className="glass-card-dark p-6 space-y-4 text-center">
          <p className="text-galaksi-100 font-semibold">{email} is not an organiser account.</p>
          <button onClick={() => supabase.auth.signOut()} className="btn-outline-galaksi w-full">Sign out</button>
        </div>
      </Shell>
    )
  }

  return (
    <div className="min-h-screen px-4 sm:px-8 lg:px-12 pt-20 sm:pt-24 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-5 mb-6 border-b border-ink-line">
        <div className="min-w-0">
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-galaksi-100">Payments</h1>
          <p className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-stone-400">
            <span className={`w-2 h-2 rounded-full shrink-0 ${live ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="truncate">{live ? 'Live' : 'Connecting…'} · {email}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/registration" title="Check-in desk" className={TOOLBAR_BTN}>
            <FiUserCheck /> <span className="hidden sm:inline">Check-in</span>
          </Link>
          <ToolbarButton
            label={alerts === 'granted' ? 'Alerts on' : 'Alerts'}
            title={alerts === 'granted' ? 'Alerts on (tap to re-register device)' : 'Enable alerts on this device'}
            onClick={turnOnAlerts}
          >
            <FiBell className={alerts === 'granted' ? 'text-green-300' : ''} />
          </ToolbarButton>
          <ToolbarButton label="Refresh" onClick={load}><FiRefreshCw className={loading ? 'animate-spin' : ''} /></ToolbarButton>
          <ToolbarButton label="Export" title="Export CSV" onClick={() => downloadCsv(teams)}><FiDownload /></ToolbarButton>
          <ToolbarButton label="Sign out" onClick={() => supabase.auth.signOut()}><FiLogOut /></ToolbarButton>
        </div>
      </header>

      {alerts !== 'granted' && alerts !== 'unsupported' && (
        <button
          onClick={turnOnAlerts}
          className="w-full mb-6 flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-galaksi-500/15 border border-galaksi-500/30 text-sm font-semibold text-galaksi-100"
        >
          <FiBell /> Enable payment alerts on this device
        </button>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Teams" value={`${teams.length}`} hint={`of ${MAX_TEAMS} slots`} />
        <Stat label="To review" value={String(counts.ticket_uploaded)} hint="payment proofs" tone={counts.ticket_uploaded > 0 ? 'text-amber-300' : undefined} />
        <Stat label="Verified" value={String(counts.verified)} hint="tickets issued" tone="text-green-300" />
        <Stat label="Collected" value={`₹${counts.verified * ENTRY_FEE}`} hint={`₹${ENTRY_FEE} per team`} />
      </div>

      {/* Toolbar: filters + search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-1 sm:self-start">
          {FILTERS.map((f) => {
            const n = f.key === 'all' ? teams.length : f.key === 'review' ? counts.ticket_uploaded : counts[f.key]
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`shrink-0 flex items-center gap-2 px-3.5 min-h-[40px] rounded-lg text-sm font-semibold transition-colors ${
                  filter === f.key ? 'bg-galaksi-100 text-galaksi-900' : 'text-stone-300 hover:text-galaksi-100'
                }`}
              >
                {f.label}
                <span className={`text-xs tabular-nums ${filter === f.key ? 'text-galaksi-900/70' : 'text-stone-500'}`}>{n}</span>
              </button>
            )
          })}
        </div>
        <div className="relative lg:w-80">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team, ID, UTR, name, phone"
            aria-label="Search teams"
            className="input-galaksi pl-11 py-3"
          />
        </div>
      </div>

      {loading && teams.length === 0 ? (
        <p className="text-stone-400 text-sm py-12 text-center">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-400 rounded-2xl border border-dashed border-ink-line">
          {query ? 'No teams match your search.' : 'No teams in this list.'}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <TeamCard key={t.registration_id} team={t} serial={serialOf.get(t.registration_id) ?? 0} onSetStatus={setStatus} onVerify={verifyAndSend} onDelete={deleteTeam} />
          ))}
        </ul>
      )}
    </div>
  )
}

function TeamCard({ team, serial, onSetStatus, onVerify, onDelete }: {
  team: AdminTeam
  serial: number
  onSetStatus: (t: AdminTeam, s: PaymentStatus) => void
  onVerify: (t: AdminTeam) => Promise<void>
  onDelete: (t: AdminTeam) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const verify = async () => {
    const msg = team.payment_status === 'verified'
      ? `Resend the ticket email to ${team.team_name}?`
      : team.payment_status === 'pending'
      ? `${team.team_name} has NOT uploaded a screenshot or UTR.\n\n` +
        `Verify anyway? Only do this if you've confirmed their ₹${ENTRY_FEE} ` +
        `another way (cash, or found it in the payment history).\n\n` +
        `The ticket will be emailed to ${team.members.length} members.`
      : `Verify ₹${ENTRY_FEE} from ${team.team_name}?\n\n` +
        `UTR: ${team.payment_txn_id ?? '—'}\n\n` +
        `Only confirm if this UTR appears in the payment history. ` +
        `The ticket will be emailed to ${team.members.length} members.`
    if (!window.confirm(msg)) return
    setBusy(true)
    await onVerify(team)
    setBusy(false)
  }
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
    <li
      className="flex flex-col rounded-2xl p-4 sm:p-5"
      style={{ background: 'rgba(21,20,18,0.85)', border: '1px solid rgba(255,255,255,0.075)' }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <span
            title={`Registration #${serial}`}
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-mono text-sm font-bold tabular-nums bg-galaksi-500/15 text-galaksi-300"
          >
            {serial}
          </span>
          <div className="min-w-0">
            <p className="font-display font-bold text-lg leading-tight text-galaksi-100 truncate" title={team.team_name}>{team.team_name}</p>
            <p className="mt-0.5 font-mono text-xs text-stone-400">{team.registration_id} · {formatWhen(team.created_at)}</p>
          </div>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </div>

      {/* Details: fixed label column so every card lines up */}
      <dl className="mt-4 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-stone-500">UTR</dt>
        <dd className="min-w-0 font-mono text-galaksi-100 truncate select-all">{team.payment_txn_id ?? <span className="text-stone-500 font-sans">Not submitted</span>}</dd>

        <dt className="text-stone-500">Submitted</dt>
        <dd className="text-stone-300">{team.payment_submitted_at ? formatWhen(team.payment_submitted_at) : '—'}</dd>

        <dt className="text-stone-500">Leader</dt>
        <dd className="min-w-0 text-stone-300 truncate">
          {leader ? <>{leader.name} · <a href={`tel:${leader.phone}`} className="text-galaksi-300 hover:underline">{leader.phone}</a></> : '—'}
        </dd>

        <dt className="text-stone-500">Ticket</dt>
        <dd className="text-stone-300">{team.ticket_sent_at ? `Emailed ${formatWhen(team.ticket_sent_at)}` : '—'}</dd>

        <dt className="text-stone-500">Device</dt>
        <dd className="min-w-0 flex items-center gap-1.5 text-xs text-stone-400">
          <FiMonitor className="shrink-0" />
          <span className="truncate" title={[team.registered_ip, team.payment_ip].filter(Boolean).join(' / ')}>
            {describeUserAgent(team.registered_user_agent)}
            {team.registered_ip && <> · <span className="font-mono">{team.registered_ip}</span></>}
          </span>
        </dd>
      </dl>

      {team.same_device_count > 1 && (
        <p className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 text-xs text-amber-300">
          <FiAlertTriangle className="shrink-0" /> Same device registered {team.same_device_count} teams — double-check
        </p>
      )}

      {open && (
        <ul className="mt-3 space-y-2 text-xs text-stone-300">
          {team.members.map((m) => (
            <li key={m.email} className="p-2.5 rounded-lg bg-white/5">
              <p className="text-galaksi-100 font-semibold">{m.name}{m.is_leader && ' (leader)'}</p>
              <p className="break-all">{m.email} · {m.phone}</p>
              <p className="text-stone-400">{m.college}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Actions pinned to the bottom so buttons align across a row of cards */}
      <div className="mt-auto pt-4">
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={viewProof}
          disabled={!team.payment_screenshot_url}
          className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-white/5 text-sm text-galaksi-100 disabled:opacity-30"
        >
          <FiEye /> Proof
        </button>
        <button
          onClick={verify}
          disabled={busy || team.payment_status === 'verified'}
          className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-green-500/20 text-sm text-green-200 disabled:opacity-30"
        >
          <FiCheck /> {busy ? '…' : 'Verify'}
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

      {team.payment_status === 'verified' && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a
            href={whatsappLink(team)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-emerald-500/20 text-sm text-emerald-200"
          >
            <FiMessageCircle /> WhatsApp
          </a>
          <button
            onClick={verify}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-white/5 text-sm text-galaksi-100 disabled:opacity-30"
          >
            <FiMail /> {busy ? 'Sending…' : team.ticket_sent_at ? 'Resend email' : 'Send email'}
          </button>
        </div>
      )}

      <div className="mt-3 pt-3 flex items-center justify-between border-t border-ink-line">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 min-h-[36px] text-xs text-stone-400 hover:text-galaksi-100"
          aria-expanded={open}
        >
          {team.members.length} members <FiChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={async () => {
            const warn = team.payment_status === 'verified'
              ? `${team.team_name} is VERIFIED and has a ticket.

Delete anyway? Their ticket will stop working. This cannot be undone.`
              : `Delete ${team.team_name}? This frees its slot and cannot be undone.`
            if (!window.confirm(warn)) return
            setBusy(true)
            await onDelete(team)
            setBusy(false)
          }}
          disabled={busy}
          className="flex items-center gap-1.5 min-h-[36px] text-xs text-stone-500 hover:text-red-300 disabled:opacity-30"
        >
          <FiTrash2 /> Delete
        </button>
      </div>
      </div>
    </li>
  )
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  })

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl p-4 bg-white/[0.04] border border-white/[0.06]">
      <p className="text-[11px] font-mono uppercase tracking-widest text-stone-400">{label}</p>
      <p className={`mt-1 font-display font-extrabold text-2xl sm:text-3xl tabular-nums ${tone ?? 'text-galaksi-100'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
    </div>
  )
}

const TOOLBAR_BTN =
  'flex items-center justify-center gap-2 h-10 min-w-[40px] px-2.5 sm:px-3 rounded-lg text-sm text-stone-300 ' +
  'hover:bg-white/10 hover:text-galaksi-100 active:bg-white/10 transition-colors'

/** Icon-only on phones, icon + label from sm up. */
function ToolbarButton({ label, title, onClick, children }: {
  label: string
  title?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button onClick={onClick} aria-label={title ?? label} title={title ?? label} className={TOOLBAR_BTN}>
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/** Opens WhatsApp chat with the leader, message pre-typed — organiser just taps Send. */
function whatsappLink(team: AdminTeam): string {
  const leader = team.members.find((m) => m.is_leader) ?? team.members[0]
  const phone = (leader?.phone ?? '').replace(/\D/g, '').slice(-10)
  const text = [
    `Hi ${leader?.name ?? ''}, your igniteX payment is verified.`,
    '',
    `Team: ${team.team_name}`,
    `Registration ID: ${team.registration_id}`,
    `Ticket: ${window.location.origin}/ticket/${team.registration_id}`,
    '',
    'Show the ticket QR at check-in — 28 Sep 2026, 9:30 AM. The ticket has also been emailed to all members. See you there!',
  ].join('\n')
  return `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
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
  const header = ['Registration ID', 'Team', 'Status', 'UTR', 'Submitted', 'Member', 'Leader', 'Email', 'Phone', 'College', 'Registered IP', 'Payment IP', 'Device']
  const rows = teams.flatMap((t) =>
    t.members.map((m) => [
      t.registration_id, t.team_name, t.payment_status, t.payment_txn_id, t.payment_submitted_at,
      m.name, m.is_leader ? 'yes' : '', m.email, m.phone, m.college,
      t.registered_ip, t.payment_ip, describeUserAgent(t.registered_user_agent),
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
