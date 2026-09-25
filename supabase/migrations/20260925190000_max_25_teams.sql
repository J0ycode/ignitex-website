-- Team cap raised from 15 to 25 (25 Sep 2026). Window unchanged:
--   opens 25 Sep 6:00 PM IST, closes 28 Sep 9:00 AM IST.
-- Keep in sync with MAX_TEAMS in src/lib/registrationStatus.ts
create or replace function public._reg_config()
returns table (max_teams int, opens_at timestamptz, closes_at timestamptz)
language sql immutable as $$
  select 25,
         timestamptz '2026-09-25 18:00:00+05:30',
         timestamptz '2026-09-28 09:00:00+05:30'
$$;
