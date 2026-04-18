import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { MENTEE_SUMMARY_FIELDS, type MenteeWithStats } from '@/types/kanban'
import { getCachedStages, getCachedAllStages } from '@/lib/cache'

export default async function EtapasMentoriaPage() {
  const supabase = createClient()

  // Get current user first to determine role
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'especialista'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    userRole = profile?.role ?? 'especialista'
  }

  // Build mentees query — specialists only see their own mentees
  let menteesQuery = supabase.from('mentees').select(MENTEE_SUMMARY_FIELDS).eq('kanban_type', 'mentorship')
  if (userRole !== 'admin' && user) {
    menteesQuery = menteesQuery.eq('created_by', user.id)
  }

  // Get stages + mentees in parallel
  const [allStages, stages, menteesResult] = await Promise.all([
    getCachedAllStages(),
    getCachedStages('mentorship'),
    menteesQuery,
  ])

  const firstStageId = stages.length > 0 ? stages[0].id : null
  const validMentorshipStageIds = new Set(allStages.filter((s) => s.type === 'mentorship').map((s) => s.id))
  const menteeList = menteesResult.data ?? []

  // Auto-repair: fix mentees whose stage doesn't match their kanban type
  if (firstStageId) {
    const orphans = menteeList.filter(
      (m) => !m.current_stage_id || !validMentorshipStageIds.has(m.current_stage_id)
    )
    if (orphans.length > 0) {
      await supabase
        .from('mentees')
        .update({ current_stage_id: firstStageId })
        .in('id', orphans.map((m) => m.id))
      orphans.forEach((m) => { m.current_stage_id = firstStageId })
    }
  }

  const menteeIds = menteeList.map((m) => m.id)

  // Fetch stats in parallel (specialists from cache helper)
  const [
    { data: attendances },
    { data: indications },
    { data: revenues },
    { data: activeSessions },
    { data: lastMessages },
    { data: allProfilesData },
    { data: deptAssignmentsData },
    { data: stageChangesData },
  ] = await Promise.all([
    menteeIds.length > 0
      ? supabase.from('attendances').select('mentee_id').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string }[] }),
    menteeIds.length > 0
      ? supabase.from('indications').select('mentee_id').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string; sale_value: number }[] }),
    menteeIds.length > 0
      ? supabase.from('revenue_records').select('mentee_id, sale_value').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string; sale_value: number }[] }),
    menteeIds.length > 0
      ? supabase.from('attendance_sessions').select('mentee_id, channel, specialist_id, started_at').in('mentee_id', menteeIds).is('ended_at', null)
      : Promise.resolve({ data: [] as { mentee_id: string; channel: string; specialist_id: string; started_at: string }[] }),
    menteeIds.length > 0
      ? supabase.from('wpp_messages').select('mentee_id, sent_at').in('mentee_id', menteeIds).order('sent_at', { ascending: false })
      : Promise.resolve({ data: [] as { mentee_id: string; sent_at: string }[] }),
    supabase.from('profiles').select('id, full_name, role').order('full_name'),
    supabase.from('department_assignments').select('user_id, department'),
    menteeIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (supabase.from('stage_changes' as never).select('mentee_id, to_stage_id, changed_at' as never) as any).in('mentee_id', menteeIds).order('changed_at', { ascending: false })
      : Promise.resolve({ data: [] as { mentee_id: string; to_stage_id: string; changed_at: string }[] }),
  ])

  const allProfiles = (allProfilesData ?? []) as { id: string; full_name: string; role: string }[]
  const deptAssignments = (deptAssignmentsData ?? []) as { user_id: string; department: string }[]

  const attendanceMap = new Map<string, number>()
  attendances?.forEach((a) => {
    attendanceMap.set(a.mentee_id, (attendanceMap.get(a.mentee_id) ?? 0) + 1)
  })

  const indicationMap = new Map<string, number>()
  indications?.forEach((i) => {
    indicationMap.set(i.mentee_id, (indicationMap.get(i.mentee_id) ?? 0) + 1)
  })

  const revenueMap = new Map<string, number>()
  revenues?.forEach((r) => {
    revenueMap.set(r.mentee_id, (revenueMap.get(r.mentee_id) ?? 0) + Number(r.sale_value))
  })

  // Build map: menteeId → [{ channel, specialist_name, specialist_id }, ...] from active sessions.
  // The "attendant" shown/filtered is derived from the channel, NOT from who clicked Iniciar:
  //   - Principal → owner of the mentee (mentee.created_by)
  //   - Comercial/Marketing/Gestão → user assigned to that department
  // This way any operator (admin, Kennedy, etc.) can click Iniciar, but the card/filter
  // always shows Carla/Aline/Hannah/Matheus/Keyth as appropriate.
  const profileNameMap = new Map(allProfiles.map((p) => [p.id, p.full_name]))
  const deptUserByChannel = new Map<string, string>()
  deptAssignments.forEach((d) => {
    if (!deptUserByChannel.has(d.department)) deptUserByChannel.set(d.department, d.user_id)
  })
  const menteeOwnerMap = new Map<string, string | null>(menteeList.map((m) => [m.id, m.created_by]))
  const activeSessionsMap = new Map<string, Array<{ channel: string; specialist_name: string; specialist_id?: string; started_at?: string }>>()
  const activeSessionsArr = (activeSessions ?? []) as unknown as Array<{ mentee_id: string; channel?: string; specialist_id?: string; started_at?: string }>
  activeSessionsArr.forEach((s) => {
    const channel = s.channel || 'principal'
    const attendantId = channel === 'principal'
      ? menteeOwnerMap.get(s.mentee_id) ?? undefined
      : deptUserByChannel.get(channel)
    const name = attendantId ? profileNameMap.get(attendantId) ?? 'Responsável' : 'Responsável'
    const arr = activeSessionsMap.get(s.mentee_id) ?? []
    arr.push({ channel, specialist_name: name, specialist_id: attendantId, started_at: s.started_at })
    activeSessionsMap.set(s.mentee_id, arr)
  })

  const lastContactMap = new Map<string, string>()
  lastMessages?.forEach((m) => {
    if (!lastContactMap.has(m.mentee_id)) lastContactMap.set(m.mentee_id, m.sent_at)
  })
  const now = Date.now()

  // Última entrada na etapa atual (stage_changes ordenado desc). Fallback: created_at.
  const stageEnteredMap = new Map<string, string>()
  const stageChanges = (stageChangesData ?? []) as { mentee_id: string; to_stage_id: string; changed_at: string }[]
  for (const sc of stageChanges) {
    if (stageEnteredMap.has(sc.mentee_id)) continue
    const mentee = menteeList.find((m) => m.id === sc.mentee_id)
    if (mentee && mentee.current_stage_id && sc.to_stage_id === mentee.current_stage_id) {
      stageEnteredMap.set(sc.mentee_id, sc.changed_at)
    }
  }

  // metrics_source_updated_at — coluna 00084, ainda não nos types gerados.
  const metricsFreshnessMap = new Map<string, string | null>()
  if (menteeIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: freshness } = await (supabase.from('mentees').select('id, metrics_source_updated_at' as never) as any)
      .in('id', menteeIds) as { data: Array<{ id: string; metrics_source_updated_at: string | null }> | null }
    freshness?.forEach((r) => metricsFreshnessMap.set(r.id, r.metrics_source_updated_at))
  }

  const menteesWithStats: MenteeWithStats[] = menteeList.map((m) => {
    const lastContact = lastContactMap.get(m.id)
    const daysSince = lastContact ? Math.floor((now - new Date(lastContact).getTime()) / 86400000) : undefined
    const sessions = activeSessionsMap.get(m.id)
    return {
      ...m,
      attendance_count: attendanceMap.get(m.id) ?? 0,
      indication_count: indicationMap.get(m.id) ?? 0,
      revenue_total: revenueMap.get(m.id) ?? 0,
      has_active_session: !!sessions?.length,
      active_sessions: sessions,
      days_since_contact: daysSince,
      stage_entered_at: stageEnteredMap.get(m.id) ?? m.created_at,
      metrics_source_updated_at: metricsFreshnessMap.get(m.id) ?? null,
    }
  })

  const funisOrigem = Array.from(new Set(menteeList.map((m) => m.funnel_origin).filter(Boolean))) as string[]
  const closers = Array.from(new Set(menteeList.map((m) => m.closer_name).filter(Boolean))) as string[]
  const nichos = Array.from(new Set(menteeList.map((m) => m.niche).filter(Boolean))) as string[]
  const produtos = Array.from(new Set(menteeList.map((m) => m.product_name).filter(Boolean))) as string[]
  const especialistas = allProfiles.filter((s) => s.role === 'especialista')

  // Attendant options for "Em atendimento" filter:
  // anyone who can attend a channel = specialists (Principal) + users assigned to a department (Comercial/Marketing/Gestão)
  const DEPT_LABEL: Record<string, string> = { comercial: 'Comercial', marketing: 'Marketing', gestao: 'Gestão' }
  const attendantIds = new Set<string>()
  // Any profile that OWNS at least one mentee is a "Principal" attendant,
  // regardless of role. Carla may be role='admin' but still owns mentees —
  // she must appear in the attendant filter.
  menteeList.forEach((m) => { if (m.created_by) attendantIds.add(m.created_by) })
  // Also include role='especialista' profiles even if they have no mentees yet
  especialistas.forEach((s) => attendantIds.add(s.id))
  // And dept-assigned users for non-Principal channels
  deptAssignments.forEach((d) => attendantIds.add(d.user_id))
  const userDepts = new Map<string, string[]>()
  deptAssignments.forEach((d) => {
    const arr = userDepts.get(d.user_id) ?? []
    arr.push(DEPT_LABEL[d.department] ?? d.department)
    userDepts.set(d.user_id, arr)
  })
  const ownerIds = new Set<string>()
  menteeList.forEach((m) => { if (m.created_by) ownerIds.add(m.created_by) })
  const attendants = Array.from(attendantIds)
    .map((id) => {
      const profile = allProfiles.find((p) => p.id === id)
      if (!profile) return null
      const channels: string[] = []
      // "Principal" applies to anyone who owns at least one mentee OR has the especialista role
      if (profile.role === 'especialista' || ownerIds.has(id)) channels.push('Principal')
      const depts = userDepts.get(id) ?? []
      channels.push(...depts)
      return { id, full_name: profile.full_name, channels }
    })
    .filter((a): a is { id: string; full_name: string; channels: string[] } => !!a)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <KanbanBoard
      title="Etapas Mentoria"
      kanbanType="mentorship"
      stages={stages}
      initialMentees={menteesWithStats}
      existingMentees={menteeList.map((m) => ({ id: m.id, full_name: m.full_name }))}
      isAdmin={userRole === 'admin'}
      specialists={allProfiles}
      attendants={attendants}
      filterOptions={{ funisOrigem: funisOrigem.sort(), closers: closers.sort(), nichos: nichos.sort(), produtos: produtos.sort(), especialistas }}
    />
  )
}
