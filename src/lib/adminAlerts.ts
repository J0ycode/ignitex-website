import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export type EnableResult = 'push' | 'in-page-only' | 'denied' | 'unsupported'

/**
 * Ask for notification permission on this device.
 * With VITE_VAPID_PUBLIC_KEY set, also subscribes to Web Push so alerts arrive
 * even when /admin is closed; otherwise alerts show only while /admin is open.
 */
export async function enableAdminAlerts(): Promise<EnableResult> {
  if (!('Notification' in window)) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return 'in-page-only'

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const { error } = await supabase.rpc('admin_save_push_subscription', { p_subscription: sub.toJSON() })
  if (error) throw error
  return 'push'
}

export function alertsPermission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

/** Short two-tone chime (Web Audio — no asset needed). */
export function chime() {
  try {
    const ctx = new AudioContext()
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.15 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.25)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.3)
    })
    setTimeout(() => ctx.close(), 800)
  } catch { /* audio blocked until the user has interacted with the page */ }
}

/** System notification from the open page (used when the tab is in the background). */
export function localNotify(title: string, body: string, tag?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, tag, icon: '/favicon.png' })
    n.onclick = () => { window.focus(); n.close() }
  } catch {
    // Android Chrome only allows notifications via the service worker
    navigator.serviceWorker?.getRegistration().then((r) => r?.showNotification(title, { body, tag, icon: '/favicon.png' }))
  }
}

/** "Chrome 128 · Android" style summary of a user-agent string. */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device'
  const os =
    /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux' : 'Other'
  const browser =
    /Instagram/i.test(ua) ? 'Instagram app'
    : /FBAN|FBAV/i.test(ua) ? 'Facebook app'
    : /WhatsApp/i.test(ua) ? 'WhatsApp'
    : /Edg\//i.test(ua) ? 'Edge'
    : /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
    : /Firefox|FxiOS/i.test(ua) ? 'Firefox'
    : /Chrome|CriOS/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari' : 'Browser'
  return `${browser} · ${os}`
}
