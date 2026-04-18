import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logOpError } from '@/lib/log-op-error'

// Cron de invariantes: detecta estados "impossíveis" que indicam bug
// silencioso (call que não fechou, mentorado com etapa corrompida, instância
// WhatsApp desconectada, etc.) e registra em system_errors pra admin ver.
//
// Aceita dois tipos de chamada:
//   1. Vercel Cron (Authorization: Bearer ${CRON_SECRET})
//   2. Admin logado manualmente (útil pra rodar on-demand)

const FOUR_HOURS_AGO = () => new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
const ONE_HOUR_AGO = () => new Date(Date.now() - 60 * 60 * 1000).toISOString()

interface InvariantResult {
  name: string
  broken: number
  sample?: unknown[]
}

async function authorize(request: NextRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization') || ''
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Não autenticado' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false, status: 403, error: 'Sem permissão' }
  return { ok: true }
}

export async function GET(request: NextRequest) {
  const auth = await authorize(request)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  const results: InvariantResult[] = []

  // ─── 1. Ligações órfãs: created_at < 4h e ended_at NULL ─────────────
  const { data: orphanCalls } = await admin
    .from('call_records')
    .select('id, mentee_id, specialist_id, created_at')
    .is('ended_at', null)
    .lt('created_at', FOUR_HOURS_AGO())
    .limit(50)
  const orphanCallsCount = orphanCalls?.length ?? 0
  results.push({ name: 'orphan-calls', broken: orphanCallsCount, sample: orphanCalls?.slice(0, 3) })
  if (orphanCallsCount > 0) {
    await logOpError({
      route: '/api/health/invariants',
      operation: 'cron',
      target: 'invariant:orphan-calls',
      error: { message: `${orphanCallsCount} ligação(ões) sem ended_at há mais de 4h` },
      context: { sample: orphanCalls?.slice(0, 10) },
    })
  }

  // ─── 2. Gravações travadas em processing > 1h ───────────────────────
  const { data: stuckRec } = await admin
    .from('call_records')
    .select('id, mentee_id, recording_status, created_at')
    .eq('recording_status', 'processing')
    .lt('created_at', ONE_HOUR_AGO())
    .limit(50)
  const stuckRecCount = stuckRec?.length ?? 0
  results.push({ name: 'stuck-recordings', broken: stuckRecCount, sample: stuckRec?.slice(0, 3) })
  if (stuckRecCount > 0) {
    await logOpError({
      route: '/api/health/invariants',
      operation: 'cron',
      target: 'invariant:stuck-recordings',
      error: { message: `${stuckRecCount} gravação(ões) em 'processing' há mais de 1h` },
      context: { sample: stuckRec?.slice(0, 10) },
    })
  }

  // ─── 3. Etapa do mentorado não bate com kanban_type ─────────────────
  // Busca todos mentees + kanban_stages em memória — mais simples que join.
  const [{ data: mentees }, { data: stages }] = await Promise.all([
    admin.from('mentees').select('id, full_name, kanban_type, current_stage_id').not('current_stage_id', 'is', null),
    admin.from('kanban_stages').select('id, type'),
  ])
  const stageTypeMap = new Map<string, string>()
  stages?.forEach((s) => stageTypeMap.set(s.id, s.type))
  const corruptedMentees = (mentees ?? []).filter((m) => {
    if (!m.current_stage_id) return false
    const stageType = stageTypeMap.get(m.current_stage_id)
    return stageType !== undefined && stageType !== m.kanban_type
  })
  results.push({ name: 'stage-type-mismatch', broken: corruptedMentees.length, sample: corruptedMentees.slice(0, 3) })
  if (corruptedMentees.length > 0) {
    await logOpError({
      route: '/api/health/invariants',
      operation: 'cron',
      target: 'invariant:stage-type-mismatch',
      error: { message: `${corruptedMentees.length} mentorado(s) com current_stage_id que não casa com kanban_type` },
      context: { sample: corruptedMentees.slice(0, 10) },
    })
  }

  // ─── 4. Mensagens órfãs com attempts > 5 ────────────────────────────
  const { data: orphanMsgs } = await (admin.from as (name: string) => ReturnType<typeof admin.from>)('wpp_orphan_messages')
    .select('phone, sender_name, attempts, last_seen_at')
    .gt('attempts', 5)
    .limit(50) as unknown as { data: { phone: string; sender_name: string | null; attempts: number; last_seen_at: string }[] | null }
  const orphanMsgsCount = orphanMsgs?.length ?? 0
  results.push({ name: 'persistent-orphan-messages', broken: orphanMsgsCount, sample: orphanMsgs?.slice(0, 3) })
  if (orphanMsgsCount > 0) {
    await logOpError({
      route: '/api/health/invariants',
      operation: 'cron',
      target: 'invariant:persistent-orphan-messages',
      error: { message: `${orphanMsgsCount} telefone(s) com 5+ tentativas não casadas a mentorado` },
      context: { sample: orphanMsgs?.slice(0, 10) },
    })
  }

  // ─── 5. Nenhuma instância WhatsApp conectada (apagão) ───────────────
  const { count: connectedCount } = await admin
    .from('wpp_instances')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'connected')
  const isBlackout = (connectedCount ?? 0) === 0
  results.push({ name: 'wpp-blackout', broken: isBlackout ? 1 : 0 })
  if (isBlackout) {
    await logOpError({
      route: '/api/health/invariants',
      operation: 'cron',
      target: 'invariant:wpp-blackout',
      error: { message: 'Nenhuma instância WhatsApp conectada' },
    })
  }

  const totalBroken = results.reduce((s, r) => s + r.broken, 0)
  return NextResponse.json({
    checked: results.length,
    totalBroken,
    results,
    ranAt: new Date().toISOString(),
  })
}
