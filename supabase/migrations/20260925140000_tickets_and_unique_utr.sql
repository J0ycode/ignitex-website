-- ─────────────────────────────────────────────────────────────────────────────
-- Verification → ticket flow.
-- Run AFTER 20260925130000_admin_verification.sql.
--
--  • Each UTR can be used by only one team (stops re-used screenshots)
--  • ticket_sent_at records when the ticket email went out
--  • get_ticket(reg_id) powers the public /ticket page — verified teams only
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.teams add column if not exists ticket_sent_at timestamptz;

create unique index if not exists teams_payment_txn_id_key
  on public.teams (upper(payment_txn_id))
  where payment_txn_id is not null;

-- Same as before, plus a friendly error when the UTR was already used
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
exception
  when unique_violation then raise exception 'UTR_ALREADY_USED';
end $$;

-- Public ticket data — only for verified teams, and no emails/phones
create or replace function public.get_ticket(p_registration_id text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'registration_id', t.registration_id,
    'team_name',       t.team_name,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', m.name, 'college', m.college, 'is_leader', m.is_leader
      ) order by m.is_leader desc, m.name), '[]'::jsonb)
      from members m where m.team_id = t.id
    )
  )
  from teams t
  where t.registration_id = upper(btrim(p_registration_id))
    and t.payment_status = 'verified'
$$;

revoke all on function public.get_ticket(text) from public;
grant execute on function public.get_ticket(text) to anon, authenticated;

-- Admin list now includes ticket_sent_at
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
      'ticket_sent_at',         t.ticket_sent_at,
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
