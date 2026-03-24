import { createClient } from '@/lib/supabase/server'
import { MentoradosList } from '@/components/mentorados-list'

export default async function MentoradosPage() {
  const supabase = createClient()

  const { data: mentees } = await supabase
    .from('mentees')
    .select('*')
    .order('full_name')

  return <MentoradosList mentees={mentees ?? []} />
}
