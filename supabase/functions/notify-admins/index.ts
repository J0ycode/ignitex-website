// Push a "new payment proof" notification to every subscribed organiser device.
//
// Called by the teams_notify_admins database trigger (pg_net), not by browsers,
// so JWT verification is off and a shared secret is checked instead.
// Secrets (supabase secrets set …):
//   NOTIFY_WEBHOOK_SECRET  same value as vault secret 'notify_webhook_secret'
//   VAPID_PUBLIC_KEY       from: npx web-push generate-vapid-keys
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT          e.g. mailto:organiser@example.com

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const env = (k: string) => {
  const v = Deno.env.get(k)
  if (!v) throw new Error(`Missing secret ${k}`)
  return v
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (req.headers.get('x-webhook-secret') !== env('NOTIFY_WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { registration_id, team_name, utr } = await req.json().catch(() => ({}))

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const { data: subs, error } = await db.from('admin_push_subscriptions').select('endpoint, keys')
  if (error) return new Response(error.message, { status: 500 })

  const payload = JSON.stringify({
    title: '💸 New payment proof',
    body: `${team_name ?? 'A team'} (${registration_id ?? '?'}) · UTR ${utr ?? '—'}`,
    url: '/admin',
    tag: `payment-${registration_id}`,
  })

  let sent = 0
  const expired: string[] = []
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 60 * 60 })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) expired.push(s.endpoint) // device unsubscribed
        else console.error('push failed', code, e)
      }
    }),
  )
  if (expired.length) await db.from('admin_push_subscriptions').delete().in('endpoint', expired)

  return new Response(JSON.stringify({ sent, removed: expired.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
