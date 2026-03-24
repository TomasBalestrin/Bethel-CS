import { createClient } from '@/lib/supabase/server'
import { DashboardMetrics } from '@/components/dashboard-metrics'

interface Props {
  searchParams: {
    specialist?: string
    start?: string
    end?: string
    fit?: string
  }
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .single()

  // Specialists for filter
  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'especialista')
    .order('full_name')

  // Filters
  const startDate = searchParams.start || null
  const endDate = searchParams.end || null
  const fitFilter = searchParams.fit || null // 'true' | 'false' | null
  const specialistId = searchParams.specialist || null

  // ─── Mentees ───
  let menteesQuery = supabase.from('mentees').select('*')
  if (fitFilter === 'true') menteesQuery = menteesQuery.eq('cliente_fit', true)
  if (fitFilter === 'false') menteesQuery = menteesQuery.eq('cliente_fit', false)
  if (specialistId) menteesQuery = menteesQuery.eq('created_by', specialistId)

  // ─── Revenue ───
  let revenueQuery = supabase.from('revenue_records').select('sale_value, revenue_type, created_at')
  if (startDate) revenueQuery = revenueQuery.gte('created_at', startDate)
  if (endDate) revenueQuery = revenueQuery.lte('created_at', endDate + 'T23:59:59')

  // ─── Testimonials ───
  let testimonialsQuery = supabase.from('testimonials').select('id, created_at')
  if (startDate) testimonialsQuery = testimonialsQuery.gte('created_at', startDate)
  if (endDate) testimonialsQuery = testimonialsQuery.lte('created_at', endDate + 'T23:59:59')

  // ─── Indications ───
  let indicationsQuery = supabase.from('indications').select('id, created_at')
  if (startDate) indicationsQuery = indicationsQuery.gte('created_at', startDate)
  if (endDate) indicationsQuery = indicationsQuery.lte('created_at', endDate + 'T23:59:59')

  // ─── Engagement ───
  let engagementQuery = supabase.from('engagement_records').select('type, value, recorded_at')
  if (startDate) engagementQuery = engagementQuery.gte('recorded_at', startDate)
  if (endDate) engagementQuery = engagementQuery.lte('recorded_at', endDate)

  // ─── CS Activities ───
  let csQuery = supabase.from('cs_activities').select('type, duration_minutes, specialist_id, activity_date')
  if (startDate) csQuery = csQuery.gte('activity_date', startDate)
  if (endDate) csQuery = csQuery.lte('activity_date', endDate)

  const [
    { data: mentees },
    { data: revenues },
    { data: testimonials },
    { data: indications },
    { data: engagements },
    { data: csActivities },
  ] = await Promise.all([
    menteesQuery,
    revenueQuery,
    testimonialsQuery,
    indicationsQuery,
    engagementQuery,
    csQuery,
  ])

  // ─── SEÇÃO 2: Visão Geral ───
  const allMentees = mentees ?? []
  const totalMentees = allMentees.filter((m) => m.status === 'ativo').length
  const fitMentees = allMentees.filter((m) => m.cliente_fit && m.status === 'ativo').length
  const cancelados = allMentees.filter((m) => m.status === 'cancelado').length
  const totalIndications = indications?.length ?? 0

  const priorityDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  allMentees.filter((m) => m.status === 'ativo').forEach((m) => {
    priorityDistribution[m.priority_level] = (priorityDistribution[m.priority_level] ?? 0) + 1
  })

  // ─── SEÇÃO 3: Sucesso ───
  const totalRevenue = revenues?.reduce((s, r) => s + Number(r.sale_value), 0) ?? 0

  // Engagement by type
  const engByType: Record<string, number> = { aula: 0, live: 0, evento: 0, whatsapp_contato: 0 }
  engagements?.forEach((e) => { engByType[e.type] = (engByType[e.type] ?? 0) + Number(e.value) })

  const totalTestimonials = testimonials?.length ?? 0

  // ─── SEÇÃO 4: Trabalho CS ───
  const allCs = csActivities ?? []
  const ligacoes = allCs.filter((c) => c.type === 'ligacao')
  const whatsapps = allCs.filter((c) => c.type === 'whatsapp')
  const totalLigacoes = ligacoes.length
  const totalLigacaoDuration = ligacoes.reduce((s, c) => s + Number(c.duration_minutes), 0)
  const totalWhatsapp = whatsapps.length
  const totalWhatsappDuration = whatsapps.reduce((s, c) => s + Number(c.duration_minutes), 0)
  const avgWhatsappDuration = totalWhatsapp > 0 ? Math.round(totalWhatsappDuration / totalWhatsapp) : 0

  // ─── SEÇÃO 5: Receita ───
  const revByType: Record<string, number> = {
    crossell: 0, upsell: 0,
    indicacao_perpetuo: 0, indicacao_intensivo: 0, indicacao_encontro: 0,
  }
  revenues?.forEach((r) => {
    revByType[r.revenue_type] = (revByType[r.revenue_type] ?? 0) + Number(r.sale_value)
  })

  return (
    <DashboardMetrics
      userName={profile?.full_name ?? ''}
      specialists={specialists ?? []}
      filters={{ specialistId, startDate, endDate, fitFilter }}
      section2={{
        totalMentees,
        fitMentees,
        totalIndications,
        cancelados,
        priorityDistribution,
      }}
      section3={{
        totalRevenue,
        engByType,
        totalTestimonials,
        cancelados,
      }}
      section4={{
        totalLigacoes,
        totalLigacaoDuration,
        totalWhatsapp,
        avgWhatsappDuration,
      }}
      section5={{
        crossell: revByType.crossell,
        upsell: revByType.upsell,
        indicacao_perpetuo: revByType.indicacao_perpetuo,
        indicacao_intensivo: revByType.indicacao_intensivo,
        indicacao_encontro: revByType.indicacao_encontro,
        total: totalRevenue,
      }}
    />
  )
}
