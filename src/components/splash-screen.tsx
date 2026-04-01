'use client'

import { useEffect, useState } from 'react'

interface SplashScreenProps {
  subtitle?: string
}

export function SplashScreen({ subtitle }: SplashScreenProps) {
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true)
      setTimeout(() => setVisible(false), 500)
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#001321' }}
    >
      {/* Logo "B" */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
        <span className="text-5xl font-bold text-white">B</span>
      </div>

      {/* Title */}
      <h1 className="text-xl font-semibold text-white">Bethel CS</h1>

      {subtitle && (
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      )}

      {/* Spinner */}
      <div className="mt-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    </div>
  )
}
