import { useState, useEffect, useCallback } from 'react'
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

  const syncTeamCount = useCallback(async () => {
    const { data, error: sbError } = await supabase.rpc('get_registration_count')
    if (sbError) {
      console.warn('Could not fetch team count from Supabase', sbError)
      setError('Could not connect to server')
    } else {
      setTeamCount(typeof data === 'number' ? data : 0)
      setError(null)
    }
    // Client time is only used for display — the server enforces the window.
    setServerNow(new Date())
  }, [])

  // Initial fetch + refresh the slot count every 30s so "x / 15" stays live
  useEffect(() => {
    let isMounted = true
    syncTeamCount().then(() => {
      if (isMounted) setLoading(false)
    })
    const poll = setInterval(syncTeamCount, 30_000)
    return () => {
      isMounted = false
      clearInterval(poll)
    }
  }, [syncTeamCount])

  // Client-side clock tick
  useEffect(() => {
    setStatus(computeStatus(new Date(), teamCount))
    const tick = setInterval(() => {
      const now = new Date()
      setServerNow(now)
      setStatus(computeStatus(now, teamCount))
    }, 1000)
    return () => clearInterval(tick)
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
