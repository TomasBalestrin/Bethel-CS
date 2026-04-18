// Envia um erro do client pra /api/log-client-error. Fire-and-forget:
// não queremos bloquear o render, e se o log falhar tudo bem — o erro
// original já foi tratado pela página de fallback.
interface ReportArgs {
  kind: 'render' | 'unhandledrejection' | 'window-error'
  message: string
  stack?: string
  digest?: string
  route?: string
}

export function reportClientError({ kind, message, stack, digest, route }: ReportArgs) {
  if (typeof window === 'undefined') return
  const payload = {
    kind,
    message,
    stack,
    digest,
    route,
    url: window.location.href,
    userAgent: navigator.userAgent,
  }
  fetch('/api/log-client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true, // importante: permite o fetch completar mesmo durante unload
  }).catch(() => { /* silencioso */ })
}
