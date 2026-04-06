import { createClient } from '@/lib/supabase/server'
import { MentoradosList } from '@/components/mentorados-list'
import { MENTEE_SUMMARY_FIELDS, type MenteeWithStats } from '@/types/kanban'

export default async function MentoradosPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'especialista'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    userRole = profile?.role ?? 'especialista'
  }

  let menteesQuery = supabase
    .from('mentees')
    .select(MENTEE_SUMMARY_FIELDS)
    .order('full_name')
  if (userRole !== 'admin' && user) {
    menteesQuery = menteesQuery.eq('created_by', user.id)
  }
  const { data: mentees } = await menteesQuery

  // Fetch stats
  const { data: indications } = await supabase.from('indications').select('mentee_id')
  const { data: revenues } = await supabase.from('revenue_records').select('mentee_id, sale_value')

  const indicationMap = new Map<string, number>()
  indications?.forEach((i) => { indicationMap.set(i.mentee_id, (indicationMap.get(i.mentee_id) ?? 0) + 1) })

  const revenueMap = new Map<string, number>()
  revenues?.forEach((r) => { revenueMap.set(r.mentee_id, (revenueMap.get(r.mentee_id) ?? 0) + Number(r.sale_value)) })

  const menteesWithStats: MenteeWithStats[] = (mentees ?? []).map((m) => ({
    ...m,
    attendance_count: 0,
    indication_count: indicationMap.get(m.id) ?? 0,
    revenue_total: revenueMap.get(m.id) ?? 0,
  }))

  // Fetch all mentees for referral lookup
  const { data: allMentees } = await supabase
    .from('mentees')
    .select('id, full_name')
    .order('full_name')

  // Fetch specialists for admin
  const { data: specialists } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'especialista')
    .order('full_name')

  return (
    <MentoradosList
      mentees={menteesWithStats}
      existingMentees={allMentees ?? []}
      isAdmin={userRole === 'admin'}
      specialists={specialists ?? []}
    />
  )
}
