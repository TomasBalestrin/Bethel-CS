import { createClient } from '@/lib/supabase/server'
import { ObjectivesList } from '@/components/objectives-list'

export default async function ObjetivosPage() {
  const supabase = createClient()

  const { data: objectives } = await supabase
    .from('objectives')
    .select('*, mentees(full_name)')
    .order('created_at', { ascending: false })

  const enrichedObjectives = (objectives ?? []).map((o) => ({
    ...o,
    mentee_name: (o.mentees as unknown as { full_name: string })?.full_name ?? 'Desconhecido',
  }))

  return <ObjectivesList objectives={enrichedObjectives} />
}
