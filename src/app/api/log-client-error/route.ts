import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logOpError } from '@/lib/log-op-error'

// Recebe erros de render / unhandled rejection do client e persiste em
// system_errors. Chamado por app/error.tsx, global-error.tsx e pelo listener
// de window.onerror/unhandledrejection montado no layout.
//
// Não exige admin — qualquer usuário autenticado pode reportar o próprio
// crash (senão o erro seria silencioso no ambiente do usuário). Se não
// tiver sessão também aceita (erros durante login, por exemplo).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      kind?: 'render' | 'unhandledrejection' | 'window-error'
      message?: string
      stack?: string
      digest?: string
      route?: string
      url?: string
      userAgent?: string
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await logOpError({
      route: body.route || 'client',
      operation: 'render',
      target: body.kind || 'render',
      error: {
        message: (body.message || 'Unknown client error').slice(0, 2000),
        details: body.stack ? body.stack.slice(0, 3000) : null,
        code: body.digest || undefined,
      },
      specialistId: user?.id ?? null,
      context: {
        url: body.url,
        userAgent: body.userAgent?.slice(0, 300),
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    // Não falha cliente se o log falhar — erro já aconteceu.
    console.error('[log-client-error] error while logging:', err)
    return NextResponse.json({ ok: true })
  }
}
