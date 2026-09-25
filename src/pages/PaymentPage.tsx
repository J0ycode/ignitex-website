import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiZap, FiAlertCircle, FiCopy, FiSmartphone, FiUploadCloud, FiX, FiGrid } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { UPI_ID, UPI_PAYEE_NAME, ENTRY_FEE, upiPayUrl, upiAppLinks, friendlyRpcError } from '../lib/payment'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'pdf']

export default function PaymentPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const registrationId = (params.get('id') ?? '').toUpperCase()

  const [phase, setPhase]         = useState<'loading' | 'ready_to_pay' | 'error'>('loading')
  const [error, setError]         = useState<string | null>(null)
  const [teamName, setTeamName]   = useState(params.get('team') ?? '')
  const [file, setFile]           = useState<File | null>(null)
  const [utr, setUtr]             = useState('')
  const [isUploading, setIsUploading]     = useState(false)
  const [isPaymentDone, setIsPaymentDone] = useState(false)
  const [showQr, setShowQr]       = useState(false)
  const [wasRejected, setWasRejected] = useState(false)

  const loadTeam = useCallback(async () => {
    setPhase('loading')
    if (!registrationId) {
      setError('Missing registration ID. Please go back and try again.')
      setPhase('error')
      return
    }
    // Dev-only: /payment?id=TEST previews the pay buttons without a real team.
    // Stripped from production builds.
    if (import.meta.env.DEV && registrationId === 'TEST') {
      setTeamName('Test Team')
      setPhase('ready_to_pay')
      return
    }
    const { data, error: rpcErr } = await supabase.rpc('get_team_summary', { p_registration_id: registrationId })
    const team = Array.isArray(data) ? data[0] : null
    if (rpcErr || !team) {
      console.error('Payment init error:', rpcErr)
      setError('Registration not found. Please check your link or register again.')
      setPhase('error')
      return
    }
    setTeamName(team.team_name)
    if (team.payment_status === 'ticket_uploaded' || team.payment_status === 'verified') setIsPaymentDone(true)
    setWasRejected(team.payment_status === 'rejected')
    setPhase('ready_to_pay')
  }, [registrationId])

  useEffect(() => { loadTeam() }, [loadTeam])

  const preview = useMemo(
    () => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file],
  )
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID)
      toast.success('UPI ID copied')
    } catch {
      toast(`UPI ID: ${UPI_ID}`, { icon: '📋' })
    }
  }

  const onPickFile = (f: File | null) => {
    if (!f) return setFile(null)
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.includes(ext)) return toast.error('Please upload an image or PDF')
    if (f.size > MAX_FILE_BYTES) return toast.error('File is larger than 5 MB')
    setFile(f)
  }

  const cleanUtr = utr.replace(/\s/g, '')
  const utrValid = /^[0-9A-Za-z]{10,22}$/.test(cleanUtr)

  const submitPayment = async () => {
    if (!file || !utrValid) return
    setIsUploading(true)
    try {
      const ext = file.name.split('.').pop()!.toLowerCase()
      const path = `${registrationId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('tickets')
        .upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (uploadErr) throw uploadErr

      const { error: rpcErr } = await supabase.rpc('submit_payment', {
        p_registration_id: registrationId,
        p_screenshot_path: path,
        p_utr: cleanUtr,
      })
      if (rpcErr) throw rpcErr

      toast.success('Payment proof submitted!')
      setIsPaymentDone(true)
      setWasRejected(false)
    } catch (e) {
      console.error('Payment submit error:', e)
      toast.error(friendlyRpcError(e as { message?: string }))
    } finally {
      setIsUploading(false)
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
            <h1 className="font-display font-extrabold text-2xl text-white mb-2">Couldn't load payment</h1>
            <p className="text-gray-300 text-sm">{error}</p>
          </div>
          <button onClick={loadTeam} className="btn-galaksi">Try Again</button>
          <a href="/" className="block text-xs text-gray-400 hover:text-galaksi-400 transition-colors">
            ← Back to home
          </a>
        </motion.div>
      </div>
    )
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 rounded-full border-2 border-galaksi-500/30 border-t-galaksi-500"
          />
          <p className="font-mono text-sm text-gray-400">Loading your registration…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex justify-center px-4 pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-6"
      >
        <div className="text-center">
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(166,149,227,0.15)', border: '1px solid rgba(166,149,227,0.3)' }}
          >
            <FiZap className="w-6 h-6 text-galaksi-400" />
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white mb-2">
            {isPaymentDone ? 'Payment Submitted' : 'Complete Payment'}
          </h1>
          <p className="text-gray-300 text-sm">
            {isPaymentDone
              ? "We'll verify your payment and confirm by email."
              : `Pay ₹${ENTRY_FEE} via UPI, then upload the screenshot and UTR.`}
          </p>
        </div>

        {/* Summary card */}
        <div
          className="p-5 rounded-2xl space-y-3"
          style={{ background: 'rgba(22,22,37,0.85)', border: '1px solid rgba(166,149,227,0.2)' }}
        >
          <Row label="Team"><span className="font-display font-bold text-white truncate">{teamName}</span></Row>
          <Row label="Reg. ID"><span className="font-mono text-sm text-galaksi-300">{registrationId}</span></Row>
          <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Row label="Amount"><span className="font-display font-black text-2xl text-galaksi-300">₹{ENTRY_FEE}</span></Row>
          </div>
        </div>

        {!isPaymentDone ? (
          <>
            {wasRejected && (
              <div
                className="p-4 rounded-xl text-sm text-red-200"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                We couldn't verify your previous payment proof. Please check the UTR and upload again,
                or contact the organisers.
              </div>
            )}
            {/* Step 1: pay */}
            <section className="space-y-3">
              <StepLabel n={1}>Pay ₹{ENTRY_FEE}</StepLabel>

              {/* Mobile: the phone can't scan its own screen, and a plain upi:// link
                  opens the *default* UPI app (often WhatsApp) — so target each app. */}
              <div className="sm:hidden space-y-2">
                {upiAppLinks(registrationId).map((app, i) => (
                  <a
                    key={app.name}
                    href={app.href}
                    className={`${i === 0 ? 'btn-galaksi' : 'btn-outline-galaksi'} w-full gap-2 min-h-[52px]`}
                  >
                    <FiSmartphone className="w-5 h-5" />
                    Pay with {app.name}
                  </a>
                ))}
                <a
                  href={upiPayUrl(registrationId)}
                  className="flex items-center justify-center min-h-[44px] text-sm text-gray-300 underline underline-offset-4"
                >
                  Other UPI app
                </a>
              </div>

              {/* Backup: always works, in any UPI app, whatever the default app is */}
              <div
                className="p-3 rounded-xl space-y-3"
                style={{ background: 'rgba(166,149,227,0.06)', border: '1px solid rgba(166,149,227,0.15)' }}
              >
                <p className="text-xs text-gray-300 sm:hidden">Button not working? Pay manually to this UPI ID:</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono uppercase tracking-widest text-gray-400">UPI ID</p>
                    <p className="font-mono text-sm text-white truncate select-all">{UPI_ID}</p>
                    <p className="text-xs text-gray-400 truncate">Paying to: {UPI_PAYEE_NAME}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyUpi}
                    className="flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold text-galaksi-200 border border-galaksi-400/40 active:bg-white/10"
                  >
                    <FiCopy className="w-4 h-4" /> Copy
                  </button>
                </div>
                <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                  <li>Open GPay / PhonePe / Paytm → <strong>Pay UPI ID</strong></li>
                  <li>Paste the UPI ID and check the name shows <strong>{UPI_PAYEE_NAME}</strong></li>
                  <li>Pay <strong>₹{ENTRY_FEE}</strong> with note <span className="font-mono text-white">{registrationId}</span></li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => setShowQr((s) => !s)}
                className="sm:hidden w-full flex items-center justify-center gap-2 min-h-[44px] text-sm text-gray-300"
              >
                <FiGrid className="w-4 h-4" />
                {showQr ? 'Hide QR code' : 'Paying from another phone? Show QR'}
              </button>

              <div className={`${showQr ? 'flex' : 'hidden'} sm:flex flex-col items-center gap-2`}>
                {/* Generated from the UPI intent, so amount + reg. ID note are pre-filled */}
                <div className="p-3 bg-white rounded-xl border-2 border-galaksi-500 shadow-[0_0_20px_rgba(166,149,227,0.3)]">
                  <QRCodeSVG
                    value={upiPayUrl(registrationId)}
                    size={196}
                    level="M"
                    role="img"
                    aria-label={`UPI QR code to pay ₹${ENTRY_FEE} to ${UPI_ID}`}
                  />
                </div>
                <p className="text-xs text-gray-300 text-center max-w-[16rem]">
                  Scan using the scanner <strong>inside</strong> GPay / PhonePe / Paytm — the
                  phone camera may open WhatsApp instead.
                </p>
              </div>
            </section>

            {/* Step 2: proof */}
            <section className="space-y-3">
              <StepLabel n={2}>Upload proof</StepLabel>

              <label
                className="relative flex flex-col items-center justify-center gap-2 w-full min-h-[140px] rounded-2xl cursor-pointer text-center p-4 overflow-hidden"
                style={{ border: '2px dashed rgba(166,149,227,0.35)', background: 'rgba(166,149,227,0.05)' }}
              >
                {preview ? (
                  <img src={preview} alt="Payment screenshot preview" className="max-h-56 rounded-lg object-contain" />
                ) : file ? (
                  <p className="text-sm text-white">📄 {file.name}</p>
                ) : (
                  <>
                    <FiUploadCloud className="w-8 h-8 text-galaksi-300" />
                    <span className="text-sm font-semibold text-white">Tap to upload payment screenshot</span>
                    <span className="text-xs text-gray-400">PNG, JPG or PDF · max 5 MB</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="sr-only"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="flex items-center gap-1 text-xs text-gray-300 min-h-[36px]"
                >
                  <FiX className="w-3.5 h-3.5" /> Remove file
                </button>
              )}

              <div>
                <label htmlFor="utr" className="label-galaksi">UTR / Transaction ID</label>
                <input
                  id="utr"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  enterKeyHint="done"
                  placeholder="12-digit UPI reference number"
                  className={`input-galaksi ${utr && !utrValid ? 'error' : ''}`}
                />
                <p className="text-xs text-gray-400 mt-1 ml-1">
                  Find it under “UPI transaction ID” / “UTR” in your payment app.
                </p>
              </div>

              <button
                onClick={submitPayment}
                disabled={!file || !utrValid || isUploading}
                className="btn-galaksi w-full min-h-[52px] disabled:opacity-50 disabled:pointer-events-none"
              >
                {isUploading ? 'Uploading…' : 'Submit Payment Proof'}
              </button>
            </section>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <p className="text-sm text-gray-300 text-center">
              Grab your official ticket from KonfHub below.
            </p>
            <div className="w-full rounded-xl overflow-hidden bg-white/5 p-2 border border-white/10">
              <iframe
                src="https://konfhub.com/widget/id/a6805b76-b8e6-4512-9a02-5fac9fc51ec1"
                id="konfhub-widget"
                title="IgniteX tickets on KonfHub"
                width="100%"
                className="h-[70vh] sm:h-[500px]"
                allow="payment"
                style={{ border: 'none', borderRadius: '8px' }}
              />
            </div>
            <button
              onClick={() => navigate(`/confirmation?id=${registrationId}&team=${encodeURIComponent(teamName)}`)}
              className="btn-outline-galaksi w-full min-h-[52px]"
            >
              Continue
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-xs font-mono text-gray-400 uppercase tracking-widest shrink-0">{label}</span>
      {children}
    </div>
  )
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-display font-semibold text-white">
      <span className="w-6 h-6 rounded-full text-xs flex items-center justify-center bg-galaksi-500/30 text-galaksi-200">
        {n}
      </span>
      {children}
    </p>
  )
}
