import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiZap, FiAlertCircle } from 'react-icons/fi'
import { supabase } from '../lib/supabase'
import KonfHubWidget from '../components/KonfHubWidget'

export default function PaymentPage() {
  const [params] = useSearchParams()
  const registrationId = params.get('id') ?? ''
  const teamName       = params.get('team') ?? ''

  const [phase, setPhase]   = useState<'loading' | 'ready_to_pay' | 'error'>('loading')
  const [error, setError]   = useState<string | null>(null)
  const [ticketFile, setTicketFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isPaymentDone, setIsPaymentDone] = useState(false)

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
      // 1. Fetch team row to verify it exists
      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .select('id')
        .eq('registration_id', registrationId)
        .single()

      if (teamErr || !team) throw new Error('Registration not found. Please go back and try again.')

      // Just transition to showing the KonfHub widget
      setTimeout(() => setPhase('ready_to_pay'), 1000)

    } catch (err: unknown) {
      console.error('Payment init error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setPhase('error')
    }
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
            {phase === 'loading' && 'Setting up payment gateway'}
            {phase === 'ready_to_pay' && 'Ready to Pay'}
          </h1>
          <p className="text-gray-500 text-sm">
            {phase === 'loading' && 'Setting up payment gateway'}
            {phase === 'ready_to_pay' && !isPaymentDone && 'Complete your payment via KonfHub below'}
            {phase === 'ready_to_pay' && isPaymentDone && 'Upload your KonfHub ticket below'}
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
              <span className="text-galaksi-400">KonfHub Checkout</span>
            </span>
          </div>
        </motion.div>

        {phase === 'ready_to_pay' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <div onClickCapture={() => setIsPaymentDone(true)}>
              <KonfHubWidget onPaymentComplete={() => setIsPaymentDone(true)} />
            </div>
            
            {isPaymentDone && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm text-gray-400 mb-3">
                  Awesome! Now just upload your KonfHub ticket to confirm registration.
                </p>
                
                <div className="mb-4">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setTicketFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-galaksi-500 file:text-white
                      hover:file:bg-galaksi-600
                      cursor-pointer"
                  />
                </div>

                {ticketFile && (
                  <button
                    onClick={async () => {
                      setIsUploading(true)
                      try {
                        // Attempt to upload to Supabase storage if it exists, otherwise just redirect
                        // We will use a bucket named 'tickets'. If it fails, we still allow them to pass (fallback).
                        if (registrationId && ticketFile) {
                          const fileExt = ticketFile.name.split('.').pop()
                          const fileName = `${registrationId}.${fileExt}`
                          const { error: uploadErr } = await supabase.storage
                            .from('tickets')
                            .upload(fileName, ticketFile, { upsert: true })
                          
                          if (!uploadErr) {
                            // Update teams table to mark ticket uploaded
                            await supabase.from('teams').update({ payment_status: 'ticket_uploaded' }).eq('id', registrationId)
                          }
                        }
                      } catch (e) {
                        console.error("Upload non-fatal error:", e)
                      }

                      setTimeout(() => {
                        const params = new URLSearchParams(window.location.search)
                        const regId = params.get('id') || 'unknown'
                        const team = params.get('team') || 'Your Team'
                        window.location.href = `/confirmation?id=${regId}&team=${encodeURIComponent(team)}`
                      }, 10000)
                    }}
                    disabled={isUploading}
                    className="btn-galaksi w-full flex items-center justify-center gap-2"
                    style={{ background: 'rgba(166,149,227,0.1)', border: '1px solid rgba(166,149,227,0.3)', color: '#fff' }}
                  >
                    {isUploading ? 'Finalizing Registration...' : 'Confirm Registration'}
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        <p className="text-xs text-gray-600 mt-4">
          Secured by KonfHub
        </p>
      </motion.div>
    </div>
  )
}
