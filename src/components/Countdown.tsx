import { motion, AnimatePresence } from 'framer-motion'
import { useCountdown } from '../hooks/useCountdown'

interface CountdownProps {
  targetDate: Date
  label: string
  variant?: 'opening' | 'closing' | 'event'
}

const VARIANT_STYLES = {
  opening: {
    labelColor: 'text-galaksi-400',
    digitGlow: 'border-spark-500/30',
    unitColor: 'text-galaksi-400/70',
  },
  closing: {
    labelColor: 'text-galaksi-400',
    digitGlow: 'border-galaksi-500/30',
    unitColor: 'text-galaksi-400/70',
  },
  event: {
    labelColor: 'text-galaksi-400',
    digitGlow: 'border-galaksi-400/30',
    unitColor: 'text-galaksi-400/70',
  },
}

function DigitCard({ value, unit, variant = 'opening' }: { value: number; unit: string; variant?: keyof typeof VARIANT_STYLES }) {
  const styles = VARIANT_STYLES[variant]
  const display = String(value).padStart(2, '0')

  return (
    <div className="flex flex-col items-center gap-2">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={display}
          initial={{ opacity: 0, y: -8, rotateX: -90 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: 8, rotateX: 90 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`digit-card w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center ${styles.digitGlow}`}
          style={{ perspective: '400px' }}
        >
          <span className="font-mono font-bold text-xl sm:text-3xl text-white">
            {display}
          </span>
        </motion.div>
      </AnimatePresence>
      <span className={`text-xs font-display font-medium uppercase tracking-widest ${styles.unitColor}`}>
        {unit}
      </span>
    </div>
  )
}

export default function Countdown({ targetDate, label, variant = 'opening' }: CountdownProps) {
  const { days, hours, minutes, seconds, total } = useCountdown(targetDate)
  const styles = VARIANT_STYLES[variant]

  if (total <= 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-6"
    >
      <p className={`font-display text-sm font-semibold uppercase tracking-widest ${styles.labelColor}`}>
        {label}
      </p>
      {/* 4×56px + 3×(6px+2×8px) ≈ 290px — fits a 320px screen with gutters */}
      <div className="flex items-center gap-2 sm:gap-4">
        <DigitCard value={days} unit="Days" variant={variant} />
        <Separator />
        <DigitCard value={hours} unit="Hours" variant={variant} />
        <Separator />
        <DigitCard value={minutes} unit="Min" variant={variant} />
        <Separator />
        <DigitCard value={seconds} unit="Sec" variant={variant} />
      </div>
    </motion.div>
  )
}

function Separator() {
  return (
    <div className="flex flex-col gap-2 pb-6">
      <motion.div
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="w-1.5 h-1.5 rounded-full bg-galaksi-500"
      />
      <motion.div
        animate={{ opacity: [1, 0.2, 1] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
        className="w-1.5 h-1.5 rounded-full bg-galaksi-500"
      />
    </div>
  )
}
