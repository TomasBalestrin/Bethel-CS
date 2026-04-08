import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { MENTEE_SUMMARY_FIELDS, type MenteeWithStats } from '@/types/kanban'

export default async function EtapasMentoriaPage() {
  const supabase = createClient()

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'especialista'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    userRole = profile?.role ?? 'especialista'
  }

  // Fetch stages first (needed for orphan repair)
  const { data: stages } = await supabase
    .from('kanban_stages')
    .select('id, name, type, position, created_at')
    .eq('type', 'mentorship')
    .order('position')

  const firstStageId = stages && stages.length > 0 ? stages[0].id : null

  // Auto-repair: fix mentees with kanban_type='mentorship' but no stage
  if (firstStageId && userRole === 'admin') {
    await supabase
      .from('mentees')
      .update({ current_stage_id: firstStageId })
      .eq('kanban_type', 'mentorship')
      .is('current_stage_id', null)
  }

  // Fetch mentees
  let menteesQuery = supabase
    .from('mentees')
    .select(MENTEE_SUMMARY_FIELDS)
    .eq('kanban_type', 'mentorship')
  if (userRole !== 'admin' && user) {
    menteesQuery = menteesQuery.eq('created_by', user.id)
  }
  const { data: mentees } = await menteesQuery

  const menteeList = mentees ?? []
  const menteeIds = menteeList.map((m) => m.id)

  // Fetch all stats + specialists + allMentees in parallel
  const [
    { data: allMentees },
    { data: attendances },
    { data: indications },
    { data: revenues },
    { data: lastContacts },
    { data: specialists },
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
    menteeIds.length > 0
      ? supabase.from('wpp_messages').select('mentee_id, sent_at').eq('direction', 'outgoing').in('mentee_id', menteeIds).order('sent_at', { ascending: false })
      : Promise.resolve({ data: [] as { mentee_id: string; sent_at: string }[] }),
    supabase.from('profiles').select('id, full_name').eq('role', 'especialista').order('full_name'),
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
      title="Etapas Mentoria"
      kanbanType="mentorship"
      stages={stages ?? []}
      initialMentees={menteesWithStats}
      existingMentees={allMentees ?? []}
      isAdmin={userRole === 'admin'}
      specialists={specialists ?? []}
    />
  )
}
