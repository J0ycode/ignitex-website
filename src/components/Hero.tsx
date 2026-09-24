import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { FiZap, FiArrowRight, FiCalendar } from 'react-icons/fi'
import Countdown from './Countdown'
import type { RegistrationStatus } from '../lib/registrationStatus'
import { getRegistrationDates, MAX_TEAMS } from '../lib/registrationStatus'
import txaLogo from '../assets/TXA-logo.png'
import ignitexLogo from '../assets/IgniteX.png'

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

    const colors = ['#c9bbf0', '#a695e3', '#9383cc', '#F4F1FF', '#E2D8FF']

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
          background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(166,149,227,0.12) 0%, transparent 70%)',
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
            background: 'rgba(166,149,227,0.1)',
            border: '1px solid rgba(166,149,227,0.3)',
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-galaksi-400"
          />
          <span className="font-mono text-xs text-galaksi-300 font-medium uppercase tracking-widest">
            Ideathon · 28–29 {serverNow ? serverNow.toLocaleString('default', { month: 'long' }) : ''} 2026
          </span>
        </motion.div>

        {/* Pre-header Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex flex-col items-center justify-center mb-6"
        >
          <img 
            src={txaLogo} 
            alt="TXA" 
            className="h-16 sm:h-20 object-contain mb-3" 
            style={{ mixBlendMode: 'screen' }} 
          />
          <p className="text-gray-400 text-xs sm:text-sm tracking-[0.2em] uppercase font-medium" style={{ fontFamily: '"Lexend", sans-serif' }}>
            presents
          </p>
        </motion.div>

        {/* Title Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.2, duration: 0.8, type: 'spring', bounce: 0.4 }}
          className="flex flex-col items-center justify-center mb-4 w-full"
        >
          <img 
            src={ignitexLogo} 
            alt="IgniteX" 
            className="w-full max-w-[18rem] sm:max-w-lg md:max-w-2xl px-4 object-contain mb-2" 
            style={{ 
              filter: 'drop-shadow(0 0 40px rgba(166,149,227,0.4))'
            }}
          />
          <span className="text-xl sm:text-2xl font-bold tracking-[0.3em] uppercase text-galaksi-200 mt-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Ideathon
          </span>
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
              <Link to="/register" className="btn-galaksi flex items-center gap-2 text-base px-8 py-3.5">
                <FiZap className="w-4 h-4" />
                Register Your Team
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-galaksi-200 font-mono">
                  <span className="text-galaksi-300 font-bold">{teamCount}</span>
                  <span className="text-galaksi-200"> / {MAX_TEAMS} teams registered</span>
                </span>
              </div>
            </>
          )}
          {status === 'before_open' && (
            <div className="flex items-center gap-3 px-6 py-3.5 rounded-full"
              style={{ background: 'rgba(201,187,240,0.08)', border: '1px solid rgba(201,187,240,0.2)' }}>
              <FiCalendar className="text-galaksi-300 w-4 h-4" />
              <span className="font-display text-sm text-galaksi-300 font-medium">
                Registration opens {dates?.registrationOpen.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} at 12:00 PM
              </span>
            </div>
          )}
          {status === 'full' && (
            <div className="px-8 py-3.5 rounded-full text-center"
              style={{ background: 'rgba(166,149,227,0.1)', border: '1px solid rgba(166,149,227,0.3)' }}>
              <span className="font-display font-bold text-galaksi-300">🔥 All 20 slots filled!</span>
              <p className="text-xs text-galaksi-400 mt-1">See you at the event on the 28th!</p>
            </div>
          )}
          {status === 'closed' && (
            <div className="px-8 py-3.5 rounded-full"
              style={{ background: 'rgba(100,100,120,0.1)', border: '1px solid rgba(100,100,120,0.2)' }}>
              <span className="font-display text-galaksi-300">Registration closed · Event begins soon</span>
            </div>
          )}
          {(status === 'event_active') && (
            <div className="px-8 py-3.5 rounded-full animate-pulse-galaksi"
              style={{ background: 'rgba(166,149,227,0.1)', border: '1px solid rgba(166,149,227,0.4)' }}>
              <span className="font-display font-bold text-galaksi-300">🚀 igniteX is LIVE right now!</span>
            </div>
          )}
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
          <stop offset="0%" stopColor="#a695e3" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#a695e3" stopOpacity="1" />
          <stop offset="100%" stopColor="#9383cc" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id="hbGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a695e3" stopOpacity="0" />
          <stop offset="50%" stopColor="#c9bbf0" stopOpacity="1" />
          <stop offset="100%" stopColor="#a695e3" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
