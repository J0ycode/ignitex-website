import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** New page → start at the top (the SPA otherwise keeps the old scroll position). */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
