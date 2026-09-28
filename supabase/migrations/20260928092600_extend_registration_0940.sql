-- Registration extended again on event day: closes 28 Sep 09:40 IST (was 09:20).
create or replace function public._reg_config()
returns table (max_teams int, opens_at timestamptz, closes_at timestamptz)
language sql immutable as $$
  select 25,
         timestamptz '2026-09-25 18:00:00+05:30',
         timestamptz '2026-09-28 09:40:00+05:30'
$$;

notify pgrst, 'reload schema';
