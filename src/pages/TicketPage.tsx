import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { FiCalendar, FiClock, FiDownload, FiShare2 } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import HelpContacts from '../components/HelpContacts'

interface Ticket {
  registration_id: string
  team_name: string
  members: { name: string; college: string; is_leader: boolean }[]
}

export default function TicketPage() {
  const { id = '' } = useParams()
  const registrationId = id.toUpperCase()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'not_verified'>('loading')

  useEffect(() => {
    let cancelled = false
    // Dev-only preview: /ticket/TEST renders a sample ticket (stripped from production builds)
    if (import.meta.env.DEV && registrationId === 'TEST') {
      setTicket({
        registration_id: 'TEST',
        team_name: 'NeuralNinjas',
        members: [
          { name: 'Arjun Menon', college: 'CET Trivandrum', is_leader: true },
          { name: 'Priya Nair', college: 'CET Trivandrum', is_leader: false },
          { name: 'Sara Thomas', college: 'TKM Kollam', is_leader: false },
        ],
      })
      setState('ready')
      return
    }
    supabase.rpc('get_ticket', { p_registration_id: registrationId }).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) return setState('not_verified')
      setTicket(data as Ticket)
      setState('ready')
    })
    return () => { cancelled = true }
  }, [registrationId])

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: 'igniteX ticket', url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Ticket link copied')
      }
    } catch { /* user cancelled */ }
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-stone-400">Loading ticket…</p>
      </div>
    )
  }

  if (state === 'not_verified' || !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="max-w-sm w-full text-center space-y-4">
          <FiClock className="w-10 h-10 mx-auto text-galaksi-300" />
          <h1 className="font-display font-extrabold text-2xl text-galaksi-100">Ticket not ready yet</h1>
          <p className="text-sm text-stone-300">
            Your ticket appears here once the organisers verify your payment. You'll also get it by email.
          </p>
          <Link to={`/payment?id=${registrationId}`} className="btn-outline-galaksi w-full min-h-[48px]">
            Check payment status
          </Link>
          <div className="text-left pt-2"><HelpContacts context={`Registration ID ${registrationId}.`} /></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex justify-center px-4 pt-24 pb-16 print:pt-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        {/* Ticket card */}
        <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: '#161625', border: '1px solid rgba(255,107,26,0.3)' }}>
          <div className="p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-galaksi-300">igniteX Ideathon · Entry</p>
            <h1 className="mt-1 font-display font-extrabold text-2xl text-galaksi-100 break-words">{ticket.team_name}</h1>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-300">
              <span className="flex items-center gap-1.5"><FiCalendar className="w-4 h-4" /> 28–29 Sep 2026</span>
              <span className="flex items-center gap-1.5"><FiClock className="w-4 h-4" /> 9:30 AM</span>
            </div>
          </div>

          {/* Perforation */}
          <div className="relative h-6">
            <div className="absolute -left-3 top-0 w-6 h-6 rounded-full" style={{ background: '#0C0B0A' }} />
            <div className="absolute -right-3 top-0 w-6 h-6 rounded-full" style={{ background: '#0C0B0A' }} />
            <div className="absolute left-5 right-5 top-1/2 border-t-2 border-dashed border-white/10" />
          </div>

          <div className="p-6 pt-3 flex flex-col items-center">
            <div className="bg-white p-3 rounded-2xl">
              <QRCodeSVG value={window.location.href} size={200} level="M" />
            </div>
            <p className="mt-3 font-mono text-xl tracking-[0.25em] text-galaksi-100">{ticket.registration_id}</p>
            <p className="text-xs text-stone-400">Show this at check-in</p>

            <ul className="mt-5 w-full space-y-2">
              {ticket.members.map((m) => (
                <li key={m.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-galaksi-100 truncate">{m.name}{m.is_leader && <span className="text-stone-500"> · leader</span>}</span>
                  <span className="text-stone-400 text-xs truncate">{m.college}</span>
                </li>
              ))}
            </ul>

            <span className="mt-5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300">
              ✓ Payment verified
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
          <button onClick={share} className="btn-outline-galaksi gap-2 min-h-[48px] px-4">
            <FiShare2 /> Share
          </button>
          <button onClick={() => window.print()} className="btn-galaksi gap-2 min-h-[48px] px-4">
            <FiDownload /> Save
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-stone-400 print:hidden">
          Tip: take a screenshot — it works offline at the venue.
        </p>
      </motion.div>
    </div>
  )
}
