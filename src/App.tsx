
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import RegisterPage from './pages/RegisterPage'
import ConfirmationPage from './pages/ConfirmationPage'
import PaymentPage from './pages/PaymentPage'
import TradingBackground from './components/ui/TradingBackground'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen" style={{ backgroundColor: '#05070D' }}>
        {/* Trading Ambient Background */}
        <TradingBackground />

        <Navbar />

        <div className="relative z-10">
          <Routes>
            <Route path="/"                  element={<LandingPage />} />
            <Route path="/register"          element={<RegisterPage />} />
            <Route path="/payment"           element={<PaymentPage />} />
            <Route path="/confirmation"      element={<ConfirmationPage />} />
          </Routes>
        </div>

        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(22, 22, 37, 0.95)',
              color: '#f0f0f0',
              border: '1px solid rgba(166,149,227, 0.25)',
              borderRadius: '12px',
              fontFamily: '"Inter", sans-serif',
              fontSize: '14px',
              backdropFilter: 'blur(10px)',
            },
            success: {
              iconTheme: { primary: '#a695e3', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#9383cc', secondary: '#fff' },
            },
          }}
        />
      </div>
    </BrowserRouter>
  )
}
