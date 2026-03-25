'use client'

import { useEffect, useState } from 'react'

interface InstallBannerProps {
  variant?: 'default' | 'chat'
}

export function InstallBanner({ variant = 'default' }: InstallBannerProps) {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem('pwa-dismissed') === 'true') return

    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Show banner after 30s
    const timer = setTimeout(() => {
      setShow(true)
    }, 30000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        setShow(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa-dismissed', 'true')
    setShow(false)
  }

  if (!show) return null

  const text = variant === 'chat'
    ? 'Instale o chat para receber notificações'
    : 'Instale o Bethel CS para acesso rápido'

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] flex h-14 items-center justify-between px-4"
      style={{ backgroundColor: '#060A16' }}
    >
      <span className="text-sm text-white">{text}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDismiss}
          className="rounded px-3 py-1.5 text-sm text-white/60 transition hover:text-white"
        >
          Agora não
        </button>
        <button
          onClick={handleInstall}
          className="rounded px-4 py-1.5 text-sm font-medium text-white"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          }}
        >
          Instalar
        </button>
      </div>
    </div>
  )
}

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
