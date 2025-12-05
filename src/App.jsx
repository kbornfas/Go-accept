import { useState, useEffect, useCallback } from 'react'
import P2PPaymentCoordinator from './components/P2PPaymentCoordinator'
import AdminEscrowDashboard from './components/AdminEscrowDashboard'
import ClientLogin from './components/ClientLogin'

const getViewFromPath = (path) => {
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/client')) {
    return path === '/client' ? 'client' : 'client-login'
  }
  return 'client-login'
}

function App() {
  const [view, setView] = useState(() => {
    if (typeof window === 'undefined') return 'client'
    return getViewFromPath(window.location.pathname)
  })

  const navigate = useCallback((nextView) => {
    if (typeof window === 'undefined') return
    let nextPath = '/client/login'
    if (nextView === 'admin') {
      nextPath = '/admin'
    } else if (nextView === 'client') {
      nextPath = '/client'
    }
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
    setView(nextView)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setView(getViewFromPath(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (view === 'client-login' && window.location.pathname === '/') {
      window.history.replaceState({}, '', '/client/login')
    }
  }, [view])

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {view === 'admin' ? (
        <AdminEscrowDashboard onNavigateClient={(nextView = 'client') => navigate(nextView)} />
      ) : view === 'client' ? (
        <P2PPaymentCoordinator />
      ) : (
        <ClientLogin onSuccess={() => navigate('client')} onNavigateAdmin={navigate} />
      )}
    </div>
  )
}

export default App
