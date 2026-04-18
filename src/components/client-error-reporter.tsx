'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/lib/report-client-error'

// Escuta erros que escapam do React:
//   - window.error (erros síncronos em handlers não capturados)
//   - unhandledrejection (Promises rejeitadas sem .catch)
// Enviados para /api/log-client-error com throttle simples pra evitar loop
// em erros recorrentes. Não renderiza nada.
export function ClientErrorReporter() {
  useEffect(() => {
    const recent = new Map<string, number>()
    const THROTTLE_MS = 60 * 1000 // mesmo erro não é reportado mais de 1x/min

    function shouldReport(key: string): boolean {
      const last = recent.get(key)
      const now = Date.now()
      if (last && now - last < THROTTLE_MS) return false
      recent.set(key, now)
      // Limpa entradas antigas pra não vazar memória
      if (recent.size > 50) {
        for (const [k, t] of Array.from(recent.entries())) {
          if (now - t > THROTTLE_MS) recent.delete(k)
        }
      }
      return true
    }

    function handleError(ev: ErrorEvent) {
      const msg = ev.message || String(ev.error) || 'unknown'
      if (!shouldReport(msg)) return
      reportClientError({
        kind: 'window-error',
        message: msg,
        stack: ev.error instanceof Error ? ev.error.stack : undefined,
      })
    }

    function handleRejection(ev: PromiseRejectionEvent) {
      const reason = ev.reason
      const msg = reason instanceof Error ? reason.message : String(reason)
      if (!shouldReport(msg)) return
      reportClientError({
        kind: 'unhandledrejection',
        message: msg,
        stack: reason instanceof Error ? reason.stack : undefined,
      })
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}
