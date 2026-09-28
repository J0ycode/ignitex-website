-- ─────────────────────────────────────────────────────────────────────────────
-- Final round (29 Sep): separate check-in from day 1, finalists only.
-- A finalist = a team that was sent the final-round selection email.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.teams
  add column if not exists checked_in_final_at timestamptz,
  add column if not exists checked_in_final_by text;

-- Public ticket also says whether the team is in the final (for the Final Round pass)
create or replace function public.get_ticket(p_registration_id text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'registration_id', t.registration_id,
    'team_name',       t.team_name,
    'is_finalist',     t.final_mail_sent_at is not null,
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
      'is_finalist',         t.final_mail_sent_at is not null,
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

-- p_round: 'day1' (default, so older cached pages keep working) or 'final'.
-- Drop the 1-arg versions first: overloads would make PostgREST calls ambiguous.
drop function if exists public.admin_check_in(text);
drop function if exists public.admin_undo_check_in(text);

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
    if t.final_mail_sent_at is null then raise exception 'NOT_FINALIST'; end if;
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

create or replace function public.admin_undo_check_in(p_registration_id text, p_round text default 'day1')
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_check_in() then raise exception 'NOT_ADMIN'; end if;
  if p_round = 'final' then
    update teams set checked_in_final_at = null, checked_in_final_by = null
     where registration_id = upper(btrim(p_registration_id));
  else
    update teams set checked_in_at = null, checked_in_by = null
     where registration_id = upper(btrim(p_registration_id));
  end if;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
end $$;

revoke all on function public.admin_check_in(text, text)      from public, anon;
revoke all on function public.admin_undo_check_in(text, text) from public, anon;
grant execute on function public.admin_check_in(text, text)      to authenticated;
grant execute on function public.admin_undo_check_in(text, text) to authenticated;

notify pgrst, 'reload schema';
