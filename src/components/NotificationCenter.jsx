import React from 'react'
import { AlertTriangle, BellRing, CheckCircle2 } from 'lucide-react'

const statusStyles = {
  approved: { icon: CheckCircle2, color: 'text-emerald-500', label: 'Approved' },
  released: { icon: CheckCircle2, color: 'text-indigo-400', label: 'Released' },
  disputed: { icon: AlertTriangle, color: 'text-amber-400', label: 'Disputed' },
  cancelled: { icon: AlertTriangle, color: 'text-red-400', label: 'Cancelled' },
  refunded: { icon: AlertTriangle, color: 'text-green-400', label: 'Refunded' }
}

export function NotificationCenter({ items = [], onDismiss, dense = false }) {
  if (!items.length) {
    return null
  }

  return (
    <div className={`rounded-2xl border ${dense ? 'p-3' : 'p-4'} bg-white/80 dark:bg-slate-900/70 border-slate-200 dark:border-slate-700 shadow-lg space-y-3`}>
      <div className="flex items-center gap-2">
        <BellRing className="w-4 h-4 text-indigo-500" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notifications</p>
      </div>
      <ul className="space-y-2">
        {items.map(item => {
          const meta = statusStyles[item.status] || { icon: BellRing, color: 'text-slate-400', label: item.status }
          const Icon = meta.icon
          return (
            <li key={item.id} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-200">
              <Icon className={`w-4 h-4 mt-0.5 ${meta.color}`} />
              <div className="flex-1">
                <p className="font-semibold">
                  {meta.label}: {item.message || `Escrow ${item.escrowId}`}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(item.id)}
                  className="text-xs text-indigo-500 hover:text-indigo-700"
                >
                  Dismiss
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
