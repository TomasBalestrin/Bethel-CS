import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { MENTEE_SUMMARY_FIELDS, type MenteeWithStats } from '@/types/kanban'
import { getCachedSpecialists, getCachedStages, getCachedAllStages } from '@/lib/cache'

export default async function EtapasIniciaisPage() {
  const supabase = createClient()

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'especialista'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    userRole = profile?.role ?? 'especialista'
  }
  console.log('[EtapasIniciais] user:', user?.id, 'role:', userRole)

  // Fetch stages (cached) + mentees in parallel
  const [allStages, initialStages, menteesResult] = await Promise.all([
    getCachedAllStages(),
    getCachedStages('initial'),
    (() => {
      let q = supabase
        .from('mentees')
        .select(MENTEE_SUMMARY_FIELDS)
        .eq('kanban_type', 'initial')
      if (userRole !== 'admin' && user) {
        q = q.eq('created_by', user.id)
      }
      return q
    })(),
  ])

  const stages = initialStages
  const firstStageId = stages.length > 0 ? stages[0].id : null
  const validStageIds = new Set(allStages.map((s) => s.id))
  const menteeList = menteesResult.data ?? []
  console.log('[EtapasIniciais] mentees fetched:', menteeList.length, 'error:', menteesResult.error?.message)

  // Auto-repair: fix mentees with null or invalid current_stage_id
  if (firstStageId) {
    const orphans = menteeList.filter(
      (m) => !m.current_stage_id || !validStageIds.has(m.current_stage_id)
    )
    if (orphans.length > 0) {
      await supabase
        .from('mentees')
        .update({ current_stage_id: firstStageId })
        .in('id', orphans.map((m) => m.id))
      // Update in-memory data
      orphans.forEach((m) => { m.current_stage_id = firstStageId })
    }
  }

  // Also fix mentees with null kanban_type (admin only, bulk repair)
  if (firstStageId && userRole === 'admin') {
    await supabase
      .from('mentees')
      .update({ kanban_type: 'initial' as const, current_stage_id: firstStageId })
      .is('kanban_type', null)
  }

  const menteeIds = menteeList.map((m) => m.id)

  // Fetch stats + allMentees in parallel (specialists from cache)
  const [
    { data: allMentees },
    { data: attendances },
    { data: indications },
    { data: revenues },
    { data: lastContacts },
    specialists,
  ] = await Promise.all([
    supabase.from('mentees').select('id, full_name').order('full_name'),
    menteeIds.length > 0
      ? supabase.from('attendances').select('mentee_id').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string }[] }),
    menteeIds.length > 0
      ? supabase.from('indications').select('mentee_id').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string }[] }),
    menteeIds.length > 0
      ? supabase.from('revenue_records').select('mentee_id, sale_value').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string; sale_value: number }[] }),
    menteeIds.length > 0
      ? supabase.from('wpp_messages').select('mentee_id, sent_at').eq('direction', 'outgoing').in('mentee_id', menteeIds).order('sent_at', { ascending: false })
      : Promise.resolve({ data: [] as { mentee_id: string; sent_at: string }[] }),
    getCachedSpecialists(),
  ])

  // Build stats maps
  const lastContactMap = new Map<string, string>()
  lastContacts?.forEach((m) => {
    if (!lastContactMap.has(m.mentee_id)) lastContactMap.set(m.mentee_id, m.sent_at)
  })

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

  const now = Date.now()
  const menteesWithStats: MenteeWithStats[] = menteeList.map((m) => {
    const lastContact = lastContactMap.get(m.id)
    const daysSince = lastContact ? Math.floor((now - new Date(lastContact).getTime()) / 86400000) : undefined
    return {
      ...m,
      attendance_count: attendanceMap.get(m.id) ?? 0,
      indication_count: indicationMap.get(m.id) ?? 0,
      revenue_total: revenueMap.get(m.id) ?? 0,
      days_since_contact: daysSince,
    }
  })

  return (
    <KanbanBoard
      title="Etapas Iniciais"
      kanbanType="initial"
      stages={stages}
      initialMentees={menteesWithStats}
      existingMentees={allMentees ?? []}
      isAdmin={userRole === 'admin'}
      specialists={specialists}
    />
  )
}
