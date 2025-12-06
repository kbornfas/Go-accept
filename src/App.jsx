import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import PlatformSelector from './components/PlatformSelector'
import { useAuth } from './context/AuthContext.jsx'

// Lazy load heavy components for code splitting
const P2PPaymentCoordinator = lazy(() => import('./components/P2PPaymentCoordinator'))
const AdminEscrowDashboard = lazy(() => import('./components/AdminEscrowDashboard'))
const ClientLogin = lazy(() => import('./components/ClientLogin'))

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
      <p className="text-slate-300 text-lg">Loading...</p>
    </div>
  </div>
)

const getViewFromPath = (path) => {
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/client')) {
    return path === '/client' ? 'client' : 'client-login'
  }
  // Root path shows platform selection
  return 'platform-select'
}

function App() {
  const { tokens } = useAuth()
  const clientToken = tokens.client

  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'platform-select'
    return getViewFromPath(window.location.pathname)
  })

  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem('selectedPlatform') || null
  })

  const navigate = useCallback((nextView, platform = null) => {
    if (typeof window === 'undefined') return
    let nextPath = '/'
    if (nextView === 'admin') {
      nextPath = '/admin'
    } else if (nextView === 'client') {
      nextPath = '/client'
    } else if (nextView === 'client-login') {
      nextPath = '/client/login'
    } else if (nextView === 'platform-select') {
      nextPath = '/'
    }
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    if (platform) {
      setSelectedPlatform(platform)
      sessionStorage.setItem('selectedPlatform', platform)
    }
    setView(nextView)
  }, [])

  const handlePlatformSelect = useCallback((platform) => {
    setSelectedPlatform(platform)
    sessionStorage.setItem('selectedPlatform', platform)
    setView('client-login')
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/client/login')
    }
  }, [])

  const handleLoginSuccess = useCallback(() => {
    navigate('client')
  }, [navigate])

  const handleBackToPlatforms = useCallback(() => {
    setSelectedPlatform(null)
    sessionStorage.removeItem('selectedPlatform')
    navigate('platform-select')
  }, [navigate])

  useEffect(() => {
    const handlePopState = () => {
      setView(getViewFromPath(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <Suspense fallback={<LoadingFallback />}>
        {view === 'admin' ? (
          <AdminEscrowDashboard onNavigateClient={(nextView = 'client') => navigate(nextView)} />
        ) : view === 'client' ? (
          <P2PPaymentCoordinator 
            initialPlatform={selectedPlatform} 
            onChangePlatform={handleBackToPlatforms}
          />
        ) : view === 'client-login' ? (
          <ClientLogin 
            onSuccess={handleLoginSuccess} 
            onNavigateAdmin={navigate}
            onBack={handleBackToPlatforms}
            selectedPlatform={selectedPlatform}
          />
        ) : (
          <PlatformSelector 
            onSelect={handlePlatformSelect}
          />
        )}
      </Suspense>
    </div>
  )
}

export default App
