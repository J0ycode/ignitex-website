import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import ScrollToTop from './components/ScrollToTop'
import LandingPage from './pages/LandingPage'

// Everything past the landing page is code-split so first load on mobile stays light
const RegisterPage     = lazy(() => import('./pages/RegisterPage'))
const PaymentPage      = lazy(() => import('./pages/PaymentPage'))
const AdminPage        = lazy(() => import('./pages/AdminPage'))
const TicketPage       = lazy(() => import('./pages/TicketPage'))
const MyRegistrationPage = lazy(() => import('./pages/MyRegistrationPage'))
const CheckInPage      = lazy(() => import('./pages/CheckInPage'))

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen bg-ink">
        <Navbar />

        <div className="relative z-10">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/"                  element={<LandingPage />} />
              <Route path="/register"          element={<RegisterPage />} />
              <Route path="/payment"           element={<PaymentPage />} />
              <Route path="/confirmation"      element={<Navigate to="/my-registration" replace />} />
              <Route path="/admin"             element={<AdminPage />} />
              <Route path="/ticket/:id"        element={<TicketPage />} />
              <Route path="/my-registration"   element={<MyRegistrationPage />} />
              <Route path="/registration"      element={<CheckInPage />} />
            </Routes>
          </Suspense>
        </div>

        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1D1B19',
              color: '#F5F1EA',
              border: '1px solid #34302C',
              borderRadius: '12px',
              fontFamily: '"Inter", system-ui, sans-serif',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#FF6B1A', secondary: '#140A03' },
            },
            error: {
              iconTheme: { primary: '#F87171', secondary: '#140A03' },
            },
          }}
        />
      </div>
    </BrowserRouter>
  )
}
