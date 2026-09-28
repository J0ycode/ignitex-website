// Email a team that it was selected for the final round.
//
// Called from /admin with the organiser's session (verify_jwt = true).
// Body: { registration_id: string, dry_run?: boolean }
//   dry_run returns the rendered email without sending (for checking).
// Secrets: GMAIL_USER, GMAIL_APP_PASSWORD, SITE_URL (same as send-ticket).

import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'
import QRCode from 'npm:qrcode@1.5'
import { buildSelectionEmail } from './email.ts'

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

    const { registration_id, dry_run } = await req.json().catch(() => ({}))
    if (typeof registration_id !== 'string' || !registration_id) return json({ error: 'registration_id required' }, 400)

    // ── 2. Load team (service role) ─────────────────────────────────────────
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
    const { data: team, error: teamErr } = await db
      .from('teams')
      .select('id, registration_id, team_name, payment_status, members(name, email, is_leader)')
      .eq('registration_id', registration_id)
      .single()
    if (teamErr || !team) return json({ error: 'TEAM_NOT_FOUND' }, 404)
    if (team.payment_status !== 'verified') return json({ error: 'NOT_VERIFIED' }, 409)

    // Final Round pass = ticket page with ?r=final; the QR encodes the same URL
    const passUrl = `${env('SITE_URL').replace(/\/+$/, '')}/ticket/${encodeURIComponent(team.registration_id)}?r=final`
    const mail = buildSelectionEmail(team, passUrl)
    if (dry_run) return json({ dry_run: true, pass_url: passUrl, ...mail })
    const qrPng = await QRCode.toBuffer(passUrl, { width: 480, margin: 1 })

    // ── 3. Send ─────────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465, // Supabase Edge blocks 25/587
      secure: true,
      auth: { user: env('GMAIL_USER'), pass: env('GMAIL_APP_PASSWORD') },
    })
    try {
      await transporter.sendMail({
        from: `"igniteX" <${env('GMAIL_USER')}>`,
        to: mail.to,
        cc: mail.cc,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: [{ filename: mail.qrFilename, content: qrPng, cid: mail.qrCid }],
      })
    } catch (mailErr) {
      console.error('Mail failed', mailErr)
      return json({ emailed: false, error: 'EMAIL_FAILED' }, 502)
    }

    const sentAt = new Date().toISOString()
    await db.from('teams').update({ final_mail_sent_at: sentAt }).eq('id', team.id)
    return json({ emailed: true, sent_at: sentAt, recipients: [mail.to, ...mail.cc] })
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
