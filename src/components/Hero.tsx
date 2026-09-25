import { Link } from 'react-router-dom'
import { FiArrowRight } from 'react-icons/fi'
import Countdown from './Countdown'
import type { RegistrationStatus } from '../lib/registrationStatus'
import { getRegistrationDates, MAX_TEAMS } from '../lib/registrationStatus'
import txaLogo from '../assets/TXA-logo.png'
import ignitexLogo from '../assets/IngniteX.png'

interface HeroProps {
  status: RegistrationStatus | null
  serverNow: Date | null
  teamCount: number
  loading: boolean
}

const FACTS = ['28–29 Sep 2026', 'Starts 9:30 AM', 'Teams of 2–4', `${MAX_TEAMS} teams max`, '₹100 per team']

export default function Hero({ status, serverNow, teamCount, loading }: HeroProps) {
  const dates = serverNow ? getRegistrationDates(serverNow) : null

  const countdown = (() => {
    if (!dates) return null
    switch (status) {
      case 'before_open': return { target: dates.registrationOpen, label: 'Registration opens in' }
      case 'open':        return { target: dates.registrationClose, label: 'Registration closes in' }
      case 'closed':
      case 'full':        return { target: dates.eventStart, label: 'Event starts in' }
      default:            return null
    }
  })()

  return (
    <section className="relative min-h-[100svh] flex items-center">
      <div className="w-full max-w-5xl mx-auto px-5 sm:px-8 pt-28 pb-20 text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={txaLogo} alt="TXA" className="h-9 sm:h-11 object-contain" style={{ mixBlendMode: 'screen' }} />
          <span className="text-sm text-stone-400">presents</span>
        </div>

        <h1 className="sr-only">igniteX Ideathon</h1>
        <img
          src={ignitexLogo}
          alt=""
          className="mx-auto w-full max-w-[19rem] sm:max-w-xl md:max-w-2xl object-contain"
        />
        <p className="mt-3 font-display font-extrabold uppercase tracking-[0.25em] text-lg sm:text-xl text-galaksi-100">
          Ideathon
        </p>

        {/* Dots between items on wider screens; plain wrapped list on phones */}
        <ul className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm sm:text-base text-stone-300 sm:[&>li+li]:before:content-['·'] sm:[&>li+li]:before:mr-4 sm:[&>li+li]:before:text-stone-600">
          {FACTS.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        {!loading && countdown && (
          <div className="mt-12">
            <Countdown targetDate={countdown.target} label={countdown.label} />
          </div>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {status === 'open' && (
            <>
              <Link to="/register" className="btn-galaksi gap-2 text-base px-8 py-3.5 w-full sm:w-auto">
                Register your team <FiArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-sm text-stone-400">
                <span className="text-galaksi-100 font-semibold">{Math.max(MAX_TEAMS - teamCount, 0)}</span> of {MAX_TEAMS} slots left
              </p>
            </>
          )}
          {status === 'before_open' && (
            <p className="text-base text-stone-300">
              Registration opens <span className="text-galaksi-100 font-semibold">today at 6:00 PM</span>.
            </p>
          )}
          {status === 'full' && (
            <p className="text-base text-stone-300">
              All {MAX_TEAMS} slots are taken. See you on the 28th.
            </p>
          )}
          {status === 'closed' && (
            <p className="text-base text-stone-300">Registration is closed. The event starts soon.</p>
          )}
          {status === 'event_active' && (
            <p className="text-base text-galaksi-100 font-semibold">igniteX is happening now.</p>
          )}
        </div>
      </div>
    </section>
  )
}
