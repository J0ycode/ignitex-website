import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function Navbar() {
  const location = useLocation()
  const isRegisterPage = location.pathname === '/register'

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(8, 8, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(166,149,227, 0.1)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <img 
            src="/src/assets/IgniteX.png" 
            alt="IgniteX" 
            className="h-6 sm:h-8 object-contain" 
            style={{ filter: 'drop-shadow(0 0 10px rgba(166,149,227,0.3))' }}
          />
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-6">
          <NavLink href="/#about">About</NavLink>
          {!isRegisterPage && (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/register"
                className="btn-galaksi text-sm px-5 py-2.5"
              >
                Register Now
              </Link>
            </motion.div>
          )}
        </div>

        {/* Mobile register button */}
        {!isRegisterPage && (
          <div className="sm:hidden">
            <Link to="/register" className="btn-galaksi text-xs px-4 py-2">
              Register
            </Link>
          </div>
        )}
      </div>
    </motion.nav>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="font-display text-sm font-medium text-gray-400 hover:text-galaksi-400 transition-colors duration-200"
    >
      {children}
    </a>
  )
}
