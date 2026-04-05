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

  // Fetch kanban stages for the create dialog
  const { data: stages } = await supabase
    .from('kanban_stages')
    .select('id, name, type, position')
    .order('position')

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
      mentees={mentees ?? []}
      stages={stages ?? []}
      existingMentees={allMentees ?? []}
      isAdmin={userRole === 'admin'}
      specialists={specialists ?? []}
    />
  )
}
