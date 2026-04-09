import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { MENTEE_SUMMARY_FIELDS, type MenteeWithStats } from '@/types/kanban'
import { getCachedSpecialists, getCachedStages, getCachedAllStages } from '@/lib/cache'

export default async function EtapasMentoriaPage() {
  const supabase = createClient()

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'especialista'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    userRole = profile?.role ?? 'especialista'
  }

  // Fetch stages (cached) + mentees in parallel
  const [allStages, stages, menteesResult] = await Promise.all([
    getCachedAllStages(),
    getCachedStages('mentorship'),
    (() => {
      const q = supabase
        .from('mentees')
        .select(MENTEE_SUMMARY_FIELDS)
        .eq('kanban_type', 'mentorship')
      return q
    })(),
  ])

  const firstStageId = stages.length > 0 ? stages[0].id : null
  const validMentorshipStageIds = new Set(allStages.filter((s) => s.type === 'mentorship').map((s) => s.id))
  const menteeList = menteesResult.data ?? []

  // Auto-repair: fix mentees with null or invalid current_stage_id
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

  // Fetch stats + allMentees in parallel (specialists from cache)
  const [
    { data: allMentees },
    { data: attendances },
    { data: indications },
    { data: revenues },
    specialists,
  ] = await Promise.all([
    supabase.from('mentees').select('id, full_name').order('full_name'),
    menteeIds.length > 0
      ? supabase.from('attendances').select('mentee_id').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string }[] }),
    menteeIds.length > 0
      ? supabase.from('indications').select('mentee_id').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string; sale_value: number }[] }),
    menteeIds.length > 0
      ? supabase.from('revenue_records').select('mentee_id, sale_value').in('mentee_id', menteeIds)
      : Promise.resolve({ data: [] as { mentee_id: string; sale_value: number }[] }),
    getCachedSpecialists(),
  ])

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
      title="Etapas Mentoria"
      kanbanType="mentorship"
      stages={stages}
      initialMentees={menteesWithStats}
      existingMentees={allMentees ?? []}
      isAdmin={userRole === 'admin'}
      specialists={specialists}
    />
  )
}
