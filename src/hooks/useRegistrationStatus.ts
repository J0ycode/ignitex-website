import { useState, useEffect } from 'react'
import type { RegistrationStatus } from '../lib/registrationStatus'
import { computeStatus } from '../lib/registrationStatus'

interface UseRegistrationStatusReturn {
  status: RegistrationStatus | null
  teamCount: number
  serverNow: Date | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRegistrationStatus(): UseRegistrationStatusReturn {
  const [status, setStatus]       = useState<RegistrationStatus | null>(null)
  const [teamCount, setTeamCount] = useState<number>(0)
  const [serverNow, setServerNow] = useState<Date | null>(new Date()) 
  const [loading, setLoading]     = useState(true) 
  const [error, setError]         = useState<string | null>(null)

  const syncServerTime = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/status')
      if (res.ok) {
        const data = await res.json()
        setTeamCount(data.teamCount || 0)
      }
    } catch (err) {
      console.warn('Could not fetch team count from backend', err)
      setError('Could not connect to server')
    }
    
    // No backend time API yet, just use local time
    setServerNow(new Date())
  }

  // ── Client-side clock tick ─────────────────────────────────────────────────
  useEffect(() => {
    syncServerTime().then(() => {
      setLoading(false)
    })

    const tick = setInterval(() => {
      const now = new Date()
      setServerNow(now)
      setStatus(computeStatus(now, teamCount))
    }, 1000)
    
    // Initial compute
    setStatus(computeStatus(new Date(), teamCount))
    
    return () => clearInterval(tick)
  }, [teamCount])

  return {
    status,
    teamCount,
    serverNow,
    loading,
    error,
    refresh: syncServerTime,
  }
}
