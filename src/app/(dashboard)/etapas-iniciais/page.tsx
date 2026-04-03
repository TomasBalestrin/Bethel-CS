import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { MENTEE_SUMMARY_FIELDS, type MenteeWithStats } from '@/types/kanban'

export default async function EtapasIniciaisPage() {
  const supabase = createClient()

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'especialista'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    userRole = profile?.role ?? 'especialista'
  }

  // Fetch stages
  const { data: stages } = await supabase
    .from('kanban_stages')
    .select('id, name, type, position, created_at')
    .eq('type', 'initial')
    .order('position')

  // Fetch mentees in initial kanban (filtered by specialist if not admin)
  let menteesQuery = supabase
    .from('mentees')
    .select(MENTEE_SUMMARY_FIELDS)
    .eq('kanban_type', 'initial')
  if (userRole !== 'admin' && user) {
    menteesQuery = menteesQuery.eq('created_by', user.id)
  }
  const { data: mentees } = await menteesQuery

  // Fetch all mentees for referral lookup
  const { data: allMentees } = await supabase
    .from('mentees')
    .select('id, full_name')
    .order('full_name')

  // Fetch aggregated stats
  const { data: attendances } = await supabase
    .from('attendances')
    .select('mentee_id')

  const { data: indications } = await supabase
    .from('indications')
    .select('mentee_id')

  const { data: revenues } = await supabase
    .from('revenue_records')
    .select('mentee_id, sale_value')

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
    revenueMap.set(
      r.mentee_id,
      (revenueMap.get(r.mentee_id) ?? 0) + Number(r.sale_value)
    )
  })

  // Merge stats into mentees
  const menteesWithStats: MenteeWithStats[] = (mentees ?? []).map((m) => ({
    ...m,
    attendance_count: attendanceMap.get(m.id) ?? 0,
    indication_count: indicationMap.get(m.id) ?? 0,
    revenue_total: revenueMap.get(m.id) ?? 0,
  }))

  // Fetch specialists list for admin
  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'especialista')
    .order('full_name')

  return (
    <KanbanBoard
      title="Etapas Iniciais"
      kanbanType="initial"
      stages={stages ?? []}
      initialMentees={menteesWithStats}
      existingMentees={allMentees ?? []}
      isAdmin={userRole === 'admin'}
      specialists={specialists ?? []}
    />
  )
}
