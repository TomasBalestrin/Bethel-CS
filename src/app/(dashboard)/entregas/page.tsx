import { createClient } from '@/lib/supabase/server'
import { EntregasList } from '@/components/entregas-list'

export default async function EntregasPage() {
  const supabase = createClient()

  const { data: events } = await supabase
    .from('delivery_events')
    .select('*')
    .order('delivery_date', { ascending: false })

  // Count participations per event
  const eventIds = (events ?? []).map((e) => e.id)
  const { data: participations } = eventIds.length > 0
    ? await supabase.from('delivery_participations').select('delivery_event_id').in('delivery_event_id', eventIds)
    : { data: [] }

  const participationCounts = new Map<string, number>()
  participations?.forEach((p) => {
    participationCounts.set(p.delivery_event_id, (participationCounts.get(p.delivery_event_id) ?? 0) + 1)
  })

  const enriched = (events ?? []).map((e) => ({
    ...e,
    participation_count: participationCounts.get(e.id) ?? 0,
  }))

  return <EntregasList events={enriched} />
}
