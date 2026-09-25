import { FiMessageCircle, FiPhone } from 'react-icons/fi'
import { CONTACTS, formatPhone, whatsappUrl } from '../lib/contacts'

/** "Need help?" block with WhatsApp + call buttons for each organiser. */
export default function HelpContacts({ context, compact = false }: { context?: string; compact?: boolean }) {
  const message = context ? `Hi, I need help with igniteX registration. ${context}` : 'Hi, I have a question about igniteX.'

  if (compact) {
    return (
      <p className="text-sm text-stone-400">
        Need help?{' '}
        {CONTACTS.map((c, i) => (
          <span key={c.phone}>
            {i > 0 && ' · '}
            <a href={whatsappUrl(c.phone, message)} target="_blank" rel="noreferrer" className="text-galaksi-100 underline underline-offset-4">
              {c.name} {formatPhone(c.phone)}
            </a>
          </span>
        ))}
      </p>
    )
  }

  return (
    <div className="p-4 rounded-2xl border border-ink-line bg-ink-card">
      <p className="text-sm font-semibold text-galaksi-100">Need help?</p>
      <p className="text-xs text-stone-400 mt-0.5">Message an organiser on WhatsApp or call.</p>
      <ul className="mt-3 space-y-2">
        {CONTACTS.map((c) => (
          <li key={c.phone} className="flex items-center justify-between gap-3">
            <span className="text-sm text-galaksi-100">
              {c.name} <span className="text-stone-400 tabular-nums">{formatPhone(c.phone)}</span>
            </span>
            <span className="flex gap-2 shrink-0">
              <a
                href={whatsappUrl(c.phone, message)}
                target="_blank"
                rel="noreferrer"
                aria-label={`WhatsApp ${c.name}`}
                className="w-11 h-11 rounded-xl flex items-center justify-center border border-ink-line text-green-400 active:bg-white/5"
              >
                <FiMessageCircle className="w-5 h-5" />
              </a>
              <a
                href={`tel:+91${c.phone}`}
                aria-label={`Call ${c.name}`}
                className="w-11 h-11 rounded-xl flex items-center justify-center border border-ink-line text-galaksi-100 active:bg-white/5"
              >
                <FiPhone className="w-5 h-5" />
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
