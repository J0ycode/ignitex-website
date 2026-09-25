import { Link } from 'react-router-dom'
import txaLogo from '../assets/TXA-logo.png'

export default function Footer() {
  return (
    <footer className="px-5 sm:px-8 py-10 border-t border-ink-line">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-sm text-stone-400">
        <div className="flex items-center gap-3">
          <img src={txaLogo} alt="TXA" className="h-7 object-contain" style={{ mixBlendMode: 'screen' }} />
          <span>igniteX Ideathon · 28–29 September 2026</span>
        </div>
        <nav className="flex gap-5">
          <Link to="/register" className="hover:text-galaksi-100">Register</Link>
          <Link to="/my-registration" className="hover:text-galaksi-100">My ticket</Link>
        </nav>
      </div>
    </footer>
  )
}
