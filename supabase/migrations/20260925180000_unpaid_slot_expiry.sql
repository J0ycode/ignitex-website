-- ─────────────────────────────────────────────────────────────────────────────
-- Unpaid registrations only hold a slot for 2 hours.
--
-- A team "holds" one of the 15 slots if it has submitted payment proof
-- (ticket_uploaded / verified / rejected-and-retrying) OR registered < 2h ago.
-- Expired unpaid teams can still pay later — but only if a slot is free.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public._slot_hold()
returns interval language sql immutable as $$ select interval '2 hours' $$;

-- Does this team currently occupy a slot?
create or replace function public._holds_slot(p_status text, p_created timestamptz)
returns boolean language sql stable as $$
  select p_status in ('ticket_uploaded', 'verified', 'rejected')
      or (p_status = 'pending' and p_created > now() - public._slot_hold())
$$;

create or replace function public._active_team_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from teams where _holds_slot(payment_status, created_at)
$$;

-- Public counter ("x / 15") now shows occupied slots
create or replace function public.get_registration_count()
returns int
language sql stable security definer set search_path = public as $$
  select _active_team_count()
$$;

-- register_team: cap on occupied slots, not all rows
create or replace function public.register_team(
  p_team_name text, p_members jsonb, p_device_id uuid default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  cfg      record;
  v_team   uuid;
  v_reg_id text;
  m        jsonb;
  i        int := 0;
begin
  select * into cfg from _reg_config();

  if now() < cfg.opens_at  then raise exception 'REGISTRATION_NOT_OPEN'; end if;
  if now() >= cfg.closes_at then raise exception 'REGISTRATION_CLOSED';  end if;

  p_team_name := btrim(p_team_name);
  if p_team_name !~ '^[a-zA-Z0-9 _!-]{3,40}$' then raise exception 'INVALID_TEAM_NAME'; end if;

  if jsonb_typeof(p_members) <> 'array'
     or jsonb_array_length(p_members) not between 2 and 4 then
    raise exception 'INVALID_MEMBER_COUNT';
  end if;

  lock table teams in share row exclusive mode;

  if _active_team_count() >= cfg.max_teams then raise exception 'REGISTRATION_FULL'; end if;

  if exists (select 1 from teams where lower(team_name) = lower(p_team_name)) then
    raise exception 'TEAM_NAME_TAKEN';
  end if;

  v_reg_id := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into teams (registration_id, team_name, device_id, registered_ip, registered_user_agent)
  values (v_reg_id, p_team_name, p_device_id, _client_ip(), _client_user_agent())
  returning id into v_team;

  for m in select * from jsonb_array_elements(p_members) loop
    if coalesce(length(btrim(m->>'name')), 0)    < 2
       or (m->>'email') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       or (m->>'phone') !~  '^[6-9][0-9]{9}$'
       or coalesce(length(btrim(m->>'college')), 0) < 2 then
      raise exception 'INVALID_MEMBER';
    end if;

    insert into members (team_id, name, email, phone, college, is_leader)
    values (v_team, btrim(m->>'name'), lower(btrim(m->>'email')), m->>'phone',
            btrim(m->>'college'), i = 0);
    i := i + 1;
  end loop;

  return v_reg_id;
exception
  when unique_violation then
    raise exception 'MEMBER_ALREADY_REGISTERED';
end $$;

-- submit_payment: an expired unpaid team may pay only if a slot is free
create or replace function public.submit_payment(
  p_registration_id text, p_screenshot_path text, p_utr text
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
         payment_ip             = _client_ip()
   where registration_id = upper(btrim(p_registration_id))
     and payment_status in ('pending', 'ticket_uploaded', 'rejected')
     and split_part(p_screenshot_path, '/', 1) = upper(btrim(p_registration_id));

  if not found then raise exception 'PAYMENT_NOT_ALLOWED'; end if;
exception
  when unique_violation then raise exception 'UTR_ALREADY_USED';
end $$;

-- Payment page needs the hold deadline for its countdown
drop function if exists public.get_team_summary(text);
create function public.get_team_summary(p_registration_id text)
returns table (team_name text, payment_status text, hold_expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.team_name, t.payment_status,
         case when t.payment_status = 'pending' then t.created_at + _slot_hold() end
  from teams t
  where t.registration_id = upper(btrim(p_registration_id))
$$;
revoke all on function public.get_team_summary(text) from public;
grant execute on function public.get_team_summary(text) to anon, authenticated;

revoke all on function public._active_team_count() from public;

notify pgrst, 'reload schema';
