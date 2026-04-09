import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { MENTEE_SUMMARY_FIELDS, type MenteeWithStats } from '@/types/kanban'
import { getCachedSpecialists, getCachedStages, getCachedAllStages } from '@/lib/cache'

export default async function EtapasIniciaisPage() {
  const supabase = createClient()

  // Get current user + stages + mentees all in parallel
  const [{ data: { user } }, allStages, stages, menteesResult] = await Promise.all([
    supabase.auth.getUser(),
    getCachedAllStages(),
    getCachedStages('initial'),
    supabase.from('mentees').select(MENTEE_SUMMARY_FIELDS).eq('kanban_type', 'initial'),
  ])

  let userRole = 'especialista'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    userRole = profile?.role ?? 'especialista'
  }

  const firstStageId = stages.length > 0 ? stages[0].id : null
  const validInitialStageIds = new Set(allStages.filter((s) => s.type === 'initial').map((s) => s.id))
  const menteeList = menteesResult.data ?? []

  // Auto-repair: fix mentees whose stage doesn't match their kanban type
  if (firstStageId) {
    const orphans = menteeList.filter(
      (m) => !m.current_stage_id || !validInitialStageIds.has(m.current_stage_id)
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
    specialists,
  ] = await Promise.all([
    menteeIds.length > 0
      ? supabase.from('attendances').select('mentee_id').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string }[] }),
    menteeIds.length > 0
      ? supabase.from('indications').select('mentee_id').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string }[] }),
    menteeIds.length > 0
      ? supabase.from('revenue_records').select('mentee_id, sale_value').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string; sale_value: number }[] }),
    getCachedSpecialists(),
  ])

  // Build stats maps
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

  const menteesWithStats: MenteeWithStats[] = menteeList.map((m) => ({
    ...m,
    attendance_count: attendanceMap.get(m.id) ?? 0,
    indication_count: indicationMap.get(m.id) ?? 0,
    revenue_total: revenueMap.get(m.id) ?? 0,
  }))

  return (
    <KanbanBoard
      title="Etapas Iniciais"
      kanbanType="initial"
      stages={stages}
      initialMentees={menteesWithStats}
      existingMentees={menteeList.map((m) => ({ id: m.id, full_name: m.full_name }))}
      isAdmin={userRole === 'admin'}
      specialists={specialists}
    />
  )
}
