-- ─────────────────────────────────────────────────────────────────────────────
-- Explicit "selected for the Final Round" flag, set by organisers in /admin.
-- The final-round email can only be sent to, and final check-in only accepts,
-- selected teams. (Previously "finalist" meant "was sent the email".)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.teams add column if not exists is_finalist boolean not null default false;

-- The six teams selected on 28 Sep
update public.teams set is_finalist = true
 where registration_id in ('4F6A0BB5F3', '4C40D7530C', 'D728C45BEC', '41E8328DAE', '84B33A70FA', '87D9D0F4E8');

create or replace function public.admin_set_finalist(p_registration_id text, p_value boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  update teams set is_finalist = coalesce(p_value, false)
   where registration_id = upper(btrim(p_registration_id)) and payment_status = 'verified';
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
end $$;
revoke all on function public.admin_set_finalist(text, boolean) from public, anon;
grant execute on function public.admin_set_finalist(text, boolean) to authenticated;

create or replace function public.get_ticket(p_registration_id text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'registration_id', t.registration_id,
    'team_name',       t.team_name,
    'is_finalist',     t.is_finalist,
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

create or replace function public.admin_checkin_list()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_check_in() then raise exception 'NOT_ADMIN'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'registration_id',     t.registration_id,
      'team_name',           t.team_name,
      'is_finalist',         t.is_finalist,
      'checked_in_at',       t.checked_in_at,
      'checked_in_by',       t.checked_in_by,
      'checked_in_final_at', t.checked_in_final_at,
      'checked_in_final_by', t.checked_in_final_by,
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', m.name, 'phone', m.phone, 'college', m.college, 'is_leader', m.is_leader
        ) order by m.is_leader desc, m.name), '[]'::jsonb)
        from members m where m.team_id = t.id
      )
    ) order by t.team_name)
    from teams t
    where t.payment_status = 'verified'
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_check_in(p_registration_id text, p_round text default 'day1')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t    teams%rowtype;
  v_at timestamptz;
  v_by text := case when is_admin()
                    then (select email from auth.users where id = auth.uid())
                    else 'desk' end;
begin
  if not can_check_in() then raise exception 'NOT_ADMIN'; end if;
  if p_round not in ('day1', 'final') then raise exception 'INVALID_ROUND'; end if;

  select * into t from teams
   where registration_id = upper(btrim(p_registration_id))
   for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if t.payment_status <> 'verified' then raise exception 'NOT_VERIFIED'; end if;

  if p_round = 'final' then
    if not t.is_finalist then raise exception 'NOT_FINALIST'; end if;
    if t.checked_in_final_at is not null then
      return jsonb_build_object('status', 'already', 'team_name', t.team_name, 'checked_in_at', t.checked_in_final_at);
    end if;
    update teams set checked_in_final_at = now(), checked_in_final_by = v_by
     where id = t.id returning checked_in_final_at into v_at;
  else
    if t.checked_in_at is not null then
      return jsonb_build_object('status', 'already', 'team_name', t.team_name, 'checked_in_at', t.checked_in_at);
    end if;
    update teams set checked_in_at = now(), checked_in_by = v_by
     where id = t.id returning checked_in_at into v_at;
  end if;

  return jsonb_build_object('status', 'checked_in', 'team_name', t.team_name, 'checked_in_at', v_at);
end $$;

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
      'topic',                  t.topic,
      'payment_status',         t.payment_status,
      'payment_txn_id',         t.payment_txn_id,
      'payment_screenshot_url', t.payment_screenshot_url,
      'payment_submitted_at',   t.payment_submitted_at,
      'ticket_sent_at',         t.ticket_sent_at,
      'final_mail_sent_at',     t.final_mail_sent_at,
      'is_finalist',            t.is_finalist,
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
