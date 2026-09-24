import { useState, useEffect } from 'react'
import type { RegistrationStatus } from '../lib/registrationStatus'
import { computeStatus } from '../lib/registrationStatus'
import { supabase } from '../lib/supabase'

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

  const syncTeamCount = async () => {
    try {
      const { count, error: sbError } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })

      if (sbError) throw sbError
      setTeamCount(count ?? 0)
      setError(null)
    } catch (err) {
      console.warn('Could not fetch team count from Supabase', err)
      setError('Could not connect to server')
    }

    // Use client time (no separate time API needed)
    setServerNow(new Date())
  }

  // ── Client-side clock tick ─────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true

    syncTeamCount().then(() => {
      if (isMounted) setLoading(false)
    })

    const tick = setInterval(() => {
      const now = new Date()
      setServerNow(now)
      setStatus(computeStatus(now, teamCount))
    }, 1000)

    // Initial compute
    setStatus(computeStatus(new Date(), teamCount))

    return () => {
      isMounted = false
      clearInterval(tick)
    }
  }, [teamCount])

  return {
    status,
    teamCount,
    serverNow,
    loading,
    error,
    refresh: syncTeamCount,
  }
}
