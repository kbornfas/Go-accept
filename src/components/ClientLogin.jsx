import React, { useState } from 'react'
import { Loader2, ShieldCheck, Lock, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function ClientLogin({ onSuccess, onNavigateAdmin }) {
  const { login, loadingRole, error } = useAuth()
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [darkMode, setDarkMode] = useState(true)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLocalError('')
    if (!password.trim()) {
      setLocalError('Password is required')
      return
    }
    try {
      await login('client', password.trim())
      setPassword('')
      onSuccess?.()
    } catch (err) {
      setLocalError(err.message)
    }
  }

  const bgClass = darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
  const cardClass = darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
  const mutedClass = darkMode ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className={`${bgClass} min-h-screen flex items-center justify-center p-6 transition-colors`}>
      <button
        type="button"
        onClick={() => setDarkMode((prev) => !prev)}
        className={`absolute top-6 right-6 px-3 py-1.5 text-xs rounded-full border ${darkMode ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}
      >
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      <div className={`w-full max-w-lg rounded-3xl border p-10 shadow-2xl space-y-8 ${cardClass}`}>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-400">
            <ShieldCheck className="w-3.5 h-3.5" /> Escrow Client
          </div>
          <h1 className="mt-4 text-3xl font-bold">Secure Workspace Login</h1>
          <p className={`mt-2 text-sm ${mutedClass}`}>
            Authenticate with your passphrase to load wallets, escrow holds, and notifications from the protected backend.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="text-sm font-semibold flex flex-col gap-2">
            Client Password
            <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${darkMode ? 'border-slate-700 bg-slate-950/40' : 'border-slate-300 bg-slate-50'}`}>
              <Lock className={`w-4 h-4 ${mutedClass}`} />
              <input
                type="password"
                className={`flex-1 bg-transparent outline-none ${darkMode ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
                placeholder="Enter passphrase"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </label>
          {(localError || error) && (
            <p className="text-sm text-red-400">{localError || error}</p>
          )}
          <button
            type="submit"
            disabled={loadingRole === 'client'}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
          >
            {loadingRole === 'client' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Access Workspace
          </button>
        </form>
        <div className={`text-xs ${mutedClass}`}>
          Need administrator access?{' '}
          {onNavigateAdmin ? (
            <button type="button" onClick={() => onNavigateAdmin('admin')} className="font-semibold text-indigo-400 hover:text-indigo-300">
              Go to admin console
            </button>
          ) : (
            <span className="font-semibold">Use the admin portal link</span>
          )}
        </div>
      </div>
    </div>
  )
}
