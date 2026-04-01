'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-5">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Algo deu errado
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Ocorreu um erro ao carregar esta página. Isso pode ser temporário — tente novamente.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Voltar ao início
        </Button>
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
      {error.digest && (
        <p className="mt-4 text-[10px] text-muted-foreground/40">
          Código: {error.digest}
        </p>
      )}
    </div>
  )
}
