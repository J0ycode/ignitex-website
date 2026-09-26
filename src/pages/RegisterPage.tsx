import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useRegistrationStatus } from '../hooks/useRegistrationStatus'
import { getRegistrationDates, MAX_TEAMS } from '../lib/registrationStatus'
import ProgressBar from '../components/ui/ProgressBar'
import StepTeamDetails from '../components/steps/StepTeamDetails'
import type { TeamFormValues } from '../components/steps/StepTeamDetails'
import StepReview from '../components/steps/StepReview'
import Countdown from '../components/Countdown'
import HelpContacts from '../components/HelpContacts'
import { FiAlertOctagon, FiClock, FiLock } from 'react-icons/fi'

const STEPS = ['Team Details', 'Review']

export default function RegisterPage() {
  const navigate = useNavigate()
  const { status, teamCount, serverNow, loading } = useRegistrationStatus()

  const [step, setStep]           = useState(1)
  const [formData, setFormData]   = useState<TeamFormValues | null>(null)

  const handleTeamDetails = (data: TeamFormValues) => {
    setFormData(data)
    setStep(2)
  }

  const handleRegistrationSuccess = (registrationId: string) => {
    navigate(`/payment?id=${registrationId}&team=${encodeURIComponent(formData?.teamName ?? '')}`)
  }

  const dates = serverNow ? getRegistrationDates(serverNow) : null

  // ── Gate screens ──────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingGate />
  }

  if (status === 'before_open') {
    return (
      <GateScreen
        icon={<FiClock className="w-8 h-8 text-galaksi-400" />}
        title="Not open yet"
        subtitle={`Registration opens on the 25th at 6:00 PM`}
        accentColor="#FF9A5C"
      >
        {dates && (
          <Countdown
            targetDate={dates.registrationOpen}
            label="Opens in"
            variant="opening"
          />
        )}
      </GateScreen>
    )
  }

  if (status === 'full') {
    return (
      <GateScreen
        icon={<FiAlertOctagon className="w-8 h-8 text-galaksi-400" />}
        title="Registration full"
        subtitle={`All ${MAX_TEAMS} teams have registered. We'll see you at the event!`}
        accentColor="#E2560D"
      >
        <div className="flex flex-col items-center gap-2">
          <p className="font-display text-4xl font-black text-galaksi-100">{teamCount} / {MAX_TEAMS}</p>
          <p className="text-sm text-stone-400">teams registered</p>
        </div>
        {dates && (
          <Countdown targetDate={dates.eventStart} label="Event starts in" variant="event" />
        )}
      </GateScreen>
    )
  }

  if (status === 'closed' || status === 'event_active' || status === 'event_over') {
    return (
      <GateScreen
        icon={<FiLock className="w-8 h-8 text-stone-400" />}
        title="Registration closed"
        subtitle="The registration window has ended. Stay tuned for future events!"
        accentColor="#6b7280"
      >
        {dates && status === 'closed' && (
          <Countdown targetDate={dates.eventStart} label="Event starts in" variant="event" />
        )}
      </GateScreen>
    )
  }

  // ── Main registration flow ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 flex flex-col items-center justify-start">
      {/* Live slot counter */}
      <p className="flex items-center gap-2 mb-8 text-sm text-stone-400">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-beat" aria-hidden />
        <span>
          <span className="text-galaksi-100 font-semibold">{Math.max(MAX_TEAMS - teamCount, 0)}</span> of {MAX_TEAMS} slots left · closes 28 Sep, 9:00 AM
        </span>
      </p>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display font-extrabold text-3xl text-galaksi-100">Register your team</h1>
          <p className="text-stone-400 text-sm mt-1">{2 - step + 1} step{2 - step + 1 !== 1 ? 's' : ''} remaining</p>
        </div>

        <div className="glass-card-dark p-6 sm:p-8">
          <ProgressBar currentStep={step} totalSteps={2} labels={STEPS} />

          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepTeamDetails
                key="details"
                initialValues={formData ?? undefined}
                onNext={handleTeamDetails}
              />
            )}
            {step === 2 && formData && (
              <StepReview
                key="review"
                formData={formData}
                onBack={() => setStep(1)}
                onSuccess={handleRegistrationSuccess}
              />
            )}
          </AnimatePresence>
        </div>
        <div className="mt-6 text-center"><HelpContacts compact /></div>
      </motion.div>
    </div>
  )
}

// ── Shared gate screen ────────────────────────────────────────────────────────
function GateScreen({
  icon,
  title,
  subtitle,
  accentColor,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  accentColor: string
  children?: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-lg w-full space-y-8"
      >
        <div
          className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
          style={{ background: '#151412', border: `1px solid ${accentColor}55` }}
        >
          {icon}
        </div>
        <div>
          <h1 className="font-display font-extrabold text-3xl text-galaksi-100 mb-2">{title}</h1>
          <p className="text-stone-400 text-sm">{subtitle}</p>
        </div>
        {children}
        <a href="/" className="inline-block text-xs text-stone-500 hover:text-galaksi-400 transition-colors">
          ← Back to home
        </a>
      </motion.div>
    </div>
  )
}

function LoadingGate() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2 border-galaksi-500/30 border-t-galaksi-500"
        />
        <p className="font-mono text-sm text-stone-500">Loading…</p>
      </div>
    </div>
  )
}
