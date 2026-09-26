-- ─────────────────────────────────────────────────────────────────────────────
-- Record which UPI account each team paid to (admin view only).
-- The receiving account changed twice, so:
--   • new payments: the payment page sends the UPI ID it displayed
--   • earlier payments: estimated from when the team registered
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.teams
  add column if not exists payment_payee_upi      text,
  add column if not exists payment_payee_inferred boolean not null default false;

-- Backfill: account shown on the payment page when the team registered
-- (switch times = deploy of commits e2b0704 and a863c34, ~1 min after push)
update public.teams
   set payment_payee_upi = case
         when created_at < '2026-09-25 18:17+05:30' then '7994974679@ptaxis'
         when created_at < '2026-09-26 13:16+05:30' then 'mohamedazzam3880@okaxis'
         else 'azeemelsalim1234-2@okicici'
       end,
       payment_payee_inferred = true
 where payment_payee_upi is null
   and payment_status <> 'pending';

-- submit_payment gains p_payee_upi (optional, so older cached pages still work).
-- Drop the 3-arg version first: an overload would make PostgREST calls ambiguous.
drop function if exists public.submit_payment(text, text, text);

create or replace function public.submit_payment(
  p_registration_id text, p_screenshot_path text, p_utr text, p_payee_upi text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  t record;
begin
  if p_utr !~ '^[0-9A-Za-z]{10,22}$' then raise exception 'INVALID_UTR'; end if;
  if p_screenshot_path !~ '^[A-Z0-9]{6,10}/[0-9a-f-]{36}\.(png|jpe?g|webp|heic|pdf)$' then
    raise exception 'INVALID_SCREENSHOT_PATH';
  end if;

  lock table teams in share row exclusive mode;

  select payment_status, created_at into t
  from teams where registration_id = upper(btrim(p_registration_id));

  if found and not _holds_slot(t.payment_status, t.created_at)
     and _active_team_count() >= (select max_teams from _reg_config()) then
    raise exception 'SLOT_EXPIRED';
  end if;

  update teams
     set payment_status         = 'ticket_uploaded',
         payment_screenshot_url = p_screenshot_path,
         payment_txn_id         = upper(p_utr),
         payment_submitted_at   = now(),
         payment_ip             = _client_ip(),
         -- Pages loaded before this change don't send it: assume the current account
         payment_payee_upi      = case when p_payee_upi ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}$'
                                       then lower(p_payee_upi)
                                       else 'azeemelsalim1234-2@okicici' end,
         payment_payee_inferred = p_payee_upi is null
   where registration_id = upper(btrim(p_registration_id))
     and payment_status in ('pending', 'ticket_uploaded', 'rejected')
     and split_part(p_screenshot_path, '/', 1) = upper(btrim(p_registration_id));

  if not found then raise exception 'PAYMENT_NOT_ALLOWED'; end if;
exception
  when unique_violation then raise exception 'UTR_ALREADY_USED';
end $$;

revoke all on function public.submit_payment(text, text, text, text) from public;
grant execute on function public.submit_payment(text, text, text, text) to anon, authenticated;

create or replace function public.admin_list_teams()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'registration_id',        t.registration_id,
      'created_at',             t.created_at,
      'team_name',              t.team_name,
      'payment_status',         t.payment_status,
      'payment_txn_id',         t.payment_txn_id,
      'payment_screenshot_url', t.payment_screenshot_url,
      'payment_submitted_at',   t.payment_submitted_at,
      'ticket_sent_at',         t.ticket_sent_at,
      'registered_ip',          t.registered_ip,
      'payment_ip',             t.payment_ip,
      'payment_payee_upi',      t.payment_payee_upi,
      'payment_payee_inferred', t.payment_payee_inferred,
      'registered_user_agent',  t.registered_user_agent,
      'same_device_count', (
        select count(*) from teams t2
        where t.device_id is not null and t2.device_id = t.device_id
      ),
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', m.name, 'email', m.email, 'phone', m.phone,
          'college', m.college, 'is_leader', m.is_leader
        ) order by m.is_leader desc, m.name), '[]'::jsonb)
        from members m where m.team_id = t.id
      )
    ) order by t.created_at desc)
    from teams t
  ), '[]'::jsonb);
end $$;

notify pgrst, 'reload schema';
