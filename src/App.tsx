
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import RegisterPage from './pages/RegisterPage'
import ConfirmationPage from './pages/ConfirmationPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-obsidian-900">
        {/* Ambient background mesh */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 10%, rgba(255,107,0,0.06) 0%, transparent 60%),
              radial-gradient(ellipse 60% 50% at 80% 80%, rgba(255,48,17,0.04) 0%, transparent 60%)
            `,
          }}
        />

        <Navbar />

        <div className="relative z-10">
          <Routes>
            <Route path="/"             element={<LandingPage />} />
            <Route path="/register"     element={<RegisterPage />} />
            <Route path="/confirmation" element={<ConfirmationPage />} />
          </Routes>
        </div>

        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(22, 22, 37, 0.95)',
              color: '#f0f0f0',
              border: '1px solid rgba(255, 107, 0, 0.25)',
              borderRadius: '12px',
              fontFamily: '"Inter", sans-serif',
              fontSize: '14px',
              backdropFilter: 'blur(10px)',
            },
            success: {
              iconTheme: { primary: '#ff6b00', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#ff3011', secondary: '#fff' },
            },
          }}
        />
      </div>
    </BrowserRouter>
  )
}
