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
    .select('full_name, role')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Specialists for filter (admin only)
  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'especialista')
    .order('full_name')

  // Filters
  const startDate = searchParams.start || null
  const endDate = searchParams.end || null
  const fitFilter = searchParams.fit || null
  // Specialist: admin can pick from URL, specialist always uses own ID
  const specialistId = isAdmin ? (searchParams.specialist || null) : user!.id

  // ─── Mentees (only fields needed for dashboard) ───
  let menteesQuery = supabase.from('mentees').select('id, status, cliente_fit, priority_level, created_by, faturamento_atual, faturamento_antes_mentoria')
  if (fitFilter === 'true') menteesQuery = menteesQuery.eq('cliente_fit', true)
  if (fitFilter === 'false') menteesQuery = menteesQuery.eq('cliente_fit', false)
  if (specialistId) menteesQuery = menteesQuery.eq('created_by', specialistId)

  // Get mentee IDs for filtering related tables
  const { data: mentees } = await menteesQuery
  const menteeIds = (mentees ?? []).map((m) => m.id)

  // ─── Revenue (only needed fields) ───
  let revenueQuery = supabase.from('revenue_records').select('sale_value, revenue_type')
  if (startDate) revenueQuery = revenueQuery.gte('created_at', startDate)
  if (endDate) revenueQuery = revenueQuery.lte('created_at', endDate + 'T23:59:59')
  if (specialistId && menteeIds.length > 0) revenueQuery = revenueQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) revenueQuery = revenueQuery.eq('mentee_id', 'none')

  // ─── Testimonials (count only) ───
  let testimonialsQuery = supabase.from('testimonials').select('id', { count: 'exact', head: true })
  if (startDate) testimonialsQuery = testimonialsQuery.gte('created_at', startDate)
  if (endDate) testimonialsQuery = testimonialsQuery.lte('created_at', endDate + 'T23:59:59')
  if (specialistId && menteeIds.length > 0) testimonialsQuery = testimonialsQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) testimonialsQuery = testimonialsQuery.eq('mentee_id', 'none')

  // ─── Indications (count only) ───
  let indicationsQuery = supabase.from('indications').select('id', { count: 'exact', head: true })
  if (startDate) indicationsQuery = indicationsQuery.gte('created_at', startDate)
  if (endDate) indicationsQuery = indicationsQuery.lte('created_at', endDate + 'T23:59:59')
  if (specialistId && menteeIds.length > 0) indicationsQuery = indicationsQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) indicationsQuery = indicationsQuery.eq('mentee_id', 'none')

  // ─── Engagement (only needed fields) ───
  let engagementQuery = supabase.from('engagement_records').select('type, value')
  if (startDate) engagementQuery = engagementQuery.gte('recorded_at', startDate)
  if (endDate) engagementQuery = engagementQuery.lte('recorded_at', endDate)
  if (specialistId && menteeIds.length > 0) engagementQuery = engagementQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) engagementQuery = engagementQuery.eq('mentee_id', 'none')

  // ─── CS Activities (only needed fields) ───
  let csQuery = supabase.from('cs_activities').select('type, duration_minutes')
  if (startDate) csQuery = csQuery.gte('activity_date', startDate)
  if (endDate) csQuery = csQuery.lte('activity_date', endDate)
  if (specialistId) csQuery = csQuery.eq('specialist_id', specialistId)

  // ─── Stage Changes (count for dashboard) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stageChangesQuery = supabase.from('stage_changes' as never).select('id' as never, { count: 'exact', head: true } as never) as any
  if (startDate) stageChangesQuery = stageChangesQuery.gte('changed_at', startDate)
  if (endDate) stageChangesQuery = stageChangesQuery.lte('changed_at', endDate + 'T23:59:59')
  if (specialistId && menteeIds.length > 0) stageChangesQuery = stageChangesQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) stageChangesQuery = stageChangesQuery.eq('mentee_id', 'none')

  // ─── Call Records (count + total duration) ───
  let callsQuery = supabase.from('call_records').select('duration_seconds')
  if (startDate) callsQuery = callsQuery.gte('created_at', startDate)
  if (endDate) callsQuery = callsQuery.lte('created_at', endDate + 'T23:59:59')
  if (specialistId) callsQuery = callsQuery.eq('specialist_id', specialistId)

  // ─── Attendance gap setting ───
  const { data: gapSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'attendance_gap_minutes')
    .single()
  const gapMs = (parseInt(gapSetting?.value ?? '120', 10)) * 60 * 1000

  // ─── Attendance sessions (from wpp_messages timestamps) ───
  let attendanceMsgsQuery = supabase.from('wpp_messages').select('mentee_id, direction, sent_at').order('sent_at', { ascending: true })
  if (startDate) attendanceMsgsQuery = attendanceMsgsQuery.gte('sent_at', startDate)
  if (endDate) attendanceMsgsQuery = attendanceMsgsQuery.lte('sent_at', endDate + 'T23:59:59')
  if (specialistId) attendanceMsgsQuery = attendanceMsgsQuery.eq('specialist_id', specialistId)

  // ─── WhatsApp Messages (count by direction) ───
  let wppOutQuery = supabase.from('wpp_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outgoing')
  if (startDate) wppOutQuery = wppOutQuery.gte('sent_at', startDate)
  if (endDate) wppOutQuery = wppOutQuery.lte('sent_at', endDate + 'T23:59:59')
  if (specialistId) wppOutQuery = wppOutQuery.eq('specialist_id', specialistId)

  let wppInQuery = supabase.from('wpp_messages').select('id', { count: 'exact', head: true }).eq('direction', 'incoming')
  if (startDate) wppInQuery = wppInQuery.gte('sent_at', startDate)
  if (endDate) wppInQuery = wppInQuery.lte('sent_at', endDate + 'T23:59:59')
  if (specialistId) wppInQuery = wppInQuery.eq('specialist_id', specialistId)

  const [
    { data: revenues },
    { count: testimonialCount },
    { count: indicationCount },
    { data: engagements },
    { data: csActivities },
    { count: stageChangeCount },
    { data: callRecords },
    { count: wppOutCount },
    { count: wppInCount },
    { data: attendanceMsgs },
  ] = await Promise.all([
    revenueQuery,
    testimonialsQuery,
    indicationsQuery,
    engagementQuery,
    csQuery,
    stageChangesQuery,
    callsQuery,
    wppOutQuery,
    wppInQuery,
    attendanceMsgsQuery,
  ])

  // ─── Calculate attendance sessions + active duration ───
  // Session = group of msgs with gap < threshold, ONLY counted if CS sent at least 1 msg
  // Duration = sum of gaps <5min between consecutive msgs (ignores wait time)
  const ACTIVE_GAP_MS = 5 * 60 * 1000 // 5 min — gaps larger than this are "waiting", not "working"
  let totalAttendanceSessions = 0
  let totalAttendanceDurationMs = 0
  if (attendanceMsgs && attendanceMsgs.length > 0) {
    const byMentee: Record<string, { sent_at: string; direction: string }[]> = {}
    for (const m of attendanceMsgs) {
      if (!byMentee[m.mentee_id]) byMentee[m.mentee_id] = []
      byMentee[m.mentee_id].push({ sent_at: m.sent_at, direction: m.direction })
    }
    for (const msgs of Object.values(byMentee)) {
      // Split into sessions
      const sessions: typeof msgs[] = [[msgs[0]]]
      for (let i = 1; i < msgs.length; i++) {
        const gap = new Date(msgs[i].sent_at).getTime() - new Date(msgs[i - 1].sent_at).getTime()
        if (gap > gapMs) {
          sessions.push([msgs[i]])
        } else {
          sessions[sessions.length - 1].push(msgs[i])
        }
      }

      for (const session of sessions) {
        // Only count session if CS participated (at least 1 outgoing msg)
        const hasOutgoing = session.some((m) => m.direction === 'outgoing')
        if (!hasOutgoing) continue

        totalAttendanceSessions++

        // Calculate active duration: sum gaps <5min between consecutive msgs
        for (let i = 1; i < session.length; i++) {
          const gap = new Date(session[i].sent_at).getTime() - new Date(session[i - 1].sent_at).getTime()
          if (gap <= ACTIVE_GAP_MS) {
            totalAttendanceDurationMs += gap
          }
        }
      }
    }
  }
  const totalAttendanceMinutes = Math.round(totalAttendanceDurationMs / 60000)
  const avgAttendanceMinutes = totalAttendanceSessions > 0
    ? Math.round(totalAttendanceMinutes / totalAttendanceSessions)
    : 0

  // ─── SEÇÃO 2: Visão Geral ───
  const allMentees = mentees ?? []
  const totalMentees = allMentees.filter((m) => m.status === 'ativo').length
  const fitMentees = allMentees.filter((m) => m.cliente_fit && m.status === 'ativo').length
  const cancelados = allMentees.filter((m) => m.status === 'cancelado').length
  const totalIndications = indicationCount ?? 0

  // ─── Revenue growth (faturamento antes vs atual) ───
  const menteesWithFat = allMentees.filter((m) => m.faturamento_atual != null && m.faturamento_antes_mentoria != null && Number(m.faturamento_antes_mentoria) > 0)
  const growthCount = menteesWithFat.filter((m) => Number(m.faturamento_atual) > Number(m.faturamento_antes_mentoria)).length
  const avgGrowth = menteesWithFat.length > 0
    ? Math.round(menteesWithFat.reduce((s, m) => s + ((Number(m.faturamento_atual) - Number(m.faturamento_antes_mentoria)) / Number(m.faturamento_antes_mentoria)) * 100, 0) / menteesWithFat.length)
    : 0

  // ─── SEÇÃO 3: Sucesso ───
  const totalRevenue = revenues?.reduce((s, r) => s + Number(r.sale_value), 0) ?? 0

  // Engagement by type
  const engByType: Record<string, number> = { aula: 0, live: 0, evento: 0, whatsapp_contato: 0 }
  engagements?.forEach((e) => { engByType[e.type] = (engByType[e.type] ?? 0) + Number(e.value) })

  const totalTestimonials = testimonialCount ?? 0

  // ─── SEÇÃO 3b: Stage changes ───
  const totalStageChanges = (stageChangeCount as number) ?? 0

  // ─── SEÇÃO 4: Trabalho CS (automático + manual) ───
  // Manual CS activities
  const allCs = csActivities ?? []
  const ligacoesManuais = allCs.filter((c) => c.type === 'ligacao')
  const whatsappsManuais = allCs.filter((c) => c.type === 'whatsapp')

  // Automático: call_records (only answered calls with duration > 0)
  const allCalls = (callRecords ?? []).filter((c) => Number(c.duration_seconds ?? 0) > 0)
  const totalCalls = allCalls.length
  const totalCallDuration = allCalls.reduce((s, c) => s + Number(c.duration_seconds ?? 0), 0)
  const totalCallMinutes = Math.round(totalCallDuration / 60)

  const totalWppOut = (wppOutCount as number) ?? 0
  const totalWppIn = (wppInCount as number) ?? 0

  // Combinado: automático tem prioridade, fallback para manual
  const totalLigacoes = totalCalls > 0 ? totalCalls : ligacoesManuais.length
  const totalLigacaoDuration = totalCalls > 0 ? totalCallMinutes : ligacoesManuais.reduce((s, c) => s + Number(c.duration_minutes), 0)
  const totalWhatsapp = totalWppOut > 0 ? totalWppOut : whatsappsManuais.length
  const totalWhatsappIn = totalWppIn
  const avgWhatsappDuration = whatsappsManuais.length > 0
    ? Math.round(whatsappsManuais.reduce((s, c) => s + Number(c.duration_minutes), 0) / whatsappsManuais.length)
    : 0

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
      isAdmin={isAdmin}
      filters={{ specialistId, startDate, endDate, fitFilter }}
      section2={{
        totalMentees,
        fitMentees,
        totalIndications,
        cancelados,
      }}
      section3={{
        totalRevenue,
        engByType,
        totalTestimonials,
        cancelados,
        totalStageChanges,
        avgGrowth,
        growthCount,
        growthTotal: menteesWithFat.length,
      }}
      section4={{
        totalLigacoes,
        totalLigacaoDuration,
        totalWhatsapp,
        totalWhatsappIn,
        avgWhatsappDuration,
        totalAtendimentos: totalAttendanceSessions,
        totalAttendanceMinutes,
        avgAttendanceMinutes,
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
