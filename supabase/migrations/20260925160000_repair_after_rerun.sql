-- ─────────────────────────────────────────────────────────────────────────────
-- Repair: re-running 20260925120000_lockdown_registration.sql after the later
-- migrations recreates the old register_team(text, jsonb) overload (→ HTTP 300
-- "Could not choose the best candidate function") and drops/revokes things the
-- later migrations added. Safe to run any number of times.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Only the device-aware register_team(text, jsonb, uuid default null) may exist
drop function if exists public.register_team(text, jsonb);

-- 2. Admin realtime on teams (from 20260925150000)
grant select on public.teams to authenticated;
drop policy if exists "admins_read_teams" on public.teams;
create policy "admins_read_teams" on public.teams
  for select to authenticated using (public.is_admin());

-- 3. Admins can open payment proofs (from 20260925130000)
drop policy if exists "tickets_admin_read" on storage.objects;
create policy "tickets_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'tickets' and public.is_admin());

-- 4. Anonymous insert-only uploads (from 20260925120000) — ensure present
drop policy if exists "tickets_insert_only" on storage.objects;
create policy "tickets_insert_only" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'tickets'
    and name ~ '^[A-Z0-9]{6,10}/[0-9a-f-]{36}\.(png|jpe?g|webp|heic|pdf)$'
  );

-- 5. Latest submit_payment (records payment IP + unique-UTR message)
create or replace function public.submit_payment(
  p_registration_id text, p_screenshot_path text, p_utr text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_utr !~ '^[0-9A-Za-z]{10,22}$' then raise exception 'INVALID_UTR'; end if;
  if p_screenshot_path !~ '^[A-Z0-9]{6,10}/[0-9a-f-]{36}\.(png|jpe?g|webp|heic|pdf)$' then
    raise exception 'INVALID_SCREENSHOT_PATH';
  end if;

  update teams
     set payment_status         = 'ticket_uploaded',
         payment_screenshot_url = p_screenshot_path,
         payment_txn_id         = upper(p_utr),
         payment_submitted_at   = now(),
         payment_ip             = _client_ip()
   where registration_id = upper(btrim(p_registration_id))
     and payment_status in ('pending', 'ticket_uploaded', 'rejected')
     and split_part(p_screenshot_path, '/', 1) = upper(btrim(p_registration_id));

  if not found then raise exception 'PAYMENT_NOT_ALLOWED'; end if;
exception
  when unique_violation then raise exception 'UTR_ALREADY_USED';
end $$;

notify pgrst, 'reload schema';
