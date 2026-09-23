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
import { FiAlertOctagon, FiClock, FiLock, FiZap } from 'react-icons/fi'

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
    navigate(`/confirmation?id=${registrationId}&team=${encodeURIComponent(formData?.teamName ?? '')}`)
  }

  const dates = serverNow ? getRegistrationDates(serverNow) : null

  // ── Gate screens ──────────────────────────────────────────────────────────
  if (loading) {
    return <LoadingGate />
  }

  if (status === 'before_open') {
    return (
      <GateScreen
        icon={<FiClock className="w-8 h-8 text-spark-400" />}
        title="Not Open Yet"
        subtitle={`Registration opens on the 25th at 12:00 PM`}
        accentColor="#ffd166"
      >
        {dates && (
          <Countdown
            targetDate={dates.registrationOpen}
            label="Opens In"
            variant="opening"
          />
        )}
      </GateScreen>
    )
  }

  if (status === 'full') {
    return (
      <GateScreen
        icon={<FiAlertOctagon className="w-8 h-8 text-flame-400" />}
        title="Registration Full"
        subtitle={`All ${MAX_TEAMS} teams have registered. We'll see you at the event!`}
        accentColor="#ff3011"
      >
        <div className="flex flex-col items-center gap-2">
          <p className="font-display text-4xl font-black text-white">{teamCount} / {MAX_TEAMS}</p>
          <p className="text-sm text-gray-500">teams registered</p>
        </div>
        {dates && (
          <Countdown targetDate={dates.eventStart} label="Event Starts In" variant="event" />
        )}
      </GateScreen>
    )
  }

  if (status === 'closed' || status === 'event_active' || status === 'event_over') {
    return (
      <GateScreen
        icon={<FiLock className="w-8 h-8 text-gray-400" />}
        title="Registration Closed"
        subtitle="The registration window has ended. Stay tuned for future events!"
        accentColor="#6b7280"
      >
        {dates && status === 'closed' && (
          <Countdown targetDate={dates.eventStart} label="Event Starts In" variant="event" />
        )}
      </GateScreen>
    )
  }

  // ── Main registration flow ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-20 pb-16 px-4 sm:px-6 flex flex-col items-center justify-start">
      {/* Live slot counter */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-8 px-4 py-2 rounded-full"
        style={{ background: 'rgba(22,22,37,0.8)', border: '1px solid rgba(255,107,0,0.15)' }}
      >
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-green-400"
        />
        <span className="font-mono text-xs text-gray-400">
          <span className="text-ember-400 font-bold">{teamCount}</span>
          <span> / {MAX_TEAMS} teams registered</span>
        </span>
        {dates && (
          <>
            <span className="text-gray-700 mx-1">·</span>
            <span className="font-mono text-xs text-gray-500">
              closes 26th 12PM
            </span>
          </>
        )}
      </motion.div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #ff6b00, #ff3011)' }}>
              <FiZap className="text-white w-4 h-4" />
            </div>
            <span className="font-display font-bold text-xl text-white">ignite<span className="text-gradient-ember">X</span></span>
          </div>
          <h1 className="font-display font-extrabold text-3xl text-white">Register Your Team</h1>
          <p className="text-gray-500 text-sm mt-1">{2 - step + 1} step{2 - step + 1 !== 1 ? 's' : ''} remaining</p>
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
          style={{
            background: `${accentColor}15`,
            border: `2px solid ${accentColor}40`,
            boxShadow: `0 0 30px ${accentColor}20`,
          }}
        >
          {icon}
        </div>
        <div>
          <h1 className="font-display font-extrabold text-3xl text-white mb-2">{title}</h1>
          <p className="text-gray-500 text-sm">{subtitle}</p>
        </div>
        {children}
        <a href="/" className="inline-block text-xs text-gray-600 hover:text-ember-400 transition-colors">
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
          className="w-10 h-10 rounded-full border-2 border-ember-500/30 border-t-ember-500"
        />
        <p className="font-mono text-sm text-gray-600">Checking registration status…</p>
      </div>
    </div>
  )
}
