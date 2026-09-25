import { useEffect } from 'react'
import { motion, type Variants } from 'framer-motion'
import { useSearchParams, Link } from 'react-router-dom'
import { FiCheckCircle, FiCopy, FiHome, FiCalendar } from 'react-icons/fi'
import toast from 'react-hot-toast'

export default function ConfirmationPage() {
  const [params] = useSearchParams()
  const registrationId = params.get('id') ?? 'N/A'
  const teamName = params.get('team') ?? 'Your Team'

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(registrationId)
      toast.success('Registration ID copied!')
    } catch {
      // In-app browsers (Instagram/WhatsApp) often block the clipboard
      toast(`Your ID: ${registrationId}`, { icon: '📋' })
    }
  }

  // Subtle particle burst on mount
  useEffect(() => {
    document.title = `igniteX — ${teamName} Registered! 🔥`
    return () => { document.title = 'igniteX — Ideas are the Pulses of Progress' }
  }, [teamName])

  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  }
  const childVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-lg w-full text-center space-y-8"
      >
        {/* Success icon */}
        <motion.div variants={childVariants} className="flex justify-center">
          <div className="relative">
            {/* Pulsing ring */}
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(166,149,227,0.3) 0%, transparent 70%)' }}
            />
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center relative z-10"
              style={{
                background: 'linear-gradient(135deg, rgba(166,149,227,0.2), rgba(147,131,204,0.1))',
                border: '2px solid rgba(166,149,227,0.5)',
                boxShadow: '0 0 40px rgba(166,149,227,0.3)',
              }}
            >
              <FiCheckCircle className="w-10 h-10 text-galaksi-400" />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.div variants={childVariants}>
          <h1 className="font-display font-extrabold text-4xl text-white mb-2">
            You're <span className="text-gradient-galaksi">Ignited!</span>
          </h1>
          <p className="text-gray-400">
            Team <strong className="text-white">"{teamName}"</strong> is registered for igniteX.
            <br />
            <span className="text-sm text-gray-300">Your spot is confirmed once we verify your payment.</span>
          </p>
        </motion.div>

        {/* Registration ID card */}
        <motion.div
          variants={childVariants}
          className="p-6 rounded-2xl"
          style={{
            background: 'rgba(22,22,37,0.8)',
            border: '1px solid rgba(166,149,227,0.25)',
          }}
        >
          <p className="text-xs font-mono text-galaksi-400 uppercase tracking-widest mb-2">
            Registration ID
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono font-bold text-3xl text-white tracking-widest">
              {registrationId}
            </span>
            <button onClick={copyId} aria-label="Copy registration ID" className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors">
              <FiCopy className="w-4 h-4 text-gray-500 hover:text-galaksi-400 transition-colors" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Save this ID — you'll need it at check-in
          </p>
        </motion.div>

        {/* Event info */}
        <motion.div variants={childVariants} className="space-y-3">
          <div
            className="flex items-center gap-3 p-4 rounded-xl text-left"
            style={{ background: 'rgba(166,149,227,0.05)', border: '1px solid rgba(166,149,227,0.1)' }}
          >
            <FiCalendar className="text-galaksi-400 w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-display font-semibold text-white text-sm">Event Dates</p>
              <p className="text-gray-500 text-xs">28th & 29th September · 9:00 AM onwards</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            📩 A confirmation will be sent to the team leader's email address
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div variants={childVariants} className="flex gap-3 justify-center">
          <Link to="/" className="btn-outline-galaksi flex items-center gap-2">
            <FiHome className="w-4 h-4" />
            Back to Home
          </Link>
        </motion.div>

        {/* Bottom spark line */}
        <motion.div variants={childVariants}>
          <svg width="200" height="2" viewBox="0 0 200 2" className="mx-auto">
            <motion.line
              x1="0" y1="1" x2="200" y2="1"
              stroke="url(#confGrad)"
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
            />
            <defs>
              <linearGradient id="confGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a695e3" stopOpacity="0" />
                <stop offset="50%" stopColor="#c9bbf0" stopOpacity="1" />
                <stop offset="100%" stopColor="#9383cc" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      </motion.div>
    </div>
  )
}
