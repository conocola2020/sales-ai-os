'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } ${
        type === 'success'
          ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300'
          : 'bg-red-950 border-red-500/30 text-red-300'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 300) }} className="p-0.5 hover:opacity-70 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
