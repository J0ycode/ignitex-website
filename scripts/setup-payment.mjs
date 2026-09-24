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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'teams' and policyname = 'allow_public_update_teams'
  ) then
    execute $p$create policy "allow_public_update_teams" on teams for update using (true)$p$;
  end if;
end
$$;
`

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
const secretRes = await fetch(
  'https://api.supabase.com/v1/projects/yufgcqknxdnxrtvwiwfz/secrets',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ name: 'EKQR_API_KEY', value: '12a08a7d-f910-4b15-a17c-07649fb6a4e0' }]),
  }
)
if (secretRes.ok) {
  console.log('✅  EKQR_API_KEY secret set')
} else {
  const b = await secretRes.json()
  console.error('❌  Failed to set secret:', b)
}

console.log('\n🎉  All done! Test your payment flow at http://localhost:5173/register')
