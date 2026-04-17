import { createAdminClient } from '@/lib/supabase/admin'

// Erro cru vindo do cliente supabase-js; usamos shape mínimo.
type SbError = { code?: string; message: string; details?: string | null; hint?: string | null }

export interface LogInsertErrorInput {
  route: string
  targetTable: string
  error: SbError
  menteeId?: string | null
  specialistId?: string | null
  payload?: unknown
}

/**
 * Registra um INSERT falho em `wpp_insert_errors` para o admin conseguir
 * diagnosticar sem depender do log do Vercel. Nunca lança — qualquer falha
 * ao registrar é silenciada com console.error (não queremos esconder o erro
 * original encadeando um segundo).
 */
export async function logInsertError(input: LogInsertErrorInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const payloadJson = input.payload === undefined
      ? null
      : typeof input.payload === 'string'
        ? input.payload
        : JSON.stringify(input.payload).slice(0, 4000)
    await admin.from('wpp_insert_errors' as never).insert({
      route: input.route,
      target_table: input.targetTable,
      error_code: input.error.code ?? null,
      error_message: input.error.message,
      error_details: input.error.details ?? null,
      error_hint: input.error.hint ?? null,
      mentee_id: input.menteeId ?? null,
      specialist_id: input.specialistId ?? null,
      payload: payloadJson,
    } as never)
  } catch (err) {
    console.error('[logInsertError] falhou ao registrar (não-fatal):', err)
  }
}
