import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchMenteeMetrics } from '@/lib/metrics-client'
import { logOpError } from '@/lib/log-op-error'

// GET /api/metrics/<menteeId>
//
// Cache stale-while-revalidate: se mentees.metrics_updated_at é recente (<24h)
// e ?force=true não foi passado, retorna o que já está no nosso banco e evita
// chamar o Bethel Metrics. Senão, puxa do BM via v_mentee_metrics e atualiza
// as colunas locais.
//
// Retorno sempre tem: { cached: boolean, updatedAt: string|null, metrics: {...}|null }

const TTL_MS = 24 * 60 * 60 * 1000 // 24h

export async function GET(
  request: NextRequest,
  { params }: { params: { menteeId: string } }
) {
  const { menteeId } = params
  const force = request.nextUrl.searchParams.get('force') === 'true'

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Leitura inicial — precisa de email/phone/cpf pra match no BM, e dos campos
  // de métrica pra retornar sem chamar BM em caso de cache hit.
  const { data: mentee, error } = await supabase
    .from('mentees')
    .select('id, email, phone, cpf, metrics_updated_at, faturamento_atual, faturamento_mes_anterior, faturamento_antes_mentoria, ultimo_acesso, dias_acessou_sistema, dias_preencheu, total_leads, total_vendas, total_receita_periodo, total_entrada_periodo, taxa_conversao, ticket_medio, funis_ativos')
    .eq('id', menteeId)
    .single()

  if (error || !mentee) {
    return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })
  }

  const updatedAt = mentee.metrics_updated_at as string | null
  const isFresh = !!updatedAt && Date.now() - new Date(updatedAt).getTime() < TTL_MS

  // Cache hit — retorna local sem chamar BM
  if (isFresh && !force) {
    return NextResponse.json({
      cached: true,
      updatedAt,
      metrics: extractMetrics(mentee),
    })
  }

  // Cache miss ou force — puxa do BM
  const bmData = await fetchMenteeMetrics({
    email: mentee.email,
    phone: mentee.phone,
    cpf: mentee.cpf,
  })

  if (!bmData) {
    // Não achou no BM. Atualiza apenas metrics_updated_at pra não ficar
    // tentando a cada request (respeita TTL). Retorna o que tem localmente.
    const admin = createAdminClient()
    await admin
      .from('mentees')
      .update({ metrics_updated_at: new Date().toISOString() })
      .eq('id', menteeId)
    return NextResponse.json({
      cached: false,
      updatedAt: new Date().toISOString(),
      metrics: extractMetrics(mentee),
      notFound: true,
    })
  }

  // Match — atualiza as colunas locais. Usa admin client pra contornar RLS
  // (a policy de mentees.update pode restringir por created_by).
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const updates = {
    faturamento_atual: bmData.faturamento_atual,
    faturamento_mes_anterior: bmData.faturamento_mes_anterior,
    faturamento_antes_mentoria: bmData.faturamento_antes_mentoria,
    ultimo_acesso: bmData.ultimo_acesso,
    dias_acessou_sistema: bmData.dias_acessou_sistema,
    total_leads: bmData.total_leads,
    total_vendas: bmData.total_vendas,
    total_receita_periodo: bmData.total_receita_periodo,
    total_entrada_periodo: bmData.total_entrada_periodo,
    taxa_conversao: bmData.taxa_conversao,
    ticket_medio: bmData.ticket_medio,
    funis_ativos: bmData.funis_ativos,
    metrics_updated_at: now,
  }
  const { error: updateErr } = await admin
    .from('mentees')
    .update(updates)
    .eq('id', menteeId)

  if (updateErr) {
    await logOpError({
      route: '/api/metrics/[menteeId]',
      operation: 'update',
      target: 'mentees',
      error: updateErr,
      menteeId,
      context: { source: 'bethel-metrics' },
    })
    return NextResponse.json({ error: `Falha ao salvar métricas: ${updateErr.message}` }, { status: 500 })
  }

  return NextResponse.json({
    cached: false,
    updatedAt: now,
    metrics: extractMetrics({ ...mentee, ...updates }),
  })
}

function extractMetrics(m: Record<string, unknown>) {
  return {
    faturamento_atual: m.faturamento_atual ?? null,
    faturamento_mes_anterior: m.faturamento_mes_anterior ?? null,
    faturamento_antes_mentoria: m.faturamento_antes_mentoria ?? null,
    ultimo_acesso: m.ultimo_acesso ?? null,
    dias_acessou_sistema: m.dias_acessou_sistema ?? null,
    dias_preencheu: m.dias_preencheu ?? null,
    total_leads: m.total_leads ?? null,
    total_vendas: m.total_vendas ?? null,
    total_receita_periodo: m.total_receita_periodo ?? null,
    total_entrada_periodo: m.total_entrada_periodo ?? null,
    taxa_conversao: m.taxa_conversao ?? null,
    ticket_medio: m.ticket_medio ?? null,
    funis_ativos: m.funis_ativos ?? [],
  }
}
