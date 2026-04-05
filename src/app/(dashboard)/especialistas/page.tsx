import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SpecialistsView } from '@/components/specialists-view'

export default async function EspecialistasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin check
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  // Fetch all specialists
  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, created_at')
    .eq('role', 'especialista')
    .order('full_name')

  // Fetch all mentees with created_by
  const { data: mentees } = await supabase
    .from('mentees')
    .select('id, created_by, status, cliente_fit, faturamento_atual, faturamento_antes_mentoria')

  // Fetch revenue records
  const { data: revenues } = await supabase
    .from('revenue_records')
    .select('mentee_id, sale_value')

  // Fetch indications
  const { data: indications } = await supabase
    .from('indications')
    .select('mentee_id')

  // Fetch testimonials
  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('mentee_id')

  // Fetch call records
  const { data: calls } = await supabase
    .from('call_records')
    .select('specialist_id, duration_seconds')

  // Fetch WPP messages sent
  const { data: wppOut } = await supabase
    .from('wpp_messages')
    .select('specialist_id')
    .eq('direction', 'outgoing')

  // Fetch engagement records
  const { data: engagements } = await supabase
    .from('engagement_records')
    .select('type, value, mentee_id')

  // Build per-specialist metrics
  const allMentees = mentees ?? []
  const allRevenues = revenues ?? []
  const allIndications = indications ?? []
  const allTestimonials = testimonials ?? []
  const allCalls = calls ?? []
  const allWppOut = wppOut ?? []
  const allEngagements = engagements ?? []

  const specialistMetrics = (specialists ?? []).map((s) => {
    const myMentees = allMentees.filter((m) => m.created_by === s.id)
    const myMenteeIds = new Set(myMentees.map((m) => m.id))

    const ativos = myMentees.filter((m) => m.status === 'ativo').length
    const cancelados = myMentees.filter((m) => m.status === 'cancelado').length
    const concluidos = myMentees.filter((m) => m.status === 'concluido').length
    const total = myMentees.length
    const fit = myMentees.filter((m) => m.cliente_fit && m.status === 'ativo').length
    const retencao = total > 0 ? Math.round((ativos / total) * 100) : 0

    const receita = allRevenues
      .filter((r) => myMenteeIds.has(r.mentee_id))
      .reduce((sum, r) => sum + Number(r.sale_value), 0)

    const indicacoes = allIndications.filter((i) => myMenteeIds.has(i.mentee_id)).length
    const depoimentos = allTestimonials.filter((t) => myMenteeIds.has(t.mentee_id)).length

    const myCalls = allCalls.filter((c) => c.specialist_id === s.id)
    const totalLigacoes = myCalls.length
    const totalMinutos = Math.round(myCalls.reduce((sum, c) => sum + Number(c.duration_seconds ?? 0), 0) / 60)

    const totalMsgsEnviadas = allWppOut.filter((m) => m.specialist_id === s.id).length

    // Engagement by mentee
    const myEngagements = allEngagements.filter((e) => myMenteeIds.has(e.mentee_id))
    const engAulas = myEngagements.filter((e) => e.type === 'aula').reduce((s, e) => s + Number(e.value), 0)
    const engLives = myEngagements.filter((e) => e.type === 'live').reduce((s, e) => s + Number(e.value), 0)

    // Growth: avg faturamento atual vs antes mentoria
    const menteesComFat = myMentees.filter((m) => m.faturamento_atual != null && m.faturamento_antes_mentoria != null)
    const avgFatAtual = menteesComFat.length > 0
      ? menteesComFat.reduce((s, m) => s + Number(m.faturamento_atual), 0) / menteesComFat.length
      : 0
    const avgFatAntes = menteesComFat.length > 0
      ? menteesComFat.reduce((s, m) => s + Number(m.faturamento_antes_mentoria), 0) / menteesComFat.length
      : 0
    const crescimentoMedio = avgFatAntes > 0 ? Math.round(((avgFatAtual - avgFatAntes) / avgFatAntes) * 100) : 0

    return {
      id: s.id,
      full_name: s.full_name,
      avatar_url: s.avatar_url,
      created_at: s.created_at,
      mentorados: { ativos, cancelados, concluidos, total, fit, retencao },
      desempenho: { receita, indicacoes, depoimentos },
      atendimentos: { totalLigacoes, totalMinutos, totalMsgsEnviadas },
      engajamento: { aulas: engAulas, lives: engLives },
      crescimento: { avgFatAtual, avgFatAntes, crescimentoMedio },
    }
  })

  return <SpecialistsView specialists={specialistMetrics} />
}
