import { motion } from 'framer-motion'
import { FiZap, FiGithub, FiTwitter, FiInstagram } from 'react-icons/fi'

export default function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 relative"
      style={{ borderTop: '1px solid rgba(166,149,227,0.08)' }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #a695e3, #9383cc)' }}>
            <FiZap className="text-white w-3.5 h-3.5" />
          </div>
          <span className="font-display font-bold text-lg text-white">
            ignite<span className="text-gradient-galaksi">X</span>
          </span>
        </div>

        {/* Tagline */}
        <p className="font-mono text-xs text-gray-600 text-center">
          "Ideas are the pulses of progress" · 28–29 this month
        </p>

        {/* Socials */}
        <div className="flex items-center gap-4">
          {[FiTwitter, FiInstagram, FiGithub].map((Icon, i) => (
            <motion.a
              key={i}
              href="#"
              whileHover={{ scale: 1.2, color: '#a695e3' }}
              className="text-gray-600 hover:text-galaksi-400 transition-colors"
            >
              <Icon className="w-4 h-4" />
            </motion.a>
          ))}
        </div>
      </div>
    </footer>
  )
}
