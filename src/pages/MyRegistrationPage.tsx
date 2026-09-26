import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { FiSearch, FiChevronRight } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import { getDeviceId, getSavedRegistrations, saveRegistration } from '../lib/device'
import HelpContacts from '../components/HelpContacts'

interface Registration {
  registration_id: string
  team_name: string
  payment_status: string | null // null = couldn't load status
}

const STATUS: Record<string, { label: string; cls: string; href: (id: string) => string; cta: string }> = {
  pending:         { label: 'Payment pending',    cls: 'bg-gray-500/20 text-gray-200',   href: (id) => `/payment?id=${id}`, cta: 'Pay now' },
  ticket_uploaded: { label: 'Under verification', cls: 'bg-amber-500/20 text-amber-200', href: (id) => `/payment?id=${id}`, cta: 'View status' },
  verified:        { label: 'Verified',           cls: 'bg-green-500/20 text-green-200', href: (id) => `/ticket/${id}`,     cta: 'View ticket' },
  rejected:        { label: 'Re-upload needed',   cls: 'bg-red-500/20 text-red-200',     href: (id) => `/payment?id=${id}`, cta: 'Fix payment' },
}

export default function MyRegistrationPage() {
  const [regs, setRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const deviceId = getDeviceId()
      const saved = getSavedRegistrations()
      const byId = new Map<string, Registration>(
        saved.map((r) => [r.registration_id, { ...r, payment_status: null }]),
      )

      if (deviceId) {
        const { data } = await supabase.rpc('get_device_registrations', { p_device_id: deviceId })
        for (const r of (data as Registration[] | null) ?? []) byId.set(r.registration_id, r)
      }
      // Refresh status for locally-saved ones the device link didn't cover (e.g. recovered)
      await Promise.all(
        [...byId.values()].filter((r) => r.payment_status === null).map(async (r) => {
          const { data } = await supabase.rpc('get_team_summary', { p_registration_id: r.registration_id })
          const row = Array.isArray(data) ? data[0] : null
          if (row) byId.set(r.registration_id, { ...r, team_name: row.team_name, payment_status: row.payment_status })
        }),
      )
      if (!cancelled) {
        setRegs([...byId.values()])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const onRecovered = (found: Registration[]) => {
    found.forEach((r) => saveRegistration({ registration_id: r.registration_id, team_name: r.team_name }))
    setRegs((cur) => {
      const m = new Map(cur.map((r) => [r.registration_id, r]))
      found.forEach((r) => m.set(r.registration_id, r))
      return [...m.values()]
    })
  }

  return (
    <div className="min-h-screen flex justify-center px-4 pt-24 pb-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-galaksi-100">My registration</h1>
          <p className="text-sm text-stone-300 mt-1">Check your payment status and get your ticket.</p>
        </div>

        {loading ? (
          <p className="text-sm text-stone-400">Loading…</p>
        ) : regs.length > 0 ? (
          <ul className="space-y-3">
            {regs.map((r) => {
              const s = STATUS[r.payment_status ?? ''] ?? null
              return (
                <li key={r.registration_id}>
                  <Link
                    to={s ? s.href(r.registration_id) : `/payment?id=${r.registration_id}`}
                    className="flex items-center gap-3 p-4 rounded-2xl active:bg-white/5"
                    style={{ background: 'rgba(21,20,18,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-galaksi-100 truncate">{r.team_name}</p>
                      <p className="font-mono text-xs text-stone-400">{r.registration_id}</p>
                      {s && <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>}
                    </div>
                    <span className="flex items-center gap-1 text-sm text-galaksi-200 shrink-0">
                      {s?.cta ?? 'Open'} <FiChevronRight />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-stone-300 p-4 rounded-2xl bg-white/5">
            No registration found on this device. If you registered on another phone, find it below.
          </p>
        )}

        <RecoverForm onFound={onRecovered} />

        <HelpContacts />

        {!loading && regs.length === 0 && (
          <Link to="/register" className="btn-outline-galaksi w-full min-h-[48px]">Register a team</Link>
        )}
      </motion.div>
    </div>
  )
}

function RecoverForm({ onFound }: { onFound: (r: Registration[]) => void }) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.rpc('find_registration', { p_email: email, p_phone: phone })
    setBusy(false)
    const found = (data as Registration[] | null) ?? []
    if (error) return toast.error('Something went wrong. Please try again.')
    if (found.length === 0) return toast.error("No team found. Use the team leader's email and phone.")
    toast.success('Registration found')
    onFound(found)
  }

  return (
    <form
      onSubmit={submit}
      className="p-4 rounded-2xl space-y-3"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.075)' }}
    >
      <p className="font-display font-semibold text-galaksi-100 text-sm">Registered on another device?</p>
      <input
        type="email" inputMode="email" autoComplete="email" required
        value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Team leader's email" aria-label="Team leader's email"
        className="input-galaksi py-3"
      />
      <input
        type="tel" inputMode="numeric" autoComplete="tel-national" required
        value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="Team leader's mobile number" aria-label="Team leader's mobile number"
        className="input-galaksi py-3"
      />
      <button type="submit" disabled={busy} className="btn-galaksi w-full gap-2 min-h-[48px] disabled:opacity-60">
        <FiSearch /> {busy ? 'Searching…' : 'Find my registration'}
      </button>
    </form>
  )
}
