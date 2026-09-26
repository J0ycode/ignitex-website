import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiMenu, FiX } from 'react-icons/fi'
import logo from '../assets/ignitex-logo.webp'

const SECTIONS = [
  { href: '/#about', label: 'About' },
  { href: '/#how', label: 'How it works' },
  { href: '/#contact', label: 'Contact' },
]

export default function Navbar() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  // Hide the Register CTA where it's redundant or out of place
  const hideRegister = ['/register', '/admin', '/registration'].includes(location.pathname)
  const onMyTicket = location.pathname === '/my-registration'

  // Close the mobile menu on navigation and on Escape
  useEffect(() => setOpen(false), [location.pathname, location.hash])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const linkCls = 'text-sm lg:text-[15px] text-stone-400 hover:text-galaksi-100 transition-colors'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ink border-b border-ink-line">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link
          to="/"
          // Already on the home page (possibly scrolled or at /#about): go back to the top
          onClick={() => { setOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="flex items-center justify-self-start"
          aria-label="igniteX home"
        >
          <img src={logo} alt="igniteX" className="h-6 sm:h-7 object-contain" />
        </Link>

        {/* Desktop: section links centred between logo and actions */}
        <div className="hidden md:flex items-center gap-8 lg:gap-10">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className={linkCls}>{s.label}</a>
          ))}
        </div>

        <div className="flex items-center gap-2 md:gap-6 justify-self-end">
          <Link
            to="/my-registration"
            aria-current={onMyTicket ? 'page' : undefined}
            className={`hidden md:flex min-h-[44px] items-center ${linkCls} ${onMyTicket ? '!text-galaksi-100' : ''}`}
          >
            My ticket
          </Link>
          {!hideRegister && (
            <Link to="/register" className="btn-galaksi text-sm px-4 py-2 sm:px-5 sm:py-2.5">
              Register
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="md:hidden -mr-2 w-11 h-11 flex items-center justify-center text-galaksi-100"
          >
            {open ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-menu" className="md:hidden border-t border-ink-line bg-ink">
          <ul className="px-5 sm:px-8 py-2">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center min-h-[48px] text-base text-stone-300 active:text-galaksi-100"
                >
                  {s.label}
                </a>
              </li>
            ))}
            <li className="border-t border-ink-line">
              <Link
                to="/my-registration"
                className={`flex items-center min-h-[48px] text-base ${onMyTicket ? 'text-galaksi-100' : 'text-stone-300'}`}
              >
                My ticket
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  )
}
