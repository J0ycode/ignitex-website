-- Registration window changed on 25 Sep 2026:
--   opens  25 Sep 2026, 6:00 PM IST   (was 25 Sep 12:00 PM)
--   closes 28 Sep 2026, 9:00 AM IST   (was 26 Sep 12:00 PM) — i.e. at event start
-- Keep in sync with src/lib/registrationStatus.ts
create or replace function public._reg_config()
returns table (max_teams int, opens_at timestamptz, closes_at timestamptz)
language sql immutable as $$
  select 15,
         timestamptz '2026-09-25 18:00:00+05:30',
         timestamptz '2026-09-28 09:00:00+05:30'
$$;
