export const UPI_ID = 'mohamedazzam3880@okaxis'
// Must match the account holder — payers see this name in their UPI app.
export const UPI_PAYEE_NAME = 'Mohamed Azzam'
export const ENTRY_FEE = 100

function upiQuery(registrationId: string) {
  return new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_PAYEE_NAME,
    am: String(ENTRY_FEE),
    cu: 'INR',
    tn: `IgniteX ${registrationId}`,
  }).toString()
}

/**
 * Generic UPI link. Android hands it to the phone's *default* UPI app, which
 * is often WhatsApp — so on mobile prefer the app-specific links below.
 */
export function upiPayUrl(registrationId: string) {
  return `upi://pay?${upiQuery(registrationId)}`
}

export interface UpiApp {
  name: string
  href: string
}

const ANDROID_PACKAGES = {
  'Google Pay': 'com.google.android.apps.nbu.paisa.user',
  PhonePe: 'com.phonepe.app',
  Paytm: 'net.one97.paytm',
} as const

const IOS_SCHEMES = {
  'Google Pay': 'gpay://upi/pay',
  PhonePe: 'phonepe://pay',
  Paytm: 'paytmmp://pay',
} as const

/** Links that open one specific UPI app, bypassing the default-app setting. */
export function upiAppLinks(registrationId: string): UpiApp[] {
  const q = upiQuery(registrationId)
  const isAndroid = /android/i.test(navigator.userAgent)

  return (Object.keys(ANDROID_PACKAGES) as (keyof typeof ANDROID_PACKAGES)[]).map((name) => ({
    name,
    href: isAndroid
      // Android intent URL pinned to the app's package (opens Play Store if not installed)
      ? `intent://pay?${q}#Intent;scheme=upi;package=${ANDROID_PACKAGES[name]};end`
      : `${IOS_SCHEMES[name]}?${q}`,
  }))
}

const RPC_ERRORS: Record<string, string> = {
  REGISTRATION_NOT_OPEN: 'Registration is not open yet.',
  REGISTRATION_CLOSED: 'Registration has closed.',
  REGISTRATION_FULL: 'Sorry — all slots have been filled.',
  TEAM_NAME_TAKEN: 'Team name is already taken.',
  MEMBER_ALREADY_REGISTERED: 'One or more members are already registered with that email or phone number.',
  INVALID_TEAM_NAME: 'Team name is invalid.',
  INVALID_MEMBER_COUNT: 'Teams must have 2–4 members.',
  INVALID_MEMBER: 'Some member details are invalid. Please check and try again.',
  INVALID_UTR: 'Enter the 12-digit UTR / transaction ID from your UPI app.',
  UTR_ALREADY_USED: 'This UTR has already been submitted by another team. Check the number and try again.',
  INVALID_SCREENSHOT_PATH: 'Screenshot upload failed. Please try again.',
  SLOT_EXPIRED: 'Your 2-hour slot hold expired and all slots are now taken. Contact the organisers.',
  PAYMENT_NOT_ALLOWED: 'This registration can no longer be updated. Contact the organisers.',
}

export function friendlyRpcError(err: { message?: string } | null | undefined): string {
  const msg = err?.message ?? ''
  const code = Object.keys(RPC_ERRORS).find((k) => msg.includes(k))
  return code ? RPC_ERRORS[code] : 'Something went wrong. Please try again.'
}
