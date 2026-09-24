import { motion } from 'framer-motion'

interface ProgressBarProps {
  currentStep: number  // 1-indexed
  totalSteps: number
  labels: string[]
}

export default function ProgressBar({ currentStep, totalSteps, labels }: ProgressBarProps) {
  const pct = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="w-full mb-8">
      {/* Labels */}
      <div className="flex justify-between mb-3">
        {labels.map((label, i) => {
          const stepNum = i + 1
          const isDone    = stepNum < currentStep
          const isCurrent = stepNum === currentStep

          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  scale: isCurrent ? 1.2 : 1,
                  boxShadow: isCurrent ? '0 0 12px rgba(166,149,227,0.6)' : 'none',
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold"
                style={{
                  background: isDone
                    ? 'linear-gradient(135deg, #a695e3, #9383cc)'
                    : isCurrent
                    ? 'rgba(166,149,227,0.2)'
                    : 'rgba(255,255,255,0.05)',
                  border: isCurrent
                    ? '1.5px solid #a695e3'
                    : isDone
                    ? 'none'
                    : '1.5px solid rgba(255,255,255,0.1)',
                  color: isDone ? '#fff' : isCurrent ? '#a695e3' : '#4b5563',
                }}
              >
                {isDone ? '✓' : stepNum}
              </motion.div>
              <span
                className="text-xs font-display font-medium hidden sm:block"
                style={{ color: isCurrent ? '#a695e3' : isDone ? '#9ca3af' : '#4b5563' }}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Bar */}
      <div className="h-0.5 bg-white/5 rounded-full relative">
        <motion.div
          className="step-progress-bar h-0.5 rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}
