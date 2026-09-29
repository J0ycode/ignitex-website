// Email certificates as a PDF.
//
//  • Team mode (no `member`): the whole team's PDF goes to the team leader; if the
//    leader's address fails, to the next member, and so on.
//  • Member mode (`member` = name as registered): that member's own certificate goes
//    to them; if their address fails, to their team leader, then the other members.
//
// Called from /admin/participation and /admin/certificates with the organiser's
// session (verify_jwt = true). The PDF is built in the organiser's browser, so it
// matches the on-screen certificates exactly.
//
// Body: { registration_id, kind: 'participation' | 'prize', label, pdf_base64, filename,
//         certificate_count?, member? }
// Secrets: CERT_GMAIL_USER + CERT_GMAIL_APP_PASSWORD (the certificates mailbox,
// ignitexnice@gmail.com). Falls back to GMAIL_USER / GMAIL_APP_PASSWORD if unset.
//
// "Fails" means what can be known while sending: an invalid address, a domain with
// no mail server, or the mail server refusing the recipient. A mailbox that bounces
// later (after Gmail accepted it) cannot be detected here.

import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => {
  const v = Deno.env.get(k)
  if (!v) throw new Error(`Missing secret ${k}`)
  return v
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_PDF_BYTES = 15 * 1024 * 1024

const APPRECIATION =
  'Thank you for taking part in igniteX Ideathon 2026 and for showcasing your skills, creativity and teamwork. ' +
  'Every idea pitched over these two days made the event what it was — we hope it is the first of many.'

/** Does the domain accept mail at all? (catches typos like gmial.com) */
async function hasMailServer(email: string): Promise<boolean> {
  const domain = email.split('@')[1]
  try {
    const mx = await Deno.resolveDns(domain, 'MX')
    if (mx.length > 0) return true
  } catch { /* no MX record — fall through to A record */ }
  try {
    const a = await Deno.resolveDns(domain, 'A')
    return a.length > 0
  } catch {
    return false
  }
}

interface Attempt { name: string; email: string; ok: boolean; reason?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // ── 1. Caller must be an organiser ──────────────────────────────────────
    const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: isAdmin, error: adminErr } = await userClient.rpc('is_admin')
    if (adminErr || isAdmin !== true) return json({ error: 'NOT_ADMIN' }, 403)

    const { registration_id, kind, label, pdf_base64, filename, certificate_count, member } = await req.json().catch(() => ({}))
    if (typeof registration_id !== 'string' || !registration_id) return json({ error: 'registration_id required' }, 400)
    if (kind !== 'participation' && kind !== 'prize') return json({ error: 'INVALID_KIND' }, 400)
    if (typeof pdf_base64 !== 'string' || pdf_base64.length < 100) return json({ error: 'PDF_REQUIRED' }, 400)
    const pdf = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0))
    if (pdf.byteLength > MAX_PDF_BYTES) return json({ error: 'PDF_TOO_LARGE' }, 413)
    if (String.fromCharCode(...pdf.slice(0, 4)) !== '%PDF') return json({ error: 'NOT_A_PDF' }, 400)

    // ── 2. Team + members (service role) ────────────────────────────────────
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
    const { data: team, error: teamErr } = await db
      .from('teams')
      .select('id, registration_id, team_name, payment_status, certificate_mail, members(name, email, is_leader)')
      .eq('registration_id', registration_id)
      .single()
    if (teamErr || !team) return json({ error: 'TEAM_NOT_FOUND' }, 404)
    if (team.payment_status !== 'verified') return json({ error: 'NOT_VERIFIED' }, 409)

    const target = typeof member === 'string' && member ? team.members.find((m) => m.name === member) ?? null : null
    if (member && !target) return json({ error: 'MEMBER_NOT_FOUND' }, 404)

    // Who to try, in order (duplicates removed)
    const rank = (m: { name: string; is_leader: boolean }) =>
      target ? (m.name === target.name ? 0 : m.is_leader ? 1 : 2) : (m.is_leader ? 0 : 1)
    const seen = new Set<string>()
    const candidates = [...team.members]
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .map((m) => ({ name: m.name.trim(), email: String(m.email ?? '').trim().toLowerCase() }))
      .filter((m) => m.email && !seen.has(m.email) && seen.add(m.email))

    const certLabel = typeof label === 'string' && label.trim() ? label.trim() : 'igniteX certificates'
    const count = Number(certificate_count) || undefined
    const forName = target ? target.name.trim() : ''

    // Certificates go out from their own mailbox when configured
    const mailUser = Deno.env.get('CERT_GMAIL_USER') || env('GMAIL_USER')
    const mailPass = Deno.env.get('CERT_GMAIL_APP_PASSWORD') || env('GMAIL_APP_PASSWORD')
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465, // Supabase Edge blocks 25/587
      secure: true,
      auth: { user: mailUser, pass: mailPass },
    })

    // ── 3. Try each candidate in turn ───────────────────────────────────────
    const attempts: Attempt[] = []
    let sentTo: Attempt | null = null
    for (const c of candidates) {
      if (!EMAIL_RE.test(c.email)) { attempts.push({ ...c, ok: false, reason: 'invalid address' }); continue }
      if (!(await hasMailServer(c.email))) { attempts.push({ ...c, ok: false, reason: 'email domain has no mail server' }); continue }

      const first = c.name.split(' ')[0]
      const intended = attempts.length === 0 // first choice, nothing failed before it
      let introHtml: string
      let introText: string
      if (target) {
        introHtml = intended
          ? `Attached is your <strong style="color:#fff">${esc(certLabel)}</strong>.`
          : `Attached is the <strong style="color:#fff">${esc(certLabel)}</strong> for your teammate <strong style="color:#fff">${esc(forName)}</strong> — we couldn't reach their email, so please pass it on to them.`
        introText = intended
          ? `Attached is your ${certLabel}.`
          : `Attached is the ${certLabel} for your teammate ${forName} — we couldn't reach their email, so please pass it on to them.`
      } else {
        const n = count ? ` (${count} certificate${count === 1 ? '' : 's'}, one per page)` : ''
        const why = intended ? '' : " We're sending these to you because we couldn't reach your team leader's email."
        introHtml = `Attached are your team's <strong style="color:#fff">${esc(certLabel)}</strong>${n}.${why}`
        introText = `Attached are team ${team.team_name}'s ${certLabel}${n}.${why}`
      }
      const shareHtml = target ? '' :
        '<p style="margin:0 0 12px;color:#CFC6BA"><strong style="color:#fff">Please share the PDF with your teammates</strong> — each of them is also being sent their own copy.</p>'

      const html = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#0C0B0A;padding:24px;color:#F5F1EA">
  <div style="max-width:520px;margin:0 auto;background:#151412;border:1px solid #2A2724;border-radius:16px;padding:24px;line-height:1.6">
    <p style="margin:0;color:#FF6B1A;font-size:12px;letter-spacing:2px;text-transform:uppercase">igniteX Ideathon 2026 · Certificate</p>
    <h1 style="margin:8px 0 12px;font-size:22px;color:#fff">${esc(team.team_name)}</h1>
    <p style="margin:0 0 12px;color:#CFC6BA">Hi ${esc(first)},</p>
    <p style="margin:0 0 12px;color:#CFC6BA">${APPRECIATION}</p>
    <p style="margin:0 0 12px;color:#CFC6BA">${introHtml}</p>
    ${shareHtml}
    <p style="margin:0 0 12px;color:#CFC6BA">Keep building — we can't wait to see what you create next.</p>
    <p style="margin:16px 0 0;font-size:13px;color:#9ca3af">Questions? Joyel Joe Josh — 62820 75201 · Albin Joseph T — 96050 54721</p>
    <p style="margin:16px 0 0;color:#CFC6BA">Warm regards,<br/>Team igniteX<br/><span style="font-size:13px;color:#9ca3af">CSE Association, Nirmala College of Engineering</span></p>
  </div>
</div>`
      const text = [
        `Hi ${first},`,
        '',
        APPRECIATION,
        '',
        introText,
        ...(target ? [] : ['Please share the PDF with your teammates — each of them is also being sent their own copy.']),
        "Keep building — we can't wait to see what you create next.",
        '',
        'Questions? Joyel 62820 75201 · Albin 96050 54721',
        '',
        'Warm regards,',
        'Team igniteX · CSE Association, Nirmala College of Engineering',
      ].join('\n')

      try {
        const info = await transporter.sendMail({
          from: `"igniteX" <${mailUser}>`,
          to: c.email,
          subject: target
            ? `igniteX 2026 — Your ${certLabel}${intended ? '' : ` (for ${forName})`}`
            : `igniteX 2026 — ${certLabel} for team ${team.team_name}`,
          html,
          text,
          attachments: [{
            filename: typeof filename === 'string' && filename.endsWith('.pdf') ? filename : `igniteX-certificate-${team.registration_id}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          }],
        })
        if (info.rejected?.length) {
          attempts.push({ ...c, ok: false, reason: 'rejected by mail server' })
          continue
        }
        sentTo = { ...c, ok: true }
        attempts.push(sentTo)
        break
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // Auth / connection problems are ours, not the recipient's — stop rather than spam the next member
        if (/auth|login|credentials|ECONN|ETIMEDOUT|socket/i.test(msg)) {
          console.error('SMTP failure', msg)
          return json({ sent: false, error: 'EMAIL_SERVICE_FAILED', attempts }, 502)
        }
        attempts.push({ ...c, ok: false, reason: 'rejected by mail server' })
      }
    }

    if (!sentTo) return json({ sent: false, error: 'NO_REACHABLE_MEMBER', attempts }, 422)

    // ── 4. Record it: team sends under [kind], member sends under [kind + '_members'][name]
    const record = {
      to: sentTo.email,
      name: sentTo.name,
      fallback: attempts.length > 1,
      at: new Date().toISOString(),
    }
    const current = (team.certificate_mail ?? {}) as Record<string, unknown>
    const membersKey = `${kind}_members`
    const merged = target
      ? { ...current, [membersKey]: { ...((current[membersKey] as Record<string, unknown>) ?? {}), [target.name]: record } }
      : { ...current, [kind]: record }
    await db.from('teams').update({ certificate_mail: merged }).eq('id', team.id)

    return json({ sent: true, ...record, attempts })
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
