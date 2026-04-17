import { createClient } from '@/lib/supabase/server'
import { DashboardMetrics } from '@/components/dashboard-metrics'
import { getCachedSpecialists } from '@/lib/cache'
import { isBusinessHours } from '@/lib/business-hours'

// Breakdown por pessoa na seção "Trabalho do CS" — 5 linhas fixas.
// Ordem e rótulos batem com o que o dashboard renderiza.
const CS_TEAM = [
  { key: 'carla', label: 'CS - Carla', match: 'carla' },
  { key: 'aline', label: 'CS - Aline', match: 'aline' },
  { key: 'hannah', label: 'Consultora Hannah', match: 'hannah' },
  { key: 'matheus', label: 'Consultor Matheus', match: 'matheus' },
  { key: 'keyth', label: 'Consultora Keyth', match: 'keyth' },
] as const
type CsKey = typeof CS_TEAM[number]['key']

interface Props {
  searchParams: {
    specialist?: string
    start?: string
    end?: string
    fit?: string
    fatInicialMin?: string
    fatInicialMax?: string
    fatAtualMin?: string
    fatAtualMax?: string
    funilOrigem?: string
    closer?: string
    mesAniversario?: string
    numColaboradores?: string
    estado?: string
    nicho?: string
    dataInicio?: string
    dataTermino?: string
  }
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Parallel: profile + specialists (cached) + system settings + CS team profiles
  const [{ data: profile }, specialists, { data: gapSetting }, { data: csTeamProfiles }] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user!.id).single(),
    getCachedSpecialists(),
    supabase.from('system_settings').select('value').eq('key', 'attendance_gap_minutes').single(),
    supabase.from('profiles').select('id, full_name'),
  ])

  // Resolve os 5 nomes fixos por primeiro-nome (case-insensitive, sem acento).
  // Roles variam (Carla é admin), então buscamos sem filtro de role.
  const csIdByKey = new Map<CsKey, string>()
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const person of CS_TEAM) {
    const found = (csTeamProfiles ?? []).find((p) => normalize(p.full_name).startsWith(person.match))
    if (found) csIdByKey.set(person.key, found.id)
  }

  const isAdmin = profile?.role === 'admin'
  const gapMs = (parseInt(gapSetting?.value ?? '120', 10)) * 60 * 1000

  // Filters
  const startDate = searchParams.start || null
  const endDate = searchParams.end || null
  const fitFilter = searchParams.fit || null
  const specialistId = searchParams.specialist || null

  // Advanced filters
  const fatInicialMin = searchParams.fatInicialMin || null
  const fatInicialMax = searchParams.fatInicialMax || null
  const fatAtualMin = searchParams.fatAtualMin || null
  const fatAtualMax = searchParams.fatAtualMax || null
  const funilOrigem = searchParams.funilOrigem || null
  const closer = searchParams.closer || null
  const mesAniversario = searchParams.mesAniversario || null
  const numColaboradores = searchParams.numColaboradores || null
  const estado = searchParams.estado || null
  const nicho = searchParams.nicho || null
  const dataInicio = searchParams.dataInicio || null
  const dataTermino = searchParams.dataTermino || null

  // ─── Mentees (only fields needed for dashboard) ───
  let menteesQuery = supabase.from('mentees').select('id, status, cliente_fit, priority_level, created_by, faturamento_atual, faturamento_antes_mentoria, funnel_origin, closer_name, birth_date, state, niche, start_date, end_date, product_name')
  // Specialists always see only their own mentees
  if (!isAdmin && user) {
    menteesQuery = menteesQuery.eq('created_by', user.id)
  } else if (specialistId) {
    menteesQuery = menteesQuery.eq('created_by', specialistId)
  }
  if (fitFilter === 'true') menteesQuery = menteesQuery.eq('cliente_fit', true)
  if (fitFilter === 'false') menteesQuery = menteesQuery.eq('cliente_fit', false)
  if (funilOrigem) menteesQuery = menteesQuery.eq('funnel_origin', funilOrigem)
  if (closer) menteesQuery = menteesQuery.eq('closer_name', closer)
  if (estado) menteesQuery = menteesQuery.eq('state', estado)
  if (nicho) menteesQuery = menteesQuery.eq('niche', nicho)
  // Period filter: match by month of the selected date
  if (dataInicio) {
    const d = new Date(dataInicio + 'T00:00:00Z')
    const startOfMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
    const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    const endStr = `${endOfMonth.getUTCFullYear()}-${String(endOfMonth.getUTCMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getUTCDate()).padStart(2, '0')}`
    menteesQuery = menteesQuery.gte('start_date', startOfMonth).lte('start_date', endStr)
  }
  if (dataTermino) {
    const d = new Date(dataTermino + 'T00:00:00Z')
    const startOfMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
    const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    const endStr = `${endOfMonth.getUTCFullYear()}-${String(endOfMonth.getUTCMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getUTCDate()).padStart(2, '0')}`
    menteesQuery = menteesQuery.gte('end_date', startOfMonth).lte('end_date', endStr)
  }

  // Fetch mentees + birthday mentees in parallel
  let birthdayQuery = supabase
    .from('mentees')
    .select('id, full_name, birth_date')
    .eq('status', 'ativo')
    .not('birth_date', 'is', null)
  if (!isAdmin && user) {
    birthdayQuery = birthdayQuery.eq('created_by', user.id)
  } else if (specialistId) {
    birthdayQuery = birthdayQuery.eq('created_by', specialistId)
  }

  const [{ data: mentees }, { data: birthdayMentees }] = await Promise.all([
    menteesQuery,
    birthdayQuery,
  ])

  let filteredMentees = mentees ?? []

  // Apply in-memory filters
  if (fatInicialMin) {
    const min = Number(fatInicialMin) / 100
    filteredMentees = filteredMentees.filter((m) => m.faturamento_antes_mentoria != null && Number(m.faturamento_antes_mentoria) >= min)
  }
  if (fatInicialMax) {
    const max = Number(fatInicialMax) / 100
    filteredMentees = filteredMentees.filter((m) => m.faturamento_antes_mentoria != null && Number(m.faturamento_antes_mentoria) <= max)
  }
  if (fatAtualMin) {
    const min = Number(fatAtualMin) / 100
    filteredMentees = filteredMentees.filter((m) => m.faturamento_atual != null && Number(m.faturamento_atual) >= min)
  }
  if (fatAtualMax) {
    const max = Number(fatAtualMax) / 100
    filteredMentees = filteredMentees.filter((m) => m.faturamento_atual != null && Number(m.faturamento_atual) <= max)
  }
  if (mesAniversario) {
    filteredMentees = filteredMentees.filter((m) => {
      if (!m.birth_date) return false
      const month = new Date(m.birth_date).getMonth() + 1
      return String(month) === mesAniversario
    })
  }

  // Num colaboradores filter (from action_plans)
  if (numColaboradores) {
    const menteeIdsForColab = filteredMentees.map((m) => m.id)
    if (menteeIdsForColab.length > 0) {
      const { data: actionPlans } = await supabase
        .from('action_plans')
        .select('mentee_id, data')
        .in('mentee_id', menteeIdsForColab)
        .not('data', 'is', null)
      const validIds = new Set<string>()
      actionPlans?.forEach((ap) => {
        const data = ap.data as Record<string, unknown> | null
        if (data?.num_colaboradores && String(data.num_colaboradores) === numColaboradores) {
          validIds.add(ap.mentee_id)
        }
      })
      filteredMentees = filteredMentees.filter((m) => validIds.has(m.id))
    }
  }

  const menteeIds = filteredMentees.map((m) => m.id)

  // Filter options
  const allMenteesForOptions = mentees ?? []
  const funisOrigemOptions = Array.from(new Set(allMenteesForOptions.map((m) => m.funnel_origin).filter(Boolean))) as string[]
  const closerOptions = Array.from(new Set(allMenteesForOptions.map((m) => m.closer_name).filter(Boolean))) as string[]
  const nichoOptions = Array.from(new Set(allMenteesForOptions.map((m) => m.niche).filter(Boolean))) as string[]
  const produtoOptions = Array.from(new Set(allMenteesForOptions.map((m) => m.product_name).filter(Boolean))) as string[]

  // Birthday list
  const today = new Date()
  const birthdayList: { id: string; full_name: string; daysUntil: number }[] = []
  birthdayMentees?.forEach((m) => {
    if (!m.birth_date) return
    const bd = new Date(m.birth_date)
    const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
    if (thisYear < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
      thisYear.setFullYear(today.getFullYear() + 1)
    }
    const diff = Math.floor((thisYear.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 3) {
      birthdayList.push({ id: m.id, full_name: m.full_name, daysUntil: diff })
    }
  })
  birthdayList.sort((a, b) => a.daysUntil - b.daysUntil)

  // ─── Build all data queries ───
  let revenueQuery = supabase.from('revenue_records').select('sale_value, revenue_type')
  if (startDate) revenueQuery = revenueQuery.gte('created_at', startDate)
  if (endDate) revenueQuery = revenueQuery.lte('created_at', endDate + 'T23:59:59')
  if (specialistId && menteeIds.length > 0) revenueQuery = revenueQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) revenueQuery = revenueQuery.eq('mentee_id', 'none')

  let testimonialsQuery = supabase.from('testimonials').select('id, mentee_id')
  if (startDate) testimonialsQuery = testimonialsQuery.gte('created_at', startDate)
  if (endDate) testimonialsQuery = testimonialsQuery.lte('created_at', endDate + 'T23:59:59')
  if (specialistId && menteeIds.length > 0) testimonialsQuery = testimonialsQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) testimonialsQuery = testimonialsQuery.eq('mentee_id', 'none')

  let indicationsQuery = supabase.from('indications').select('id', { count: 'exact', head: true })
  if (startDate) indicationsQuery = indicationsQuery.gte('created_at', startDate)
  if (endDate) indicationsQuery = indicationsQuery.lte('created_at', endDate + 'T23:59:59')
  if (specialistId && menteeIds.length > 0) indicationsQuery = indicationsQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) indicationsQuery = indicationsQuery.eq('mentee_id', 'none')

  let engagementQuery = supabase.from('engagement_records').select('type, value')
  if (startDate) engagementQuery = engagementQuery.gte('recorded_at', startDate)
  if (endDate) engagementQuery = engagementQuery.lte('recorded_at', endDate)
  if (specialistId && menteeIds.length > 0) engagementQuery = engagementQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) engagementQuery = engagementQuery.eq('mentee_id', 'none')

  let csQuery = supabase.from('cs_activities').select('type, duration_minutes')
  if (startDate) csQuery = csQuery.gte('activity_date', startDate)
  if (endDate) csQuery = csQuery.lte('activity_date', endDate)
  if (specialistId) csQuery = csQuery.eq('specialist_id', specialistId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stageChangesQuery = supabase.from('stage_changes' as never).select('mentee_id' as never) as any
  if (startDate) stageChangesQuery = stageChangesQuery.gte('changed_at', startDate)
  if (endDate) stageChangesQuery = stageChangesQuery.lte('changed_at', endDate + 'T23:59:59')
  if (specialistId && menteeIds.length > 0) stageChangesQuery = stageChangesQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) stageChangesQuery = stageChangesQuery.eq('mentee_id', 'none')

  // cancelled_at ainda não está no types gerado; casta para any para liberar o build.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deliveryEventsQuery = (supabase.from('delivery_events').select('id, delivery_type, delivery_date, cancelled_at' as never) as any).is('cancelled_at', null)
  if (startDate) deliveryEventsQuery = deliveryEventsQuery.gte('delivery_date', startDate)
  if (endDate) deliveryEventsQuery = deliveryEventsQuery.lte('delivery_date', endDate)

  let deliveryPartQuery = supabase.from('delivery_participations').select('delivery_event_id, mentee_id')
  if (specialistId && menteeIds.length > 0) deliveryPartQuery = deliveryPartQuery.in('mentee_id', menteeIds)
  else if (specialistId && menteeIds.length === 0) deliveryPartQuery = deliveryPartQuery.eq('mentee_id', 'none')

  let callsQuery = supabase.from('call_records').select('duration_seconds, specialist_id')
  if (startDate) callsQuery = callsQuery.gte('created_at', startDate)
  if (endDate) callsQuery = callsQuery.lte('created_at', endDate + 'T23:59:59')
  if (specialistId) callsQuery = callsQuery.eq('specialist_id', specialistId)

  // Attendance messages: filter by mentee_ids to avoid full table scan
  let attendanceMsgsQuery = supabase.from('wpp_messages').select('mentee_id, direction, sent_at').order('sent_at', { ascending: true })
  if (startDate) attendanceMsgsQuery = attendanceMsgsQuery.gte('sent_at', startDate)
  if (endDate) attendanceMsgsQuery = attendanceMsgsQuery.lte('sent_at', endDate + 'T23:59:59')
  if (specialistId) attendanceMsgsQuery = attendanceMsgsQuery.eq('specialist_id', specialistId)
  if (menteeIds.length > 0) attendanceMsgsQuery = attendanceMsgsQuery.in('mentee_id', menteeIds)

  let wppOutQuery = supabase.from('wpp_messages').select('id', { count: 'exact', head: true }).eq('direction', 'outgoing')
  if (startDate) wppOutQuery = wppOutQuery.gte('sent_at', startDate)
  if (endDate) wppOutQuery = wppOutQuery.lte('sent_at', endDate + 'T23:59:59')
  if (specialistId) wppOutQuery = wppOutQuery.eq('specialist_id', specialistId)

  let wppInQuery = supabase.from('wpp_messages').select('id', { count: 'exact', head: true }).eq('direction', 'incoming')
  if (startDate) wppInQuery = wppInQuery.gte('sent_at', startDate)
  if (endDate) wppInQuery = wppInQuery.lte('sent_at', endDate + 'T23:59:59')
  if (specialistId) wppInQuery = wppInQuery.eq('specialist_id', specialistId)

  let manualAttendanceQuery = supabase.from('attendance_sessions').select('started_at, ended_at, specialist_id').not('ended_at', 'is', null)
  if (startDate) manualAttendanceQuery = manualAttendanceQuery.gte('started_at', startDate)
  if (endDate) manualAttendanceQuery = manualAttendanceQuery.lte('started_at', endDate + 'T23:59:59')
  if (specialistId) manualAttendanceQuery = manualAttendanceQuery.eq('specialist_id', specialistId)

  // ─── Execute ALL data queries in parallel ───
  const [
    { data: revenues },
    { data: testimonials },
    { count: indicationCount },
    { data: engagements },
    { data: csActivities },
    { data: stageChanges },
    { data: callRecords },
    { count: wppOutCount },
    { count: wppInCount },
    { data: attendanceMsgs },
    { data: deliveryEvents },
    { data: deliveryParts },
    { data: manualSessions },
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
    deliveryEventsQuery,
    deliveryPartQuery,
    manualAttendanceQuery,
  ])

  // ─── Calculate attendance sessions (single pass) ───
  const ACTIVE_GAP_MS = 5 * 60 * 1000
  let totalAttendanceSessions = 0
  let totalAttendanceDurationMs = 0
  let sessionsInitiatedByMentee = 0
  let sessionsInitiatedByCS = 0
  let totalWaitMs = 0
  let waitCount = 0

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
        if (gap > gapMs) sessions.push([msgs[i]])
        else sessions[sessions.length - 1].push(msgs[i])
      }

      for (const session of sessions) {
        const hasOutgoing = session.some((m) => m.direction === 'outgoing')

        // Wait time: find first incoming→outgoing pair
        for (let i = 0; i < session.length; i++) {
          if (session[i].direction === 'incoming') {
            for (let j = i + 1; j < session.length; j++) {
              if (session[j].direction === 'outgoing') {
                totalWaitMs += new Date(session[j].sent_at).getTime() - new Date(session[i].sent_at).getTime()
                waitCount++
                break
              }
            }
          }
        }

        if (!hasOutgoing) continue

        totalAttendanceSessions++

        // Initiator
        if (session[0].direction === 'incoming') sessionsInitiatedByMentee++
        else sessionsInitiatedByCS++

        // Active duration
        for (let i = 1; i < session.length; i++) {
          const gap = new Date(session[i].sent_at).getTime() - new Date(session[i - 1].sent_at).getTime()
          if (gap <= ACTIVE_GAP_MS) totalAttendanceDurationMs += gap
        }
      }
    }
  }

  const totalAttendanceMinutes = Math.round(totalAttendanceDurationMs / 60000)
  const avgAttendanceMinutes = totalAttendanceSessions > 0
    ? Math.round(totalAttendanceMinutes / totalAttendanceSessions)
    : 0
  const avgWaitMinutes = waitCount > 0 ? Math.round(totalWaitMs / waitCount / 60000) : 0

  // Manual attendance
  let totalManualMinutes = 0
  const manualCount = manualSessions?.length ?? 0
  manualSessions?.forEach((s) => {
    if (s.started_at && s.ended_at) {
      totalManualMinutes += (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
    }
  })
  const avgManualAttendanceMinutes = manualCount > 0 ? Math.round(totalManualMinutes / manualCount) : 0

  // ─── Breakdown "Trabalho do CS" por pessoa ───
  // Mapa mentee_id → dono (created_by), usado para atribuir solicitações do mentorado
  // à CS responsável (Carla/Aline). Usa todos os mentorados do filtro atual.
  const menteeOwner = new Map<string, string | null>()
  for (const m of filteredMentees) menteeOwner.set(m.id, m.created_by ?? null)

  // Horário comercial: solicitação = msg incoming em horário comercial; tempo de
  // espera = intervalo até a primeira outgoing subsequente (mesmo que fora do
  // horário). Total considera todos os mentorados; por CS usa created_by.
  let bhTotalSolicitations = 0
  let bhTotalWaitMs = 0
  let bhTotalWaitCount = 0
  const bhByCs: Record<CsKey, { sols: number; waitMs: number; waitCount: number }> = {
    carla: { sols: 0, waitMs: 0, waitCount: 0 },
    aline: { sols: 0, waitMs: 0, waitCount: 0 },
    hannah: { sols: 0, waitMs: 0, waitCount: 0 },
    matheus: { sols: 0, waitMs: 0, waitCount: 0 },
    keyth: { sols: 0, waitMs: 0, waitCount: 0 },
  }
  const ownerToCsKey = new Map<string, CsKey>()
  for (const [key, id] of Array.from(csIdByKey.entries())) ownerToCsKey.set(id, key)

  if (attendanceMsgs && attendanceMsgs.length > 0) {
    const byMentee: Record<string, { sent_at: string; direction: string }[]> = {}
    for (const m of attendanceMsgs) {
      if (!byMentee[m.mentee_id]) byMentee[m.mentee_id] = []
      byMentee[m.mentee_id].push({ sent_at: m.sent_at, direction: m.direction })
    }
    for (const [menteeId, msgs] of Object.entries(byMentee)) {
      const ownerId = menteeOwner.get(menteeId) ?? null
      const csKey = ownerId ? ownerToCsKey.get(ownerId) : undefined
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].direction !== 'incoming') continue
        if (!isBusinessHours(msgs[i].sent_at)) continue
        bhTotalSolicitations++
        if (csKey) bhByCs[csKey].sols++
        for (let j = i + 1; j < msgs.length; j++) {
          if (msgs[j].direction === 'outgoing') {
            const wait = new Date(msgs[j].sent_at).getTime() - new Date(msgs[i].sent_at).getTime()
            bhTotalWaitMs += wait
            bhTotalWaitCount++
            if (csKey) {
              bhByCs[csKey].waitMs += wait
              bhByCs[csKey].waitCount++
            }
            break
          }
        }
      }
    }
  }

  const bhAvgWaitMinutes = bhTotalWaitCount > 0 ? Math.round(bhTotalWaitMs / bhTotalWaitCount / 60000) : 0
  const businessHoursByCs = CS_TEAM.map((p) => {
    const d = bhByCs[p.key]
    return {
      key: p.key,
      label: p.label,
      solicitations: d.sols,
      avgWaitMinutes: d.waitCount > 0 ? Math.round(d.waitMs / d.waitCount / 60000) : 0,
    }
  })

  // Atendimentos por pessoa: sessões manuais finalizadas (attendance_sessions)
  // agrupadas por specialist_id, SEM filtro de horário comercial.
  const attByPerson: Record<CsKey, { count: number; totalMin: number }> = {
    carla: { count: 0, totalMin: 0 },
    aline: { count: 0, totalMin: 0 },
    hannah: { count: 0, totalMin: 0 },
    matheus: { count: 0, totalMin: 0 },
    keyth: { count: 0, totalMin: 0 },
  }
  const specIdToCsKey = new Map<string, CsKey>()
  for (const [key, id] of Array.from(csIdByKey.entries())) specIdToCsKey.set(id, key)
  manualSessions?.forEach((s) => {
    if (!s.started_at || !s.ended_at || !s.specialist_id) return
    const key = specIdToCsKey.get(s.specialist_id)
    if (!key) return
    attByPerson[key].count++
    attByPerson[key].totalMin += (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
  })
  const attendanceByPerson = CS_TEAM.map((p) => {
    const d = attByPerson[p.key]
    return {
      key: p.key,
      label: p.label,
      count: d.count,
      avgMinutes: d.count > 0 ? Math.round(d.totalMin / d.count) : 0,
    }
  })

  // Ligações por pessoa: call_records agrupadas por specialist_id.
  const callsByPersonMap: Record<CsKey, { count: number; totalSec: number }> = {
    carla: { count: 0, totalSec: 0 },
    aline: { count: 0, totalSec: 0 },
    hannah: { count: 0, totalSec: 0 },
    matheus: { count: 0, totalSec: 0 },
    keyth: { count: 0, totalSec: 0 },
  }
  callRecords?.forEach((c) => {
    const rec = c as { duration_seconds: number | null; specialist_id: string | null }
    const dur = Number(rec.duration_seconds ?? 0)
    if (dur <= 0 || !rec.specialist_id) return
    const key = specIdToCsKey.get(rec.specialist_id)
    if (!key) return
    callsByPersonMap[key].count++
    callsByPersonMap[key].totalSec += dur
  })
  const callsByPerson = CS_TEAM.map((p) => {
    const d = callsByPersonMap[p.key]
    return {
      key: p.key,
      label: p.label,
      count: d.count,
      avgSeconds: d.count > 0 ? Math.round(d.totalSec / d.count) : 0,
    }
  })

  // ─── SEÇÃO 2: Visão Geral ───
  const allMentees = filteredMentees
  const activeMentees = allMentees.filter((m) => m.status === 'ativo')
  const totalMentees = activeMentees.length
  const fitMentees = activeMentees.filter((m) => m.cliente_fit).length
  const totalIndications = indicationCount ?? 0

  // Revenue growth
  const menteesWithFat = activeMentees.filter((m) => m.faturamento_atual != null && m.faturamento_antes_mentoria != null && Number(m.faturamento_antes_mentoria) > 0)
  const sumFatAtual = menteesWithFat.reduce((s, m) => s + Number(m.faturamento_atual), 0)
  const sumFatAntes = menteesWithFat.reduce((s, m) => s + Number(m.faturamento_antes_mentoria), 0)
  const growthPct = sumFatAntes > 0 ? Math.round(((sumFatAtual - sumFatAntes) / sumFatAntes) * 100) : 0
  const growthCount = menteesWithFat.filter((m) => Number(m.faturamento_atual) > Number(m.faturamento_antes_mentoria)).length

  const totalFaturamentoAtual = activeMentees.reduce((s, m) => s + (m.faturamento_atual != null ? Number(m.faturamento_atual) : 0), 0)

  // ─── SEÇÃO 3: Sucesso ───
  const engByType: Record<string, number> = { aula: 0, live: 0, evento: 0, whatsapp_contato: 0 }
  engagements?.forEach((e) => { engByType[e.type] = (engByType[e.type] ?? 0) + Number(e.value) })

  const totalTestimonials = testimonials?.length ?? 0
  const menteesWithTestimonial = new Set(testimonials?.map((t) => t.mentee_id) ?? []).size
  const menteesAdvanced = new Set(((stageChanges as { mentee_id: string }[] | null) ?? []).map((s) => s.mentee_id)).size

  // ─── Engajamento: delivery stats ───
  // Engajamento: delivery stats. deliveryEvents é `any[]` por causa do cast
  // do select (cancelled_at fora do types). Tipa localmente para o uso abaixo.
  type DeliveryEventRow = { id: string; delivery_type: string; delivery_date: string; cancelled_at: string | null }
  const deliveryEventsTyped = (deliveryEvents ?? []) as DeliveryEventRow[]
  const deliveryTypeKeys = ['hotseat', 'comercial', 'gestao', 'mkt', 'extras', 'mentoria_individual']
  const deliveryEventIds = new Set(deliveryEventsTyped.map((e) => e.id))
  const filteredParts = (deliveryParts ?? []).filter((p) => deliveryEventIds.has(p.delivery_event_id))

  const deliveryStats: Record<string, { delivered: number; participated: number }> = {}
  for (const key of deliveryTypeKeys) {
    const eventsOfType = deliveryEventsTyped.filter((e) => e.delivery_type === key)
    const eventIdsOfType = new Set(eventsOfType.map((e) => e.id))
    const partsOfType = filteredParts.filter((p) => eventIdsOfType.has(p.delivery_event_id))
    deliveryStats[key] = { delivered: eventsOfType.length, participated: partsOfType.length }
  }

  // ─── SEÇÃO 4: Trabalho CS ───
  const allCs = csActivities ?? []
  const ligacoesManuais = allCs.filter((c) => c.type === 'ligacao')
  const whatsappsManuais = allCs.filter((c) => c.type === 'whatsapp')

  const allCalls = (callRecords ?? []).filter((c) => Number(c.duration_seconds ?? 0) > 0)
  const totalCalls = allCalls.length
  const totalCallDuration = allCalls.reduce((s, c) => s + Number(c.duration_seconds ?? 0), 0)
  const totalCallMinutes = Math.round(totalCallDuration / 60)

  const totalWppOut = (wppOutCount as number) ?? 0
  const totalWppIn = (wppInCount as number) ?? 0

  const totalLigacoes = totalCalls > 0 ? totalCalls : ligacoesManuais.length
  const totalLigacaoDuration = totalCalls > 0 ? totalCallMinutes : ligacoesManuais.reduce((s, c) => s + Number(c.duration_minutes), 0)
  const totalWhatsapp = totalWppOut > 0 ? totalWppOut : whatsappsManuais.length
  const totalWhatsappIn = totalWppIn

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
      specialists={specialists}
      isAdmin={isAdmin}
      filters={{ specialistId, startDate, endDate, fitFilter }}
      advancedFilters={{
        fatInicialMin: searchParams.fatInicialMin ?? '',
        fatInicialMax: searchParams.fatInicialMax ?? '',
        fatAtualMin: searchParams.fatAtualMin ?? '',
        fatAtualMax: searchParams.fatAtualMax ?? '',
        funilOrigem: searchParams.funilOrigem ?? '',
        closer: searchParams.closer ?? '',
        especialista: '',
        produto: '',
        mesAniversario: searchParams.mesAniversario ?? '',
        numColaboradores: searchParams.numColaboradores ?? '',
        estado: searchParams.estado ?? '',
        nicho: searchParams.nicho ?? '',
        dataInicio: searchParams.dataInicio ?? '',
        dataTermino: searchParams.dataTermino ?? '',
      }}
      filterOptions={{ funisOrigem: funisOrigemOptions.sort(), closers: closerOptions.sort(), nichos: nichoOptions.sort(), produtos: produtoOptions.sort() }}
      section2={{ totalMentees, fitMentees, totalIndications }}
      section3={{
        totalFaturamentoAtual,
        totalTestimonials,
        menteesWithTestimonial,
        menteesAdvanced,
        growthPct,
        growthCount,
        growthTotal: menteesWithFat.length,
        totalMentees,
      }}
      engajamento={{
        deliveryStats,
        eventos: deliveryEventsTyped.filter((e) => e.delivery_type === 'evento').length,
        intensivo: deliveryEventsTyped.filter((e) => e.delivery_type === 'intensivo').length,
        encontro: deliveryEventsTyped.filter((e) => e.delivery_type === 'encontro_premium').length,
      }}
      section4={{
        totalAtendimentos: totalAttendanceSessions,
        atendimentosMentee: sessionsInitiatedByMentee,
        atendimentosCS: sessionsInitiatedByCS,
        avgWaitMinutes,
        avgManualAttendanceMinutes,
        totalAttendanceMinutes,
        avgAttendanceMinutes,
        totalLigacoes,
        totalLigacaoDuration,
        totalWhatsapp,
        totalWhatsappIn,
        businessHours: {
          totalSolicitations: bhTotalSolicitations,
          avgWaitMinutes: bhAvgWaitMinutes,
          byCs: businessHoursByCs,
        },
        attendanceByPerson,
        callsByPerson,
      }}
      section5={{
        crossell: revByType.crossell,
        upsell: revByType.upsell,
        indicacao_perpetuo: revByType.indicacao_perpetuo,
        indicacao_intensivo: revByType.indicacao_intensivo,
        total: Object.values(revByType).reduce((s, v) => s + v, 0),
      }}
      birthdayMentees={birthdayList}
    />
  )
}
