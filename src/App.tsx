import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Navbar from './components/Navbar'
import ScrollToTop from './components/ScrollToTop'
import AppErrorBoundary from './components/AppErrorBoundary'
import LandingPage from './pages/LandingPage'

// Everything past the landing page is code-split so first load on mobile stays light
const RegisterPage     = lazy(() => import('./pages/RegisterPage'))
const PaymentPage      = lazy(() => import('./pages/PaymentPage'))
const AdminPage        = lazy(() => import('./pages/AdminPage'))
const TicketPage       = lazy(() => import('./pages/TicketPage'))
const MyRegistrationPage = lazy(() => import('./pages/MyRegistrationPage'))
const CheckInPage      = lazy(() => import('./pages/CheckInPage'))
const AdminPrintPage   = lazy(() => import('./pages/AdminPrintPage'))
const AdminCertificatesPage = lazy(() => import('./pages/AdminCertificatesPage'))
const AdminParticipationPage = lazy(() => import('./pages/AdminParticipationPage'))
const AdminBlankCertificatesPage = lazy(() => import('./pages/AdminBlankCertificatesPage'))
const NotFoundPage     = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen bg-ink">
        <Navbar />

        <div className="relative z-10">
          <AppErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/"                  element={<LandingPage />} />
              <Route path="/register"          element={<RegisterPage />} />
              <Route path="/payment"           element={<PaymentPage />} />
              <Route path="/confirmation"      element={<Navigate to="/my-registration" replace />} />
              <Route path="/admin"             element={<AdminPage />} />
              <Route path="/admin/print"       element={<AdminPrintPage />} />
              <Route path="/admin/certificates" element={<AdminCertificatesPage />} />
              <Route path="/admin/participation" element={<AdminParticipationPage />} />
              <Route path="/admin/blank-certificates" element={<AdminBlankCertificatesPage />} />
              <Route path="*"                 element={<NotFoundPage />} />
              <Route path="/ticket/:id"        element={<TicketPage />} />
              <Route path="/my-registration"   element={<MyRegistrationPage />} />
              <Route path="/registration"      element={<CheckInPage />} />
            </Routes>
          </Suspense>
          </AppErrorBoundary>
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

function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="font-mono text-sm text-stone-400">Loading…</p>
    </div>
  )
}
