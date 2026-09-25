// Runs the payment schema migration against your Supabase project
// Uses the Supabase Management API with a personal access token

const PAT = process.env.SUPABASE_ACCESS_TOKEN

if (!PAT) {
  console.error('\n❌  Set SUPABASE_ACCESS_TOKEN first.\n   Get it at: https://supabase.com/dashboard/account/tokens\n')
  process.exit(1)
}

const sql = `
alter table teams add column if not exists payment_status text not null default 'pending';
alter table teams add column if not exists payment_txn_id text;
alter table teams add column if not exists payment_initiated_at timestamptz;
`
// NOTE: do NOT add a public UPDATE policy on teams. Payment updates go through
// the submit_payment() RPC — see supabase/migrations/*_lockdown_registration.sql

const res = await fetch(
  'https://api.supabase.com/v1/projects/yufgcqknxdnxrtvwiwfz/database/query',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
)

const body = await res.json()

if (!res.ok) {
  console.error('❌  SQL failed:', body)
  process.exit(1)
}
console.log('✅  SQL migration done:', body)

// ── Disable JWT verification on both edge functions ───────────────────────────
for (const fn of ['ekqr-create-order', 'ekqr-check-order']) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/yufgcqknxdnxrtvwiwfz/functions/${fn}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ verify_jwt: false }),
    }
  )
  const b = await r.json()
  if (r.ok) {
    console.log(`✅  JWT verification disabled on ${fn}`)
  } else {
    console.error(`❌  Failed to update ${fn}:`, b)
  }
}

// ── Set EKQR_API_KEY secret ───────────────────────────────────────────────────
const EKQR_API_KEY = process.env.EKQR_API_KEY
if (!EKQR_API_KEY) {
  console.error('❌  Set EKQR_API_KEY in your environment (never commit it).')
  process.exit(1)
}
const secretRes = await fetch(
  'https://api.supabase.com/v1/projects/yufgcqknxdnxrtvwiwfz/secrets',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ name: 'EKQR_API_KEY', value: EKQR_API_KEY }]),
  }
)
if (secretRes.ok) {
  console.log('✅  EKQR_API_KEY secret set')
} else {
  const b = await secretRes.json()
  console.error('❌  Failed to set secret:', b)
}

console.log('\n🎉  All done! Test your payment flow at http://localhost:5173/register')
