import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Health check público (sem auth) pra monitor externo (UptimeRobot, Better
// Stack, etc.) saber em 1 min se o sistema caiu. Retorna 200 se tudo OK,
// 503 se algo crítico falta.
//
// Checa:
//   * Env vars obrigatórias pra o app funcionar
//   * Conexão com Supabase (query trivial)
//   * Credenciais NextTrack (só presença, não faz login)
//   * Credenciais Daily.co (só presença)
//
// Não expõe segredos — só diz "presente" ou "faltando".

interface HealthResponse {
  ok: boolean
  db: 'ok' | 'fail'
  missing: string[]
  timestamp: string
}

export async function GET() {
  const missing: string[] = []

  const required = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  for (const [key, value] of Object.entries(required)) {
    if (!value) missing.push(key)
  }

  // Vars úteis mas não bloqueantes (operam em degradação graciosa).
  const optional = {
    NEXTAPPS_EMAIL: process.env.NEXTAPPS_EMAIL,
    NEXTAPPS_PASSWORD: process.env.NEXTAPPS_PASSWORD,
    NEXTRACK_INSTANCE_UUID: process.env.NEXTRACK_INSTANCE_UUID,
    DAILY_API_KEY: process.env.DAILY_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  }
  const missingOptional = Object.entries(optional)
    .filter(([, v]) => !v)
    .map(([k]) => k)

  // Testa DB com uma query trivial; se o service role estiver ausente
  // também falhará aqui — bom teste combinado.
  let db: 'ok' | 'fail' = 'fail'
  try {
    if (!missing.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      const admin = createAdminClient()
      const { error } = await admin.from('profiles').select('id', { head: true, count: 'exact' }).limit(1)
      if (!error) db = 'ok'
    }
  } catch {
    db = 'fail'
  }

  const ok = missing.length === 0 && db === 'ok'

  const response: HealthResponse & { missingOptional?: string[] } = {
    ok,
    db,
    missing,
    timestamp: new Date().toISOString(),
  }
  if (missingOptional.length > 0) response.missingOptional = missingOptional

  return NextResponse.json(response, { status: ok ? 200 : 503 })
}
