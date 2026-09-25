import { motion, type Variants } from 'framer-motion'
import {
  FiCpu, FiGlobe, FiShield, FiTrendingUp, FiHeart, FiCode
} from 'react-icons/fi'

const TRACKS = [
  {
    icon: FiCpu,
    title: 'AI & Machine Learning',
    description: 'Build intelligent systems that learn, adapt, and transform industries. From LLM applications to computer vision breakthroughs.',
    tags: ['LLMs', 'CV', 'MLOps'],
    color: '#FF6B1A',
  },
  {
    icon: FiGlobe,
    title: 'Web3 & Decentralized',
    description: 'Architect the decentralized future — DAOs, DeFi primitives, NFT utilities, and on-chain governance systems.',
    tags: ['Solidity', 'DeFi', 'DAOs'],
    color: '#FF9A5C',
  },
  {
    icon: FiShield,
    title: 'Cybersecurity',
    description: 'Hack to protect. Build threat detection, zero-trust systems, or open-source security tooling that matters.',
    tags: ['Pen Testing', 'Zero Trust', 'SIEM'],
    color: '#E2560D',
  },
  {
    icon: FiTrendingUp,
    title: 'FinTech & Commerce',
    description: 'Reimagine finance — payment rails, credit scoring, embedded finance, or novel ways to democratize capital.',
    tags: ['Payments', 'Credit', 'Open Banking'],
    color: '#FF6B1A',
  },
  {
    icon: FiHeart,
    title: 'HealthTech & Impact',
    description: 'Technology for human good. Diagnostics, mental health, accessibility tools, or climate solutions.',
    tags: ['MedTech', 'ClimaTech', 'Accessibility'],
    color: '#ffbe00',
  },
  {
    icon: FiCode,
    title: 'DevTools & OSS',
    description: 'Build tools for builders. Developer productivity, open-source infra, CLI utilities, or observability platforms.',
    tags: ['DevEx', 'Infra', 'OSS'],
    color: '#FF6B1A',
  },
]

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function Tracks() {
  return (
    <section id="tracks" className="py-24 px-4 sm:px-6 relative">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="font-mono text-xs text-galaksi-400 uppercase tracking-widest mb-3 block">
            // Domains & Themes
          </span>
          <h2 className="font-display font-extrabold text-4xl sm:text-5xl text-galaksi-100 mb-4">
            Choose Your <span className="text-gradient-galaksi">Track</span>
          </h2>
          <p className="text-stone-400 max-w-lg mx-auto font-body">
            Every great innovation starts with a problem worth solving. Pick your domain, gather your team, and ignite something extraordinary.
          </p>
        </motion.div>

        {/* Track cards grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {TRACKS.map((track, idx) => (
            <TrackCard key={idx} track={track} />
          ))}
        </motion.div>

        {/* Open track note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-stone-500 text-sm mt-10 font-mono"
        >
          * Open Innovation track available — build anything that sparks joy
        </motion.p>
      </div>
    </section>
  )
}

function TrackCard({ track }: { track: typeof TRACKS[0] }) {
  const Icon = track.icon
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="track-card group"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{
          background: `radial-gradient(circle, ${track.color}20 0%, ${track.color}05 100%)`,
          border: `1px solid ${track.color}30`,
        }}
      >
        <Icon style={{ color: track.color }} className="w-5 h-5" />
      </div>
      <h3 className="font-display font-bold text-lg text-galaksi-100 mb-2 group-hover:text-galaksi-300 transition-colors">
        {track.title}
      </h3>
      <p className="text-stone-400 text-sm leading-relaxed mb-4">
        {track.description}
      </p>
      <div className="flex flex-wrap gap-2">
        {track.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2.5 py-1 rounded-full font-mono"
            style={{
              background: `${track.color}10`,
              border: `1px solid ${track.color}25`,
              color: track.color,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  )
}
