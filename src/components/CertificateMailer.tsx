import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FunctionsHttpError } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { FiMail, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi'
import { supabase } from '../lib/supabase'

/*
 * Emails a team's certificates as one PDF. The PDF is drawn from the same
 * certificate components the page shows (rendered off-screen at full A4 size),
 * then sent by the send-certificates Edge Function: team leader first, falling
 * back to the next member if the leader's address fails.
 */

export type CertKind = 'participation' | 'prize'

export interface MailRecord { to: string; name: string; fallback: boolean; at: string }

interface Attempt { name: string; email: string; ok: boolean; reason?: string }

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })

/** Renders DOM pages (.pc-page, full size) into an A4-landscape PDF, base64 encoded. */
async function pagesToPdf(pages: HTMLElement[]): Promise<string> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  await document.fonts.ready
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  for (const [i, page] of pages.entries()) {
    const img = await toJpeg(page, { quality: 0.9, pixelRatio: 2, cacheBust: true, backgroundColor: '#FBF8F3' })
    if (i > 0) pdf.addPage('a4', 'landscape')
    pdf.addImage(img, 'JPEG', 0, 0, 297, 210, undefined, 'FAST')
  }
  const uri = pdf.output('datauristring')
  return uri.slice(uri.indexOf(',') + 1)
}

export function useCertificateMailer<C>({ kind, label, render }: {
  kind: CertKind
  /** Shown in the email subject/body, e.g. 'certificates of participation' */
  label: string
  render: (cert: C) => React.ReactNode
}) {
  const [stage, setStage] = useState<C[] | null>(null)
  const [busyTeam, setBusyTeam] = useState<string | null>(null)
  const [sent, setSent] = useState<Record<string, MailRecord>>({})
  const stageRef = useRef<HTMLDivElement>(null)

  /** Returns true when sent. */
  const sendTeam = async (team: { registration_id: string; team_name: string }, certs: C[], quiet = false): Promise<boolean> => {
    if (certs.length === 0) { toast.error(`No certificates ticked for ${team.team_name}`); return false }
    setBusyTeam(team.registration_id)
    const t = quiet ? undefined : toast.loading(`Preparing ${team.team_name}'s PDF…`)
    try {
      // Render off-screen, wait for layout, fonts and images, then capture
      setStage(certs)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const root = stageRef.current
      if (!root) throw new Error('stage missing')
      await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)))
      const pages = [...root.querySelectorAll<HTMLElement>('.pc-page')]
      const pdf = await pagesToPdf(pages)

      if (t) toast.loading(`Emailing ${team.team_name}…`, { id: t })
      const { data, error } = await supabase.functions.invoke('send-certificates', {
        body: {
          registration_id: team.registration_id,
          kind,
          label,
          certificate_count: certs.length,
          pdf_base64: pdf,
          filename: `igniteX-2026-${kind}-${team.team_name.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`,
        },
      })
      let body: (Partial<MailRecord> & { sent?: boolean; error?: string; attempts?: Attempt[] }) | null = data
      if (error instanceof FunctionsHttpError) body = await error.context.json().catch(() => null)

      if (body?.sent && body.to && body.at) {
        const rec: MailRecord = { to: body.to, name: body.name ?? '', fallback: !!body.fallback, at: body.at }
        setSent((s) => ({ ...s, [team.registration_id]: rec }))
        const msg = rec.fallback
          ? `${team.team_name}: leader unreachable — sent to ${rec.name} (${rec.to})`
          : `${team.team_name}: sent to leader ${rec.name}`
        if (t) toast.success(msg, { id: t, duration: 6000 })
        return true
      }
      const failed = (body?.attempts ?? []).map((a) => `${a.email} (${a.reason})`).join(', ')
      const reason = body?.error === 'NO_REACHABLE_MEMBER' ? `no member's email worked${failed ? `: ${failed}` : ''}`
        : body?.error === 'EMAIL_SERVICE_FAILED' ? 'the email service failed — try again'
        : body?.error ?? error?.message ?? 'unknown error'
      toast.error(`${team.team_name}: ${reason}`, { id: t, duration: 9000 })
      return false
    } catch (e) {
      console.error(e)
      toast.error(`${team.team_name}: could not build the PDF`, { id: t })
      return false
    } finally {
      setStage(null)
      setBusyTeam(null)
    }
  }

  // Off-screen, full-size copies of the certificates being sent
  const stageElement = stage && createPortal(
    <div ref={stageRef} className="pc-export" aria-hidden>
      {stage.map((c, i) => <div key={i}>{render(c)}</div>)}
    </div>,
    document.body,
  )

  return { sendTeam, busyTeam, sent, stageElement }
}

/** Per-team "Email" button + where it last went. */
export function MailStatus({ record, busy, disabled, onSend }: {
  record?: MailRecord | null
  busy: boolean
  disabled?: boolean
  onSend: () => void
}) {
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs min-w-0">
        {record ? (
          <span className={`flex items-start gap-1.5 ${record.fallback ? 'text-amber-300' : 'text-green-300'}`}>
            {record.fallback ? <FiAlertTriangle className="shrink-0 mt-0.5" /> : <FiCheckCircle className="shrink-0 mt-0.5" />}
            <span className="break-all">
              {record.fallback ? 'Leader failed · sent to ' : 'Sent to '}{record.name || record.to} · {when(record.at)}
            </span>
          </span>
        ) : (
          <span className="text-stone-500">Not emailed yet</span>
        )}
      </p>
      <button
        onClick={onSend}
        disabled={busy || disabled}
        className="shrink-0 flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg bg-galaksi-500/15 border border-galaksi-500/40 text-xs font-semibold text-galaksi-100 disabled:opacity-40"
      >
        <FiMail /> {busy ? 'Sending…' : record ? 'Resend' : 'Email to leader'}
      </button>
    </div>
  )
}
