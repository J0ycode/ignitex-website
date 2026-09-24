// supabase/functions/ekqr-check-order/index.ts
// Proxies EkQR check_order_status so the API key stays server-side

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { client_txn_id, txndate } = await req.json()

    // @ts-ignore
    const EKQR_KEY = Deno.env.get('EKQR_API_KEY')
    if (!EKQR_KEY) throw new Error('EKQR_API_KEY secret not set')

    const ekqrRes = await fetch('https://api.ekqr.in/api/check_order_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: EKQR_KEY, client_txn_id, txn_date: txndate }),
    })

    const data = await ekqrRes.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ status: false, msg: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
