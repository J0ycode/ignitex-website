import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiCheckCircle, FiAlertCircle, FiClock, FiRefreshCw } from 'react-icons/fi'
import { supabase } from '../lib/supabase'

type VerifyPhase = 'verifying' | 'success' | 'pending' | 'failed'

/** Format a Date as DD-MM-YYYY (EkQR's txndate format) */
function formatTxnDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export default function PaymentCallbackPage() {
  const [params]   = useSearchParams()
  const navigate   = useNavigate()
  const registrationId = params.get('id') ?? ''
  const teamName       = params.get('team') ?? ''

  const [phase, setPhase]     = useState<VerifyPhase>('verifying')
  const [attempt, setAttempt] = useState(0)
  const [txnId, setTxnId]     = useState<string | null>(null)
  const [utr, setUtr]         = useState('')
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false)
  const pollRef               = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!registrationId) {
      setPhase('failed')
      return
    }
    verifyPayment()
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [registrationId])

  const verifyPayment = async (tryCount = 0) => {
    setAttempt(tryCount + 1)
    try {
      // Fetch the payment_initiated_at date from Supabase for txndate
      const { data: team } = await supabase
        .from('teams')
        .select('payment_initiated_at, payment_status')
        .eq('registration_id', registrationId)
        .single()

      // If already marked paid (e.g., webhook hit already), skip polling
      if (team?.payment_status === 'paid') {
        setPhase('success')
        redirectToConfirmation()
        return
      }

      const txnDate = team?.payment_initiated_at
        ? formatTxnDate(new Date(team.payment_initiated_at))
        : formatTxnDate(new Date())

      // Call check_order_status edge function
      const { data, error: fnErr } = await supabase.functions.invoke('ekqr-check-order', {
        body: { client_txn_id: registrationId, txndate: txnDate },
      })

      if (fnErr) throw fnErr

      // EkQR response: data.status === true, data.data.status === "success"|"pending"|"failure"
      const orderStatus: string = (data?.data?.status ?? data?.status_desc ?? '').toLowerCase()
      const upiTxnId: string    = data?.data?.upi_txn_id ?? data?.data?.txn_id ?? ''

      if (orderStatus === 'success') {
        // Mark as paid in Supabase
        await supabase
          .from('teams')
          .update({ payment_status: 'paid', payment_txn_id: upiTxnId || null })
          .eq('registration_id', registrationId)

        setTxnId(upiTxnId || null)
        setPhase('success')
        // Navigate to confirmation after short celebration delay
        setTimeout(() => redirectToConfirmation(), 2200)

      } else if (orderStatus === 'failure' || orderStatus === 'failed') {
        await supabase
          .from('teams')
          .update({ payment_status: 'failed' })
          .eq('registration_id', registrationId)
        setPhase('failed')

      } else {
        // Still pending — retry up to 15 times with 4-second delays (~1 minute total)
        if (tryCount < 15) {
          pollRef.current = setTimeout(() => verifyPayment(tryCount + 1), 4000)
        } else {
          setPhase('pending')
        }
      }
    } catch (err) {
      console.error('Verify payment error:', err)
      if (tryCount < 5) {
        pollRef.current = setTimeout(() => verifyPayment(tryCount + 1), 4000)
      } else {
        setPhase('pending')
      }
    }
  }

  const redirectToConfirmation = () => {
    navigate(`/confirmation?id=${registrationId}&team=${encodeURIComponent(teamName)}`)
  }

  const handleManualUtrSubmit = async () => {
    if (!utr || utr.trim().length < 8) {
      alert("Please enter a valid UTR or Transaction ID.")
      return
    }

    setIsSubmittingUtr(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({ 
          payment_status: 'manual_verification',
          payment_txn_id: utr.trim()
        })
        .eq('registration_id', registrationId)

      if (error) throw error
      
      // Successfully submitted manual UTR
      setTxnId(utr.trim())
      setPhase('success')
      setTimeout(() => redirectToConfirmation(), 2200)

    } catch (err) {
      console.error('Error submitting UTR:', err)
      alert("Something went wrong while submitting the UTR. Please try again.")
      setIsSubmittingUtr(false)
    }
  }

  // ── UI states ──────────────────────────────────────────────────────────────
  if (phase === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md w-full space-y-8"
        >
          {/* Spinner */}
          <div className="flex justify-center">
            <div className="relative w-24 h-24">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full"
                style={{
                  border: '3px solid rgba(166,149,227,0.15)',
                  borderTopColor: '#a695e3',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <FiCheckCircle className="w-8 h-8 text-galaksi-400 opacity-50" />
              </div>
            </div>
          </div>

          <div>
            <h1 className="font-display font-extrabold text-3xl text-white mb-2">
              Verifying Payment
            </h1>
            <p className="text-gray-500 text-sm">
              Confirming your UPI transaction{attempt > 1 ? ` (attempt ${attempt})` : ''}…
            </p>
          </div>

          <div
            className="p-4 rounded-xl text-sm text-gray-500"
            style={{ background: 'rgba(22,22,37,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            Please wait — this usually takes a few seconds
          </div>
        </motion.div>
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full space-y-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex justify-center"
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(166,149,227,0.15)',
                border: '2px solid rgba(166,149,227,0.5)',
                boxShadow: '0 0 40px rgba(166,149,227,0.3)',
              }}
            >
              <FiCheckCircle className="w-10 h-10 text-galaksi-400" />
            </div>
          </motion.div>
          <div>
            <h1 className="font-display font-extrabold text-3xl text-white mb-2">Payment Confirmed!</h1>
            <p className="text-gray-400 text-sm">
              {txnId ? `UPI Ref: ${txnId}` : 'Your payment was received successfully.'}
            </p>
          </div>
          <p className="text-gray-600 text-xs">Redirecting you to confirmation…</p>
        </motion.div>
      </div>
    )
  }

  if (phase === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full space-y-6"
        >
          <div
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
            style={{ background: 'rgba(234,179,8,0.1)', border: '2px solid rgba(234,179,8,0.3)' }}
          >
            <FiClock className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-2xl text-white mb-2">Payment Pending</h1>
            <p className="text-gray-500 text-sm">
              We couldn't confirm your payment yet. If you completed the UPI payment, it may take a few minutes.
            </p>
          </div>
          <div
            className="p-4 rounded-xl text-left space-y-2"
            style={{ background: 'rgba(22,22,37,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-xs font-mono text-galaksi-400 uppercase tracking-widest">Your Registration ID</p>
            <p className="font-mono font-bold text-xl text-white">{registrationId}</p>
          </div>
          
          <div className="pt-2 pb-2">
            <p className="text-sm font-semibold text-white mb-2">Did your money leave your bank account?</p>
            <p className="text-xs text-gray-400 mb-3">
              If your bank account was debited but it still says pending, please enter the 12-digit UTR/UPI Reference Number from your GPay/PhonePe app below to manually verify it.
            </p>
            <input 
              type="text" 
              placeholder="Enter 12-Digit UTR Number" 
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 mb-3 focus:outline-none focus:border-galaksi-400"
            />
            <button
              onClick={handleManualUtrSubmit}
              disabled={isSubmittingUtr || utr.length < 4}
              className="w-full bg-galaksi-500 hover:bg-galaksi-400 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingUtr ? 'Submitting...' : 'Submit UTR & Verify'}
            </button>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => { setPhase('verifying'); verifyPayment(0) }}
              className="btn-outline-galaksi flex items-center gap-2 text-sm"
            >
              <FiRefreshCw className="w-4 h-4" /> Check EkQR Status Again
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // failed
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
          <h1 className="font-display font-extrabold text-2xl text-white mb-2">Payment Failed</h1>
          <p className="text-gray-500 text-sm">
            The payment was not completed. Your registration has been saved — you can try paying again.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <a
            href={`/payment?id=${registrationId}&team=${encodeURIComponent(teamName)}`}
            className="btn-galaksi"
          >
            Try Again
          </a>
          <a href="/" className="btn-outline-galaksi">Back to Home</a>
        </div>
      </motion.div>
    </div>
  )
}
