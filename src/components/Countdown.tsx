import { useCountdown } from '../hooks/useCountdown'

interface CountdownProps {
  targetDate: Date
  label: string
  /** @deprecated kept for existing callers; all variants look the same now */
  variant?: 'opening' | 'closing' | 'event'
}

export default function Countdown({ targetDate, label }: CountdownProps) {
  const { days, hours, minutes, seconds, total } = useCountdown(targetDate)
  if (total <= 0) return null

  const units = [
    { value: days, unit: 'days' },
    { value: hours, unit: 'hrs' },
    { value: minutes, unit: 'min' },
    { value: seconds, unit: 'sec' },
  ]

  return (
    <div className="flex flex-col items-center gap-4" role="timer" aria-label={`${label} ${days} days ${hours} hours ${minutes} minutes`}>
      <p className="text-sm text-stone-400">{label}</p>
      <div className="flex items-stretch gap-2 sm:gap-3">
        {units.map(({ value, unit }) => (
          <div
            key={unit}
            className="w-[4.25rem] sm:w-20 py-3 rounded-xl flex flex-col items-center"
            style={{ background: '#151412', border: '1px solid #2A2724' }}
          >
            <span className="font-display font-extrabold text-2xl sm:text-3xl tabular-nums text-galaksi-100">
              {String(value).padStart(2, '0')}
            </span>
            <span className="text-[11px] text-stone-500 mt-0.5">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
