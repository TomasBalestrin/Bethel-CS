import { createAdminClient } from '@/lib/supabase/admin'

// Tipos de operação que podem falhar e ser registradas.
//   insert/update/delete/select  → operações de DB
//   api                          → chamada a serviço externo (NextTrack,
//                                  Daily.co, OpenAI, AssemblyAI, etc.)
//   render                       → erro de renderização/runtime no client
//   cron                         → invariante quebrada detectada por job
export type OpType = 'insert' | 'update' | 'delete' | 'select' | 'api' | 'render' | 'cron'

// Shape mínimo do erro; aceita tanto erros do Postgres (código Postgres no
// `code`) quanto genéricos (Error.message).
type ErrLike = { code?: string; message: string; details?: string | null; hint?: string | null }

export interface LogOpErrorInput {
  route: string          // '/api/whatsapp/webhook', '/api/calls/create', 'app/error.tsx'
  operation: OpType
  target: string         // 'wpp_messages', 'nextrack:send-text', 'daily:create-room', 'invariant:orphan-calls'
  error: ErrLike
  menteeId?: string | null
  specialistId?: string | null
  context?: unknown      // JSON serializável; truncado a 4KB
}

/**
 * Grava uma falha em `system_errors` para o admin diagnosticar sem depender
 * do log do Vercel (que rotaciona). Nunca lança — se o próprio log falhar,
 * apenas console.error e segue (não queremos esconder o erro original).
 */
export async function logOpError(input: LogOpErrorInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const ctxJson = input.context === undefined
      ? null
      : typeof input.context === 'string'
        ? input.context
        : JSON.stringify(input.context).slice(0, 4000)
    await admin.from('system_errors' as never).insert({
      route: input.route,
      operation: input.operation,
      target: input.target,
      error_code: input.error.code ?? null,
      error_message: input.error.message,
      error_details: input.error.details ?? null,
      error_hint: input.error.hint ?? null,
      mentee_id: input.menteeId ?? null,
      specialist_id: input.specialistId ?? null,
      payload: ctxJson,
    } as never)
  } catch (err) {
    console.error('[logOpError] falhou ao registrar (não-fatal):', err)
  }
}
