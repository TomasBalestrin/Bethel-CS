import { createClient } from '@/lib/supabase/server'
import { MentoradosList } from '@/components/mentorados-list'
import { MENTEE_SUMMARY_FIELDS } from '@/types/kanban'

export default async function MentoradosPage() {
  const supabase = createClient()

  const { data: mentees } = await supabase
    .from('mentees')
    .select(MENTEE_SUMMARY_FIELDS)
    .order('full_name')

  return <MentoradosList mentees={mentees ?? []} />
}
