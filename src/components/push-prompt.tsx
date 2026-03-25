'use client'

import { useEffect } from 'react'
import { subscribeToPush } from '@/lib/push/subscribe'

export function PushPrompt() {
  useEffect(() => {
    // Don't prompt if already granted or denied
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'default') return

    // Wait 5s after login to not be intrusive
    const timer = setTimeout(() => {
      subscribeToPush()
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  return null
}
