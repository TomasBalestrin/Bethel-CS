import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import type { MenteeWithStats } from '@/types/kanban'

export default async function EtapasIniciaisPage() {
  const supabase = createClient()

  // Fetch stages
  const { data: stages } = await supabase
    .from('kanban_stages')
    .select('*')
    .eq('type', 'initial')
    .order('position')

  // Fetch mentees in initial kanban
  const { data: mentees } = await supabase
    .from('mentees')
    .select('*')
    .eq('kanban_type', 'initial')

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

  return (
    <KanbanBoard
      stages={stages ?? []}
      initialMentees={menteesWithStats}
      existingMentees={allMentees ?? []}
    />
  )
}
