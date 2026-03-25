'use client'

import { useEffect, useRef, useState } from 'react'

interface InstallBannerProps {
  variant?: 'default' | 'chat'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredPromptGlobal: any = null

export function InstallBanner({ variant = 'default' }: InstallBannerProps) {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const captured = useRef(false)

  useEffect(() => {
    // Only show on mobile devices
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      || window.innerWidth < 768
    if (!isMobile) return

    // Don't show if already dismissed
    if (localStorage.getItem('pwa-dismissed') === 'true') return

    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // iOS standalone check
    if ((navigator as unknown as { standalone?: boolean }).standalone === true) return

    const iosDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    setIsIOS(iosDevice)

    // Capture beforeinstallprompt globally
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPromptGlobal = e
      captured.current = true
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
    if (deferredPromptGlobal) {
      try {
        deferredPromptGlobal.prompt()
        const { outcome } = await deferredPromptGlobal.userChoice
        if (outcome === 'accepted') {
          setShow(false)
        }
      } catch {
        // prompt() can only be called once
      }
      deferredPromptGlobal = null
      return
    }

    // Fallback: manual install instructions per OS
    if (isIOS) {
      alert('Para instalar:\n1. Toque no botão "Compartilhar" (ícone ⬆️)\n2. Selecione "Adicionar à Tela de Início"')
    } else {
      alert('Para instalar:\n1. Toque no menu do navegador (⋮)\n2. Selecione "Adicionar à tela inicial"')
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
          className="rounded px-3 py-2 text-sm text-white/60 transition hover:text-white min-h-[44px]"
        >
          Agora não
        </button>
        <button
          onClick={handleInstall}
          className="rounded px-4 py-2 text-sm font-medium text-white min-h-[44px]"
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
