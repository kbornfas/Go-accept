import { useState, useEffect, useCallback } from 'react'
import P2PPaymentCoordinator from './components/P2PPaymentCoordinator'
import AdminEscrowDashboard from './components/AdminEscrowDashboard'
import ClientLogin from './components/ClientLogin'
import PlatformSelector from './components/PlatformSelector'
import { useAuth } from './context/AuthContext.jsx'

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
    // If already logged in, go directly to client workspace
    if (clientToken) {
      navigate('client', platform)
    } else {
      navigate('client-login', platform)
    }
  }, [clientToken, navigate])

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
    </div>
  )
}

export default App
