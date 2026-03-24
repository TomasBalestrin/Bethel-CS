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

  // Fetch specialists for filter
  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name')

  // Build date filters
  const startDate = searchParams.start || null
  const endDate = searchParams.end || null
  const fitOnly = searchParams.fit === 'true'
  const specialistId = searchParams.specialist || null

  // ─── Fetch all data in parallel ───
  let menteesQuery = supabase.from('mentees').select('*')
  if (fitOnly) menteesQuery = menteesQuery.eq('cliente_fit', true)
  if (specialistId) menteesQuery = menteesQuery.eq('created_by', specialistId)

  let revenueQuery = supabase.from('revenue_records').select('sale_value, revenue_type, created_at')
  if (startDate) revenueQuery = revenueQuery.gte('created_at', startDate)
  if (endDate) revenueQuery = revenueQuery.lte('created_at', endDate + 'T23:59:59')

  let testimonialsQuery = supabase.from('testimonials').select('id, created_at')
  if (startDate) testimonialsQuery = testimonialsQuery.gte('created_at', startDate)
  if (endDate) testimonialsQuery = testimonialsQuery.lte('created_at', endDate + 'T23:59:59')

  let cancellationsQuery = supabase.from('cancellations').select('id, cancelled_at')
  if (startDate) cancellationsQuery = cancellationsQuery.gte('cancelled_at', startDate)
  if (endDate) cancellationsQuery = cancellationsQuery.lte('cancelled_at', endDate)

  let engagementQuery = supabase.from('engagement_records').select('type, value, response_time_minutes, recorded_at')
  if (startDate) engagementQuery = engagementQuery.gte('recorded_at', startDate)
  if (endDate) engagementQuery = engagementQuery.lte('recorded_at', endDate)

  let callsQuery = supabase.from('call_records').select('call_type, duration_minutes, created_by, recorded_at')
  if (startDate) callsQuery = callsQuery.gte('recorded_at', startDate)
  if (endDate) callsQuery = callsQuery.lte('recorded_at', endDate)

  let indicationsQuery = supabase.from('indications').select('id, created_at')
  if (startDate) indicationsQuery = indicationsQuery.gte('created_at', startDate)
  if (endDate) indicationsQuery = indicationsQuery.lte('created_at', endDate + 'T23:59:59')

  const [
    { data: mentees },
    { data: revenues },
    { data: testimonials },
    { data: cancellations },
    { data: engagements },
    { data: calls },
    { data: indications },
  ] = await Promise.all([
    menteesQuery,
    revenueQuery,
    testimonialsQuery,
    cancellationsQuery,
    engagementQuery,
    callsQuery,
    indicationsQuery,
  ])

  // ─── Aggregate ───
  const totalMentees = mentees?.length ?? 0
  const fitMentees = mentees?.filter((m) => m.cliente_fit).length ?? 0

  // Priority distribution
  const priorityDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  mentees?.forEach((m) => {
    priorityDistribution[m.priority_level] = (priorityDistribution[m.priority_level] ?? 0) + 1
  })

  // Revenue
  const crossellTotal = revenues?.filter((r) => r.revenue_type === 'crossell').reduce((s, r) => s + Number(r.sale_value), 0) ?? 0
  const upsellTotal = revenues?.filter((r) => r.revenue_type === 'upsell').reduce((s, r) => s + Number(r.sale_value), 0) ?? 0
  const totalRevenue = crossellTotal + upsellTotal

  // Testimonials & cancellations
  const totalTestimonials = testimonials?.length ?? 0
  const totalCancellations = cancellations?.length ?? 0
  const totalIndications = indications?.length ?? 0

  // Engagement
  const engagementByType: Record<string, { count: number; total: number }> = {}
  let totalResponseTime = 0
  let responseTimeCount = 0
  engagements?.forEach((e) => {
    if (!engagementByType[e.type]) engagementByType[e.type] = { count: 0, total: 0 }
    engagementByType[e.type].count++
    engagementByType[e.type].total += Number(e.value)
    if (e.response_time_minutes) {
      totalResponseTime += e.response_time_minutes
      responseTimeCount++
    }
  })
  const avgResponseTime = responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0

  // Calls
  const ligacoes = calls?.filter((c) => c.call_type === 'ligacao') ?? []
  const whatsappCalls = calls?.filter((c) => c.call_type === 'whatsapp') ?? []
  const totalLigacoes = ligacoes.length
  const totalLigacaoDuration = ligacoes.reduce((s, c) => s + c.duration_minutes, 0)
  const totalWhatsapp = whatsappCalls.length
  const totalWhatsappDuration = whatsappCalls.reduce((s, c) => s + c.duration_minutes, 0)
  const avgWhatsappDuration = totalWhatsapp > 0 ? Math.round(totalWhatsappDuration / totalWhatsapp) : 0

  // WhatsApp by specialist
  const whatsappBySpecialist: Record<string, number> = {}
  whatsappCalls.forEach((c) => {
    if (c.created_by) {
      whatsappBySpecialist[c.created_by] = (whatsappBySpecialist[c.created_by] ?? 0) + 1
    }
  })

  return (
    <DashboardMetrics
      userName={profile?.full_name ?? ''}
      specialists={specialists ?? []}
      filters={{ specialistId, startDate, endDate, fitOnly }}
      totalMentees={totalMentees}
      fitMentees={fitMentees}
      priorityDistribution={priorityDistribution}
      totalRevenue={totalRevenue}
      crossellTotal={crossellTotal}
      upsellTotal={upsellTotal}
      totalTestimonials={totalTestimonials}
      totalCancellations={totalCancellations}
      totalIndications={totalIndications}
      engagementByType={engagementByType}
      avgResponseTime={avgResponseTime}
      totalLigacoes={totalLigacoes}
      totalLigacaoDuration={totalLigacaoDuration}
      totalWhatsapp={totalWhatsapp}
      totalWhatsappDuration={totalWhatsappDuration}
      avgWhatsappDuration={avgWhatsappDuration}
    />
  )
}
