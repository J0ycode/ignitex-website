import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiZap, FiAlertCircle } from 'react-icons/fi'
import { supabase } from '../lib/supabase'

const REGISTRATION_FEE = 1 // ₹1 for testing

export default function PaymentPage() {
  const [params] = useSearchParams()
  const registrationId = params.get('id') ?? ''
  const teamName       = params.get('team') ?? ''

  const [phase, setPhase]   = useState<'loading' | 'ready_to_pay' | 'waiting' | 'error'>('loading')
  const [error, setError]   = useState<string | null>(null)
  const [dots, setDots]     = useState('')
  const [countdown, setCountdown] = useState(40)
  const [paymentUrl, setPaymentUrl] = useState<string>('')

  // Animate dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [])

  // 40 second countdown timer
  useEffect(() => {
    if (phase !== 'waiting') return
    if (countdown <= 0) {
      window.location.href = `/payment-callback?id=${registrationId}&team=${encodeURIComponent(teamName)}`
      return
    }
    const t = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [phase, countdown, registrationId, teamName])

  useEffect(() => {
    if (!registrationId) {
      setError('Missing registration ID. Please go back and try again.')
      setPhase('error')
      return
    }
    initiatePayment()
  }, [registrationId])

  const initiatePayment = async () => {
    try {
      // 1. Fetch team row to get team ID
      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .select('id')
        .eq('registration_id', registrationId)
        .single()

      if (teamErr || !team) throw new Error('Registration not found. Please go back and try again.')

      // 2. Fetch leader for that specific team
      const { data: leader, error: leaderErr } = await supabase
        .from('members')
        .select('name, email, phone')
        .eq('team_id', team.id)
        .eq('is_leader', true)
        .single()

      if (leaderErr || !leader) throw new Error('Could not fetch team leader details')

      // 2. Store payment initiation timestamp (non-fatal if column missing)
      const now = new Date()
      const { error: updateErr } = await supabase
        .from('teams')
        .update({
          payment_status: 'initiated',
          payment_initiated_at: now.toISOString(),
        })
        .eq('registration_id', registrationId)
      if (updateErr) console.warn('Could not update payment_initiated_at:', updateErr.message)

      // 3. Build redirect URL — EkQR requires a public HTTPS URL
      //    Set VITE_APP_URL in .env to your deployed URL or ngrok tunnel
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin
      const redirectUrl = `${appUrl}/payment-callback?id=${registrationId}&team=${encodeURIComponent(teamName)}`
      // Phase is updated when EkQR responds

      // 4. Call edge function to create EkQR order
      const { data, error: fnErr } = await supabase.functions.invoke('ekqr-create-order', {
        body: {
          client_txn_id:   registrationId,
          amount:          String(REGISTRATION_FEE),
          p_info:          `igniteX Registration — ${teamName}`,
          customer_name:   leader.name,
          customer_email:  leader.email,
          customer_mobile: leader.phone,
          redirect_url:    redirectUrl,
        },
      })

      if (fnErr) throw fnErr
      if (!data?.status) throw new Error(data?.msg || 'Failed to create payment order')

      const url: string = data?.data?.payment_url ?? data?.payment_url ?? ''
      if (!url) throw new Error('No payment URL returned from EkQR')
      
      setPaymentUrl(url)
      setPhase('ready_to_pay')

    } catch (err: unknown) {
      console.error('Payment init error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  const handlePayClick = () => {
    if (!paymentUrl) return
    window.open(paymentUrl, '_blank')
    setPhase('waiting')
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full space-y-6"
        >
          <div
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)' }}
          >
            <FiAlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-2xl text-white mb-2">Payment Setup Failed</h1>
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
          <button
            onClick={initiatePayment}
            className="btn-galaksi"
          >
            Try Again
          </button>
          <a href="/" className="block text-xs text-gray-600 hover:text-galaksi-400 transition-colors">
            ← Back to home
          </a>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md w-full space-y-8"
      >
        {/* Animated Logo */}
        <motion.div className="flex justify-center">
          <div className="relative">
            {/* Outer pulsing ring */}
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(166,149,227,0.4) 0%, transparent 70%)' }}
            />
            {/* Inner ring spinner */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
              className="w-24 h-24 rounded-full"
              style={{
                border: '3px solid rgba(166,149,227,0.15)',
                borderTopColor: '#a695e3',
                borderRightColor: '#c9bbf0',
              }}
            />
            {/* Center icon */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(166,149,227,0.2), rgba(147,131,204,0.1))',
                  border: '1px solid rgba(166,149,227,0.3)',
                }}
              >
                <FiZap className="w-6 h-6 text-galaksi-400" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Text */}
        <div>
          <h1 className="font-display font-extrabold text-3xl text-white mb-3">
            {phase === 'loading' && 'Setting up payment'}
            {phase === 'ready_to_pay' && 'Ready to Pay'}
            {phase === 'waiting' && 'Waiting for Payment'}
            {(phase === 'loading') && <span className="text-galaksi-400">{dots}</span>}
          </h1>
          <p className="text-gray-500 text-sm">
            {phase === 'loading' && 'Creating your secure UPI payment order'}
            {phase === 'ready_to_pay' && 'Click the button below to open the payment page'}
            {phase === 'waiting' && (
              <>
                Please complete the payment in the new tab.<br />
                Automatically verifying in <span className="text-galaksi-400 font-bold">{countdown}s</span>...
              </>
            )}
          </p>
        </div>

        {/* Payment details card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="p-5 rounded-2xl text-left space-y-3"
          style={{ background: 'rgba(22,22,37,0.8)', border: '1px solid rgba(166,149,227,0.2)' }}
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Team</span>
            <span className="font-display font-bold text-white">{teamName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Registration ID</span>
            <span className="font-mono text-sm text-galaksi-400">{registrationId}</span>
          </div>
          <div
            className="flex justify-between items-center pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Amount</span>
            <span className="font-display font-black text-2xl text-white">
              ₹<span className="text-galaksi-400">{REGISTRATION_FEE}</span>
            </span>
          </div>
        </motion.div>

        {phase === 'ready_to_pay' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <button
              onClick={handlePayClick}
              className="btn-galaksi w-full"
            >
              Pay Now (₹{REGISTRATION_FEE})
            </button>
          </motion.div>
        )}

        <p className="text-xs text-gray-600">
          Secured by EkQR · Pay via any UPI app
        </p>
      </motion.div>
    </div>
  )
}
