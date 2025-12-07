import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Toaster } from 'react-hot-toast'
import './i18n/config.js'
import { injectSpeedInsights } from '@vercel/speed-insights'

// Initialize Vercel Speed Insights on client side only
if (typeof window !== 'undefined') {
  injectSpeedInsights()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
        <Toaster 
          position="top-right"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              borderRadius: '0.5rem',
              padding: '16px',
            },
          }}
        />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
