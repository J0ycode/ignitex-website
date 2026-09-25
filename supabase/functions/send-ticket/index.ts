// Verify a team's payment and email them their ticket.
//
// Called from /admin with the organiser's session (verify_jwt = true).
// Secrets (supabase secrets set …):
//   GMAIL_USER           e.g. ignitex.team@gmail.com
//   GMAIL_APP_PASSWORD   16-char Google "App password" (needs 2-Step Verification)
//   SITE_URL             e.g. https://ignitex.example.com   (no trailing slash)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'
import QRCode from 'npm:qrcode@1.5'
import { buildTicketEmail, ticketUrlFor } from './email.ts'

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

    const { registration_id } = await req.json().catch(() => ({}))
    if (typeof registration_id !== 'string' || !registration_id) return json({ error: 'registration_id required' }, 400)

    // ── 2. Load team (service role) ─────────────────────────────────────────
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
    const { data: team, error: teamErr } = await db
      .from('teams')
      .select('id, registration_id, team_name, payment_status, created_at, members(name, email, phone, college, is_leader)')
      .eq('registration_id', registration_id)
      .single()
    if (teamErr || !team) return json({ error: 'TEAM_NOT_FOUND' }, 404)

    // Organisers may verify a team with no uploaded proof (paid in cash / checked
    // offline). If its unpaid 2-hour hold already lapsed, it only gets a slot
    // when one is free — same rule as submit_payment.
    if (team.payment_status === 'pending') {
      const holdMs = 2 * 60 * 60 * 1000 // _slot_hold()
      const holdsSlot = Date.now() - new Date(team.created_at).getTime() < holdMs
      if (!holdsSlot) {
        const [{ data: active, error: e1 }, { data: cfg, error: e2 }] = await Promise.all([
          db.rpc('_active_team_count'),
          db.rpc('_reg_config'),
        ])
        if (e1 || e2) throw e1 ?? e2
        const max = (Array.isArray(cfg) ? cfg[0] : cfg)?.max_teams ?? 25
        if (active >= max) return json({ error: 'SLOTS_FULL' }, 409)
      }
    }

    // ── 3. Mark verified (before emailing, so a mail failure can be retried) ─
    if (team.payment_status !== 'verified') {
      const { error } = await db.from('teams').update({ payment_status: 'verified' }).eq('id', team.id)
      if (error) throw error
    }

    // ── 4. Build + send the ticket email ────────────────────────────────────
    const ticketUrl = ticketUrlFor(env('SITE_URL'), team.registration_id)
    const mail = buildTicketEmail(team, ticketUrl)
    const qrPng = await QRCode.toBuffer(ticketUrl, { width: 480, margin: 1 })

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
      return json({ verified: true, emailed: false, error: 'EMAIL_FAILED', ticket_url: ticketUrl }, 502)
    }

    await db.from('teams').update({ ticket_sent_at: new Date().toISOString() }).eq('id', team.id)

    return json({
      verified: true,
      emailed: true,
      recipients: [mail.to, ...mail.cc],
      ticket_url: ticketUrl,
    })
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500)
  }
})
