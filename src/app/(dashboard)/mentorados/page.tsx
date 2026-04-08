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

  // Fetch kanban stages for bulk move
  const { data: stages } = await supabase
    .from('kanban_stages')
    .select('id, name, type, position')
    .order('position')

  // Fetch distinct filter options from mentees
  const allMenteesData = mentees ?? []
  const funisOrigem = Array.from(new Set(allMenteesData.map((m) => m.funnel_origin).filter(Boolean))) as string[]
  const closers = Array.from(new Set(allMenteesData.map((m) => m.closer_name).filter(Boolean))) as string[]
  const nichos = Array.from(new Set(allMenteesData.map((m) => m.niche).filter(Boolean))) as string[]

  // Fetch action plans for num_colaboradores mapping
  const menteeIds = allMenteesData.map((m) => m.id)
  const { data: actionPlans } = menteeIds.length > 0
    ? await supabase.from('action_plans').select('mentee_id, data').in('mentee_id', menteeIds).not('data', 'is', null)
    : { data: [] }

  const colaboradoresMap: Record<string, string> = {}
  actionPlans?.forEach((ap) => {
    const data = ap.data as Record<string, unknown> | null
    if (data?.num_colaboradores) {
      colaboradoresMap[ap.mentee_id] = String(data.num_colaboradores)
    }
  })

  return (
    <MentoradosList
      mentees={menteesWithStats}
      existingMentees={allMentees ?? []}
      isAdmin={userRole === 'admin'}
      specialists={specialists ?? []}
      stages={stages ?? []}
      filterOptions={{ funisOrigem: funisOrigem.sort(), closers: closers.sort(), nichos: nichos.sort() }}
      colaboradoresMap={colaboradoresMap}
    />
  )
}
