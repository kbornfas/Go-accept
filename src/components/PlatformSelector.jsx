import React, { useState } from 'react'
import { ArrowRight, Shield, Globe, ChevronLeft, Sparkles } from 'lucide-react'
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

export default function PlatformSelector({ onSelect, onBack }) {
  const [hoveredPlatform, setHoveredPlatform] = useState(null)

  return (
    <div className="bg-white min-h-screen p-6 transition-colors">
      {/* Subtle gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-violet-500 to-amber-500" />
      
      <div className="max-w-5xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-12">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="absolute top-8 left-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 mb-6 shadow-sm">
            <Shield className="w-4 h-4 text-emerald-600" /> Secure P2P Escrow
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-slate-800 via-violet-700 to-slate-800 bg-clip-text text-transparent">
            Select Your Trading Platform
          </h1>
          <p className="text-lg max-w-2xl mx-auto text-slate-500">
            Choose the P2P platform where you'll be completing your trade. 
            Your payment details will be securely held in escrow.
          </p>
        </div>

        {/* Platform Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {platforms.map((platform) => {
            const isHovered = hoveredPlatform === platform.value
            return (
              <button
                key={platform.value}
                type="button"
                onClick={() => onSelect(platform.value)}
                onMouseEnter={() => setHoveredPlatform(platform.value)}
                onMouseLeave={() => setHoveredPlatform(null)}
                className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left group bg-white ${
                  isHovered 
                    ? 'border-violet-400 shadow-xl shadow-violet-100 scale-[1.03]' 
                    : 'border-slate-100 hover:border-slate-200 shadow-md hover:shadow-lg'
                }`}
              >
                {/* Platform Logo */}
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 mb-4 overflow-hidden border border-slate-200">
                  <img
                    src={platformLogos[platform.value]}
                    alt={platform.label}
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                  <div className="hidden items-center justify-center w-full h-full">
                    <Globe className="w-8 h-8 text-slate-400" />
                  </div>
                </div>

                {/* Platform Info */}
                <h3 className="text-lg font-bold mb-1 text-slate-800">{platform.label}</h3>
                <p className="text-xs line-clamp-2 text-slate-500">
                  {platform.description}
                </p>

                {/* Hover Arrow */}
                <div className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isHovered 
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg' 
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  <ArrowRight className={`w-4 h-4 transition-transform ${isHovered ? 'translate-x-0.5' : ''}`} />
                </div>

                {/* Color Accent Bar */}
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-1.5 rounded-b-2xl transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                  style={{ background: `linear-gradient(90deg, ${platform.color}, ${platform.color}88)` }}
                />
              </button>
            )
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              All transactions are protected by our secure escrow system
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
