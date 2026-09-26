// Shared login for the event-day check-in desk (/registration).
//
// Volunteers type a shared ID + password. If they match the secrets, this
// signs them into a dedicated desk account that can only use the check-in
// RPCs (see migration 20260926110000). No password for that account exists —
// a one-time magic-link token is minted and exchanged for a session here.
//
// Secrets (supabase secrets set …):
//   CHECKIN_USERNAME   shared login ID
//   CHECKIN_PASSWORD   shared password
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'

// .invalid is a reserved TLD: nobody can own it, so no one can receive a login email for this account
const DESK_EMAIL = 'checkin-desk@ignitex.invalid'
const MAX_FAILS = 8            // per IP …
const WINDOW_MINUTES = 15      // … per window

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

/** Constant-time string compare, so timing doesn't leak the password. */
function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'

    // ── 1. Rate limit failed attempts per IP ────────────────────────────────
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
    const { count } = await db
      .from('checkin_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip).eq('ok', false).gte('created_at', since)
    if ((count ?? 0) >= MAX_FAILS) return json({ error: 'TOO_MANY_ATTEMPTS' }, 429)

    // ── 2. Check the shared credentials ─────────────────────────────────────
    const { username, password } = await req.json().catch(() => ({}))
    const ok =
      typeof username === 'string' && typeof password === 'string' &&
      safeEqual(username.trim().toLowerCase(), env('CHECKIN_USERNAME').toLowerCase()) &&
      safeEqual(password, env('CHECKIN_PASSWORD'))

    await db.from('checkin_login_attempts').insert({ ip, ok })
    if (!ok) return json({ error: 'INVALID_LOGIN' }, 401)

    // ── 3. Make sure the desk account exists and is desk staff ──────────────
    let userId: string | undefined
    const created = await db.auth.admin.createUser({ email: DESK_EMAIL, email_confirm: true })
    if (created.data.user) {
      userId = created.data.user.id
    } else {
      const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: DESK_EMAIL })
      if (error) throw error
      userId = link.user.id
    }
    const { error: staffErr } = await db.from('checkin_staff').upsert({ user_id: userId })
    if (staffErr) throw staffErr

    // ── 4. Mint a one-time token and exchange it for a session ──────────────
    const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: 'magiclink', email: DESK_EMAIL })
    if (linkErr) throw linkErr

    const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false } })
    const { data: verified, error: otpErr } = await anon.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    })
    if (otpErr || !verified.session) throw otpErr ?? new Error('No session')

    return json({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    })
  } catch (e) {
    console.error(e)
    return json({ error: 'SERVER_ERROR' }, 500)
  }
})
