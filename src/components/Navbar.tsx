import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/IngniteX.png'

export default function Navbar() {
  const location = useLocation()
  // Hide the Register CTA where it's redundant or out of place
  const hideRegister = location.pathname === '/register' || location.pathname === '/admin'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ink border-b border-ink-line">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center" aria-label="igniteX home">
          <img src={logo} alt="igniteX" className="h-6 sm:h-7 object-contain" />
        </Link>

        <div className="flex items-center gap-1 sm:gap-6">
          <a href="/#about" className="hidden sm:inline text-sm text-stone-400 hover:text-galaksi-100 transition-colors">
            About
          </a>
          <a href="/#how" className="hidden sm:inline text-sm text-stone-400 hover:text-galaksi-100 transition-colors">
            How it works
          </a>
          <Link
            to="/my-registration"
            className="px-3 sm:px-0 min-h-[44px] flex items-center text-sm text-stone-400 hover:text-galaksi-100 transition-colors"
          >
            My ticket
          </Link>
          {!hideRegister && (
            <Link to="/register" className="btn-galaksi text-sm px-4 py-2 sm:px-5 sm:py-2.5">
              Register
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
