import { motion } from 'framer-motion'
import { FiUsers, FiClock, FiAward, FiZap } from 'react-icons/fi'
import { MAX_TEAMS } from '../lib/registrationStatus'

const STATS = [
  { icon: FiUsers, value: String(MAX_TEAMS), label: 'Teams Max', suffix: '' },
  { icon: FiClock, value: '2', label: 'Day Ideathon', suffix: '' },
  { icon: FiAward, value: '₹', label: 'Prize Pool', suffix: '5k' },
  { icon: FiZap, value: '100%', label: 'Passion Required', suffix: '' },
]

const TIMELINE = [
  { date: '25th 6:00 PM', event: 'Registration Opens', status: 'upcoming' },
  { date: '28th 9:00 AM', event: 'Registration Closes', status: 'upcoming' },
  { date: '28th 9:00 AM', event: 'Ideathon Begins', status: 'upcoming' },
  { date: '29th 6:00 PM', event: 'Submissions Due', status: 'upcoming' },
]

export default function About() {
  return (
    <section id="about" className="py-24 px-4 sm:px-6 relative">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 80% 50%, rgba(166,149,227,0.05) 0%, transparent 70%)' }} />

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: About text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="font-mono text-xs text-galaksi-400 uppercase tracking-widest mb-3 block">
              // About igniteX
            </span>
            <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-white mb-6 leading-tight">
              Where Ideas<br />
              <span className="text-gradient-galaksi">Catch Fire</span>
            </h2>
            <div className="space-y-4 text-gray-400 font-body leading-relaxed">
              <p>
                igniteX is a two-day ideathon designed for builders, dreamers, and problem-solvers who believe technology can change the world. Not a demo competition — a crucible where real ideas get forged.
              </p>
              <p>
                Teams of 2–4 will tackle real-world challenges across six high-impact domains. Expert mentors, state-of-the-art resources, and a community of like-minded innovators surround you throughout.
              </p>
              <p>
                Only <strong className="text-galaksi-400">{MAX_TEAMS} teams</strong> get in. Every slot counts. Every idea matters.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
              {STATS.map((stat, i) => {
                const Icon = stat.icon
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="text-center p-4 rounded-xl"
                    style={{ background: 'rgba(166,149,227,0.05)', border: '1px solid rgba(166,149,227,0.1)' }}
                  >
                    <Icon className="w-4 h-4 text-galaksi-500 mx-auto mb-2" />
                    <div className="font-display font-bold text-xl text-white">
                      {stat.value}{stat.suffix}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* Right: Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <span className="font-mono text-xs text-galaksi-400 uppercase tracking-widest mb-6 block">
              // Event Timeline
            </span>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-ember-500/60 via-ember-500/20 to-transparent" />

              <div className="space-y-8">
                {TIMELINE.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="flex items-start gap-6"
                  >
                    {/* Dot */}
                    <div className="relative z-10 w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center"
                      style={{
                        background: 'rgba(166,149,227,0.12)',
                        border: '2px solid rgba(166,149,227,0.4)',
                        boxShadow: '0 0 12px rgba(166,149,227,0.2)',
                      }}>
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                        className="w-3 h-3 rounded-full bg-galaksi-500"
                      />
                    </div>
                    {/* Content */}
                    <div className="pt-2">
                      <p className="font-mono text-xs text-galaksi-400 mb-1 uppercase tracking-wider">{item.date}</p>
                      <p className="font-display font-semibold text-white text-lg">{item.event}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
