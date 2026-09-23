import Hero from '../components/Hero'
import About from '../components/About'
import Footer from '../components/Footer'
import { useRegistrationStatus } from '../hooks/useRegistrationStatus'

export default function LandingPage() {
  const { status, teamCount, serverNow, loading } = useRegistrationStatus()

  return (
    <main>
      <Hero
        status={status}
        serverNow={serverNow}
        teamCount={teamCount}
        loading={loading}
      />
      <About />
      <Footer />
    </main>
  )
}
