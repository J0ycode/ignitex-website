import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiZap, FiArrowRight, FiCalendar } from 'react-icons/fi'
import Countdown from './Countdown'
import type { RegistrationStatus } from '../lib/registrationStatus'
import { getRegistrationDates, MAX_TEAMS } from '../lib/registrationStatus'

interface HeroProps {
  status: RegistrationStatus | null
  serverNow: Date | null
  teamCount: number
  loading: boolean
}

export default function Hero({ status, serverNow, teamCount, loading }: HeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Particle ember canvas animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; color: string;
    }> = []

    const colors = ['#ff6b00', '#ff8c35', '#ffd166', '#ff3011', '#ffbe00']

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.6 - 0.2,
        size: Math.random() * 2.5 + 0.5,
        alpha: Math.random() * 0.6 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    let animId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.alpha -= 0.001
        if (p.y < 0 || p.alpha <= 0) {
          p.x = Math.random() * canvas.width
          p.y = canvas.height + 10
          p.alpha = Math.random() * 0.6 + 0.2
          p.vy = -Math.random() * 0.6 - 0.2
        }
        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.shadowBlur = 6
        ctx.shadowColor = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
      animId = requestAnimationFrame(animate)
    }
    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const dates = serverNow ? getRegistrationDates(serverNow) : null

  const getCountdownTarget = (): { target: Date; label: string; variant: 'opening' | 'closing' | 'event' } | null => {
    if (!dates || !serverNow) return null
    switch (status) {
      case 'before_open':
        return { target: dates.registrationOpen, label: '⚡ Registration Opens In', variant: 'opening' }
      case 'open':
        return { target: dates.registrationClose, label: '🔥 Registration Closes In', variant: 'closing' }
      case 'closed':
      case 'full':
        return { target: dates.eventStart, label: '🚀 Event Starts In', variant: 'event' }
      default:
        return null
    }
  }

  const countdown = getCountdownTarget()

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay opacity-40" style={{ zIndex: 1 }} />

      {/* Radial ember glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(255,107,0,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-24 pb-16">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
          style={{
            background: 'rgba(255,107,0,0.1)',
            border: '1px solid rgba(255,107,0,0.3)',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-ember-500"
          />
          <span className="font-mono text-xs text-ember-400 font-medium uppercase tracking-widest">
            Ideathon · 28–29 {serverNow ? serverNow.toLocaleString('default', { month: 'long' }) : ''} 2026
          </span>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="mb-4"
        >
          <h1 className="font-display font-extrabold leading-none tracking-tight">
            <span
              className="block text-white"
              style={{ fontSize: 'clamp(4rem, 14vw, 9rem)', lineHeight: 1.0 }}
            >
              ignite
              <motion.span
                className="text-gradient-ember animate-flicker"
                animate={{ textShadow: ['0 0 20px rgba(255,107,0,0.3)', '0 0 60px rgba(255,107,0,0.8)', '0 0 20px rgba(255,107,0,0.3)'] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                X
              </motion.span>
            </span>
          </h1>
        </motion.div>

        {/* Tagline with heartbeat */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex items-center justify-center gap-3 mb-10"
        >
          <div className="h-px flex-1 max-w-16 bg-gradient-to-r from-transparent to-ember-500/50" />
          <motion.p
            className="font-display text-base sm:text-lg text-gray-300 font-medium"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            "Ideas are the pulses of progress"
          </motion.p>
          <div className="h-px flex-1 max-w-16 bg-gradient-to-l from-transparent to-ember-500/50" />
        </motion.div>

        {/* Heartbeat line */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="flex justify-center mb-12"
        >
          <HeartbeatLine />
        </motion.div>

        {/* Countdown section */}
        {!loading && countdown && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mb-12"
          >
            <Countdown
              targetDate={countdown.target}
              label={countdown.label}
              variant={countdown.variant}
            />
          </motion.div>
        )}

        {/* Status-aware CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {status === 'open' && (
            <>
              <Link to="/register" className="btn-ember flex items-center gap-2 text-base px-8 py-3.5">
                <FiZap className="w-4 h-4" />
                Register Your Team
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-gray-400 font-mono">
                  <span className="text-ember-400 font-bold">{teamCount}</span>
                  <span className="text-gray-500"> / {MAX_TEAMS} teams registered</span>
                </span>
              </div>
            </>
          )}
          {status === 'before_open' && (
            <div className="flex items-center gap-3 px-6 py-3.5 rounded-lg"
              style={{ background: 'rgba(255,190,0,0.08)', border: '1px solid rgba(255,190,0,0.2)' }}>
              <FiCalendar className="text-spark-400 w-4 h-4" />
              <span className="font-display text-sm text-spark-400 font-medium">
                Registration opens {dates?.registrationOpen.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} at 12:00 PM
              </span>
            </div>
          )}
          {status === 'full' && (
            <div className="px-8 py-3.5 rounded-lg text-center"
              style={{ background: 'rgba(255,48,17,0.1)', border: '1px solid rgba(255,48,17,0.3)' }}>
              <span className="font-display font-bold text-flame-400">🔥 All 20 slots filled!</span>
              <p className="text-xs text-gray-400 mt-1">See you at the event on the 28th!</p>
            </div>
          )}
          {status === 'closed' && (
            <div className="px-8 py-3.5 rounded-lg"
              style={{ background: 'rgba(100,100,120,0.1)', border: '1px solid rgba(100,100,120,0.2)' }}>
              <span className="font-display text-gray-400">Registration closed · Event begins soon</span>
            </div>
          )}
          {(status === 'event_active') && (
            <div className="px-8 py-3.5 rounded-lg animate-pulse-ember"
              style={{ background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.4)' }}>
              <span className="font-display font-bold text-ember-400">🚀 igniteX is LIVE right now!</span>
            </div>
          )}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center gap-1 cursor-pointer"
            onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="text-xs text-gray-600 font-mono uppercase tracking-widest">Scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-ember-500/50 to-transparent" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

function HeartbeatLine() {
  return (
    <svg width="320" height="40" viewBox="0 0 320 40" className="opacity-70">
      <motion.path
        d="M0,20 L60,20 L75,5 L90,35 L105,5 L120,35 L135,20 L160,20 L175,8 L190,32 L205,15 L215,25 L225,20 L320,20"
        fill="none"
        stroke="url(#hbGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.5 }}
      />
      <motion.path
        d="M0,20 L60,20 L75,5 L90,35 L105,5 L120,35 L135,20 L160,20 L175,8 L190,32 L205,15 L215,25 L225,20 L320,20"
        fill="none"
        stroke="url(#hbGlowGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.3 }}
        transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.5 }}
      />
      <defs>
        <linearGradient id="hbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#ff6b00" stopOpacity="1" />
          <stop offset="100%" stopColor="#ff3011" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="hbGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff6b00" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffd166" stopOpacity="1" />
          <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
