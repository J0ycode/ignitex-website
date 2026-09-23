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

export const MAX_TEAMS = 20

/** Derive the key dates from any reference date (uses its year+month) */
export function getRegistrationDates(ref: Date) {
  const y = ref.getFullYear()
  const m = ref.getMonth() // 0-indexed

  return {
    registrationOpen:  new Date(y, m, 1, 12, 0, 0),
    registrationClose: new Date(y, m, 26, 12, 0, 0),
    eventStart:        new Date(y, m, 28,  9, 0, 0),
    eventEnd:          new Date(y, m, 29, 18, 0, 0),
  }
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

/**
 * Note: server time and team count fetching logic has been removed
 * since the backend is now running via MongoDB without Firestore.
 */
