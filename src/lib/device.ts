import { uuid } from './upload'

// A random ID for this browser, used only to show "My Registration" on the
// device that registered. Never derived from IP — shared networks would leak.
const DEVICE_KEY = 'ignitex.device_id'
const REGS_KEY = 'ignitex.registrations'

export interface SavedRegistration {
  registration_id: string
  team_name: string
}

export function getDeviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = uuid()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return null // private mode / storage blocked
  }
}

export function getSavedRegistrations(): SavedRegistration[] {
  try {
    const raw = JSON.parse(localStorage.getItem(REGS_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((r) => typeof r?.registration_id === 'string') : []
  } catch {
    return []
  }
}

export function saveRegistration(reg: SavedRegistration) {
  try {
    const list = getSavedRegistrations().filter((r) => r.registration_id !== reg.registration_id)
    localStorage.setItem(REGS_KEY, JSON.stringify([reg, ...list].slice(0, 10)))
  } catch { /* storage blocked — the server-side device link still works */ }
}
