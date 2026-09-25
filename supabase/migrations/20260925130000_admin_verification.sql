-- ─────────────────────────────────────────────────────────────────────────────
-- Admin payment verification (/admin).
-- Run AFTER 20260925120000_lockdown_registration.sql.
--
-- To make someone an admin:
--   1. Supabase Dashboard → Authentication → Users → "Add user" (email + password)
--   2. insert into public.admins (user_id)
--        select id from auth.users where email = 'organiser@example.com';
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- Teams + members for the dashboard
create or replace function public.admin_list_teams()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'registration_id',        t.registration_id,
      'team_name',              t.team_name,
      'payment_status',         t.payment_status,
      'payment_txn_id',         t.payment_txn_id,
      'payment_screenshot_url', t.payment_screenshot_url,
      'payment_submitted_at',   t.payment_submitted_at,
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', m.name, 'email', m.email, 'phone', m.phone,
          'college', m.college, 'is_leader', m.is_leader
        ) order by m.is_leader desc, m.name), '[]'::jsonb)
        from members m where m.team_id = t.id
      )
    ) order by t.payment_submitted_at desc nulls last, t.team_name)
    from teams t
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_set_payment_status(p_registration_id text, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_status not in ('pending', 'ticket_uploaded', 'verified', 'rejected') then
    raise exception 'INVALID_STATUS';
  end if;
  update teams set payment_status = p_status where registration_id = p_registration_id;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
end $$;

-- Teams whose proof was rejected may upload again
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
         payment_submitted_at   = now()
   where registration_id = upper(btrim(p_registration_id))
     and payment_status in ('pending', 'ticket_uploaded', 'rejected')
     and split_part(p_screenshot_path, '/', 1) = upper(btrim(p_registration_id));

  if not found then raise exception 'PAYMENT_NOT_ALLOWED'; end if;
end $$;

revoke all on function public.is_admin()                               from public;
revoke all on function public.admin_list_teams()                       from public;
revoke all on function public.admin_set_payment_status(text, text)     from public;
grant execute on function public.is_admin()                            to authenticated;
grant execute on function public.admin_list_teams()                    to authenticated;
grant execute on function public.admin_set_payment_status(text, text)  to authenticated;

-- Admins can read payment proofs (via short-lived signed URLs)
drop policy if exists "tickets_admin_read" on storage.objects;
create policy "tickets_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'tickets' and public.is_admin());
