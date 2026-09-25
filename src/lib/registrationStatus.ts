// Registration Status Types and Helpers

// Use a const map so the values exist at runtime (avoids ESM type-erasure issues)
export const REGISTRATION_STATUS = {
  BEFORE_OPEN:  'before_open',
  OPEN:         'open',
  FULL:         'full',
  CLOSED:       'closed',
  EVENT_SOON:   'event_soon',
  EVENT_ACTIVE: 'event_active',
  EVENT_OVER:   'event_over',
} as const

export type RegistrationStatus = typeof REGISTRATION_STATUS[keyof typeof REGISTRATION_STATUS]

// Keep MAX_TEAMS and the registration window in sync with _reg_config() in
// supabase/migrations/*_lockdown_registration.sql — the server enforces them.
export const MAX_TEAMS = 15

// Fixed IST timestamps. Stable object identities, so countdown effects don't
// reset every render.
const REGISTRATION_DATES = {
  registrationOpen:  new Date('2026-09-25T12:00:00+05:30'),
  registrationClose: new Date('2026-09-26T12:00:00+05:30'),
  eventStart:        new Date('2026-09-28T09:00:00+05:30'),
  eventEnd:          new Date('2026-09-29T18:00:00+05:30'),
} as const

export function getRegistrationDates(_ref?: Date) {
  return REGISTRATION_DATES
}

/** Pure status computation — no side effects */
export function computeStatus(now: Date, teamCount: number): RegistrationStatus {
  if (teamCount >= MAX_TEAMS) return 'full'

  const { registrationOpen, registrationClose, eventStart, eventEnd } =
    getRegistrationDates(now)

  if (now < registrationOpen)  return 'before_open'
  if (now < registrationClose) return 'open'
  if (now < eventStart)        return 'closed'
  if (now <= eventEnd)         return 'event_active'
  return 'event_over'
}
