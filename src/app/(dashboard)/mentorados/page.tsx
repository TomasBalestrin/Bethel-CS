import { createClient } from '@/lib/supabase/server'
import { MentoradosList } from '@/components/mentorados-list'
import { MENTEE_SUMMARY_FIELDS } from '@/types/kanban'

export default async function MentoradosPage() {
  const supabase = createClient()

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'especialista'
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    userRole = profile?.role ?? 'especialista'
  }

  // Fetch mentees (filtered by specialist if not admin)
  let menteesQuery = supabase
    .from('mentees')
    .select(MENTEE_SUMMARY_FIELDS)
    .order('full_name')
  if (userRole !== 'admin' && user) {
    menteesQuery = menteesQuery.eq('created_by', user.id)
  }
  const { data: mentees } = await menteesQuery

  return <MentoradosList mentees={mentees ?? []} />
}
