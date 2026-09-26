import { Link } from 'react-router-dom'
import txaLogo from '../assets/txa-logo.webp'
import { CONTACTS, formatPhone, whatsappUrl } from '../lib/contacts'

export default function Footer() {
  return (
    <footer className="px-5 sm:px-8 lg:px-12 py-10 border-t border-ink-line">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-sm text-stone-400">
        <div className="flex items-center gap-3">
          <img src={txaLogo} alt="TXA" className="h-7 object-contain" style={{ mixBlendMode: 'screen' }} />
          <span>igniteX Ideathon · 28–29 September 2026</span>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="text-stone-500">Questions? WhatsApp</span>
          <span className="flex gap-4">
            {CONTACTS.map((c) => (
              <a key={c.phone} href={whatsappUrl(c.phone)} target="_blank" rel="noreferrer" className="text-galaksi-100 hover:underline">
                {c.name} · {formatPhone(c.phone)}
              </a>
            ))}
          </span>
        </div>
        <nav className="flex gap-5">
          <Link to="/register" className="hover:text-galaksi-100">Register</Link>
          <Link to="/my-registration" className="hover:text-galaksi-100">My ticket</Link>
        </nav>
      </div>
    </footer>
  )
}
