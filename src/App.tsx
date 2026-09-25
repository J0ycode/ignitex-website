import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import TradingBackground from './components/ui/TradingBackground'

// Everything past the landing page is code-split so first load on mobile stays light
const RegisterPage     = lazy(() => import('./pages/RegisterPage'))
const PaymentPage      = lazy(() => import('./pages/PaymentPage'))
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage'))
const AdminPage        = lazy(() => import('./pages/AdminPage'))
const TicketPage       = lazy(() => import('./pages/TicketPage'))
const MyRegistrationPage = lazy(() => import('./pages/MyRegistrationPage'))

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen" style={{ backgroundColor: '#05070D' }}>
        {/* Trading Ambient Background */}
        <TradingBackground />

        <Navbar />

        <div className="relative z-10">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/"                  element={<LandingPage />} />
              <Route path="/register"          element={<RegisterPage />} />
              <Route path="/payment"           element={<PaymentPage />} />
              <Route path="/confirmation"      element={<ConfirmationPage />} />
              <Route path="/admin"             element={<AdminPage />} />
              <Route path="/ticket/:id"        element={<TicketPage />} />
              <Route path="/my-registration"   element={<MyRegistrationPage />} />
            </Routes>
          </Suspense>
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
