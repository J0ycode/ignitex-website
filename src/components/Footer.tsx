import { FiZap } from 'react-icons/fi'

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
          "Ideas are the pulses of progress" · 28–29 Sep 2026
        </p>

      </div>
    </footer>
  )
}
