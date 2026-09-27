import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// After a deploy, a tab opened earlier asks for page files that no longer exist.
// Reload once to fetch the new version (at most once a minute, to avoid loops).
window.addEventListener('vite:preloadError', (event) => {
  const last = Number(sessionStorage.getItem('ignitex:chunk-reload') || 0)
  if (Date.now() - last < 60_000) return
  sessionStorage.setItem('ignitex:chunk-reload', String(Date.now()))
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
