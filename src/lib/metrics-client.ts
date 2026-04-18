import { createClient } from '@supabase/supabase-js'

// Client Supabase apontado para o projeto Bethel Metrics (external).
// Requer env vars METRICS_SUPABASE_URL e METRICS_SUPABASE_KEY (service role).
// Só usar em código server-side. Retorna null se envs não configuradas —
// nesse caso o caller trata como "sem métricas" em vez de crashar.

function getClient() {
  const url = process.env.METRICS_SUPABASE_URL
  const key = process.env.METRICS_SUPABASE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export interface BethelMenteeMetrics {
  profile_id: string
  full_name: string
  email: string
  phone: string | null
  cpf: string | null
  ultimo_acesso: string | null
  dias_acessou_sistema: number | null
  faturamento_antes_mentoria: number | null
  faturamento_atual: number | null
  faturamento_mes_anterior: number | null
  total_leads: number | null
  total_vendas: number | null
  total_receita_periodo: number | null
  total_entrada_periodo: number | null
  taxa_conversao: number | null
  ticket_medio: number | null
  funis_ativos: Array<{ id: string; nome: string; slug: string }>
  source_updated_at: string | null
}

// Match prioriza email (unique no BM), cai pra phone, depois cpf. Retorna
// null se não achar — bom pra mentorados que ainda não foram importados pro
// Bethel Metrics.
export async function fetchMenteeMetrics(match: {
  email?: string | null
  phone?: string | null
  cpf?: string | null
}): Promise<BethelMenteeMetrics | null> {
  const client = getClient()
  if (!client) return null

  const normalizedPhone = match.phone ? match.phone.replace(/\D/g, '') : null

  // Tentar por email primeiro (UNIQUE no BM)
  if (match.email) {
    const { data, error } = await client
      .from('v_mentee_metrics')
      .select('*')
      .eq('email', match.email)
      .maybeSingle()
    if (error) {
      console.error('[metrics-client] fetch by email failed:', error.message)
    }
    if (data) return data as BethelMenteeMetrics
  }

  // Fallback: telefone (últimos 8 dígitos). BM pode ter formato diferente —
  // busca por `like` pra tolerar parênteses/traços/espaços.
  if (normalizedPhone && normalizedPhone.length >= 8) {
    const last8 = normalizedPhone.slice(-8)
    const { data, error } = await client
      .from('v_mentee_metrics')
      .select('*')
      .ilike('phone', `%${last8}%`)
      .maybeSingle()
    if (error) {
      console.error('[metrics-client] fetch by phone failed:', error.message)
    }
    if (data) return data as BethelMenteeMetrics
  }

  // Fallback: CPF (só dígitos)
  if (match.cpf) {
    const cpfDigits = match.cpf.replace(/\D/g, '')
    if (cpfDigits.length === 11) {
      const { data, error } = await client
        .from('v_mentee_metrics')
        .select('*')
        .ilike('cpf', `%${cpfDigits}%`)
        .maybeSingle()
      if (error) {
        console.error('[metrics-client] fetch by cpf failed:', error.message)
      }
      if (data) return data as BethelMenteeMetrics
    }
  }

  return null
}
