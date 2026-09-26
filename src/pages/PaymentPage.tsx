import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiZap, FiAlertCircle, FiAlertTriangle, FiCopy, FiSmartphone, FiUploadCloud, FiX, FiGrid, FiCheck, FiClock, FiMail, FiRefreshCw, FiDownload, FiChevronDown } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { QRCodeCanvas } from 'qrcode.react'
import { UPI_ID, UPI_PAYEE_NAME, ENTRY_FEE, upiPayUrl, upiAppLinks, friendlyRpcError } from '../lib/payment'
import { compressImage, withTimeout, uuid, TimeoutError } from '../lib/upload'
import { useCountdown } from '../hooks/useCountdown'
import HelpContacts from '../components/HelpContacts'
import { CONTACTS, formatPhone, whatsappUrl } from '../lib/contacts'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024 // images get compressed before upload
const MAX_PDF_BYTES   = 5 * 1024 * 1024
const UPLOAD_TIMEOUT_MS = 60_000
const RPC_TIMEOUT_MS    = 20_000
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'pdf']
// Some phones give HEIC files an empty type; the bucket only accepts these types
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', pdf: 'application/pdf',
}

export default function PaymentPage() {
  const [params] = useSearchParams()
  const registrationId = (params.get('id') ?? '').toUpperCase()

  const [phase, setPhase]         = useState<'loading' | 'ready_to_pay' | 'error'>('loading')
  const [error, setError]         = useState<string | null>(null)
  const [teamName, setTeamName]   = useState(params.get('team') ?? '')
  const [file, setFile]           = useState<File | null>(null)
  const [utr, setUtr]             = useState('')
  const [uploadStep, setUploadStep] = useState<'compressing' | 'uploading' | 'saving' | null>(null)
  const isUploading = uploadStep !== null
  const [isPaymentDone, setIsPaymentDone] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [checking, setChecking] = useState(false)
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null)
  const hold = useCountdown(holdExpiresAt)
  const [showQr, setShowQr]       = useState(false)
  const qrRef = useRef<HTMLCanvasElement>(null)
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
      // &state=pending | verified | rejected previews the later screens
      const state = params.get('state')
      setTeamName('Test Team')
      setIsPaymentDone(state === 'pending' || state === 'verified')
      setIsVerified(state === 'verified')
      setWasRejected(state === 'rejected')
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
    setIsVerified(team.payment_status === 'verified')
    setWasRejected(team.payment_status === 'rejected')
    setHoldExpiresAt(team.hold_expires_at ? new Date(team.hold_expires_at) : null)
    setPhase('ready_to_pay')
  }, [registrationId])

  useEffect(() => { loadTeam() }, [loadTeam])

  /** Quiet re-check used by the status tab (no full-page loader) */
  const checkStatus = useCallback(async () => {
    if (import.meta.env.DEV && registrationId === 'TEST') return
    setChecking(true)
    const { data } = await supabase.rpc('get_team_summary', { p_registration_id: registrationId })
    setChecking(false)
    const team = Array.isArray(data) ? data[0] : null
    if (!team) return
    setIsVerified(team.payment_status === 'verified')
    if (team.payment_status === 'rejected') {
      setWasRejected(true)
      setIsPaymentDone(false)
    }
  }, [registrationId])

  // While waiting for verification, re-check every 30s
  useEffect(() => {
    if (!isPaymentDone || isVerified) return
    const t = setInterval(checkStatus, 30_000)
    return () => clearInterval(t)
  }, [isPaymentDone, isVerified, checkStatus])

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
      toast(`UPI ID: ${UPI_ID}`)
    }
  }

  /** Saves the QR (with a white border so scanners read it) for "upload from gallery". */
  const saveQr = () => {
    const qr = qrRef.current
    if (!qr) return
    const pad = 24
    const out = document.createElement('canvas')
    out.width = qr.width + pad * 2
    out.height = qr.height + pad * 2
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(qr, pad, pad)
    const a = document.createElement('a')
    a.href = out.toDataURL('image/png')
    a.download = `igniteX-payment-${registrationId}.png`
    a.click()
    toast.success('QR saved — open your UPI app → Scan → gallery')
  }

  const onPickFile = (f: File | null) => {
    if (!f) return setFile(null)
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.includes(ext)) return toast.error('Please upload an image or PDF')
    const isPdf = ext === 'pdf'
    if (f.size > (isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES)) {
      return toast.error(isPdf ? 'PDF is larger than 5 MB' : 'Image is larger than 20 MB')
    }
    setFile(f)
  }

  const cleanUtr = utr.replace(/\s/g, '')
  const utrValid = /^[0-9A-Za-z]{10,22}$/.test(cleanUtr)

  const submitPayment = async () => {
    if (!file || !utrValid) return
    try {
      // Dev-only TEST mode: simulate success without touching the database
      if (import.meta.env.DEV && registrationId === 'TEST') {
        setUploadStep('compressing')
        const out = await compressImage(file)
        console.info(`[TEST] compressed ${file.size} → ${out.size} bytes`)
        setUploadStep('uploading')
        await new Promise((r) => setTimeout(r, 800))
        toast.success('TEST: upload simulated (nothing saved)')
        setIsPaymentDone(true)
        return
      }

      setUploadStep('compressing')
      const toUpload = await compressImage(file)

      setUploadStep('uploading')
      const ext = toUpload.name.split('.').pop()!.toLowerCase()
      const path = `${registrationId}/${uuid()}.${ext}`
      const { error: uploadErr } = await withTimeout(
        supabase.storage
          .from('tickets')
          .upload(path, toUpload, { upsert: false, contentType: toUpload.type || MIME_BY_EXT[ext] }),
        UPLOAD_TIMEOUT_MS,
      )
      if (uploadErr) throw uploadErr

      setUploadStep('saving')
      const { error: rpcErr } = await withTimeout(
        supabase.rpc('submit_payment', {
          p_registration_id: registrationId,
          p_screenshot_path: path,
          p_utr: cleanUtr,
        }),
        RPC_TIMEOUT_MS,
      )
      if (rpcErr) throw rpcErr

      toast.success('Payment proof submitted!')
      setIsPaymentDone(true)
      setWasRejected(false)
    } catch (e) {
      console.error('Payment submit error:', e)
      if (e instanceof TimeoutError || (e instanceof Error && /fetch|network/i.test(e.message))) {
        toast.error('Upload is taking too long — check your connection and try again.', { duration: 6000 })
      } else {
        toast.error(friendlyRpcError(e as { message?: string }))
      }
    } finally {
      setUploadStep(null)
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
            <h1 className="font-display font-extrabold text-2xl text-galaksi-100 mb-2">Couldn't load your registration</h1>
            <p className="text-stone-300 text-sm">{error}</p>
          </div>
          <button onClick={loadTeam} className="btn-galaksi">Try again</button>
          <a href="/" className="block text-xs text-stone-400 hover:text-galaksi-400 transition-colors">
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
          <p className="font-mono text-sm text-stone-400">Loading your registration…</p>
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
            style={{ background: 'rgba(255,255,255,0.075)', border: '1px solid rgba(255,107,26,0.3)' }}
          >
            <FiZap className="w-6 h-6 text-galaksi-400" />
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-galaksi-100 mb-2">
            {isVerified ? 'Payment verified' : isPaymentDone ? 'Under verification' : 'Complete payment'}
          </h1>
          <p className="text-stone-300 text-sm">
            {isVerified
              ? 'Your ticket has been emailed to your team.'
              : isPaymentDone
              ? "We're cross-checking your payment. Your ticket arrives by email once verified."
              : `Pay ₹${ENTRY_FEE} via UPI, then upload the screenshot and UTR.`}
          </p>
        </div>

        {/* Summary card */}
        <div
          className="p-5 rounded-2xl space-y-3"
          style={{ background: 'rgba(21,20,18,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Row label="Team"><span className="font-display font-bold text-galaksi-100 truncate">{teamName}</span></Row>
          <Row label="Reg. ID"><span className="font-mono text-sm text-galaksi-300">{registrationId}</span></Row>
          <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Row label="Amount"><span className="font-display font-black text-2xl text-galaksi-300">₹{ENTRY_FEE}</span></Row>
          </div>
        </div>

        {!isPaymentDone ? (
          <>
            {holdExpiresAt && (
              <div
                className={`p-3 rounded-xl text-sm text-center ${hold.total > 0 ? 'text-amber-100' : 'text-red-200'}`}
                style={{
                  background: hold.total > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${hold.total > 0 ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.3)'}`,
                }}
              >
                {hold.total > 0 ? (
                  <>Pay within <span className="font-mono font-bold">
                    {String(hold.hours).padStart(2, '0')}:{String(hold.minutes).padStart(2, '0')}:{String(hold.seconds).padStart(2, '0')}
                  </span> to keep your slot</>
                ) : (
                  <>Your slot hold has expired — you can still pay if a slot is free.</>
                )}
              </div>
            )}
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
                  className="flex items-center justify-center min-h-[44px] text-sm text-stone-300 underline underline-offset-4"
                >
                  Other UPI app
                </a>
              </div>

              {/* Backup: always works, in any UPI app, whatever the default app is */}
              <div
                className="p-3 rounded-xl space-y-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.075)' }}
              >
                <p className="text-xs text-stone-300 sm:hidden">Button not working? Pay manually to this UPI ID:</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono uppercase tracking-widest text-stone-400">UPI ID</p>
                    <p className="font-mono text-sm text-galaksi-100 truncate select-all">{UPI_ID}</p>
                    <p className="text-xs text-stone-400 truncate">Paying to: {UPI_PAYEE_NAME}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyUpi}
                    className="flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold text-galaksi-200 border border-galaksi-400/40 active:bg-white/10"
                  >
                    <FiCopy className="w-4 h-4" /> Copy
                  </button>
                </div>
                <ol className="text-xs text-stone-300 space-y-1 list-decimal list-inside">
                  <li>Open GPay / PhonePe / Paytm → <strong>Pay UPI ID</strong></li>
                  <li>Paste the UPI ID and check the name shows <strong>{UPI_PAYEE_NAME}</strong></li>
                  <li>Pay <strong>₹{ENTRY_FEE}</strong> with note <span className="font-mono text-galaksi-100">{registrationId}</span></li>
                </ol>
              </div>

              <div
                role="note"
                className="flex gap-2.5 p-3 rounded-xl text-xs text-amber-100"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <FiAlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-300" />
                <div className="space-y-1.5">
                  <p className="font-semibold text-amber-200">Bank server issues</p>
                  <p>
                    Some banks are facing outages. If your payment fails, try another bank
                    account in your UPI app. Do not pay twice. If it still fails, message us
                    and we'll help you keep your slot:
                  </p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1">
                    {CONTACTS.map((c) => (
                      <a
                        key={c.phone}
                        href={whatsappUrl(c.phone, `Hi ${c.name}, my igniteX payment is failing. Team ${teamName}, registration ID ${registrationId}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-amber-200 underline underline-offset-2"
                      >
                        {c.name} · {formatPhone(c.phone)}
                      </a>
                    ))}
                  </p>
                </div>
              </div>

              <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.075)' }}
              >
              <button
                type="button"
                onClick={() => setShowQr((s) => !s)}
                aria-expanded={showQr}
                className="w-full flex items-center justify-between gap-2 px-4 min-h-[52px] text-sm font-semibold text-galaksi-100 active:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  <FiGrid className="w-4 h-4" /> Scan QR and pay
                </span>
                <FiChevronDown className={`w-4 h-4 transition-transform ${showQr ? 'rotate-180' : ''}`} />
              </button>

              <div className={`${showQr ? 'flex' : 'hidden'} flex-col items-center gap-2 px-4 pb-4`}>
                {/* Generated from the UPI intent, so amount + reg. ID note are pre-filled */}
                <div className="p-3 bg-white rounded-xl">
                  <QRCodeCanvas
                    ref={qrRef}
                    value={upiPayUrl(registrationId)}
                    size={196}
                    level="M"
                    role="img"
                    aria-label={`UPI QR code to pay ₹${ENTRY_FEE} to ${UPI_ID}`}
                  />
                </div>
                <p className="text-xs text-stone-400">{UPI_PAYEE_NAME} · ₹{ENTRY_FEE}</p>
                <button
                  type="button"
                  onClick={saveQr}
                  className="flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold text-galaksi-200 border border-galaksi-400/40 active:bg-white/10"
                >
                  <FiDownload className="w-4 h-4" /> Download QR
                </button>
                <p className="text-xs text-stone-300 text-center max-w-[18rem]">
                  <span className="sm:hidden">
                    On this phone: save the QR, then in GPay / PhonePe / Paytm tap
                    <strong> Scan QR → upload from gallery</strong>.{' '}
                  </span>
                  Scan using the scanner <strong>inside</strong> your UPI app — the
                  phone camera may open WhatsApp instead.
                </p>
              </div>
              </div>
            </section>

            {/* Step 2: proof */}
            <section className="space-y-3">
              <StepLabel n={2}>Upload proof</StepLabel>

              <label
                className="relative flex flex-col items-center justify-center gap-2 w-full min-h-[140px] rounded-2xl cursor-pointer text-center p-4 overflow-hidden"
                style={{ border: '2px dashed rgba(255,107,26,0.35)', background: 'rgba(255,255,255,0.025)' }}
              >
                {preview ? (
                  <img src={preview} alt="Payment screenshot preview" className="max-h-56 rounded-lg object-contain" />
                ) : file ? (
                  <p className="text-sm text-galaksi-100">{file.name}</p>
                ) : (
                  <>
                    <FiUploadCloud className="w-8 h-8 text-galaksi-300" />
                    <span className="text-sm font-semibold text-galaksi-100">Tap to upload payment screenshot</span>
                    <span className="text-xs text-stone-400">Screenshot (PNG/JPG) or PDF</span>
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
                  className="flex items-center gap-1 text-xs text-stone-300 min-h-[36px]"
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
                <p className="text-xs text-stone-400 mt-1 ml-1">
                  Find it under “UPI transaction ID” / “UTR” in your payment app.
                </p>
              </div>

              <button
                onClick={submitPayment}
                disabled={!file || !utrValid || isUploading}
                className="btn-galaksi w-full min-h-[52px] disabled:opacity-50 disabled:pointer-events-none"
              >
                {uploadStep === 'compressing' ? 'Preparing image…'
                  : uploadStep === 'uploading' ? 'Uploading…'
                  : uploadStep === 'saving' ? 'Saving…'
                  : 'Submit payment proof'}
              </button>
            </section>
          </>
        ) : (
          <VerificationStatus
            verified={isVerified}
            registrationId={registrationId}
            checking={checking}
            onCheck={checkStatus}
          />
        )}

        <HelpContacts context={`Team ${teamName}, registration ID ${registrationId}.`} />
      </motion.div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-xs font-mono text-stone-400 uppercase tracking-widest shrink-0">{label}</span>
      {children}
    </div>
  )
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-display font-semibold text-galaksi-100">
      <span className="w-6 h-6 rounded-full text-xs flex items-center justify-center bg-galaksi-500/30 text-galaksi-200">
        {n}
      </span>
      {children}
    </p>
  )
}

function VerificationStatus({
  verified, registrationId, checking, onCheck,
}: { verified: boolean; registrationId: string; checking: boolean; onCheck: () => void }) {
  const steps = [
    { label: 'Team registered', done: true },
    { label: 'Payment proof & UTR submitted', done: true },
    { label: 'Payment verified by organisers', done: verified, active: !verified },
    { label: 'Ticket emailed to your team', done: verified },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <ol
        className="p-5 rounded-2xl space-y-4"
        style={{ background: 'rgba(21,20,18,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3">
            <span
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
                s.done ? 'bg-green-500/25 text-green-300' : s.active ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-stone-400'
              }`}
            >
              {s.done ? <FiCheck className="w-4 h-4" /> : s.active ? <FiClock className="w-4 h-4 animate-pulse" /> : <FiMail className="w-3.5 h-3.5" />}
            </span>
            <span className={`text-sm ${s.done ? 'text-galaksi-100' : s.active ? 'text-amber-200 font-semibold' : 'text-stone-400'}`}>
              {s.label}
              {s.active && <span className="block text-xs font-normal text-stone-400">Usually within a few hours</span>}
            </span>
          </li>
        ))}
      </ol>

      {verified ? (
        <Link to={`/ticket/${registrationId}`} className="btn-galaksi w-full min-h-[52px]">
          View your ticket
        </Link>
      ) : (
        <>
          <button
            onClick={onCheck}
            disabled={checking}
            className="btn-outline-galaksi w-full gap-2 min-h-[52px] disabled:opacity-60"
          >
            <FiRefreshCw className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking…' : 'Check status'}
          </button>
          <p className="text-xs text-stone-400 text-center">
            Bookmark this page to check back anytime. The ticket goes to every member's email,
            and we'll also message the team leader on WhatsApp.
          </p>
        </>
      )}
    </motion.div>
  )
}
